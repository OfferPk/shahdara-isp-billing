/**
 * Shahdara ISP - Field OTDR Launch Cable & Receive Tail Fiber Pulse Suppression Matrix
 * 
 * Provides FTTH field technicians, linesmen, and outside plant specialists with:
 * - ITU-T G.650.1 / G.652.D / IEC 61746-1 compliant OTDR pulse suppression management
 * - Launch fiber (dummy spool / pulse suppressor) sizing to overcome Event Dead Zone (EDZ) & Attenuation Dead Zone (ADZ)
 * - Near-end bulkhead connector (ODF / FAT) loss & reflectance characterization
 * - Far-end receive tail fiber spool validation for drop subscriber termination qualification
 * - Mathematical Ghost Echo (phantom reflection artifact) calculation: 2 * L_event
 * - High-reflectance warning and zero-loss ghost identification vs genuine physical breaks
 * - Interactive vector SVG trace cutaway showing OTDR, launch spool, ODF, FUT span, tail spool, and OTDR backscatter waveform
 * - LocalStorage audit log (shahdara_otdr_launch_cable_audits_v1), bilingual WhatsApp dispatch, and CSV export
 */

export const OTDR_LAUNCH_STORAGE_KEY = 'shahdara_otdr_launch_cable_audits_v1';

export const OTDR_PULSE_WIDTHS = {
  PULSE_5NS: {
    id: 'PULSE_5NS',
    label: '5 ns (Ultra-Short / Drop & Event Resolution)',
    durationNs: 5,
    eventDeadZoneM: 0.8,
    attenuationDeadZoneM: 3.0,
    minRecommendedLaunchM: 150,
    maxDynamicRangeKm: 2.5,
    description: 'Pinpoints closely-spaced drop connectors and FAT micro-bends with sub-meter dead zone.'
  },
  PULSE_10NS: {
    id: 'PULSE_10NS',
    label: '10 ns (Short / Feeder Drop Cluster)',
    durationNs: 10,
    eventDeadZoneM: 1.5,
    attenuationDeadZoneM: 5.5,
    minRecommendedLaunchM: 250,
    maxDynamicRangeKm: 6.0,
    description: 'Standard for suburban distribution cluster and building riser inspection.'
  },
  PULSE_30NS: {
    id: 'PULSE_30NS',
    label: '30 ns (Medium / Shahdara Metro Feeder)',
    durationNs: 30,
    eventDeadZoneM: 3.5,
    attenuationDeadZoneM: 14.0,
    minRecommendedLaunchM: 500,
    maxDynamicRangeKm: 15.0,
    description: 'Balanced pulse for Shahdara Town feeder cables and central office to FAT links.'
  },
  PULSE_100NS: {
    id: 'PULSE_100NS',
    label: '100 ns (Long / Inter-POP Backbone & Splitter Penetration)',
    durationNs: 100,
    eventDeadZoneM: 12.0,
    attenuationDeadZoneM: 40.0,
    minRecommendedLaunchM: 500,
    maxDynamicRangeKm: 35.0,
    description: 'High energy pulse to penetrate 1:32 optical splitters and long-distance aerial spans.'
  },
  PULSE_275NS: {
    id: 'PULSE_275NS',
    label: '275 ns (Extended / Heavy Backbone Tie)',
    durationNs: 275,
    eventDeadZoneM: 28.0,
    attenuationDeadZoneM: 95.0,
    minRecommendedLaunchM: 1000,
    maxDynamicRangeKm: 60.0,
    description: 'Long-haul trunk links connecting Shahdara POP with Lahore Core ring.'
  }
};

export const FIBER_TYPES = {
  G652D: {
    id: 'G652D',
    name: 'ITU-T G.652.D Standard Singlemode',
    lossCoefficients: {
      1310: 0.35,
      1490: 0.28,
      1550: 0.20,
      1625: 0.22,
      1650: 0.23
    },
    backscatterCoeffDb: -79.0,
    description: 'Standard outdoor loose-tube feeder cable with flat zero-dispersion slope.'
  },
  G657A1: {
    id: 'G657A1',
    name: 'ITU-T G.657.A1 Bend-Insensitive (Outdoor Drop)',
    lossCoefficients: {
      1310: 0.36,
      1490: 0.29,
      1550: 0.21,
      1625: 0.23,
      1650: 0.24
    },
    backscatterCoeffDb: -78.5,
    description: 'Aerial drop cable resistant to pole bend radii down to 10 mm.'
  },
  G657A2: {
    id: 'G657A2',
    name: 'ITU-T G.657.A2 Super Bend-Insensitive (Indoor FTTH)',
    lossCoefficients: {
      1310: 0.38,
      1490: 0.30,
      1550: 0.22,
      1625: 0.24,
      1650: 0.25
    },
    backscatterCoeffDb: -78.0,
    description: 'Tight-buffer customer indoor drop cable bendable around 7.5 mm sharp corners.'
  }
};

export const OTDR_LAUNCH_FIBER_TYPES = FIBER_TYPES;

export const WAVELENGTHS = [
  { value: 1310, label: '1310 nm (O-Band Upstream / High Fiber Attenuation)' },
  { value: 1490, label: '1490 nm (Downstream GPON Continuous)' },
  { value: 1550, label: '1550 nm (C-Band / RF Video / Lowest Attenuation)' },
  { value: 1625, label: '1625 nm (U-Band Live Maintenance Out-of-Band)' },
  { value: 1650, label: '1650 nm (Filtered Live In-Service OTDR)' }
];

export const OTDR_LAUNCH_WAVELENGTHS = WAVELENGTHS;

export const OTDR_LAUNCH_PRESETS = [
  {
    id: 'shahdara-town-feeder-optimal',
    name: 'Shahdara Town Feeder: 500m Launch + 300m Tail (Optimal)',
    area: 'Shahdara Town',
    pulseWidthKey: 'PULSE_30NS',
    fiberTypeKey: 'G652D',
    wavelength: 1310,
    launchCableLengthM: 500,
    futLengthM: 2400,
    tailCableLengthM: 300,
    nearEndReflectanceDb: -52.0,
    nearEndLossDb: 0.25,
    farEndLossDb: 0.28,
    technicianName: 'Sajjad Malik (Senior OTDR Tech)',
    notes: 'Standard Shahdara Town feeder trace with compliant pulse suppression and zero blind spots.'
  },
  {
    id: 'ravi-road-no-launch-blind',
    name: 'Ravi Road Blind Test: Direct Connection (No Launch Box)',
    area: 'Ravi Road',
    pulseWidthKey: 'PULSE_100NS',
    fiberTypeKey: 'G652D',
    wavelength: 1550,
    launchCableLengthM: 0,
    futLengthM: 1800,
    tailCableLengthM: 0,
    nearEndReflectanceDb: -32.0,
    nearEndLossDb: 0.0,
    farEndLossDb: 0.0,
    technicianName: 'Zubair Butt (Junior Tech)',
    notes: 'CRITICAL DEFECT: No launch cable. OTDR launch pulse dead zone completely blinds first 40 meters.'
  },
  {
    id: 'begum-kot-ghost-reflection',
    name: 'Begum Kot Ghost Echo: High Reflectance UPC Joint at 650m',
    area: 'Begum Kot',
    pulseWidthKey: 'PULSE_30NS',
    fiberTypeKey: 'G657A1',
    wavelength: 1310,
    launchCableLengthM: 500,
    futLengthM: 3200,
    tailCableLengthM: 300,
    nearEndReflectanceDb: -26.5, // Bad flat cleave / dirty UPC
    nearEndLossDb: 0.35,
    farEndLossDb: 0.30,
    technicianName: 'Tariq Mehmood',
    notes: 'High Fresnel reflection generates phantom ghost echo peak at 1300m (2x distance).'
  },
  {
    id: 'underlength-launch-cable',
    name: 'Aerial Span Underlength Launch: 100m Spool with 100ns Pulse',
    area: 'Jia Musa',
    pulseWidthKey: 'PULSE_100NS',
    fiberTypeKey: 'G657A1',
    wavelength: 1550,
    launchCableLengthM: 100, // Too short for 100ns (ADZ = 40m, needs >= 300m)
    futLengthM: 4500,
    tailCableLengthM: 150,
    nearEndReflectanceDb: -48.0,
    nearEndLossDb: 0.30,
    farEndLossDb: 0.32,
    technicianName: 'Khurram Shah',
    notes: 'Launch spool too short for pulse width; tail of dead zone bleeds into first ODF splice.'
  },
  {
    id: 'xgs-pon-live-1650-filtered',
    name: 'XGS-PON Live In-Service OTDR: 1000m Launch Box at 1650nm',
    area: 'Farrukhabad',
    pulseWidthKey: 'PULSE_30NS',
    fiberTypeKey: 'G657A2',
    wavelength: 1650,
    launchCableLengthM: 1000,
    futLengthM: 1600,
    tailCableLengthM: 500,
    nearEndReflectanceDb: -62.0, // High quality APC
    nearEndLossDb: 0.18,
    farEndLossDb: 0.20,
    technicianName: 'Imran Bashir',
    notes: 'Live out-of-band monitoring with high-purity APC launch cable and wavelength filter.'
  }
];

/**
 * Calculates complete OTDR Launch Cable & Pulse Suppression metrics
 * @param {Object} inputs - User parameters
 * @returns {Object} Comprehensive calculation results
 */
export function calculateOtdrLaunchMetrics(inputs = {}) {
  const pulseKey = inputs.pulseWidthKey || 'PULSE_30NS';
  const pulse = OTDR_PULSE_WIDTHS[pulseKey] || OTDR_PULSE_WIDTHS.PULSE_30NS;

  const fiberKey = inputs.fiberTypeKey || 'G652D';
  const fiber = FIBER_TYPES[fiberKey] || FIBER_TYPES.G652D;

  const wavelength = Number(inputs.wavelength) || 1310;
  const alphaDbPerKm = fiber.lossCoefficients[wavelength] || 0.35;

  const launchLenM = typeof inputs.launchCableLengthM === 'number'
    ? Math.max(0, Math.min(3000, inputs.launchCableLengthM))
    : 500;

  const futLenM = typeof inputs.futLengthM === 'number'
    ? Math.max(50, Math.min(40000, inputs.futLengthM))
    : 2400;

  const tailLenM = typeof inputs.tailCableLengthM === 'number'
    ? Math.max(0, Math.min(3000, inputs.tailCableLengthM))
    : 300;

  const nearEndReflectanceDb = typeof inputs.nearEndReflectanceDb === 'number'
    ? Math.min(-14.0, Math.max(-75.0, inputs.nearEndReflectanceDb))
    : -52.0;

  const nearEndLossDb = typeof inputs.nearEndLossDb === 'number'
    ? Math.max(0.01, Math.min(3.0, inputs.nearEndLossDb))
    : 0.25;

  const farEndLossDb = typeof inputs.farEndLossDb === 'number'
    ? Math.max(0.01, Math.min(3.0, inputs.farEndLossDb))
    : 0.28;

  // 1. Launch Fiber Verification & Dead Zone Bleed Check
  const hasLaunchCable = launchLenM > 0;
  const isLaunchAdequate = launchLenM >= (pulse.attenuationDeadZoneM * 2.5);
  const isNearEndMeasurable = hasLaunchCable && isLaunchAdequate;

  let launchVerdict = 'OPTIMAL';
  let launchWarning = null;

  if (!hasLaunchCable) {
    launchVerdict = 'BLIND ZONE (No Launch Cable)';
    launchWarning = `OTDR launch pulse blinds the first ${pulse.attenuationDeadZoneM.toFixed(1)}m. Near-end ODF connector cannot be measured!`;
  } else if (!isLaunchAdequate) {
    launchVerdict = 'UNDERLENGTH (Dead Zone Bleed)';
    launchWarning = `Launch spool (${launchLenM}m) is shorter than recommended ${Math.round(pulse.attenuationDeadZoneM * 2.5)}m for ${pulse.durationNs}ns pulse.`;
  }

  // 2. Receive Tail Fiber Verification
  const hasTailCable = tailLenM > 0;
  const isTailAdequate = tailLenM >= (pulse.attenuationDeadZoneM * 2.5);
  const isFarEndMeasurable = hasTailCable && isTailAdequate;

  let tailVerdict = 'OPTIMAL';
  let tailWarning = null;

  if (!hasTailCable) {
    tailVerdict = 'UNVERIFIED FAR-END';
    tailWarning = 'Without a receive tail fiber, the final connector loss and reflectance cannot be measured against Rayleigh backscatter.';
  } else if (!isTailAdequate) {
    tailVerdict = 'SHORT TAIL FIBER';
    tailWarning = `Tail spool (${tailLenM}m) is insufficient for ${pulse.durationNs}ns pulse attenuation tail-off.`;
  }

  // 3. Ghost Reflection Detection & Prediction
  // High reflectance events (RL worse than -35 dB) generate secondary reflections (ghosts)
  // Distance to ghost = 2 * Distance_to_reflective_event
  const isHighReflectance = nearEndReflectanceDb > -35.0; // e.g. -26 dB is severe reflection
  let ghostEchoDetected = false;
  let ghostDistanceM = 0;
  let ghostDescription = 'No ghost reflections predicted. Return loss is within acceptable limits.';

  if (isHighReflectance && hasLaunchCable) {
    ghostEchoDetected = true;
    ghostDistanceM = Math.round(launchLenM * 2);
    ghostDescription = `Warning: High near-end reflectance (${nearEndReflectanceDb.toFixed(1)} dB) creates a phantom GHOST ECHO at ${ghostDistanceM}m! Ghost peaks exhibit high reflectance but 0.00 dB insertion loss.`;
  }

  // 4. Optical Loss Budget Calculations
  const launchLossDb = hasLaunchCable ? +( (launchLenM / 1000) * alphaDbPerKm + 0.20 ).toFixed(3) : 0;
  const futLossDb = +( (futLenM / 1000) * alphaDbPerKm ).toFixed(3);
  const tailLossDb = hasTailCable ? +( (tailLenM / 1000) * alphaDbPerKm + 0.20 ).toFixed(3) : 0;

  const totalLinkLossDb = +(
    launchLossDb +
    nearEndLossDb +
    futLossDb +
    farEndLossDb +
    tailLossDb
  ).toFixed(2);

  const futFiberAttenuationDb = futLossDb;

  // 5. Total Measurement Span
  const totalMeasuredLengthM = launchLenM + futLenM + tailLenM;

  // 6. Overall Quality & Pass/Fail Verdict
  let isOverallPass = isNearEndMeasurable && isFarEndMeasurable && !isHighReflectance && nearEndLossDb <= 0.50 && farEndLossDb <= 0.50;
  let qualityRating = 'EXCELLENT';
  let ratingColor = '#10b981';

  if (!hasLaunchCable || nearEndLossDb > 1.0 || farEndLossDb > 1.0) {
    qualityRating = 'FAIL (Invalid Measurement Setup)';
    ratingColor = '#ef4444';
    isOverallPass = false;
  } else if (!isNearEndMeasurable || !isFarEndMeasurable || isHighReflectance || nearEndLossDb > 0.40) {
    qualityRating = 'MARGINAL (Action Required)';
    ratingColor = '#f59e0b';
    isOverallPass = false;
  }

  return {
    pulse,
    fiber,
    wavelength,
    alphaDbPerKm,

    // Distances
    launchLenM,
    futLenM,
    tailLenM,
    totalMeasuredLengthM,

    // Launch & Tail status
    hasLaunchCable,
    isLaunchAdequate,
    isNearEndMeasurable,
    launchVerdict,
    launchWarning,

    hasTailCable,
    isTailAdequate,
    isFarEndMeasurable,
    tailVerdict,
    tailWarning,

    // Reflectance & Ghosting
    nearEndReflectanceDb,
    isHighReflectance,
    ghostEchoDetected,
    ghostDistanceM,
    ghostDescription,

    // Connector & Fiber Losses
    nearEndLossDb,
    farEndLossDb,
    launchLossDb,
    futLossDb,
    tailLossDb,
    futFiberAttenuationDb,
    totalLinkLossDb,

    // Verdicts
    isOverallPass,
    qualityRating,
    ratingColor
  };
}

/**
 * Pure-vector SVG cutaway visualizer for OTDR launch setup and simulated backscatter trace
 * @param {Object} dyn - Output of calculateOtdrLaunchMetrics
 * @param {Object} options - Layout options
 * @returns {string} SVG markup
 */
export function renderOtdrLaunchDiagramSvg(dyn, options = {}) {
  if (!dyn) return '';

  const width = options.width || 720;
  const height = options.height || 300;

  const pulse = dyn.pulse;
  const isPass = dyn.isOverallPass;
  const color = dyn.ratingColor;

  // Geometry mapping for waveform
  // Total span x from 60 to 660 (600px width)
  const xStart = 60;
  const xEnd = 660;
  const totalM = Math.max(1000, dyn.totalMeasuredLengthM);

  const launchPx = dyn.hasLaunchCable ? (dyn.launchLenM / totalM) * 600 : 0;
  const futPx = (dyn.futLenM / totalM) * 600;
  const tailPx = dyn.hasTailCable ? (dyn.tailLenM / totalM) * 600 : 0;

  const xOtdr = xStart;
  const xNearEnd = xStart + launchPx;
  const xFarEnd = xNearEnd + futPx;
  const xEndFiber = xFarEnd + tailPx;

  // Power levels (Y coordinates: higher power = smaller Y)
  const yTop = 60;
  const yLaunchSpike = 40;
  const yNearDrop = yTop + 25;
  const yFarDrop = yNearDrop + 35;
  const yTailDrop = yFarDrop + 20;
  const yNoiseFloor = 160;

  return `<svg class="otdr-launch-svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="OTDR Launch Cable and Pulse Waveform Cutaway" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="otdrLaunchBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
      <linearGradient id="traceGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="50%" stop-color="#10b981"/>
        <stop offset="100%" stop-color="#f59e0b"/>
      </linearGradient>
      <filter id="otdrGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <!-- Canvas -->
    <rect width="${width}" height="${height}" rx="12" fill="url(#otdrLaunchBg)"/>

    <!-- Header Details -->
    <g transform="translate(24, 22)">
      <text x="0" y="0" fill="#f8fafc" font-size="13" font-weight="700" font-family="system-ui, sans-serif">OTDR LAUNCH CABLE &amp; TAIL FIBER WAVEFORM · ${dyn.wavelength}nm (${pulse.durationNs}ns PULSE)</text>
      <text x="0" y="16" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">Event Dead Zone: <tspan fill="#38bdf8" font-weight="600">${pulse.eventDeadZoneM}m</tspan> · Attenuation Dead Zone: <tspan fill="#eab308" font-weight="600">${pulse.attenuationDeadZoneM}m</tspan> · Standard: ITU-T G.650.1</text>
    </g>

    <!-- Verdict Badge Top Right -->
    <g transform="translate(${width - 180}, 14)">
      <rect x="0" y="0" width="156" height="28" rx="6" fill="#020617" stroke="${color}" stroke-width="1.5" filter="url(#otdrGlow)"/>
      <circle cx="14" cy="14" r="5" fill="${color}"/>
      <text x="26" y="18" fill="${color}" font-size="11" font-weight="800" font-family="system-ui">${dyn.qualityRating.split(' ')[0]}</text>
    </g>

    <!-- Grid Lines for Waveform Graph -->
    <g stroke="#1e293b" stroke-width="1" stroke-dasharray="3,3">
      <line x1="${xStart}" y1="45" x2="${xEnd}" y2="45"/>
      <line x1="${xStart}" y1="80" x2="${xEnd}" y2="80"/>
      <line x1="${xStart}" y1="115" x2="${xEnd}" y2="115"/>
      <line x1="${xStart}" y1="150" x2="${xEnd}" y2="150"/>
    </g>

    <!-- Physical Apparatus Schematic Blocks -->
    <g transform="translate(0, 185)">
      <!-- OTDR Box -->
      <rect x="${xStart - 40}" y="0" width="36" height="32" rx="4" fill="#3b82f6" stroke="#1d4ed8" stroke-width="1.5"/>
      <text x="${xStart - 22}" y="19" fill="#ffffff" font-size="9" font-weight="800" text-anchor="middle" font-family="system-ui">OTDR</text>

      <!-- Launch Fiber Spool -->
      ${dyn.hasLaunchCable ? `
      <rect x="${xStart}" y="4" width="${Math.max(24, launchPx)}" height="24" rx="3" fill="#eab308" opacity="0.85"/>
      <text x="${xStart + Math.max(24, launchPx) / 2}" y="20" fill="#000000" font-size="9" font-weight="800" text-anchor="middle" font-family="system-ui">LAUNCH: ${dyn.launchLenM}m</text>
      ` : `
      <rect x="${xStart}" y="4" width="20" height="24" rx="2" fill="#ef4444" opacity="0.6"/>
      <text x="${xStart + 10}" y="20" fill="#ffffff" font-size="8" font-weight="800" text-anchor="middle" font-family="system-ui">BLIND</text>
      `}

      <!-- Near-End ODF / FAT Connector Joint -->
      <line x1="${xNearEnd}" y1="-5" x2="${xNearEnd}" y2="35" stroke="#f43f5e" stroke-width="2" stroke-dasharray="2,2"/>
      <circle cx="${xNearEnd}" cy="16" r="4" fill="#f43f5e"/>
      <text x="${xNearEnd}" y="45" fill="#f43f5e" font-size="9" font-weight="800" text-anchor="middle" font-family="system-ui">ODF BULKHEAD</text>

      <!-- Fiber Under Test (FUT) Span -->
      <rect x="${xNearEnd}" y="6" width="${futPx}" height="20" rx="3" fill="#0284c7" opacity="0.75"/>
      <text x="${xNearEnd + futPx / 2}" y="20" fill="#ffffff" font-size="9" font-weight="800" text-anchor="middle" font-family="system-ui">FIBER UNDER TEST (FUT): ${dyn.futLenM}m</text>

      <!-- Far-End ONT / FAT Drop Joint -->
      <line x1="${xFarEnd}" y1="-5" x2="${xFarEnd}" y2="35" stroke="#10b981" stroke-width="2" stroke-dasharray="2,2"/>
      <circle cx="${xFarEnd}" cy="16" r="4" fill="#10b981"/>
      <text x="${xFarEnd}" y="45" fill="#10b981" font-size="9" font-weight="800" text-anchor="middle" font-family="system-ui">DROP TERM</text>

      <!-- Tail Fiber Spool -->
      ${dyn.hasTailCable ? `
      <rect x="${xFarEnd}" y="4" width="${Math.max(24, tailPx)}" height="24" rx="3" fill="#14b8a6" opacity="0.85"/>
      <text x="${xFarEnd + Math.max(24, tailPx) / 2}" y="20" fill="#ffffff" font-size="9" font-weight="800" text-anchor="middle" font-family="system-ui">TAIL: ${dyn.tailLenM}m</text>
      ` : `
      <rect x="${xFarEnd}" y="4" width="20" height="24" rx="2" fill="#64748b" opacity="0.5"/>
      <text x="${xFarEnd + 10}" y="20" fill="#ffffff" font-size="8" font-weight="800" text-anchor="middle" font-family="system-ui">NONE</text>
      `}
    </g>

    <!-- OTDR Backscatter Waveform Trace Path -->
    <g>
      <!-- Trace Polyline -->
      <path d="
        M ${xStart - 30},${yNoiseFloor}
        L ${xStart},${yLaunchSpike}
        L ${xStart + 12},${yTop}
        ${dyn.hasLaunchCable ? `
          L ${xNearEnd},${yTop + (launchPx * 0.05)}
          L ${xNearEnd},${yTop + (launchPx * 0.05) - 22}
          L ${xNearEnd + 6},${yNearDrop}
        ` : `
          L ${xNearEnd + 10},${yNearDrop}
        `}
        L ${xFarEnd},${yFarDrop - 5}
        L ${xFarEnd},${yFarDrop - 25}
        L ${xFarEnd + 6},${yFarDrop}
        ${dyn.hasTailCable ? `
          L ${xEndFiber},${yTailDrop}
          L ${xEndFiber},${yTailDrop - 15}
          L ${xEndFiber + 6},${yNoiseFloor}
        ` : `
          L ${xFarEnd + 6},${yNoiseFloor}
        `}
        L ${xEnd},${yNoiseFloor}
      " fill="none" stroke="url(#traceGrad)" stroke-width="2.5"/>

      <!-- Ghost Echo Marker if High Reflectance -->
      ${dyn.ghostEchoDetected && (xStart + (dyn.ghostDistanceM / totalM) * 600) < xEnd ? `
      <g transform="translate(${xStart + (dyn.ghostDistanceM / totalM) * 600}, ${yTop + 40})">
        <path d="M 0,0 L 0,-20 L 4,-20 L 6,0" fill="none" stroke="#f43f5e" stroke-width="2" stroke-dasharray="2,2"/>
        <text x="0" y="-24" fill="#f43f5e" font-size="8" font-weight="800" text-anchor="middle" font-family="system-ui">GHOST ECHO (2x)</text>
      </g>
      ` : ''}
    </g>

    <!-- Bottom Telemetry Metric Cards -->
    <g transform="translate(24, 240)">
      <!-- Box 1: Launch Spool Status -->
      <rect x="0" y="0" width="160" height="48" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="10" y="15" fill="#94a3b8" font-size="9" font-family="system-ui">LAUNCH CABLE (MIN ${Math.round(pulse.attenuationDeadZoneM * 2.5)}m)</text>
      <text x="10" y="32" fill="${dyn.hasLaunchCable && dyn.isLaunchAdequate ? '#10b981' : '#ef4444'}" font-size="13" font-weight="800" font-family="system-ui">${dyn.hasLaunchCable ? `${dyn.launchLenM}m (${dyn.launchVerdict.split(' ')[0]})` : 'NONE (BLIND)'}</text>
      <text x="10" y="43" fill="#64748b" font-size="8" font-family="system-ui">ODF Bulkhead: ${dyn.isNearEndMeasurable ? 'Measurable' : 'Blinded'}</text>

      <!-- Box 2: Near-End Loss & Reflectance -->
      <rect x="170" y="0" width="160" height="48" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="10" y="15" fill="#94a3b8" font-size="9" font-family="system-ui">NEAR-END ODF BULKHEAD</text>
      <text x="10" y="32" fill="${dyn.nearEndLossDb <= 0.40 ? '#10b981' : '#f59e0b'}" font-size="13" font-weight="800" font-family="system-ui">${dyn.nearEndLossDb.toFixed(2)} dB · ${dyn.nearEndReflectanceDb.toFixed(1)} dB</text>
      <text x="10" y="43" fill="#64748b" font-size="8" font-family="system-ui">${dyn.isHighReflectance ? '⚠️ High Reflection (Ghost Risk)' : 'Clean APC Reflectance'}</text>

      <!-- Box 3: Far-End Drop Termination -->
      <rect x="340" y="0" width="160" height="48" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="10" y="15" fill="#94a3b8" font-size="9" font-family="system-ui">FAR-END TERMINATION</text>
      <text x="10" y="32" fill="${dyn.isFarEndMeasurable ? '#10b981' : '#f59e0b'}" font-size="13" font-weight="800" font-family="system-ui">${dyn.isFarEndMeasurable ? `${dyn.farEndLossDb.toFixed(2)} dB` : 'Unverified Tail'}</text>
      <text x="10" y="43" fill="#64748b" font-size="8" font-family="system-ui">Tail Spool: ${dyn.hasTailCable ? `${dyn.tailLenM}m` : 'Missing'}</text>

      <!-- Box 4: Total Link Loss Budget -->
      <rect x="510" y="0" width="160" height="48" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="10" y="15" fill="#94a3b8" font-size="9" font-family="system-ui">TOTAL LINK LOSS BUDGET</text>
      <text x="10" y="32" fill="#38bdf8" font-size="13" font-weight="800" font-family="system-ui">${dyn.totalLinkLossDb.toFixed(2)} dB</text>
      <text x="10" y="43" fill="#64748b" font-size="8" font-family="system-ui">FUT Fiber: ${dyn.futLossDb.toFixed(2)} dB (${dyn.alphaDbPerKm} dB/km)</text>
    </g>
  </svg>`;
}

/**
 * Formats a bilingual Urdu & English WhatsApp field dispatch message
 * @param {Object} dyn - Output of calculateOtdrLaunchMetrics
 * @param {Object} context - Optional technician/job metadata
 * @returns {string} WhatsApp formatted text
 */
export function formatOtdrLaunchWhatsApp(dyn, context = {}) {
  const pulse = dyn.pulse;
  const isPass = dyn.isOverallPass;
  const area = context.area || 'Shahdara Out Plant';
  const tech = context.technicianName || 'OTDR Specialist';

  return `*SHAHDARA ISP · FTTH OTDR LAUNCH CABLE AUDIT*
*شاہدہرا آپٹیکل ٹائم ڈومین ریفلیکٹومیٹر لانچ رپورٹ*
----------------------------------------
📍 *Area / علاقہ:* ${area}
👷 *Technician:* ${tech}
⚡ *Pulse Width / پلس چوڑائی:* ${pulse.label}
📏 *Span Length (FUT):* ${dyn.futLenM} meters (${(dyn.futLenM / 1000).toFixed(2)} km)
📊 *Overall Status:* ${isPass ? '✅ PASSED (کامیاب)' : '❌ FAILED / DEFECT (ناقص سیٹ اپ)'}

*METROLOGICAL READINGS / ٹیسٹ کے نتائج:*
• Launch Cable (لانچ کیبل): ${dyn.hasLaunchCable ? `${dyn.launchLenM}m (${dyn.launchVerdict})` : '❌ Missing (بلائنڈ زون)'}
• Near-End Bulkhead Loss: ${dyn.nearEndLossDb.toFixed(2)} dB (Reflectance: ${dyn.nearEndReflectanceDb.toFixed(1)} dB)
• Far-End Tail Spool: ${dyn.hasTailCable ? `${dyn.tailLenM}m (${dyn.tailVerdict})` : '⚠️ Missing (درست جائزہ ناممکن)'}
• Far-End Drop Loss: ${dyn.isFarEndMeasurable ? `${dyn.farEndLossDb.toFixed(2)} dB` : 'Unverified'}
• Total Link Attenuation: ${dyn.totalLinkLossDb.toFixed(2)} dB @ ${dyn.wavelength}nm

${dyn.launchWarning ? `⚠️ *DEFECT ALERT:* ${dyn.launchWarning}\n` : ''}${dyn.ghostEchoDetected ? `👻 *GHOST ECHO ALERT:* ${dyn.ghostDescription}\n` : ''}${isPass ? '✨ Fully compliant with ITU-T G.650.1 / IEC 61746-1 standards.' : ''}
----------------------------------------
_Shahdara Outside Plant Engineering Ledger_`;
}

/**
 * Generates RFC-4180 CSV export string for OTDR launch cable audits
 * @param {Array} auditRecords - Array of audit objects
 * @returns {string} CSV with UTF-8 BOM
 */
export function generateOtdrLaunchCsv(auditRecords = []) {
  const headers = [
    'Timestamp',
    'Area',
    'Technician',
    'Wavelength (nm)',
    'Pulse Width',
    'Launch Length (m)',
    'FUT Length (m)',
    'Tail Length (m)',
    'Near-End Loss (dB)',
    'Near-End Reflectance (dB)',
    'Far-End Loss (dB)',
    'Total Link Loss (dB)',
    'Ghost Echo',
    'Rating',
    'Pass Status'
  ];

  const rows = auditRecords.map(r => [
    `"${r.timestamp || new Date().toISOString()}"`,
    `"${(r.area || '').replace(/"/g, '""')}"`,
    `"${(r.technicianName || '').replace(/"/g, '""')}"`,
    r.wavelength ?? 1310,
    `"${r.pulseWidth || ''}"`,
    r.launchLenM ?? '',
    r.futLenM ?? '',
    r.tailLenM ?? '',
    r.nearEndLossDb ?? '',
    r.nearEndReflectanceDb ?? '',
    r.farEndLossDb ?? '',
    r.totalLinkLossDb ?? '',
    r.ghostEchoDetected ? 'YES' : 'NO',
    `"${r.qualityRating || ''}"`,
    r.isOverallPass ? 'PASS' : 'FAIL'
  ].join(','));

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Controller for OTDR Launch Cable Modal Dialog in Mobile Nav
 * @param {Object} state - Application state
 * @param {Object} options - Controller hooks and overrides
 * @returns {Object} Controller interface
 */
export function setupMobileOtdrLaunchModal(state, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const modal = doc.getElementById('mobileOtdrLaunchModal');
  const openBtn = doc.getElementById('mobileMoreOtdrLaunchBtn');
  const closeBtn = doc.getElementById('mobileOtdrLaunchModalCloseBtn');

  // Input Controls
  const presetSelect = doc.getElementById('otdrLaunchPresetSelect');
  const pulseSelect = doc.getElementById('otdrLaunchPulseSelect');
  const fiberSelect = doc.getElementById('otdrLaunchFiberSelect');
  const waveSelect = doc.getElementById('otdrLaunchWaveSelect');
  const launchSlider = doc.getElementById('otdrLaunchCableSlider');
  const launchLabel = doc.getElementById('otdrLaunchCableLabel');
  const futSlider = doc.getElementById('otdrLaunchFutSlider');
  const futLabel = doc.getElementById('otdrLaunchFutLabel');
  const tailSlider = doc.getElementById('otdrLaunchTailSlider');
  const tailLabel = doc.getElementById('otdrLaunchTailLabel');
  const nearLossSlider = doc.getElementById('otdrLaunchNearLossSlider');
  const nearLossLabel = doc.getElementById('otdrLaunchNearLossLabel');
  const reflSlider = doc.getElementById('otdrLaunchReflSlider');
  const reflLabel = doc.getElementById('otdrLaunchReflLabel');
  const areaSelect = doc.getElementById('otdrLaunchAreaSelect');
  const techInput = doc.getElementById('otdrLaunchTechInput');

  // SVG Diagram Container
  const diagramWrap = doc.getElementById('otdrLaunchDiagramContainer');

  // Action Buttons
  const resetBtn = doc.getElementById('otdrLaunchResetBtn');
  const saveBtn = doc.getElementById('otdrLaunchSaveBtn');
  const whatsAppBtn = doc.getElementById('otdrLaunchWhatsAppBtn');
  const exportCsvBtn = doc.getElementById('otdrLaunchExportCsvBtn');

  let currentInputs = {
    pulseWidthKey: 'PULSE_30NS',
    fiberTypeKey: 'G652D',
    wavelength: 1310,
    launchCableLengthM: 500,
    futLengthM: 2400,
    tailCableLengthM: 300,
    nearEndLossDb: 0.25,
    nearEndReflectanceDb: -52.0,
    farEndLossDb: 0.28,
    area: 'Shahdara Town',
    technicianName: 'Sajjad Malik'
  };

  function getSavedAudits() {
    if (!storage) return [];
    try {
      const raw = storage.getItem(OTDR_LAUNCH_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveAudit(dyn) {
    if (!storage) return;
    const audits = getSavedAudits();
    const entry = {
      id: 'otdr_launch_' + Date.now(),
      timestamp: new Date().toISOString(),
      area: currentInputs.area,
      technicianName: currentInputs.technicianName,
      pulseWidth: dyn.pulse.label,
      wavelength: dyn.wavelength,
      launchLenM: dyn.launchLenM,
      futLenM: dyn.futLenM,
      tailLenM: dyn.tailLenM,
      nearEndLossDb: dyn.nearEndLossDb,
      nearEndReflectanceDb: dyn.nearEndReflectanceDb,
      farEndLossDb: dyn.farEndLossDb,
      totalLinkLossDb: dyn.totalLinkLossDb,
      ghostEchoDetected: dyn.ghostEchoDetected,
      qualityRating: dyn.qualityRating,
      isOverallPass: dyn.isOverallPass
    };
    audits.unshift(entry);
    if (audits.length > 50) audits.pop();
    storage.setItem(OTDR_LAUNCH_STORAGE_KEY, JSON.stringify(audits));
  }

  function updateUi() {
    const dyn = calculateOtdrLaunchMetrics(currentInputs);

    if (diagramWrap) {
      diagramWrap.innerHTML = renderOtdrLaunchDiagramSvg(dyn);
    }

    if (launchLabel) launchLabel.textContent = `${currentInputs.launchCableLengthM} m`;
    if (futLabel) futLabel.textContent = `${currentInputs.futLengthM} m (${(currentInputs.futLengthM / 1000).toFixed(2)} km)`;
    if (tailLabel) tailLabel.textContent = `${currentInputs.tailCableLengthM} m`;
    if (nearLossLabel) nearLossLabel.textContent = `${currentInputs.nearEndLossDb.toFixed(2)} dB`;
    if (reflLabel) reflLabel.textContent = `${currentInputs.nearEndReflectanceDb.toFixed(1)} dB`;
  }

  function loadPreset(presetId) {
    const p = OTDR_LAUNCH_PRESETS.find(item => item.id === presetId);
    if (!p) return;

    currentInputs = {
      pulseWidthKey: p.pulseWidthKey,
      fiberTypeKey: p.fiberTypeKey,
      wavelength: p.wavelength,
      launchCableLengthM: p.launchCableLengthM,
      futLengthM: p.futLengthM,
      tailCableLengthM: p.tailCableLengthM,
      nearEndLossDb: p.nearEndLossDb,
      nearEndReflectanceDb: p.nearEndReflectanceDb,
      farEndLossDb: p.farEndLossDb,
      area: p.area,
      technicianName: p.technicianName
    };

    if (pulseSelect) pulseSelect.value = currentInputs.pulseWidthKey;
    if (fiberSelect) fiberSelect.value = currentInputs.fiberTypeKey;
    if (waveSelect) waveSelect.value = String(currentInputs.wavelength);
    if (launchSlider) launchSlider.value = String(currentInputs.launchCableLengthM);
    if (futSlider) futSlider.value = String(currentInputs.futLengthM);
    if (tailSlider) tailSlider.value = String(currentInputs.tailCableLengthM);
    if (nearLossSlider) nearLossSlider.value = String(currentInputs.nearEndLossDb);
    if (reflSlider) reflSlider.value = String(currentInputs.nearEndReflectanceDb);
    if (areaSelect) areaSelect.value = currentInputs.area;
    if (techInput) techInput.value = currentInputs.technicianName;

    updateUi();
  }

  // Event Listeners
  if (presetSelect) {
    presetSelect.addEventListener('change', () => loadPreset(presetSelect.value));
  }

  if (pulseSelect) {
    pulseSelect.addEventListener('change', () => {
      currentInputs.pulseWidthKey = pulseSelect.value;
      updateUi();
    });
  }

  if (fiberSelect) {
    fiberSelect.addEventListener('change', () => {
      currentInputs.fiberTypeKey = fiberSelect.value;
      updateUi();
    });
  }

  if (waveSelect) {
    waveSelect.addEventListener('change', () => {
      currentInputs.wavelength = Number(waveSelect.value);
      updateUi();
    });
  }

  if (launchSlider) {
    launchSlider.addEventListener('input', () => {
      currentInputs.launchCableLengthM = Number(launchSlider.value);
      updateUi();
    });
  }

  if (futSlider) {
    futSlider.addEventListener('input', () => {
      currentInputs.futLengthM = Number(futSlider.value);
      updateUi();
    });
  }

  if (tailSlider) {
    tailSlider.addEventListener('input', () => {
      currentInputs.tailCableLengthM = Number(tailSlider.value);
      updateUi();
    });
  }

  if (nearLossSlider) {
    nearLossSlider.addEventListener('input', () => {
      currentInputs.nearEndLossDb = Number(nearLossSlider.value);
      updateUi();
    });
  }

  if (reflSlider) {
    reflSlider.addEventListener('input', () => {
      currentInputs.nearEndReflectanceDb = Number(reflSlider.value);
      updateUi();
    });
  }

  if (areaSelect) {
    areaSelect.addEventListener('change', () => {
      currentInputs.area = areaSelect.value;
    });
  }

  if (techInput) {
    techInput.addEventListener('input', () => {
      currentInputs.technicianName = techInput.value;
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      loadPreset('shahdara-town-feeder-optimal');
      if (presetSelect) presetSelect.value = 'shahdara-town-feeder-optimal';
      if (typeof options.onToast === 'function') {
        options.onToast('OTDR Launch setup reset to Shahdara Town standard baseline.');
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const dyn = calculateOtdrLaunchMetrics(currentInputs);
      saveAudit(dyn);
      if (typeof options.onToast === 'function') {
        options.onToast(`OTDR Launch audit saved (${dyn.isOverallPass ? 'PASS' : 'FAIL'}).`);
      }
    });
  }

  if (whatsAppBtn) {
    whatsAppBtn.addEventListener('click', () => {
      const dyn = calculateOtdrLaunchMetrics(currentInputs);
      const text = formatOtdrLaunchWhatsApp(dyn, currentInputs);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('Bilingual WhatsApp OTDR dispatch copied to clipboard.');
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const audits = getSavedAudits();
      if (!audits.length) {
        const dyn = calculateOtdrLaunchMetrics(currentInputs);
        saveAudit(dyn);
      }
      const csv = generateOtdrLaunchCsv(getSavedAudits());
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(csv).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('OTDR launch audits exported to CSV (copied to clipboard).');
      }
    });
  }

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      updateUi();
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    });
  }

  // Initial render
  updateUi();

  return {
    open: () => {
      updateUi();
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
      }
    },
    close: () => {
      if (modal) {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    },
    update: updateUi,
    getMetrics: () => calculateOtdrLaunchMetrics(currentInputs),
    getSavedAudits
  };
}
