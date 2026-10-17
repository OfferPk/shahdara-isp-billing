/**
 * Shahdara ISP Billing & Network Operations - Optical Time-Domain Reflectometry (OTDR) Ghost Echo,
 * Multi-Path Reflection & Non-Linear Fiber Rayleigh Artifact Elimination QA Suite
 * Standards: ITU-T G.650.1, Telcordia GR-196-CORE Issue 2, IEC 61746-1, TIA-455-8
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const OTDR_GHOST_ARTIFACT_STORAGE_KEY = 'shahdara_otdr_ghost_artifact_certs_v1';

export const GHOST_OTDR_WAVELENGTHS = {
  'W1310': { id: 'W1310', name: '1310 nm (O-Band Standard)', attenuationDbKm: 0.35, rayleighFactor: 1.0 },
  'W1550': { id: 'W1550', name: '1550 nm (C-Band Low-Loss / Macro-Bend Sensitive)', attenuationDbKm: 0.20, rayleighFactor: 0.5 },
  'W1625': { id: 'W1625', name: '1625 nm (L-Band Out-of-Band Maintenance)', attenuationDbKm: 0.23, rayleighFactor: 0.45 }
};

export const ARTIFACT_CLASSIFICATIONS = {
  'GHOST_DOUBLE_BOUNCE': {
    id: 'GHOST_DOUBLE_BOUNCE',
    code: 'GHOST_2X',
    name: 'Ghost Echo (Source-to-Connector Double Bounce)',
    expectedStepLossDb: 0.00,
    isGhost: true,
    severity: 'WARNING',
    badgeClass: 'badge-warning',
    colorHex: '#f59e0b',
    description: 'False reflection at exactly 2× primary connector distance caused by internal cavity bounce with 0.00 dB step loss.'
  },
  'GHOST_CROSS_BOUNCE': {
    id: 'GHOST_CROSS_BOUNCE',
    code: 'GHOST_CROSS',
    name: 'Ghost Echo (Multi-Joint Cross Cavity Echo)',
    expectedStepLossDb: 0.00,
    isGhost: true,
    severity: 'WARNING',
    badgeClass: 'badge-warning',
    colorHex: '#f59e0b',
    description: 'False reflection at distance d = d1 + d2 formed between two reflective joints with zero true attenuation drop.'
  },
  'GENUINE_REFLECTIVE': {
    id: 'GENUINE_REFLECTIVE',
    code: 'GENUINE_EVENT',
    name: 'Genuine Physical Connector / Patchcord Event',
    expectedStepLossDb: 0.25,
    isGhost: false,
    severity: 'INFO',
    badgeClass: 'badge-pass-standard',
    colorHex: '#3b82f6',
    description: 'True physical optical joint with both reflective Fresnel peak and measurable step insertion loss (> 0.05 dB).'
  },
  'GENUINE_SPLICE': {
    id: 'GENUINE_SPLICE',
    code: 'GENUINE_SPLICE',
    name: 'Genuine Non-Reflective Fusion Splice Event',
    expectedStepLossDb: 0.05,
    isGhost: false,
    severity: 'INFO',
    badgeClass: 'badge-pass-certified',
    colorHex: '#10b981',
    description: 'Physical fusion joint showing pure step attenuation with zero reflective spike.'
  },
  'GENUINE_FIBER_BREAK': {
    id: 'GENUINE_FIBER_BREAK',
    code: 'FIBER_BREAK',
    name: 'Genuine Fiber Break / Demarcation End',
    expectedStepLossDb: 99.9,
    isGhost: false,
    severity: 'DANGER',
    badgeClass: 'badge-fail-rework',
    colorHex: '#ef4444',
    description: 'Terminal glass-to-air boundary or severed fiber drop resulting in total signal termination.'
  }
};

export const GHOST_QA_VERDICTS = {
  'VERIFIED_GHOST': {
    id: 'VERIFIED_GHOST',
    code: 'GHOST_CONFIRMED',
    label: 'Verified Ghost Artifact — Zero Step Loss (No Physical Fault)',
    badgeClass: 'badge-warning',
    statusClass: 'status-warning',
    colorHex: '#f59e0b',
    isGhostConfirmed: true,
    actionRequired: 'DO NOT DISPATCH DIG CREW',
    recommendationUrdu: 'جعلی ریفلیکشن (گھوسٹ) — آپٹیکل فائبر پر کوئی حقیقی کٹ یا فالٹ نہیں ہے',
    recommendation: 'Collinear trace with 0.00 dB step loss at 2× primary distance. Clean primary connector; cancel field excavation.'
  },
  'GENUINE_FAULT': {
    id: 'GENUINE_FAULT',
    code: 'REAL_FAULT',
    label: 'Genuine Physical Optical Event / Insertion Loss Verified',
    badgeClass: 'badge-pass-standard',
    statusClass: 'status-good',
    colorHex: '#10b981',
    isGhostConfirmed: false,
    actionRequired: 'DISPATCH SPLICING CREW',
    recommendationUrdu: 'حقیقی آپٹیکل ایونٹ — تصدیق شدہ فزیکل جوائنٹ یا نقصان',
    recommendation: 'True physical loss step confirmed on trace. Proceed with routine field termination or enclosure maintenance.'
  },
  'SUSPECT_AMBIGUOUS': {
    id: 'SUSPECT_AMBIGUOUS',
    code: 'SUSPECT_ECHO',
    label: 'Suspect Ambiguous Reflection — Dual-Wavelength Retest Recommended',
    badgeClass: 'badge-fail-rework',
    statusClass: 'status-danger',
    colorHex: '#ef4444',
    isGhostConfirmed: false,
    actionRequired: 'SWITCH WAVELENGTH TO 1625nm',
    recommendationUrdu: 'مشکوک ریفلیکشن — دوسری ویو لینتھ پر ٹریس چیک کریں',
    recommendation: 'Marginal step loss or partial distance correlation. Test at 1550nm/1625nm to confirm artifact suppression.'
  }
};

export const SHAH_OTDR_GHOST_PRESETS = {
  'PRESET_BARADARI_GHOST_2X': {
    id: 'PRESET_BARADARI_GHOST_2X',
    name: 'Baradari ODF Feeder — Double-Bounce Ghost Echo (4.20 km)',
    spanLengthKm: 12.5,
    primaryEventDistanceKm: 2.10,
    primaryReflectanceDb: -28.5,
    candidateEventDistanceKm: 4.20,
    candidateReflectanceDb: -42.0,
    candidateStepLossDb: 0.008,
    wavelengthId: 'W1310',
    technician: 'Kamran OTDR Specialist',
    location: 'Baradari ODF-01 to Jia Musa Ring Trunk',
    notes: 'Ghost echo at 4.20km matches 2x Baradari patch panel at 2.10km. Zero physical step loss.'
  },
  'PRESET_VANDALA_FAT_GHOST': {
    id: 'PRESET_VANDALA_FAT_GHOST',
    name: 'Vandala Road Drop — Open FAT Demarc Double Bounce (1.64 km)',
    spanLengthKm: 4.8,
    primaryEventDistanceKm: 0.82,
    primaryReflectanceDb: -22.0,
    candidateEventDistanceKm: 1.64,
    candidateReflectanceDb: -38.5,
    candidateStepLossDb: 0.012,
    wavelengthId: 'W1550',
    technician: 'Zahid Field Tech',
    location: 'Vandala Road FAT-06 Splitter Demarc',
    notes: 'Unterminated APC connector at 820m created double reflection at 1640m. Clean connector.'
  },
  'PRESET_JIA_MUSA_REAL_SPLICE': {
    id: 'PRESET_JIA_MUSA_REAL_SPLICE',
    name: 'Jia Musa Ring — Genuine Lossy Fusion Splice (3.50 km)',
    spanLengthKm: 8.5,
    primaryEventDistanceKm: 1.75,
    primaryReflectanceDb: -35.0,
    candidateEventDistanceKm: 3.50,
    candidateReflectanceDb: -58.0,
    candidateStepLossDb: 0.165,
    wavelengthId: 'W1310',
    technician: 'Umair Lead Splicer',
    location: 'Jia Musa Closure FST-04',
    notes: 'Candidate event has 0.165 dB step loss. Confirmed genuine physical joint, NOT a ghost.'
  },
  'PRESET_BEGUM_KOT_TRIPLE_ECHO': {
    id: 'PRESET_BEGUM_KOT_TRIPLE_ECHO',
    name: 'Begum Kot Aerial — Multi-Cavity Ghost Echo (5.10 km)',
    spanLengthKm: 9.0,
    primaryEventDistanceKm: 1.70,
    primaryReflectanceDb: -21.5,
    candidateEventDistanceKm: 5.10,
    candidateReflectanceDb: -48.2,
    candidateStepLossDb: 0.005,
    wavelengthId: 'W1550',
    technician: 'Rashid Maintenance Tech',
    location: 'Begum Kot Pole #28 Joint',
    notes: 'Triple bounce echo (3x 1.70km = 5.10km) from dirty UPC jumper at OLT.'
  },
  'PRESET_RAVI_SIPHON_BREAK': {
    id: 'PRESET_RAVI_SIPHON_BREAK',
    name: 'Ravi Siphon Crossing — Genuine Far-End Cut Break (7.80 km)',
    spanLengthKm: 14.0,
    primaryEventDistanceKm: 3.90,
    primaryReflectanceDb: -32.0,
    candidateEventDistanceKm: 7.80,
    candidateReflectanceDb: -14.2,
    candidateStepLossDb: 25.0,
    wavelengthId: 'W1310',
    technician: 'Emergency Night Team',
    location: 'Ravi Siphon Manhole #03',
    notes: 'Severe Fresnel peak with infinite loss step. Physical fiber cut confirmed.'
  }
};

/**
 * Calculates theoretical double bounce and multi-cavity ghost reflection coordinates
 */
export function calculateGhostDistanceMatches(primaryDistanceKm, candidateDistanceKm) {
  const d1 = Math.max(0.01, Number(primaryDistanceKm) || 0);
  const dc = Math.max(0.01, Number(candidateDistanceKm) || 0);

  const doubleBounceKm = d1 * 2.0;
  const tripleBounceKm = d1 * 3.0;

  const doubleDiffKm = Math.abs(dc - doubleBounceKm);
  const tripleDiffKm = Math.abs(dc - tripleBounceKm);

  const isDoubleMatch = doubleDiffKm <= 0.08;
  const isTripleMatch = tripleDiffKm <= 0.12;

  const ratio = Math.round((dc / d1) * 100) / 100;

  return {
    primaryDistanceKm: d1,
    candidateDistanceKm: dc,
    doubleBounceKm: Math.round(doubleBounceKm * 1000) / 1000,
    tripleBounceKm: Math.round(tripleBounceKm * 1000) / 1000,
    doubleDiffKm: Math.round(doubleDiffKm * 1000) / 1000,
    tripleDiffKm: Math.round(tripleDiffKm * 1000) / 1000,
    ratio,
    isDistanceCorrelated: isDoubleMatch || isTripleMatch,
    matchType: isDoubleMatch ? 'DOUBLE_BOUNCE_2X' : isTripleMatch ? 'TRIPLE_BOUNCE_3X' : 'NONE'
  };
}

/**
 * Evaluates candidate event against metrological OTDR Ghost criteria
 */
export function evaluateOtdrGhostArtifact({
  spanLengthKm = 10.0,
  primaryEventDistanceKm = 2.0,
  primaryReflectanceDb = -28.0,
  candidateEventDistanceKm = 4.0,
  candidateReflectanceDb = -42.0,
  candidateStepLossDb = 0.01,
  wavelengthId = 'W1310'
}) {
  const wavelength = GHOST_OTDR_WAVELENGTHS[wavelengthId] || GHOST_OTDR_WAVELENGTHS['W1310'];
  const distMatches = calculateGhostDistanceMatches(primaryEventDistanceKm, candidateEventDistanceKm);
  const stepLoss = Math.max(0, Number(candidateStepLossDb) || 0);

  // Ghost Rule: Step loss must be near zero (< 0.035 dB) and distance must correlate with primary event
  const isCollinearZeroLoss = stepLoss <= 0.035;
  const isHighReflectanceOrigin = primaryReflectanceDb >= -35.0; // Poor reflectance causes strong bounce

  let verdictKey = 'GENUINE_FAULT';

  if (distMatches.isDistanceCorrelated && isCollinearZeroLoss) {
    verdictKey = 'VERIFIED_GHOST';
  } else if (distMatches.isDistanceCorrelated && stepLoss <= 0.08) {
    verdictKey = 'SUSPECT_AMBIGUOUS';
  } else {
    verdictKey = 'GENUINE_FAULT';
  }

  const verdict = GHOST_QA_VERDICTS[verdictKey];

  // Secondary cavity bounce reflectance attenuation model: R_ghost ≈ R_primary + 10*log10(Rayleigh/Reflection) - 2*alpha*d
  const theoreticalGhostReflectanceDb = Math.round((primaryReflectanceDb - (2 * wavelength.attenuationDbKm * primaryEventDistanceKm) - 12.0) * 10) / 10;

  return {
    spanLengthKm: Number(spanLengthKm),
    primaryEventDistanceKm: distMatches.primaryDistanceKm,
    primaryReflectanceDb: Number(primaryReflectanceDb),
    candidateEventDistanceKm: distMatches.candidateDistanceKm,
    candidateReflectanceDb: Number(candidateReflectanceDb),
    candidateStepLossDb: stepLoss,
    theoreticalGhostReflectanceDb,
    wavelength,
    distMatches,
    isCollinearZeroLoss,
    isHighReflectanceOrigin,
    verdict,
    isGhostConfirmed: verdict.isGhostConfirmed,
    cancelTruckRoll: verdict.isGhostConfirmed,
    dispatchSplicer: !verdict.isGhostConfirmed && stepLoss >= 0.05
  };
}

/**
 * Pure vector SVG renderer for OTDR Backscatter Trace with Ghost Artifact Callout
 */
export function renderOtdrGhostArtifactSvg(analysis) {
  const {
    spanLengthKm,
    primaryEventDistanceKm,
    candidateEventDistanceKm,
    candidateStepLossDb,
    distMatches,
    verdict
  } = analysis;

  const width = 800;
  const height = 440;

  // Coordinate mappings
  const plotLeft = 70;
  const plotRight = 750;
  const plotTop = 65;
  const plotBottom = 320;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  const maxKm = Math.max(spanLengthKm, candidateEventDistanceKm * 1.25, 5.0);
  const getX = (km) => plotLeft + ((km / maxKm) * plotWidth);

  // Attenuation slope (0.35 dB/km)
  const getY = (km, baseDb = 5) => {
    const db = baseDb + (km * 0.35);
    const maxDb = baseDb + (maxKm * 0.35) + 10;
    return plotTop + 40 + ((db / maxDb) * (plotHeight - 70));
  };

  const x0 = getX(0);
  const y0 = getY(0);
  const xPrim = getX(primaryEventDistanceKm);
  const yPrim = getY(primaryEventDistanceKm);
  const xCand = getX(candidateEventDistanceKm);
  const yCand = getY(candidateEventDistanceKm);
  const xEnd = getX(spanLengthKm);
  const yEnd = getY(spanLengthKm);

  // SVG Paths
  const primarySpikeY = Math.max(plotTop + 15, yPrim - 70);
  const candSpikeY = Math.max(plotTop + 25, yCand - 55);

  const ghostRayArc = `
    M ${xPrim} ${yPrim} 
    A ${Math.abs(xCand - xPrim) / 1.8} 60 0 0 1 ${xCand} ${yCand}
  `;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="otdr-ghost-svg" width="100%" height="auto" role="img" aria-label="OTDR Ghost Echo Elimination Diagram">
      <defs>
        <linearGradient id="traceGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#0284c7"/>
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${width}" height="${height}" rx="12" fill="#0b1120" stroke="#1e293b" stroke-width="1.5"/>

      <!-- Header Banner -->
      <rect x="0" y="0" width="${width}" height="42" fill="#0f172a" rx="12 12 0 0"/>
      <text x="24" y="26" fill="#f8fafc" font-size="13" font-weight="700" letter-spacing="0.5">OTDR GHOST ECHO ARTIFACT &amp; MULTI-PATH REFLECTION METROLOGY</text>
      <text x="${width - 24}" y="26" text-anchor="end" fill="#94a3b8" font-size="11">TELCORDIA GR-196-CORE / ITU-T G.650.1</text>

      <!-- Grid & Axes -->
      <rect x="${plotLeft}" y="${plotTop}" width="${plotWidth}" height="${plotHeight}" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
      
      <!-- Horizontal Backscatter Grid Lines -->
      <line x1="${plotLeft}" y1="${plotTop + 60}" x2="${plotRight}" y2="${plotTop + 60}" stroke="#1e293b" stroke-width="1" stroke-dasharray="3,3"/>
      <line x1="${plotLeft}" y1="${plotTop + 130}" x2="${plotRight}" y2="${plotTop + 130}" stroke="#1e293b" stroke-width="1" stroke-dasharray="3,3"/>
      <line x1="${plotLeft}" y1="${plotTop + 200}" x2="${plotRight}" y2="${plotTop + 200}" stroke="#1e293b" stroke-width="1" stroke-dasharray="3,3"/>

      <!-- Y Axis Label -->
      <text x="20" y="${plotTop + 130}" fill="#94a3b8" font-size="10" font-weight="600" transform="rotate(-90 20 ${plotTop + 130})" text-anchor="middle">BACKSCATTER LEVEL (dB)</text>

      <!-- X Axis Distance Grid & Labels -->
      <text x="${x0}" y="${plotBottom + 16}" fill="#64748b" font-size="10" text-anchor="middle">0 km</text>
      <text x="${xPrim}" y="${plotBottom + 16}" fill="#38bdf8" font-size="10" text-anchor="middle">${primaryEventDistanceKm.toFixed(2)} km</text>
      <text x="${xCand}" y="${plotBottom + 16}" fill="${verdict.colorHex}" font-size="10" text-anchor="middle">${candidateEventDistanceKm.toFixed(2)} km</text>
      <text x="${xEnd}" y="${plotBottom + 16}" fill="#64748b" font-size="10" text-anchor="middle">${spanLengthKm.toFixed(1)} km</text>
      <text x="${(plotLeft + plotRight) / 2}" y="${plotBottom + 32}" fill="#94a3b8" font-size="10" font-weight="600" text-anchor="middle">FIBER SPAN DISTANCE (km)</text>

      <!-- Double Bounce Ray Arc -->
      <path d="${ghostRayArc}" fill="none" stroke="${verdict.colorHex}" stroke-width="2" stroke-dasharray="4,4" opacity="0.8"/>
      <text x="${(xPrim + xCand) / 2}" y="${yPrim - 45}" fill="${verdict.colorHex}" font-size="10" font-weight="700" text-anchor="middle">2× Cavity Bounce Ray (d = ${distMatches.ratio}×)</text>

      <!-- Main OTDR Rayleigh Trace -->
      <!-- Segment 1: Origin to Primary Event -->
      <line x1="${x0}" y1="${y0}" x2="${xPrim}" y2="${yPrim}" stroke="url(#traceGrad)" stroke-width="2.5"/>

      <!-- Primary Reflective Spike -->
      <line x1="${xPrim}" y1="${yPrim}" x2="${xPrim}" y2="${primarySpikeY}" stroke="#38bdf8" stroke-width="2.5"/>
      <line x1="${xPrim}" y1="${primarySpikeY}" x2="${xPrim + 4}" y2="${yPrim + 4}" stroke="#38bdf8" stroke-width="2.5"/>
      <circle cx="${xPrim}" cy="${primarySpikeY}" r="4" fill="#38bdf8"/>
      <text x="${xPrim}" y="${primarySpikeY - 8}" fill="#38bdf8" font-size="10" font-weight="700" text-anchor="middle">Primary Joint</text>

      <!-- Segment 2: Primary to Candidate Event -->
      <line x1="${xPrim + 4}" y1="${yPrim + 4}" x2="${xCand}" y2="${yCand}" stroke="url(#traceGrad)" stroke-width="2.5"/>

      <!-- Candidate Spike (Ghost or Genuine) -->
      <line x1="${xCand}" y1="${yCand}" x2="${xCand}" y2="${candSpikeY}" stroke="${verdict.colorHex}" stroke-width="3"/>
      <line x1="${xCand}" y1="${candSpikeY}" x2="${xCand + 4}" y2="${yCand + (candidateStepLossDb * 20)}" stroke="${verdict.colorHex}" stroke-width="3"/>
      <circle cx="${xCand}" cy="${candSpikeY}" r="5" fill="${verdict.colorHex}"/>
      <text x="${xCand}" y="${candSpikeY - 8}" fill="${verdict.colorHex}" font-size="11" font-weight="800" text-anchor="middle">
        ${verdict.isGhostConfirmed ? '⚠️ GHOST ECHO (0.00 dB)' : 'GENUINE EVENT'}
      </text>

      <!-- Segment 3: Candidate to End -->
      <line x1="${xCand + 4}" y1="${yCand + (candidateStepLossDb * 20)}" x2="${xEnd}" y2="${yEnd}" stroke="url(#traceGrad)" stroke-width="2.5"/>

      <!-- Terminal Noise Floor Drop -->
      <line x1="${xEnd}" y1="${yEnd}" x2="${xEnd}" y2="${plotBottom - 10}" stroke="#64748b" stroke-width="2"/>
      <text x="${xEnd}" y="${yEnd - 10}" fill="#94a3b8" font-size="10" text-anchor="middle">End of Fiber</text>

      <!-- Collinear Zero-Loss Callout Box -->
      <g transform="translate(${xCand + 15}, ${yCand - 20})">
        <rect width="135" height="42" rx="4" fill="#1e293b" stroke="${verdict.colorHex}" stroke-width="1"/>
        <text x="8" y="16" fill="#f8fafc" font-size="10" font-weight="700">Step Loss: ${candidateStepLossDb.toFixed(3)} dB</text>
        <text x="8" y="32" fill="${candidateStepLossDb <= 0.035 ? '#10b981' : '#f59e0b'}" font-size="9">
          ${candidateStepLossDb <= 0.035 ? 'Collinear Flat Baseline' : 'Physical Step Drop'}
        </text>
      </g>

      <!-- BOTTOM TELEMETRY RIBBON -->
      <g transform="translate(24, 355)">
        <rect width="752" height="65" rx="8" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>

        <!-- Metric 1: Distance Correlation -->
        <g transform="translate(20, 14)">
          <text x="0" y="12" fill="#94a3b8" font-size="10" font-weight="600">DISTANCE RATIO</text>
          <text x="0" y="32" fill="#f8fafc" font-size="16" font-weight="800">${distMatches.ratio}× (${distMatches.matchType})</text>
        </g>

        <!-- Metric 2: Collinear Step Loss -->
        <g transform="translate(210, 14)">
          <text x="0" y="12" fill="#94a3b8" font-size="10" font-weight="600">MEASURED STEP LOSS</text>
          <text x="0" y="32" fill="${candidateStepLossDb <= 0.035 ? '#10b981' : '#f59e0b'}" font-size="16" font-weight="800">
            ${candidateStepLossDb.toFixed(3)} dB
          </text>
        </g>

        <!-- Metric 3: Action Guideline -->
        <g transform="translate(390, 14)">
          <text x="0" y="12" fill="#94a3b8" font-size="10" font-weight="600">CREW ACTION</text>
          <text x="0" y="32" fill="${verdict.colorHex}" font-size="14" font-weight="800">${verdict.actionRequired}</text>
        </g>

        <!-- Metric 4: Verdict Status -->
        <g transform="translate(580, 14)">
          <text x="0" y="12" fill="#94a3b8" font-size="10" font-weight="600">QA VERDICT</text>
          <rect x="0" y="18" width="150" height="24" rx="4" fill="${verdict.colorHex}" opacity="0.2"/>
          <text x="6" y="34" fill="${verdict.colorHex}" font-size="11" font-weight="800">${verdict.code}</text>
        </g>
      </g>
    </svg>
  `;
}

/**
 * Validates input parameters for OTDR Ghost Artifact Analysis
 */
export function validateOtdrGhostInput({
  spanLengthKm,
  primaryEventDistanceKm,
  candidateEventDistanceKm,
  candidateStepLossDb
}) {
  const errors = [];

  const span = Number(spanLengthKm);
  if (isNaN(span) || span <= 0 || span > 200) {
    errors.push('Fiber span length must be between 0.1 km and 200.0 km.');
  }

  const pDist = Number(primaryEventDistanceKm);
  if (isNaN(pDist) || pDist <= 0 || (span && pDist > span)) {
    errors.push('Primary reflection distance must be greater than 0 and less than total span length.');
  }

  const cDist = Number(candidateEventDistanceKm);
  if (isNaN(cDist) || cDist <= 0 || (span && cDist > span)) {
    errors.push('Candidate event distance must be greater than 0 and within total span length.');
  }

  const loss = Number(candidateStepLossDb);
  if (isNaN(loss) || loss < 0 || loss > 50) {
    errors.push('Candidate step loss must be a non-negative number in dB.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Builds an immutable, sequentially identified OTDR Ghost QA Certificate record
 */
export function buildOtdrGhostRecord({
  customer,
  spanLengthKm = 10.0,
  primaryEventDistanceKm = 2.0,
  primaryReflectanceDb = -28.0,
  candidateEventDistanceKm = 4.0,
  candidateReflectanceDb = -42.0,
  candidateStepLossDb = 0.01,
  wavelengthId = 'W1310',
  technicianName = 'Certified Specialist',
  location = 'Outside Plant Trunk',
  notes = '',
  timestamp = null
}) {
  const now = timestamp ? new Date(timestamp) : new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const certId = `GHO-${yearMonth}-${randomSuffix}`;

  const analysis = evaluateOtdrGhostArtifact({
    spanLengthKm,
    primaryEventDistanceKm,
    primaryReflectanceDb,
    candidateEventDistanceKm,
    candidateReflectanceDb,
    candidateStepLossDb,
    wavelengthId
  });

  return {
    id: certId,
    timestamp: now.toISOString(),
    dateStr: now.toISOString().slice(0, 10),
    customerId: customer?.id || null,
    customerName: customer?.name || 'Shahdara Trunk Route',
    customerMohalla: customer?.mohalla || customer?.zone || 'Shahdara OSP',
    customerPhone: customer?.phone || '—',
    spanLengthKm: Number(spanLengthKm),
    primaryEventDistanceKm: Number(primaryEventDistanceKm),
    primaryReflectanceDb: Number(primaryReflectanceDb),
    candidateEventDistanceKm: Number(candidateEventDistanceKm),
    candidateReflectanceDb: Number(candidateReflectanceDb),
    candidateStepLossDb: Number(candidateStepLossDb),
    wavelengthId,
    wavelengthName: analysis.wavelength.name,
    distanceRatio: analysis.distMatches.ratio,
    matchType: analysis.distMatches.matchType,
    verdictCode: analysis.verdict.code,
    verdictLabel: analysis.verdict.label,
    isGhostConfirmed: analysis.isGhostConfirmed,
    cancelTruckRoll: analysis.cancelTruckRoll,
    technicianName: technicianName || 'Certified Lead Splicer',
    location: location || 'OSP Enclosure',
    notes: notes || ''
  };
}

/**
 * LocalStorage management for OTDR Ghost Certificates
 */
export function getSavedOtdrGhostCerts(storage = null) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return [];
    const raw = store.getItem(OTDR_GHOST_ARTIFACT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load saved OTDR ghost certs:', err);
    return [];
  }
}

export function saveOtdrGhostCert(record, storage = null) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store || !record || !record.id) return false;
    const existing = getSavedOtdrGhostCerts(store);
    const updated = [record, ...existing.filter(r => r.id !== record.id)].slice(0, 100);
    store.setItem(OTDR_GHOST_ARTIFACT_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (err) {
    console.error('Failed to save OTDR ghost cert:', err);
    return false;
  }
}

export function clearOtdrGhostCerts(storage = null) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return false;
    store.removeItem(OTDR_GHOST_ARTIFACT_STORAGE_KEY);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Aggregates summary KPI metrics across saved OTDR Ghost certificates
 */
export function calculateOtdrGhostMetrics(records = []) {
  const total = records.length;
  if (!total) {
    return {
      totalCertificates: 0,
      ghostConfirmedCount: 0,
      genuineFaultCount: 0,
      truckRollsCancelledCount: 0,
      ghostPercentage: 0
    };
  }

  let ghosts = 0;
  let genuine = 0;
  let cancelled = 0;

  records.forEach(r => {
    if (r.isGhostConfirmed) ghosts++;
    else genuine++;
    if (r.cancelTruckRoll) cancelled++;
  });

  return {
    totalCertificates: total,
    ghostConfirmedCount: ghosts,
    genuineFaultCount: genuine,
    truckRollsCancelledCount: cancelled,
    ghostPercentage: Math.round((ghosts / total) * 100)
  };
}

/**
 * Generates dual printable documents: Formal A4 Certificate & 80mm POS Slip
 */
export function generateOtdrGhostArtifactCertHtml(record, { format = 'A4' } = {}) {
  const isPos = format.toUpperCase() === 'POS';

  if (isPos) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>OTDR Ghost Slip - ${escapeHtml(record.id)}</title>
        <style>
          @page { size: 80mm auto; margin: 3mm; }
          body {
            font-family: 'Courier New', monospace;
            width: 74mm;
            margin: 0 auto;
            font-size: 11px;
            color: #000;
            line-height: 1.25;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .verdict-box {
            border: 1px solid #000;
            padding: 4px;
            text-align: center;
            font-weight: bold;
            margin: 6px 0;
          }
        </style>
      </head>
      <body>
        <div class="center bold">SHAHDARA FIBER NETWORK</div>
        <div class="center">OTDR GHOST ECHO AUDIT SLIP</div>
        <div class="center">Telcordia GR-196-CORE / ITU-T G.650.1</div>
        <div class="divider"></div>
        <div class="row"><span>CERT ID:</span><span class="bold">${escapeHtml(record.id)}</span></div>
        <div class="row"><span>DATE:</span><span>${escapeHtml(record.dateStr)}</span></div>
        <div class="row"><span>TECH:</span><span>${escapeHtml(record.technicianName)}</span></div>
        <div class="row"><span>SPAN:</span><span>${record.spanLengthKm} km (${escapeHtml(record.wavelengthName)})</span></div>
        <div class="divider"></div>
        <div class="row"><span>PRIMARY EVENT:</span><span>${record.primaryEventDistanceKm.toFixed(2)} km (${record.primaryReflectanceDb} dB)</span></div>
        <div class="row"><span>CANDIDATE EVENT:</span><span class="bold">${record.candidateEventDistanceKm.toFixed(2)} km</span></div>
        <div class="row"><span>DISTANCE RATIO:</span><span>${record.distanceRatio}x (${record.matchType})</span></div>
        <div class="row"><span>STEP LOSS:</span><span class="bold">${record.candidateStepLossDb.toFixed(3)} dB</span></div>
        <div class="divider"></div>
        <div class="verdict-box">
          ${escapeHtml(record.verdictLabel)}<br>
          ${record.cancelTruckRoll ? 'CANCEL FIELD EXCAVATION (GHOST)' : 'PROCEED WITH PHYSICAL DISPATCH'}
        </div>
        <div class="center" style="font-size: 9px; margin-top: 6px;">
          Shahdara ISP Network Operations Center<br>
          Verification Hotline: 042-37920000
        </div>
      </body>
      </html>
    `;
  }

  // Formal A4 Certificate
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>OTDR Ghost Echo Elimination Certificate - ${escapeHtml(record.id)}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          color: #1e293b;
          line-height: 1.5;
          margin: 0;
          padding: 10px;
        }
        .cert-border {
          border: 3px double #0284c7;
          border-radius: 8px;
          padding: 24px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #0284c7;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .title h1 {
          margin: 0;
          font-size: 20px;
          color: #0369a1;
          letter-spacing: 0.5px;
        }
        .title p {
          margin: 2px 0 0;
          font-size: 11px;
          color: #64748b;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        .data-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 12px;
        }
        .data-card h3 {
          margin: 0 0 8px;
          font-size: 12px;
          color: #0369a1;
          text-transform: uppercase;
        }
        .data-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          margin-bottom: 4px;
          border-bottom: 1px dashed #e2e8f0;
          padding-bottom: 2px;
        }
        .verdict-banner {
          background: ${record.isGhostConfirmed ? '#fffbeb' : '#f0fdf4'};
          border: 2px solid ${record.isGhostConfirmed ? '#f59e0b' : '#10b981'};
          border-radius: 6px;
          padding: 14px;
          text-align: center;
          margin: 20px 0;
        }
        .verdict-banner h2 {
          margin: 0;
          font-size: 16px;
          color: ${record.isGhostConfirmed ? '#92400e' : '#166534'};
        }
        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 36px;
          padding-top: 12px;
          border-top: 1px solid #cbd5e1;
        }
        .sig-box {
          width: 40%;
          text-align: center;
          font-size: 11px;
        }
        .sig-line {
          border-bottom: 1px solid #475569;
          margin-bottom: 6px;
          height: 30px;
        }
      </style>
    </head>
    <body>
      <div class="cert-border">
        <div class="header">
          <div class="title">
            <h1>SHAHDARA OPTICAL NETWORK METROLOGY LABORATORY</h1>
            <p>OTDR Ghost Echo, Multi-Path Reflection &amp; Rayleigh Artifact Audit Certificate</p>
            <p>Reference Standards: Telcordia GR-196-CORE Issue 2 | ITU-T G.650.1 | IEC 61746-1</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px; font-weight: bold; color: #0284c7;">${escapeHtml(record.id)}</div>
            <div style="font-size: 11px; color: #64748b;">Date: ${escapeHtml(record.dateStr)}</div>
          </div>
        </div>

        <div class="grid-2">
          <div class="data-card">
            <h3>Route &amp; Optical Span Metadata</h3>
            <div class="data-row"><span>Customer / Route:</span><span style="font-weight: 600;">${escapeHtml(record.customerName)}</span></div>
            <div class="data-row"><span>Area / Mohalla:</span><span>${escapeHtml(record.customerMohalla)}</span></div>
            <div class="data-row"><span>Location:</span><span>${escapeHtml(record.location)}</span></div>
            <div class="data-row"><span>Span Length:</span><span>${record.spanLengthKm} km</span></div>
            <div class="data-row"><span>Test Wavelength:</span><span>${escapeHtml(record.wavelengthName)}</span></div>
          </div>

          <div class="data-card">
            <h3>Reflection Origin &amp; Candidate Event</h3>
            <div class="data-row"><span>Primary Reflective Event:</span><span style="font-weight: 600;">${record.primaryEventDistanceKm.toFixed(2)} km</span></div>
            <div class="data-row"><span>Primary Reflectance:</span><span>${record.primaryReflectanceDb} dB</span></div>
            <div class="data-row"><span>Candidate Event Location:</span><span style="font-weight: 600;">${record.candidateEventDistanceKm.toFixed(2)} km</span></div>
            <div class="data-row"><span>Candidate Reflectance:</span><span>${record.candidateReflectanceDb} dB</span></div>
            <div class="data-row"><span>Distance Matching Ratio:</span><span>${record.distanceRatio}x (${record.matchType})</span></div>
          </div>
        </div>

        <div class="grid-2">
          <div class="data-card">
            <h3>Collinear Step-Loss Metrology</h3>
            <div class="data-row"><span>Measured Event Step Loss:</span><span style="font-weight: bold; color: ${record.candidateStepLossDb <= 0.035 ? '#059669' : '#dc2626'};">${record.candidateStepLossDb.toFixed(3)} dB</span></div>
            <div class="data-row"><span>Collinear Baseline Status:</span><span>${record.candidateStepLossDb <= 0.035 ? 'Zero Step Drop (Collinear Trace)' : 'Significant Physical Step Loss'}</span></div>
            <div class="data-row"><span>Multi-Path Cavity Correlation:</span><span>${record.isGhostConfirmed ? 'High Double-Bounce Correlation' : 'Physical Discontinuity'}</span></div>
          </div>

          <div class="data-card">
            <h3>Outside Plant Field Decision</h3>
            <div class="data-row"><span>Artifact Classification:</span><span style="font-weight: bold;">${record.isGhostConfirmed ? 'FALSE ALARM (GHOST ECHO)' : 'GENUINE PHYSICAL FAULT'}</span></div>
            <div class="data-row"><span>Field Excavation / Truck Roll:</span><span style="font-weight: 600; color: ${record.cancelTruckRoll ? '#d97706' : '#059669'};">${record.cancelTruckRoll ? 'CANCELLED (No Digging Needed)' : 'APPROVED (Splicer Dispatched)'}</span></div>
            <div class="data-row"><span>Recommended Remediation:</span><span>${record.isGhostConfirmed ? 'Clean / polish primary connector' : 'Repair lossy optical splice'}</span></div>
            <div class="data-row"><span>Specialist Notes:</span><span>${escapeHtml(record.notes || 'Routine OTDR metrology verification.')}</span></div>
          </div>
        </div>

        <div class="verdict-banner">
          <h2>${escapeHtml(record.verdictLabel)}</h2>
          <p style="margin: 4px 0 0; font-size: 12px; color: ${record.isGhostConfirmed ? '#92400e' : '#166534'};">
            ${record.isGhostConfirmed
              ? 'Candidate reflective peak confirmed as a non-physical ghost echo caused by internal cavity bounce. No physical fiber fault exists at this coordinate.'
              : 'Measurable physical insertion step loss confirmed. Physical optical joint requires standard field service.'}
          </p>
        </div>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-line"></div>
            <strong>Lead OTDR Metrology Engineer</strong><br>
            Network Operations Center, Shahdara
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <strong>Director of Outside Plant Engineering</strong><br>
            Shahdara ISP Operations
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Formats bilingual Urdu & English WhatsApp technician dispatch notice
 */
export function formatOtdrGhostArtifactCertWhatsApp(record) {
  const isGhost = record.isGhostConfirmed;
  const statusEmoji = isGhost ? '⚠️' : '🟢';

  return `*SHAHDARA FIBER NETWORK — OTDR GHOST ECHO AUDIT* 📉
*سرٹیفکیٹ برائے او ٹی ڈی آر گھوسٹ ریفلیکشن جانچ*
━━━━━━━━━━━━━━━━━━━━
*Cert ID:* ${record.id}
*Date / تاریخ:* ${record.dateStr}
*Route / صارف:* ${record.customerName} (${record.customerMohalla})
*Technician / ٹیکنیشن:* ${record.technicianName}
*Location / مقام:* ${record.location}
━━━━━━━━━━━━━━━━━━━━
*Span Length:* ${record.spanLengthKm} km (${record.wavelengthName})
*Primary Reflection:* ${record.primaryEventDistanceKm.toFixed(2)} km (${record.primaryReflectanceDb} dB)
*Candidate Event:* ${record.candidateEventDistanceKm.toFixed(2)} km
*Distance Ratio:* ${record.distanceRatio}x (${record.matchType})
*Measured Step Loss:* ${record.candidateStepLossDb.toFixed(3)} dB
━━━━━━━━━━━━━━━━━━━━
*Verdict / نتیجہ:* ${statusEmoji} ${record.verdictLabel}
*Field Action / ہدایت:*
${isGhost
  ? '⚠️ جعلی ریفلیکشن (گھوسٹ) ہے، کیبل کاٹنے یا کھدائی کی ضرورت نہیں! صرف پرائمری کنیکٹر صاف کریں۔'
  : '🟢 حقیقی آپٹیکل ایونٹ ہے۔ فیلڈ ٹیم جوائنٹ کی مرمت کیلئے جا سکتی ہے۔'}

_Shahdara ISP Network Operations Center — Metrology Dept_`;
}

/**
 * Exports OTDR Ghost records to RFC-4180 CSV with UTF-8 BOM
 */
export function generateOtdrGhostArtifactCertsCsv(records = []) {
  const headers = [
    'Certificate ID',
    'Date',
    'Customer ID',
    'Customer Name',
    'Mohalla',
    'Technician',
    'Location',
    'Span Length (km)',
    'Wavelength',
    'Primary Event (km)',
    'Primary Reflectance (dB)',
    'Candidate Event (km)',
    'Candidate Reflectance (dB)',
    'Candidate Step Loss (dB)',
    'Distance Ratio',
    'Match Type',
    'Verdict Code',
    'Verdict Label',
    'Is Ghost Confirmed',
    'Cancel Truck Roll',
    'Notes'
  ];

  const escapeCsv = (val) => {
    if (val == null) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = records.map(r => [
    escapeCsv(r.id),
    escapeCsv(r.dateStr),
    escapeCsv(r.customerId),
    escapeCsv(r.customerName),
    escapeCsv(r.customerMohalla),
    escapeCsv(r.technicianName),
    escapeCsv(r.location),
    escapeCsv(r.spanLengthKm),
    escapeCsv(r.wavelengthName),
    escapeCsv(r.primaryEventDistanceKm),
    escapeCsv(r.primaryReflectanceDb),
    escapeCsv(r.candidateEventDistanceKm),
    escapeCsv(r.candidateReflectanceDb),
    escapeCsv(r.candidateStepLossDb),
    escapeCsv(r.distanceRatio),
    escapeCsv(r.matchType),
    escapeCsv(r.verdictCode),
    escapeCsv(r.verdictLabel),
    escapeCsv(r.isGhostConfirmed ? 'YES' : 'NO'),
    escapeCsv(r.cancelTruckRoll ? 'YES' : 'NO'),
    escapeCsv(r.notes)
  ].join(','));

  return '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
}

/**
 * UI Controller for OTDR Ghost Modal Dialog
 */
export function setupOtdrGhostArtifactModal({
  dialogElement,
  triggerButton,
  storage = null,
  onToast = () => {}
}) {
  if (!dialogElement) return null;

  const presetSelect = dialogElement.querySelector('#ghostPresetSelect');
  const wavelengthSelect = dialogElement.querySelector('#ghostWavelengthSelect');
  const spanInput = dialogElement.querySelector('#ghostSpanInput');
  const primaryDistInput = dialogElement.querySelector('#ghostPrimaryDistInput');
  const primaryReflInput = dialogElement.querySelector('#ghostPrimaryReflInput');
  const candidateDistInput = dialogElement.querySelector('#ghostCandidateDistInput');
  const candidateReflInput = dialogElement.querySelector('#ghostCandidateReflInput');
  const candidateLossInput = dialogElement.querySelector('#ghostCandidateLossInput');
  const technicianInput = dialogElement.querySelector('#ghostTechnicianInput');
  const locationInput = dialogElement.querySelector('#ghostLocationInput');
  const notesInput = dialogElement.querySelector('#ghostNotesInput');

  const svgContainer = dialogElement.querySelector('#ghostSvgContainer');
  const ratioBadge = dialogElement.querySelector('#ghostRatioBadge');
  const stepLossBadge = dialogElement.querySelector('#ghostStepLossBadge');
  const actionBadge = dialogElement.querySelector('#ghostActionBadge');
  const verdictPill = dialogElement.querySelector('#ghostVerdictPill');

  const historyTbody = dialogElement.querySelector('#ghostHistoryTbody');
  const historySearch = dialogElement.querySelector('#ghostHistorySearch');
  const historyFilter = dialogElement.querySelector('#ghostHistoryFilter');

  const saveCertBtn = dialogElement.querySelector('#ghostSaveCertBtn');
  const printA4Btn = dialogElement.querySelector('#ghostPrintA4Btn');
  const printPosBtn = dialogElement.querySelector('#ghostPrintPosBtn');
  const exportCsvBtn = dialogElement.querySelector('#ghostExportCsvBtn');
  const whatsAppBtn = dialogElement.querySelector('#ghostWhatsAppBtn');
  const closeBtn = dialogElement.querySelector('#ghostCloseBtn');

  let activeCustomer = null;

  // Safe dropdown creation
  const doc = dialogElement?.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const createOption = (val, text) => {
    if (doc?.createElement) {
      const opt = doc.createElement('option');
      opt.value = val;
      opt.textContent = text;
      return opt;
    }
    return { value: val, textContent: text, tagName: 'OPTION' };
  };

  if (wavelengthSelect && !wavelengthSelect.children.length) {
    Object.values(GHOST_OTDR_WAVELENGTHS).forEach(w => {
      wavelengthSelect.appendChild(createOption(w.id, w.name));
    });
  }

  if (presetSelect && !presetSelect.children.length) {
    presetSelect.appendChild(createOption('', '— Select Standard Shahdara Preset —'));
    Object.values(SHAH_OTDR_GHOST_PRESETS).forEach(p => {
      presetSelect.appendChild(createOption(p.id, p.name));
    });
  }

  function getFormValues() {
    return {
      spanLengthKm: parseFloat(spanInput?.value) || 10.0,
      primaryEventDistanceKm: parseFloat(primaryDistInput?.value) || 2.0,
      primaryReflectanceDb: parseFloat(primaryReflInput?.value) || -28.0,
      candidateEventDistanceKm: parseFloat(candidateDistInput?.value) || 4.0,
      candidateReflectanceDb: parseFloat(candidateReflInput?.value) || -42.0,
      candidateStepLossDb: parseFloat(candidateLossInput?.value) || 0.01,
      wavelengthId: wavelengthSelect?.value || 'W1310'
    };
  }

  function recalculate() {
    const vals = getFormValues();
    const analysis = evaluateOtdrGhostArtifact(vals);

    if (svgContainer) {
      svgContainer.innerHTML = renderOtdrGhostArtifactSvg(analysis);
    }

    if (ratioBadge) {
      ratioBadge.textContent = `${analysis.distMatches.ratio}x (${analysis.distMatches.matchType})`;
      ratioBadge.style.color = analysis.distMatches.isDistanceCorrelated ? '#f59e0b' : '#38bdf8';
    }

    if (stepLossBadge) {
      stepLossBadge.textContent = `${analysis.candidateStepLossDb.toFixed(3)} dB`;
      stepLossBadge.style.color = analysis.candidateStepLossDb <= 0.035 ? '#10b981' : '#f59e0b';
    }

    if (actionBadge) {
      actionBadge.textContent = analysis.verdict.actionRequired;
      actionBadge.style.color = analysis.verdict.colorHex;
    }

    if (verdictPill) {
      verdictPill.textContent = analysis.verdict.code;
      verdictPill.className = `status-pill ${analysis.verdict.badgeClass}`;
    }

    return analysis;
  }

  function renderHistory() {
    if (!historyTbody) return;
    const records = getSavedOtdrGhostCerts(storage);
    const search = (historySearch?.value || '').toLowerCase().trim();
    const filter = historyFilter?.value || 'ALL';

    const filtered = records.filter(r => {
      if (filter === 'GHOST' && !r.isGhostConfirmed) return false;
      if (filter === 'REAL' && r.isGhostConfirmed) return false;
      if (!search) return true;
      return (
        r.id.toLowerCase().includes(search) ||
        r.customerName.toLowerCase().includes(search) ||
        r.location.toLowerCase().includes(search)
      );
    });

    if (!filtered.length) {
      historyTbody.innerHTML = `<tr><td colspan="7" class="table-empty-hint" style="text-align: center; padding: 16px;">No OTDR ghost certificates found matching query.</td></tr>`;
      return;
    }

    historyTbody.innerHTML = filtered.map(r => `
      <tr>
        <td style="font-weight: 600; font-family: monospace;">${escapeHtml(r.id)}</td>
        <td>${escapeHtml(r.dateStr)}</td>
        <td>${escapeHtml(r.customerName)} <small style="color: #64748b;">(${escapeHtml(r.location)})</small></td>
        <td><strong>${r.candidateEventDistanceKm.toFixed(2)} km</strong> <small style="color: #64748b;">(Prim: ${r.primaryEventDistanceKm.toFixed(2)} km)</small></td>
        <td>${r.candidateStepLossDb.toFixed(3)} dB</td>
        <td><span class="status-pill ${r.isGhostConfirmed ? 'badge-warning' : 'badge-pass-standard'}">${escapeHtml(r.verdictCode)}</span></td>
        <td>
          <button type="button" class="action-btn-sm" data-ghost-print-pos="${escapeHtml(r.id)}" title="Print Thermal Slip">POS</button>
          <button type="button" class="action-btn-sm" data-ghost-print-a4="${escapeHtml(r.id)}" title="Print Formal Certificate">A4</button>
        </td>
      </tr>
    `).join('');

    historyTbody.querySelectorAll('[data-ghost-print-pos]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-ghost-print-pos');
        const rec = records.find(x => x.id === id);
        if (rec) {
          const html = generateOtdrGhostArtifactCertHtml(rec, { format: 'POS' });
          openPrintWindow(html);
        }
      });
    });

    historyTbody.querySelectorAll('[data-ghost-print-a4]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-ghost-print-a4');
        const rec = records.find(x => x.id === id);
        if (rec) {
          const html = generateOtdrGhostArtifactCertHtml(rec, { format: 'A4' });
          openPrintWindow(html);
        }
      });
    });
  }

  function openPrintWindow(html) {
    if (typeof window === 'undefined') return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 350);
    }
  }

  [spanInput, primaryDistInput, primaryReflInput, candidateDistInput, candidateReflInput, candidateLossInput, wavelengthSelect].forEach(ctrl => {
    ctrl?.addEventListener('input', recalculate);
    ctrl?.addEventListener('change', recalculate);
  });

  presetSelect?.addEventListener('change', () => {
    const p = SHAH_OTDR_GHOST_PRESETS[presetSelect.value];
    if (p) {
      if (spanInput) spanInput.value = p.spanLengthKm;
      if (primaryDistInput) primaryDistInput.value = p.primaryEventDistanceKm;
      if (primaryReflInput) primaryReflInput.value = p.primaryReflectanceDb;
      if (candidateDistInput) candidateDistInput.value = p.candidateEventDistanceKm;
      if (candidateReflInput) candidateReflInput.value = p.candidateReflectanceDb;
      if (candidateLossInput) candidateLossInput.value = p.candidateStepLossDb;
      if (wavelengthSelect) wavelengthSelect.value = p.wavelengthId;
      if (technicianInput) technicianInput.value = p.technician;
      if (locationInput) locationInput.value = p.location;
      if (notesInput) notesInput.value = p.notes;
      recalculate();
      onToast(`Loaded preset: ${p.name}`);
    }
  });

  saveCertBtn?.addEventListener('click', () => {
    const vals = getFormValues();
    const valid = validateOtdrGhostInput(vals);
    if (!valid.isValid) {
      onToast(`Validation error: ${valid.errors[0]}`);
      return;
    }

    const record = buildOtdrGhostRecord({
      customer: activeCustomer,
      ...vals,
      technicianName: technicianInput?.value || 'Certified Specialist',
      location: locationInput?.value || 'Outside Plant Trunk',
      notes: notesInput?.value || ''
    });

    const ok = saveOtdrGhostCert(record, storage);
    if (ok) {
      onToast(`Saved OTDR Ghost Certificate ${record.id}!`);
      renderHistory();
    } else {
      onToast('Error saving record.');
    }
  });

  printA4Btn?.addEventListener('click', () => {
    const vals = getFormValues();
    const record = buildOtdrGhostRecord({
      customer: activeCustomer,
      ...vals,
      technicianName: technicianInput?.value,
      location: locationInput?.value,
      notes: notesInput?.value
    });
    const html = generateOtdrGhostArtifactCertHtml(record, { format: 'A4' });
    openPrintWindow(html);
  });

  printPosBtn?.addEventListener('click', () => {
    const vals = getFormValues();
    const record = buildOtdrGhostRecord({
      customer: activeCustomer,
      ...vals,
      technicianName: technicianInput?.value,
      location: locationInput?.value,
      notes: notesInput?.value
    });
    const html = generateOtdrGhostArtifactCertHtml(record, { format: 'POS' });
    openPrintWindow(html);
  });

  exportCsvBtn?.addEventListener('click', () => {
    const records = getSavedOtdrGhostCerts(storage);
    if (!records.length) {
      onToast('No saved records to export.');
      return;
    }
    const csv = generateOtdrGhostArtifactCertsCsv(records);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shahdara_otdr_ghost_qa_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Exported CSV successfully!');
  });

  whatsAppBtn?.addEventListener('click', () => {
    const vals = getFormValues();
    const record = buildOtdrGhostRecord({
      customer: activeCustomer,
      ...vals,
      technicianName: technicianInput?.value,
      location: locationInput?.value,
      notes: notesInput?.value
    });
    const text = formatOtdrGhostArtifactCertWhatsApp(record);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      onToast('WhatsApp dispatch notice copied to clipboard!');
    }
  });

  historySearch?.addEventListener('input', renderHistory);
  historyFilter?.addEventListener('change', renderHistory);

  triggerButton?.addEventListener('click', () => {
    if (typeof dialogElement.showModal === 'function') {
      dialogElement.showModal();
    } else {
      dialogElement.setAttribute('open', '');
    }
    recalculate();
    renderHistory();
  });

  closeBtn?.addEventListener('click', () => {
    if (typeof dialogElement.close === 'function') {
      dialogElement.close();
    } else {
      dialogElement.removeAttribute('open');
    }
  });

  recalculate();
  renderHistory();

  return {
    recalculate,
    populateCustomer: (c) => {
      activeCustomer = c;
      if (locationInput && c) {
        locationInput.value = `${c.name || 'Trunk'} Route Demarc (${c.mohalla || c.zone || 'Shahdara'})`;
      }
      recalculate();
    },
    renderHistory
  };
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}
