/**
 * Shahdara ISP - Field Technician Optical Fiber Fusion Splice Joint Audit & Sleeving Protector Record Sheet
 * Part of mobile navigation and field crew tools (agent2 - shahdara-mobile-nav).
 *
 * Implements ITU-T G.652.D / G.657.A1 singlemode fiber fusion splice loss modeling,
 * Profile Alignment System (PAS) core eccentricity calculations, cleave end-face angle evaluation,
 * 200g mechanical proof-test validation, 40mm/60mm heat-shrink sleeve oven curing tracking,
 * pure client-side SVG fiber alignment and electric arc discharge visualizer,
 * persistent local splice audit ledger (localStorage), and lineman WhatsApp dispatch reporting.
 */

import { TIA_598_COLOR_CODES, resolveFiberCoreFromNumber } from './nav-vfl-tracer.js';

export const FUSION_SPLICE_STORAGE_KEY = 'shahdara_fusion_splice_records_v1';

export const FUSION_FIBER_TYPES = [
  { id: 'SM_G652D', name: 'ITU-T G.652.D (Standard Singlemode SMF-28)', mfdUm: 9.2, coreDiaUm: 8.2, lossLimitDb: 0.05, cleaveLimitDeg: 1.0 },
  { id: 'BIF_G657A1', name: 'ITU-T G.657.A1 (Bend-Insensitive Drop Fiber)', mfdUm: 8.8, coreDiaUm: 8.0, lossLimitDb: 0.05, cleaveLimitDeg: 1.2 },
  { id: 'BIF_G657A2', name: 'ITU-T G.657.A2 (High-Flex Tight Buffer Indoor)', mfdUm: 8.6, coreDiaUm: 7.8, lossLimitDb: 0.06, cleaveLimitDeg: 1.2 },
  { id: 'NZDSF_G655', name: 'ITU-T G.655 (Trunk Low Water Peak Singlemode)', mfdUm: 9.6, coreDiaUm: 8.4, lossLimitDb: 0.04, cleaveLimitDeg: 0.8 }
];

export const FUSION_ALIGN_MODES = [
  { id: 'PAS_CORE', name: 'PAS Core-to-Core Active Alignment (3-Axis)', accuracyFactor: 1.0, arcDurationMs: 2200 },
  { id: 'CLAD_FIXED', name: 'Fixed V-Groove Clad Alignment (Handheld Splicer)', accuracyFactor: 1.6, arcDurationMs: 1800 },
  { id: 'QUICK_SM', name: 'Quick SM Auto High-Speed Arc (Field Mode)', accuracyFactor: 1.2, arcDurationMs: 1400 }
];

export const FUSION_SLEEVE_TYPES = [
  { id: 'SLEEVE_60MM', name: '60mm Standard OSP Sleeve (Steel Strength Member)', ovenTempC: 190, bakeTimeSec: 25 },
  { id: 'SLEEVE_40MM', name: '40mm Micro Drop Sleeve (Slim High-Density Tray)', ovenTempC: 185, bakeTimeSec: 18 },
  { id: 'SLEEVE_DROP', name: 'Flat Butterfly Drop Cable Splice Protector', ovenTempC: 200, bakeTimeSec: 30 }
];

export const FUSION_SLEEVE_STATUSES = {
  CURED_SOLID: { id: 'CURED_SOLID', label: 'Cured Solid (Uniform Shrinkage, No Voids)', badgeClass: 'badge-success', pass: true },
  HEATED_COOLING: { id: 'HEATED_COOLING', label: 'Oven Bake Complete (Cooling in Tray)', badgeClass: 'badge-info', pass: true },
  BUBBLE_INCLUSION: { id: 'BUBBLE_INCLUSION', label: 'Trapped Air Bubble Defect (Replace Sleeve)', badgeClass: 'badge-danger', pass: false },
  UNDER_HEATED: { id: 'UNDER_HEATED', label: 'Under-Heated / Incomplete Shrinkage (Reheat)', badgeClass: 'badge-warning', pass: false }
};

export const SPLICE_QUALITY_GRADES = {
  EXCELLENT: { id: 'EXCELLENT', label: 'EXCELLENT SPLICE (≤ 0.02 dB)', maxLoss: 0.02, badgeClass: 'badge-success', pass: true },
  GOOD: { id: 'GOOD', label: 'GOOD SPLICE (0.02 - 0.05 dB)', maxLoss: 0.05, badgeClass: 'badge-success', pass: true },
  ACCEPTABLE: { id: 'ACCEPTABLE', label: 'ACCEPTABLE (0.05 - 0.08 dB)', maxLoss: 0.08, badgeClass: 'badge-info', pass: true },
  MARGINAL: { id: 'MARGINAL', label: 'MARGINAL (0.08 - 0.15 dB)', maxLoss: 0.15, badgeClass: 'badge-warning', pass: false },
  RE_SPLICE: { id: 'RE_SPLICE', label: 'FAIL - RE-SPLICE REQUIRED (> 0.15 dB)', maxLoss: Infinity, badgeClass: 'badge-danger', pass: false }
};

export const SHAHDARA_SPLICE_CLOSURES = [
  { id: 'clos-sh-01', name: 'FDB-01 Shahdara Chowk Main Hub', area: 'Shahdara Town', type: 'FDB_16', poleNumber: 'SH-P-04', trayNumber: 1, landmark: 'Near Metro Station Chowk' },
  { id: 'clos-kam-02', name: 'FOSC-02 Kot Abdul Malik Splice Dome', area: 'Kot Abdul Malik', type: 'FOSC_48', poleNumber: 'KAM-P-18', trayNumber: 2, landmark: 'Motorway Interchange Junction' },
  { id: 'clos-bk-03', name: 'FAT-03 Begum Kot Railway Crossing', area: 'Begum Kot', type: 'FAT_24', poleNumber: 'BK-P-11', trayNumber: 1, landmark: 'Railway Gate Pole #11' },
  { id: 'clos-ic-04', name: 'FOSC-04 Imamia Colony Feeder Ring', area: 'Imamia Colony', type: 'FOSC_48', poleNumber: 'IC-P-22', trayNumber: 3, landmark: 'Main Market Transformer Pole' },
  { id: 'clos-sp-05', name: 'FAT-05 Saeed Park Aggregator Pole', area: 'Saeed Park', type: 'FAT_24', poleNumber: 'SP-P-09', trayNumber: 1, landmark: 'Street 4 Corner Pole' },
  { id: 'clos-jm-06', name: 'FDB-06 Jia Musa Distribution Box', area: 'Jia Musa', type: 'FDB_16', poleNumber: 'JM-P-15', trayNumber: 2, landmark: 'Near Govt High School' },
  { id: 'clos-bd-07', name: 'FAT-07 Baradari Industrial Feeder', area: 'Baradari Road', type: 'FAT_24', poleNumber: 'BD-P-07', trayNumber: 1, landmark: 'Tariq Road Carpet Mills Gate' },
  { id: 'clos-ns-08', name: 'FAT-08 Nain Sukh Drop Enclosure', area: 'Nain Sukh', type: 'FAT_24', poleNumber: 'NS-P-13', trayNumber: 1, landmark: 'River Bund Road Entry' }
];

/**
 * Calculates estimated fusion splice loss based on lateral core offset,
 * angular cleave tilt mismatch, fiber mode field diameter (MFD), and alignment mode.
 *
 * Physics formula:
 * L_lat (dB) = 4.343 * ( (offset / (MFD / 2)) ** 2 )
 * L_ang (dB) = 4.343 * 0.5 * ( (tilt_rad * pi * (MFD / 2) / lambda) ** 2 )
 * L_intrinsic = baseline arc melt loss (0.012 dB)
 */
export function calculateEstimatedSpliceLoss({
  leftCleaveDeg = 0.5,
  rightCleaveDeg = 0.6,
  coreOffsetUm = 0.15,
  fiberTypeId = 'SM_G652D',
  alignModeId = 'PAS_CORE'
} = {}) {
  const fiber = FUSION_FIBER_TYPES.find(f => f.id === fiberTypeId) || FUSION_FIBER_TYPES[0];
  const align = FUSION_ALIGN_MODES.find(a => a.id === alignModeId) || FUSION_ALIGN_MODES[0];

  const offset = Math.max(0, Math.min(2.5, Number(coreOffsetUm) || 0));
  const cleaveL = Math.max(0, Math.min(5.0, Number(leftCleaveDeg) || 0));
  const cleaveR = Math.max(0, Math.min(5.0, Number(rightCleaveDeg) || 0));

  const mfdRadius = fiber.mfdUm / 2; // e.g. 4.6 µm
  const lambdaUm = 1.31; // 1310 nm standard singlemode propagation wavelength

  // Lateral offset loss
  const lateralLoss = 4.343 * Math.pow(offset / mfdRadius, 2);

  // Angular tilt mismatch (cleave differential in radians)
  const tiltDeg = Math.abs(cleaveL - cleaveR);
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const angularLoss = 4.343 * 0.5 * Math.pow((tiltRad * Math.PI * mfdRadius) / lambdaUm, 2);

  // Excessive cleave angle penalty (lip, hackle, or burr formation)
  let cleavePenalty = 0;
  if (cleaveL > 1.5) cleavePenalty += (cleaveL - 1.5) * 0.05;
  if (cleaveR > 1.5) cleavePenalty += (cleaveR - 1.5) * 0.05;

  // Intrinsic minimum arc melt loss
  const baselineLoss = 0.010;

  // Total raw loss scaled by alignment system accuracy factor
  const totalRaw = (baselineLoss + lateralLoss + angularLoss + cleavePenalty) * align.accuracyFactor;

  // Clamp and format to 3 decimal places
  const calculatedLoss = Math.max(0.005, Math.min(1.5, Math.round(totalRaw * 1000) / 1000));
  return calculatedLoss;
}

/**
 * Evaluates the quality, pass/fail status, and diagnostic recommendations of a fusion splice.
 */
export function evaluateSpliceQuality(
  lossDb,
  leftCleaveDeg = 0.5,
  rightCleaveDeg = 0.6,
  proofTestPassed = true,
  sleeveStatusId = 'CURED_SOLID'
) {
  const loss = Math.max(0, Number(lossDb) || 0);
  const cleaveL = Math.max(0, Number(leftCleaveDeg) || 0);
  const cleaveR = Math.max(0, Number(rightCleaveDeg) || 0);
  const sleeveStatus = FUSION_SLEEVE_STATUSES[sleeveStatusId] || FUSION_SLEEVE_STATUSES.CURED_SOLID;

  let grade = SPLICE_QUALITY_GRADES.RE_SPLICE;
  if (loss <= 0.02) {
    grade = SPLICE_QUALITY_GRADES.EXCELLENT;
  } else if (loss <= 0.05) {
    grade = SPLICE_QUALITY_GRADES.GOOD;
  } else if (loss <= 0.08) {
    grade = SPLICE_QUALITY_GRADES.ACCEPTABLE;
  } else if (loss <= 0.15) {
    grade = SPLICE_QUALITY_GRADES.MARGINAL;
  }

  const warnings = [];
  const recommendations = [];

  // Mechanical proof test failure overrides everything
  if (!proofTestPassed) {
    grade = SPLICE_QUALITY_GRADES.RE_SPLICE;
    warnings.push('CRITICAL: Fiber slipped or snapped during 200g mechanical proof tension pull test.');
    recommendations.push('Re-strip, re-clean with 99% isopropyl alcohol, and re-cleave both fiber ends.');
  }

  // Cleave angle checks
  if (cleaveL > 1.5 || cleaveR > 1.5) {
    warnings.push(`High cleave angle detected (L: ${cleaveL.toFixed(1)}°, R: ${cleaveR.toFixed(1)}°). Exceeds 1.5° limit.`);
    recommendations.push('Clean precision cleaver rubber pads and rotate fiber cleaver carbide wheel to a fresh blade position.');
  }

  // Sleeve status check
  if (!sleeveStatus.pass) {
    warnings.push(`Sleeve Defect: ${sleeveStatus.label}.`);
    if (sleeveStatusId === 'BUBBLE_INCLUSION') {
      recommendations.push('Remove and discard defective heat-shrink sleeve; re-sleeve with genuine steel-reinforced protector.');
    } else {
      recommendations.push('Return splice to sleeve heater oven for another 10s cycle at 190°C.');
    }
  }

  // Loss threshold check
  if (loss > 0.05 && grade.pass) {
    warnings.push(`Splice loss (${loss.toFixed(3)} dB) is above optimum 0.05 dB carrier benchmark.`);
    recommendations.push('Ensure arc discharge electrodes are clean; run arc calibration routine on the fusion splicer.');
  } else if (!grade.pass && proofTestPassed) {
    warnings.push(`Unacceptable optical splice loss of ${loss.toFixed(3)} dB.`);
    recommendations.push('Perform arc electrode stabilization and re-splice the joint.');
  }

  const overallPass = grade.pass && proofTestPassed && sleeveStatus.pass;

  return {
    grade,
    lossDb: loss,
    overallPass,
    warnings,
    recommendations
  };
}

/**
 * Reads persistent splice audit records from localStorage.
 */
export function getSpliceAuditStore(storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return [];
  try {
    const raw = store.getItem(FUSION_SPLICE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Saves splice audit records to localStorage.
 */
export function saveSpliceAuditStore(records, storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  try {
    store.setItem(FUSION_SPLICE_STORAGE_KEY, JSON.stringify(records.slice(0, 50)));
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Records a new splice audit entry into the persistent store.
 */
export function recordSpliceAudit(entry, storage = null) {
  const current = getSpliceAuditStore(storage);
  const evaluation = evaluateSpliceQuality(
    entry.spliceLossDb,
    entry.leftCleaveDeg,
    entry.rightCleaveDeg,
    entry.proofTestPassed,
    entry.sleeveStatusId
  );

  const inboundCore = resolveFiberCoreFromNumber(entry.inboundCoreNumber || 1, 48);
  const outboundCore = resolveFiberCoreFromNumber(entry.outboundCoreNumber || 1, 48);
  const closure = SHAHDARA_SPLICE_CLOSURES.find(c => c.id === entry.closureId) || SHAHDARA_SPLICE_CLOSURES[0];

  const newRecord = {
    id: `splice-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    closureId: closure.id,
    closureName: closure.name,
    area: closure.area,
    poleNumber: closure.poleNumber,
    trayNumber: Number(entry.trayNumber) || closure.trayNumber,
    inboundCoreNumber: inboundCore.coreNumber,
    inboundFiberName: inboundCore.fiberColor.name,
    inboundFiberHex: inboundCore.fiberColor.hex,
    outboundCoreNumber: outboundCore.coreNumber,
    outboundFiberName: outboundCore.fiberColor.name,
    outboundFiberHex: outboundCore.fiberColor.hex,
    fiberTypeId: entry.fiberTypeId || 'SM_G652D',
    alignModeId: entry.alignModeId || 'PAS_CORE',
    sleeveTypeId: entry.sleeveTypeId || 'SLEEVE_60MM',
    sleeveStatusId: entry.sleeveStatusId || 'CURED_SOLID',
    leftCleaveDeg: Number(entry.leftCleaveDeg) || 0.5,
    rightCleaveDeg: Number(entry.rightCleaveDeg) || 0.6,
    coreOffsetUm: Number(entry.coreOffsetUm) || 0.15,
    spliceLossDb: Number(entry.spliceLossDb) || 0.02,
    proofTestPassed: Boolean(entry.proofTestPassed),
    gradeId: evaluation.grade.id,
    gradeLabel: evaluation.grade.label,
    overallPass: evaluation.overallPass,
    linemanNotes: String(entry.linemanNotes || '').trim()
  };

  const updated = [newRecord, ...current].slice(0, 50);
  saveSpliceAuditStore(updated, storage);
  return newRecord;
}

/**
 * Clears the persistent splice store.
 */
export function clearSpliceAuditStore(storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  try {
    store.removeItem(FUSION_SPLICE_STORAGE_KEY);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Renders a responsive pure-vector SVG showing the fusion splice joint:
 * - V-groove clamp graphics
 * - Left and right fiber cladding with colored singlemode cores
 * - Arc electrode tips with plasma discharge glow
 * - Core alignment crosshair guides
 * - Real-time loss HUD & status badge
 * - Proof test & sleeve curing indicators
 */
export function renderMobileSpliceSvg(spliceRecord) {
  const rec = spliceRecord || {};
  const lossDb = Number(rec.spliceLossDb) || 0.022;
  const leftCleave = Number(rec.leftCleaveDeg) || 0.5;
  const rightCleave = Number(rec.rightCleaveDeg) || 0.6;
  const coreOffset = Number(rec.coreOffsetUm) || 0.12;
  const proofPass = rec.proofTestPassed !== false;
  const sleeveStatus = FUSION_SLEEVE_STATUSES[rec.sleeveStatusId] || FUSION_SLEEVE_STATUSES.CURED_SOLID;

  const inbound = resolveFiberCoreFromNumber(rec.inboundCoreNumber || 1, 48);
  const outbound = resolveFiberCoreFromNumber(rec.outboundCoreNumber || 1, 48);

  const evaluation = evaluateSpliceQuality(lossDb, leftCleave, rightCleave, proofPass, rec.sleeveStatusId);

  // SVG dimensions
  const width = 640;
  const height = 240;

  // Electrode arc color based on evaluation
  const arcGlowColor = evaluation.overallPass ? '#38bdf8' : '#f43f5e';
  const hudBadgeBg = evaluation.grade.badgeClass === 'badge-success'
    ? '#10b981'
    : (evaluation.grade.badgeClass === 'badge-danger' ? '#ef4444' : '#f59e0b');

  // Fiber core Y offset simulation (in pixels for visual effect)
  const visualOffsetPx = Math.min(8, Math.max(-8, (coreOffset - 0.15) * 12));
  const leftY = 120;
  const rightY = 120 + visualOffsetPx;

  // Angular tilt effect in SVG path
  const leftTiltDelta = Math.sin((leftCleave * Math.PI) / 180) * 14;
  const rightTiltDelta = Math.sin((rightCleave * Math.PI) / 180) * 14;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="fusion-splice-svg" role="img" aria-label="Fusion Splice V-Groove Core Alignment Diagram">
      <defs>
        <!-- V-groove gradient -->
        <linearGradient id="vGrooveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="50%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0b0f19"/>
        </linearGradient>

        <!-- Cladding glass gradient -->
        <linearGradient id="glassCladGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="rgba(148, 163, 184, 0.45)"/>
          <stop offset="50%" stop-color="rgba(203, 213, 225, 0.15)"/>
          <stop offset="100%" stop-color="rgba(100, 116, 139, 0.5)"/>
        </linearGradient>

        <!-- Electric Arc Plasma Glow Filter -->
        <filter id="plasmaGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur1"/>
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur2"/>
          <feMerge>
            <feMergeNode in="blur2"/>
            <feMergeNode in="blur1"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <!-- Background V-Groove Chamber -->
      <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="url(#vGrooveGrad)" stroke="#334155" stroke-width="1.5"/>

      <!-- Grid Alignment Lines -->
      <g stroke="rgba(51, 65, 85, 0.4)" stroke-width="0.8" stroke-dasharray="3,3">
        <line x1="40" y1="60" x2="600" y2="60"/>
        <line x1="40" y1="120" x2="600" y2="120"/>
        <line x1="40" y1="180" x2="600" y2="180"/>
        <line x1="320" y1="30" x2="320" y2="210"/>
      </g>

      <!-- V-Groove Base Blocks (Left and Right) -->
      <polygon points="60,175 290,175 270,215 80,215" fill="#1e293b" stroke="#475569" stroke-width="1.2"/>
      <polygon points="350,175 580,175 560,215 370,215" fill="#1e293b" stroke="#475569" stroke-width="1.2"/>
      <text x="175" y="200" fill="#64748b" font-size="10" font-weight="600" text-anchor="middle">V-GROOVE LEFT (X/Y)</text>
      <text x="465" y="200" fill="#64748b" font-size="10" font-weight="600" text-anchor="middle">V-GROOVE RIGHT (Z)</text>

      <!-- Left Fiber Cladding (125 µm Glass, simulated 40px) -->
      <path d="M 60,100 L 312,${100 + leftTiltDelta} L 312,${140 - leftTiltDelta} L 60,140 Z" fill="url(#glassCladGrad)" stroke="#64748b" stroke-width="1.2"/>

      <!-- Left Fiber Core (9 µm Core, simulated 8px) with TIA-598 Color -->
      <rect x="60" y="${leftY - 4}" width="252" height="8" rx="2" fill="${inbound.fiberColor.hex}" stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/>

      <!-- Right Fiber Cladding (125 µm Glass) -->
      <path d="M 328,${100 - rightTiltDelta + visualOffsetPx} L 580,${100 + visualOffsetPx} L 580,${140 + visualOffsetPx} L 328,${140 + rightTiltDelta + visualOffsetPx} Z" fill="url(#glassCladGrad)" stroke="#64748b" stroke-width="1.2"/>

      <!-- Right Fiber Core (9 µm Core) with TIA-598 Color -->
      <rect x="328" y="${rightY - 4}" width="252" height="8" rx="2" fill="${outbound.fiberColor.hex}" stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/>

      <!-- Top and Bottom Electrodes (Tungsten Arc Needles) -->
      <polygon points="314,10 326,10 322,65 318,65" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1"/>
      <circle cx="320" cy="67" r="2.5" fill="#f8fafc"/>
      <polygon points="314,230 326,230 322,175 318,175" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1"/>
      <circle cx="320" cy="173" r="2.5" fill="#f8fafc"/>

      <!-- Plasma Arc Discharge Glow -->
      <g filter="url(#plasmaGlow)">
        <line x1="320" y1="67" x2="320" y2="173" stroke="${arcGlowColor}" stroke-width="3" stroke-linecap="round" opacity="0.85"/>
        <circle cx="320" cy="120" r="14" fill="${arcGlowColor}" opacity="0.35"/>
        <ellipse cx="320" cy="120" rx="4" ry="10" fill="#ffffff" opacity="0.9"/>
      </g>

      <!-- Cleave Angle Markers -->
      <g font-size="10" font-family="monospace" fill="#94a3b8">
        <text x="280" y="88" text-anchor="end">θL: ${leftCleave.toFixed(1)}°</text>
        <text x="360" y="88" text-anchor="start">θR: ${rightCleave.toFixed(1)}°</text>
      </g>

      <!-- Digital LCD Loss HUD Display -->
      <g transform="translate(20, 16)">
        <rect x="0" y="0" width="165" height="52" rx="6" fill="#090d16" stroke="#1e293b" stroke-width="1.2"/>
        <text x="8" y="15" fill="#64748b" font-size="9" font-weight="700" letter-spacing="0.5">ESTIMATED ARC LOSS</text>
        <text x="8" y="42" fill="#38bdf8" font-size="22" font-weight="800" font-family="monospace">${lossDb.toFixed(3)}</text>
        <text x="80" y="40" fill="#94a3b8" font-size="11" font-weight="600">dB</text>
        <rect x="105" y="24" width="52" height="18" rx="4" fill="${hudBadgeBg}"/>
        <text x="131" y="37" fill="#ffffff" font-size="8" font-weight="800" text-anchor="middle">${evaluation.grade.id}</text>
      </g>

      <!-- Proof Tension & Sleeve Indicator Box -->
      <g transform="translate(470, 16)">
        <rect x="0" y="0" width="150" height="52" rx="6" fill="#090d16" stroke="#1e293b" stroke-width="1.2"/>
        <text x="8" y="15" fill="#64748b" font-size="9" font-weight="700">200g PULL TENSION</text>
        <text x="8" y="32" fill="${proofPass ? '#10b981' : '#ef4444'}" font-size="12" font-weight="700">
          ${proofPass ? '✓ PASS (1.96 N)' : '✗ FAIL (SNAPPED)'}
        </text>
        <text x="8" y="45" fill="${sleeveStatus.pass ? '#38bdf8' : '#f59e0b'}" font-size="9" font-weight="600">
          Sleeve: ${sleeveStatus.id}
        </text>
      </g>

      <!-- Inbound & Outbound Core Badges -->
      <g transform="translate(60, 155)">
        <rect x="0" y="0" width="110" height="18" rx="4" fill="${inbound.fiberColor.hex}" opacity="0.85"/>
        <text x="55" y="13" fill="${inbound.fiberColor.textDark ? '#000' : '#fff'}" font-size="9" font-weight="700" text-anchor="middle">
          In: C#${inbound.coreNumber} (${inbound.fiberColor.name})
        </text>
      </g>
      <g transform="translate(470, 155)">
        <rect x="0" y="0" width="110" height="18" rx="4" fill="${outbound.fiberColor.hex}" opacity="0.85"/>
        <text x="55" y="13" fill="${outbound.fiberColor.textDark ? '#000' : '#fff'}" font-size="9" font-weight="700" text-anchor="middle">
          Out: C#${outbound.coreNumber} (${outbound.fiberColor.name})
        </text>
      </g>
    </svg>
  `;
}

/**
 * Generates an executive WhatsApp field dispatch report for Shahdara NOC and field supervisors.
 */
export function generateSpliceWhatsAppReport(spliceRecord, options = {}) {
  const rec = spliceRecord || {};
  const loss = Number(rec.spliceLossDb) || 0.02;
  const leftCleave = Number(rec.leftCleaveDeg) || 0.5;
  const rightCleave = Number(rec.rightCleaveDeg) || 0.6;
  const coreOffset = Number(rec.coreOffsetUm) || 0.15;
  const proofPass = rec.proofTestPassed !== false;
  const sleeveStatus = FUSION_SLEEVE_STATUSES[rec.sleeveStatusId] || FUSION_SLEEVE_STATUSES.CURED_SOLID;
  const evaluation = evaluateSpliceQuality(loss, leftCleave, rightCleave, proofPass, rec.sleeveStatusId);

  const inbound = resolveFiberCoreFromNumber(rec.inboundCoreNumber || 1, 48);
  const outbound = resolveFiberCoreFromNumber(rec.outboundCoreNumber || 1, 48);

  const closure = SHAHDARA_SPLICE_CLOSURES.find(c => c.id === rec.closureId) || SHAHDARA_SPLICE_CLOSURES[0];
  const fiber = FUSION_FIBER_TYPES.find(f => f.id === rec.fiberTypeId) || FUSION_FIBER_TYPES[0];
  const align = FUSION_ALIGN_MODES.find(a => a.id === rec.alignModeId) || FUSION_ALIGN_MODES[0];
  const sleeve = FUSION_SLEEVE_TYPES.find(s => s.id === rec.sleeveTypeId) || FUSION_SLEEVE_TYPES[0];

  const now = rec.timestamp ? new Date(rec.timestamp) : new Date();
  const dateStr = now.toISOString().replace('T', ' ').slice(0, 19) + ' PKT';

  return [
    `⚡ *SHAHDARA ISP - OPTICAL FIBER FUSION SPLICE AUDIT* ⚡`,
    `📅 Date/Time: ${dateStr}`,
    `📍 Enclosure: ${closure.name}`,
    `🏙️ Area: ${closure.area} (Pole: ${closure.poleNumber}, Tray: ${rec.trayNumber || closure.trayNumber})`,
    `📌 Landmark: ${closure.landmark}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🔬 *FIBER CORE PAIR DETAILS*`,
    `• Inbound Drop/Feeder: Core #${inbound.coreNumber} (${inbound.fiberColor.name} / ${inbound.fiberColor.urduName})`,
    `• Outbound Distribution: Core #${outbound.coreNumber} (${outbound.fiberColor.name} / ${outbound.fiberColor.urduName})`,
    `• Fiber Standard: ${fiber.name}`,
    `• Alignment Mode: ${align.name}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📊 *SPLICE LOSS & OPTICAL METRICS*`,
    `• Estimated Splice Loss: ${loss.toFixed(3)} dB [${evaluation.grade.label}]`,
    `• Left Cleave Angle: ${leftCleave.toFixed(1)}° (${leftCleave <= 1.0 ? 'PASS' : 'MARGINAL'})`,
    `• Right Cleave Angle: ${rightCleave.toFixed(1)}° (${rightCleave <= 1.0 ? 'PASS' : 'MARGINAL'})`,
    `• Core-to-Core Offset: ${coreOffset.toFixed(2)} µm`,
    `• 200g Mechanical Tension Pull: ${proofPass ? 'PASS ✓' : 'FAILED ✗'}`,
    `• Heat Shrink Sleeve: ${sleeve.name} - ${sleeveStatus.label}`,
    `• Overall QA Result: ${evaluation.overallPass ? 'APPROVED FOR SERVICE ✓' : 'RE-SPLICE REQUIRED ✗'}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📝 Technician Notes: ${rec.linemanNotes || 'Arc alignment nominal. Heat shrink seated in tray.'}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Generated via Shahdara ISP Field Navigation Suite`
  ].join('\n');
}

/**
 * Initializes and wires the Field Technician Optical Fiber Fusion Splice Modal Dialog.
 * Works seamlessly across mobile navigation drawer, more menu, action sheet, and speed dial.
 */
export function setupMobileFusionSpliceModal(options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

  if (!doc) {
    return {
      open: () => {},
      close: () => {},
      getCurrentReading: () => ({}),
      setReading: () => {}
    };
  }

  const modal = doc.getElementById('mobileFusionSpliceModal');
  const closeBtn = doc.getElementById('mobileFusionSpliceModalCloseBtn');
  const openButtons = doc.querySelectorAll('[data-open-fusion-splice]');

  // Inputs
  const closureSelect = doc.getElementById('spliceClosureSelect');
  const trayInput = doc.getElementById('spliceTrayInput');
  const inboundCoreSlider = doc.getElementById('spliceInboundCoreSlider');
  const inboundCoreInput = doc.getElementById('spliceInboundCoreInput');
  const outboundCoreSlider = doc.getElementById('spliceOutboundCoreSlider');
  const outboundCoreInput = doc.getElementById('spliceOutboundCoreInput');
  const fiberTypeSelect = doc.getElementById('spliceFiberTypeSelect');
  const alignModeSelect = doc.getElementById('spliceAlignModeSelect');
  const sleeveTypeSelect = doc.getElementById('spliceSleeveTypeSelect');
  const sleeveStatusSelect = doc.getElementById('spliceSleeveStatusSelect');
  const leftCleaveSlider = doc.getElementById('spliceLeftCleaveSlider');
  const leftCleaveVal = doc.getElementById('spliceLeftCleaveVal');
  const rightCleaveSlider = doc.getElementById('spliceRightCleaveSlider');
  const rightCleaveVal = doc.getElementById('spliceRightCleaveVal');
  const coreOffsetSlider = doc.getElementById('spliceCoreOffsetSlider');
  const coreOffsetVal = doc.getElementById('spliceCoreOffsetVal');
  const proofTestCheckbox = doc.getElementById('spliceProofTestCheckbox');
  const notesInput = doc.getElementById('spliceNotesInput');

  // Outputs & Display
  const svgContainer = doc.getElementById('spliceSvgContainer');
  const lossDisplay = doc.getElementById('spliceLossDisplay');
  const gradeBadge = doc.getElementById('spliceGradeBadge');
  const warningsContainer = doc.getElementById('spliceWarningsContainer');
  const historyTableBody = doc.getElementById('spliceHistoryTableBody');

  // Action Buttons
  const recordSpliceBtn = doc.getElementById('spliceRecordLogBtn');
  const copyReportBtn = doc.getElementById('spliceCopyReportBtn');
  const clearHistoryBtn = doc.getElementById('spliceClearHistoryBtn');
  const filterAreaBtn = doc.getElementById('spliceFilterAreaBtn');

  // Initial State
  const currentReading = {
    closureId: 'clos-sh-01',
    trayNumber: 1,
    inboundCoreNumber: 1,
    outboundCoreNumber: 1,
    fiberTypeId: 'SM_G652D',
    alignModeId: 'PAS_CORE',
    sleeveTypeId: 'SLEEVE_60MM',
    sleeveStatusId: 'CURED_SOLID',
    leftCleaveDeg: 0.5,
    rightCleaveDeg: 0.6,
    coreOffsetUm: 0.12,
    spliceLossDb: 0.021,
    proofTestPassed: true,
    linemanNotes: ''
  };

  function updateCalculatedLoss() {
    currentReading.spliceLossDb = calculateEstimatedSpliceLoss({
      leftCleaveDeg: currentReading.leftCleaveDeg,
      rightCleaveDeg: currentReading.rightCleaveDeg,
      coreOffsetUm: currentReading.coreOffsetUm,
      fiberTypeId: currentReading.fiberTypeId,
      alignModeId: currentReading.alignModeId
    });
  }

  function renderView() {
    updateCalculatedLoss();

    const evaluation = evaluateSpliceQuality(
      currentReading.spliceLossDb,
      currentReading.leftCleaveDeg,
      currentReading.rightCleaveDeg,
      currentReading.proofTestPassed,
      currentReading.sleeveStatusId
    );

    // Update SVG
    if (svgContainer) {
      svgContainer.innerHTML = renderMobileSpliceSvg(currentReading);
    }

    // Update Loss and Grade Badges
    if (lossDisplay) {
      lossDisplay.textContent = `${currentReading.spliceLossDb.toFixed(3)} dB`;
    }

    if (gradeBadge) {
      gradeBadge.className = `badge ${evaluation.grade.badgeClass}`;
      gradeBadge.textContent = evaluation.grade.label;
    }

    // Update Warnings / Recommendations
    if (warningsContainer) {
      if (evaluation.warnings.length === 0) {
        warningsContainer.innerHTML = `
          <div class="alert alert-success" style="font-size: 12px; padding: 6px 10px; margin: 0;">
            ✓ All splice parameters within ITU-T G.652.D / Telcordia standards.
          </div>
        `;
      } else {
        warningsContainer.innerHTML = evaluation.warnings.map(w => `
          <div class="alert alert-warning" style="font-size: 12px; padding: 6px 10px; margin-bottom: 4px;">
            ⚠ ${w}
          </div>
        `).join('');
      }
    }

    // Update History Table
    if (historyTableBody) {
      const records = getSpliceAuditStore(storage);
      if (records.length === 0) {
        historyTableBody.innerHTML = `
          <tr><td colspan="5" style="text-align: center; color: var(--muted, #94a3b8); padding: 12px;">No splice records logged yet.</td></tr>
        `;
      } else {
        historyTableBody.innerHTML = records.slice(0, 8).map(r => `
          <tr style="border-bottom: 1px solid var(--border, #334155); font-size: 12px;">
            <td style="padding: 6px 8px;">${r.timestamp ? r.timestamp.slice(11, 16) : '--:--'}</td>
            <td style="padding: 6px 8px;">${r.closureName || r.area}</td>
            <td style="padding: 6px 8px;">C#${r.inboundCoreNumber} ➔ C#${r.outboundCoreNumber}</td>
            <td style="padding: 6px 8px; font-weight: bold; font-family: monospace;">${r.spliceLossDb.toFixed(3)} dB</td>
            <td style="padding: 6px 8px;"><span class="badge ${r.overallPass ? 'badge-success' : 'badge-danger'}">${r.overallPass ? 'PASS' : 'FAIL'}</span></td>
          </tr>
        `).join('');
      }
    }
  }

  function openModal() {
    if (!modal) return;
    renderView();
    if (typeof modal.showModal === 'function') {
      try {
        modal.showModal();
      } catch (_) {
        modal.setAttribute('open', 'true');
      }
    } else {
      modal.setAttribute('open', 'true');
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

  // Bind Open Buttons
  openButtons.forEach(btn => {
    btn.onclick = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      openModal();
    };
  });

  if (closeBtn) {
    closeBtn.onclick = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      closeModal();
    };
  }

  // Input Event Listeners
  if (closureSelect) {
    closureSelect.onchange = (e) => {
      currentReading.closureId = e.target.value;
      const found = SHAHDARA_SPLICE_CLOSURES.find(c => c.id === e.target.value);
      if (found && trayInput) {
        trayInput.value = found.trayNumber;
        currentReading.trayNumber = found.trayNumber;
      }
      renderView();
    };
  }

  if (trayInput) {
    trayInput.oninput = (e) => {
      currentReading.trayNumber = Math.max(1, Number(e.target.value) || 1);
    };
  }

  if (inboundCoreSlider) {
    inboundCoreSlider.oninput = (e) => {
      const val = Number(e.target.value) || 1;
      currentReading.inboundCoreNumber = val;
      if (inboundCoreInput) inboundCoreInput.value = val;
      renderView();
    };
  }

  if (inboundCoreInput) {
    inboundCoreInput.oninput = (e) => {
      const val = Math.max(1, Math.min(48, Number(e.target.value) || 1));
      currentReading.inboundCoreNumber = val;
      if (inboundCoreSlider) inboundCoreSlider.value = val;
      renderView();
    };
  }

  if (outboundCoreSlider) {
    outboundCoreSlider.oninput = (e) => {
      const val = Number(e.target.value) || 1;
      currentReading.outboundCoreNumber = val;
      if (outboundCoreInput) outboundCoreInput.value = val;
      renderView();
    };
  }

  if (outboundCoreInput) {
    outboundCoreInput.oninput = (e) => {
      const val = Math.max(1, Math.min(48, Number(e.target.value) || 1));
      currentReading.outboundCoreNumber = val;
      if (outboundCoreSlider) outboundCoreSlider.value = val;
      renderView();
    };
  }

  if (fiberTypeSelect) {
    fiberTypeSelect.onchange = (e) => {
      currentReading.fiberTypeId = e.target.value;
      renderView();
    };
  }

  if (alignModeSelect) {
    alignModeSelect.onchange = (e) => {
      currentReading.alignModeId = e.target.value;
      renderView();
    };
  }

  if (sleeveTypeSelect) {
    sleeveTypeSelect.onchange = (e) => {
      currentReading.sleeveTypeId = e.target.value;
      renderView();
    };
  }

  if (sleeveStatusSelect) {
    sleeveStatusSelect.onchange = (e) => {
      currentReading.sleeveStatusId = e.target.value;
      renderView();
    };
  }

  if (leftCleaveSlider) {
    leftCleaveSlider.oninput = (e) => {
      const val = Number(e.target.value) || 0.5;
      currentReading.leftCleaveDeg = val;
      if (leftCleaveVal) leftCleaveVal.textContent = `${val.toFixed(1)}°`;
      renderView();
    };
  }

  if (rightCleaveSlider) {
    rightCleaveSlider.oninput = (e) => {
      const val = Number(e.target.value) || 0.6;
      currentReading.rightCleaveDeg = val;
      if (rightCleaveVal) rightCleaveVal.textContent = `${val.toFixed(1)}°`;
      renderView();
    };
  }

  if (coreOffsetSlider) {
    coreOffsetSlider.oninput = (e) => {
      const val = Number(e.target.value) || 0.12;
      currentReading.coreOffsetUm = val;
      if (coreOffsetVal) coreOffsetVal.textContent = `${val.toFixed(2)} µm`;
      renderView();
    };
  }

  if (proofTestCheckbox) {
    proofTestCheckbox.onchange = (e) => {
      currentReading.proofTestPassed = e.target.checked;
      renderView();
    };
  }

  // Button Listeners
  if (recordSpliceBtn) {
    recordSpliceBtn.onclick = () => {
      if (notesInput) currentReading.linemanNotes = notesInput.value;
      const saved = recordSpliceAudit(currentReading, storage);
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast(`✓ Logged Fusion Splice Joint (Loss: ${saved.spliceLossDb.toFixed(3)} dB)`);
      }
    };
  }

  if (copyReportBtn) {
    copyReportBtn.onclick = async () => {
      if (notesInput) currentReading.linemanNotes = notesInput.value;
      const report = generateSpliceWhatsAppReport(currentReading, options);
      const clipboard = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      let success = false;
      if (clipboard && typeof clipboard.writeText === 'function') {
        try {
          await clipboard.writeText(report);
          success = true;
        } catch (_) {}
      }
      if (typeof options.onToast === 'function') {
        options.onToast(success ? '✓ WhatsApp Splice Report copied to clipboard' : 'Report generated in console');
      }
    };
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.onclick = () => {
      clearSpliceAuditStore(storage);
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast('Cleared fusion splice audit log');
      }
    };
  }

  if (filterAreaBtn) {
    filterAreaBtn.onclick = () => {
      const closure = SHAHDARA_SPLICE_CLOSURES.find(c => c.id === currentReading.closureId) || SHAHDARA_SPLICE_CLOSURES[0];
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(closure.area);
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
