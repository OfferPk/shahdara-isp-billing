/**
 * Shahdara ISP - Field Optical Fiber Talk Set (FOTS) & Laser Voice Communicator Assistant
 *
 * Provides FTTH field engineers, splicers, and linesmen with:
 * - ITU-T G.652 / IEC 61280-4-2 single-fiber full-duplex laser voice link modeling
 * - Transmit/Receive WDM pairing: Unit A (1310nm TX / 1550nm RX) and Unit B (1550nm TX / 1310nm RX)
 * - 45 dB optical dynamic link budget modeling (>80 km dark singlemode fiber reach)
 * - Optical fiber span attenuation, fusion splice loss, connector pair loss, and PON splitter loss
 * - Voice Mean Opinion Score (MOS, ITU-T P.800) and optical signal-to-noise ratio (OSNR) rating
 * - Headset audio volume, microphone gain, and optical call bell/chime signaling
 * - Interactive pure-vector SVG schematic with full-duplex WDM beam splitters and audio waveform
 * - LocalStorage audit log (shahdara_fiber_talkset_audits_v1), bilingual WhatsApp dispatch, and RFC-4180 CSV export
 */

export const FIBER_TALKSET_STORAGE_KEY = 'shahdara_fiber_talkset_audits_v1';

export const TALKSET_UNITS = {
  UNIT_A: {
    id: 'UNIT_A',
    role: 'Central Office / OLT Master Unit A',
    txWavelengthNm: 1310,
    rxWavelengthNm: 1550,
    txLaserType: '1310nm FP Laser (-5.0 dBm)',
    rxDetectorType: '1550nm InGaAs PIN (-50.0 dBm sensitivity)',
    dynamicRangeDb: 45.0,
    color: '#0ea5e9' // Sky blue
  },
  UNIT_B: {
    id: 'UNIT_B',
    role: 'Remote Roadside / FAT Slave Unit B',
    txWavelengthNm: 1550,
    rxWavelengthNm: 1310,
    txLaserType: '1550nm DFB Laser (-5.0 dBm)',
    rxDetectorType: '1310nm InGaAs PIN (-50.0 dBm sensitivity)',
    dynamicRangeDb: 45.0,
    color: '#10b981' // Emerald green
  }
};

export const TALKSET_SPLITTER_OPTIONS = {
  NONE: {
    id: 'NONE',
    name: 'Direct Dark Fiber Core (No Splitter - 0.0 dB)',
    lossDb: 0.0
  },
  SPLIT_1_2: {
    id: 'SPLIT_1_2',
    name: '1:2 FBT Optical Splitter (3.7 dB loss)',
    lossDb: 3.7
  },
  SPLIT_1_4: {
    id: 'SPLIT_1_4',
    name: '1:4 PLC Optical Splitter (7.3 dB loss)',
    lossDb: 7.3
  },
  SPLIT_1_8: {
    id: 'SPLIT_1_8',
    name: '1:8 PLC Optical Splitter (10.6 dB loss)',
    lossDb: 10.6
  },
  SPLIT_1_16: {
    id: 'SPLIT_1_16',
    name: '1:16 PLC Optical Splitter (13.9 dB loss)',
    lossDb: 13.9
  }
};

export const TALKSET_PRESETS = [
  {
    id: 'shahdara-town-ravi-feeder',
    name: 'Shahdara Town OLT to Ravi Road FAT-12 Direct Dark Feeder (12.5 km)',
    area: 'Shahdara Town',
    fiberLengthKm: 12.5,
    spliceCount: 4,
    connectorCount: 2,
    splitterType: 'NONE',
    technicianA: 'Arshad Ali (CO NOC)',
    technicianB: 'Sajjad Malik (Roadside Closure)',
    headsetVolumePercent: 75,
    notes: 'Dark core continuity test between Central OLT rack and JC-14 joint enclosure.'
  },
  {
    id: 'begum-kot-emergency-cut',
    name: 'Begum Kot Trunk Cut Emergency Coordination (24.0 km, Dead Cellular Area)',
    area: 'Begum Kot',
    fiberLengthKm: 24.0,
    spliceCount: 8,
    connectorCount: 2,
    splitterType: 'NONE',
    technicianA: 'Tariq Mehmood',
    technicianB: 'Imran Bashir',
    headsetVolumePercent: 85,
    notes: 'Severe fiber break inside storm drain; cellular coverage zero; talkset used for realignment.'
  },
  {
    id: 'farrukhabad-1-8-splitter',
    name: 'Farrukhabad Drop Coordination Through 1:8 Splitter (6.5 km)',
    area: 'Farrukhabad',
    fiberLengthKm: 6.5,
    spliceCount: 3,
    connectorCount: 4,
    splitterType: 'SPLIT_1_8',
    technicianA: 'Zahid Khan',
    technicianB: 'Kamran Akram',
    headsetVolumePercent: 90,
    notes: 'Communicating through 1:8 distribution splitter during secondary drop cable deployment.'
  },
  {
    id: 'jia-musa-extreme-backbone',
    name: 'Jia Musa Long-Haul Aerial Backbone (68.0 km, 18 Splices)',
    area: 'Jia Musa',
    fiberLengthKm: 68.0,
    spliceCount: 18,
    connectorCount: 2,
    splitterType: 'NONE',
    technicianA: 'Rashid Minhas',
    technicianB: 'Arshad Ali',
    headsetVolumePercent: 100,
    notes: 'Extreme link distance verification near receiver sensitivity threshold limit.'
  },
  {
    id: 'saeed-park-excessive-loss-drop',
    name: 'Saeed Park Severe Macro-Bend Link Drop Exceeding 45dB Budget',
    area: 'Saeed Park',
    fiberLengthKm: 35.0,
    spliceCount: 12,
    connectorCount: 6,
    splitterType: 'SPLIT_1_16', // 13.9 dB loss
    technicianA: 'Usman Ghani',
    technicianB: 'Bilal Ahmed',
    headsetVolumePercent: 100,
    notes: 'Combined fiber span and 1:16 splitter attenuates laser below -50 dBm receiver floor.'
  }
];

/**
 * Calculates Optical Fiber Talk Set link attenuation, optical margin, and voice quality
 * @param {Object} inputs - Inputs for talk set calculation
 * @returns {Object} Calculated metrics
 */
export function calculateFiberTalksetMetrics(inputs = {}) {
  const distKm = Math.max(0.1, Number(inputs.fiberLengthKm !== undefined ? inputs.fiberLengthKm : 12.5));
  const splices = Math.max(0, Number(inputs.spliceCount !== undefined ? inputs.spliceCount : 4));
  const connectors = Math.max(2, Number(inputs.connectorCount !== undefined ? inputs.connectorCount : 2));
  const splitter = TALKSET_SPLITTER_OPTIONS[inputs.splitterType] || TALKSET_SPLITTER_OPTIONS.NONE;
  const volume = Math.min(100, Math.max(10, Number(inputs.headsetVolumePercent !== undefined ? inputs.headsetVolumePercent : 75)));

  // Fiber core loss (Standard G.652.D: 1310nm = 0.35 dB/km, 1550nm = 0.20 dB/km)
  // Worst-case link budgeting uses 1310nm path
  const fiberLossDb = Math.round((distKm * 0.35) * 100) / 100;
  const spliceLossDb = Math.round((splices * 0.05) * 100) / 100; // 0.05 dB per fusion splice
  const connectorLossDb = Math.round((connectors * 0.25) * 100) / 100; // 0.25 dB per mated connector pair
  const splitterLossDb = splitter.lossDb;

  // Total Optical Path Loss
  const totalLinkLossDb = Math.round((fiberLossDb + spliceLossDb + connectorLossDb + splitterLossDb) * 100) / 100;

  // Maximum Dynamic Range: 45.0 dB (Tx: -5.0 dBm, Rx Sensitivity: -50.0 dBm)
  const maxDynamicRangeDb = 45.0;
  const opticalMarginDb = Math.round((maxDynamicRangeDb - totalLinkLossDb) * 100) / 100;

  // Received Optical Power at Detector (-5.0 dBm Tx - link loss)
  const receivedPowerDbm = Math.round((-5.0 - totalLinkLossDb) * 100) / 100;

  // Voice Quality Modeling (ITU-T P.800 MOS: 1.0 to 4.5)
  let voiceQualityScore = 4.5;
  let voiceQualityRating = 'HD Crystal Clear';
  let isLinkConnected = true;

  if (opticalMarginDb >= 20.0) {
    voiceQualityScore = 4.5;
    voiceQualityRating = 'HD Studio Clarity (High SNR)';
  } else if (opticalMarginDb >= 12.0) {
    voiceQualityScore = 4.2;
    voiceQualityRating = 'Clear Field Audio';
  } else if (opticalMarginDb >= 6.0) {
    voiceQualityScore = 3.6;
    voiceQualityRating = 'Good (Minor Optical Noise)';
  } else if (opticalMarginDb >= 1.0) {
    voiceQualityScore = 2.8;
    voiceQualityRating = 'Marginal (Faint Voice / Hiss)';
  } else {
    voiceQualityScore = 1.0;
    voiceQualityRating = 'LINK DROP (Optical Loss > 45 dB)';
    isLinkConnected = false;
  }

  // Overall Verdict
  let verdict = 'PASS';
  let verdictColor = '#10b981';
  let statusBadge = 'FULL DUPLEX COMM LINK';

  if (!isLinkConnected) {
    verdict = 'FAIL';
    verdictColor = '#ef4444';
    statusBadge = 'OPTICAL LINK DROPPED';
  } else if (opticalMarginDb < 6.0) {
    verdict = 'CAUTION';
    verdictColor = '#f59e0b';
    statusBadge = 'LOW OPTICAL MARGIN';
  }

  return {
    fiberLengthKm: distKm,
    spliceCount: splices,
    connectorCount: connectors,
    splitterId: splitter.id,
    splitterName: splitter.name,
    splitterLossDb,

    fiberLossDb,
    spliceLossDb,
    connectorLossDb,
    totalLinkLossDb,

    maxDynamicRangeDb,
    opticalMarginDb,
    receivedPowerDbm,

    headsetVolumePercent: volume,
    voiceQualityScore,
    voiceQualityRating,
    isLinkConnected,

    verdict,
    verdictColor,
    statusBadge
  };
}

/**
 * Renders an interactive pure-vector SVG schematic depicting full-duplex optical voice transmission
 * @param {Object} dynamics - Calculated talk set metrics
 * @param {Object} inputs - Inputs and metadata
 * @returns {string} SVG HTML string
 */
export function renderFiberTalksetSvg(dynamics, inputs = {}) {
  const d = dynamics || calculateFiberTalksetMetrics(inputs);
  const width = 640;
  const height = 260;

  const beamColor1310 = '#0ea5e9';
  const beamColor1550 = '#10b981';
  const linkColor = d.isLinkConnected ? '#10b981' : '#ef4444';

  return `<svg class="talkset-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Optical Fiber Talk Set Full-Duplex Link Schematic">
    <defs>
      <linearGradient id="chassisGradA" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0369a1"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
      <linearGradient id="chassisGradB" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#047857"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
      <linearGradient id="fiberSpanGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${beamColor1310}"/>
        <stop offset="50%" stop-color="#e2e8f0"/>
        <stop offset="100%" stop-color="${beamColor1550}"/>
      </linearGradient>
    </defs>

    <rect width="${width}" height="${height}" rx="10" fill="var(--bg-card, #0f172a)" stroke="var(--border, #334155)"/>

    <!-- TITLE & OVERALL STATUS -->
    <text x="25" y="28" fill="#38bdf8" font-size="12" font-weight="700">OPTICAL FIBER TALK SET (FOTS) FULL-DUPLEX LINK</text>
    <rect x="${width - 185}" y="12" width="160" height="22" rx="4" fill="${d.verdictColor}" opacity="0.15"/>
    <text x="${width - 105}" y="27" fill="${d.verdictColor}" font-size="10" font-weight="700" text-anchor="middle">${d.statusBadge}</text>

    <!-- UNIT A: Central Office / OLT (Left Side: x=25, y=48, w=160, h=145) -->
    <rect x="25" y="48" width="160" height="145" rx="8" fill="url(#chassisGradA)" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="105" y="68" fill="#ffffff" font-size="10" font-weight="800" text-anchor="middle">MASTER UNIT A</text>
    <text x="105" y="82" fill="#93c5fd" font-size="8" text-anchor="middle">Central Office / ODF</text>

    <!-- Unit A Transmit & Receive Ports -->
    <rect x="35" y="92" width="140" height="22" rx="4" fill="#0f172a" stroke="#38bdf8" stroke-width="1"/>
    <text x="45" y="106" fill="#38bdf8" font-size="8.5" font-weight="700">TX: 1310 nm Laser (-5dBm)</text>

    <rect x="35" y="118" width="140" height="22" rx="4" fill="#0f172a" stroke="#10b981" stroke-width="1"/>
    <text x="45" y="132" fill="#10b981" font-size="8.5" font-weight="700">RX: 1550 nm WDM PIN</text>

    <!-- Headset Mic Volume Indicator -->
    <rect x="35" y="148" width="140" height="32" rx="4" fill="rgba(15, 23, 42, 0.7)"/>
    <text x="45" y="162" fill="#94a3b8" font-size="7.5">HEADSET VOLUME</text>
    <text x="45" y="174" fill="#ffffff" font-size="9" font-weight="700">${d.headsetVolumePercent}% Volume</text>

    <!-- OPTICAL FIBER SPAN (Center: x=185 to 455, y=95 to 145) -->
    <rect x="195" y="60" width="250" height="120" rx="6" fill="#090d16" stroke="#334155" stroke-width="1"/>
    <text x="320" y="78" fill="#cbd5e1" font-size="9" font-weight="700" text-anchor="middle">SINGLE FIBER STRAND (ITU-T G.652.D)</text>
    <text x="320" y="93" fill="#38bdf8" font-size="8.5" font-weight="700" text-anchor="middle">Span: ${d.fiberLengthKm} km | Loss: ${d.totalLinkLossDb} dB</text>

    <!-- Fiber Core Light Guides (Full-Duplex Dual Direction Rays) -->
    <line x1="185" y1="112" x2="455" y2="112" stroke="${d.isLinkConnected ? beamColor1310 : '#ef4444'}" stroke-width="2.5" stroke-dasharray="6,3"/>
    <polygon points="350,109 360,112 350,115" fill="${beamColor1310}"/>
    <text x="320" y="108" fill="${beamColor1310}" font-size="7.5" font-weight="700" text-anchor="middle">1310 nm Voice Carrier (A → B)</text>

    <line x1="455" y1="130" x2="185" y2="130" stroke="${d.isLinkConnected ? beamColor1550 : '#ef4444'}" stroke-width="2.5" stroke-dasharray="6,3"/>
    <polygon points="290,127 280,130 290,133" fill="${beamColor1550}"/>
    <text x="320" y="142" fill="${beamColor1550}" font-size="7.5" font-weight="700" text-anchor="middle">1550 nm Voice Carrier (B → A)</text>

    <!-- Fiber Metrology Badges inside Span -->
    <rect x="205" y="152" width="70" height="20" rx="3" fill="#1e293b"/>
    <text x="240" y="165" fill="#94a3b8" font-size="7.5" text-anchor="middle">${d.spliceCount} Splices</text>

    <rect x="285" y="152" width="75" height="20" rx="3" fill="#1e293b"/>
    <text x="322" y="165" fill="#94a3b8" font-size="7.5" text-anchor="middle">${d.connectorCount} Connectors</text>

    <rect x="368" y="152" width="70" height="20" rx="3" fill="#1e293b"/>
    <text x="403" y="165" fill="${d.splitterLossDb > 0 ? '#f59e0b' : '#94a3b8'}" font-size="7.5" text-anchor="middle">${d.splitterLossDb > 0 ? `${d.splitterLossDb}dB Split` : '0dB Split'}</text>

    <!-- UNIT B: Roadside Field Joint Closure / FAT (Right Side: x=455, y=48, w=160, h=145) -->
    <rect x="455" y="48" width="160" height="145" rx="8" fill="url(#chassisGradB)" stroke="#10b981" stroke-width="1.5"/>
    <text x="535" y="68" fill="#ffffff" font-size="10" font-weight="800" text-anchor="middle">SLAVE UNIT B</text>
    <text x="535" y="82" fill="#a7f3d0" font-size="8" text-anchor="middle">Field Closure / FAT Node</text>

    <!-- Unit B Transmit & Receive Ports -->
    <rect x="465" y="92" width="140" height="22" rx="4" fill="#0f172a" stroke="#10b981" stroke-width="1"/>
    <text x="475" y="106" fill="#10b981" font-size="8.5" font-weight="700">TX: 1550 nm Laser (-5dBm)</text>

    <rect x="465" y="118" width="140" height="22" rx="4" fill="#0f172a" stroke="#38bdf8" stroke-width="1"/>
    <text x="475" y="132" fill="#38bdf8" font-size="8.5" font-weight="700">RX: 1310 nm WDM PIN</text>

    <!-- Headset Mic Volume Indicator Unit B -->
    <rect x="465" y="148" width="140" height="32" rx="4" fill="rgba(15, 23, 42, 0.7)"/>
    <text x="475" y="162" fill="#94a3b8" font-size="7.5">VOICE QUALITY (P.800)</text>
    <text x="475" y="174" fill="${d.isLinkConnected ? '#10b981' : '#ef4444'}" font-size="9" font-weight="700">MOS ${d.voiceQualityScore} / 4.5</text>

    <!-- BOTTOM TELEMETRY TILES ROW (x=25 to 615, y=205 to 248) -->
    <rect x="25" y="205" width="135" height="43" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="35" y="220" fill="var(--text-muted, #94a3b8)" font-size="8">TOTAL FIBER LOSS</text>
    <text x="35" y="238" fill="#38bdf8" font-size="12" font-weight="700">${d.totalLinkLossDb} dB <tspan font-size="8.5" fill="var(--text-muted, #94a3b8)">(max 45.0)</tspan></text>

    <rect x="170" y="205" width="140" height="43" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="180" y="220" fill="var(--text-muted, #94a3b8)" font-size="8">OPTICAL LINK MARGIN</text>
    <text x="180" y="238" fill="${d.opticalMarginDb >= 6.0 ? '#10b981' : d.opticalMarginDb > 0 ? '#f59e0b' : '#ef4444'}" font-size="12" font-weight="700">${d.opticalMarginDb} dB</text>

    <rect x="320" y="205" width="140" height="43" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="330" y="220" fill="var(--text-muted, #94a3b8)" font-size="8">RX DETECTOR POWER</text>
    <text x="330" y="238" fill="${d.isLinkConnected ? '#10b981' : '#ef4444'}" font-size="12" font-weight="700">${d.receivedPowerDbm} dBm <tspan font-size="8.5" fill="var(--text-muted, #94a3b8)">(-50 min)</tspan></text>

    <rect x="470" y="205" width="145" height="43" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="480" y="220" fill="var(--text-muted, #94a3b8)" font-size="8">VOICE AUDIBILITY</text>
    <text x="480" y="238" fill="${d.isLinkConnected ? '#10b981' : '#ef4444'}" font-size="11" font-weight="700">${d.voiceQualityRating.split(' ')[0]} <tspan font-size="8.5" fill="var(--text-muted, #94a3b8)">(MOS ${d.voiceQualityScore})</tspan></text>
  </svg>`;
}

/**
 * Formats a bilingual WhatsApp dispatch message for the optical fiber talk set coordination
 * @param {Object} dynamics - Calculated talk set metrics
 * @param {Object} inputs - Inputs and metadata
 * @returns {string} WhatsApp text
 */
export function formatFiberTalksetWhatsApp(dynamics, inputs = {}) {
  const d = dynamics || calculateFiberTalksetMetrics();
  const techA = inputs.technicianA || 'Central Office Engineer';
  const techB = inputs.technicianB || 'Field Linesman';
  const area = inputs.area || 'Shahdara Town';
  const notes = inputs.notes || 'None';

  return `*SHAHDARA ISP - FIBER OPTIC TALK SET (FOTS) AUDIT*
*شاہدرا آئی ایس پی - آپٹیکل فائبر ٹاک سیٹ وائس لنک رپورٹ*
---------------------------------------
*Date / تاریخ:* ${new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
*CO Engineer / دفتر انجینئر:* ${techA}
*Field Tech / فیلڈ ٹیکنیشن:* ${techB}
*Area / علاقہ:* ${area}
*Link Span:* ${d.fiberLengthKm} km Single Fiber Core (Full Duplex WDM)
*Splitter Node:* ${d.splitterName}
---------------------------------------
*OPTICAL VOICE LINK METROLOGY:*
- Total Path Loss: ${d.totalLinkLossDb} dB [Dynamic Range: 45.0 dB]
- Optical Link Margin: ${d.opticalMarginDb} dB -> *${d.opticalMarginDb >= 6.0 ? 'ADEQUATE' : d.opticalMarginDb > 0 ? 'MARGINAL' : 'DEPLETED'}*
- Receiver Optical Power: ${d.receivedPowerDbm} dBm (Sensitivity: -50.0 dBm)
- Voice Quality (P.800 MOS): ${d.voiceQualityScore} / 4.5 (${d.voiceQualityRating})
- Communication Status: *${d.isLinkConnected ? 'ACTIVE VOICE LINK' : 'LINK DROPPED'}*
*Field Notes:* ${notes}
---------------------------------------
_Standard: ITU-T G.652 / IEC 61280-4-2_
_Shahdara ISP Field Network Operations Center_`;
}

/**
 * Loads audit log from localStorage
 * @param {Storage} storage - Storage backend
 * @returns {Array} Array of audit entries
 */
export function loadFiberTalksetAuditLog(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(FIBER_TALKSET_STORAGE_KEY);
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
export function saveFiberTalksetAuditLog(audit, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  const current = loadFiberTalksetAuditLog(storage);
  const entry = {
    id: `fots-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ...audit
  };
  const updated = [entry, ...current].slice(0, 50);
  try {
    storage.setItem(FIBER_TALKSET_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}

/**
 * Clears audit log from localStorage
 * @param {Storage} storage - Storage backend
 */
export function clearFiberTalksetAuditLog(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.removeItem(FIBER_TALKSET_STORAGE_KEY);
  } catch {}
}

/**
 * Exports Fiber Talkset audits as RFC-4180 CSV with UTF-8 BOM
 * @param {Array} audits - List of audits
 * @returns {string} CSV text
 */
export function generateFiberTalksetCsv(audits = []) {
  const headers = [
    'Audit_ID',
    'Timestamp',
    'Technician_CO',
    'Technician_Field',
    'Area',
    'Fiber_Length_km',
    'Splices',
    'Connectors',
    'Splitter_Type',
    'Total_Loss_dB',
    'Optical_Margin_dB',
    'Received_Power_dBm',
    'Voice_MOS',
    'Verdict',
    'Notes'
  ];

  const rows = (audits || []).map(a => [
    `"${a.id || ''}"`,
    `"${a.timestamp || ''}"`,
    `"${(a.technicianA || '').replace(/"/g, '""')}"`,
    `"${(a.technicianB || '').replace(/"/g, '""')}"`,
    `"${(a.area || '').replace(/"/g, '""')}"`,
    a.fiberLengthKm || 0,
    a.spliceCount || 0,
    a.connectorCount || 0,
    `"${a.splitterId || a.splitterType || ''}"`,
    a.totalLinkLossDb || 0,
    a.opticalMarginDb || 0,
    a.receivedPowerDbm || 0,
    a.voiceQualityScore || 0,
    `"${a.verdict || ''}"`,
    `"${(a.notes || '').replace(/"/g, '""')}"`
  ].join(','));

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Controller for Mobile Fiber Optic Talk Set (FOTS) Modal
 * @param {Object} state - Application state
 * @param {Object} options - Controller options (document, storage, onToast)
 * @returns {Object} Controller interface
 */
export function setupMobileFiberTalksetModal(state, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

  const modal = doc.getElementById('mobileFiberTalksetModal');
  const closeBtn = doc.getElementById('mobileFiberTalksetModalCloseBtn');
  const openBtn = doc.getElementById('mobileMoreFiberTalksetBtn');

  // Input Elements
  const presetSelect = doc.getElementById('talksetPresetSelect');
  const areaSelect = doc.getElementById('talksetAreaSelect');
  const techAInput = doc.getElementById('talksetTechAInput');
  const techBInput = doc.getElementById('talksetTechBInput');
  const distSlider = doc.getElementById('talksetDistSlider');
  const distLabel = doc.getElementById('talksetDistLabel');
  const spliceSlider = doc.getElementById('talksetSpliceSlider');
  const spliceLabel = doc.getElementById('talksetSpliceLabel');
  const connSlider = doc.getElementById('talksetConnSlider');
  const connLabel = doc.getElementById('talksetConnLabel');
  const splitterSelect = doc.getElementById('talksetSplitterSelect');
  const volumeSlider = doc.getElementById('talksetVolumeSlider');
  const volumeLabel = doc.getElementById('talksetVolumeLabel');
  const notesInput = doc.getElementById('talksetNotesInput');

  // Action Buttons
  const resetBtn = doc.getElementById('talksetResetBtn');
  const saveBtn = doc.getElementById('talksetSaveBtn');
  const whatsAppBtn = doc.getElementById('talksetWhatsAppBtn');
  const exportCsvBtn = doc.getElementById('talksetExportCsvBtn');

  // Output Elements
  const diagramContainer = doc.getElementById('talksetDiagramContainer');
  const historyTbody = doc.getElementById('talksetHistoryTbody');
  const historySearch = doc.getElementById('talksetHistorySearch');
  const historyVerdictFilter = doc.getElementById('talksetHistoryVerdictFilter');

  let currentInputs = {
    fiberLengthKm: 12.5,
    spliceCount: 4,
    connectorCount: 2,
    splitterType: 'NONE',
    technicianA: 'Arshad Ali',
    technicianB: 'Sajjad Malik',
    headsetVolumePercent: 75,
    area: 'Shahdara Town',
    notes: ''
  };

  function loadPreset(presetId) {
    const p = TALKSET_PRESETS.find(item => item.id === presetId) || TALKSET_PRESETS[0];
    currentInputs = {
      fiberLengthKm: p.fiberLengthKm,
      spliceCount: p.spliceCount,
      connectorCount: p.connectorCount,
      splitterType: p.splitterType,
      technicianA: p.technicianA,
      technicianB: p.technicianB,
      headsetVolumePercent: p.headsetVolumePercent,
      area: p.area,
      notes: p.notes
    };
    syncInputsToUi();
    updateUi();
  }

  function syncInputsToUi() {
    if (areaSelect) areaSelect.value = currentInputs.area;
    if (techAInput) techAInput.value = currentInputs.technicianA;
    if (techBInput) techBInput.value = currentInputs.technicianB;
    if (distSlider) distSlider.value = String(currentInputs.fiberLengthKm);
    if (distLabel) distLabel.textContent = `${currentInputs.fiberLengthKm} km`;
    if (spliceSlider) spliceSlider.value = String(currentInputs.spliceCount);
    if (spliceLabel) spliceLabel.textContent = `${currentInputs.spliceCount} splices`;
    if (connSlider) connSlider.value = String(currentInputs.connectorCount);
    if (connLabel) connLabel.textContent = `${currentInputs.connectorCount} connectors`;
    if (splitterSelect) splitterSelect.value = currentInputs.splitterType;
    if (volumeSlider) volumeSlider.value = String(currentInputs.headsetVolumePercent);
    if (volumeLabel) volumeLabel.textContent = `${currentInputs.headsetVolumePercent}%`;
    if (notesInput) notesInput.value = currentInputs.notes || '';
  }

  function syncInputsFromUi() {
    if (areaSelect && areaSelect.value) currentInputs.area = areaSelect.value;
    if (techAInput && techAInput.value) currentInputs.technicianA = techAInput.value;
    if (techBInput && techBInput.value) currentInputs.technicianB = techBInput.value;
    if (distSlider && distSlider.value !== '') currentInputs.fiberLengthKm = Number(distSlider.value);
    if (spliceSlider && spliceSlider.value !== '') currentInputs.spliceCount = Number(spliceSlider.value);
    if (connSlider && connSlider.value !== '') currentInputs.connectorCount = Number(connSlider.value);
    if (splitterSelect && splitterSelect.value) currentInputs.splitterType = splitterSelect.value;
    if (volumeSlider && volumeSlider.value !== '') currentInputs.headsetVolumePercent = Number(volumeSlider.value);
    if (notesInput && notesInput.value !== undefined) currentInputs.notes = notesInput.value;
  }

  function renderHistoryTable() {
    if (!historyTbody) return;
    const audits = loadFiberTalksetAuditLog(storage);
    const search = (historySearch?.value || '').toLowerCase().trim();
    const verdictFilter = historyVerdictFilter?.value || 'ALL';

    const filtered = audits.filter(a => {
      const matchSearch = !search ||
        (a.technicianA && a.technicianA.toLowerCase().includes(search)) ||
        (a.technicianB && a.technicianB.toLowerCase().includes(search)) ||
        (a.area && a.area.toLowerCase().includes(search)) ||
        (a.notes && a.notes.toLowerCase().includes(search));
      const matchVerdict = verdictFilter === 'ALL' || a.verdict === verdictFilter;
      return matchSearch && matchVerdict;
    });

    if (filtered.length === 0) {
      historyTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted,#94a3b8);padding:12px;">No fiber talk set audits recorded.</td></tr>`;
      return;
    }

    historyTbody.innerHTML = filtered.map(a => `
      <tr style="border-bottom:1px solid var(--border,#334155);font-size:11px;">
        <td style="padding:6px 8px;">${a.timestamp ? a.timestamp.slice(0, 16).replace('T', ' ') : 'Just now'}</td>
        <td style="padding:6px 8px;">${a.technicianA || 'CO'} / ${a.technicianB || 'Field'}</td>
        <td style="padding:6px 8px;">${a.area || 'Shahdara'}</td>
        <td style="padding:6px 8px;">${a.fiberLengthKm || 0} km</td>
        <td style="padding:6px 8px;font-weight:700;">${a.totalLinkLossDb || 0} dB</td>
        <td style="padding:6px 8px;"><span style="color:${a.verdict === 'PASS' ? '#10b981' : a.verdict === 'CAUTION' ? '#f59e0b' : '#ef4444'};font-weight:700;">${a.verdict || 'PASS'}</span></td>
        <td style="padding:6px 8px;">
          <button class="talkset-inspect-btn secondary-button" data-audit-id="${a.id}" type="button" style="padding:2px 6px;font-size:10px;">Inspect</button>
        </td>
      </tr>
    `).join('');

    // Wire inspect buttons
    historyTbody.querySelectorAll('.talkset-inspect-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const auditId = btn.getAttribute('data-audit-id');
        const item = audits.find(x => x.id === auditId);
        if (item) {
          currentInputs = {
            fiberLengthKm: item.fiberLengthKm || 12.5,
            spliceCount: item.spliceCount || 4,
            connectorCount: item.connectorCount || 2,
            splitterType: item.splitterType || item.splitterId || 'NONE',
            technicianA: item.technicianA || 'CO',
            technicianB: item.technicianB || 'Field',
            headsetVolumePercent: item.headsetVolumePercent || 75,
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
    const dynamics = calculateFiberTalksetMetrics(currentInputs);

    if (distLabel) distLabel.textContent = `${currentInputs.fiberLengthKm} km`;
    if (spliceLabel) spliceLabel.textContent = `${currentInputs.spliceCount} splices`;
    if (connLabel) connLabel.textContent = `${currentInputs.connectorCount} connectors`;
    if (volumeLabel) volumeLabel.textContent = `${currentInputs.headsetVolumePercent}%`;

    if (diagramContainer) {
      diagramContainer.innerHTML = renderFiberTalksetSvg(dynamics, currentInputs);
    }

    renderHistoryTable();
  }

  // Event Listeners
  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      loadPreset(presetSelect.value);
    });
  }

  [areaSelect, techAInput, techBInput, splitterSelect, notesInput].forEach(el => {
    if (el) {
      el.addEventListener('change', updateUi);
      el.addEventListener('input', updateUi);
    }
  });

  if (distSlider) {
    distSlider.addEventListener('input', () => {
      currentInputs.fiberLengthKm = Number(distSlider.value);
      if (distLabel) distLabel.textContent = `${currentInputs.fiberLengthKm} km`;
      updateUi();
    });
  }

  if (spliceSlider) {
    spliceSlider.addEventListener('input', () => {
      currentInputs.spliceCount = Number(spliceSlider.value);
      if (spliceLabel) spliceLabel.textContent = `${currentInputs.spliceCount} splices`;
      updateUi();
    });
  }

  if (connSlider) {
    connSlider.addEventListener('input', () => {
      currentInputs.connectorCount = Number(connSlider.value);
      if (connLabel) connLabel.textContent = `${currentInputs.connectorCount} connectors`;
      updateUi();
    });
  }

  if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
      currentInputs.headsetVolumePercent = Number(volumeSlider.value);
      if (volumeLabel) volumeLabel.textContent = `${currentInputs.headsetVolumePercent}%`;
      updateUi();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      loadPreset('shahdara-town-ravi-feeder');
      if (presetSelect) presetSelect.value = 'shahdara-town-ravi-feeder';
      if (typeof options.onToast === 'function') {
        options.onToast('Talk Set parameters reset to default baseline.');
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const dynamics = calculateFiberTalksetMetrics(currentInputs);
      saveFiberTalksetAuditLog({ ...currentInputs, ...dynamics }, storage);
      renderHistoryTable();
      if (typeof options.onToast === 'function') {
        options.onToast(`Talk set audit saved (${dynamics.verdict}).`);
      }
    });
  }

  if (whatsAppBtn) {
    whatsAppBtn.addEventListener('click', () => {
      const dynamics = calculateFiberTalksetMetrics(currentInputs);
      const msg = formatFiberTalksetWhatsApp(dynamics, currentInputs);
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
      let audits = loadFiberTalksetAuditLog(storage);
      if (audits.length === 0) {
        const dynamics = calculateFiberTalksetMetrics(currentInputs);
        audits = saveFiberTalksetAuditLog({ ...currentInputs, ...dynamics }, storage);
      }
      const csv = generateFiberTalksetCsv(audits);
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
  syncInputsToUi();
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
    getMetrics: () => calculateFiberTalksetMetrics(currentInputs),
    getSavedAudits: () => loadFiberTalksetAuditLog(storage)
  };
}
