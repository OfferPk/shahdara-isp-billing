/**
 * Shahdara ISP - Field Technician Fiber Splitter Tree & Cascaded PON Topology Analyzer
 * Part of mobile navigation and field crew tools (agent2 - shahdara-mobile-nav).
 *
 * Implements ITU-T G.984 GPON and ITU-T G.9807 XGS-PON Optical Distribution Network (ODN)
 * cascaded splitter loss calculation, asymmetric tap ratio analysis, and interactive SVG topology visualizer:
 * - Balanced Symmetrical Splitters (1:2, 1:4, 1:8, 1:16, 1:32, 1:64)
 * - Asymmetrical Optical Tap Splitters (90/10%, 80/20%, 70/30%, 60/40%, 50/50%)
 * - Cumulative branch loss summation (fiber distance km, splices, mated connector pairs, splitter stages)
 * - Optical margin against ITU-T Class B+ (-28 dBm) & Class C+ (-32 dBm) receiver sensitivities
 * - Pure vector SVG cascaded network tree with dynamic power indicators
 * - Persistent audit logs and WhatsApp field crew dispatch summaries
 */

export const SPLITTER_TREE_STORAGE_KEY = 'shahdara_splitter_tree_audits_v1';

export const BALANCED_SPLITTERS = {
  '1:2': { ratio: '1:2', nominalLossDb: 3.5, maxLossDb: 3.8, outputPorts: 2 },
  '1:4': { ratio: '1:4', nominalLossDb: 7.2, maxLossDb: 7.6, outputPorts: 4 },
  '1:8': { ratio: '1:8', nominalLossDb: 10.5, maxLossDb: 10.9, outputPorts: 8 },
  '1:16': { ratio: '1:16', nominalLossDb: 13.8, maxLossDb: 14.2, outputPorts: 16 },
  '1:32': { ratio: '1:32', nominalLossDb: 17.0, maxLossDb: 17.5, outputPorts: 32 },
  '1:64': { ratio: '1:64', nominalLossDb: 20.5, maxLossDb: 21.2, outputPorts: 64 }
};

export const TAP_SPLITTERS = {
  '90/10': { ratio: '90/10', throughLossDb: 0.8, tapLossDb: 10.6, description: 'Main Trunk Tap (High Pass-Through)' },
  '80/20': { ratio: '80/20', throughLossDb: 1.4, tapLossDb: 7.4, description: 'Mid-Route Feeder Tap' },
  '70/30': { ratio: '70/30', throughLossDb: 2.0, tapLossDb: 5.6, description: 'Intermediate Node Tap' },
  '60/40': { ratio: '60/40', throughLossDb: 2.7, tapLossDb: 4.4, description: 'Near-Terminus Tap' },
  '50/50': { ratio: '50/50', throughLossDb: 3.5, tapLossDb: 3.5, description: 'Equal Power Split Tap' }
};

export const ODN_CLASSES = {
  CLASS_B_PLUS: {
    id: 'CLASS_B_PLUS',
    name: 'ITU-T Class B+ (GPON standard)',
    minTxPowerDbm: 1.5,
    maxTxPowerDbm: 5.0,
    typicalTxPowerDbm: 3.5,
    minRxSensitivityDbm: -28.0,
    saturationDbm: -8.0,
    maxAllowedLossDb: 28.5
  },
  CLASS_C_PLUS: {
    id: 'CLASS_C_PLUS',
    name: 'ITU-T Class C+ (Extended reach)',
    minTxPowerDbm: 3.0,
    maxTxPowerDbm: 7.0,
    typicalTxPowerDbm: 5.0,
    minRxSensitivityDbm: -32.0,
    saturationDbm: -12.0,
    maxAllowedLossDb: 32.0
  }
};

export const SHAHDARA_CASCADE_PRESETS = [
  {
    id: 'PRESET_BARADARI_CASCADE',
    name: 'Baradari Hub 2-Stage Cascade (1:4 Feeder → 1:8 Access FATs)',
    odnClass: 'CLASS_B_PLUS',
    feederFiberKm: 2.4,
    distributionFiberKm: 0.8,
    dropFiberKm: 0.15,
    primarySplitter: '1:4',
    secondarySplitter: '1:8',
    spliceCount: 4,
    connectorPairs: 3,
    oltTxPowerDbm: 3.5,
    locationArea: 'Baradari Road',
    feederCableTag: 'FDR-BAR-01',
    description: 'Standard 2-tier residential architecture feeding 32 end-users per PON port'
  },
  {
    id: 'PRESET_VANDALA_HIGH_DENSITY',
    name: 'Vandala Road High-Density (1:2 Trunk → 1:16 Distribution Hub)',
    odnClass: 'CLASS_B_PLUS',
    feederFiberKm: 3.8,
    distributionFiberKm: 1.2,
    dropFiberKm: 0.1,
    primarySplitter: '1:2',
    secondarySplitter: '1:16',
    spliceCount: 5,
    connectorPairs: 4,
    oltTxPowerDbm: 4.2,
    locationArea: 'Vandala Road',
    feederCableTag: 'FDR-VAN-02',
    description: 'Extended feeder with high port-density terminal blocks'
  },
  {
    id: 'PRESET_GT_ROAD_TAP_BUS',
    name: 'GT Road Linear Tap-Bus (80/20 Optical Tap → 1:8 Access)',
    odnClass: 'CLASS_C_PLUS',
    feederFiberKm: 4.5,
    distributionFiberKm: 0.5,
    dropFiberKm: 0.2,
    tapRatio: '80/20',
    primarySplitter: 'TAP_80_20',
    secondarySplitter: '1:8',
    spliceCount: 6,
    connectorPairs: 4,
    oltTxPowerDbm: 5.5,
    locationArea: 'GT Road Commercial Corridor',
    feederCableTag: 'TAP-GT-01',
    description: 'Asymmetric tap architecture optimized for linear roadside shops and plazas'
  },
  {
    id: 'PRESET_OVEREXTENDED_MACROBEND',
    name: 'Faiz Park Overextended / Macrobend Warning (1:8 → 1:8 Deep Cascade)',
    odnClass: 'CLASS_B_PLUS',
    feederFiberKm: 6.2,
    distributionFiberKm: 2.1,
    dropFiberKm: 0.35,
    primarySplitter: '1:8',
    secondarySplitter: '1:8',
    spliceCount: 8,
    connectorPairs: 5,
    oltTxPowerDbm: 3.0,
    macrobendPenaltyDb: 6.5,
    locationArea: 'Faiz Park',
    feederCableTag: 'FDR-FP-03',
    description: '1:64 total split with long distance and severe pinch fault exceeding receiver cutoff'
  }
];

/**
 * Calculates optical splitter attenuation.
 */
export function calculateSplitterLoss(splitterType, tapLeg = 'tap') {
  if (BALANCED_SPLITTERS[splitterType]) {
    return BALANCED_SPLITTERS[splitterType].nominalLossDb;
  }
  if (splitterType.startsWith('TAP_')) {
    const key = splitterType.replace('TAP_', '').replace('_', '/');
    if (TAP_SPLITTERS[key]) {
      return tapLeg === 'through' ? TAP_SPLITTERS[key].throughLossDb : TAP_SPLITTERS[key].tapLossDb;
    }
  }
  if (TAP_SPLITTERS[splitterType]) {
    return tapLeg === 'through' ? TAP_SPLITTERS[splitterType].throughLossDb : TAP_SPLITTERS[splitterType].tapLossDb;
  }
  return 10.5; // Default 1:8 loss
}

/**
 * Calculates end-to-end optical link loss and received power along a cascaded branch.
 */
export function calculateCascadedBranchBudget(params = {}) {
  const feederKm = Number(params.feederFiberKm) || 0;
  const distKm = Number(params.distributionFiberKm) || 0;
  const dropKm = Number(params.dropFiberKm) || 0;
  const totalFiberKm = Math.round((feederKm + distKm + dropKm) * 100) / 100;

  // Fiber attenuation: 0.35 dB/km @ 1310nm (upstream), 0.22 dB/km @ 1490nm (downstream GPON)
  const wavelength = params.wavelength || 1490;
  const fiberCoeffDbPerKm = wavelength === 1310 ? 0.35 : (wavelength === 1550 ? 0.20 : 0.22);
  const fiberLossDb = Math.round(totalFiberKm * fiberCoeffDbPerKm * 100) / 100;

  // Passive component loss
  const splices = Number(params.spliceCount) || 0;
  const spliceLossDb = Math.round(splices * 0.15 * 100) / 100; // 0.15 dB per fusion splice

  const connectors = Number(params.connectorPairs) || 0;
  const connectorLossDb = Math.round(connectors * 0.35 * 100) / 100; // 0.35 dB per mated pair

  // Splitters
  const primarySplit = params.primarySplitter || '1:4';
  const primaryLossDb = calculateSplitterLoss(primarySplit, params.tapLeg || 'tap');

  const secondarySplit = params.secondarySplitter || '1:8';
  const secondaryLossDb = calculateSplitterLoss(secondarySplit, 'tap');

  const macrobendLossDb = Number(params.macrobendPenaltyDb) || 0;

  // Total Optical Insertion Loss
  const totalLossDb = Math.round((fiberLossDb + spliceLossDb + connectorLossDb + primaryLossDb + secondaryLossDb + macrobendLossDb) * 100) / 100;

  // Received Optical Power
  const oltTxPowerDbm = Number(params.oltTxPowerDbm) || 3.5;
  const receivedPowerDbm = Math.round((oltTxPowerDbm - totalLossDb) * 100) / 100;

  // Sensitivity & Margin Evaluation
  const odnClassKey = params.odnClass || 'CLASS_B_PLUS';
  const odnSpec = ODN_CLASSES[odnClassKey] || ODN_CLASSES.CLASS_B_PLUS;

  const opticalMarginDb = Math.round((receivedPowerDbm - odnSpec.minRxSensitivityDbm) * 100) / 100;
  const isPass = receivedPowerDbm >= odnSpec.minRxSensitivityDbm && receivedPowerDbm <= odnSpec.saturationDbm;

  let healthStatus = 'OPTIMAL';
  let statusColor = '#10b981';
  let badgeLabel = 'HEALTHY (PASS)';

  if (receivedPowerDbm < odnSpec.minRxSensitivityDbm) {
    healthStatus = 'OUT_OF_SERVICE_FAIL';
    statusColor = '#ef4444';
    badgeLabel = 'CRITICAL LOSS (FAIL)';
  } else if (opticalMarginDb < 2.0) {
    healthStatus = 'MARGINAL_WARNING';
    statusColor = '#f59e0b';
    badgeLabel = 'MARGINAL (LOW HEADROOM)';
  } else if (receivedPowerDbm > odnSpec.saturationDbm) {
    healthStatus = 'OVERLOAD_SATURATION';
    statusColor = '#ef4444';
    badgeLabel = 'OPTICAL SATURATION';
  }

  return {
    totalFiberKm,
    fiberLossDb,
    spliceLossDb,
    connectorLossDb,
    primaryLossDb,
    secondaryLossDb,
    macrobendLossDb,
    totalLossDb,
    oltTxPowerDbm,
    receivedPowerDbm,
    rxPowerDbm: receivedPowerDbm,
    opticalMarginDb,
    odnSpec,
    isPass,
    overallPass: isPass,
    healthStatus,
    statusColor,
    badgeLabel
  };
}

/**
 * Retrieves the persistent splitter tree audit store.
 */
export function getSplitterTreeStore(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) {
    return getDefaultSplitterTreeAudits();
  }
  try {
    const raw = storage.getItem(SPLITTER_TREE_STORAGE_KEY);
    if (!raw) {
      const initial = getDefaultSplitterTreeAudits();
      saveSplitterTreeStore(initial, storage);
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : getDefaultSplitterTreeAudits();
  } catch {
    return getDefaultSplitterTreeAudits();
  }
}

/**
 * Saves splitter tree audit records to storage.
 */
export function saveSplitterTreeStore(records, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return false;
  try {
    storage.setItem(SPLITTER_TREE_STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

/**
 * Appends a new splitter tree audit record.
 */
export function recordSplitterTreeAudit(entry, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const store = getSplitterTreeStore(storage);
  const now = new Date();
  const record = {
    id: `TREE-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    timestamp: now.toISOString(),
    displayTime: now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true }),
    displayDate: now.toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' }),
    locationArea: entry.locationArea || 'Baradari Road',
    feederCableTag: entry.feederCableTag || 'FDR-BAR-01',
    primarySplitter: entry.primarySplitter || '1:4',
    secondarySplitter: entry.secondarySplitter || '1:8',
    totalFiberKm: entry.totalFiberKm || 3.35,
    totalLossDb: entry.totalLossDb || 22.8,
    receivedPowerDbm: entry.receivedPowerDbm || -19.3,
    status: entry.status || 'PASS',
    healthStatus: entry.healthStatus || 'OPTIMAL',
    technician: entry.technician || 'Lineman Splice Team'
  };

  store.unshift(record);
  if (store.length > 50) store.length = 50;
  saveSplitterTreeStore(store, storage);
  return store;
}

/**
 * Clears the persistent store.
 */
export function clearSplitterTreeStore(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return false;
  return saveSplitterTreeStore([], storage);
}

/**
 * Initial sample audits for Shahdara ISP.
 */
export function getDefaultSplitterTreeAudits() {
  return [
    {
      id: 'TREE-20261016-01',
      timestamp: '2026-10-16T14:30:00.000Z',
      displayTime: '02:30 PM',
      displayDate: 'Oct 16, 2026',
      locationArea: 'Baradari Road',
      feederCableTag: 'FDR-BAR-01',
      primarySplitter: '1:4',
      secondarySplitter: '1:8',
      totalFiberKm: 3.35,
      totalLossDb: 22.1,
      receivedPowerDbm: -18.6,
      status: 'PASS',
      healthStatus: 'OPTIMAL',
      technician: 'Tariq Lineman'
    },
    {
      id: 'TREE-20261016-02',
      timestamp: '2026-10-16T12:15:00.000Z',
      displayTime: '12:15 PM',
      displayDate: 'Oct 16, 2026',
      locationArea: 'Vandala Road',
      feederCableTag: 'FDR-VAN-02',
      primarySplitter: '1:2',
      secondarySplitter: '1:16',
      totalFiberKm: 5.1,
      totalLossDb: 25.4,
      receivedPowerDbm: -21.2,
      status: 'PASS',
      healthStatus: 'OPTIMAL',
      technician: 'Kashif Tech'
    },
    {
      id: 'TREE-20261016-03',
      timestamp: '2026-10-16T10:00:00.000Z',
      displayTime: '10:00 AM',
      displayDate: 'Oct 16, 2026',
      locationArea: 'Faiz Park',
      feederCableTag: 'FDR-FP-03',
      primarySplitter: '1:8',
      secondarySplitter: '1:8',
      totalFiberKm: 8.65,
      totalLossDb: 31.8,
      receivedPowerDbm: -28.8,
      status: 'FAIL',
      healthStatus: 'OUT_OF_SERVICE_FAIL',
      technician: 'Asim Field Sup'
    }
  ];
}

/**
 * Pure Vector SVG Topology Tree Visualizer.
 */
export function renderMobileSplitterTreeSvg(budget, options = {}) {
  const b = budget || calculateCascadedBranchBudget(SHAHDARA_CASCADE_PRESETS[0]);
  const width = options.width || 420;
  const height = options.height || 360;

  const isHealthy = b.isPass && b.healthStatus === 'OPTIMAL';
  const isMarginal = b.healthStatus === 'MARGINAL_WARNING';
  const rxColor = isHealthy ? '#10b981' : (isMarginal ? '#f59e0b' : '#ef4444');

  const rootX = 60;
  const rootY = 160;

  const stage1X = 175;
  const stage1Y = 160;

  const stage2X = 300;
  const stage2Ys = [75, 160, 245];

  const endUserX = 385;

  return `<svg class="splitter-tree-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cascaded PON Splitter Distribution Tree">
  <defs>
    <linearGradient id="oltGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
    <linearGradient id="fiberLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="${rxColor}" />
    </linearGradient>
    <filter id="neonBloom" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="#090d16" stroke="#1e293b" stroke-width="1.2" />

  <!-- Title & Topology HUD Header -->
  <text x="14" y="22" fill="#94a3b8" font-size="10" font-family="monospace">ODN CASCADED SPLITTER TREE</text>
  <text x="${width - 14}" y="22" text-anchor="end" fill="${rxColor}" font-size="10" font-weight="700" font-family="monospace">${b.badgeLabel}</text>

  <!-- Trunk Feeder Fiber Cable Line (OLT to Stage 1) -->
  <path d="M ${rootX} ${rootY} L ${stage1X} ${stage1Y}" stroke="#0284c7" stroke-width="3" stroke-linecap="round" />
  <text x="${(rootX + stage1X) / 2}" y="${rootY - 10}" text-anchor="middle" fill="#64748b" font-size="8.5" font-family="monospace">
    ${b.totalFiberKm > 0 ? (b.totalFiberKm * 0.6).toFixed(1) : '2.0'} km (${b.fiberLossDb} dB)
  </text>

  <!-- Distribution Lines (Stage 1 to Stage 2 Branches) -->
  ${stage2Ys.map((y, idx) => {
    const isSelectedBranch = idx === 1;
    const strokeColor = isSelectedBranch ? 'url(#fiberLineGrad)' : '#334155';
    const strokeW = isSelectedBranch ? '2.5' : '1.5';
    return `
      <path d="M ${stage1X} ${stage1Y} C ${stage1X + 50} ${stage1Y}, ${stage2X - 50} ${y}, ${stage2X} ${y}" fill="none" stroke="${strokeColor}" stroke-width="${strokeW}" />
      <!-- Drop Line to End Terminal -->
      <line x1="${stage2X}" y1="${y}" x2="${endUserX}" y2="${y}" stroke="${isSelectedBranch ? rxColor : '#334155'}" stroke-width="${strokeW}" stroke-dasharray="${isSelectedBranch ? 'none' : '3,3'}" />
      <circle cx="${endUserX}" cy="${y}" r="4" fill="${isSelectedBranch ? rxColor : '#475569'}" />
      <text x="${endUserX + 8}" y="${y + 3}" fill="${isSelectedBranch ? '#f8fafc' : '#64748b'}" font-size="8" font-family="monospace">
        ${isSelectedBranch ? `${b.receivedPowerDbm} dBm` : 'FAT'}
      </text>
    `;
  }).join('')}

  <!-- OLT SFP Port Node (Root) -->
  <g transform="translate(${rootX - 35}, ${rootY - 24})" filter="url(#neonBloom)">
    <rect x="0" y="0" width="70" height="48" rx="8" fill="#0f172a" stroke="#0284c7" stroke-width="2" />
    <text x="35" y="20" text-anchor="middle" fill="#f8fafc" font-size="10" font-weight="800">OLT PORT</text>
    <text x="35" y="36" text-anchor="middle" fill="#38bdf8" font-size="9" font-family="monospace">+${b.oltTxPowerDbm} dBm</text>
  </g>

  <!-- Level 1 Primary Splitter Node -->
  <g transform="translate(${stage1X - 28}, ${stage1Y - 24})">
    <rect x="0" y="0" width="56" height="48" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="1.8" />
    <text x="28" y="19" text-anchor="middle" fill="#f8fafc" font-size="9" font-weight="700">STAGE 1</text>
    <text x="28" y="34" text-anchor="middle" fill="#e2e8f0" font-size="8" font-family="monospace">-${b.primaryLossDb} dB</text>
  </g>

  <!-- Level 2 Secondary Splitter Node (Active Branch) -->
  <g transform="translate(${stage2X - 28}, ${stage2Ys[1] - 24})">
    <rect x="0" y="0" width="56" height="48" rx="8" fill="#0f172a" stroke="${rxColor}" stroke-width="2" />
    <text x="28" y="19" text-anchor="middle" fill="#f8fafc" font-size="9" font-weight="700">STAGE 2</text>
    <text x="28" y="34" text-anchor="middle" fill="${rxColor}" font-size="8" font-family="monospace">-${b.secondaryLossDb} dB</text>
  </g>

  <!-- Bottom HUD Summary Strip -->
  <g transform="translate(14, ${height - 56})">
    <rect x="0" y="0" width="${width - 28}" height="44" rx="8" fill="#0b1120" stroke="#1e293b" stroke-width="1" />
    <text x="14" y="18" fill="#94a3b8" font-size="8.5">Cumulative ODN Loss:</text>
    <text x="14" y="34" fill="#f8fafc" font-size="12" font-weight="800">${b.totalLossDb} dB</text>

    <text x="${width / 2 - 20}" y="18" fill="#94a3b8" font-size="8.5">ONT Rx Power:</text>
    <text x="${width / 2 - 20}" y="34" fill="${rxColor}" font-size="12" font-weight="800">${b.receivedPowerDbm} dBm</text>

    <text x="${width - 120}" y="18" fill="#94a3b8" font-size="8.5">Optical Margin:</text>
    <text x="${width - 120}" y="34" fill="${rxColor}" font-size="12" font-weight="800">${b.opticalMarginDb > 0 ? '+' : ''}${b.opticalMarginDb} dB</text>
  </g>
</svg>`;
}

/**
 * Formats WhatsApp dispatch slip for lineman optical tree inspection.
 */
export function generateSplitterTreeWhatsAppReport(audit) {
  if (!audit) return 'No optical splitter tree data available.';

  return [
    '🌴 *SHAHDARA ISP CASCADED SPLITTER TREE REPORT*',
    'Standard: ITU-T G.984 / G.9807 Optical Distribution Network',
    '------------------------------------------------',
    `📍 *Location / Area:* ${audit.locationArea} (${audit.feederCableTag})`,
    `⚡ *Stage 1 Splitter:* ${audit.primarySplitter}`,
    `⚡ *Stage 2 Splitter:* ${audit.secondarySplitter}`,
    `📏 *Total Fiber Span:* ${audit.totalFiberKm} km`,
    `📉 *Total Optical Loss:* ${audit.totalLossDb} dB`,
    `📡 *Calculated ONT Rx:* ${audit.receivedPowerDbm} dBm`,
    `📊 *Branch Result:* ${audit.status === 'PASS' ? '✅ PASS (Healthy Margin)' : '❌ FAIL (Attenuation Exceeded)'}`,
    `👷 *Technician:* ${audit.technician}`,
    `🕒 *Timestamp:* ${audit.displayDate} ${audit.displayTime}`,
    '------------------------------------------------',
    audit.status === 'PASS'
      ? '✨ *Action:* Optical path certified within Class B+ sensitivity. Safe for customer activation.'
      : '⚠️ *Action:* Excessive attenuation detected! Inspect primary splitter tray for macrobend or re-splice feeder.'
  ].join('\n');
}

/**
 * Initializes and wires the mobile Splitter Tree modal, controls, and events.
 */
export function setupMobileSplitterTreeModal({ storage = (typeof localStorage !== 'undefined' ? localStorage : null), onToast, clipboard } = {}) {
  const modal = document.getElementById('mobileSplitterTreeModal');
  const closeBtn = document.getElementById('mobileSplitterTreeCloseBtn');

  const presetSelect = document.getElementById('splitterTreePresetSelect');
  const primarySelect = document.getElementById('splitterTreePrimarySelect');
  const secondarySelect = document.getElementById('splitterTreeSecondarySelect');
  const odnClassSelect = document.getElementById('splitterTreeOdnClassSelect');

  const feederKmInput = document.getElementById('splitterTreeFeederKm');
  const distKmInput = document.getElementById('splitterTreeDistKm');
  const dropKmInput = document.getElementById('splitterTreeDropKm');
  const splicesInput = document.getElementById('splitterTreeSplices');
  const connectorsInput = document.getElementById('splitterTreeConnectors');
  const oltTxInput = document.getElementById('splitterTreeOltTx');

  const svgWrap = document.getElementById('splitterTreeSvgWrap') || document.getElementById('splitterTreeSvgContainer');
  const historyList = document.getElementById('splitterTreeHistoryList');

  const kpiLoss = document.getElementById('splitterTreeKpiLoss') || document.getElementById('splitterTreeTotalLossBadge');
  const kpiRx = document.getElementById('splitterTreeKpiRx') || document.getElementById('splitterTreeRxPowerBadge');
  const kpiMargin = document.getElementById('splitterTreeKpiMargin') || document.getElementById('splitterTreeMarginBadge');
  const kpiGrade = document.getElementById('splitterTreeKpiGrade') || document.getElementById('splitterTreeStatusBadge');

  const saveBtn = document.getElementById('splitterTreeSaveBtn');
  const whatsappBtn = document.getElementById('splitterTreeWhatsappBtn');
  const clearHistoryBtn = document.getElementById('splitterTreeClearHistoryBtn');

  const locationInput = document.getElementById('splitterTreeLocationInput');
  const feederTagInput = document.getElementById('splitterTreeFeederTagInput');
  const techInput = document.getElementById('splitterTreeTechInput');

  let currentPreset = SHAHDARA_CASCADE_PRESETS[0];

  function getParamsFromUi() {
    return {
      feederFiberKm: feederKmInput ? parseFloat(feederKmInput.value) || 0 : currentPreset.feederFiberKm,
      distributionFiberKm: distKmInput ? parseFloat(distKmInput.value) || 0 : currentPreset.distributionFiberKm,
      dropFiberKm: dropKmInput ? parseFloat(dropKmInput.value) || 0 : currentPreset.dropFiberKm,
      primarySplitter: primarySelect ? primarySelect.value : currentPreset.primarySplitter,
      secondarySplitter: secondarySelect ? secondarySelect.value : currentPreset.secondarySplitter,
      odnClass: odnClassSelect ? odnClassSelect.value : currentPreset.odnClass,
      spliceCount: splicesInput ? parseInt(splicesInput.value, 10) || 0 : currentPreset.spliceCount,
      connectorPairs: connectorsInput ? parseInt(connectorsInput.value, 10) || 0 : currentPreset.connectorPairs,
      oltTxPowerDbm: oltTxInput ? parseFloat(oltTxInput.value) || 3.5 : currentPreset.oltTxPowerDbm,
      macrobendPenaltyDb: currentPreset.macrobendPenaltyDb || 0
    };
  }

  function renderView() {
    const params = getParamsFromUi();
    const budget = calculateCascadedBranchBudget(params);

    if (svgWrap) {
      svgWrap.innerHTML = renderMobileSplitterTreeSvg(budget);
    }

    if (kpiLoss) {
      kpiLoss.textContent = `${budget.totalLossDb} dB`;
    }
    if (kpiRx) {
      kpiRx.textContent = `${budget.receivedPowerDbm} dBm`;
      if (kpiRx.style) kpiRx.style.color = budget.statusColor;
    }
    if (kpiMargin) {
      kpiMargin.textContent = `${budget.opticalMarginDb > 0 ? '+' : ''}${budget.opticalMarginDb} dB`;
      if (kpiMargin.style) kpiMargin.style.color = budget.statusColor;
    }
    if (kpiGrade) {
      kpiGrade.textContent = budget.badgeLabel;
      if (kpiGrade.style) kpiGrade.style.color = budget.statusColor;
    }

    renderHistory();
  }

  function renderHistory() {
    if (!historyList) return;
    const store = getSplitterTreeStore(storage);
    if (!store || store.length === 0) {
      historyList.innerHTML = `<li style="padding: 12px; text-align: center; color: var(--text-muted, #64748b);">No splitter tree audits recorded.</li>`;
      return;
    }

    historyList.innerHTML = store.slice(0, 10).map(item => `
      <li class="ont-history-card">
        <div>
          <strong>${item.locationArea}</strong> <span style="font-size:11px;color:#64748b;">(${item.feederCableTag})</span>
          <div style="font-size:11px;margin-top:2px;">${item.primarySplitter} → ${item.secondarySplitter} · ${item.totalFiberKm} km · ${item.totalLossDb} dB</div>
        </div>
        <div style="text-align:right;">
          <strong style="color:${item.status === 'PASS' ? '#10b981' : '#ef4444'}">${item.receivedPowerDbm} dBm</strong>
          <div style="font-size:10px;color:#64748b;">${item.displayDate}</div>
        </div>
      </li>
    `).join('');
  }

  function applyPreset(presetId) {
    const found = SHAHDARA_CASCADE_PRESETS.find(p => p.id === presetId);
    if (!found) return;
    currentPreset = found;

    if (presetSelect) presetSelect.value = found.id;
    if (primarySelect) primarySelect.value = found.primarySplitter;
    if (secondarySelect) secondarySelect.value = found.secondarySplitter;
    if (odnClassSelect) odnClassSelect.value = found.odnClass;
    if (feederKmInput) feederKmInput.value = found.feederFiberKm;
    if (distKmInput) distKmInput.value = found.distributionFiberKm;
    if (dropKmInput) dropKmInput.value = found.dropFiberKm;
    if (splicesInput) splicesInput.value = found.spliceCount;
    if (connectorsInput) connectorsInput.value = found.connectorPairs;
    if (oltTxInput) oltTxInput.value = found.oltTxPowerDbm;
    if (locationInput) locationInput.value = found.locationArea;
    if (feederTagInput) feederTagInput.value = found.feederCableTag;

    renderView();
  }

  // Event wiring
  if (presetSelect) {
    presetSelect.onchange = e => applyPreset(e.target.value);
  }

  [feederKmInput, distKmInput, dropKmInput, primarySelect, secondarySelect, odnClassSelect, splicesInput, connectorsInput, oltTxInput].forEach(elem => {
    if (elem) elem.oninput = renderView;
  });

  if (saveBtn) {
    saveBtn.onclick = () => {
      const params = getParamsFromUi();
      const budget = calculateCascadedBranchBudget(params);
      const loc = locationInput ? locationInput.value.trim() : currentPreset.locationArea;
      const tag = feederTagInput ? feederTagInput.value.trim() : currentPreset.feederCableTag;
      const tech = techInput ? techInput.value.trim() : 'Lineman Team';

      recordSplitterTreeAudit({
        locationArea: loc,
        feederCableTag: tag,
        primarySplitter: params.primarySplitter,
        secondarySplitter: params.secondarySplitter,
        totalFiberKm: budget.totalFiberKm,
        totalLossDb: budget.totalLossDb,
        receivedPowerDbm: budget.receivedPowerDbm,
        status: budget.isPass ? 'PASS' : 'FAIL',
        healthStatus: budget.healthStatus,
        technician: tech
      }, storage);

      renderView();
      if (typeof onToast === 'function') {
        onToast(`Splitter tree audit saved for ${tag} (${budget.receivedPowerDbm} dBm)`);
      }
    };
  }

  if (whatsappBtn) {
    whatsappBtn.onclick = async () => {
      const params = getParamsFromUi();
      const budget = calculateCascadedBranchBudget(params);
      const loc = locationInput ? locationInput.value.trim() : currentPreset.locationArea;
      const tag = feederTagInput ? feederTagInput.value.trim() : currentPreset.feederCableTag;
      const tech = techInput ? techInput.value.trim() : 'Lineman Team';

      const auditData = {
        locationArea: loc,
        feederCableTag: tag,
        primarySplitter: params.primarySplitter,
        secondarySplitter: params.secondarySplitter,
        totalFiberKm: budget.totalFiberKm,
        totalLossDb: budget.totalLossDb,
        receivedPowerDbm: budget.receivedPowerDbm,
        status: budget.isPass ? 'PASS' : 'FAIL',
        technician: tech,
        displayDate: new Date().toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' }),
        displayTime: new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })
      };

      const text = generateSplitterTreeWhatsAppReport(auditData);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      try {
        if (clip?.writeText) {
          await clip.writeText(text);
          if (typeof onToast === 'function') {
            onToast('WhatsApp splitter tree report copied to clipboard!');
          }
        } else if (typeof window !== 'undefined' && window.prompt) {
          window.prompt('Copy WhatsApp splitter tree report:', text);
        }
      } catch {
        if (typeof window !== 'undefined' && window.prompt) {
          window.prompt('Copy WhatsApp splitter tree report:', text);
        }
      }
    };
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.onclick = () => {
      clearSplitterTreeStore(storage);
      renderView();
      if (typeof onToast === 'function') {
        onToast('Cleared splitter tree audit history.');
      }
    };
  }

  function openModal(presetId = null) {
    if (presetId) applyPreset(presetId);
    renderView();
    if (modal) {
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
    }
  }

  function closeModal() {
    if (modal) {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    }
  }

  if (closeBtn) closeBtn.onclick = closeModal;
  if (modal) {
    modal.onclick = e => {
      if (e.target === modal) closeModal();
    };
  }

  document.querySelectorAll('[data-open-splitter-tree]').forEach(btn => {
    btn.onclick = () => openModal();
  });

  // Initial draw
  renderView();

  return {
    openModal,
    closeModal,
    applyPreset,
    renderView
  };
}
