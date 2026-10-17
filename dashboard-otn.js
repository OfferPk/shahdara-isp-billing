import { formatPKR } from './core.js';

/**
 * Optical Transport Network (OTN - ITU-T G.709 / G.798) Multi-Rate Framing & FEC Gain Matrix
 * Models ODUk/OTUk hierarchy, Reed-Solomon GFEC vs Soft-Decision SD-FEC coding gains,
 * BIP-8 parity error monitoring, and Section/Path defect alarm telemetry.
 * Area: agent1 (shahdara-dashboard) - KPIs, Charts, Vector Visualizer & SLA Telemetry
 */

export const OTN_CONSTANTS = {
  DEFAULT_TRUNK_ID: 'otn-trk-01',
  DEFAULT_BER_MULTIPLIER: 1.0,

  RATES: {
    OTU1: {
      name: 'OTU1 (2.666 Gbps)',
      nominalBitrateGbps: 2.666057143,
      payloadBitrateGbps: 2.488320000,
      tributarySlots: 2, // 1.25G TS basis
      baseFec: 'GFEC',
      fecOverheadPct: 6.69,
      typicalClients: 'STM-16, 2x Gigabit Ethernet (1GbE)'
    },
    OTU2: {
      name: 'OTU2 (10.709 Gbps)',
      nominalBitrateGbps: 10.709225316,
      payloadBitrateGbps: 9.995276962,
      tributarySlots: 8,
      baseFec: 'GFEC',
      fecOverheadPct: 6.69,
      typicalClients: 'STM-64, 10GbE WAN, 8x ODU0 / 4x ODU1'
    },
    OTU2e: {
      name: 'OTU2e (11.095 Gbps Overclocked)',
      nominalBitrateGbps: 11.095727848,
      payloadBitrateGbps: 10.399525316,
      tributarySlots: 8,
      baseFec: 'GFEC',
      fecOverheadPct: 6.69,
      typicalClients: '10GbE LAN PHY Direct Transparent Mapping'
    },
    OTU3: {
      name: 'OTU3 (43.018 Gbps)',
      nominalBitrateGbps: 43.018413559,
      payloadBitrateGbps: 40.150519322,
      tributarySlots: 32,
      baseFec: 'GFEC',
      fecOverheadPct: 6.69,
      typicalClients: 'STM-256, 40GbE Client, 4x ODU2 / 16x ODU1'
    },
    OTU4: {
      name: 'OTU4 (111.810 Gbps High-Speed)',
      nominalBitrateGbps: 111.809973568,
      payloadBitrateGbps: 104.355975337,
      tributarySlots: 80,
      baseFec: 'SD_FEC',
      fecOverheadPct: 20.0,
      typicalClients: '100GbE Client, 10x ODU2 / 2x ODU3 / ODUflex'
    }
  },

  FEC_PROFILES: {
    GFEC: {
      name: 'ITU-T G.709 Standard GFEC RS(255,239)',
      netCodingGainDb: 6.2,
      thresholdBer: 3.8e-3,
      overheadPct: 6.69,
      algorithm: 'Reed-Solomon RS(255,239) Block Code'
    },
    SD_FEC: {
      name: 'ITU-T G.975.1 Soft-Decision FEC (SD-FEC)',
      netCodingGainDb: 11.4,
      thresholdBer: 2.0e-2,
      overheadPct: 20.0,
      algorithm: 'Iterative Low-Density Parity-Check (LDPC) with Soft Demapping'
    }
  },

  DEFECTS: {
    NONE: { code: 'NONE', label: 'Normal (No Defect Alarms)', severity: 'nominal', description: 'OTUk/ODUk framing lock confirmed, zero defect indications' },
    OTU_LOF: { code: 'OTU_LOF', label: 'OTU Loss of Frame (LOF)', severity: 'critical', description: 'Loss of FAS alignment (F6 F6 F6 28 28 28) for > 3ms' },
    OTU_LOM: { code: 'OTU_LOM', label: 'OTU Loss of Multiframe (LOM)', severity: 'critical', description: 'Loss of MFAS counter synchronization (0..255) across 4 successive frames' },
    ODU_AIS: { code: 'ODU_AIS', label: 'ODU Alarm Indication Signal (AIS)', severity: 'critical', description: 'All-ones pattern received in ODU overhead and payload (upstream fault suppression)' },
    ODU_OCI: { code: 'ODU_OCI', label: 'ODU Open Connection Indication (OCI)', severity: 'warning', description: 'Pattern 01100110 repeating; downstream tributary connection is not cross-connected' },
    ODU_LCK: { code: 'ODU_LCK', label: 'ODU Locked Defect (LCK)', severity: 'warning', description: 'Pattern 01010101 repeating; administrative maintenance lock applied by operator' },
    HIGH_NOISE_BURST: { code: 'HIGH_NOISE_BURST', label: 'High Noise Micro-Bend Burst', severity: 'warning', description: 'Pre-FEC BER elevated by transient fiber bend or optical amplifier transient' }
  },

  STATUS: {
    OPTIMAL: 'Optimal (Error-Free Post-FEC, Resilient Headroom)',
    CORRECTING: 'Operational (FEC Active, Clear Post-FEC Stream)',
    MARGIN_WARNING: 'Marginal Headroom (Pre-FEC BER Approaching Correction Ceiling)',
    UNRESOLVABLE_DEFECT: 'Defect Alarm Active (Payload Corrupted or Unaligned)'
  }
};

export const SHAHDARA_OTN_TRUNKS = [
  {
    id: 'otn-trk-01',
    name: 'Shahdara Central OLT <-> Ravi Siphon Optical Transponder Trunk',
    rate: 'OTU4',
    distanceKm: 18.6,
    primaryArea: 'Ravi Siphon',
    targetArea: 'Shahdara Town',
    allocatedTributarySlots: 68,
    totalTributarySlots: 80,
    activeClientServices: '8x ODU2 (10G Core), 1x ODUflex (20G Cloud Transit)',
    baselinePreFecBer: 1.8e-3,
    fecType: 'SD_FEC',
    capacityGbps: 100,
    monthlyRevenuePkr: 4500000,
    subscribersCount: 820
  },
  {
    id: 'otn-trk-02',
    name: 'Shahdara Central Core <-> Begum Kot Distribution Ring Transponder',
    rate: 'OTU4',
    distanceKm: 14.8,
    primaryArea: 'Begum Kot',
    targetArea: 'Baradari',
    allocatedTributarySlots: 72,
    totalTributarySlots: 80,
    activeClientServices: '4x ODU2e (10G LAN), 2x ODU3 (40G Ring Aggregates)',
    baselinePreFecBer: 9.5e-4,
    fecType: 'SD_FEC',
    capacityGbps: 100,
    monthlyRevenuePkr: 3800000,
    subscribersCount: 650
  },
  {
    id: 'otn-trk-03',
    name: 'Shahdara Core <-> Nayatel Carrier Interconnect Point Transponder',
    rate: 'OTU2',
    distanceKm: 8.5,
    primaryArea: 'Baradari',
    targetArea: 'Vandala Road',
    allocatedTributarySlots: 8,
    totalTributarySlots: 8,
    activeClientServices: '8x ODU0 (1GbE Carrier Ethernet Feeds)',
    baselinePreFecBer: 3.2e-5,
    fecType: 'GFEC',
    capacityGbps: 10,
    monthlyRevenuePkr: 2900000,
    subscribersCount: 480
  },
  {
    id: 'otn-trk-04',
    name: 'Jia Musa Metro Hub <-> Shahdara Town 10GbE Transparent Overclocked Trunk',
    rate: 'OTU2e',
    distanceKm: 11.5,
    primaryArea: 'Jia Musa',
    targetArea: 'Shahdara Town',
    allocatedTributarySlots: 8,
    totalTributarySlots: 8,
    activeClientServices: '1x 10GBASE-R Direct Transparent LAN Mapping',
    baselinePreFecBer: 8.4e-5,
    fecType: 'GFEC',
    capacityGbps: 10,
    monthlyRevenuePkr: 2600000,
    subscribersCount: 390
  },
  {
    id: 'otn-trk-05',
    name: 'Shahdara Disaster Recovery Site <-> GT Road Transit POP',
    rate: 'OTU4',
    distanceKm: 22.4,
    primaryArea: 'Kot Abdul Malik',
    targetArea: 'Shahdara Core',
    allocatedTributarySlots: 80,
    totalTributarySlots: 80,
    activeClientServices: '1x ODU4 (Bulk 100G Encrypted Inter-DC Replication)',
    baselinePreFecBer: 3.8e-3,
    fecType: 'SD_FEC',
    capacityGbps: 100,
    monthlyRevenuePkr: 4100000,
    subscribersCount: 710
  }
];

// Interactive state variables
let currentSelectedTrunkId = OTN_CONSTANTS.DEFAULT_TRUNK_ID;
let currentBerMultiplier = OTN_CONSTANTS.DEFAULT_BER_MULTIPLIER;
let currentCustomFec = ''; // '' = auto / trunk default, 'GFEC', 'SD_FEC'
let currentSimulatedDefect = 'NONE'; // 'NONE', 'OTU_LOF', 'OTU_LOM', 'ODU_AIS', 'ODU_OCI', 'ODU_LCK', 'HIGH_NOISE_BURST'

export function getOtnSelectedTrunkId() {
  return currentSelectedTrunkId;
}

export function setOtnSelectedTrunkId(id) {
  if (SHAHDARA_OTN_TRUNKS.some(t => t.id === id)) {
    currentSelectedTrunkId = id;
  }
}

export function getOtnBerMultiplier() {
  return currentBerMultiplier;
}

export function setOtnBerMultiplier(val) {
  const num = parseFloat(val);
  if (!Number.isNaN(num) && num >= 0.1 && num <= 50.0) {
    currentBerMultiplier = num;
  }
}

export function getOtnCustomFec() {
  return currentCustomFec;
}

export function setOtnCustomFec(fec) {
  if (['', 'GFEC', 'SD_FEC'].includes(fec)) {
    currentCustomFec = fec;
  }
}

export function getOtnSimulatedDefect() {
  return currentSimulatedDefect;
}

export function setOtnSimulatedDefect(defectCode) {
  if (OTN_CONSTANTS.DEFECTS[defectCode]) {
    currentSimulatedDefect = defectCode;
  }
}

export function resetOtnSimState() {
  currentSelectedTrunkId = OTN_CONSTANTS.DEFAULT_TRUNK_ID;
  currentBerMultiplier = OTN_CONSTANTS.DEFAULT_BER_MULTIPLIER;
  currentCustomFec = '';
  currentSimulatedDefect = 'NONE';
}

/**
 * Calculates effective pre-FEC BER based on trunk baseline, noise multiplier, and simulated defect.
 */
export function calculateEffectivePreFecBer(baselineBer, multiplier, simulatedDefect) {
  let ber = baselineBer * multiplier;
  if (simulatedDefect === 'HIGH_NOISE_BURST') {
    ber = Math.max(ber, 1.2e-2);
  } else if (['OTU_LOF', 'OTU_LOM', 'ODU_AIS'].includes(simulatedDefect)) {
    ber = 0.5; // Complete framing loss / uncorrectable stream
  }
  return Math.min(Math.max(ber, 1e-12), 0.5);
}

/**
 * Estimates post-FEC BER according to ITU-T G.709 Reed-Solomon GFEC vs G.975.1 SD-FEC curves.
 */
export function estimatePostFecBer(preFecBer, fecProfile) {
  if (preFecBer >= 0.5) return 0.5;

  const threshold = fecProfile.thresholdBer;
  if (preFecBer >= threshold) {
    // Uncorrectable burst
    const excessRatio = (preFecBer - threshold) / (0.5 - threshold);
    return Math.min(1e-3 + excessRatio * 0.499, 0.5);
  }

  // Safe operating regime below threshold
  const headroomRatio = (threshold - preFecBer) / threshold;
  if (headroomRatio > 0.4) {
    // Fully corrected: post-FEC BER < 1e-15 (virtually error free)
    return 1e-16;
  }

  // Near cliff edge: asymptotic decay
  const exponent = -15 + (1 - headroomRatio) * 11;
  return Math.pow(10, exponent);
}

/**
 * Calculates Net Coding Gain and optical FEC margin in decibels (dB).
 */
export function calculateFecHeadroomMargin(preFecBer, thresholdBer) {
  if (preFecBer >= thresholdBer) {
    return 0.0;
  }
  // Margin in dB of optical SNR equivalent headroom: 10 * log10(threshold / preFecBer)
  const marginDb = 10 * Math.log10(thresholdBer / preFecBer);
  return Math.round(marginDb * 100) / 100;
}

/**
 * Computes BIP-8 block error statistics across ITU-T G.709 frames.
 */
export function calculateBip8Statistics(preFecBer, totalFramesSampled = 8000) {
  // ITU-T G.709 frame has 16,320 bytes = 130,560 bits
  const bitsPerFrame = 130560;
  const bitErrorProbability = preFecBer;
  // Probability a frame has at least one bit error in its BIP-8 block
  const frameErrorProb = 1 - Math.pow(1 - bitErrorProbability, bitsPerFrame);
  const erroredBlockCount = Math.round(frameErrorProb * totalFramesSampled);
  const backgroundBlockErrorRatio = erroredBlockCount / totalFramesSampled;

  return {
    bitsPerFrame,
    totalFramesSampled,
    erroredBlockCount,
    backgroundBlockErrorRatio: Math.min(backgroundBlockErrorRatio, 1.0)
  };
}

/**
 * Evaluates the full operational dynamics for the selected OTN optical trunk.
 */
export function calculateOtnDynamics(state = {}, options = {}) {
  const trunkId = options.trunkId || currentSelectedTrunkId;
  const berMult = options.berMultiplier !== undefined ? options.berMultiplier : currentBerMultiplier;
  const customFec = options.customFec !== undefined ? options.customFec : currentCustomFec;
  const defect = options.simulatedDefect || currentSimulatedDefect;

  const trunk = SHAHDARA_OTN_TRUNKS.find(t => t.id === trunkId) || SHAHDARA_OTN_TRUNKS[0];
  const rateInfo = OTN_CONSTANTS.RATES[trunk.rate] || OTN_CONSTANTS.RATES.OTU4;

  const activeFecKey = customFec || trunk.fecType || rateInfo.baseFec;
  const fecProfile = OTN_CONSTANTS.FEC_PROFILES[activeFecKey] || OTN_CONSTANTS.FEC_PROFILES.SD_FEC;

  const preFecBer = calculateEffectivePreFecBer(trunk.baselinePreFecBer, berMult, defect);
  const postFecBer = estimatePostFecBer(preFecBer, fecProfile);
  const fecMarginDb = calculateFecHeadroomMargin(preFecBer, fecProfile.thresholdBer);
  const bip8 = calculateBip8Statistics(preFecBer);

  // Tributary slot utilization
  const slotUtilizationPct = Math.round((trunk.allocatedTributarySlots / trunk.totalTributarySlots) * 1000) / 10;
  const availableTributarySlots = trunk.totalTributarySlots - trunk.allocatedTributarySlots;

  // Defect alarm determination
  let activeDefect = OTN_CONSTANTS.DEFECTS[defect] || OTN_CONSTANTS.DEFECTS.NONE;
  if (defect === 'NONE' && preFecBer >= fecProfile.thresholdBer) {
    activeDefect = {
      code: 'FEC_UNCORRECTABLE',
      label: 'FEC Uncorrectable Error Burst',
      severity: 'critical',
      description: `Pre-FEC BER (${preFecBer.toExponential(2)}) exceeds ${fecProfile.name} correction ceiling (${fecProfile.thresholdBer.toExponential(2)})`
    };
  }

  // Health Status
  let status = OTN_CONSTANTS.STATUS.OPTIMAL;
  if (activeDefect.severity === 'critical') {
    status = OTN_CONSTANTS.STATUS.UNRESOLVABLE_DEFECT;
  } else if (fecMarginDb < 2.0 || activeDefect.severity === 'warning') {
    status = OTN_CONSTANTS.STATUS.MARGIN_WARNING;
  } else if (fecMarginDb < 6.0) {
    status = OTN_CONSTANTS.STATUS.CORRECTING;
  }

  return {
    trunk,
    rateInfo,
    activeFecKey,
    fecProfile,
    preFecBer,
    postFecBer,
    fecMarginDb,
    bip8,
    slotUtilizationPct,
    availableTributarySlots,
    activeDefect,
    status
  };
}

/**
 * Calculates fleet-wide summary metrics across all Shahdara OTN carrier trunks.
 */
export function calculateOtnMetrics(state = {}, options = {}) {
  let totalTrunks = SHAHDARA_OTN_TRUNKS.length;
  let totalCapacityGbps = 0;
  let totalAllocatedSlots = 0;
  let totalAvailableSlots = 0;
  let totalMonthlyRevenuePkr = 0;
  let totalSubscribersProtected = 0;
  let healthyTrunkCount = 0;
  let alarmedTrunkCount = 0;
  let sumMarginDb = 0;

  for (const trunk of SHAHDARA_OTN_TRUNKS) {
    totalCapacityGbps += trunk.capacityGbps;
    totalAllocatedSlots += trunk.allocatedTributarySlots;
    totalAvailableSlots += trunk.totalTributarySlots;
    totalMonthlyRevenuePkr += trunk.monthlyRevenuePkr;
    totalSubscribersProtected += trunk.subscribersCount;

    const dyn = calculateOtnDynamics(state, { trunkId: trunk.id, berMultiplier: 1.0, simulatedDefect: 'NONE' });
    sumMarginDb += dyn.fecMarginDb;
    if (dyn.activeDefect.severity === 'nominal') {
      healthyTrunkCount++;
    } else {
      alarmedTrunkCount++;
    }
  }

  const averageFecMarginDb = totalTrunks > 0 ? Math.round((sumMarginDb / totalTrunks) * 10) / 10 : 0;
  const overallSlotUtilizationPct = totalAvailableSlots > 0 ? Math.round((totalAllocatedSlots / totalAvailableSlots) * 100) : 0;

  return {
    totalTrunks,
    totalCapacityGbps,
    totalAllocatedSlots,
    totalAvailableSlots,
    overallSlotUtilizationPct,
    totalMonthlyRevenuePkr,
    totalSubscribersProtected,
    healthyTrunkCount,
    alarmedTrunkCount,
    averageFecMarginDb
  };
}

/**
 * Pure-vector SVG visualizer depicting ITU-T G.709 4-row x 4080-column OTN frame structure,
 * Section/Path overhead bytes, tributary slots, FEC parity blocks, and real-time telemetry HUD.
 */
export function renderOtnDiagramSvg(dynamics, options = {}) {
  const isDark = options.isDark ?? false;
  const compact = options.compact ?? false;

  const dyn = dynamics || calculateOtnDynamics();
  const { trunk, rateInfo, fecProfile, preFecBer, postFecBer, fecMarginDb, slotUtilizationPct, activeDefect, status } = dyn;

  const width = compact ? 720 : 860;
  const height = compact ? 330 : 410;

  // Color palette
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  // Severity indicator color
  let statusColor = '#10b981'; // nominal green
  if (activeDefect.severity === 'warning') statusColor = '#f59e0b'; // amber
  if (activeDefect.severity === 'critical') statusColor = '#ef4444'; // red

  // Formatting helpers
  const berPreFormatted = preFecBer < 1e-10 ? '< 1.0e-10' : preFecBer.toExponential(2);
  const berPostFormatted = postFecBer <= 1e-15 ? '< 1.0e-15 (Zero Defect)' : postFecBer.toExponential(2);

  // Frame columns visualization (4 rows x 4080 cols mapped to x-axis)
  // Cols 1-7: FAS/MFAS (w: 32)
  // Cols 8-14: OTU SM & GCC0 (w: 36)
  // Cols 1-14 rows 2-4: ODU PM & TCM (w: 52)
  // Cols 15-16: OPU Overhead PSI (w: 24)
  // Cols 17-3824: OPU Payload Area (w: 420)
  // Cols 3825-4080: FEC Parity (w: 120)

  const frameX = 30;
  const frameY = compact ? 70 : 80;
  const frameW = width - 60;
  const frameH = compact ? 120 : 150;
  const rowH = frameH / 4;

  // Segment widths scaled to frameW
  const wFas = Math.round(frameW * 0.05);
  const wOtuSm = Math.round(frameW * 0.06);
  const wOduPm = Math.round(frameW * 0.07);
  const wOpuOh = Math.round(frameW * 0.05);
  const wFec = Math.round(frameW * 0.16);
  const wPayload = frameW - (wFas + wOtuSm + wOduPm + wOpuOh + wFec);

  const xFas = frameX;
  const xOtuSm = xFas + wFas;
  const xOduPm = xOtuSm + wOtuSm;
  const xOpuOh = xOduPm + wOduPm;
  const xPayload = xOpuOh + wOpuOh;
  const xFec = xPayload + wPayload;

  // Tributary slot fill width inside payload area
  const payloadFillW = Math.round((slotUtilizationPct / 100) * wPayload);

  return `
  <svg class="otn-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="OTN ITU-T G.709 Frame Structure and FEC Gain Telemetry">
    <!-- Background Canvas -->
    <rect width="${width}" height="${height}" rx="10" fill="${bgColor}" stroke="${borderColor}" stroke-width="1.5"/>

    <!-- Header Section -->
    <g transform="translate(30, 28)">
      <text x="0" y="0" font-family="'DM Sans', system-ui, sans-serif" font-size="14" font-weight="700" fill="${textPrimary}">
        ${trunk.name}
      </text>
      <text x="0" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="500" fill="${textMuted}">
        ${rateInfo.name} · ${fecProfile.name} · Span: ${trunk.distanceKm} km · Revenue: ${formatPKR(trunk.monthlyRevenuePkr)}
      </text>
      <!-- Defect Alarm Pill -->
      <g transform="translate(${width - 240}, -10)">
        <rect width="180" height="26" rx="13" fill="${statusColor}" fill-opacity="0.15" stroke="${statusColor}" stroke-width="1.5"/>
        <circle cx="14" cy="13" r="5" fill="${statusColor}"/>
        <text x="26" y="17" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="${statusColor}">
          ${activeDefect.code} (${activeDefect.severity.toUpperCase()})
        </text>
      </g>
    </g>

    <!-- ITU-T G.709 4-Row Frame Layout Container -->
    <g>
      <!-- Outer Frame Box -->
      <rect x="${frameX}" y="${frameY}" width="${frameW}" height="${frameH}" rx="6" fill="${cardBg}" stroke="${borderColor}" stroke-width="1.5"/>

      <!-- Row Lines -->
      <line x1="${frameX}" y1="${frameY + rowH}" x2="${frameX + frameW}" y2="${frameY + rowH}" stroke="${borderColor}" stroke-width="1" stroke-dasharray="2 2"/>
      <line x1="${frameX}" y1="${frameY + rowH * 2}" x2="${frameX + frameW}" y2="${frameY + rowH * 2}" stroke="${borderColor}" stroke-width="1" stroke-dasharray="2 2"/>
      <line x1="${frameX}" y1="${frameY + rowH * 3}" x2="${frameX + frameW}" y2="${frameY + rowH * 3}" stroke="${borderColor}" stroke-width="1" stroke-dasharray="2 2"/>

      <!-- Section: FAS / MFAS (Cols 1-7, Row 1) -->
      <rect x="${xFas}" y="${frameY}" width="${wFas}" height="${rowH}" fill="#3b82f6" fill-opacity="0.25" stroke="#3b82f6" stroke-width="1"/>
      <text x="${xFas + wFas / 2}" y="${frameY + rowH / 2 + 4}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="700" fill="#3b82f6">FAS</text>

      <!-- Section: OTU-SM & GCC0 (Cols 8-14, Row 1) -->
      <rect x="${xOtuSm}" y="${frameY}" width="${wOtuSm}" height="${rowH}" fill="#8b5cf6" fill-opacity="0.25" stroke="#8b5cf6" stroke-width="1"/>
      <text x="${xOtuSm + wOtuSm / 2}" y="${frameY + rowH / 2 + 4}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="700" fill="#8b5cf6">OTU-SM</text>

      <!-- Section: ODU-PM, TCM1-6, APS (Cols 1-14, Rows 2-4) -->
      <rect x="${xFas}" y="${frameY + rowH}" width="${wFas + wOtuSm + wOduPm}" height="${rowH * 3}" fill="#06b6d4" fill-opacity="0.18" stroke="#06b6d4" stroke-width="1"/>
      <text x="${xFas + (wFas + wOtuSm + wOduPm) / 2}" y="${frameY + rowH * 2.5 + 4}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="#06b6d4">
        ODU-PM / TCM Overhead (Cols 1–14)
      </text>

      <!-- Section: OPU Overhead PSI (Cols 15-16, Rows 1-4) -->
      <rect x="${xOpuOh}" y="${frameY}" width="${wOpuOh}" height="${frameH}" fill="#f59e0b" fill-opacity="0.20" stroke="#f59e0b" stroke-width="1"/>
      <text x="${xOpuOh + wOpuOh / 2}" y="${frameY + frameH / 2 + 3}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="700" fill="#f59e0b" transform="rotate(-90 ${xOpuOh + wOpuOh / 2} ${frameY + frameH / 2 + 3})">
        OPU-OH (PSI)
      </text>

      <!-- Section: OPU Payload Area (Cols 17-3824, Rows 1-4) -->
      <rect x="${xPayload}" y="${frameY}" width="${wPayload}" height="${frameH}" fill="${isDark ? '#1e293b' : '#f1f5f9'}" stroke="${borderColor}" stroke-width="1"/>
      <!-- Tributary Slot Allocation Fill -->
      <rect x="${xPayload}" y="${frameY}" width="${payloadFillW}" height="${frameH}" fill="#10b981" fill-opacity="0.25"/>
      <text x="${xPayload + wPayload / 2}" y="${frameY + frameH / 2 - 8}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="700" fill="${textPrimary}">
        OPU Payload Area (Cols 17–3824: 15,232 Bytes/Frame)
      </text>
      <text x="${xPayload + wPayload / 2}" y="${frameY + frameH / 2 + 10}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="${textMuted}">
        Tributary Slots: ${trunk.allocatedTributarySlots}/${trunk.totalTributarySlots} Allocated (${slotUtilizationPct}%) · ${trunk.activeClientServices}
      </text>

      <!-- Section: Forward Error Correction FEC Parity (Cols 3825-4080, Rows 1-4) -->
      <rect x="${xFec}" y="${frameY}" width="${wFec}" height="${frameH}" fill="#ec4899" fill-opacity="0.22" stroke="#ec4899" stroke-width="1.5"/>
      <text x="${xFec + wFec / 2}" y="${frameY + frameH / 2 - 6}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="700" fill="#ec4899">
        FEC Parity Check
      </text>
      <text x="${xFec + wFec / 2}" y="${frameY + frameH / 2 + 10}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="600" fill="#ec4899">
        ${fecProfile.overheadPct}% OH (+${fecProfile.netCodingGainDb} dB NCG)
      </text>
    </g>

    <!-- Bottom Telemetry HUD Cards -->
    <g transform="translate(30, ${frameY + frameH + 18})">
      <!-- Card 1: Pre-FEC BER -->
      <rect x="0" y="0" width="${(frameW - 30) / 4}" height="76" rx="6" fill="${cardBg}" stroke="${borderColor}" stroke-width="1"/>
      <text x="12" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="${textMuted}">PRE-FEC BER (RAW)</text>
      <text x="12" y="42" font-family="'DM Sans', system-ui, sans-serif" font-size="13" font-weight="700" fill="${textPrimary}">${berPreFormatted}</text>
      <text x="12" y="60" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="500" fill="${textMuted}">Threshold: ${fecProfile.thresholdBer.toExponential(1)}</text>

      <!-- Card 2: Post-FEC BER -->
      <rect x="${(frameW - 30) / 4 + 10}" y="0" width="${(frameW - 30) / 4}" height="76" rx="6" fill="${cardBg}" stroke="${borderColor}" stroke-width="1"/>
      <text x="${(frameW - 30) / 4 + 22}" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="${textMuted}">POST-FEC BER (CORRECTED)</text>
      <text x="${(frameW - 30) / 4 + 22}" y="42" font-family="'DM Sans', system-ui, sans-serif" font-size="12" font-weight="700" fill="${statusColor}">${berPostFormatted}</text>
      <text x="${(frameW - 30) / 4 + 22}" y="60" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="500" fill="${textMuted}">ITU-T SLA Target: &lt; 1.0e-15</text>

      <!-- Card 3: FEC Optical Headroom Margin -->
      <rect x="${((frameW - 30) / 4) * 2 + 20}" y="0" width="${(frameW - 30) / 4}" height="76" rx="6" fill="${cardBg}" stroke="${borderColor}" stroke-width="1"/>
      <text x="${((frameW - 30) / 4) * 2 + 32}" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="${textMuted}">OPTICAL FEC HEADROOM</text>
      <text x="${((frameW - 30) / 4) * 2 + 32}" y="42" font-family="'DM Sans', system-ui, sans-serif" font-size="14" font-weight="700" fill="#047857">${fecMarginDb} dB</text>
      <text x="${((frameW - 30) / 4) * 2 + 32}" y="60" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="500" fill="${textMuted}">Net Coding Gain: +${fecProfile.netCodingGainDb} dB</text>

      <!-- Card 4: BIP-8 Parity & Defect Status -->
      <rect x="${((frameW - 30) / 4) * 3 + 30}" y="0" width="${(frameW - 30) / 4}" height="76" rx="6" fill="${cardBg}" stroke="${borderColor}" stroke-width="1"/>
      <text x="${((frameW - 30) / 4) * 3 + 42}" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="${textMuted}">BIP-8 PARITY &amp; DEFECTS</text>
      <text x="${((frameW - 30) / 4) * 3 + 42}" y="42" font-family="'DM Sans', system-ui, sans-serif" font-size="12" font-weight="700" fill="${statusColor}">${activeDefect.code}</text>
      <text x="${((frameW - 30) / 4) * 3 + 42}" y="60" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="500" fill="${textMuted}">BBER: ${dyn.bip8.backgroundBlockErrorRatio.toExponential(2)}</text>
    </g>

    <!-- Footer Summary Line -->
    <g transform="translate(30, ${height - 14})">
      <text x="0" y="0" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="600" fill="${textMuted}">
        Status: <tspan font-weight="700" fill="${statusColor}">${status}</tspan> · Dark Headroom: <tspan font-weight="700" fill="${textPrimary}">${dyn.availableTributarySlots} TS (${Math.round((100 - slotUtilizationPct) * 10) / 10}%)</tspan> · Subscribers: <tspan font-weight="700" fill="#047857">${trunk.subscribersCount}</tspan>
      </text>
      <text x="${width - 60}" y="0" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="500" fill="${textMuted}">
        ITU-T G.709 / G.798 Section &amp; Path Telemetry
      </text>
    </g>
  </svg>
  `;
}

/**
 * Generates plain-text SLA & compliance audit briefing for the OTN matrix.
 */
export function generateOtnReport(state = {}) {
  const dyn = calculateOtnDynamics(state);
  const metrics = calculateOtnMetrics(state);

  return [
    '========================================================================',
    '       SHAHDARA OPTICAL TRANSPORT NETWORK (OTN - ITU-T G.709) AUDIT',
    '========================================================================',
    `Timestamp: ${new Date().toISOString()}`,
    `Primary Trunk: ${dyn.trunk.name}`,
    `Rate Class: ${dyn.rateInfo.name} (${dyn.rateInfo.nominalBitrateGbps.toFixed(3)} Gbps)`,
    `Active Payload: ${dyn.rateInfo.payloadBitrateGbps.toFixed(3)} Gbps (${dyn.trunk.activeClientServices})`,
    `Tributary Slots: ${dyn.trunk.allocatedTributarySlots}/${dyn.trunk.totalTributarySlots} (${dyn.slotUtilizationPct}% allocated, ${dyn.availableTributarySlots} dark slots remaining)`,
    `Span Distance: ${dyn.trunk.distanceKm} km (SMF-28)`,
    `Primary Area: ${dyn.trunk.primaryArea} -> ${dyn.trunk.targetArea}`,
    '',
    'FORWARD ERROR CORRECTION (FEC) & CODING MARGIN:',
    `  FEC Profile: ${dyn.fecProfile.name}`,
    `  Algorithm: ${dyn.fecProfile.algorithm}`,
    `  Overhead: ${dyn.fecProfile.overheadPct}% (+${dyn.fecProfile.netCodingGainDb} dB Net Coding Gain)`,
    `  Pre-FEC BER (Raw): ${dyn.preFecBer.toExponential(3)} (Threshold: ${dyn.fecProfile.thresholdBer.toExponential(2)})`,
    `  Post-FEC BER (Corrected): ${dyn.postFecBer.toExponential(3)}`,
    `  Optical Headroom Margin: ${dyn.fecMarginDb} dB`,
    `  BIP-8 Errored Block Count: ${dyn.bip8.erroredBlockCount}/${dyn.bip8.totalFramesSampled} frames`,
    `  Background Block Error Ratio (BBER): ${dyn.bip8.backgroundBlockErrorRatio.toExponential(3)}`,
    '',
    'DEFECT ALARM & SLA STATUS:',
    `  Active Defect Code: ${dyn.activeDefect.code} (${dyn.activeDefect.label})`,
    `  Severity: ${dyn.activeDefect.severity.toUpperCase()}`,
    `  Description: ${dyn.activeDefect.description}`,
    `  Operational Status: ${dyn.status}`,
    `  Subscribers at Risk: ${dyn.trunk.subscribersCount}`,
    `  Monthly Revenue Protected: ${formatPKR(dyn.trunk.monthlyRevenuePkr)}`,
    '',
    'FLEET-WIDE CARRIER OTN SUMMARY:',
    `  Total Transponder Trunks: ${metrics.totalTrunks}`,
    `  Total Optical Capacity: ${metrics.totalCapacityGbps} Gbps`,
    `  Fleet Tributary Slots: ${metrics.totalAllocatedSlots}/${metrics.totalAvailableSlots} (${metrics.overallSlotUtilizationPct}% overall utilization)`,
    `  Fleet Average FEC Headroom: ${metrics.averageFecMarginDb} dB`,
    `  Healthy / Alarmed Trunks: ${metrics.healthyTrunkCount} / ${metrics.alarmedTrunkCount}`,
    `  Total Fleet Protected Revenue: ${formatPKR(metrics.totalMonthlyRevenuePkr)}`,
    `  Total Protected Subscribers: ${metrics.totalSubscribersProtected}`,
    '========================================================================'
  ].join('\n');
}

/**
 * Exports current OTN telemetry state as JSON string.
 */
export function exportOtnJson(state = {}) {
  const dyn = calculateOtnDynamics(state);
  const metrics = calculateOtnMetrics(state);

  return JSON.stringify({
    timestamp: new Date().toISOString(),
    selectedTrunk: {
      id: dyn.trunk.id,
      name: dyn.trunk.name,
      rate: dyn.trunk.rate,
      distanceKm: dyn.trunk.distanceKm,
      primaryArea: dyn.trunk.primaryArea,
      targetArea: dyn.trunk.targetArea,
      capacityGbps: dyn.trunk.capacityGbps,
      allocatedTributarySlots: dyn.trunk.allocatedTributarySlots,
      totalTributarySlots: dyn.trunk.totalTributarySlots,
      slotUtilizationPct: dyn.slotUtilizationPct,
      activeClientServices: dyn.trunk.activeClientServices,
      monthlyRevenuePkr: dyn.trunk.monthlyRevenuePkr,
      subscribersCount: dyn.trunk.subscribersCount
    },
    fecTelemetry: {
      fecProfile: dyn.fecProfile.name,
      netCodingGainDb: dyn.fecProfile.netCodingGainDb,
      overheadPct: dyn.fecProfile.overheadPct,
      thresholdBer: dyn.fecProfile.thresholdBer,
      preFecBer: dyn.preFecBer,
      postFecBer: dyn.postFecBer,
      fecMarginDb: dyn.fecMarginDb,
      bip8: dyn.bip8
    },
    alarms: {
      defectCode: dyn.activeDefect.code,
      label: dyn.activeDefect.label,
      severity: dyn.activeDefect.severity,
      description: dyn.activeDefect.description,
      status: dyn.status
    },
    fleetMetrics: metrics
  }, null, 2);
}

/**
 * Exports current OTN telemetry state as CSV string.
 */
export function exportOtnCsv(state = {}) {
  const headers = [
    'TrunkId',
    'TrunkName',
    'Rate',
    'CapacityGbps',
    'DistanceKm',
    'PrimaryArea',
    'AllocatedSlots',
    'TotalSlots',
    'SlotUtilPct',
    'FecProfile',
    'PreFecBer',
    'PostFecBer',
    'FecMarginDb',
    'DefectCode',
    'Status',
    'MonthlyRevenuePkr',
    'Subscribers'
  ];

  const dyn = calculateOtnDynamics(state);
  const t = dyn.trunk;

  const row = [
    t.id,
    `"${t.name}"`,
    t.rate,
    t.capacityGbps,
    t.distanceKm,
    t.primaryArea,
    t.allocatedTributarySlots,
    t.totalTributarySlots,
    dyn.slotUtilizationPct,
    `"${dyn.fecProfile.name}"`,
    dyn.preFecBer,
    dyn.postFecBer,
    dyn.fecMarginDb,
    dyn.activeDefect.code,
    `"${dyn.status}"`,
    t.monthlyRevenuePkr,
    t.subscribersCount
  ];

  return headers.join(',') + '\n' + row.join(',');
}

/**
 * Modal and dashboard card UI controller for OTN ITU-T G.709 Matrix.
 */
export function setupOtnModal(state = {}, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const modal = doc.getElementById('dashboardOtnModal');
  const openBtn = doc.getElementById('dashboardOpenOtnModalBtn');
  const closeBtn = doc.getElementById('dashboardOtnModalCloseBtn');

  const cardChart = doc.getElementById('dashboardOtnChart');
  const modalDiagram = doc.getElementById('otnModalDiagramContainer');

  const trunkSelect = doc.getElementById('otnTrunkSelect');
  const fecSelect = doc.getElementById('otnFecModeSelect');
  const defectSelect = doc.getElementById('otnDefectSimSelect');
  const berSlider = doc.getElementById('otnBerSlider');
  const berLabel = doc.getElementById('otnBerLabel');
  const resetBtn = doc.getElementById('otnResetBtn');

  // Stats in modal
  const statCapacity = doc.getElementById('otnStatCapacity');
  const statPreFec = doc.getElementById('otnStatPreFec');
  const statPostFec = doc.getElementById('otnStatPostFec');
  const statMargin = doc.getElementById('otnStatMargin');
  const statSlots = doc.getElementById('otnStatSlots');
  const statDefect = doc.getElementById('otnStatDefect');

  // Action buttons
  const filterAreaBtn = doc.getElementById('otnFilterAreaBtn');
  const exportJsonBtn = doc.getElementById('otnExportJsonBtn');
  const exportCsvBtn = doc.getElementById('otnExportCsvBtn');
  const copyReportBtn = doc.getElementById('otnCopyReportBtn');

  const renderView = () => {
    const isDark = doc.documentElement && doc.documentElement.getAttribute('data-theme') === 'dark';
    const dyn = calculateOtnDynamics(state);

    if (cardChart) {
      cardChart.innerHTML = renderOtnDiagramSvg(dyn, { isDark, compact: true });
    }
    if (modalDiagram) {
      modalDiagram.innerHTML = renderOtnDiagramSvg(dyn, { isDark, compact: false });
    }

    if (berLabel) {
      berLabel.textContent = `${getOtnBerMultiplier().toFixed(1)}x`;
    }

    if (statCapacity) {
      statCapacity.textContent = `${dyn.trunk.capacityGbps} Gbps (${dyn.rateInfo.name.split(' ')[0]})`;
    }
    if (statPreFec) {
      statPreFec.textContent = dyn.preFecBer < 1e-10 ? '< 1.0e-10' : dyn.preFecBer.toExponential(2);
    }
    if (statPostFec) {
      statPostFec.textContent = dyn.postFecBer <= 1e-15 ? '< 1.0e-15' : dyn.postFecBer.toExponential(2);
    }
    if (statMargin) {
      statMargin.textContent = `${dyn.fecMarginDb} dB`;
    }
    if (statSlots) {
      statSlots.textContent = `${dyn.trunk.allocatedTributarySlots}/${dyn.trunk.totalTributarySlots} (${dyn.slotUtilizationPct}%)`;
    }
    if (statDefect) {
      statDefect.textContent = dyn.activeDefect.code;
      statDefect.style.color = dyn.activeDefect.severity === 'critical' ? '#ef4444' : dyn.activeDefect.severity === 'warning' ? '#f59e0b' : '#10b981';
    }
  };

  // Event wiring
  if (trunkSelect) {
    trunkSelect.addEventListener('change', () => {
      setOtnSelectedTrunkId(trunkSelect.value);
      renderView();
    });
  }

  if (fecSelect) {
    fecSelect.addEventListener('change', () => {
      setOtnCustomFec(fecSelect.value);
      renderView();
    });
  }

  if (defectSelect) {
    defectSelect.addEventListener('change', () => {
      setOtnSimulatedDefect(defectSelect.value);
      renderView();
    });
  }

  if (berSlider) {
    berSlider.addEventListener('input', () => {
      setOtnBerMultiplier(parseFloat(berSlider.value));
      renderView();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetOtnSimState();
      if (trunkSelect) trunkSelect.value = getOtnSelectedTrunkId();
      if (fecSelect) fecSelect.value = getOtnCustomFec();
      if (defectSelect) defectSelect.value = getOtnSimulatedDefect();
      if (berSlider) berSlider.value = getOtnBerMultiplier();
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast('OTN framing and FEC parameters reset to baseline');
      }
    });
  }

  if (filterAreaBtn) {
    filterAreaBtn.addEventListener('click', () => {
      const dyn = calculateOtnDynamics(state);
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(dyn.trunk.primaryArea);
      }
      if (modal && typeof modal.close === 'function') {
        modal.close();
      }
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const jsonStr = exportOtnJson(state);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(jsonStr);
      }
      if (typeof options.onToast === 'function') {
        options.onToast('OTN JSON telemetry copied to clipboard');
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const csvStr = exportOtnCsv(state);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(csvStr);
      }
      if (typeof options.onToast === 'function') {
        options.onToast('OTN CSV telemetry copied to clipboard');
      }
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const report = generateOtnReport(state);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(report);
      }
      if (typeof options.onToast === 'function') {
        options.onToast('OTN ITU-T G.709 audit report copied to clipboard');
      }
    });
  }

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      if (trunkSelect) trunkSelect.value = getOtnSelectedTrunkId();
      if (fecSelect) fecSelect.value = getOtnCustomFec();
      if (defectSelect) defectSelect.value = getOtnSimulatedDefect();
      if (berSlider) berSlider.value = getOtnBerMultiplier();
      renderView();
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

  // Initial draw
  renderView();

  return {
    open: () => {
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
        renderView();
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
