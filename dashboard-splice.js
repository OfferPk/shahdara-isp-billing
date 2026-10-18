import { formatPKR } from './core.js';

/**
 * Aerial Fiber Splice Closure Tray Capacity & Micro-Bend Loss Estimation Matrix
 * Models Fiber Optic Splice Closures (FOSC dome and inline models) deployed across
 * Shahdara distribution poles, calculating splice tray fill factor, sleeve saturation,
 * buffer tube slack loop storage, macro-bend & micro-bend optical attenuation across
 * 1310nm vs 1550nm wavelengths, IP68 hermetic seal pressure, and revenue at risk.
 */

export const SHAHDARA_SPLICE_CLOSURES = [
  {
    id: 'fosc-bd-01',
    name: 'Bara Dari Pole-14 Trunk Splice Dome',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    closureModel: 'FOSC-400D5 Dome',
    mounting: 'Pole Mount (12m)',
    maxTrays: 6,
    trayCapacity: 24, // 24 fusion sleeves per tray
    traysInstalled: 4,
    fusedSplices: 82, // 85.4% tray fill
    splittersInstalled: '4x 1:8 PLC',
    fiberStandard: 'ITU-T G.652.D Standard SMF',
    fiberStandardKey: 'g652d',
    nominalTrayBendRadiusMm: 30,
    slackStorageMeters: 1.5,
    ipRating: 'IP68 Hermetic',
    sealPressurePsi: 14.5,
    installationYear: 2022
  },
  {
    id: 'fosc-mb-02',
    name: 'Main Bazaar Commercial Hub Inline Enclosure',
    primaryArea: 'Main Bazaar',
    aliasAreas: ['Main Bazaar', 'Commercial Market'],
    closureModel: 'FOSC-200 Inline Horizontal',
    mounting: 'Strand Suspended (8m)',
    maxTrays: 4,
    trayCapacity: 24,
    traysInstalled: 4,
    fusedSplices: 91, // 94.8% fill -> Overcrowded
    splittersInstalled: '6x 1:8 PLC',
    fiberStandard: 'ITU-T G.652.D Standard SMF',
    fiberStandardKey: 'g652d',
    nominalTrayBendRadiusMm: 22, // Cramped radius -> Micro-bend penalty
    slackStorageMeters: 0.8,
    ipRating: 'IP68 Sealed',
    sealPressurePsi: 12.0,
    installationYear: 2021
  },
  {
    id: 'fosc-sp-03',
    name: 'Saeed Park Feeder Transition Closure',
    primaryArea: 'Saeed Park',
    aliasAreas: ['Saeed Park', 'Rehman Park'],
    closureModel: 'FOSC-400B4 Dome',
    mounting: 'Pole Mount (10m)',
    maxTrays: 4,
    trayCapacity: 12,
    traysInstalled: 3,
    fusedSplices: 31, // 86.1% fill
    splittersInstalled: '2x 1:8 PLC',
    fiberStandard: 'ITU-T G.657.A1 Bend-Insensitive',
    fiberStandardKey: 'g657a1',
    nominalTrayBendRadiusMm: 25,
    slackStorageMeters: 2.0,
    ipRating: 'IP68 Hermetic',
    sealPressurePsi: 15.0,
    installationYear: 2023
  },
  {
    id: 'fosc-st-04',
    name: 'Shahdara Town Junction Distribution Dome',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    closureModel: 'FOSC-400A8 High-Density Dome',
    mounting: 'Pole Mount (11m)',
    maxTrays: 5,
    trayCapacity: 24,
    traysInstalled: 5,
    fusedSplices: 116, // 96.7% fill -> Severe overcrowding & macro-bend
    splittersInstalled: '8x 1:8 PLC',
    fiberStandard: 'ITU-T G.652.D Standard SMF',
    fiberStandardKey: 'g652d',
    nominalTrayBendRadiusMm: 18, // <20mm severe macro-bend
    slackStorageMeters: 0.5,
    ipRating: 'IP68 Pressure Degraded',
    sealPressurePsi: 7.2,
    installationYear: 2020
  },
  {
    id: 'fosc-jm-05',
    name: 'Jia Musa Secondary Branch Closure',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    closureModel: 'FOSC-100 Compact Inline',
    mounting: 'Strand Suspended (7m)',
    maxTrays: 3,
    trayCapacity: 12,
    traysInstalled: 2,
    fusedSplices: 18, // 75.0% fill
    splittersInstalled: '2x 1:8 PLC',
    fiberStandard: 'ITU-T G.657.A1 Bend-Insensitive',
    fiberStandardKey: 'g657a1',
    nominalTrayBendRadiusMm: 32,
    slackStorageMeters: 1.8,
    ipRating: 'IP68 Sealed',
    sealPressurePsi: 14.8,
    installationYear: 2024
  },
  {
    id: 'fosc-wr-06',
    name: 'Wandala Road Industrial Feeder Closure',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    closureModel: 'FOSC-400D5 Heavy Trunk Dome',
    mounting: 'Pole Mount (14m)',
    maxTrays: 6,
    trayCapacity: 24,
    traysInstalled: 4,
    fusedSplices: 74, // 77.1% fill
    splittersInstalled: '4x 1:8 PLC',
    fiberStandard: 'ITU-T G.652.D Standard SMF',
    fiberStandardKey: 'g652d',
    nominalTrayBendRadiusMm: 28,
    slackStorageMeters: 1.6,
    ipRating: 'IP68 Hermetic',
    sealPressurePsi: 14.0,
    installationYear: 2022
  }
];

function escapeXml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

/**
 * Calculates optical micro-bend and macro-bend attenuation based on fiber type,
 * bend radius, and tray overcrowding saturation.
 */
export function calculateBendAttenuation({ fiberStandardKey = 'g652d', bendRadiusMm = 30, trayUtilizationPct = 75 } = {}) {
  const isBendInsensitive = fiberStandardKey === 'g657a1';
  const criticalRadiusMm = isBendInsensitive ? 15 : 30;
  const radius = Math.max(10, Math.min(60, Number(bendRadiusMm) || criticalRadiusMm));

  // Base fusion splice insertion loss: nominal 0.035 dB per splice in good conditions
  const baseSpliceLossDb = 0.035;

  let bendLoss1550Db = 0;
  let bendLoss1310Db = 0;

  if (isBendInsensitive) {
    // G.657.A1 bend insensitive fiber
    if (radius >= 15) {
      bendLoss1550Db = 0.010;
      bendLoss1310Db = 0.003;
    } else {
      const delta = 15 - radius;
      bendLoss1550Db = 0.010 + 0.050 * (Math.exp(0.38 * delta) - 1);
      bendLoss1310Db = 0.003 + 0.012 * (Math.exp(0.38 * delta) - 1);
    }
  } else {
    // G.652.D standard single-mode fiber
    if (radius >= 30) {
      bendLoss1550Db = 0.020;
      bendLoss1310Db = 0.005;
    } else {
      const delta = 30 - radius;
      bendLoss1550Db = 0.020 + 0.075 * (Math.exp(0.32 * delta) - 1);
      bendLoss1310Db = 0.005 + 0.018 * (Math.exp(0.32 * delta) - 1);
    }
  }

  // Tray overcrowding mechanical pinch penalty: when tray utilization exceeds 80%
  let crowdPenaltyDb = 0;
  if (trayUtilizationPct > 80) {
    const excess = trayUtilizationPct - 80;
    crowdPenaltyDb = Math.round((excess * 0.012) * 1000) / 1000;
  }

  const totalLoss1550Db = Math.round((baseSpliceLossDb + bendLoss1550Db + crowdPenaltyDb) * 1000) / 1000;
  const totalLoss1310Db = Math.round((baseSpliceLossDb + bendLoss1310Db + (crowdPenaltyDb * 0.6)) * 1000) / 1000;
  const differentialDeltaDb = Math.round(Math.max(0, totalLoss1550Db - totalLoss1310Db) * 1000) / 1000;

  return {
    radius,
    criticalRadiusMm,
    isBendInsensitive,
    baseSpliceLossDb,
    bendLoss1550Db: Math.round(bendLoss1550Db * 1000) / 1000,
    bendLoss1310Db: Math.round(bendLoss1310Db * 1000) / 1000,
    crowdPenaltyDb,
    totalLoss1550Db,
    totalLoss1310Db,
    differentialDeltaDb
  };
}

/**
 * Calculates complete splice closure metrics, tray capacities, wavelength losses,
 * and correlates customer revenue and outage risks across Shahdara network.
 */
export function calculateSpliceClosureMetrics(state, options = {}) {
  const {
    closureId = null,
    bendRadiusOverride = null,
    addedTrays = 0,
    referenceDate = new Date()
  } = options;

  const closures = SHAHDARA_SPLICE_CLOSURES;
  let targetClosure = closures[0];

  if (closureId) {
    const found = closures.find(c => c.id === closureId);
    if (found) targetClosure = found;
  }

  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const currentMonthStr = typeof referenceDate === 'string'
    ? referenceDate.slice(0, 7)
    : (referenceDate instanceof Date ? referenceDate.toISOString().slice(0, 7) : new Date().toISOString().slice(0, 7));

  // Closure fleet evaluations
  let fleetTotalSplices = 0;
  let fleetTotalCapacity = 0;
  let fleetMaxEnclosureCapacity = 0;
  let fleetCriticalCount = 0;
  let fleetCautionCount = 0;
  let fleetOptimalCount = 0;
  let fleetRevenueAtRisk = 0;

  const evaluatedClosures = closures.map(closure => {
    const isTarget = closure.id === targetClosure.id;
    const effectiveAddedTrays = isTarget ? Math.max(0, Number(addedTrays) || 0) : 0;
    const installedTrays = Math.min(closure.maxTrays, closure.traysInstalled + effectiveAddedTrays);
    const installedCapacity = installedTrays * closure.trayCapacity;
    const maxCapacity = closure.maxTrays * closure.trayCapacity;
    const spareSleeves = Math.max(0, installedCapacity - closure.fusedSplices);
    const trayUtilizationPct = Math.round((closure.fusedSplices / installedCapacity) * 1000) / 10;
    const maxEnclosureUtilizationPct = Math.round((closure.fusedSplices / maxCapacity) * 1000) / 10;
    const freeTraySlots = Math.max(0, closure.maxTrays - installedTrays);

    const radius = (isTarget && bendRadiusOverride !== null && bendRadiusOverride !== undefined)
      ? Number(bendRadiusOverride)
      : closure.nominalTrayBendRadiusMm;

    const optLoss = calculateBendAttenuation({
      fiberStandardKey: closure.fiberStandardKey,
      bendRadiusMm: radius,
      trayUtilizationPct
    });

    // Severity assessment
    let statusTier = 'OPTIMAL';
    let statusLabel = 'Optimal Splicing';
    let badgeClass = 'badge-success';

    if (optLoss.totalLoss1550Db >= 1.2 || trayUtilizationPct >= 92 || radius < (closure.fiberStandardKey === 'g657a1' ? 12 : 20)) {
      statusTier = 'CRITICAL';
      statusLabel = 'Severe Overfill & Bend Loss';
      badgeClass = 'badge-danger';
      fleetCriticalCount++;
    } else if (optLoss.totalLoss1550Db >= 0.55 || trayUtilizationPct >= 80 || radius < (closure.fiberStandardKey === 'g657a1' ? 15 : 28)) {
      statusTier = 'CAUTION';
      statusLabel = 'Moderate Slack Strain';
      badgeClass = 'badge-warning';
      fleetCautionCount++;
    } else {
      fleetOptimalCount++;
    }

    // Customer correlation
    const areaLower = closure.primaryArea.toLowerCase();
    const aliasLowers = closure.aliasAreas.map(a => a.toLowerCase());

    let areaCustomersCount = 0;
    let activeSubscribers = 0;
    let offlineSubscribers = 0;
    let monthlyRevenue = 0;

    for (const cust of customers) {
      if (cust.archived) continue;
      const cArea = String(cust.area || '').trim().toLowerCase();
      const match = cArea === areaLower || aliasLowers.includes(cArea);
      if (match) {
        areaCustomersCount++;
        const sStatus = String(cust.serviceStatus || '').toLowerCase();
        if (sStatus === 'active') activeSubscribers++;
        else if (sStatus === 'offline') offlineSubscribers++;

        const bills = Array.isArray(cust.bills) ? cust.bills : [];
        const curBill = bills.find(b => b.month === currentMonthStr) || bills[bills.length - 1];
        if (curBill && typeof curBill.amount === 'number' && !isNaN(curBill.amount)) {
          monthlyRevenue += curBill.amount;
        }
      }
    }

    let revenueAtRisk = 0;
    if (statusTier === 'CRITICAL') {
      revenueAtRisk = monthlyRevenue;
    } else if (statusTier === 'CAUTION') {
      revenueAtRisk = Math.round(monthlyRevenue * 0.35);
    }
    fleetRevenueAtRisk += revenueAtRisk;

    fleetTotalSplices += closure.fusedSplices;
    fleetTotalCapacity += installedCapacity;
    fleetMaxEnclosureCapacity += maxCapacity;

    return {
      closure,
      installedTrays,
      installedCapacity,
      maxCapacity,
      freeTraySlots,
      spareSleeves,
      trayUtilizationPct,
      maxEnclosureUtilizationPct,
      radius,
      optLoss,
      statusTier,
      statusLabel,
      badgeClass,
      areaCustomersCount,
      activeSubscribers,
      offlineSubscribers,
      monthlyRevenue,
      revenueAtRisk
    };
  });

  const selectedEvaluation = evaluatedClosures.find(e => e.closure.id === targetClosure.id) || evaluatedClosures[0];
  const fleetAvgUtilizationPct = fleetTotalCapacity > 0
    ? Math.round((fleetTotalSplices / fleetTotalCapacity) * 1000) / 10
    : 0;

  return {
    selectedClosure: targetClosure,
    evaluation: selectedEvaluation,
    fleet: {
      closures: evaluatedClosures,
      totalClosures: closures.length,
      totalSplices: fleetTotalSplices,
      totalCapacity: fleetTotalCapacity,
      maxEnclosureCapacity: fleetMaxEnclosureCapacity,
      avgUtilizationPct: fleetAvgUtilizationPct,
      criticalCount: fleetCriticalCount,
      cautionCount: fleetCautionCount,
      optimalCount: fleetOptimalCount,
      revenueAtRisk: fleetRevenueAtRisk
    }
  };
}

/**
 * Generates an accessible, theme-aware pure SVG diagram depicting the splice closure
 * canister, tray stack, sleeve fill slots, fiber slack loop curvature, and wavelength loss.
 */
export function renderSpliceClosureSvg(metrics) {
  if (!metrics || !metrics.evaluation) {
    return `<div class="chart-empty-state">No splice closure metrics available.</div>`;
  }

  const { evaluation, selectedClosure } = metrics;
  const {
    installedTrays,
    installedCapacity,
    trayUtilizationPct,
    spareSleeves,
    radius,
    optLoss,
    statusTier,
    badgeClass
  } = evaluation;

  const width = 560;
  const height = 300;

  // Color scheme based on severity
  const statusColor = statusTier === 'CRITICAL'
    ? '#ef4444'
    : (statusTier === 'CAUTION' ? '#f59e0b' : '#10b981');

  // Wavelength bars configuration
  const maxBarLoss = 2.0; // scale up to 2.0 dB
  const barLoss1310Width = Math.min(180, Math.max(12, Math.round((optLoss.totalLoss1310Db / maxBarLoss) * 180)));
  const barLoss1550Width = Math.min(180, Math.max(12, Math.round((optLoss.totalLoss1550Db / maxBarLoss) * 180)));

  // Splice tray graphics
  const totalTraysToDraw = Math.min(6, Math.max(2, selectedClosure.maxTrays));
  let traysSvg = '';

  for (let i = 0; i < totalTraysToDraw; i++) {
    const isInstalled = i < installedTrays;
    const trayY = 60 + (i * 32);
    const trayIndex = i + 1;

    let trayFillRatio = 0;
    if (isInstalled) {
      const trayCapacity = selectedClosure.trayCapacity;
      const splicesPreceding = i * trayCapacity;
      const remainingSplices = Math.max(0, selectedClosure.fusedSplices - splicesPreceding);
      const thisTraySplices = Math.min(trayCapacity, remainingSplices);
      trayFillRatio = thisTraySplices / trayCapacity;
    }

    const fillBarW = Math.round(trayFillRatio * 150);
    const trayFillColor = trayFillRatio >= 0.9 ? '#ef4444' : (trayFillRatio >= 0.75 ? '#f59e0b' : '#10b981');

    traysSvg += `
      <g class="splice-tray-row" transform="translate(40, ${trayY})">
        <!-- Tray plate container -->
        <rect x="0" y="0" width="220" height="24" rx="4"
          fill="${isInstalled ? 'var(--card-subtle, #f0fdf4)' : 'var(--bg-subtle, #f3f4f6)'}"
          stroke="${isInstalled ? 'var(--line-strong, #bbf7d0)' : 'var(--line, #e5e7eb)'}"
          stroke-width="1.5" stroke-dasharray="${isInstalled ? 'none' : '4,3'}" />
        
        <!-- Tray Label -->
        <text x="8" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="600"
          fill="${isInstalled ? 'var(--ink, #1f2937)' : 'var(--muted, #9ca3af)'}">
          Tray ${trayIndex} ${isInstalled ? `(${Math.round(trayFillRatio * selectedClosure.trayCapacity)}/${selectedClosure.trayCapacity})` : '(Empty Slot)'}
        </text>

        <!-- Tray utilization bar inside tray -->
        ${isInstalled ? `
          <rect x="130" y="6" width="80" height="12" rx="3" fill="var(--bg-card, #ffffff)" stroke="var(--line, #e5e7eb)" stroke-width="1" />
          <rect x="130" y="6" width="${Math.round(trayFillRatio * 80)}" height="12" rx="3" fill="${trayFillColor}" opacity="0.85" />
          <text x="170" y="15" font-family="monospace" font-size="9" font-weight="700" text-anchor="middle" fill="var(--ink, #111827)">
            ${Math.round(trayFillRatio * 100)}%
          </text>
        ` : `
          <text x="170" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="9" text-anchor="middle" fill="var(--muted, #9ca3af)">
            Available
          </text>
        `}
      </g>
    `;
  }

  // Slack loop curve
  // A stylized bezier loop representing buffer tube curvature
  const loopStroke = radius < 25 ? '#ef4444' : (radius < 30 ? '#f59e0b' : '#10b981');
  const loopArcRadius = Math.max(18, Math.min(50, Math.round(radius * 1.2)));

  return `
    <svg class="chart-svg splice-closure-svg" viewBox="0 0 ${width} ${height}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img"
      aria-label="Fiber Optic Splice Closure Tray Capacity and Micro-Bend Loss Diagram">
      <defs>
        <linearGradient id="canisterGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="var(--bg-subtle, #f8fafc)" stop-opacity="0.9" />
          <stop offset="100%" stop-color="var(--card-subtle, #f1f5f9)" stop-opacity="0.6" />
        </linearGradient>
        <filter id="closureShadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.08" />
        </filter>
      </defs>

      <!-- Background Panels -->
      <rect x="10" y="10" width="540" height="280" rx="10" fill="var(--bg-card, #ffffff)" stroke="var(--line, #e2e8f0)" stroke-width="1" />

      <!-- Left Column: Canister & Splice Trays -->
      <g class="canister-group">
        <!-- Canister outer dome shape -->
        <rect x="25" y="24" width="250" height="252" rx="8" fill="url(#canisterGrad)" stroke="var(--line-strong, #cbd5e1)" stroke-width="1.5" />
        
        <!-- Closure Header -->
        <path d="M 25 36 Q 150 20 275 36" fill="none" stroke="var(--line-strong, #94a3b8)" stroke-width="3" />
        <text x="150" y="44" font-family="'Manrope', system-ui, sans-serif" font-size="11" font-weight="700" text-anchor="middle" fill="var(--ink, #0f172a)">
          ${escapeXml(selectedClosure.closureModel)}
        </text>

        <!-- Tray stack rows -->
        ${traysSvg}

        <!-- Canister Footer: Seal Pressure & Slack loop length -->
        <rect x="35" y="248" width="230" height="20" rx="4" fill="var(--bg-card, #ffffff)" stroke="var(--line, #e2e8f0)" />
        <text x="42" y="262" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
          Slack: <tspan font-weight="700" fill="var(--ink, #1e293b)">${selectedClosure.slackStorageMeters}m</tspan> | Seal: <tspan font-weight="700" fill="var(--ink, #1e293b)">${selectedClosure.sealPressurePsi} PSI</tspan>
        </text>
        <circle cx="254" cy="258" r="4" fill="${selectedClosure.sealPressurePsi >= 10 ? '#10b981' : '#ef4444'}" />
      </g>

      <!-- Right Column: Optical Physics, Macro-Bend Gauge & Wavelength Loss -->
      <g class="physics-group" transform="translate(290, 24)">
        <!-- Section Title -->
        <text x="0" y="18" font-family="'Manrope', system-ui, sans-serif" font-size="13" font-weight="800" fill="var(--ink, #0f172a)">
          Optical Bend Loss &amp; Slack Strain
        </text>
        <text x="0" y="32" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
          ${escapeXml(selectedClosure.fiberStandard)}
        </text>

        <!-- Curvature Bend Radius Diagram -->
        <rect x="0" y="42" width="245" height="74" rx="6" fill="var(--bg-subtle, #f8fafc)" stroke="var(--line, #e2e8f0)" />
        <text x="10" y="60" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--ink, #1e293b)">
          Tray Bend Radius: <tspan font-weight="800" fill="${loopStroke}">${radius} mm</tspan>
        </text>
        <text x="10" y="74" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #64748b)">
          Min Recommended: ${optLoss.criticalRadiusMm} mm (ITU-T Std)
        </text>

        <!-- Dynamic bend curve arc -->
        <path d="M 170 102 C 170 ${102 - loopArcRadius}, ${230 - loopArcRadius} 52, 230 52"
          fill="none" stroke="${loopStroke}" stroke-width="4" stroke-linecap="round" />
        <circle cx="230" cy="52" r="3" fill="${loopStroke}" />
        <circle cx="170" cy="102" r="3" fill="${loopStroke}" />
        <text x="10" y="102" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="${loopStroke}">
          ${radius < optLoss.criticalRadiusMm ? `? ${optLoss.criticalRadiusMm - radius}mm below critical limit` : '? Radius Compliant'}
        </text>

        <!-- Wavelength Comparative Loss (1310nm vs 1550nm) -->
        <text x="0" y="136" font-family="'Manrope', system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--ink, #0f172a)">
          Wavelength Loss Signature (? Loss)
        </text>

        <!-- 1310nm bar (O-band upstream) -->
        <text x="0" y="156" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #64748b)">
          1310 nm (Upstream)
        </text>
        <rect x="0" y="162" width="180" height="12" rx="3" fill="var(--line, #e2e8f0)" />
        <rect x="0" y="162" width="${barLoss1310Width}" height="12" rx="3" fill="#3b82f6" />
        <text x="190" y="172" font-family="monospace" font-size="10" font-weight="700" fill="var(--ink, #1e293b)">
          ${optLoss.totalLoss1310Db} dB
        </text>

        <!-- 1550nm bar (C-band video/downstream - high bend sensitivity) -->
        <text x="0" y="192" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #64748b)">
          1550 nm (Downstream / High Bend Drag)
        </text>
        <rect x="0" y="198" width="180" height="12" rx="3" fill="var(--line, #e2e8f0)" />
        <rect x="0" y="198" width="${barLoss1550Width}" height="12" rx="3" fill="${statusColor}" />
        <text x="190" y="208" font-family="monospace" font-size="10" font-weight="700" fill="${statusColor}">
          ${optLoss.totalLoss1550Db} dB
        </text>

        <!-- Differential Delta callout -->
        <rect x="0" y="222" width="245" height="30" rx="4" fill="var(--bg-subtle, #f8fafc)" stroke="var(--line, #e2e8f0)" />
        <text x="8" y="238" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
          &#916; Loss (1550 - 1310): <tspan font-weight="800" fill="${optLoss.differentialDeltaDb > 0.3 ? '#ef4444' : 'var(--ink, #0f172a)'}">+${optLoss.differentialDeltaDb} dB</tspan>
        </text>
        <text x="8" y="248" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #64748b)">
          ${optLoss.differentialDeltaDb > 0.3 ? 'Identifies acute micro/macro bending strain' : 'Normal uniform attenuation profile'}
        </text>
      </g>
    </svg>
  `;
}

/**
 * Generates an executive and operational technical briefing report for fiber technicians.
 */
export function generateSpliceClosureReport(metrics, referenceDate = new Date()) {
  if (!metrics || !metrics.evaluation) {
    return 'No splice closure evaluation data available.';
  }

  const { evaluation, selectedClosure, fleet } = metrics;
  const {
    installedTrays,
    installedCapacity,
    maxCapacity,
    freeTraySlots,
    spareSleeves,
    trayUtilizationPct,
    radius,
    optLoss,
    statusTier,
    statusLabel,
    areaCustomersCount,
    activeSubscribers,
    offlineSubscribers,
    monthlyRevenue,
    revenueAtRisk
  } = evaluation;

  const dateStr = typeof referenceDate === 'string'
    ? referenceDate
    : (referenceDate instanceof Date ? referenceDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

  return [
    `================================================================================`,
    `SHAHDARA FTTH AERIAL SPLICE CLOSURE & MICRO-BEND LOSS AUDIT REPORT`,
    `Generated: ${dateStr} PKT | Standards: ITU-T G.652.D / G.657.A1 / Telcordia GR-771`,
    `================================================================================`,
    ``,
    `1. TARGET CLOSURE & PHYSICAL SPECIFICATION:`,
    `   - Closure ID & Name      : [${selectedClosure.id}] ${selectedClosure.name}`,
    `   - Operational Sector     : ${selectedClosure.primaryArea}`,
    `   - Hardware Model         : ${selectedClosure.closureModel} (${selectedClosure.mounting})`,
    `   - Enclosure Integrity    : ${selectedClosure.ipRating} (${selectedClosure.sealPressurePsi} PSI)`,
    `   - Fiber Cable Standard   : ${selectedClosure.fiberStandard}`,
    `   - Optical Splitters      : ${selectedClosure.splittersInstalled}`,
    `   - Slack Storage Loop     : ${selectedClosure.slackStorageMeters} meters`,
    ``,
    `2. SPLICE TRAY CAPACITY & FILL METRICS:`,
    `   - Installed Splice Trays : ${installedTrays} of ${selectedClosure.maxTrays} Max Trays (${freeTraySlots} expansion slots open)`,
    `   - Total Active Splices   : ${selectedClosure.fusedSplices} fused sleeves`,
    `   - Current Tray Capacity  : ${installedCapacity} sleeves (${spareSleeves} spare sleeve capacity)`,
    `   - Tray Fill Utilization  : ${trayUtilizationPct}% (${trayUtilizationPct >= 90 ? 'OVERCROWDED' : (trayUtilizationPct >= 75 ? 'CAUTION' : 'OPTIMAL')})`,
    `   - Max Enclosure Ceiling  : ${maxCapacity} splices total`,
    ``,
    `3. OPTICAL MICRO-BEND & MACRO-BEND ATTENUATION (dB):`,
    `   - Effective Tray Radius  : ${radius} mm (Critical Limit: ${optLoss.criticalRadiusMm} mm)`,
    `   - Radius Compliance      : ${radius < optLoss.criticalRadiusMm ? `NON-COMPLIANT (${optLoss.criticalRadiusMm - radius}mm below threshold)` : 'COMPLIANT'}`,
    `   - Base Splice Loss       : ${optLoss.baseSpliceLossDb} dB/splice`,
    `   - 1310 nm Upstream Loss  : ${optLoss.totalLoss1310Db} dB`,
    `   - 1550 nm Downstream Loss: ${optLoss.totalLoss1550Db} dB`,
    `   - Macro-Bend Loss Delta  : +${optLoss.differentialDeltaDb} dB (1550nm vs 1310nm)`,
    `   - Overcrowd Mechanical   : +${optLoss.crowdPenaltyDb} dB strain penalty`,
    `   - Closure Health Tier    : ${statusTier} - ${statusLabel}`,
    ``,
    `4. CUSTOMER ROSTER & REVENUE EXPOSURE:`,
    `   - Area Customers Served  : ${areaCustomersCount} subscribers (${activeSubscribers} Active, ${offlineSubscribers} Offline)`,
    `   - Area Monthly Billing   : ${formatPKR(monthlyRevenue)}`,
    `   - Revenue Exposure Risk  : ${formatPKR(revenueAtRisk)}`,
    ``,
    `5. SHAHDARA CLOSURE FLEET OVERVIEW:`,
    `   - Total Monitored FOSCs  : ${fleet.totalClosures} closures`,
    `   - Total Field Splices    : ${fleet.totalSplices} fused fibers across ${fleet.totalCapacity} installed capacity`,
    `   - Fleet Avg Fill Factor  : ${fleet.avgUtilizationPct}%`,
    `   - Health Tier Breakdown  : ${fleet.optimalCount} Optimal, ${fleet.cautionCount} Caution, ${fleet.criticalCount} Critical`,
    `   - Fleet Total At-Risk Rev: ${formatPKR(fleet.revenueAtRisk)}`,
    ``,
    `6. RECOMMENDED FIELD REMEDIATION ACTIONS:`,
    ...(trayUtilizationPct >= 90
      ? [`   [CRITICAL] Dispatch splicing crew to mount additional splice tray (+1 tray adds ${selectedClosure.trayCapacity} slots).`]
      : []),
    ...(radius < optLoss.criticalRadiusMm
      ? [`   [CRITICAL] Re-route buffer tube slack loops inside tray raceways to restore min ${optLoss.criticalRadiusMm}mm bend radius.`]
      : []),
    ...(selectedClosure.sealPressurePsi < 10
      ? [`   [WARNING] Reseal dome base with silicone gasket kit and recharge valve to 14.5 PSI to prevent monsoon water ingress.`]
      : []),
    ...(trayUtilizationPct < 85 && radius >= optLoss.criticalRadiusMm
      ? [`   [STABLE] Closure within operational tolerances. Schedule routine 6-month visual inspection.`]
      : []),
    `================================================================================`
  ].join('\n');
}

// Module State Holders for Interactive UI
let selectedClosureId = 'fosc-mb-02'; // default to high-density commercial closure
let simulatedBendRadiusMm = null;
let simulatedAddedTrays = 0;

export function getSpliceSelectedClosure() {
  return selectedClosureId;
}

export function setSpliceSelectedClosure(id) {
  if (id && SHAHDARA_SPLICE_CLOSURES.some(c => c.id === id)) {
    selectedClosureId = id;
    simulatedBendRadiusMm = null; // reset to closure default
    simulatedAddedTrays = 0;
  }
}

export function getSpliceBendRadius() {
  return simulatedBendRadiusMm;
}

export function setSpliceBendRadius(radius) {
  simulatedBendRadiusMm = radius !== null && radius !== undefined ? Number(radius) : null;
}

export function getSpliceAddedTrays() {
  return simulatedAddedTrays;
}

export function setSpliceAddedTrays(count) {
  simulatedAddedTrays = Math.max(0, Math.min(3, Number(count) || 0));
}

/**
 * Initializes and wires event listeners for the Splice Closure & Micro-Bend Modal.
 */
export function setupSpliceClosureModal(state, options = {}) {
  const {
    referenceDate = new Date(),
    onFilterArea = null,
    onFilterCustomer = null,
    onToast = null,
    clipboard = null
  } = options;

  if (typeof document === 'undefined') return;

  const modal = document.getElementById('dashboardSpliceModal');
  const openBtn = document.getElementById('dashboardOpenSpliceModalBtn');
  const closeBtn = document.getElementById('dashboardSpliceModalCloseBtn');
  const closureSelect = document.getElementById('spliceClosureSelect');
  const bendSlider = document.getElementById('spliceBendSlider');
  const bendVal = document.getElementById('spliceBendVal');
  const addTrayBtn = document.getElementById('spliceAddTrayBtn');
  const resetBtn = document.getElementById('spliceResetSimBtn');
  const copyBtn = document.getElementById('dashboardCopySpliceReportBtn');
  const filterAreaBtn = document.getElementById('spliceFilterAreaBtn');

  // KPI elements
  const kpiClosureName = document.getElementById('spliceKpiClosureName');
  const kpiTrayCapacity = document.getElementById('spliceKpiTrayCapacity');
  const kpiOpticalLoss = document.getElementById('spliceKpiOpticalLoss');
  const kpiStatusBadge = document.getElementById('spliceStatusBadge');
  const kpiRevenueRisk = document.getElementById('spliceKpiRevenueRisk');
  const chartWrap = document.getElementById('spliceModalChartWrap');
  const tableBody = document.getElementById('spliceClosuresTableBody');

  function refreshModalContent() {
    const data = calculateSpliceClosureMetrics(state, {
      closureId: selectedClosureId,
      bendRadiusOverride: simulatedBendRadiusMm,
      addedTrays: simulatedAddedTrays,
      referenceDate
    });

    const { evaluation, selectedClosure, fleet } = data;
    const {
      installedTrays,
      installedCapacity,
      trayUtilizationPct,
      spareSleeves,
      radius,
      optLoss,
      statusTier,
      statusLabel,
      badgeClass,
      revenueAtRisk
    } = evaluation;

    if (kpiClosureName) {
      kpiClosureName.textContent = `${selectedClosure.name} (${selectedClosure.primaryArea})`;
    }
    if (kpiTrayCapacity) {
      kpiTrayCapacity.textContent = `${selectedClosure.fusedSplices} / ${installedCapacity} (${trayUtilizationPct}%)`;
    }
    if (kpiOpticalLoss) {
      kpiOpticalLoss.textContent = `${optLoss.totalLoss1550Db} dB (${radius}mm)`;
    }
    if (kpiStatusBadge) {
      kpiStatusBadge.textContent = statusTier;
      kpiStatusBadge.className = `sim-delta-badge ${badgeClass}`;
    }
    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(revenueAtRisk)} at risk`;
    }

    if (chartWrap) {
      chartWrap.innerHTML = renderSpliceClosureSvg(data);
    }

    // Populate closure fleet table
    if (tableBody) {
      tableBody.innerHTML = fleet.closures.map(item => {
        const c = item.closure;
        const isCurrent = c.id === selectedClosure.id;
        return `
          <tr class="${isCurrent ? 'selected-row' : ''}" style="${isCurrent ? 'background: var(--bg-subtle, #f0fdf4); font-weight: 600;' : ''}">
            <td>
              <button type="button" class="table-link-btn" data-closure-id="${c.id}" style="border:none; background:none; color:var(--primary, #059669); cursor:pointer; text-decoration:underline; font-weight:600; text-align:left; padding:0;">
                ${escapeXml(c.name)}
              </button>
            </td>
            <td>${escapeXml(c.primaryArea)}</td>
            <td>${c.fusedSplices} / ${item.installedCapacity} (${item.trayUtilizationPct}%)</td>
            <td>${item.radius} mm</td>
            <td>${item.optLoss.totalLoss1550Db} dB <span style="font-size:10px; color:var(--muted, #64748b);">(+${item.optLoss.differentialDeltaDb})</span></td>
            <td>
              <span class="sim-delta-badge ${item.badgeClass}" style="padding: 2px 6px; font-size: 10px;">
                ${item.statusTier}
              </span>
            </td>
          </tr>
        `;
      }).join('');

      // Wire row click buttons
      tableBody.querySelectorAll('[data-closure-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const cid = btn.getAttribute('data-closure-id');
          setSpliceSelectedClosure(cid);
          if (closureSelect) closureSelect.value = cid;
          const newEval = calculateSpliceClosureMetrics(state, { closureId: cid, referenceDate }).evaluation;
          if (bendSlider) bendSlider.value = newEval.radius;
          if (bendVal) bendVal.textContent = `${newEval.radius} mm`;
          refreshModalContent();
        });
      });
    }
  }

  // Populate Closure Select options
  if (closureSelect && closureSelect.children.length === 0) {
    SHAHDARA_SPLICE_CLOSURES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.primaryArea})`;
      if (c.id === selectedClosureId) opt.selected = true;
      closureSelect.appendChild(opt);
    });
  }

  // Open Modal Event
  if (openBtn && !openBtn.dataset.wired) {
    openBtn.dataset.wired = 'true';
    openBtn.addEventListener('click', () => {
      if (closureSelect) closureSelect.value = selectedClosureId;
      const initialEval = calculateSpliceClosureMetrics(state, {
        closureId: selectedClosureId,
        referenceDate
      }).evaluation;
      if (bendSlider) bendSlider.value = initialEval.radius;
      if (bendVal) bendVal.textContent = `${initialEval.radius} mm`;
      refreshModalContent();
      if (typeof modal.showModal === 'function') {
        try { modal.showModal(); } catch { modal.setAttribute('open', ''); }
      } else {
        modal.setAttribute('open', '');
      }
    });
  }

  // Close Modal Event
  if (closeBtn && !closeBtn.dataset.wired) {
    closeBtn.dataset.wired = 'true';
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') {
        try { modal.close(); } catch { modal.removeAttribute('open'); }
      } else {
        modal.removeAttribute('open');
      }
    });
  }

  if (modal && !modal.dataset.backdropWired) {
    modal.dataset.backdropWired = 'true';
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (typeof modal.close === 'function') {
          try { modal.close(); } catch { modal.removeAttribute('open'); }
        } else {
          modal.removeAttribute('open');
        }
      }
    });
  }

  // Selector Change
  if (closureSelect && !closureSelect.dataset.wired) {
    closureSelect.dataset.wired = 'true';
    closureSelect.addEventListener('change', () => {
      setSpliceSelectedClosure(closureSelect.value);
      const newEval = calculateSpliceClosureMetrics(state, { closureId: closureSelect.value, referenceDate }).evaluation;
      if (bendSlider) bendSlider.value = newEval.radius;
      if (bendVal) bendVal.textContent = `${newEval.radius} mm`;
      refreshModalContent();
    });
  }

  // Bend Slider Input
  if (bendSlider && !bendSlider.dataset.wired) {
    bendSlider.dataset.wired = 'true';
    bendSlider.addEventListener('input', () => {
      setSpliceBendRadius(bendSlider.value);
      if (bendVal) bendVal.textContent = `${bendSlider.value} mm`;
      refreshModalContent();
    });
  }

  // Add Tray Simulation Button
  if (addTrayBtn && !addTrayBtn.dataset.wired) {
    addTrayBtn.dataset.wired = 'true';
    addTrayBtn.addEventListener('click', () => {
      const cur = getSpliceAddedTrays();
      const next = (cur + 1) % 4; // cycle 0, 1, 2, 3
      setSpliceAddedTrays(next);
      addTrayBtn.textContent = next > 0 ? `+${next} Trays Added` : '+ Add Expansion Tray';
      refreshModalContent();
    });
  }

  // Reset Simulation Button
  if (resetBtn && !resetBtn.dataset.wired) {
    resetBtn.dataset.wired = 'true';
    resetBtn.addEventListener('click', () => {
      setSpliceBendRadius(null);
      setSpliceAddedTrays(0);
      const resetEval = calculateSpliceClosureMetrics(state, { closureId: selectedClosureId, referenceDate }).evaluation;
      if (bendSlider) bendSlider.value = resetEval.radius;
      if (bendVal) bendVal.textContent = `${resetEval.radius} mm`;
      if (addTrayBtn) addTrayBtn.textContent = '+ Add Expansion Tray';
      refreshModalContent();
    });
  }

  // Filter Area Button
  if (filterAreaBtn && !filterAreaBtn.dataset.wired) {
    filterAreaBtn.dataset.wired = 'true';
    filterAreaBtn.addEventListener('click', () => {
      const data = calculateSpliceClosureMetrics(state, { closureId: selectedClosureId, referenceDate });
      if (typeof onFilterArea === 'function') {
        onFilterArea(data.selectedClosure.primaryArea);
        if (typeof modal.close === 'function') {
          try { modal.close(); } catch { modal.removeAttribute('open'); }
        } else {
          modal.removeAttribute('open');
        }
      }
    });
  }

  // Copy Briefing Report Button
  if (copyBtn && !copyBtn.dataset.wired) {
    copyBtn.dataset.wired = 'true';
    copyBtn.addEventListener('click', async () => {
      const data = calculateSpliceClosureMetrics(state, {
        closureId: selectedClosureId,
        bendRadiusOverride: simulatedBendRadiusMm,
        addedTrays: simulatedAddedTrays,
        referenceDate
      });
      const text = generateSpliceClosureReport(data, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Splice closure audit report copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy audit report.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard API not available.');
      }
    });
  }
}
