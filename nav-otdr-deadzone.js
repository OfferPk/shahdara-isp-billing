/**
 * Shahdara ISP - Field Optical Time-Domain Reflectometer (OTDR) Dead Zone Eliminator
 * & Pulse Width Calibration Assistant (nav-otdr-deadzone.js)
 *
 * Provides FTTH field technicians, linesmen, and outside plant auditors with:
 * - IEC 61757-1 & Telcordia GR-196-CORE Event Dead Zone (EDZ) & Attenuation Dead Zone (ADZ) Metrology
 * - Multi-tier Pulse Width Calibration (3 ns to 10 µs) balancing spatial resolution vs dynamic range
 * - Launch Cable (Pulse Suppressor Box / Dummy Fiber) length optimization and front-connector blind zone elimination
 * - Splitter penetration analysis (1:4, 1:8, 1:16, 1:32, 1:64 ODN PON stages)
 * - Pure-vector responsive SVG OTDR trace rendering contrasting traces with vs without launch fiber
 * - LocalStorage persistence (shahdara_otdr_deadzone_audits_v1), bilingual WhatsApp dispatch (English/Urdu), and RFC-4180 CSV export
 */

export const OTDR_DEADZONE_STORAGE_KEY = 'shahdara_otdr_deadzone_audits_v1';

export const PULSE_WIDTH_SPECS = {
  PULSE_3NS: {
    id: 'PULSE_3NS',
    pulseWidthNs: 3,
    label: '3 ns (Ultra High-Res · Drop Cables)',
    edzMeters: 0.8,
    adzMeters: 2.8,
    dynamicRangeDb: 14.5,
    minLaunchCableMeters: 50,
    typicalApplication: 'Short customer drops (≤ 150m), internal building risers, and patchcord faults'
  },
  PULSE_5NS: {
    id: 'PULSE_5NS',
    pulseWidthNs: 5,
    label: '5 ns (High-Res · Distribution Leads)',
    edzMeters: 1.2,
    adzMeters: 4.0,
    dynamicRangeDb: 17.0,
    minLaunchCableMeters: 50,
    typicalApplication: 'FAT distribution drop closures and street demarcation pigtails (≤ 500m)'
  },
  PULSE_10NS: {
    id: 'PULSE_10NS',
    pulseWidthNs: 10,
    label: '10 ns (Local Loop Sub-FAT Rings)',
    edzMeters: 1.8,
    adzMeters: 6.5,
    dynamicRangeDb: 20.5,
    minLaunchCableMeters: 100,
    typicalApplication: 'Sector sub-FAT rings, street cabinet distribution cables (≤ 1.5 km)'
  },
  PULSE_30NS: {
    id: 'PULSE_30NS',
    pulseWidthNs: 30,
    label: '30 ns (Standard Distribution Feeder)',
    edzMeters: 3.5,
    adzMeters: 12.0,
    dynamicRangeDb: 24.5,
    minLaunchCableMeters: 150,
    typicalApplication: 'Primary distribution feeders from Central ODF to sector FAT splitters (≤ 4 km)'
  },
  PULSE_100NS: {
    id: 'PULSE_100NS',
    pulseWidthNs: 100,
    label: '100 ns (Medium Trunk & River Spans)',
    edzMeters: 11.5,
    adzMeters: 38.0,
    dynamicRangeDb: 29.0,
    minLaunchCableMeters: 300,
    typicalApplication: 'Metro feeder cables, Ravi aerial river crossings, and 1:8 optical splitters (≤ 10 km)'
  },
  PULSE_300NS: {
    id: 'PULSE_300NS',
    pulseWidthNs: 300,
    label: '300 ns (PON 1:16 / 1:32 Penetration)',
    edzMeters: 32.0,
    adzMeters: 110.0,
    dynamicRangeDb: 33.5,
    minLaunchCableMeters: 500,
    typicalApplication: 'Cascaded PON splitters (1:16 / 1:32), penetrating ~14 to 18 dB insertion loss'
  },
  PULSE_1US: {
    id: 'PULSE_1US',
    pulseWidthNs: 1000,
    label: '1 µs (Long-Haul Metro Ring Bypass)',
    edzMeters: 105.0,
    adzMeters: 350.0,
    dynamicRangeDb: 37.0,
    minLaunchCableMeters: 1000,
    typicalApplication: 'Long-haul metro ring bypass (Begum Kot to Kot Abdul Malik, ≤ 25 km)'
  },
  PULSE_2_5US: {
    id: 'PULSE_2_5US',
    pulseWidthNs: 2500,
    label: '2.5 µs (High-Loss 1:64 ODN & Inter-City)',
    edzMeters: 260.0,
    adzMeters: 850.0,
    dynamicRangeDb: 40.5,
    minLaunchCableMeters: 1500,
    typicalApplication: 'High-density 1:64 splitters and inter-exchange dark fiber trunks (≤ 50 km)'
  }
};

export const DEADZONE_PRESETS = [
  {
    id: 'preset-ftth-drop',
    name: 'Customer Drop Cable (FAT to Home ONT · 85m)',
    fiberLengthMeters: 85,
    pulseId: 'PULSE_3NS',
    launchLengthMeters: 100,
    hasLaunchCable: true,
    hasTailCable: true,
    wavelengthNm: 1310,
    connectorType: 'SC/APC',
    location: 'Shahdara Town House #42, Street 3',
    notes: 'Short drop troubleshooting. Narrow 3ns pulse resolves entrance bend.'
  },
  {
    id: 'preset-fat-feeder',
    name: 'Baradari Feeder Trunk to Sector Splitter (1,450m)',
    fiberLengthMeters: 1450,
    pulseId: 'PULSE_30NS',
    launchLengthMeters: 150,
    hasLaunchCable: true,
    hasTailCable: false,
    wavelengthNm: 1550,
    connectorType: 'SC/UPC',
    location: 'Baradari Main Chowk FAT-08 Pole Box',
    notes: 'Distribution feeder trace. Launch fiber allows true measurement of ODF connector.'
  },
  {
    id: 'preset-ravi-aerial',
    name: 'Ravi Siphon High-Tension Aerial Span (4,200m)',
    fiberLengthMeters: 4200,
    pulseId: 'PULSE_100NS',
    launchLengthMeters: 300,
    hasLaunchCable: true,
    hasTailCable: true,
    wavelengthNm: 1550,
    connectorType: 'FC/UPC',
    location: 'Ravi River Crossing Pylon Tower #12',
    notes: 'Aerial span check. 100ns pulse needed to overcome splice attenuation.'
  },
  {
    id: 'preset-pon-splitter',
    name: 'Begum Kot 1:32 Cascaded PON ODN (7,800m)',
    fiberLengthMeters: 7800,
    pulseId: 'PULSE_300NS',
    launchLengthMeters: 500,
    hasLaunchCable: true,
    hasTailCable: false,
    wavelengthNm: 1625,
    connectorType: 'SC/APC',
    location: 'Begum Kot Sub-Station Central Splitter Rack',
    notes: 'Live-traffic test at 1625nm. 300ns pulse punches through 1:32 splitter.'
  },
  {
    id: 'preset-bypass-trunk',
    name: 'Kot Abdul Malik High-Capacity Trunk (16,200m)',
    fiberLengthMeters: 16200,
    pulseId: 'PULSE_1US',
    launchLengthMeters: 1000,
    hasLaunchCable: true,
    hasTailCable: true,
    wavelengthNm: 1550,
    connectorType: 'LC/UPC',
    location: 'Kot Abdul Malik Highway Junction ODF',
    notes: 'Long-haul trunk trace. 1µs pulse ensures clean SNR at far-end termination.'
  }
];

// In-memory fallback
let inMemoryAudits = [];

/**
 * Calculates complete dead zone metrics, launch fiber adequacy, and trace parameters.
 */
export function calculateDeadZoneMetrics(options = {}) {
  const pulseId = options.pulseId || 'PULSE_3NS';
  const spec = PULSE_WIDTH_SPECS[pulseId] || PULSE_WIDTH_SPECS.PULSE_3NS;
  const fiberLengthMeters = Math.max(10, Number(options.fiberLengthMeters) || 100);
  const launchLengthMeters = Math.max(0, Number(options.launchLengthMeters) || 0);
  const hasLaunchCable = Boolean(options.hasLaunchCable);
  const hasTailCable = Boolean(options.hasTailCable);
  const wavelengthNm = Number(options.wavelengthNm) || 1310;

  const edzMeters = spec.edzMeters;
  const adzMeters = spec.adzMeters;
  const dynamicRangeDb = spec.dynamicRangeDb;

  // Fiber attenuation rate based on wavelength (dB/km)
  const fiberLossDbPerKm = wavelengthNm === 1310 ? 0.35 : wavelengthNm === 1550 ? 0.20 : 0.24;
  const totalFiberAttenuationDb = Math.round(((fiberLengthMeters / 1000) * fiberLossDbPerKm) * 100) / 100;

  // Launch fiber evaluation
  let launchAdequacyVerdict = 'NO_LAUNCH_CABLE';
  let firstConnectorTestable = false;
  let unmeasurableBlindZoneMeters = adzMeters;
  let recommendation = '';

  if (!hasLaunchCable || launchLengthMeters <= 0) {
    launchAdequacyVerdict = 'NO_LAUNCH_CABLE';
    firstConnectorTestable = false;
    unmeasurableBlindZoneMeters = adzMeters;
    recommendation = `CRITICAL: First connector and initial ${adzMeters}m of link are completely submerged in OTDR front-panel dead zone! Attach a ≥ ${spec.minLaunchCableMeters}m launch cable.`;
  } else if (launchLengthMeters < adzMeters) {
    launchAdequacyVerdict = 'UNDERSIZED';
    firstConnectorTestable = false;
    unmeasurableBlindZoneMeters = Math.round((adzMeters - launchLengthMeters) * 10) / 10;
    recommendation = `WARNING: Launch cable (${launchLengthMeters}m) is shorter than Attenuation Dead Zone (${adzMeters}m). First connector loss cannot be accurately measured! Increase launch cable to ≥ ${spec.minLaunchCableMeters}m.`;
  } else {
    launchAdequacyVerdict = 'ADEQUATE';
    firstConnectorTestable = true;
    unmeasurableBlindZoneMeters = 0;
    recommendation = `OPTIMAL: Launch cable (${launchLengthMeters}m) fully clears the Attenuation Dead Zone (${adzMeters}m). First connector loss and reflectance are 100% testable per IEC 61757-1.`;
  }

  // Far-end connector testability
  const endConnectorTestable = hasTailCable;

  // Spatial resolution rating
  let spatialResolutionRating = 'HIGH';
  if (spec.pulseWidthNs >= 1000) {
    spatialResolutionRating = 'VERY_LOW';
  } else if (spec.pulseWidthNs >= 100) {
    spatialResolutionRating = 'MEDIUM';
  } else if (spec.pulseWidthNs >= 30) {
    spatialResolutionRating = 'MODERATE';
  }

  // Maximum testable link length supported by this pulse width dynamic range (assuming 0.35 dB/km + 3 dB margin)
  const maxTestableKm = Math.round(((dynamicRangeDb - 3.0) / 0.35) * 10) / 10;

  return {
    pulseId: spec.id,
    pulseWidthNs: spec.pulseWidthNs,
    pulseLabel: spec.label,
    fiberLengthMeters,
    launchLengthMeters: hasLaunchCable ? launchLengthMeters : 0,
    hasLaunchCable,
    hasTailCable,
    wavelengthNm,
    edzMeters,
    adzMeters,
    dynamicRangeDb,
    minRecommendedLaunchMeters: spec.minLaunchCableMeters,
    fiberLossDbPerKm,
    totalFiberAttenuationDb,
    launchAdequacyVerdict,
    firstConnectorTestable,
    endConnectorTestable,
    unmeasurableBlindZoneMeters,
    spatialResolutionRating,
    maxTestableKm,
    typicalApplication: spec.typicalApplication,
    recommendation
  };
}

/**
 * Saves dead zone audit record into LocalStorage.
 */
export function saveDeadZoneAudit(audit) {
  const record = {
    id: `dz-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...audit
  };

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const existing = getSavedDeadZoneAudits();
      const updated = [record, ...existing].slice(0, 50);
      window.localStorage.setItem(OTDR_DEADZONE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      // Ignore quota errors
    }
  } else {
    inMemoryAudits = [record, ...inMemoryAudits].slice(0, 50);
  }

  return record;
}

/**
 * Retrieves saved dead zone audits.
 */
export function getSavedDeadZoneAudits() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(OTDR_DEADZONE_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  return inMemoryAudits;
}

/**
 * Clears saved dead zone audits.
 */
export function clearDeadZoneAudits() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(OTDR_DEADZONE_STORAGE_KEY);
    } catch (e) {
      // Ignore
    }
  }
  inMemoryAudits = [];
}

/**
 * Generates pure offline responsive SVG OTDR trace contrasting dead zone with vs without launch fiber.
 */
export function renderOtdrDeadzoneTraceSvg(metrics, options = {}) {
  if (!metrics) {
    return `<div class="otdr-empty-chart" style="padding: 24px; text-align: center; color: var(--text-muted, #64748b);">No OTDR dead zone metrics available.</div>`;
  }

  const isDark = Boolean(options.isDark !== undefined ? options.isDark : true);
  const width = options.width || 720;
  const height = options.height || 300;

  const bgGradStart = isDark ? '#0f172a' : '#f8fafc';
  const bgGradEnd = isDark ? '#1e293b' : '#e2e8f0';
  const strokeGrid = isDark ? '#334155' : '#cbd5e1';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  const { edzMeters, adzMeters, hasLaunchCable, launchLengthMeters, fiberLengthMeters, launchAdequacyVerdict } = metrics;

  // Coordinate geometry for trace
  const padLeft = 60;
  const padRight = 30;
  const padTop = 40;
  const padBottom = 50;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const totalVisualMeters = (hasLaunchCable ? launchLengthMeters : 0) + fiberLengthMeters;
  const scaleX = (m) => padLeft + (Math.min(totalVisualMeters, m) / totalVisualMeters) * plotW;
  const scaleY = (db) => padTop + ((20 - db) / 25) * plotH;

  // Trace with Launch Cable (Green)
  let withLaunchPath = '';
  if (hasLaunchCable && launchLengthMeters > 0) {
    // OTDR front connector spike at 0m
    withLaunchPath += `M ${scaleX(0)} ${scaleY(18)} L ${scaleX(edzMeters * 0.3)} ${scaleY(19.5)} L ${scaleX(edzMeters)} ${scaleY(12)} L ${scaleX(adzMeters)} ${scaleY(10)}`;
    // Flat Rayleigh backscatter across launch fiber
    withLaunchPath += ` L ${scaleX(launchLengthMeters)} ${scaleY(9.5)}`;
    // First field connector reflection at end of launch fiber
    withLaunchPath += ` L ${scaleX(launchLengthMeters + edzMeters * 0.2)} ${scaleY(17)} L ${scaleX(launchLengthMeters + edzMeters)} ${scaleY(8.8)} L ${scaleX(launchLengthMeters + adzMeters)} ${scaleY(8.5)}`;
    // Fiber under test Rayleigh slope
    withLaunchPath += ` L ${scaleX(totalVisualMeters)} ${scaleY(5.5)}`;
  } else {
    // Without launch cable
    withLaunchPath += `M ${scaleX(0)} ${scaleY(18)} L ${scaleX(edzMeters * 0.3)} ${scaleY(19.5)} L ${scaleX(edzMeters)} ${scaleY(12)} L ${scaleX(adzMeters)} ${scaleY(9.5)} L ${scaleX(totalVisualMeters)} ${scaleY(5.5)}`;
  }

  // Without Launch Cable Comparison Trace (Red dashed)
  let withoutLaunchPath = `M ${scaleX(0)} ${scaleY(18)} L ${scaleX(edzMeters * 0.3)} ${scaleY(19.5)} L ${scaleX(edzMeters)} ${scaleY(12)} L ${scaleX(adzMeters)} ${scaleY(9.0)} L ${scaleX(totalVisualMeters)} ${scaleY(5.0)}`;

  const statusColor = launchAdequacyVerdict === 'ADEQUATE' ? '#10b981' : launchAdequacyVerdict === 'UNDERSIZED' ? '#f59e0b' : '#ef4444';

  return `
<svg class="otdr-deadzone-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="OTDR Event and Attenuation Dead Zone Trace">
  <defs>
    <linearGradient id="dzBgGrad_${isDark ? 'd' : 'l'}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgGradStart}" />
      <stop offset="100%" stop-color="${bgGradEnd}" />
    </linearGradient>
    <filter id="dzGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background -->
  <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="url(#dzBgGrad_${isDark ? 'd' : 'l'})" stroke="${strokeGrid}" stroke-width="1.2" />

  <!-- Grid Lines -->
  <g stroke="${strokeGrid}" stroke-width="0.8" stroke-dasharray="3,3" opacity="0.6">
    <line x1="${padLeft}" y1="${padTop}" x2="${width - padRight}" y2="${padTop}" />
    <line x1="${padLeft}" y1="${padTop + plotH * 0.33}" x2="${width - padRight}" y2="${padTop + plotH * 0.33}" />
    <line x1="${padLeft}" y1="${padTop + plotH * 0.66}" x2="${width - padRight}" y2="${padTop + plotH * 0.66}" />
    <line x1="${padLeft}" y1="${padTop + plotH}" x2="${width - padRight}" y2="${padTop + plotH}" />

    <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + plotH}" />
    <line x1="${padLeft + plotW * 0.25}" y1="${padTop}" x2="${padLeft + plotW * 0.25}" y2="${padTop + plotH}" />
    <line x1="${padLeft + plotW * 0.5}" y1="${padTop}" x2="${padLeft + plotW * 0.5}" y2="${padTop + plotH}" />
    <line x1="${padLeft + plotW * 0.75}" y1="${padTop}" x2="${padLeft + plotW * 0.75}" y2="${padTop + plotH}" />
    <line x1="${width - padRight}" y1="${padTop}" x2="${width - padRight}" y2="${padTop + plotH}" />
  </g>

  <!-- Attenuation Dead Zone Shaded Blind Box (When no launch cable or undersized) -->
  ${!hasLaunchCable || launchLengthMeters < adzMeters ? `
    <rect x="${padLeft}" y="${padTop}" width="${Math.max(10, (adzMeters / totalVisualMeters) * plotW)}" height="${plotH}" fill="rgba(239, 68, 68, 0.15)" stroke="#ef4444" stroke-dasharray="2,2" stroke-width="1" />
    <text x="${padLeft + 6}" y="${padTop + 16}" font-size="9" font-weight="700" fill="#ef4444">UNMEASURABLE BLIND ZONE (${adzMeters}m ADZ)</text>
  ` : ''}

  <!-- Launch Fiber Demarcation Line (When launch cable attached) -->
  ${hasLaunchCable && launchLengthMeters > 0 ? `
    <line x1="${scaleX(launchLengthMeters)}" y1="${padTop}" x2="${scaleX(launchLengthMeters)}" y2="${padTop + plotH}" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4,4" />
    <text x="${scaleX(launchLengthMeters) + 4}" y="${padTop + 14}" font-size="9" font-weight="700" fill="#10b981">1st Connector (ODF/FAT): ${launchLengthMeters}m [CLEARED]</text>
  ` : ''}

  <!-- OTDR Trace Curves -->
  <!-- Without launch cable (Red dashed comparison) -->
  <path d="${withoutLaunchPath}" fill="none" stroke="#ef4444" stroke-width="1.8" stroke-dasharray="4,4" opacity="0.75" />

  <!-- Active configured trace (Green or Cyan solid) -->
  <path d="${withLaunchPath}" fill="none" stroke="${hasLaunchCable ? '#10b981' : '#06b6d4'}" stroke-width="2.5" />

  <!-- Y-Axis Labels (dB) -->
  <text x="${padLeft - 8}" y="${padTop + 4}" text-anchor="end" font-size="9" fill="${textMuted}">20 dB</text>
  <text x="${padLeft - 8}" y="${padTop + plotH * 0.5}" text-anchor="end" font-size="9" fill="${textMuted}">10 dB</text>
  <text x="${padLeft - 8}" y="${padTop + plotH}" text-anchor="end" font-size="9" fill="${textMuted}">0 dB</text>

  <!-- X-Axis Labels (Meters) -->
  <text x="${padLeft}" y="${height - padBottom + 16}" font-size="9" fill="${textMuted}">0 m (OTDR Port)</text>
  <text x="${padLeft + plotW * 0.5}" y="${height - padBottom + 16}" text-anchor="middle" font-size="9" fill="${textMuted}">${Math.round(totalVisualMeters * 0.5)} m</text>
  <text x="${width - padRight}" y="${height - padBottom + 16}" text-anchor="end" font-size="9" fill="${textMuted}">${Math.round(totalVisualMeters)} m</text>

  <!-- Legend & Header HUD -->
  <g transform="translate(${padLeft}, ${padTop - 18})">
    <text x="0" y="0" font-size="12" font-weight="700" fill="${textColor}">
      Pulse: ${metrics.pulseWidthNs} ns · EDZ: ${edzMeters}m · ADZ: ${adzMeters}m · Launch: ${hasLaunchCable ? launchLengthMeters + 'm' : 'NONE'}
    </text>
    <text x="${plotW}" y="0" text-anchor="end" font-size="11" font-weight="700" fill="${statusColor}">
      Verdict: ${launchAdequacyVerdict} (${metrics.firstConnectorTestable ? '1st Connector TESTABLE' : '1st Connector BLIND'})
    </text>
  </g>

  <!-- Bottom Legend Notes -->
  <g transform="translate(${padLeft}, ${height - 14})">
    <circle cx="5" cy="-4" r="4" fill="#10b981" />
    <text x="14" y="0" font-size="9" fill="${textColor}">Configured Trace (${hasLaunchCable ? 'With Launch Cable' : 'Direct'})</text>
    <line x1="220" y1="-4" x2="245" y2="-4" stroke="#ef4444" stroke-width="2" stroke-dasharray="4,4" />
    <text x="252" y="0" font-size="9" fill="${textColor}">Direct Trace (No Launch Cable - Blind First Connector)</text>
  </g>
</svg>
  `.trim();
}

/**
 * Generates bilingual WhatsApp audit report (English / Roman Urdu).
 */
export function generateDeadzoneWhatsAppReport(metrics, options = {}) {
  const {
    pulseWidthNs,
    edzMeters,
    adzMeters,
    dynamicRangeDb,
    fiberLengthMeters,
    launchLengthMeters,
    hasLaunchCable,
    launchAdequacyVerdict,
    firstConnectorTestable,
    recommendation
  } = metrics;

  const location = options.location || 'Shahdara ISP Field Network';
  const technician = options.technician || 'Technician';

  return `
*SHAHDARA ISP - OTDR DEAD ZONE & PULSE WIDTH AUDIT*
--------------------------------------------------
*Location:* ${location}
*Tech:* ${technician}
*Timestamp:* ${new Date().toLocaleString()}
*Standard:* IEC 61757-1 / Telcordia GR-196-CORE

*CALIBRATION PARAMETERS:*
- Pulse Width: *${pulseWidthNs} ns*
- Event Dead Zone (EDZ): *${edzMeters} m*
- Attenuation Dead Zone (ADZ): *${adzMeters} m*
- Dynamic Range: *${dynamicRangeDb} dB*
- Fiber Under Test Length: *${fiberLengthMeters} m*
- Launch Cable (Dummy Fiber): *${hasLaunchCable ? launchLengthMeters + ' m' : 'NONE (Direct)'}*

*AUDIT VERDICT:*
- Launch Cable Status: *${launchAdequacyVerdict}*
- 1st Connector Testable: *${firstConnectorTestable ? 'YES (CLEARED)' : 'NO (BLIND ZONE)'}*

*TECHNICAL RECOMMENDATION:*
${recommendation}

*URDU SUMMARY:*
${
  firstConnectorTestable
    ? '✅ Launch cable ki lambai ADZ se zyada hai, pehla ODF/FAT connector aur insertion loss bilkul theek measure ho raha hai.'
    : '⚠️ Launch cable na honay ki wajah se pehla connector dead zone me chupa hua hai. Foren launch box lagayen!'
}
--------------------------------------------------
_Generated via Shahdara Mobile Nav Field Suite_
`.trim();
}

/**
 * Exports dead zone audit records as RFC-4180 CSV.
 */
export function exportDeadZoneAuditsCsv(audits = []) {
  const headers = [
    'Timestamp',
    'Location',
    'Pulse Width (ns)',
    'Event Dead Zone (m)',
    'Attenuation Dead Zone (m)',
    'Fiber Length (m)',
    'Launch Cable Length (m)',
    'Launch Verdict',
    '1st Connector Testable',
    'Dynamic Range (dB)',
    'Notes'
  ];

  const rows = audits.map(a => [
    a.timestamp || '',
    a.location || '',
    a.pulseWidthNs || '',
    a.edzMeters || '',
    a.adzMeters || '',
    a.fiberLengthMeters || '',
    a.launchLengthMeters || '',
    a.launchAdequacyVerdict || '',
    a.firstConnectorTestable ? 'TRUE' : 'FALSE',
    a.dynamicRangeDb || '',
    a.notes || ''
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shahdara-otdr-deadzone-audits-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Initializes and wires the Mobile OTDR Dead Zone & Pulse Width modal dialog.
 */
export function setupMobileOtdrDeadzoneModal(options = {}) {
  const modal = document.getElementById('mobileOtdrDeadzoneModal');
  const openBtn = document.getElementById('mobileMoreOtdrDeadzoneBtn');
  const closeBtn = document.getElementById('mobileOtdrDeadzoneModalCloseBtn');

  const presetSelect = document.getElementById('otdrDzPresetSelect');
  const pulseSelect = document.getElementById('otdrDzPulseSelect');
  const lengthRange = document.getElementById('otdrDzLengthRange');
  const lengthValLabel = document.getElementById('otdrDzLengthValLabel');
  const launchToggle = document.getElementById('otdrDzLaunchToggle');
  const launchLengthSelect = document.getElementById('otdrDzLaunchLengthSelect');
  const wavelengthSelect = document.getElementById('otdrDzWavelengthSelect');
  const tailToggle = document.getElementById('otdrDzTailToggle');

  // KPI elements
  const statEdz = document.getElementById('otdrDzStatEdz');
  const statAdz = document.getElementById('otdrDzStatAdz');
  const statFirstConnector = document.getElementById('otdrDzStatFirstConnector');
  const statDynamicRange = document.getElementById('otdrDzStatDynamicRange');
  const statVerdictBadge = document.getElementById('otdrDzStatVerdictBadge');
  const recommendationBox = document.getElementById('otdrDzRecommendationBox');

  // Containers
  const svgContainer = document.getElementById('mobileOtdrDeadzoneModalSvgContainer');

  // Actions
  const saveAuditBtn = document.getElementById('otdrDzSaveAuditBtn');
  const whatsappBtn = document.getElementById('otdrDzWhatsappBtn');
  const exportCsvBtn = document.getElementById('otdrDzExportCsvBtn');

  function calculateCurrent() {
    const pulseId = pulseSelect ? pulseSelect.value : 'PULSE_3NS';
    const fiberLengthMeters = lengthRange ? Number(lengthRange.value) : 100;
    const hasLaunchCable = launchToggle ? Boolean(launchToggle.checked) : true;
    const launchLengthMeters = launchLengthSelect ? Number(launchLengthSelect.value) : 100;
    const hasTailCable = tailToggle ? Boolean(tailToggle.checked) : false;
    const wavelengthNm = wavelengthSelect ? Number(wavelengthSelect.value) : 1310;

    return calculateDeadZoneMetrics({
      pulseId,
      fiberLengthMeters,
      hasLaunchCable,
      launchLengthMeters,
      hasTailCable,
      wavelengthNm
    });
  }

  function updateUi() {
    const isDark = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark');
    const metrics = calculateCurrent();

    if (lengthValLabel && lengthRange) {
      lengthValLabel.textContent = `${lengthRange.value} m`;
    }

    if (statEdz) {
      statEdz.textContent = `${metrics.edzMeters} m`;
    }
    if (statAdz) {
      statAdz.textContent = `${metrics.adzMeters} m`;
    }
    if (statFirstConnector) {
      statFirstConnector.textContent = metrics.firstConnectorTestable ? 'TESTABLE (CLEARED)' : 'BLIND (SUBMERGED)';
      statFirstConnector.className = `optical-evm-stat-val ${metrics.firstConnectorTestable ? 'optimal' : 'critical'}`;
    }
    if (statDynamicRange) {
      statDynamicRange.textContent = `${metrics.dynamicRangeDb} dB (Max ${metrics.maxTestableKm} km)`;
    }
    if (statVerdictBadge) {
      statVerdictBadge.textContent = metrics.launchAdequacyVerdict;
      statVerdictBadge.className = `optical-evm-stat-val ${metrics.launchAdequacyVerdict === 'ADEQUATE' ? 'optimal' : metrics.launchAdequacyVerdict === 'UNDERSIZED' ? 'warning' : 'critical'}`;
    }
    if (recommendationBox) {
      recommendationBox.textContent = metrics.recommendation;
      recommendationBox.className = `otdr-dz-recommendation-box ${metrics.firstConnectorTestable ? 'optimal' : 'critical'}`;
    }

    if (svgContainer) {
      svgContainer.innerHTML = renderOtdrDeadzoneTraceSvg(metrics, { isDark, width: 720, height: 280 });
    }
  }

  // Event Listeners
  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      updateUi();
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

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const preset = DEADZONE_PRESETS.find(p => p.id === presetSelect.value);
      if (preset) {
        if (pulseSelect) pulseSelect.value = preset.pulseId;
        if (lengthRange) lengthRange.value = preset.fiberLengthMeters;
        if (launchToggle) launchToggle.checked = preset.hasLaunchCable;
        if (launchLengthSelect) launchLengthSelect.value = preset.launchLengthMeters;
        if (wavelengthSelect) wavelengthSelect.value = preset.wavelengthNm;
        if (tailToggle) tailToggle.checked = preset.hasTailCable;
        updateUi();
      }
    });
  }

  if (pulseSelect) pulseSelect.addEventListener('change', updateUi);
  if (lengthRange) lengthRange.addEventListener('input', updateUi);
  if (launchToggle) launchToggle.addEventListener('change', updateUi);
  if (launchLengthSelect) launchLengthSelect.addEventListener('change', updateUi);
  if (wavelengthSelect) wavelengthSelect.addEventListener('change', updateUi);
  if (tailToggle) tailToggle.addEventListener('change', updateUi);

  if (saveAuditBtn) {
    saveAuditBtn.addEventListener('click', () => {
      const metrics = calculateCurrent();
      const location = presetSelect ? presetSelect.options[presetSelect.selectedIndex].text : 'Field Link';
      saveDeadZoneAudit({
        location,
        ...metrics
      });
      if (options.onToast) {
        options.onToast('OTDR Dead Zone audit saved to local storage.');
      }
    });
  }

  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
      const metrics = calculateCurrent();
      const location = presetSelect ? presetSelect.options[presetSelect.selectedIndex].text : 'Field Link';
      const report = generateDeadzoneWhatsAppReport(metrics, { location });
      const encoded = encodeURIComponent(report);
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const audits = getSavedDeadZoneAudits();
      if (audits.length === 0) {
        // Save current as sample if none exist
        const metrics = calculateCurrent();
        audits.push({ location: 'Current Field Trace', ...metrics });
      }
      exportDeadZoneAuditsCsv(audits);
    });
  }

  // Initial draw
  updateUi();

  return {
    updateUi,
    calculateCurrent
  };
}
