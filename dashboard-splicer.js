import { formatPKR } from './core.js';

/**
 * Optical Fiber Fusion Splicer Arc Discharge Electrode Wear & Cleave End-Face Angle Failure Risk Estimator
 * Models tungsten arc electrode tip erosion, oxidation layer thermal resistivity, high-frequency arc plasma
 * discharge stability, and diamond cleaver blade dulling dynamics across Shahdara field maintenance kits.
 * Simulates splice insertion loss (dB), mechanical tensile proof-test strength (N), cleave end-face angle
 * deviation (θ degrees), and maintenance spares runway for field technician teams.
 */

export const SHAHDARA_SPLICER_UNITS = [
  {
    id: 'spl-st-01',
    name: 'Shahdara Town Central Kit #1 (Fujikura 88S+)',
    assignedTech: 'Usman Ghani & Bilal Team',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    maxRatedArcs: 4000,
    currentArcCount: 1850,
    baseCleaveAngleDeg: 0.45,
    cleaverModel: 'CT50 Diamond Blade (16-Pos)',
    cleaverBladePosition: 4,
    calibrationCurrentMa: 15.2,
    batteryHealthPct: 92
  },
  {
    id: 'spl-br-02',
    name: 'Baradari Road Field Unit #2 (Sumitomo Z2C)',
    assignedTech: 'Hamza Tariq & Naveed',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    maxRatedArcs: 3500,
    currentArcCount: 2950,
    baseCleaveAngleDeg: 0.85,
    cleaverModel: 'FC-6S Rotary Cleaver',
    cleaverBladePosition: 14,
    calibrationCurrentMa: 16.0,
    batteryHealthPct: 78
  },
  {
    id: 'spl-vr-03',
    name: 'Vandala Industrial Trunk #3 (Inno View 7)',
    assignedTech: 'Imran Sadiq Team',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    maxRatedArcs: 4500,
    currentArcCount: 1200,
    baseCleaveAngleDeg: 0.35,
    cleaverModel: 'V7 High Precision Diamond',
    cleaverBladePosition: 3,
    calibrationCurrentMa: 14.8,
    batteryHealthPct: 95
  },
  {
    id: 'spl-jm-04',
    name: 'Jia Musa Rapid Response Unit #4 (DVP-740)',
    assignedTech: 'Kashif Ali & Asad',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    maxRatedArcs: 3000,
    currentArcCount: 2850,
    baseCleaveAngleDeg: 1.25,
    cleaverModel: 'DVP-105 Cleaver',
    cleaverBladePosition: 12,
    calibrationCurrentMa: 17.5,
    batteryHealthPct: 65
  },
  {
    id: 'spl-sp-05',
    name: 'Saeed Park Highway Spur #5 (Fujikura 70S)',
    assignedTech: 'Zubair Ahmad Team',
    primaryArea: 'Saeed Park',
    aliasAreas: ['Saeed Park', 'Rehman Park'],
    maxRatedArcs: 4000,
    currentArcCount: 2100,
    baseCleaveAngleDeg: 0.60,
    cleaverModel: 'CT30 Rotary Cleaver',
    cleaverBladePosition: 8,
    calibrationCurrentMa: 15.4,
    batteryHealthPct: 84
  },
  {
    id: 'spl-ot-06',
    name: 'Main Bazaar Commercial Kit #6 (Skycom T-208H)',
    assignedTech: 'Faisal Abbasi & Team',
    primaryArea: 'Main Bazaar',
    aliasAreas: ['Main Bazaar', 'Commercial Market'],
    maxRatedArcs: 3000,
    currentArcCount: 2200,
    baseCleaveAngleDeg: 0.70,
    cleaverModel: 'Skycom High Precision',
    cleaverBladePosition: 9,
    calibrationCurrentMa: 15.8,
    batteryHealthPct: 80
  }
];

let selectedSplicerId = 'spl-st-01';
let simulatedArcCount = null; // number | null
let simulatedCleaveAngle = null; // number (0.1 - 3.5) | null
let simulatedCalibCurrent = null; // number (13.0 - 19.0) | null

export function getSplicerSelectedUnit() {
  return selectedSplicerId;
}

export function setSplicerSelectedUnit(unitId) {
  if (SHAHDARA_SPLICER_UNITS.some((u) => u.id === unitId)) {
    selectedSplicerId = unitId;
  }
}

export function getSplicerArcCount() {
  return simulatedArcCount;
}

export function setSplicerArcCount(val) {
  if (val === null || val === undefined || val === '') {
    simulatedArcCount = null;
    return;
  }
  const parsed = Number(val);
  if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 6000) {
    simulatedArcCount = Math.round(parsed);
  } else {
    simulatedArcCount = null;
  }
}

export function getSplicerCleaveAngle() {
  return simulatedCleaveAngle;
}

export function setSplicerCleaveAngle(val) {
  if (val === null || val === undefined || val === '') {
    simulatedCleaveAngle = null;
    return;
  }
  const parsed = Number(val);
  if (!Number.isNaN(parsed) && parsed >= 0.1 && parsed <= 3.5) {
    simulatedCleaveAngle = Math.round(parsed * 100) / 100;
  } else {
    simulatedCleaveAngle = null;
  }
}

export function getSplicerCalibCurrent() {
  return simulatedCalibCurrent;
}

export function setSplicerCalibCurrent(val) {
  if (val === null || val === undefined || val === '') {
    simulatedCalibCurrent = null;
    return;
  }
  const parsed = Number(val);
  if (!Number.isNaN(parsed) && parsed >= 13.0 && parsed <= 19.0) {
    simulatedCalibCurrent = Math.round(parsed * 10) / 10;
  } else {
    simulatedCalibCurrent = null;
  }
}

/**
 * Calculates electrode degradation wear index, plasma discharge instability,
 * estimated insertion loss, and tensile proof strength.
 */
export function calculateElectrodeDynamics(splicerUnit, {
  arcCount,
  cleaveAngleDeg,
  calibCurrentMa,
  activeSubscribers = 0,
  totalBilledRevenue = 0
} = {}) {
  const unit = splicerUnit || SHAHDARA_SPLICER_UNITS[0];
  const effectiveArcs = arcCount !== null && arcCount !== undefined
    ? Number(arcCount)
    : unit.currentArcCount;
  const effectiveAngle = cleaveAngleDeg !== null && cleaveAngleDeg !== undefined
    ? Number(cleaveAngleDeg)
    : unit.baseCleaveAngleDeg;
  const effectiveCurrent = calibCurrentMa !== null && calibCurrentMa !== undefined
    ? Number(calibCurrentMa)
    : unit.calibrationCurrentMa;

  // Electrode wear percentage
  const wearPct = Math.min(100, Math.round((effectiveArcs / unit.maxRatedArcs) * 100));
  const remainingArcs = Math.max(0, unit.maxRatedArcs - effectiveArcs);

  // Plasma arc stability score (100% is pristine, falls as tips oxidize and round)
  const arcStabilityPct = Math.max(20, Math.round(100 - (wearPct * 0.72)));

  // Optical insertion loss modeling:
  // Base singlemode core alignment loss: 0.015 dB
  // Wear penalty: up to ~0.045 dB
  // Cleave angle mismatch penalty: non-linear above 0.5 degrees
  const baseLoss = 0.015;
  const wearPenalty = 0.045 * (wearPct / 100);
  const excessAngle = Math.max(0, effectiveAngle - 0.5);
  const anglePenalty = 0.075 * Math.pow(excessAngle, 1.55);

  // Current calibration offset penalty
  let currentPenalty = 0;
  if (effectiveCurrent > 16.5 || effectiveCurrent < 14.2) {
    currentPenalty = Math.abs(effectiveCurrent - 15.0) * 0.008;
  }

  const estimatedLossDb = Math.round((baseLoss + wearPenalty + anglePenalty + currentPenalty) * 1000) / 1000;

  // Mechanical tensile proof strength (standard 1.96N proof test):
  const tensileProofN = Math.round(Math.max(0.75, 2.25 - (wearPct / 100) * 0.85 - excessAngle * 0.28) * 100) / 100;

  // Cleave end-face quality rating
  let cleaveRating = 'Excellent (< 0.5°)';
  if (effectiveAngle > 1.8) cleaveRating = 'Reject / Re-cleave (> 1.8°)';
  else if (effectiveAngle > 1.0) cleaveRating = 'Sub-optimal (> 1.0°)';
  else if (effectiveAngle > 0.5) cleaveRating = 'Acceptable (0.5° - 1.0°)';

  // Status and failure risk classification
  let status = 'OPTIMAL';
  let statusLabel = 'High Quality Splice';
  let badgeClass = 'badge-success';
  let riskFactor = 0;

  if (wearPct >= 85 || effectiveAngle >= 1.6 || estimatedLossDb >= 0.10) {
    status = 'CRITICAL';
    statusLabel = 'Electrode Replace / Re-cleave Due';
    badgeClass = 'badge-danger';
    riskFactor = 1.0;
  } else if (wearPct >= 68 || effectiveAngle >= 0.9 || estimatedLossDb >= 0.05) {
    status = 'ELEVATED';
    statusLabel = 'Wear Advisory & Calibration Due';
    badgeClass = 'badge-warning';
    riskFactor = 0.35;
  }

  const atRiskRevenue = Math.round(totalBilledRevenue * riskFactor);

  return {
    unit,
    effectiveArcs,
    effectiveAngle,
    effectiveCurrent,
    wearPct,
    remainingArcs,
    arcStabilityPct,
    estimatedLossDb,
    tensileProofN,
    cleaveRating,
    status,
    statusLabel,
    badgeClass,
    atRiskRevenue
  };
}

/**
 * Normalizes text string for fuzzy / case-insensitive area matching.
 */
function normalizeText(txt) {
  return String(txt || '').trim().toLowerCase();
}

/**
 * Calculates comprehensive fusion splicer diagnostics across all Shahdara kits.
 */
export function calculateFusionSplicerMetrics(state, options = {}) {
  const {
    unitId = selectedSplicerId,
    arcCountOverride = simulatedArcCount,
    cleaveAngleOverride = simulatedCleaveAngle,
    calibCurrentOverride = simulatedCalibCurrent,
    referenceDate = '2026-10-16'
  } = options;

  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const bills = Array.isArray(state?.bills) ? state.bills : [];

  const unitEvaluations = SHAHDARA_SPLICER_UNITS.map((unit) => {
    const areaAliases = unit.aliasAreas.map(normalizeText);

    // Find linked subscribers
    const matchedCustomers = customers.filter((c) => {
      const cArea = normalizeText(c.area || c.mohalla || '');
      return areaAliases.some((alias) => cArea.includes(alias) || alias.includes(cArea));
    });

    const activeSubscribers = matchedCustomers.filter((c) => c.status !== 'archived' && c.status !== 'Offline');
    const subscriberCount = matchedCustomers.length;
    const activeCount = activeSubscribers.length;

    // Monthly revenue snapshot
    const refMonth = referenceDate.slice(0, 7);
    let corridorBilled = 0;
    matchedCustomers.forEach((c) => {
      const b = bills.find((bill) => bill.customerId === c.id && bill.month === refMonth);
      if (b && typeof b.amount === 'number') {
        corridorBilled += b.amount;
      } else {
        corridorBilled += (c.planRate || 2200);
      }
    });

    const isSelected = unit.id === unitId;
    const arcs = isSelected && arcCountOverride !== null && arcCountOverride !== undefined
      ? arcCountOverride
      : unit.currentArcCount;
    const angle = isSelected && cleaveAngleOverride !== null && cleaveAngleOverride !== undefined
      ? cleaveAngleOverride
      : unit.baseCleaveAngleDeg;
    const current = isSelected && calibCurrentOverride !== null && calibCurrentOverride !== undefined
      ? calibCurrentOverride
      : unit.calibrationCurrentMa;

    const dynamics = calculateElectrodeDynamics(unit, {
      arcCount: arcs,
      cleaveAngleDeg: angle,
      calibCurrentMa: current,
      activeSubscribers: activeCount > 0 ? activeCount : 30,
      totalBilledRevenue: corridorBilled
    });

    return {
      unit,
      isSelected,
      matchedCustomerCount: subscriberCount,
      activeCustomerCount: activeCount,
      billedRevenue: corridorBilled,
      dynamics
    };
  });

  const selectedEvaluation = unitEvaluations.find((e) => e.unit.id === unitId) || unitEvaluations[0];

  let totalKits = SHAHDARA_SPLICER_UNITS.length;
  let totalBilledRevenue = 0;
  let totalAtRiskRevenue = 0;
  let criticalKitsCount = 0;
  let elevatedKitsCount = 0;
  let optimalKitsCount = 0;

  unitEvaluations.forEach((ue) => {
    totalBilledRevenue += ue.billedRevenue;
    totalAtRiskRevenue += ue.dynamics.atRiskRevenue;

    if (ue.dynamics.status === 'CRITICAL') criticalKitsCount++;
    else if (ue.dynamics.status === 'ELEVATED') elevatedKitsCount++;
    else optimalKitsCount++;
  });

  return {
    selectedUnit: selectedEvaluation.unit,
    selectedDynamics: selectedEvaluation.dynamics,
    selectedEvaluation,
    unitEvaluations,
    summary: {
      totalKits,
      totalBilledRevenue,
      totalAtRiskRevenue,
      criticalKitsCount,
      elevatedKitsCount,
      optimalKitsCount
    }
  };
}

/**
 * Pure SVG Renderer for Splicer Core Alignment & Electrode Wear Loss Curve.
 */
export function renderFusionSplicerSvg(data, options = {}) {
  if (!data || !data.selectedDynamics) {
    return `<div class="chart-empty-state"><p>No fusion splicer telemetry recorded for this kit.</p></div>`;
  }

  const { selectedDynamics, selectedUnit } = data;
  const d = selectedDynamics;
  const isCompact = options.compact === true;

  const width = isCompact ? 360 : 780;
  const height = isCompact ? 220 : 360;

  const statusColor = d.status === 'CRITICAL' ? '#ef4444' : d.status === 'ELEVATED' ? '#f59e0b' : '#10b981';
  const statusBg = d.status === 'CRITICAL' ? 'rgba(239, 68, 68, 0.15)' : d.status === 'ELEVATED' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)';

  if (isCompact) {
    // Compact preview card version for main dashboard view
    const arcPercent = Math.min(100, d.wearPct);
    const gaugeStrokeDash = Math.round((arcPercent / 100) * 283);

    return `
      <svg class="chart-svg splicer-svg compact-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fusion Splicer Electrode Wear Gauge">
        <rect width="${width}" height="${height}" rx="8" fill="var(--surface, #ffffff)" />

        <!-- Header -->
        <text x="16" y="26" font-size="13" font-weight="700" fill="var(--ink, #182e2a)">${selectedUnit.name.split('(')[0].trim()}</text>
        <rect x="${width - 110}" y="12" width="94" height="20" rx="4" fill="${statusBg}" />
        <text x="${width - 63}" y="26" font-size="10" font-weight="700" fill="${statusColor}" text-anchor="middle">${d.status}</text>

        <!-- Semicircular Arc Gauge -->
        <g transform="translate(180, 115)">
          <path d="M -90 0 A 90 90 0 0 1 90 0" fill="none" stroke="var(--border, #e2e8f0)" stroke-width="14" stroke-linecap="round" />
          <path d="M -90 0 A 90 90 0 0 1 90 0" fill="none" stroke="${statusColor}" stroke-width="14" stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="${Math.max(0, 283 - gaugeStrokeDash)}" />
          
          <text x="0" y="-12" font-size="24" font-weight="800" fill="var(--ink, #182e2a)" text-anchor="middle">${d.estimatedLossDb} dB</text>
          <text x="0" y="8" font-size="10" fill="var(--muted, #64748b)" text-anchor="middle">Splice Loss (${d.effectiveAngle}° cleave)</text>
          <text x="0" y="24" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">${d.effectiveArcs} / ${selectedUnit.maxRatedArcs} Arcs (${d.wearPct}% wear)</text>
        </g>

        <!-- Mini Stats -->
        <g transform="translate(16, 175)">
          <rect x="0" y="0" width="102" height="34" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
          <text x="51" y="14" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">Arc Stability</text>
          <text x="51" y="28" font-size="11" font-weight="700" fill="var(--ink, #182e2a)" text-anchor="middle">${d.arcStabilityPct}%</text>

          <rect x="112" y="0" width="102" height="34" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
          <text x="163" y="14" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">Tensile Proof</text>
          <text x="163" y="28" font-size="11" font-weight="700" fill="var(--ink, #182e2a)" text-anchor="middle">${d.tensileProofN} N</text>

          <rect x="224" y="0" width="104" height="34" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
          <text x="276" y="14" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">Remaining Arcs</text>
          <text x="276" y="28" font-size="11" font-weight="700" fill="${d.remainingArcs < 500 ? '#ef4444' : '#10b981'}" text-anchor="middle">${d.remainingArcs}</text>
        </g>
      </svg>
    `;
  }

  // Full High-Detail Modal SVG with Fiber Core Alignment & Arc Plasma Glow + Degradation Curve
  return `
    <svg class="chart-svg splicer-svg full-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fusion Splicer Core Alignment & Arc Degradation Diagram">
      <defs>
        <radialGradient id="arcPlasmaGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.9" />
          <stop offset="40%" stop-color="#60a5fa" stop-opacity="0.6" />
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0" />
        </radialGradient>
      </defs>

      <rect width="${width}" height="${height}" rx="10" fill="var(--surface, #ffffff)" stroke="var(--border, #e2e8f0)" />

      <!-- Title & Header Bar -->
      <text x="24" y="32" font-size="15" font-weight="800" fill="var(--ink, #182e2a)">${selectedUnit.name} - Arc Plasma Telemetry</text>
      <text x="24" y="49" font-size="11" fill="var(--muted, #64748b)">Tech: ${selectedUnit.assignedTech} | Cleaver: ${selectedUnit.cleaverModel} | Battery: ${selectedUnit.batteryHealthPct}%</text>
      
      <rect x="${width - 130}" y="18" width="106" height="24" rx="5" fill="${statusBg}" />
      <text x="${width - 77}" y="34" font-size="11" font-weight="800" fill="${statusColor}" text-anchor="middle">${d.status}</text>

      <!-- SECTION 1: Fiber Core V-Groove Alignment View (Y: 65 to 155) -->
      <g transform="translate(24, 65)">
        <text x="0" y="14" font-size="12" font-weight="700" fill="var(--ink, #182e2a)">Dual-Camera Optical Alignment &amp; Arc Discharge Chamber</text>

        <!-- Splicer chamber frame -->
        <rect x="0" y="24" width="732" height="66" rx="6" fill="var(--bg-soft, #0f172a)" />

        <!-- Top & Bottom Electrodes (Tungsten) -->
        <polygon points="356,26 376,26 366,42" fill="#94a3b8" />
        <polygon points="356,88 376,88 366,72" fill="#94a3b8" />

        <!-- Arc Plasma Glow -->
        <circle cx="366" cy="57" r="26" fill="url(#arcPlasmaGlow)" />

        <!-- Left Fiber Cladding (125µm) & Core (9µm) -->
        <rect x="30" y="49" width="330" height="16" fill="#cbd5e1" opacity="0.85" rx="2" />
        <rect x="30" y="55" width="330" height="4" fill="#38bdf8" />

        <!-- Right Fiber Cladding & Core with Cleave Angle Cut -->
        ${(() => {
          const cutOffset = (d.effectiveAngle / 3.0) * 8;
          return `
            <polygon points="372,49 690,49 690,65 ${372 + cutOffset},65" fill="#cbd5e1" opacity="0.85" />
            <polygon points="372,55 690,55 690,59 ${372 + cutOffset * 0.5},59" fill="#38bdf8" />
          `;
        })()}

        <!-- Fiber Alignment labels -->
        <text x="50" y="44" font-size="9" fill="#94a3b8">Left SMF-28 Fiber</text>
        <text x="670" y="44" font-size="9" fill="#94a3b8" text-anchor="end">Right Field Drop Fiber</text>
        <text x="366" y="20" font-size="9" font-weight="700" fill="#38bdf8" text-anchor="middle">Arc Gap (${d.effectiveCurrent} mA)</text>
      </g>

      <!-- SECTION 2: Splice Loss vs Electrode Arc Wear Curve (Y: 175 to 305) -->
      <g transform="translate(24, 175)">
        <text x="0" y="14" font-size="12" font-weight="700" fill="var(--ink, #182e2a)">Insertion Loss Horizon vs Arc Count &amp; Cleave Degradation</text>

        <!-- Chart Grid Lines -->
        <line x1="40" y1="26" x2="732" y2="26" stroke="var(--border, #e2e8f0)" stroke-dasharray="3,3" />
        <line x1="40" y1="56" x2="732" y2="56" stroke="var(--border, #e2e8f0)" stroke-dasharray="3,3" />
        <line x1="40" y1="86" x2="732" y2="86" stroke="var(--border, #e2e8f0)" stroke-dasharray="3,3" />
        <line x1="40" y1="110" x2="732" y2="110" stroke="var(--border, #cbd5e1)" />

        <!-- Y-Axis labels (Loss dB) -->
        <text x="32" y="29" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">0.15dB</text>
        <text x="32" y="59" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">0.10dB</text>
        <text x="32" y="89" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">0.05dB</text>
        <text x="32" y="113" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">0.00dB</text>

        <!-- Critical Loss Threshold (0.10 dB) -->
        <line x1="40" y1="56" x2="732" y2="56" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="5,4" />
        <text x="732" y="52" font-size="9" font-weight="700" fill="#ef4444" text-anchor="end">ITU-T Max Splice Loss Cap (0.10 dB)</text>

        <!-- Curve points -->
        ${(() => {
          const points = [];
          const numSteps = 16;
          for (let i = 0; i <= numSteps; i++) {
            const t = i / numSteps;
            const x = 40 + t * 692;
            const simWear = t * 100;
            const lossVal = 0.015 + 0.045 * t + 0.075 * Math.pow(Math.max(0, d.effectiveAngle - 0.5), 1.55);
            const clampedLoss = Math.min(0.15, lossVal);
            const y = Math.max(26, 110 - (clampedLoss / 0.15) * 84);
            points.push({ x, y });
          }

          const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          const currentX = 40 + (d.wearPct / 100) * 692;
          const currentY = Math.max(26, 110 - (Math.min(0.15, d.estimatedLossDb) / 0.15) * 84);

          return `
            <path d="${pathD}" fill="none" stroke="${statusColor}" stroke-width="2.5" />
            <circle cx="${currentX}" cy="${currentY}" r="5" fill="${statusColor}" stroke="#ffffff" stroke-width="2" />
            <rect x="${Math.min(610, Math.max(40, currentX - 50))}" y="${currentY - 24}" width="100" height="18" rx="3" fill="var(--ink, #182e2a)" opacity="0.85" />
            <text x="${Math.min(660, Math.max(90, currentX))}" y="${currentY - 12}" font-size="10" font-weight="700" fill="#ffffff" text-anchor="middle">${d.estimatedLossDb} dB (${d.wearPct}%)</text>
          `;
        })()}

        <!-- X-Axis Labels -->
        <text x="40" y="124" font-size="9" fill="var(--muted, #64748b)">0 Arcs (New)</text>
        <text x="386" y="124" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">50% Rated Arcs</text>
        <text x="732" y="124" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">${selectedUnit.maxRatedArcs} Arcs (EoL)</text>
      </g>

      <!-- Bottom Summary Metric Badges (Y: 316 to 348) -->
      <g transform="translate(24, 316)">
        <rect x="0" y="0" width="138" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="10" y="14" font-size="8.5" fill="var(--muted, #64748b)">Cleave Quality:</text>
        <text x="10" y="26" font-size="10.5" font-weight="700" fill="var(--ink, #182e2a)">${d.effectiveAngle}° (${d.cleaveRating.split(' ')[0]})</text>

        <rect x="146" y="0" width="138" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="156" y="14" font-size="8.5" fill="var(--muted, #64748b)">Plasma Stability:</text>
        <text x="156" y="26" font-size="11" font-weight="700" fill="var(--ink, #182e2a)">${d.arcStabilityPct}% stable</text>

        <rect x="292" y="0" width="138" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="302" y="14" font-size="8.5" fill="var(--muted, #64748b)">Tensile Proof:</text>
        <text x="302" y="26" font-size="11" font-weight="700" fill="var(--ink, #182e2a)">${d.tensileProofN} N</text>

        <rect x="438" y="0" width="138" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="448" y="14" font-size="8.5" fill="var(--muted, #64748b)">Remaining Life:</text>
        <text x="448" y="26" font-size="11" font-weight="700" fill="${d.remainingArcs < 500 ? '#ef4444' : '#10b981'}">${d.remainingArcs} arcs</text>

        <rect x="584" y="0" width="148" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="594" y="14" font-size="8.5" fill="var(--muted, #64748b)">At-Risk Revenue:</text>
        <text x="594" y="26" font-size="11" font-weight="700" fill="${d.atRiskRevenue > 0 ? '#ef4444' : '#10b981'}">${formatPKR(d.atRiskRevenue)}</text>
      </g>
    </svg>
  `;
}

/**
 * Generates plain-text dispatch/briefing report for maintenance technicians.
 */
export function generateFusionSplicerReport(data, referenceDate = '2026-10-16') {
  if (!data || !data.selectedDynamics) return 'No fusion splicer telemetry available.';

  const { selectedUnit, selectedDynamics, summary, unitEvaluations } = data;
  const d = selectedDynamics;

  let out = '';
  out += '========================================================================\n';
  out += '   SHAHDARA FTTH FUSION SPLICER ELECTRODE WEAR & ARC DIAGNOSTICS AUDIT\n';
  out += `   Generated: ${referenceDate} PKT | Target Unit: ${selectedUnit.name}\n`;
  out += '========================================================================\n\n';

  out += '1. SPLICER KIT PROFILE & HARDWARE SPECIFICATIONS:\n';
  out += `   - Kit Identifier: ${selectedUnit.id}\n`;
  out += `   - Assigned Field Team: ${selectedUnit.assignedTech}\n`;
  out += `   - Operational Sector: ${selectedUnit.primaryArea}\n`;
  out += `   - Cleaver Hardware Model: ${selectedUnit.cleaverModel} (Blade Pos: ${selectedUnit.cleaverBladePosition})\n`;
  out += `   - Splicer Arc Discharge Limit: ${selectedUnit.maxRatedArcs} arcs\n`;
  out += `   - Battery Health Index: ${selectedUnit.batteryHealthPct}%\n\n`;

  out += '2. ARC DISCHARGE TELEMETRY & SPLICE INSERTION LOSS:\n';
  out += `   - Cumulative Arc Count: ${d.effectiveArcs} arcs\n`;
  out += `   - Remaining Usable Arcs: ${d.remainingArcs} arcs\n`;
  out += `   - Electrode Wear Index: ${d.wearPct}%\n`;
  out += `   - Plasma Arc Discharge Stability: ${d.arcStabilityPct}%\n`;
  out += `   - Cleave End-Face Angle: ${d.effectiveAngle}° (${d.cleaveRating})\n`;
  out += `   - Splicer Arc Calibration Current: ${d.effectiveCurrent} mA\n`;
  out += `   - Estimated Splice Insertion Loss: ${d.estimatedLossDb} dB\n`;
  out += `   - Mechanical Tensile Proof-Test: ${d.tensileProofN} N (Standard 1.96N)\n`;
  out += `   - Operational Maintenance Status: [ ${d.status} ] - ${d.statusLabel}\n`;
  out += `   - Monthly Corridor Revenue: ${formatPKR(data.selectedEvaluation.billedRevenue)}\n`;
  out += `   - High-Loss At-Risk Revenue: ${formatPKR(d.atRiskRevenue)}\n\n`;

  out += '3. SHAHDARA SPLICER FLEET REGISTER SUMMARY:\n';
  out += `   - Monitored Splicer Kits: ${summary.totalKits}\n`;
  out += `   - Health Breakdown: ${summary.optimalKitsCount} Optimal, ${summary.elevatedKitsCount} Elevated, ${summary.criticalKitsCount} Critical\n`;
  out += `   - Total Network Billed Revenue: ${formatPKR(summary.totalBilledRevenue)}\n`;
  out += `   - Total High-Attenuation At-Risk Revenue: ${formatPKR(summary.totalAtRiskRevenue)}\n\n`;

  out += '   Fleet Comparison Table:\n';
  out += '   ---------------------------------------------------------------------\n';
  out += '   Unit ID    | Sector            | Arcs (Wear%) | Cleave | Loss  | Status\n';
  out += '   ---------------------------------------------------------------------\n';
  unitEvaluations.forEach((ue) => {
    const dyn = ue.dynamics;
    const padId = ue.unit.id.padEnd(10, ' ');
    const padArea = ue.unit.primaryArea.padEnd(17, ' ');
    const padArcs = `${dyn.effectiveArcs} (${dyn.wearPct}%)`.padEnd(14, ' ');
    const padCleave = `${dyn.effectiveAngle}°`.padEnd(8, ' ');
    const padLoss = `${dyn.estimatedLossDb}dB`.padEnd(7, ' ');
    out += `   ${padId} | ${padArea} | ${padArcs} | ${padCleave} | ${padLoss} | ${dyn.status}\n`;
  });
  out += '   ---------------------------------------------------------------------\n\n';

  out += '4. TECHNICIAN ACTION DIRECTIVES:\n';
  if (d.status === 'CRITICAL') {
    out += '   [URGENT] High electrode wear or cleave angle causing unacceptable fiber attenuation.\n';
    out += '   - Action 1: Replace electrode pair immediately using spares kit (Inventory Category: Field Tools).\n';
    out += '   - Action 2: Rotate cleaver diamond blade to next rotary position (current: pos ' + selectedUnit.cleaverBladePosition + ').\n';
    out += '   - Action 3: Perform arc calibration with clean SMF-28 fiber sample before next field joint closure.\n';
  } else if (d.status === 'ELEVATED') {
    out += '   [ATTENTION] Splicer electrodes approaching maintenance advisory threshold.\n';
    out += '   - Clean V-grooves and mirrors with 99% isopropyl alcohol (IPA).\n';
    out += '   - Run electrode stabilization arc cycle.\n';
  } else {
    out += '   [HEALTHY] Splicer kit operating at optimal low-loss optical fusion benchmarks.\n';
    out += '   - Keep cleaver dust-free and maintain battery charging cycle.\n';
  }

  return out;
}

/**
 * Wires the interactive modal dialog for fusion splicer diagnostics.
 */
export function setupFusionSplicerModal(state, options = {}) {
  const {
    referenceDate = '2026-10-16',
    onFilterArea,
    onToast,
    clipboard
  } = options;

  if (typeof document === 'undefined') return;

  const modal = document.getElementById('dashboardSplicerModal');
  const openBtn = document.getElementById('dashboardOpenSplicerModalBtn');
  const closeBtn = document.getElementById('dashboardSplicerModalCloseBtn');

  const unitSelect = document.getElementById('splicerUnitSelect');
  const arcSlider = document.getElementById('splicerArcSlider');
  const arcVal = document.getElementById('splicerArcVal');
  const angleSlider = document.getElementById('splicerAngleSlider');
  const angleVal = document.getElementById('splicerAngleVal');
  const resetBtn = document.getElementById('splicerResetSimBtn');

  const kpiUnitName = document.getElementById('splicerKpiUnitName');
  const kpiLoss = document.getElementById('splicerKpiLoss');
  const kpiTensile = document.getElementById('splicerKpiTensile');
  const kpiStatusBadge = document.getElementById('splicerStatusBadge');
  const kpiRevenueRisk = document.getElementById('splicerKpiRevenueRisk');

  const chartWrap = document.getElementById('splicerModalChartWrap');
  const tableBody = document.getElementById('splicerUnitsTableBody');

  const filterAreaBtn = document.getElementById('splicerFilterAreaBtn');
  const copyBtn = document.getElementById('dashboardCopySplicerReportBtn');

  function refreshModalContent() {
    const data = calculateFusionSplicerMetrics(state, {
      unitId: selectedSplicerId,
      arcCountOverride: simulatedArcCount,
      cleaveAngleOverride: simulatedCleaveAngle,
      calibCurrentOverride: simulatedCalibCurrent,
      referenceDate
    });

    const d = data.selectedDynamics;
    const unit = data.selectedUnit;

    if (kpiUnitName) {
      kpiUnitName.textContent = `${unit.name.split('(')[0].trim()} (${d.wearPct}% wear)`;
    }
    if (kpiLoss) {
      kpiLoss.textContent = `${d.estimatedLossDb} dB (${d.effectiveAngle}° cleave)`;
    }
    if (kpiTensile) {
      kpiTensile.textContent = `${d.tensileProofN} N (Proof Test)`;
    }
    if (kpiStatusBadge) {
      kpiStatusBadge.textContent = d.status;
      kpiStatusBadge.className = `sim-delta-badge ${d.badgeClass}`;
    }
    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(d.atRiskRevenue)} at risk`;
    }

    if (chartWrap) {
      chartWrap.innerHTML = renderFusionSplicerSvg(data, { compact: false });
    }

    if (tableBody) {
      tableBody.innerHTML = data.unitEvaluations.map((ue) => {
        const dyn = ue.dynamics;
        const isCurrent = ue.unit.id === selectedSplicerId;
        const rowClass = isCurrent ? 'table-row-selected' : '';
        return `
          <tr class="${rowClass}">
            <td><strong>${ue.unit.name.split('(')[0].trim()}</strong><br><span style="font-size: 10px; color: var(--muted, #64748b);">${ue.unit.assignedTech}</span></td>
            <td>${ue.unit.primaryArea}</td>
            <td>${dyn.effectiveArcs} / ${ue.unit.maxRatedArcs} (${dyn.wearPct}%)</td>
            <td><strong>${dyn.effectiveAngle}°</strong></td>
            <td><strong>${dyn.estimatedLossDb} dB</strong></td>
            <td>${dyn.tensileProofN} N</td>
            <td><span class="sim-delta-badge ${dyn.badgeClass}">${dyn.status}</span></td>
          </tr>
        `;
      }).join('');
    }
  }

  // Populate unit select
  if (unitSelect && unitSelect.options && unitSelect.options.length === 0) {
    SHAHDARA_SPLICER_UNITS.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.name.split('(')[0].trim()} - ${u.primaryArea}`;
      if (u.id === selectedSplicerId) opt.selected = true;
      unitSelect.appendChild(opt);
    });
  }

  // Open Modal Event
  if (openBtn && !openBtn.dataset.wired) {
    openBtn.dataset.wired = 'true';
    openBtn.addEventListener('click', () => {
      if (unitSelect) unitSelect.value = selectedSplicerId;
      const initialEval = calculateFusionSplicerMetrics(state, {
        unitId: selectedSplicerId,
        referenceDate
      }).selectedDynamics;

      if (arcSlider) arcSlider.value = initialEval.effectiveArcs;
      if (arcVal) arcVal.textContent = `${initialEval.effectiveArcs} arcs`;
      if (angleSlider) angleSlider.value = initialEval.effectiveAngle;
      if (angleVal) angleVal.textContent = `${initialEval.effectiveAngle}°`;

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

  // Unit Select Change
  if (unitSelect && !unitSelect.dataset.wired) {
    unitSelect.dataset.wired = 'true';
    unitSelect.addEventListener('change', () => {
      setSplicerSelectedUnit(unitSelect.value);
      const newEval = calculateFusionSplicerMetrics(state, { unitId: unitSelect.value, referenceDate }).selectedDynamics;
      if (arcSlider) arcSlider.value = newEval.effectiveArcs;
      if (arcVal) arcVal.textContent = `${newEval.effectiveArcs} arcs`;
      if (angleSlider) angleSlider.value = newEval.effectiveAngle;
      if (angleVal) angleVal.textContent = `${newEval.effectiveAngle}°`;
      refreshModalContent();
    });
  }

  // Arc Slider Input
  if (arcSlider && !arcSlider.dataset.wired) {
    arcSlider.dataset.wired = 'true';
    arcSlider.addEventListener('input', () => {
      setSplicerArcCount(arcSlider.value);
      if (arcVal) arcVal.textContent = `${arcSlider.value} arcs`;
      refreshModalContent();
    });
  }

  // Angle Slider Input
  if (angleSlider && !angleSlider.dataset.wired) {
    angleSlider.dataset.wired = 'true';
    angleSlider.addEventListener('input', () => {
      setSplicerCleaveAngle(angleSlider.value);
      if (angleVal) angleVal.textContent = `${angleSlider.value}°`;
      refreshModalContent();
    });
  }

  // Reset Simulation Button
  if (resetBtn && !resetBtn.dataset.wired) {
    resetBtn.dataset.wired = 'true';
    resetBtn.addEventListener('click', () => {
      setSplicerArcCount(null);
      setSplicerCleaveAngle(null);
      setSplicerCalibCurrent(null);
      const resetEval = calculateFusionSplicerMetrics(state, { unitId: selectedSplicerId, referenceDate }).selectedDynamics;
      if (arcSlider) arcSlider.value = resetEval.effectiveArcs;
      if (arcVal) arcVal.textContent = `${resetEval.effectiveArcs} arcs`;
      if (angleSlider) angleSlider.value = resetEval.effectiveAngle;
      if (angleVal) angleVal.textContent = `${resetEval.effectiveAngle}°`;
      refreshModalContent();
    });
  }

  // Filter Area Button
  if (filterAreaBtn && !filterAreaBtn.dataset.wired) {
    filterAreaBtn.dataset.wired = 'true';
    filterAreaBtn.addEventListener('click', () => {
      const data = calculateFusionSplicerMetrics(state, { unitId: selectedSplicerId, referenceDate });
      if (typeof onFilterArea === 'function') {
        onFilterArea(data.selectedUnit.primaryArea);
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
      const data = calculateFusionSplicerMetrics(state, {
        unitId: selectedSplicerId,
        arcCountOverride: simulatedArcCount,
        cleaveAngleOverride: simulatedCleaveAngle,
        calibCurrentOverride: simulatedCalibCurrent,
        referenceDate
      });
      const text = generateFusionSplicerReport(data, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Fusion splicer maintenance briefing copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy maintenance briefing.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard API not available.');
      }
    });
  }
}
