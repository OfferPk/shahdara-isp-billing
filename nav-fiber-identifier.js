/**
 * Shahdara ISP - Field Optical Live Fiber Traffic Identifier & Tone Detector Assistant
 * 
 * Provides FTTH linemen, splicers, and field technicians with:
 * - ITU-T L.40 / Telcordia GR-765-CORE non-invasive macro-bend clamp-on live fiber detection
 * - Optical traffic power sensing (-50 dBm to +10 dBm) and transmission direction (L->R or R->L)
 * - 270 Hz, 1 kHz, and 2 kHz modulated core-tracing tone detection
 * - Interlocking Safe-to-Cut / Active Traffic protection warning to prevent accidental subscriber outages
 * - Clamp adapter heads: 250 µm bare fiber, 900 µm tight buffer, 2.0 mm / 3.0 mm jacketed cord
 * - Vector SVG clamp-on mandrel, dual photodiode sensor leakage, and LCD digital readout visualizer
 * - LocalStorage persistence (shahdara_fiber_identifier_audits_v1), WhatsApp dispatch tickets, and CSV export
 */

export const FIBER_IDENTIFIER_STORAGE_KEY = 'shahdara_fiber_identifier_audits_v1';

export const CLAMP_ADAPTER_HEADS = {
  HEAD_250UM: {
    id: 'HEAD_250UM',
    name: '250 µm Bare Fiber (Buffer Tube)',
    diameterUm: 250,
    maxInsertionLossDb: 0.3,
    color: '#38bdf8',
    description: 'Precision micro-mandrel for bare 250 µm primary coated fiber extracted from ribbon or loose tube.'
  },
  HEAD_900UM: {
    id: 'HEAD_900UM',
    name: '900 µm Tight Buffer (Pigtail)',
    diameterUm: 900,
    maxInsertionLossDb: 0.5,
    color: '#10b981',
    description: 'Standard clamp groove for 900 µm colored pigtails and fan-out kit buffer tubes inside FDT/FAT.'
  },
  HEAD_2000UM: {
    id: 'HEAD_2000UM',
    name: '2.0 mm Simplex / Duplex Cord',
    diameterUm: 2000,
    maxInsertionLossDb: 0.8,
    color: '#fbbf24',
    description: 'Jacketed cord clamp for intra-rack jumpers and ODF patch cords.'
  },
  HEAD_3000UM: {
    id: 'HEAD_3000UM',
    name: '3.0 mm FTTH Drop Cable Jacket',
    diameterUm: 3000,
    maxInsertionLossDb: 1.0,
    color: '#a855f7',
    description: 'Reinforced clamp groove for heavy LSZH/PVC drop cables and indoor riser distribution spans.'
  }
};

export const DETECTED_SIGNAL_MODES = {
  DARK: {
    id: 'DARK',
    name: 'Dark Fiber (Idle / No Traffic)',
    minDbm: -99,
    maxDbm: -45,
    safeToCut: true,
    toneFreqHz: 0,
    color: '#10b981',
    description: 'Zero optical power detected. Safe for mechanical cleaving, splicing, or tray rearrangement.'
  },
  CW_TRAFFIC: {
    id: 'CW_TRAFFIC',
    name: 'Live CW Digital Traffic (Active Subscriber)',
    minDbm: -45,
    maxDbm: 15,
    safeToCut: false,
    toneFreqHz: 0,
    color: '#ef4444',
    description: 'Active GPON/XGS-PON or Ethernet traffic detected. CUTTING WILL CAUSE SUBSCRIBER OUTAGE!'
  },
  TONE_270HZ: {
    id: 'TONE_270HZ',
    name: '270 Hz Modulated Tracing Tone',
    minDbm: -40,
    maxDbm: 10,
    safeToCut: false,
    toneFreqHz: 270,
    color: '#f59e0b',
    description: 'Low-frequency test modulation emitted by central OLT or remote OLS source.'
  },
  TONE_1KHZ: {
    id: 'TONE_1KHZ',
    name: '1 kHz Modulated Tracing Tone',
    minDbm: -40,
    maxDbm: 10,
    safeToCut: false,
    toneFreqHz: 1000,
    color: '#fbbf24',
    description: 'Standard audio-range core tracing tone for high-density splice identification.'
  },
  TONE_2KHZ: {
    id: 'TONE_2KHZ',
    name: '2 kHz Modulated Tracing Tone',
    minDbm: -40,
    maxDbm: 10,
    safeToCut: false,
    toneFreqHz: 2000,
    color: '#a855f7',
    description: 'High-frequency tracing tone; distinguishes upstream from downstream test tones.'
  }
};

export const TRAFFIC_DIRECTIONS = {
  LEFT_TO_RIGHT: {
    id: 'LEFT_TO_RIGHT',
    name: 'Left-to-Right (Downstream OLT ➔ ONU)',
    symbol: 'L ➔ R',
    arrowText: '▶ FORWARD (Downstream)',
    description: 'Optical photons propagating from End A toward End B.'
  },
  RIGHT_TO_LEFT: {
    id: 'RIGHT_TO_LEFT',
    name: 'Right-to-Left (Upstream ONU ➔ OLT)',
    symbol: 'R ➔ L',
    arrowText: '◀ REVERSE (Upstream)',
    description: 'Optical photons propagating from End B toward End A.'
  },
  NONE: {
    id: 'NONE',
    name: 'No Directional Flow (Dark / Undetermined)',
    symbol: '—',
    arrowText: '— (No Flow)',
    description: 'Optical power below detection threshold.'
  }
};

export const IDENTIFIER_PRESETS = {
  ACTIVE_GPON_DOWNSTREAM: {
    id: 'ACTIVE_GPON_DOWNSTREAM',
    name: 'Active GPON Customer Drop Core (Begum Kot)',
    headId: 'HEAD_900UM',
    opticalPowerDbm: -18.5,
    signalModeId: 'CW_TRAFFIC',
    directionId: 'LEFT_TO_RIGHT',
    wavelengthNm: 1490,
    description: 'Live GPON customer connection with downstream data flowing from OLT to subscriber ONU.'
  },
  TEST_TONE_1KHZ_FDT: {
    id: 'TEST_TONE_1KHZ_FDT',
    name: 'FDT-04 Core Tracing (1 kHz Tone Injection)',
    headId: 'HEAD_250UM',
    opticalPowerDbm: -12.0,
    signalModeId: 'TONE_1KHZ',
    directionId: 'LEFT_TO_RIGHT',
    wavelengthNm: 1310,
    description: 'Technician tracing specific trunk core using 1 kHz modulated test source from ODF.'
  },
  DARK_SPARE_CORE: {
    id: 'DARK_SPARE_CORE',
    name: 'Dark Spare Core in 24-Fiber Trunk',
    headId: 'HEAD_250UM',
    opticalPowerDbm: -55.0,
    signalModeId: 'DARK',
    directionId: 'NONE',
    wavelengthNm: 1550,
    description: 'Unlit reserve buffer core ready for new customer drop connection or splice extension.'
  },
  HIGH_POWER_FEEDER: {
    id: 'HIGH_POWER_FEEDER',
    name: 'High-Power OLT EDFA Booster Trunk (+4.5 dBm)',
    headId: 'HEAD_2000UM',
    opticalPowerDbm: 4.5,
    signalModeId: 'CW_TRAFFIC',
    directionId: 'LEFT_TO_RIGHT',
    wavelengthNm: 1550,
    description: 'Amplified CATV / video overlay trunk; high optical power requires eye safety precautions.'
  },
  REVERSE_UPSTREAM_BURST: {
    id: 'REVERSE_UPSTREAM_BURST',
    name: 'Upstream ONT Burst Signal to Central OLT',
    headId: 'HEAD_900UM',
    opticalPowerDbm: -22.4,
    signalModeId: 'CW_TRAFFIC',
    directionId: 'RIGHT_TO_LEFT',
    wavelengthNm: 1310,
    description: 'TDMA upstream laser transmission propagating back toward the central office OLT.'
  }
};

/**
 * Evaluate Optical Live Fiber Detection Dynamics
 */
export function evaluateLiveFiberDetection({
  opticalPowerDbm = -18.5,
  signalModeId = 'CW_TRAFFIC',
  directionId = 'LEFT_TO_RIGHT',
  headId = 'HEAD_900UM',
  wavelengthNm = 1310
} = {}) {
  const power = Number(opticalPowerDbm) || -50.0;
  const head = CLAMP_ADAPTER_HEADS[headId] || CLAMP_ADAPTER_HEADS.HEAD_900UM;
  const mode = DETECTED_SIGNAL_MODES[signalModeId] || DETECTED_SIGNAL_MODES.CW_TRAFFIC;
  const dir = TRAFFIC_DIRECTIONS[directionId] || TRAFFIC_DIRECTIONS.LEFT_TO_RIGHT;

  // Interlock logic: Dark fiber vs Live active traffic
  const isActuallyDark = power <= -45.0 || signalModeId === 'DARK';
  const safeToCut = isActuallyDark;

  let statusText = 'ACTIVE TRAFFIC DETECTED';
  let badgeClass = 'badge-fail';
  let statusColor = '#ef4444';
  let audioBeepCadence = 'Continuous Beep (Traffic Alert)';
  let advisoryUrdu = '⚠️ خبردار: فائبر پر لائیو ٹریفک موجود ہے! اس فائبر کو ہرگز نہ کاٹیں۔ کسٹمر سروس منقطع ہو جائے گی۔';

  if (isActuallyDark) {
    statusText = 'DARK FIBER (SAFE TO CUT)';
    badgeClass = 'badge-pass';
    statusColor = '#10b981';
    audioBeepCadence = 'Silent (No Tone)';
    advisoryUrdu = '✅ تسلی بخش: فائبر ڈارک ہے۔ یہ کور کٹنگ، ری راؤٹنگ اور سپلائسنگ کے لیے محفوظ ہے۔';
  } else if (signalModeId.startsWith('TONE_')) {
    statusText = `TEST TONE DETECTED (${mode.toneFreqHz} Hz)`;
    badgeClass = 'badge-warning';
    statusColor = '#f59e0b';
    audioBeepCadence = `Pulsing at ${mode.toneFreqHz} Hz`;
    advisoryUrdu = `⚠️ ٹیسٹ ٹون شناخت ہو گئی ہے (${mode.toneFreqHz} Hz)۔ یہ ریموٹ سورس کی ٹریسنگ کور ہے۔`;
  }

  // Estimated insertion loss induced by the clamp-on macro-bend
  const clampInducedLossDb = head.maxInsertionLossDb;

  let diagnostics = [];
  if (isActuallyDark) {
    diagnostics.push(`Optical power is below detection floor (${power.toFixed(1)} dBm). Core is safe for maintenance.`);
  } else {
    diagnostics.push(`Live signal detected at ${power.toFixed(1)} dBm (${wavelengthNm} nm). Clamping induced ~${clampInducedLossDb} dB macro-bend loss.`);
    if (signalModeId === 'CW_TRAFFIC') {
      diagnostics.push(`Continuous wave transmission indicates operational data carrying customer payload in direction: ${dir.symbol}.`);
    } else {
      diagnostics.push(`Modulated signal frequency: ${mode.toneFreqHz} Hz. Core confirmed matched to remote generator.`);
    }
  }

  return {
    opticalPowerDbm: power,
    head,
    mode,
    direction: isActuallyDark ? TRAFFIC_DIRECTIONS.NONE : dir,
    safeToCut,
    statusText,
    badgeClass,
    statusColor,
    audioBeepCadence,
    clampInducedLossDb,
    diagnostics,
    advisoryUrdu,
    wavelengthNm: parseInt(wavelengthNm, 10) || 1310
  };
}

/**
 * Render Vector SVG Clamp-on Mandrel and LCD Gauge Schematic
 */
export function renderFiberIdentifierSvg({
  opticalPowerDbm = -18.5,
  signalModeId = 'CW_TRAFFIC',
  directionId = 'LEFT_TO_RIGHT',
  headName = '900 µm Tight Buffer',
  safeToCut = false,
  statusColor = '#ef4444',
  coreName = 'Shahdara Fiber Core'
} = {}) {
  const isDark = safeToCut;
  const isLeftToRight = directionId === 'LEFT_TO_RIGHT';
  const isRightToLeft = directionId === 'RIGHT_TO_LEFT';

  const lcdBg = isDark ? '#064e3b' : (statusColor === '#f59e0b' ? '#78350f' : '#7f1d1d');
  const lcdText = isDark ? '#6ee7b7' : (statusColor === '#f59e0b' ? '#fde68a' : '#fca5a5');

  return `
    <svg viewBox="0 0 760 300" class="identifier-svg" role="img" aria-label="Live Fiber Identifier Schematic and LCD" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="identBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#090d16" />
          <stop offset="100%" stop-color="#111827" />
        </linearGradient>
        <linearGradient id="fiberGlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#818cf8" stop-opacity="0.9" />
        </linearGradient>
        <filter id="identGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Background -->
      <rect width="760" height="300" rx="14" fill="url(#identBgGrad)" stroke="#1e293b" stroke-width="1.5" />

      <!-- Top Header Badge -->
      <g transform="translate(24, 28)">
        <text x="0" y="0" fill="#94a3b8" font-size="11" font-weight="700" letter-spacing="1">ITU-T L.40 / TELCORDIA GR-765 OPTICAL LIVE FIBER IDENTIFIER</text>
        <text x="0" y="20" fill="#f8fafc" font-size="16" font-weight="700">${escapeXml(coreName)}</text>
        <rect x="540" y="-12" width="170" height="28" rx="6" fill="${statusColor}22" stroke="${statusColor}" stroke-width="1.5" />
        <text x="625" y="6" fill="${statusColor}" font-size="12" font-weight="800" text-anchor="middle">${safeToCut ? 'SAFE TO CUT' : 'DO NOT CUT (LIVE)'}</text>
      </g>

      <!-- Left Column: Clamp-on Mandrel and Sensor Cross Section -->
      <g transform="translate(24, 80)">
        <rect width="360" height="195" rx="10" fill="#0f172a" stroke="#334155" stroke-width="1" />
        <text x="180" y="22" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle">MACRO-BEND CLAMP MECHANISM</text>

        <!-- Mechanical Clamp Jaws -->
        <path d="M 40 50 L 320 50 L 300 70 L 60 70 Z" fill="#334155" stroke="#64748b" stroke-width="1" />
        <text x="180" y="64" fill="#cbd5e1" font-size="9" font-weight="600" text-anchor="middle">Upper Clamp Head (${escapeXml(headName)})</text>

        <!-- Curved Fiber Path around Mandrel -->
        <!-- Fiber enters at x=40 y=105, bends around mandrel at x=180 y=130, exits at x=320 y=105 -->
        <path d="M 40 105 Q 110 105 150 120 Q 180 135 210 120 Q 250 105 320 105" fill="none" stroke="${isDark ? '#475569' : '#38bdf8'}" stroke-width="5" stroke-linecap="round" ${!isDark ? 'filter="url(#identGlow)"' : ''} />

        <!-- Mandrel Center Post -->
        <circle cx="180" cy="115" r="14" fill="#1e293b" stroke="#64748b" stroke-width="2" />
        <circle cx="180" cy="115" r="4" fill="#94a3b8" />

        <!-- Photodiode Sensor 1 (PD-Left) -->
        <rect x="135" y="145" width="30" height="20" rx="4" fill="${isLeftToRight && !isDark ? '#38bdf8' : '#1e293b'}" stroke="#38bdf8" stroke-width="1" />
        <text x="150" y="158" fill="${isLeftToRight && !isDark ? '#090d16' : '#94a3b8'}" font-size="8" font-weight="700" text-anchor="middle">PD-L</text>

        <!-- Photodiode Sensor 2 (PD-Right) -->
        <rect x="195" y="145" width="30" height="20" rx="4" fill="${isRightToLeft && !isDark ? '#fbbf24' : '#1e293b'}" stroke="#fbbf24" stroke-width="1" />
        <text x="210" y="158" fill="${isRightToLeft && !isDark ? '#090d16' : '#94a3b8'}" font-size="8" font-weight="700" text-anchor="middle">PD-R</text>

        <!-- Light Leakage Ray Indicators -->
        ${!isDark ? `
          <line x1="150" y1="125" x2="150" y2="145" stroke="#38bdf8" stroke-width="2" stroke-dasharray="2 2" />
          <line x1="210" y1="125" x2="210" y2="145" stroke="#fbbf24" stroke-width="2" stroke-dasharray="2 2" />
        ` : ''}

        <!-- Direction Arrow overlay on fiber -->
        ${isLeftToRight && !isDark ? `
          <polygon points="270,105 255,98 255,112" fill="#38bdf8" filter="url(#identGlow)" />
          <text x="180" y="182" fill="#38bdf8" font-size="10" font-weight="700" text-anchor="middle">Propagation: End A ➔ End B</text>
        ` : (isRightToLeft && !isDark ? `
          <polygon points="90,105 105,98 105,112" fill="#fbbf24" filter="url(#identGlow)" />
          <text x="180" y="182" fill="#fbbf24" font-size="10" font-weight="700" text-anchor="middle">Propagation: End B ➔ End A</text>
        ` : `
          <text x="180" y="182" fill="#64748b" font-size="10" font-weight="700" text-anchor="middle">No Photon Leakage Detected</text>
        `)}
      </g>

      <!-- Right Column: Digital LCD Instrument Panel -->
      <g transform="translate(415, 80)">
        <rect width="320" height="195" rx="10" fill="#0f172a" stroke="#334155" stroke-width="1" />
        <text x="160" y="22" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle">FIELD DETECTOR LCD DISPLAY</text>

        <!-- Digital LCD Screen Frame -->
        <g transform="translate(20, 35)">
          <rect width="280" height="90" rx="8" fill="${lcdBg}" stroke="#334155" stroke-width="1.5" />
          
          <!-- Direction Arrows on LCD -->
          <text x="25" y="45" fill="${isRightToLeft && !isDark ? '#f8fafc' : '#ffffff33'}" font-size="28" font-weight="900">◀</text>
          <text x="235" y="45" fill="${isLeftToRight && !isDark ? '#f8fafc' : '#ffffff33'}" font-size="28" font-weight="900">▶</text>

          <!-- Main Power Reading -->
          <text x="140" y="45" fill="${lcdText}" font-size="26" font-weight="900" font-family="monospace" text-anchor="middle">
            ${isDark ? 'LO (DARK)' : `${opticalPowerDbm > 0 ? '+' : ''}${opticalPowerDbm.toFixed(1)} dBm`}
          </text>
          
          <!-- Sub-display Mode / Frequency -->
          <text x="140" y="70" fill="${lcdText}" font-size="12" font-weight="700" font-family="monospace" text-anchor="middle">
            ${escapeXml(signalModeId)}
          </text>
        </g>

        <!-- LED Status Indicators below LCD -->
        <g transform="translate(20, 140)">
          <!-- TRAFFIC LED -->
          <circle cx="40" cy="18" r="8" fill="${!isDark ? '#ef4444' : '#1e293b'}" stroke="#f8fafc" stroke-width="1" ${!isDark ? 'filter="url(#identGlow)"' : ''} />
          <text x="56" y="22" fill="${!isDark ? '#ef4444' : '#64748b'}" font-size="10" font-weight="800">TRAFFIC</text>

          <!-- 2kHz / 1kHz / 270Hz TONE LED -->
          <circle cx="140" cy="18" r="8" fill="${signalModeId.startsWith('TONE_') ? '#f59e0b' : '#1e293b'}" stroke="#f8fafc" stroke-width="1" ${signalModeId.startsWith('TONE_') ? 'filter="url(#identGlow)"' : ''} />
          <text x="156" y="22" fill="${signalModeId.startsWith('TONE_') ? '#f59e0b' : '#64748b'}" font-size="10" font-weight="800">TONE</text>

          <!-- DARK / IDLE LED -->
          <circle cx="230" cy="18" r="8" fill="${isDark ? '#10b981' : '#1e293b'}" stroke="#f8fafc" stroke-width="1" ${isDark ? 'filter="url(#identGlow)"' : ''} />
          <text x="246" y="22" fill="${isDark ? '#10b981' : '#64748b'}" font-size="10" font-weight="800">DARK</text>
        </g>
      </g>
    </svg>
  `;
}

/**
 * Generate Comprehensive Engineering Audit Report
 */
export function generateFiberIdentifierReport(data = {}) {
  const dateStr = data.timestamp ? new Date(data.timestamp).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) : new Date().toLocaleString();
  return `
======================================================================
SHAHDARA ISP - OPTICAL LIVE FIBER IDENTIFIER AUDIT
Standard: ITU-T L.40 / Telcordia GR-765-CORE
======================================================================
Report Generated  : ${dateStr} PKT
Fiber Core Name   : ${data.coreName || 'Shahdara Optical Core'}
Technician Name   : ${data.technician || 'Lineman'}
Location / Cabinet: ${data.location || 'Shahdara, Lahore'}
Clamp Head Model  : ${data.headName || '900 µm Tight Buffer'}

MEASUREMENT RESULTS:
- Detected Power  : ${data.opticalPowerDbm != null ? `${data.opticalPowerDbm > 0 ? '+' : ''}${data.opticalPowerDbm.toFixed(1)} dBm` : 'N/A'}
- Signal Mode     : ${data.signalMode || 'CW Traffic'}
- Traffic Flow    : ${data.direction || 'Left-to-Right'}
- Test Wavelength : ${data.wavelengthNm || 1310} nm
- Clamp Macro-Loss: ~${data.clampInducedLossDb || 0.5} dB

SAFETY INTERLOCK:
- Status Rating   : [ ${data.statusText || 'ACTIVE TRAFFIC'} ]
- Safe to Cut?    : ${data.safeToCut ? 'YES (DARK FIBER)' : 'NO - DANGER (ACTIVE TRAFFIC)'}

DIAGNOSTIC ADVISORY:
${(data.diagnostics || []).map(d => `* ${d}`).join('\n')}

Urdu Safety Warning:
${data.advisoryUrdu || ''}
======================================================================
`.trim();
}

/**
 * Generate WhatsApp Field Dispatch Message
 */
export function generateFiberIdentifierWhatsAppDispatch(data = {}) {
  const emoji = data.safeToCut ? '✅' : '🚨';
  return `*SHAHDARA ISP - LIVE FIBER IDENTIFIER AUDIT* ${emoji}
----------------------------------------
📍 *Core:* ${data.coreName || 'Fiber Span'}
👷 *Tech:* ${data.technician || 'Lineman'} (${data.location || 'Shahdara'})
🔧 *Head:* ${data.headName || '900 µm'} | 🌊 *Wave:* ${data.wavelengthNm || 1310}nm

📊 *DETECTION RESULTS:*
• Power Reading: *${data.opticalPowerDbm != null ? `${data.opticalPowerDbm > 0 ? '+' : ''}${data.opticalPowerDbm.toFixed(1)} dBm` : 'N/A'}*
• Signal Mode: *${data.signalMode || 'CW Traffic'}*
• Direction: *${data.direction || 'L ➔ R'}*
• Safe to Cut: *${data.safeToCut ? 'YES (DARK CORE)' : 'NO - ACTIVE TRAFFIC'}*

📋 *Safety Warning:*
${data.advisoryUrdu || ''}
----------------------------------------
_Verified via Shahdara Mobile ISP Field Assistant (ITU-T L.40)_`.trim();
}

/**
 * LocalStorage Audit Persistence
 */
export function loadFiberIdentifierAuditLog(storage = null) {
  try {
    const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s) return [];
    const raw = s.getItem(FIBER_IDENTIFIER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load Fiber Identifier audit log:', e);
    return [];
  }
}

export function saveFiberIdentifierAuditLog(record, storage = null) {
  try {
    const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s) return [];
    const list = loadFiberIdentifierAuditLog(s);
    const newRecord = {
      id: 'IDENT_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      ...record
    };
    list.unshift(newRecord);
    const trimmed = list.slice(0, 50);
    s.setItem(FIBER_IDENTIFIER_STORAGE_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch (e) {
    console.error('Failed to save Fiber Identifier audit record:', e);
    return [];
  }
}

export function clearFiberIdentifierAuditLog(storage = null) {
  try {
    const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s) return;
    s.removeItem(FIBER_IDENTIFIER_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear Fiber Identifier audit log:', e);
  }
}

/**
 * Export Audit Records as CSV
 */
export function exportFiberIdentifierAuditsCsv(records = []) {
  const headers = [
    'Record ID', 'Timestamp', 'Core Name', 'Technician', 'Location',
    'Clamp Head', 'Optical Power (dBm)', 'Signal Mode', 'Direction',
    'Safe To Cut', 'Status'
  ];

  const rows = records.map(r => [
    r.id,
    r.timestamp,
    `"${(r.coreName || '').replace(/"/g, '""')}"`,
    `"${(r.technician || '').replace(/"/g, '""')}"`,
    `"${(r.location || '').replace(/"/g, '""')}"`,
    `"${(r.headName || '').replace(/"/g, '""')}"`,
    r.opticalPowerDbm,
    r.signalMode,
    r.direction,
    r.safeToCut ? 'YES' : 'NO',
    r.statusText
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
}

/**
 * Helper to escape HTML/XML characters
 */
function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Setup and initialize Mobile Fiber Identifier Modal
 */
export function setupMobileFiberIdentifierModal(state = {}, options = {}) {
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const onToast = options.onToast || ((msg) => console.log(msg));

  const modal = document.getElementById('mobileFiberIdentifierModal');
  const openBtn = document.getElementById('mobileMoreFiberIdentifierBtn');
  const closeBtn = document.getElementById('mobileFiberIdentifierModalCloseBtn');

  if (!modal) return null;

  // Form input elements
  const presetSelect = document.getElementById('identPresetSelect');
  const coreNameInput = document.getElementById('identCoreName');
  const techInput = document.getElementById('identTechnician');
  const locationInput = document.getElementById('identLocation');
  const headSelect = document.getElementById('identHeadSelect');
  const powerInput = document.getElementById('identPowerDbm');
  const modeSelect = document.getElementById('identModeSelect');
  const dirSelect = document.getElementById('identDirSelect');
  const waveSelect = document.getElementById('identWaveSelect');

  // Display elements
  const svgContainer = document.getElementById('identSvgContainer');
  const statusBadge = document.getElementById('identStatusBadge');
  const powerDisplay = document.getElementById('identPowerDisplay');
  const modeDisplay = document.getElementById('identModeDisplay');
  const dirDisplay = document.getElementById('identDirDisplay');
  const beepDisplay = document.getElementById('identBeepDisplay');
  const urduAdvisory = document.getElementById('identUrduAdvisory');
  const diagnosticsList = document.getElementById('identDiagnosticsList');

  // Action buttons
  const saveBtn = document.getElementById('identSaveAuditBtn');
  const whatsappBtn = document.getElementById('identWhatsappBtn');
  const copyReportBtn = document.getElementById('identCopyReportBtn');
  const exportCsvBtn = document.getElementById('identExportCsvBtn');
  const clearHistoryBtn = document.getElementById('identClearHistoryBtn');
  const historyTbody = document.getElementById('identHistoryTbody');

  function calculateCurrent() {
    const opticalPowerDbm = parseFloat(powerInput?.value) || -18.5;
    const signalModeId = modeSelect?.value || 'CW_TRAFFIC';
    const directionId = dirSelect?.value || 'LEFT_TO_RIGHT';
    const headId = headSelect?.value || 'HEAD_900UM';
    const wavelengthNm = parseInt(waveSelect?.value, 10) || 1310;

    const evalData = evaluateLiveFiberDetection({
      opticalPowerDbm,
      signalModeId,
      directionId,
      headId,
      wavelengthNm
    });

    return {
      ...evalData,
      coreName: coreNameInput?.value || 'Shahdara Optical Core',
      technician: techInput?.value || 'Field Lineman',
      location: locationInput?.value || 'Shahdara, Lahore',
      headName: headSelect?.options[headSelect?.selectedIndex]?.text || '900 µm Tight Buffer',
      signalMode: modeSelect?.options[modeSelect?.selectedIndex]?.text || 'CW Traffic',
      direction: dirSelect?.options[dirSelect?.selectedIndex]?.text || 'Left-to-Right'
    };
  }

  function updateUi() {
    const current = calculateCurrent();

    if (powerDisplay) powerDisplay.textContent = `${current.opticalPowerDbm > 0 ? '+' : ''}${current.opticalPowerDbm.toFixed(1)} dBm`;
    if (modeDisplay) modeDisplay.textContent = current.mode.name;
    if (dirDisplay) dirDisplay.textContent = current.direction.arrowText || current.direction.name;
    if (beepDisplay) beepDisplay.textContent = current.audioBeepCadence;

    if (statusBadge) {
      statusBadge.textContent = current.statusText;
      statusBadge.className = 'status-badge ' + current.badgeClass;
      statusBadge.style.backgroundColor = current.statusColor + '22';
      statusBadge.style.color = current.statusColor;
      statusBadge.style.borderColor = current.statusColor;
    }

    if (urduAdvisory) {
      urduAdvisory.textContent = current.advisoryUrdu;
      urduAdvisory.style.color = current.safeToCut ? '#34d399' : '#f87171';
    }

    if (diagnosticsList) {
      diagnosticsList.innerHTML = '';
      current.diagnostics.forEach(diag => {
        const li = document.createElement('li');
        li.textContent = diag;
        diagnosticsList.appendChild(li);
      });
    }

    if (svgContainer) {
      svgContainer.innerHTML = renderFiberIdentifierSvg({
        opticalPowerDbm: current.opticalPowerDbm,
        signalModeId: current.mode.id,
        directionId: current.direction.id,
        headName: current.head.name,
        safeToCut: current.safeToCut,
        statusColor: current.statusColor,
        coreName: current.coreName
      });
    }
  }

  function renderHistory() {
    if (!historyTbody) return;
    const history = loadFiberIdentifierAuditLog(storage);
    historyTbody.innerHTML = '';

    if (history.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="6" class="empty-table-cell">No fiber identification audits recorded yet.</td>';
      historyTbody.appendChild(tr);
      return;
    }

    history.forEach(item => {
      const tr = document.createElement('tr');
      const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const color = item.safeToCut ? '#10b981' : '#ef4444';

      tr.innerHTML = `
        <td>${escapeXml(item.coreName || '')}</td>
        <td>${escapeXml(timeStr)}</td>
        <td>${item.opticalPowerDbm != null ? `${item.opticalPowerDbm > 0 ? '+' : ''}${Number(item.opticalPowerDbm).toFixed(1)} dBm` : 'N/A'}</td>
        <td>${escapeXml(item.signalMode || '')}</td>
        <td><span style="color: ${color}; font-weight: bold;">${item.safeToCut ? 'SAFE TO CUT' : 'DO NOT CUT'}</span></td>
        <td>
          <button type="button" class="btn-table-action" data-action="whatsapp" data-id="${item.id}" title="Send WhatsApp">WA</button>
        </td>
      `;
      historyTbody.appendChild(tr);
    });

    historyTbody.querySelectorAll('button[data-action="whatsapp"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const found = history.find(r => r.id === id);
        if (found) {
          const text = generateFiberIdentifierWhatsAppDispatch(found);
          const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text);
          window.open(url, '_blank');
        }
      });
    });
  }

  // Preset Selection
  presetSelect?.addEventListener('change', () => {
    const presetKey = presetSelect.value;
    const p = IDENTIFIER_PRESETS[presetKey];
    if (p) {
      if (coreNameInput) coreNameInput.value = p.name;
      if (headSelect) headSelect.value = p.headId;
      if (powerInput) powerInput.value = p.opticalPowerDbm;
      if (modeSelect) modeSelect.value = p.signalModeId;
      if (dirSelect) dirSelect.value = p.directionId;
      if (waveSelect) waveSelect.value = p.wavelengthNm;
      updateUi();
      onToast(`Loaded preset: ${p.name}`);
    }
  });

  // Wire input listeners
  const liveInputs = [coreNameInput, techInput, locationInput, headSelect, powerInput, modeSelect, dirSelect, waveSelect];
  liveInputs.forEach(input => {
    input?.addEventListener('input', updateUi);
    input?.addEventListener('change', updateUi);
  });

  // Action buttons
  saveBtn?.addEventListener('click', () => {
    const current = calculateCurrent();
    saveFiberIdentifierAuditLog(current, storage);
    renderHistory();
    onToast(`Saved fiber identifier audit: ${current.safeToCut ? 'SAFE TO CUT' : 'ACTIVE TRAFFIC'}`);
  });

  whatsappBtn?.addEventListener('click', () => {
    const current = calculateCurrent();
    const text = generateFiberIdentifierWhatsAppDispatch(current);
    const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text);
    window.open(url, '_blank');
    onToast('Opening WhatsApp dispatch ticket...');
  });

  copyReportBtn?.addEventListener('click', () => {
    const current = calculateCurrent();
    const report = generateFiberIdentifierReport(current);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(report).then(() => {
        onToast('Copied audit report to clipboard');
      }).catch(() => {
        onToast('Failed to copy report to clipboard');
      });
    } else {
      onToast('Clipboard API unavailable in this browser');
    }
  });

  exportCsvBtn?.addEventListener('click', () => {
    const history = loadFiberIdentifierAuditLog(storage);
    if (history.length === 0) {
      onToast('No audit records to export');
      return;
    }
    const csv = exportFiberIdentifierAuditsCsv(history);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shahdara_fiber_identifier_audits_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Exported audits to CSV');
  });

  clearHistoryBtn?.addEventListener('click', async () => {
    const ask = typeof window !== 'undefined' && typeof window.appConfirm === 'function'
      ? await window.appConfirm({
          tone: 'danger',
          title: 'Clear fiber identifier audit logs?',
          subject: 'Field Tool · Fiber Identifier',
          message: 'All saved live optical traffic inspection and tone detection audit logs will be permanently removed from this device.',
          confirmLabel: 'Clear audit logs'
        })
      : (typeof confirm === 'function' ? confirm('Are you sure you want to clear all fiber identifier audit logs?') : true);

    if (ask) {
      clearFiberIdentifierAuditLog(storage);
      renderHistory();
      if (typeof onToast === 'function') {
        onToast('Fiber identifier audit logs cleared');
      } else if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast('Fiber identifier audit logs cleared');
      }
    }
  });

  openBtn?.addEventListener('click', () => {
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
    updateUi();
    renderHistory();
  });

  closeBtn?.addEventListener('click', () => {
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    }
  });

  // Initial render
  updateUi();
  renderHistory();

  return {
    modal,
    updateUi,
    renderHistory,
    calculateCurrent
  };
}
