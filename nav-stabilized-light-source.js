/**
 * Shahdara ISP - Field Stabilized Light Source (SLS) & Modulated Tone Generator Assistant
 *
 * Provides FTTH field engineers, splicers, and linesmen with:
 * - ITU-T G.652.D / IEC 61280-4-1 / TIA-526-14-C calibrated laser light injection metrology
 * - Multi-wavelength FP/DFB laser diode control (1310nm, 1490nm, 1550nm, 1625nm, 1650nm)
 * - Calibrated continuous wave (CW) & modulated tone injection (270 Hz, 1 kHz, 2 kHz)
 * - Laser source thermal stability drift modeling (short-term 15-min and long-term 8-hr drift limits)
 * - Warm-up timer compliance tracking (10-minute warm-up stabilization rule)
 * - Ambient temperature compensation (25°C baseline with ±0.005 dB/°C thermal coefficient)
 * - Far-end OPM loss referencing & live clip-on fiber identifier detection pairing
 * - Interactive pure-vector SVG schematic depicting handheld SLS tester, LCD telemetry, and square-wave pulse trace
 * - LocalStorage audit log (shahdara_sls_tone_generator_audits_v1), bilingual WhatsApp dispatch, and RFC-4180 CSV export
 */

export const SLS_TONE_STORAGE_KEY = 'shahdara_sls_tone_generator_audits_v1';

export const SLS_WAVELENGTHS = {
  WAVE_1310: {
    id: 'WAVE_1310',
    wavelengthNm: 1310,
    name: '1310 nm (O-Band GPON Upstream / P2P)',
    laserType: 'FP (Fabry-Perot Laser Diode)',
    typicalAttenuationDbPerKm: 0.35,
    spectralWidthNm: 2.5,
    laserColor: '#0ea5e9' // Sky blue
  },
  WAVE_1490: {
    id: 'WAVE_1490',
    wavelengthNm: 1490,
    name: '1490 nm (S-Band GPON Downstream Voice/Data)',
    laserType: 'DFB (Distributed Feedback Laser)',
    typicalAttenuationDbPerKm: 0.25,
    spectralWidthNm: 0.8,
    laserColor: '#10b981' // Emerald green
  },
  WAVE_1550: {
    id: 'WAVE_1550',
    wavelengthNm: 1550,
    name: '1550 nm (C-Band RF Overlay / Trunk Feeder)',
    laserType: 'DFB (Distributed Feedback Laser)',
    typicalAttenuationDbPerKm: 0.20,
    spectralWidthNm: 0.6,
    laserColor: '#f59e0b' // Amber/Orange
  },
  WAVE_1625: {
    id: 'WAVE_1625',
    wavelengthNm: 1625,
    name: '1625 nm (U-Band Out-of-Band Monitoring)',
    laserType: 'DFB (Distributed Feedback Laser)',
    typicalAttenuationDbPerKm: 0.23,
    spectralWidthNm: 0.5,
    laserColor: '#a855f7' // Purple
  },
  WAVE_1650: {
    id: 'WAVE_1650',
    wavelengthNm: 1650,
    name: '1650 nm (Filtered In-Service Live Maintenance)',
    laserType: 'DFB with Dielectric Narrow Filter',
    typicalAttenuationDbPerKm: 0.26,
    spectralWidthNm: 0.3,
    laserColor: '#ef4444' // Red
  }
};

export const SLS_MODULATION_MODES = {
  CW: {
    id: 'CW',
    frequencyHz: 0,
    name: 'CW (Continuous Wave - Unmodulated 0 Hz)',
    dutyCyclePercent: 100,
    description: 'Continuous optical carrier for insertion loss (IL) calibration with Optical Power Meter (OPM).'
  },
  TONE_270HZ: {
    id: 'TONE_270HZ',
    frequencyHz: 270,
    name: '270 Hz Modulated Square Wave Tone',
    dutyCyclePercent: 50,
    description: 'Low-frequency tone for legacy audible beepers and clip-on live fiber identifier core tracking.'
  },
  TONE_1KHZ: {
    id: 'TONE_1KHZ',
    frequencyHz: 1000,
    name: '1 kHz (1000 Hz) Modulated Square Wave Tone',
    dutyCyclePercent: 50,
    description: 'Industry standard identification tone for distant FAT port tracing and fiber continuity tagging.'
  },
  TONE_2KHZ: {
    id: 'TONE_2KHZ',
    frequencyHz: 2000,
    name: '2 kHz (2000 Hz) Modulated Square Wave Tone',
    dutyCyclePercent: 50,
    description: 'High-frequency tone for high optical penetration through optical splitters (up to 1:32).'
  }
};

export const SLS_CONNECTOR_TYPES = {
  SC_APC: {
    id: 'SC_APC',
    name: 'SC/APC (8° Angled Physical Contact - Green)',
    returnLossMinDb: 60.0,
    bulkheadLossDb: 0.15
  },
  SC_UPC: {
    id: 'SC_UPC',
    name: 'SC/UPC (Ultra Physical Contact - Blue)',
    returnLossMinDb: 50.0,
    bulkheadLossDb: 0.20
  },
  FC_UPC: {
    id: 'FC_UPC',
    name: 'FC/UPC (Screw-Threaded Metallic)',
    returnLossMinDb: 50.0,
    bulkheadLossDb: 0.20
  }
};

export const SLS_PRESETS = [
  {
    id: 'shahdara-town-olt-reference',
    name: 'Shahdara Town OLT-01 1310nm CW 0.0dBm Reference Standard',
    area: 'Shahdara Town',
    wavelength: 'WAVE_1310',
    modulation: 'CW',
    connectorType: 'SC_APC',
    outputPowerDbm: 0.0,
    warmUpMinutes: 15,
    ambientTempC: 25.0,
    technicianName: 'Arshad Ali (Lead Splicer)',
    notes: 'Reference transmitter calibration at main OLT rack before field Tier-1 insertion loss testing.'
  },
  {
    id: 'ravi-road-1khz-tagging',
    name: 'Ravi Road Feeder-03 1kHz 1550nm Tone Core Tagging',
    area: 'Ravi Road',
    wavelength: 'WAVE_1550',
    modulation: 'TONE_1KHZ',
    connectorType: 'SC_APC',
    outputPowerDbm: -5.0,
    warmUpMinutes: 12,
    ambientTempC: 32.0,
    technicianName: 'Sajjad Malik',
    notes: 'Injecting 1kHz tone from Central ODF to locate feeder core inside roadside Joint Closure JC-14.'
  },
  {
    id: 'begum-kot-2khz-splitter-penetration',
    name: 'Begum Kot 1:16 Splitter 2kHz +3.0dBm High-Penetration Tone',
    area: 'Begum Kot',
    wavelength: 'WAVE_1490',
    modulation: 'TONE_2KHZ',
    connectorType: 'SC_UPC',
    outputPowerDbm: 3.0,
    warmUpMinutes: 10,
    ambientTempC: 28.0,
    technicianName: 'Tariq Mehmood',
    notes: 'High-power 2kHz modulated light injected through 1:16 optical splitter into subscriber drop FATs.'
  },
  {
    id: 'vandala-road-live-1650-filtered',
    name: 'Vandala Road Live In-Service 1650nm Maintenance Source',
    area: 'Vandala Road',
    wavelength: 'WAVE_1650',
    modulation: 'CW',
    connectorType: 'SC_APC',
    outputPowerDbm: -3.0,
    warmUpMinutes: 14,
    ambientTempC: 22.0,
    technicianName: 'Imran Bashir',
    notes: '1650nm filtered optical signal bypasses active 1490/1310nm GPON traffic without customer disruption.'
  },
  {
    id: 'farrukhabad-cold-start-warning',
    name: 'Farrukhabad Cold-Start Insufficient Warm-Up Drift Hazard',
    area: 'Farrukhabad',
    wavelength: 'WAVE_1310',
    modulation: 'CW',
    connectorType: 'SC_APC',
    outputPowerDbm: 0.0,
    warmUpMinutes: 2, // Insufficient warm-up (< 10 min)
    ambientTempC: 41.0, // High heat
    technicianName: 'Zahid Khan',
    notes: 'Source turned on immediately in hot direct sunlight without 10-minute laser thermal equilibrium.'
  }
];

/**
 * Calculates optical power in milliwatts from dBm
 * @param {number} dbm - Power in dBm
 * @returns {number} Power in mW
 */
export function dbmToMilliwatts(dbm) {
  return Math.round(Math.pow(10, dbm / 10) * 1000) / 1000;
}

/**
 * Calculates Stabilized Light Source stability, thermal drift, and operational compliance
 * @param {Object} inputs - User and preset inputs
 * @returns {Object} Calculated metrics
 */
export function calculateSlsMetrics(inputs = {}) {
  const wave = SLS_WAVELENGTHS[inputs.wavelength] || SLS_WAVELENGTHS.WAVE_1310;
  const mod = SLS_MODULATION_MODES[inputs.modulation] || SLS_MODULATION_MODES.CW;
  const conn = SLS_CONNECTOR_TYPES[inputs.connectorType] || SLS_CONNECTOR_TYPES.SC_APC;

  const targetPowerDbm = Number(inputs.outputPowerDbm !== undefined ? inputs.outputPowerDbm : 0.0);
  const warmUpMinutes = Number(inputs.warmUpMinutes !== undefined ? inputs.warmUpMinutes : 12);
  const ambientTempC = Number(inputs.ambientTempC !== undefined ? inputs.ambientTempC : 25.0);

  // 1. Warm-Up Thermal Drift Calculation (IEC 61280-4-1: 10 min minimum warm-up)
  const isWarmedUp = warmUpMinutes >= 10;
  let warmUpDriftPenaltyDb = 0;
  let warmUpAlert = null;

  if (warmUpMinutes < 10) {
    // Laser cavity has not reached internal Peltier/thermistor equilibrium
    warmUpDriftPenaltyDb = Math.round((10 - warmUpMinutes) * 0.02 * 100) / 100;
    warmUpAlert = `Insufficient laser warm-up (${warmUpMinutes} min < 10 min required); laser diode cavity thermally unstable.`;
  }

  // 2. Ambient Temperature Drift Calculation (Reference: 25.0 °C, coefficient 0.005 dB/°C)
  const tempDeltaC = Math.abs(ambientTempC - 25.0);
  const tempDriftPenaltyDb = Math.round((tempDeltaC * 0.005) * 100) / 100;

  // 3. Intrinsic Source Stability Drift over 15 minutes and 8 hours
  const baseShortTermDriftDb = 0.03; // ±0.03 dB nominal
  const totalShortTermDriftDb = Math.round((baseShortTermDriftDb + warmUpDriftPenaltyDb + tempDriftPenaltyDb) * 100) / 100;

  const baseLongTermDriftDb = 0.08; // ±0.08 dB nominal
  const totalLongTermDriftDb = Math.round((baseLongTermDriftDb + (warmUpDriftPenaltyDb * 0.5) + (tempDriftPenaltyDb * 1.2)) * 100) / 100;

  // 4. Effective Output Optical Power at Bulkhead Port (accounting for bulkhead connector loss & drift)
  const effectivePowerDbm = Math.round((targetPowerDbm - conn.bulkheadLossDb) * 100) / 100;
  const effectivePowerMw = dbmToMilliwatts(effectivePowerDbm);

  // 5. Battery Drain & Power Consumption Model
  // Modulation and higher output power consume more battery current
  let batteryCurrentMa = 85; // Base microcontroller and display current
  if (targetPowerDbm > 0) batteryCurrentMa += Math.round(targetPowerDbm * 12);
  if (mod.frequencyHz > 0) batteryCurrentMa += 15; // Modulation switching circuit
  if (ambientTempC > 35) batteryCurrentMa += 25; // Internal TEC cooling circuit activation
  const estimatedBatteryLifeHours = Math.round((2600 / batteryCurrentMa) * 10) / 10; // 2600mAh Li-ion cell

  // 6. Standards Compliance Checks
  // Short-term drift must be <= ±0.05 dB (IEC 61280-4-1 Class 1 Reference Source)
  const isShortTermCompliant = totalShortTermDriftDb <= 0.05;
  // Long-term drift must be <= ±0.10 dB
  const isLongTermCompliant = totalLongTermDriftDb <= 0.10;
  const isTempSafe = ambientTempC >= 0 && ambientTempC <= 45;

  let verdict = 'PASS';
  let verdictColor = '#10b981';
  let statusBadge = 'CALIBRATED & STABLE';

  if (!isWarmedUp || !isShortTermCompliant || !isTempSafe) {
    if (totalShortTermDriftDb > 0.12 || ambientTempC > 45 || warmUpMinutes < 5) {
      verdict = 'FAIL';
      verdictColor = '#ef4444';
      statusBadge = 'EXCESSIVE THERMAL DRIFT';
    } else {
      verdict = 'CAUTION';
      verdictColor = '#f59e0b';
      statusBadge = 'MARGINAL STABILITY';
    }
  }

  return {
    wavelengthId: wave.id,
    wavelengthNm: wave.wavelengthNm,
    wavelengthName: wave.name,
    laserType: wave.laserType,
    laserColor: wave.laserColor,
    typicalAttenuationDbPerKm: wave.typicalAttenuationDbPerKm,

    modulationId: mod.id,
    modulationName: mod.name,
    frequencyHz: mod.frequencyHz,
    dutyCyclePercent: mod.dutyCyclePercent,
    modulationDescription: mod.description,

    connectorId: conn.id,
    connectorName: conn.name,
    returnLossMinDb: conn.returnLossMinDb,
    bulkheadLossDb: conn.bulkheadLossDb,

    targetPowerDbm,
    effectivePowerDbm,
    effectivePowerMw,

    warmUpMinutes,
    isWarmedUp,
    warmUpAlert,

    ambientTempC,
    tempDeltaC,
    isTempSafe,

    totalShortTermDriftDb,
    isShortTermCompliant,
    totalLongTermDriftDb,
    isLongTermCompliant,

    batteryCurrentMa,
    estimatedBatteryLifeHours,

    verdict,
    verdictColor,
    statusBadge
  };
}

/**
 * Renders an interactive, pure-vector SVG schematic depicting the handheld SLS tester front-panel,
 * high-contrast backlit LCD screen, animated optical pulse generator trace, and laser injection path.
 * @param {Object} dynamics - Calculated SLS metrics
 * @param {Object} inputs - Inputs and settings
 * @returns {string} SVG HTML string
 */
export function renderSlsDiagramSvg(dynamics, inputs = {}) {
  const d = dynamics || calculateSlsMetrics(inputs);
  const width = 640;
  const height = 260;

  // Modulated waveform visualizer coordinates
  // Generate square wave pulse path if frequency > 0, flat continuous line if CW
  let waveformPath = '';
  if (d.frequencyHz === 0) {
    // Flat continuous line at y=125
    waveformPath = 'M 350 125 L 590 125';
  } else {
    // Square wave pulses
    const pulseWidth = d.frequencyHz === 270 ? 40 : d.frequencyHz === 1000 ? 20 : 10;
    let x = 350;
    waveformPath = `M ${x} 140`;
    while (x < 590) {
      waveformPath += ` L ${x} 110 L ${Math.min(590, x + pulseWidth)} 110 L ${Math.min(590, x + pulseWidth)} 140 L ${Math.min(590, x + pulseWidth * 2)} 140`;
      x += pulseWidth * 2;
    }
  }

  return `<svg class="sls-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Stabilized Light Source Front-Panel and Waveform Schematic">
    <defs>
      <linearGradient id="chassisGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#334155"/>
        <stop offset="50%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
      <linearGradient id="lcdGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0284c7"/>
        <stop offset="100%" stop-color="#0369a1"/>
      </linearGradient>
      <linearGradient id="wavePanelGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#111827"/>
        <stop offset="100%" stop-color="#030712"/>
      </linearGradient>
      <filter id="laserGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
    </defs>

    <rect width="${width}" height="${height}" rx="10" fill="var(--bg-card, #0f172a)" stroke="var(--border, #334155)"/>

    <!-- TITLE & OVERALL VERDICT -->
    <text x="25" y="28" fill="${d.laserColor}" font-size="12" font-weight="700">STABILIZED LIGHT SOURCE (SLS): ${d.wavelengthNm} nm</text>
    <rect x="${width - 175}" y="12" width="150" height="22" rx="4" fill="${d.verdictColor}" opacity="0.15"/>
    <text x="${width - 100}" y="27" fill="${d.verdictColor}" font-size="10" font-weight="700" text-anchor="middle">${d.statusBadge}</text>

    <!-- SECTION 1: SLS Handheld Tester Chassis (Left Side: x=25 to 320) -->
    <rect x="25" y="45" width="295" height="150" rx="8" fill="url(#chassisGrad)" stroke="#475569" stroke-width="1.5"/>
    <rect x="35" y="55" width="275" height="130" rx="6" fill="url(#lcdGrad)" stroke="#38bdf8" stroke-width="1.5"/>

    <!-- LCD Top Bar: Battery & Laser Active Warning -->
    <text x="45" y="73" fill="#ffffff" font-size="9" font-weight="700" letter-spacing="0.5">SHAHDARA SLS-800 OPTICAL XMTR</text>
    <rect x="235" y="62" width="35" height="14" rx="2" fill="#0f172a" stroke="#ffffff" stroke-width="1"/>
    <rect x="237" y="64" width="25" height="10" rx="1" fill="#10b981"/>
    <text x="275" y="73" fill="#ffffff" font-size="8" font-weight="700">${d.estimatedBatteryLifeHours}h</text>

    <!-- LCD Main Telemetry: Large Wavelength & Modulation Mode -->
    <text x="45" y="105" fill="#f8fafc" font-size="24" font-weight="800">${d.wavelengthNm} <tspan font-size="13" font-weight="600">nm</tspan></text>
    <rect x="180" y="85" width="120" height="26" rx="4" fill="#0f172a" stroke="#38bdf8" stroke-width="1"/>
    <text x="240" y="102" fill="#38bdf8" font-size="11" font-weight="800" text-anchor="middle">${d.frequencyHz === 0 ? 'CW (0 Hz)' : `${d.frequencyHz} Hz`}</text>

    <!-- LCD Bottom Row: Output Power in dBm and mW -->
    <rect x="45" y="122" width="125" height="52" rx="4" fill="rgba(15, 23, 42, 0.75)" stroke="#38bdf8" stroke-width="1"/>
    <text x="55" y="138" fill="#94a3b8" font-size="8">BULKHEAD OUTPUT</text>
    <text x="55" y="160" fill="#ffffff" font-size="15" font-weight="800">${d.effectivePowerDbm >= 0 ? `+${d.effectivePowerDbm}` : d.effectivePowerDbm} dBm</text>
    <text x="125" y="160" fill="#38bdf8" font-size="10" font-weight="700">${d.effectivePowerMw} mW</text>

    <!-- LCD Drift & Warm-up Status Tile -->
    <rect x="180" y="122" width="120" height="52" rx="4" fill="rgba(15, 23, 42, 0.75)" stroke="#38bdf8" stroke-width="1"/>
    <text x="190" y="138" fill="#94a3b8" font-size="8">THERMAL DRIFT (15m)</text>
    <text x="190" y="160" fill="${d.isShortTermCompliant ? '#10b981' : '#f59e0b'}" font-size="14" font-weight="800">±${d.totalShortTermDriftDb} dB</text>

    <!-- SECTION 2: Optical Waveform Oscillogram Panel (Right Side: x=335 to 615) -->
    <rect x="335" y="45" width="280" height="150" rx="8" fill="url(#wavePanelGrad)" stroke="#475569" stroke-width="1.5"/>
    <text x="345" y="65" fill="#94a3b8" font-size="9" font-weight="700">CARRIER / MODULATED TONE WAVEFORM</text>

    <!-- Oscilloscope Grid Lines -->
    <line x1="345" y1="100" x2="605" y2="100" stroke="#1e293b" stroke-width="1" stroke-dasharray="2,2"/>
    <line x1="345" y1="125" x2="605" y2="125" stroke="#334155" stroke-width="1"/>
    <line x1="345" y1="150" x2="605" y2="150" stroke="#1e293b" stroke-width="1" stroke-dasharray="2,2"/>

    <line x1="410" y1="75" x2="410" y2="175" stroke="#1e293b" stroke-width="1" stroke-dasharray="2,2"/>
    <line x1="475" y1="75" x2="475" y2="175" stroke="#1e293b" stroke-width="1" stroke-dasharray="2,2"/>
    <line x1="540" y1="75" x2="540" y2="175" stroke="#1e293b" stroke-width="1" stroke-dasharray="2,2"/>

    <!-- Waveform Trace -->
    <path d="${waveformPath}" stroke="${d.laserColor}" stroke-width="2.5" fill="none" stroke-linejoin="round" filter="url(#laserGlow)"/>

    <!-- Frequency & Duty Cycle Badges -->
    <rect x="345" y="165" width="125" height="22" rx="3" fill="#1e293b"/>
    <text x="407" y="180" fill="#e2e8f0" font-size="8.5" font-weight="700" text-anchor="middle">Modulation: ${d.modulationId}</text>

    <rect x="480" y="165" width="125" height="22" rx="3" fill="#1e293b"/>
    <text x="542" y="180" fill="#e2e8f0" font-size="8.5" font-weight="700" text-anchor="middle">Duty Cycle: ${d.dutyCyclePercent}%</text>

    <!-- BOTTOM METRICS TILE ROW (x=25 to 615, y=205 to 248) -->
    <rect x="25" y="205" width="135" height="43" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="35" y="220" fill="var(--text-muted, #94a3b8)" font-size="8">LASER CAVITY TYPE</text>
    <text x="35" y="238" fill="#38bdf8" font-size="11" font-weight="700">${d.laserType.split(' ')[0]} Diode</text>

    <rect x="170" y="205" width="140" height="43" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="180" y="220" fill="var(--text-muted, #94a3b8)" font-size="8">WARM-UP STABILIZATION</text>
    <text x="180" y="238" fill="${d.isWarmedUp ? '#10b981' : '#f59e0b'}" font-size="11" font-weight="700">${d.warmUpMinutes} min <tspan font-size="8.5" fill="var(--text-muted, #94a3b8)">(min 10m)</tspan></text>

    <rect x="320" y="205" width="140" height="43" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="330" y="220" fill="var(--text-muted, #94a3b8)" font-size="8">AMBIENT TEMP / DRIFT</text>
    <text x="330" y="238" fill="${d.isTempSafe ? '#10b981' : '#ef4444'}" font-size="11" font-weight="700">${d.ambientTempC}°C <tspan font-size="8.5" fill="var(--text-muted, #94a3b8)">(Δ${d.tempDeltaC}°C)</tspan></text>

    <rect x="470" y="205" width="145" height="43" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="480" y="220" fill="var(--text-muted, #94a3b8)" font-size="8">LONG-TERM 8HR DRIFT</text>
    <text x="480" y="238" fill="${d.isLongTermCompliant ? '#10b981' : '#f59e0b'}" font-size="11" font-weight="700">±${d.totalLongTermDriftDb} dB <tspan font-size="8.5" fill="var(--text-muted, #94a3b8)">(≤0.10)</tspan></text>
  </svg>`;
}

/**
 * Formats a bilingual WhatsApp dispatch message for the light source and tone test
 * @param {Object} dynamics - Calculated metrics
 * @param {Object} inputs - Inputs and metadata
 * @returns {string} WhatsApp text
 */
export function formatSlsToneWhatsApp(dynamics, inputs = {}) {
  const d = dynamics || calculateSlsMetrics();
  const tech = inputs.technicianName || 'Field Linesman';
  const area = inputs.area || 'Shahdara Town';
  const notes = inputs.notes || 'None';

  return `*SHAHDARA ISP - STABILIZED LIGHT SOURCE (SLS) REPORT*
*شاہدرا آئی ایس پی - مستحکم لائٹ سورس اور ٹون جنریٹر رپورٹ*
---------------------------------------
*Date / تاریخ:* ${new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
*Technician / ٹیکنیشن:* ${tech}
*Area / علاقہ:* ${area}
*Wavelength / طول موج:* ${d.wavelengthNm} nm (${d.laserType})
*Modulation / ٹون:* ${d.modulationName}
*Bulkhead Connector:* ${d.connectorName}
---------------------------------------
*OPTICAL TRANSMISSION TELEMETRY:*
- Target Power: ${d.targetPowerDbm} dBm
- Effective Bulkhead Output: ${d.effectivePowerDbm} dBm (${d.effectivePowerMw} mW)
- Laser Warm-up Time: ${d.warmUpMinutes} minutes (Standard: >= 10 mins)
- Ambient Temperature: ${d.ambientTempC} °C
- Short-Term 15-min Stability: ±${d.totalShortTermDriftDb} dB [Limit: <= 0.05 dB] -> *${d.isShortTermCompliant ? 'PASS' : 'WARN'}*
- Long-Term 8-hour Stability: ±${d.totalLongTermDriftDb} dB [Limit: <= 0.10 dB] -> *${d.isLongTermCompliant ? 'PASS' : 'WARN'}*
- Source Qualification Verdict: *${d.verdict}* (${d.statusBadge})
${d.warmUpAlert ? `*Thermal Alert:* ${d.warmUpAlert}` : ''}
*Field Notes:* ${notes}
---------------------------------------
_Standard: ITU-T G.652.D / IEC 61280-4-1 / TIA-526-14-C_
_Shahdara ISP Field Network Operations Center_`;
}

/**
 * Loads audit log from localStorage
 * @param {Storage} storage - Storage backend
 * @returns {Array} Array of audit entries
 */
export function loadSlsToneAuditLog(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(SLS_TONE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves audit log to localStorage
 * @param {Object} audit - Audit record
 * @param {Storage} storage - Storage backend
 * @returns {Array} Updated audits
 */
export function saveSlsToneAuditLog(audit, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  const current = loadSlsToneAuditLog(storage);
  const entry = {
    id: `sls-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ...audit
  };
  const updated = [entry, ...current].slice(0, 50);
  try {
    storage.setItem(SLS_TONE_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}

/**
 * Clears audit log from localStorage
 * @param {Storage} storage - Storage backend
 */
export function clearSlsToneAuditLog(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.removeItem(SLS_TONE_STORAGE_KEY);
  } catch {}
}

/**
 * Exports SLS audits as RFC-4180 CSV with UTF-8 BOM
 * @param {Array} audits - List of audits
 * @returns {string} CSV text
 */
export function generateSlsToneCsv(audits = []) {
  const headers = [
    'Audit_ID',
    'Timestamp',
    'Technician',
    'Area',
    'Wavelength_nm',
    'Modulation_Mode',
    'Connector_Type',
    'Target_Power_dBm',
    'Effective_Power_dBm',
    'Warm_Up_Minutes',
    'Ambient_Temp_C',
    'Short_Term_Drift_dB',
    'Verdict',
    'Notes'
  ];

  const rows = (audits || []).map(a => [
    `"${a.id || ''}"`,
    `"${a.timestamp || ''}"`,
    `"${(a.technicianName || '').replace(/"/g, '""')}"`,
    `"${(a.area || '').replace(/"/g, '""')}"`,
    a.wavelengthNm || 1310,
    `"${a.modulationId || a.modulation || ''}"`,
    `"${a.connectorId || a.connectorType || ''}"`,
    a.targetPowerDbm !== undefined ? a.targetPowerDbm : 0.0,
    a.effectivePowerDbm !== undefined ? a.effectivePowerDbm : 0.0,
    a.warmUpMinutes || 0,
    a.ambientTempC || 25,
    a.totalShortTermDriftDb || 0,
    `"${a.verdict || ''}"`,
    `"${(a.notes || '').replace(/"/g, '""')}"`
  ].join(','));

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Controller for Mobile Stabilized Light Source (SLS) Modal
 * @param {Object} state - Application state
 * @param {Object} options - Controller options (document, storage, onToast)
 * @returns {Object} Controller interface
 */
export function setupMobileSlsToneModal(state, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

  const modal = doc.getElementById('mobileSlsToneModal');
  const closeBtn = doc.getElementById('mobileSlsToneModalCloseBtn');
  const openBtn = doc.getElementById('mobileMoreSlsToneBtn');

  // Input Elements
  const presetSelect = doc.getElementById('slsPresetSelect');
  const areaSelect = doc.getElementById('slsAreaSelect');
  const techInput = doc.getElementById('slsTechInput');
  const waveSelect = doc.getElementById('slsWaveSelect');
  const modSelect = doc.getElementById('slsModSelect');
  const connSelect = doc.getElementById('slsConnSelect');
  const powerSlider = doc.getElementById('slsPowerSlider');
  const powerLabel = doc.getElementById('slsPowerLabel');
  const warmUpSlider = doc.getElementById('slsWarmUpSlider');
  const warmUpLabel = doc.getElementById('slsWarmUpLabel');
  const tempSlider = doc.getElementById('slsTempSlider');
  const tempLabel = doc.getElementById('slsTempLabel');
  const notesInput = doc.getElementById('slsNotesInput');

  // Action Buttons
  const resetBtn = doc.getElementById('slsResetBtn');
  const saveBtn = doc.getElementById('slsSaveBtn');
  const whatsAppBtn = doc.getElementById('slsWhatsAppBtn');
  const exportCsvBtn = doc.getElementById('slsExportCsvBtn');

  // Output Elements
  const diagramContainer = doc.getElementById('slsDiagramContainer');
  const historyTbody = doc.getElementById('slsHistoryTbody');
  const historySearch = doc.getElementById('slsHistorySearch');
  const historyVerdictFilter = doc.getElementById('slsHistoryVerdictFilter');

  let currentInputs = {
    wavelength: 'WAVE_1310',
    modulation: 'CW',
    connectorType: 'SC_APC',
    outputPowerDbm: 0.0,
    warmUpMinutes: 15,
    ambientTempC: 25.0,
    technicianName: 'Arshad Ali',
    area: 'Shahdara Town',
    notes: ''
  };

  function loadPreset(presetId) {
    const p = SLS_PRESETS.find(item => item.id === presetId) || SLS_PRESETS[0];
    currentInputs = {
      wavelength: p.wavelength,
      modulation: p.modulation,
      connectorType: p.connectorType,
      outputPowerDbm: p.outputPowerDbm,
      warmUpMinutes: p.warmUpMinutes,
      ambientTempC: p.ambientTempC,
      technicianName: p.technicianName,
      area: p.area,
      notes: p.notes
    };
    syncInputsToUi();
    updateUi();
  }

  function syncInputsToUi() {
    if (areaSelect) areaSelect.value = currentInputs.area;
    if (techInput) techInput.value = currentInputs.technicianName;
    if (waveSelect) waveSelect.value = currentInputs.wavelength;
    if (modSelect) modSelect.value = currentInputs.modulation;
    if (connSelect) connSelect.value = currentInputs.connectorType;
    if (powerSlider) powerSlider.value = String(currentInputs.outputPowerDbm);
    if (powerLabel) powerLabel.textContent = `${currentInputs.outputPowerDbm >= 0 ? `+${currentInputs.outputPowerDbm}` : currentInputs.outputPowerDbm} dBm`;
    if (warmUpSlider) warmUpSlider.value = String(currentInputs.warmUpMinutes);
    if (warmUpLabel) warmUpLabel.textContent = `${currentInputs.warmUpMinutes} min`;
    if (tempSlider) tempSlider.value = String(currentInputs.ambientTempC);
    if (tempLabel) tempLabel.textContent = `${currentInputs.ambientTempC}°C`;
    if (notesInput) notesInput.value = currentInputs.notes || '';
  }

  function syncInputsFromUi() {
    if (areaSelect) currentInputs.area = areaSelect.value;
    if (techInput) currentInputs.technicianName = techInput.value;
    if (waveSelect) currentInputs.wavelength = waveSelect.value;
    if (modSelect) currentInputs.modulation = modSelect.value;
    if (connSelect) currentInputs.connectorType = connSelect.value;
    if (powerSlider) currentInputs.outputPowerDbm = Number(powerSlider.value);
    if (warmUpSlider) currentInputs.warmUpMinutes = Number(warmUpSlider.value);
    if (tempSlider) currentInputs.ambientTempC = Number(tempSlider.value);
    if (notesInput) currentInputs.notes = notesInput.value;
  }

  function renderHistoryTable() {
    if (!historyTbody) return;
    const audits = loadSlsToneAuditLog(storage);
    const search = (historySearch?.value || '').toLowerCase().trim();
    const verdictFilter = historyVerdictFilter?.value || 'ALL';

    const filtered = audits.filter(a => {
      const matchSearch = !search ||
        (a.technicianName && a.technicianName.toLowerCase().includes(search)) ||
        (a.area && a.area.toLowerCase().includes(search)) ||
        (a.notes && a.notes.toLowerCase().includes(search));
      const matchVerdict = verdictFilter === 'ALL' || a.verdict === verdictFilter;
      return matchSearch && matchVerdict;
    });

    if (filtered.length === 0) {
      historyTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted,#94a3b8);padding:12px;">No SLS transmitter audits recorded.</td></tr>`;
      return;
    }

    historyTbody.innerHTML = filtered.map(a => `
      <tr style="border-bottom:1px solid var(--border,#334155);font-size:11px;">
        <td style="padding:6px 8px;">${a.timestamp ? a.timestamp.slice(0, 16).replace('T', ' ') : 'Just now'}</td>
        <td style="padding:6px 8px;">${a.technicianName || 'Tech'}</td>
        <td style="padding:6px 8px;">${a.area || 'Shahdara'}</td>
        <td style="padding:6px 8px;">${a.wavelengthNm || 1310} nm (${a.modulationId || 'CW'})</td>
        <td style="padding:6px 8px;font-weight:700;">${a.effectivePowerDbm || 0} dBm</td>
        <td style="padding:6px 8px;"><span style="color:${a.verdict === 'PASS' ? '#10b981' : a.verdict === 'CAUTION' ? '#f59e0b' : '#ef4444'};font-weight:700;">${a.verdict || 'PASS'}</span></td>
        <td style="padding:6px 8px;">
          <button class="sls-inspect-btn secondary-button" data-audit-id="${a.id}" type="button" style="padding:2px 6px;font-size:10px;">Inspect</button>
        </td>
      </tr>
    `).join('');

    // Wire inspect buttons
    historyTbody.querySelectorAll('.sls-inspect-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const auditId = btn.getAttribute('data-audit-id');
        const item = audits.find(x => x.id === auditId);
        if (item) {
          currentInputs = {
            wavelength: item.wavelength || item.wavelengthId || 'WAVE_1310',
            modulation: item.modulation || item.modulationId || 'CW',
            connectorType: item.connectorType || item.connectorId || 'SC_APC',
            outputPowerDbm: item.targetPowerDbm !== undefined ? item.targetPowerDbm : 0.0,
            warmUpMinutes: item.warmUpMinutes || 15,
            ambientTempC: item.ambientTempC || 25.0,
            technicianName: item.technicianName || 'Tech',
            area: item.area || 'Shahdara Town',
            notes: item.notes || ''
          };
          syncInputsToUi();
          updateUi();
        }
      });
    });
  }

  function updateUi() {
    syncInputsFromUi();
    const dynamics = calculateSlsMetrics(currentInputs);

    if (powerLabel) powerLabel.textContent = `${currentInputs.outputPowerDbm >= 0 ? `+${currentInputs.outputPowerDbm}` : currentInputs.outputPowerDbm} dBm`;
    if (warmUpLabel) warmUpLabel.textContent = `${currentInputs.warmUpMinutes} min`;
    if (tempLabel) tempLabel.textContent = `${currentInputs.ambientTempC}°C`;

    if (diagramContainer) {
      diagramContainer.innerHTML = renderSlsDiagramSvg(dynamics, currentInputs);
    }

    renderHistoryTable();
  }

  // Event Listeners
  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      loadPreset(presetSelect.value);
    });
  }

  [areaSelect, techInput, waveSelect, modSelect, connSelect, notesInput].forEach(el => {
    if (el) {
      el.addEventListener('change', updateUi);
      el.addEventListener('input', updateUi);
    }
  });

  if (powerSlider) {
    powerSlider.addEventListener('input', () => {
      currentInputs.outputPowerDbm = Number(powerSlider.value);
      if (powerLabel) powerLabel.textContent = `${currentInputs.outputPowerDbm >= 0 ? `+${currentInputs.outputPowerDbm}` : currentInputs.outputPowerDbm} dBm`;
      updateUi();
    });
  }

  if (warmUpSlider) {
    warmUpSlider.addEventListener('input', () => {
      currentInputs.warmUpMinutes = Number(warmUpSlider.value);
      if (warmUpLabel) warmUpLabel.textContent = `${currentInputs.warmUpMinutes} min`;
      updateUi();
    });
  }

  if (tempSlider) {
    tempSlider.addEventListener('input', () => {
      currentInputs.ambientTempC = Number(tempSlider.value);
      if (tempLabel) tempLabel.textContent = `${currentInputs.ambientTempC}°C`;
      updateUi();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      loadPreset('shahdara-town-olt-reference');
      if (presetSelect) presetSelect.value = 'shahdara-town-olt-reference';
      if (typeof options.onToast === 'function') {
        options.onToast('SLS parameters reset to reference baseline.');
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const dynamics = calculateSlsMetrics(currentInputs);
      saveSlsToneAuditLog({ ...currentInputs, ...dynamics }, storage);
      renderHistoryTable();
      if (typeof options.onToast === 'function') {
        options.onToast(`SLS transmitter audit saved (${dynamics.verdict}).`);
      }
    });
  }

  if (whatsAppBtn) {
    whatsAppBtn.addEventListener('click', () => {
      const dynamics = calculateSlsMetrics(currentInputs);
      const msg = formatSlsToneWhatsApp(dynamics, currentInputs);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(msg).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('WhatsApp dispatch copied to clipboard.');
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      let audits = loadSlsToneAuditLog(storage);
      if (audits.length === 0) {
        const dynamics = calculateSlsMetrics(currentInputs);
        audits = saveSlsToneAuditLog({ ...currentInputs, ...dynamics }, storage);
      }
      const csv = generateSlsToneCsv(audits);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(csv).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('CSV exported to clipboard.');
      }
    });
  }

  if (historySearch) {
    historySearch.addEventListener('input', renderHistoryTable);
  }

  if (historyVerdictFilter) {
    historyVerdictFilter.addEventListener('change', renderHistoryTable);
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
    getMetrics: () => calculateSlsMetrics(currentInputs),
    getSavedAudits: () => loadSlsToneAuditLog(storage)
  };
}
