/**
 * Shahdara ISP - Field Technician Optical Fiber Cleaver Blade Wear, Rotary Position Indexing & Cleave Angle Analyzer
 * 
 * Provides FTTH linemen, splicer technicians, and field supervisors with real-time
 * circular diamond blade wear tracking, rotary index position management (1 to 16/24),
 * cleave end-face angle (theta) pass/fail assessment (ITU-T G.652.D, IEC 60793-2-50, Telcordia GR-765),
 * hackle/lip defect risk modeling, rotary dial SVG visualization, and WhatsApp field dispatch tickets.
 */

export const FIBER_CLEAVER_STORAGE_KEY = 'shahdara_fiber_cleaver_audits_v1';

export const CLEAVER_MODELS = {
  FUJIKURA_CT50: {
    id: 'FUJIKURA_CT50',
    brand: 'Fujikura',
    name: 'Fujikura CT-50 / CT-30 Precision Cleaver',
    totalPositions: 16,
    heightLevels: 3,
    cleavesPerPosition: 1250,
    totalBladeLife: 60000,
    typicalAngleDeg: 0.4,
    description: '16-position auto-rotating diamond blade with wireless Bluetooth linkage to 90S fusion splicer.'
  },
  SUMITOMO_FC6S: {
    id: 'SUMITOMO_FC6S',
    brand: 'Sumitomo',
    name: 'Sumitomo FC-6S / FC-8R Fiber Cleaver',
    totalPositions: 24,
    heightLevels: 3,
    cleavesPerPosition: 2000,
    totalBladeLife: 54000,
    typicalAngleDeg: 0.5,
    description: '24-position ultra-precision rotary wheel cleaver with auto-rotating fiber scrap collector.'
  },
  ILSINTECH_CI03: {
    id: 'ILSINTECH_CI03',
    brand: 'Ilsintech / Swift',
    name: 'Ilsintech Swift CI-03BT / CS-01 Cleaver',
    totalPositions: 16,
    heightLevels: 3,
    cleavesPerPosition: 1000,
    totalBladeLife: 48000,
    typicalAngleDeg: 0.45,
    description: '16-position single-action benchtop cleaver for drop cable and indoor buffer tubes.'
  },
  INNO_V7: {
    id: 'INNO_V7',
    brand: 'Inno Instrument',
    name: 'Inno Instrument V7 / V11 High-Precision Cleaver',
    totalPositions: 16,
    heightLevels: 3,
    cleavesPerPosition: 1500,
    totalBladeLife: 48000,
    typicalAngleDeg: 0.45,
    description: '16-position universal magnetic clamp cleaver with dual-action sliding carriage.'
  },
  GENERIC_FIELD_CLEAVER: {
    id: 'GENERIC_FIELD_CLEAVER',
    brand: 'Shahdara Local Standard',
    name: 'Standard Field Rotary Cleaver (12-Position)',
    totalPositions: 12,
    heightLevels: 2,
    cleavesPerPosition: 1000,
    totalBladeLife: 24000,
    typicalAngleDeg: 0.6,
    description: 'Economy 12-position field cleaver commonly deployed in Shahdara technician vehicle kits.'
  }
};

export const CLEAVE_DEFECT_TYPES = {
  PRISTINE: {
    id: 'PRISTINE',
    name: 'Pristine Mirror Cleave (No Defect)',
    severity: 'PASS',
    lossPenaltyDb: 0.02,
    color: '#10b981',
    description: 'Flat, planar, perpendicular mirror face with zero chips, mist, or hackle.'
  },
  ACCEPTABLE_SLANT: {
    id: 'ACCEPTABLE_SLANT',
    name: 'Slight Incline / Angular Bias (< 1.0°)',
    severity: 'PASS',
    lossPenaltyDb: 0.08,
    color: '#38bdf8',
    description: 'Minor angular deviation within standard fusion splicer alignment compensation range.'
  },
  HACKLE_CHIP: {
    id: 'HACKLE_CHIP',
    name: 'Hackle & Micro-Chipping (Blunt Blade)',
    severity: 'FAIL',
    lossPenaltyDb: 0.40,
    color: '#f59e0b',
    description: 'Rough, saw-toothed fracture zone caused by micro-chipped or worn diamond blade edge.'
  },
  LIP_BURR: {
    id: 'LIP_BURR',
    name: 'Protruding Lip / Burr (Shallow Score)',
    severity: 'FAIL',
    lossPenaltyDb: 0.55,
    color: '#ef4444',
    description: 'Overhanging glass ledge from insufficient scoring depth or worn anvil clamping pads.'
  },
  CORE_SHATTER: {
    id: 'CORE_SHATTER',
    name: 'Core Shatter / Spall (Blade Height Too High)',
    severity: 'CRITICAL',
    lossPenaltyDb: 1.20,
    color: '#dc2626',
    description: 'Violent glass implosion and jagged core blowout. Diamond blade height adjustment required!'
  }
};

export const CLEAVE_ANGLE_SPEC = {
  EXCELLENT_MAX_DEG: 0.5,
  ACCEPTABLE_MAX_DEG: 1.0,
  DEFECTIVE_MIN_DEG: 1.01,
  CRITICAL_MIN_DEG: 2.5
};

/**
 * Calculates rotary blade wear, cleave angle viability, splice penalty,
 * and next position rotation recommendations.
 */
export function calculateCleaverPositionDynamics(params = {}) {
  const modelId = params.modelId || 'FUJIKURA_CT50';
  const model = CLEAVER_MODELS[modelId] || CLEAVER_MODELS.FUJIKURA_CT50;

  const currentPosition = Math.max(1, Math.min(model.totalPositions, Number(params.currentPosition) || 1));
  const currentHeight = Math.max(1, Math.min(model.heightLevels, Number(params.currentHeight) || 1));
  const positionCleaves = Math.max(0, Number(params.positionCleaves) || 0);

  // Total cleaves defaults to prior positions completed + current position
  const estimatedPriorCleaves = (currentPosition - 1) * model.cleavesPerPosition;
  const totalCleaves = Math.max(positionCleaves, Number(params.totalCleaves) || (estimatedPriorCleaves + positionCleaves));

  const measuredCleaveAngle = Number.isFinite(Number(params.measuredCleaveAngle))
    ? Math.max(0.0, Number(Number(params.measuredCleaveAngle).toFixed(2)))
    : model.typicalAngleDeg;

  const defectKey = params.observedDefect || (measuredCleaveAngle <= 0.5 ? 'PRISTINE' : measuredCleaveAngle <= 1.0 ? 'ACCEPTABLE_SLANT' : 'HACKLE_CHIP');
  const defect = CLEAVE_DEFECT_TYPES[defectKey] || CLEAVE_DEFECT_TYPES.PRISTINE;

  // Position wear percentage
  const positionWearPct = Math.min(100, Number(((positionCleaves / model.cleavesPerPosition) * 100).toFixed(1)));
  const positionRemainingCleaves = Math.max(0, model.cleavesPerPosition - positionCleaves);

  // Total blade wear percentage
  const totalWearPct = Math.min(100, Number(((totalCleaves / model.totalBladeLife) * 100).toFixed(1)));
  const totalRemainingCleaves = Math.max(0, model.totalBladeLife - totalCleaves);

  // Empirical estimated fusion splice loss penalty (dB)
  const angleLossFactor = Number((0.05 + 0.15 * Math.pow(measuredCleaveAngle, 1.6)).toFixed(3));
  const estimatedSpliceLossDb = Number((angleLossFactor + defect.lossPenaltyDb).toFixed(2));

  // Cleave quality rating
  let cleaveQuality = 'OPTIMAL';
  let badgeColor = '#10b981';
  let spliceViability = 'READY_FOR_FUSION_SPLICE';

  if (measuredCleaveAngle > CLEAVE_ANGLE_SPEC.CRITICAL_MIN_DEG || defect.severity === 'CRITICAL') {
    cleaveQuality = 'CRITICAL_DEFECT';
    badgeColor = '#dc2626';
    spliceViability = 'REJECT_IMMEDIATE_RECLEAVE';
  } else if (measuredCleaveAngle > CLEAVE_ANGLE_SPEC.ACCEPTABLE_MAX_DEG || defect.severity === 'FAIL') {
    cleaveQuality = 'DEFECTIVE_OUT_OF_SPEC';
    badgeColor = '#ef4444';
    spliceViability = 'REJECT_RECLEAVE_REQUIRED';
  } else if (measuredCleaveAngle > CLEAVE_ANGLE_SPEC.EXCELLENT_MAX_DEG) {
    cleaveQuality = 'ACCEPTABLE';
    badgeColor = '#38bdf8';
    spliceViability = 'ACCEPTABLE_STANDARD_SPLICE';
  } else {
    cleaveQuality = 'PRISTINE_OPTIMAL';
    badgeColor = '#10b981';
    spliceViability = 'PREMIUM_LOW_LOSS_SPLICE';
  }

  // Next rotary position computation
  const nextPosition = (currentPosition % model.totalPositions) + 1;
  const isPositionExhausted = positionWearPct >= 95.0 || measuredCleaveAngle > 1.2;
  const isBladeHeightExhausted = currentPosition === model.totalPositions && isPositionExhausted;
  const isBladeTotalExhausted = totalWearPct >= 98.0;

  let recommendation = '';
  if (isBladeTotalExhausted) {
    recommendation = `REPLACE BLADE: Rotary diamond disc has reached end of design life (${totalCleaves}/${model.totalBladeLife} cleaves). Replace with OEM replacement blade.`;
  } else if (isBladeHeightExhausted) {
    if (currentHeight < model.heightLevels) {
      recommendation = `ADJUST HEIGHT: All ${model.totalPositions} positions used. Elevate blade carriage to Height Level ${currentHeight + 1} and return to Position 1.`;
    } else {
      recommendation = `REPLACE BLADE: All height levels and positions exhausted. Replace diamond blade assembly.`;
    }
  } else if (isPositionExhausted) {
    recommendation = `ROTATE BLADE: Position #${currentPosition} is worn (${positionWearPct}%). Loosen locking screw and rotate rotary wheel to Position #${nextPosition}.`;
  } else if (measuredCleaveAngle > 0.8) {
    recommendation = `INSPECT POSITION: Cleave angle elevated (${measuredCleaveAngle}°). Clean fiber clamp rubber pads with isopropyl alcohol (IPA). If angle persists, advance to Position #${nextPosition}.`;
  } else {
    recommendation = `POSITION OPTIMAL: Position #${currentPosition} has ${positionRemainingCleaves} cleaves remaining. Clean blade edge with cotton swab dipped in pure 99% IPA.`;
  }

  // Generate rotary disc slots telemetry for visual dial
  const dialPositions = [];
  for (let p = 1; p <= model.totalPositions; p++) {
    const isCurrent = p === currentPosition;
    let slotStatus = 'AVAILABLE';
    let slotWearPct = 0;

    if (isCurrent) {
      slotStatus = 'ACTIVE';
      slotWearPct = positionWearPct;
    } else if (p < currentPosition) {
      slotStatus = 'WORN';
      slotWearPct = 100;
    } else {
      slotStatus = 'FRESH';
      slotWearPct = 0;
    }

    dialPositions.push({
      position: p,
      isCurrent,
      status: slotStatus,
      wearPct: slotWearPct
    });
  }

  return {
    modelId: model.id,
    modelName: model.name,
    brand: model.brand,
    totalPositions: model.totalPositions,
    heightLevels: model.heightLevels,
    cleavesPerPosition: model.cleavesPerPosition,
    totalBladeLife: model.totalBladeLife,
    currentPosition,
    nextPosition,
    currentHeight,
    positionCleaves,
    positionWearPct,
    positionRemainingCleaves,
    totalCleaves,
    totalWearPct,
    totalRemainingCleaves,
    measuredCleaveAngle,
    observedDefectKey: defect.id,
    observedDefectName: defect.name,
    defectSeverity: defect.severity,
    estimatedSpliceLossDb,
    cleaveQuality,
    spliceViability,
    badgeColor,
    isPositionExhausted,
    recommendation,
    dialPositions
  };
}

/**
 * Calculates enriched cleaver audit metrics including technician & subscriber context.
 */
export function calculateCleaverAuditMetrics(state = {}, options = {}) {
  const dynamics = calculateCleaverPositionDynamics(options);

  const technicianName = options.technicianName || 'Shahdara Field Tech';
  const cleaverSerial = options.cleaverSerial || 'FJK-CT50-PK-8841';
  const targetSubscriber = options.targetSubscriber || 'General Field Splicing';
  const targetArea = options.targetArea || 'Shahdara Town';

  return {
    ...dynamics,
    technicianName,
    cleaverSerial,
    targetSubscriber,
    targetArea,
    timestamp: options.timestamp || new Date().toISOString()
  };
}

/**
 * Generates an SVG rotary blade visualizer showing the circular 16/24-position wheel,
 * active position index needle, slot wear segments, angle gauge, and SLA telemetry.
 */
export function renderCleaverDialSvg(metrics, options = {}) {
  const isCompact = Boolean(options.compact);
  const width = options.width || (isCompact ? 500 : 720);
  const height = options.height || (isCompact ? 260 : 380);

  const totalPos = metrics.totalPositions;
  const centerX = isCompact ? 130 : 190;
  const centerY = isCompact ? 130 : 180;
  const outerRadius = isCompact ? 100 : 135;
  const innerRadius = isCompact ? 60 : 85;

  // Build rotary blade teeth & numbered slots
  const slotsSvg = metrics.dialPositions.map((slot) => {
    const angleStep = (2 * Math.PI) / totalPos;
    // Angle in radians (start at top -PI/2)
    const angle = -Math.PI / 2 + (slot.position - 1) * angleStep;
    const nextAngle = angle + angleStep * 0.85;

    // Outer & inner arc coordinates
    const x1 = centerX + outerRadius * Math.cos(angle);
    const y1 = centerY + outerRadius * Math.sin(angle);
    const x2 = centerX + outerRadius * Math.cos(nextAngle);
    const y2 = centerY + outerRadius * Math.sin(nextAngle);

    const x3 = centerX + innerRadius * Math.cos(nextAngle);
    const y3 = centerY + innerRadius * Math.sin(nextAngle);
    const x4 = centerX + innerRadius * Math.cos(angle);
    const y4 = centerY + innerRadius * Math.sin(angle);

    // Midpoint for label
    const midAngle = (angle + nextAngle) / 2;
    const labelRadius = (outerRadius + innerRadius) / 2;
    const lx = centerX + labelRadius * Math.cos(midAngle);
    const ly = centerY + labelRadius * Math.sin(midAngle) + 4;

    let fillColor = '#334155';
    let strokeColor = '#475569';
    let textColor = '#cbd5e1';

    if (slot.isCurrent) {
      fillColor = metrics.positionWearPct >= 90 ? '#ef4444' : metrics.positionWearPct >= 70 ? '#f59e0b' : '#0284c7';
      strokeColor = '#38bdf8';
      textColor = '#ffffff';
    } else if (slot.status === 'WORN') {
      fillColor = '#475569';
      strokeColor = '#64748b';
      textColor = '#94a3b8';
    } else {
      fillColor = '#1e293b';
      strokeColor = '#334155';
      textColor = '#64748b';
    }

    const pathData = `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4} Z`;

    return `
      <g class="cleaver-slot ${slot.isCurrent ? 'active-slot' : ''}">
        <path d="${pathData}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${slot.isCurrent ? '2.5' : '1'}" />
        <text x="${lx}" y="${ly}" text-anchor="middle" font-size="${isCompact ? '9' : '11'}" font-weight="${slot.isCurrent ? '800' : '600'}" fill="${textColor}">
          ${slot.position}
        </text>
      </g>
    `;
  }).join('');

  // Cleave angle gauge calculations
  const angleBarX = isCompact ? 260 : 380;
  const angleBarY = isCompact ? 140 : 180;
  const angleBarWidth = isCompact ? 220 : 310;
  const maxDisplayAngle = 2.0;
  const angleNeedleX = angleBarX + Math.min(angleBarWidth, (metrics.measuredCleaveAngle / maxDisplayAngle) * angleBarWidth);

  return `
<svg class="cleaver-dial-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fiber Cleaver Rotary Blade Wear and Quality Gauge">
  <defs>
    <linearGradient id="cleaverBgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#090d16" />
      <stop offset="100%" stop-color="#141c2e" />
    </linearGradient>
    <linearGradient id="angleGaugeGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="25%" stop-color="#10b981" />
      <stop offset="50%" stop-color="#38bdf8" />
      <stop offset="75%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#ef4444" />
    </linearGradient>
  </defs>

  <!-- Background Canvas -->
  <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="url(#cleaverBgGrad)" stroke="#334155" stroke-width="1.5" />

  <!-- Title Header -->
  <text x="20" y="28" fill="#f8fafc" font-size="${isCompact ? '12' : '14'}" font-weight="800" font-family="system-ui, sans-serif">
    FIBER CLEAVER ROTARY BLADE WEAR &amp; ANGLE GAUGE
  </text>
  <text x="20" y="45" fill="#94a3b8" font-size="${isCompact ? '9' : '11'}">
    Model: ${metrics.modelName} · Blade Index ${metrics.currentPosition}/${metrics.totalPositions} (Height ${metrics.currentHeight}/${metrics.heightLevels})
  </text>

  <!-- Left: Circular Rotary Blade Wheel -->
  <g id="rotaryDiscGroup">
    <!-- Center Hub Outer Ring -->
    <circle cx="${centerX}" cy="${centerY}" r="${innerRadius}" fill="#0b1120" stroke="#38bdf8" stroke-width="1.5" />
    
    <!-- Slots -->
    ${slotsSvg}

    <!-- Center Hub Info -->
    <circle cx="${centerX}" cy="${centerY}" r="${innerRadius * 0.72}" fill="#0f172a" stroke="#64748b" stroke-width="1" />
    <text x="${centerX}" y="${centerY - 10}" text-anchor="middle" fill="#94a3b8" font-size="${isCompact ? '8' : '10'}" font-weight="700">POSITION</text>
    <text x="${centerX}" y="${centerY + 12}" text-anchor="middle" fill="#38bdf8" font-size="${isCompact ? '18' : '24'}" font-weight="900">#${metrics.currentPosition}</text>
    <text x="${centerX}" y="${centerY + 26}" text-anchor="middle" fill="${metrics.positionWearPct >= 90 ? '#ef4444' : '#10b981'}" font-size="${isCompact ? '9' : '11'}" font-weight="700">${metrics.positionWearPct}% Wear</text>
  </g>

  <!-- Right: Metrics HUD & Cleave Quality Gauge -->
  <g transform="translate(${angleBarX}, 60)">
    <!-- KPI Box 1: Cleave Angle -->
    <rect x="0" y="0" width="${(angleBarWidth - 10) / 2}" height="52" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1" />
    <text x="12" y="18" fill="#94a3b8" font-size="9" font-weight="700">MEASURED CLEAVE ANGLE</text>
    <text x="12" y="42" fill="${metrics.badgeColor}" font-size="18" font-weight="900">${metrics.measuredCleaveAngle}°</text>

    <!-- KPI Box 2: Splice Penalty -->
    <rect x="${(angleBarWidth + 10) / 2}" y="0" width="${(angleBarWidth - 10) / 2}" height="52" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1" />
    <text x="${(angleBarWidth + 10) / 2 + 12}" y="18" fill="#94a3b8" font-size="9" font-weight="700">EST. SPLICE LOSS PENALTY</text>
    <text x="${(angleBarWidth + 10) / 2 + 12}" y="42" fill="${metrics.estimatedSpliceLossDb > 0.2 ? '#ef4444' : '#10b981'}" font-size="18" font-weight="900">+${metrics.estimatedSpliceLossDb} dB</text>

    <!-- Cleave Angle Quality Bar Gauge -->
    <g transform="translate(0, 68)">
      <text x="0" y="0" fill="#cbd5e1" font-size="10" font-weight="700">CLEAVE ANGLE TOLERANCE (ITU-T G.652.D)</text>
      <rect x="0" y="8" width="${angleBarWidth}" height="14" rx="4" fill="url(#angleGaugeGrad)" />
      
      <!-- Indicator Needle -->
      <polygon points="${angleNeedleX - angleBarX - 5},5 ${angleNeedleX - angleBarX + 5},5 ${angleNeedleX - angleBarX},18" fill="#ffffff" stroke="#000000" stroke-width="1" />
      <line x1="${angleNeedleX - angleBarX}" y1="8" x2="${angleNeedleX - angleBarX}" y2="22" stroke="#ffffff" stroke-width="2" />

      <!-- Scale Markers -->
      <text x="0" y="34" fill="#10b981" font-size="8">0.0°</text>
      <text x="${angleBarWidth * 0.25}" y="34" fill="#10b981" font-size="8" text-anchor="middle">0.5° (Opt)</text>
      <text x="${angleBarWidth * 0.50}" y="34" fill="#38bdf8" font-size="8" text-anchor="middle">1.0° (Max)</text>
      <text x="${angleBarWidth * 0.75}" y="34" fill="#f59e0b" font-size="8" text-anchor="middle">1.5° (Recleave)</text>
      <text x="${angleBarWidth}" y="34" fill="#ef4444" font-size="8" text-anchor="end">2.0°+</text>
    </g>

    <!-- Blade Remaining Life Bar -->
    <g transform="translate(0, 118)">
      <text x="0" y="0" fill="#94a3b8" font-size="9" font-weight="700">POSITION CLEAVE LIFETIME (${metrics.positionCleaves} / ${metrics.cleavesPerPosition})</text>
      <rect x="0" y="6" width="${angleBarWidth}" height="10" rx="3" fill="#334155" />
      <rect x="0" y="6" width="${(angleBarWidth * metrics.positionWearPct) / 100}" height="10" rx="3" fill="${metrics.positionWearPct >= 90 ? '#ef4444' : metrics.positionWearPct >= 70 ? '#f59e0b' : '#10b981'}" />
      <text x="${angleBarWidth}" y="26" text-anchor="end" fill="#94a3b8" font-size="8">${metrics.positionRemainingCleaves} cleaves remaining</text>
    </g>
  </g>

  <!-- Bottom Recommendation & Verdict Banner -->
  <g transform="translate(20, ${height - 42})">
    <rect x="0" y="0" width="${width - 40}" height="30" rx="5" fill="${metrics.badgeColor}" fill-opacity="0.16" stroke="${metrics.badgeColor}" stroke-width="1.2" />
    <text x="${(width - 40) / 2}" y="19" text-anchor="middle" fill="${metrics.badgeColor}" font-size="${isCompact ? '10' : '11'}" font-weight="800">
      VERDICT: ${metrics.cleaveQuality} · ${metrics.spliceViability.replace(/_/g, ' ')}
    </text>
  </g>
</svg>
  `.trim();
}

/**
 * Generates structured text report for NOC briefings, splicing quality records,
 * and technician vehicle audit files.
 */
export function generateCleaverAuditReport(metrics, options = {}) {
  const dateStr = options.referenceDate || new Date().toISOString().slice(0, 10);

  return `
================================================================================
SHAHDARA ISP - OPTICAL FIBER CLEAVER BLADE WEAR & ANGLE AUDIT REPORT
Standards: ITU-T G.652.D / IEC 60793-2-50 / Telcordia GR-765
Generated: ${dateStr}
================================================================================

EQUIPMENT DETAILS:
• Cleaver Model:        ${metrics.modelName} (${metrics.brand})
• Serial Number:        ${metrics.cleaverSerial || 'N/A'}
• Field Technician:     ${metrics.technicianName || 'Shahdara Field Tech'}
• Target Area / Scope:  ${metrics.targetArea || 'Shahdara Town'} (Subs: ${metrics.targetSubscriber || 'General'})

BLADE ROTARY POSITION TELEMETRY:
• Active Rotary Index:  Position #${metrics.currentPosition} of ${metrics.totalPositions}
• Carriage Height:      Level ${metrics.currentHeight} of ${metrics.heightLevels}
• Position Cleaves:     ${metrics.positionCleaves} cleaves
• Position Wear Rate:   ${metrics.positionWearPct}% (${metrics.positionRemainingCleaves} cleaves left)
• Total Disc Life Used: ${metrics.totalCleaves} / ${metrics.totalBladeLife} cleaves (${metrics.totalWearPct}%)

CLEAVE END-FACE & ANGLE QUALITY:
• Measured Cleave Angle:${metrics.measuredCleaveAngle}° (Optimal: <= 0.5°, Reject: > 1.0°)
• Observed Defect:      ${metrics.observedDefectName} [${metrics.defectSeverity}]
• Est. Splice Penalty:  +${metrics.estimatedSpliceLossDb} dB
• Cleave Quality Grade: ${metrics.cleaveQuality}
• Splice Viability:     ${metrics.spliceViability.replace(/_/g, ' ')}

ENGINEERING RECOMMENDATION:
${metrics.recommendation}
================================================================================
`.trim();
}

/**
 * Generates concise WhatsApp dispatch ticket for linemen and field supervisors.
 */
export function generateCleaverWhatsAppDispatch(metrics) {
  const icon = metrics.defectSeverity === 'PASS' ? '✅' : metrics.defectSeverity === 'FAIL' ? '⚠️' : '🚨';

  return `*SHAHDARA ISP - FIBER CLEAVER AUDIT* ${icon}
📅 *Date:* ${new Date().toISOString().slice(0, 10)}
🔧 *Cleaver:* ${metrics.modelName} (S/N: ${metrics.cleaverSerial || 'FJK-CT50'})
👷 *Lineman:* ${metrics.technicianName || 'Field Tech'} | 📍 *Area:* ${metrics.targetArea || 'Shahdara'}

*BLADE WEAR STATUS:*
• Active Position: *#${metrics.currentPosition}* / ${metrics.totalPositions} (Height: H${metrics.currentHeight})
• Cleave Count: *${metrics.positionCleaves}* (${metrics.positionWearPct}% Worn)
• Position Runway: *${metrics.positionRemainingCleaves} cleaves left*
• Total Blade Life: *${metrics.totalWearPct}% used*

*END-FACE ANGLE & LOSS:*
• Cleave Angle: *${metrics.measuredCleaveAngle}°* [${metrics.cleaveQuality}]
• Defect Type: *${metrics.observedDefectName}*
• Est Splice Loss: *+${metrics.estimatedSpliceLossDb} dB*
• Splicer Verdict: *${metrics.spliceViability.replace(/_/g, ' ')}*

📋 *Action Required:*
${metrics.recommendation}`.trim();
}

/**
 * Loads persistent cleaver audits from localStorage.
 */
export function loadCleaverAuditLog(storageKey = FIBER_CLEAVER_STORAGE_KEY) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to load cleaver audit log:', err);
    return [];
  }
}

/**
 * Appends a new audit record into persistent localStorage.
 */
export function saveCleaverAuditLog(record, storageKey = FIBER_CLEAVER_STORAGE_KEY) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const existing = loadCleaverAuditLog(storageKey);
    const updated = [record, ...existing].slice(0, 50); // Keep last 50 audits
    localStorage.setItem(storageKey, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to save cleaver audit log:', err);
    return [];
  }
}

/**
 * Clears persistent cleaver audits from localStorage.
 */
export function clearCleaverAuditLog(storageKey = FIBER_CLEAVER_STORAGE_KEY) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(storageKey);
    }
  } catch (err) {
    console.warn('Failed to clear cleaver audit log:', err);
  }
}

/**
 * DOM Controller wiring the mobile cleaver modal dialog and event interactions.
 */
export function setupMobileCleaverModal(state = {}, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  const onToast = options.onToast || ((msg) => console.log(msg));

  if (!doc) return null;

  const modal = doc.getElementById('mobileCleaverModal');
  const closeBtn = doc.getElementById('mobileCleaverModalCloseBtn');
  const modelSelect = doc.getElementById('cleaverModelSelect');
  const positionSlider = doc.getElementById('cleaverPositionSlider');
  const positionLabel = doc.getElementById('cleaverPositionLabel');
  const heightSelect = doc.getElementById('cleaverHeightSelect');
  const cleavesCountInput = doc.getElementById('cleaverCountInput');
  const angleInput = doc.getElementById('cleaverAngleInput');
  const defectSelect = doc.getElementById('cleaverDefectSelect');
  const techNameInput = doc.getElementById('cleaverTechNameInput');
  const serialInput = doc.getElementById('cleaverSerialInput');
  const areaSelect = doc.getElementById('cleaverAreaSelect');

  const statPosition = doc.getElementById('cleaverStatPosition');
  const statWear = doc.getElementById('cleaverStatWear');
  const statAngle = doc.getElementById('cleaverStatAngle');
  const statPenalty = doc.getElementById('cleaverStatPenalty');
  const statVerdict = doc.getElementById('cleaverStatVerdict');

  const diagramContainer = doc.getElementById('cleaverModalDiagramContainer');
  const rotateNextBtn = doc.getElementById('cleaverRotateNextBtn');
  const resetPositionBtn = doc.getElementById('cleaverResetPositionBtn');
  const saveAuditBtn = doc.getElementById('cleaverSaveAuditBtn');
  const copyReportBtn = doc.getElementById('cleaverCopyReportBtn');
  const shareWhatsAppBtn = doc.getElementById('cleaverShareWhatsAppBtn');

  function getInputs() {
    return {
      modelId: modelSelect?.value || 'FUJIKURA_CT50',
      currentPosition: Number(positionSlider?.value) || 1,
      currentHeight: Number(heightSelect?.value) || 1,
      positionCleaves: Number(cleavesCountInput?.value) || 0,
      measuredCleaveAngle: Number(angleInput?.value) || 0.4,
      observedDefect: defectSelect?.value || 'PRISTINE',
      technicianName: techNameInput?.value || 'Shahdara Field Tech',
      cleaverSerial: serialInput?.value || 'FJK-CT50-PK-8841',
      targetArea: areaSelect?.value || 'Shahdara Town'
    };
  }

  function recalculate() {
    const params = getInputs();
    const metrics = calculateCleaverAuditMetrics(state, params);

    if (positionLabel) {
      positionLabel.textContent = `Position #${metrics.currentPosition} of ${metrics.totalPositions}`;
    }
    if (statPosition) {
      statPosition.textContent = `#${metrics.currentPosition} / ${metrics.totalPositions}`;
    }
    if (statWear) {
      statWear.textContent = `${metrics.positionWearPct}% (${metrics.positionRemainingCleaves} left)`;
      statWear.style.color = metrics.positionWearPct >= 90 ? '#ef4444' : metrics.positionWearPct >= 70 ? '#f59e0b' : '#10b981';
    }
    if (statAngle) {
      statAngle.textContent = `${metrics.measuredCleaveAngle}°`;
      statAngle.style.color = metrics.badgeColor;
    }
    if (statPenalty) {
      statPenalty.textContent = `+${metrics.estimatedSpliceLossDb} dB`;
      statPenalty.style.color = metrics.estimatedSpliceLossDb > 0.2 ? '#ef4444' : '#10b981';
    }
    if (statVerdict) {
      statVerdict.textContent = metrics.cleaveQuality;
      statVerdict.style.color = metrics.badgeColor;
    }

    if (diagramContainer) {
      diagramContainer.innerHTML = renderCleaverDialSvg(metrics, { compact: false });
    }

    return metrics;
  }

  // Model change adjusts position slider max
  if (modelSelect) {
    modelSelect.addEventListener('change', () => {
      const selectedModel = CLEAVER_MODELS[modelSelect.value] || CLEAVER_MODELS.FUJIKURA_CT50;
      if (positionSlider) {
        positionSlider.max = selectedModel.totalPositions;
        if (Number(positionSlider.value) > selectedModel.totalPositions) {
          positionSlider.value = 1;
        }
      }
      recalculate();
    });
  }

  [positionSlider, heightSelect, cleavesCountInput, angleInput, defectSelect, techNameInput, serialInput, areaSelect].forEach(input => {
    if (input) {
      input.addEventListener('input', recalculate);
      input.addEventListener('change', recalculate);
    }
  });

  // Action Buttons
  if (rotateNextBtn) {
    rotateNextBtn.addEventListener('click', () => {
      const metrics = recalculate();
      if (positionSlider) {
        positionSlider.value = metrics.nextPosition;
      }
      if (cleavesCountInput) {
        cleavesCountInput.value = 0;
      }
      onToast(`Rotated cleaver wheel to Position #${metrics.nextPosition}. Counter reset.`);
      recalculate();
    });
  }

  if (resetPositionBtn) {
    resetPositionBtn.addEventListener('click', () => {
      if (cleavesCountInput) cleavesCountInput.value = 0;
      if (angleInput) angleInput.value = 0.4;
      if (defectSelect) defectSelect.value = 'PRISTINE';
      onToast('Current position cleave count and angle reset to baseline.');
      recalculate();
    });
  }

  if (saveAuditBtn) {
    saveAuditBtn.addEventListener('click', () => {
      const metrics = recalculate();
      saveCleaverAuditLog(metrics);
      onToast(`Saved cleaver audit for Position #${metrics.currentPosition} to local audit register.`);
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const metrics = recalculate();
      const report = generateCleaverAuditReport(metrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(report).then(() => {
          onToast('Fiber Cleaver Engineering Audit Report copied to clipboard!');
        }).catch(() => {
          onToast('Failed to copy report to clipboard.');
        });
      } else {
        onToast('Clipboard API not available.');
      }
    });
  }

  if (shareWhatsAppBtn) {
    shareWhatsAppBtn.addEventListener('click', () => {
      const metrics = recalculate();
      const text = generateCleaverWhatsAppDispatch(metrics);
      const encoded = encodeURIComponent(text);
      const url = `https://wa.me/?text=${encoded}`;
      if (typeof window !== 'undefined' && typeof window.open === 'function') {
        window.open(url, '_blank');
      }
      onToast('Opening WhatsApp cleaver dispatch ticket...');
    });
  }

  // Open & Close
  const openButtons = doc.querySelectorAll('[data-open-fiber-cleaver], #mobileMoreCleaverBtn');
  openButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
      }
      recalculate();
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (modal) {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  return {
    open: () => {
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
      }
      recalculate();
    },
    close: () => {
      if (modal) {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    },
    recalculate
  };
}
