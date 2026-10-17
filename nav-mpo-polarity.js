/**
 * Shahdara ISP - Field MPO/MTP Multi-Fiber Push-On Ribbon Trunk Polarity & Pinning Assistant
 * 
 * Provides datacenter technicians, optical engineers, and field splicers with:
 * - TIA-568.3-D / IEC 61754-7 MPO/MTP ribbon trunk polarity validation (Method A, Method B, Method C)
 * - 12-fiber and 24-fiber ribbon channel mapping with TIA-598 12-color standard
 * - Male (Pinned) vs Female (Unpinned) ferrule guide pin gender interlock validation
 * - 40G/100GBASE-SR4 (parallel optics) Tx1-4 / Rx1-4 optical transceiver channel assignment
 * - Interactive vector SVG ferrule diagram with Key-Up/Key-Down orientation, pins, and ribbon channel traces
 * - LocalStorage audit log (shahdara_mpo_polarity_audits_v1), WhatsApp dispatch tickets, and CSV export
 */

export const MPO_POLARITY_STORAGE_KEY = 'shahdara_mpo_polarity_audits_v1';

export const TIA598_COLOR_CODES = [
  { index: 1, name: 'Blue', hex: '#2563eb', textColor: '#ffffff' },
  { index: 2, name: 'Orange', hex: '#ea580c', textColor: '#ffffff' },
  { index: 3, name: 'Green', hex: '#16a34a', textColor: '#ffffff' },
  { index: 4, name: 'Brown', hex: '#78350f', textColor: '#ffffff' },
  { index: 5, name: 'Slate', hex: '#64748b', textColor: '#ffffff' },
  { index: 6, name: 'White', hex: '#f8fafc', textColor: '#0f172a' },
  { index: 7, name: 'Red', hex: '#dc2626', textColor: '#ffffff' },
  { index: 8, name: 'Black', hex: '#1e293b', textColor: '#ffffff' },
  { index: 9, name: 'Yellow', hex: '#eab308', textColor: '#0f172a' },
  { index: 10, name: 'Violet', hex: '#9333ea', textColor: '#ffffff' },
  { index: 11, name: 'Rose', hex: '#ec4899', textColor: '#ffffff' },
  { index: 12, name: 'Aqua', hex: '#06b6d4', textColor: '#0f172a' }
];

export const POLARITY_METHODS = {
  METHOD_A: {
    id: 'METHOD_A',
    name: 'Method A (Key-Up to Key-Down Straight-Through)',
    keyOrientation: 'Key-Up to Key-Down',
    patchCordA: 'Type-A (Straight-Through)',
    patchCordB: 'Type-B (Pair-Flipped / Crossed)',
    description: 'Straight-through wiring (Fiber 1 -> Fiber 1). Requires an A-to-B patch cord on one end to cross Tx and Rx channels.'
  },
  METHOD_B: {
    id: 'METHOD_B',
    name: 'Method B (Key-Up to Key-Up Inverted / Rollover)',
    keyOrientation: 'Key-Up to Key-Up',
    patchCordA: 'Type-B (Crossed)',
    patchCordB: 'Type-B (Crossed)',
    description: 'Complete ribbon inversion (Fiber 1 -> Fiber 12, 2 -> 11). Standard for 40G/100G parallel optics (SR4/PSM4).'
  },
  METHOD_C: {
    id: 'METHOD_C',
    name: 'Method C (Key-Up to Key-Down Pair-Flipped)',
    keyOrientation: 'Key-Up to Key-Down',
    patchCordA: 'Type-A (Straight-Through)',
    patchCordB: 'Type-A (Straight-Through)',
    description: 'Adjacent pairs are crossed within the trunk (1->2, 2->1, 3->4, 4->3). Preserves duplex Tx/Rx alignment automatically.'
  }
};

export const CONNECTOR_GENDERS = {
  MALE_PINNED: {
    id: 'MALE_PINNED',
    name: 'Male (Pinned with Guide Pins)',
    hasPins: true,
    pinLabel: 'Stainless Guide Pins',
    description: 'Fixed internal alignment pins; used inside patch panels, cassettes, and fixed backbone trunks.'
  },
  FEMALE_UNPINNED: {
    id: 'FEMALE_UNPINNED',
    name: 'Female (Unpinned with Guide Holes)',
    hasPins: false,
    pinLabel: 'Precision Guide Holes',
    description: 'Unpinned ferrule with alignment holes; used on QSFP+ patch cords and equipment test jumpers.'
  }
};

export const MPO_PRESETS = {
  PARALLEL_40G_SR4: {
    id: 'PARALLEL_40G_SR4',
    name: '40G/100GBASE-SR4 Parallel Optics (Method B, MPO-12)',
    methodId: 'METHOD_B',
    fiberCount: 12,
    genderA: 'FEMALE_UNPINNED',
    genderB: 'FEMALE_UNPINNED',
    directMating: false,
    application: '40G/100G QSFP+ Transceiver Link',
    description: 'Parallel optics link where outer 4 fibers transmit (Tx1-4) and opposite outer 4 receive (Rx1-4).'
  },
  DUPLEX_BREAKOUT_CASSETTE: {
    id: 'DUPLEX_BREAKOUT_CASSETTE',
    name: 'MPO-to-6xLC Duplex Cassette Breakout (Method A)',
    methodId: 'METHOD_A',
    fiberCount: 12,
    genderA: 'MALE_PINNED',
    genderB: 'FEMALE_UNPINNED',
    directMating: true,
    application: '10G SFP+ Distribution Panel',
    description: 'Feeds 6 duplex LC subscriber ports from a single 12-fiber MPO feeder trunk.'
  },
  PAIR_FLIPPED_TRUNK: {
    id: 'PAIR_FLIPPED_TRUNK',
    name: 'Direct Cassette-to-Cassette Trunk (Method C)',
    methodId: 'METHOD_C',
    fiberCount: 12,
    genderA: 'MALE_PINNED',
    genderB: 'MALE_PINNED',
    directMating: false,
    application: 'Structured Data Center Backbone Tie',
    description: 'Inter-rack backbone trunk using pair-flipped cables to maintain duplex parity without special cords.'
  },
  HIGH_DENSITY_24F: {
    id: 'HIGH_DENSITY_24F',
    name: '24-Fiber High Density MPO Backbone (Method B)',
    methodId: 'METHOD_B',
    fiberCount: 24,
    genderA: 'MALE_PINNED',
    genderB: 'FEMALE_UNPINNED',
    directMating: true,
    application: 'Core Metro Switch Interconnect',
    description: 'Dual-row 24-fiber MPO ferrule supporting 100G/400G high-bandwidth backbone aggregation.'
  }
};

/**
 * Calculate MPO/MTP Ribbon Channel Mapping and Gender Mating Interlock
 */
export function calculateMpoChannelMapping({
  methodId = 'METHOD_B',
  fiberCount = 12,
  genderA = 'FEMALE_UNPINNED',
  genderB = 'FEMALE_UNPINNED',
  directMating = true
} = {}) {
  const count = parseInt(fiberCount, 10) === 24 ? 24 : 12;
  const method = POLARITY_METHODS[methodId] || POLARITY_METHODS.METHOD_B;
  const gA = CONNECTOR_GENDERS[genderA] || CONNECTOR_GENDERS.FEMALE_UNPINNED;
  const gB = CONNECTOR_GENDERS[genderB] || CONNECTOR_GENDERS.FEMALE_UNPINNED;

  // Gender Mating Rule
  // If directMating is true (connecting Connector A directly to Connector B inside an adapter sleeve):
  // Must be ONE MALE + ONE FEMALE.
  // Male + Male = CATASTROPHIC DAMAGE (pins collide).
  // Female + Female = SEVERE LOSS (no alignment pins, >10 dB loss).
  let matingSafety = 'SAFE';
  let matingMessage = 'Valid Male-to-Female mating pair. Alignment pins properly seated.';
  let matingColor = '#10b981';

  if (directMating) {
    if (gA.hasPins && gB.hasPins) {
      matingSafety = 'DANGER_PIN_COLLISION';
      matingMessage = 'CATASTROPHIC HAZARD: Two Male (Pinned) connectors cannot be mated! Guide pins will collide and shatter the ceramic ferrule.';
      matingColor = '#ef4444';
    } else if (!gA.hasPins && !gB.hasPins) {
      matingSafety = 'WARNING_UNPINNED';
      matingMessage = 'ALIGNMENT WARNING: Two Female (Unpinned) connectors lack alignment guide pins! Fiber cores will be misaligned, causing >10 dB insertion loss.';
      matingColor = '#f59e0b';
    }
  } else {
    matingMessage = 'Trunk-to-Trunk jumper connection mediated via intermediate patch panel or cassette.';
  }

  // Generate Channel Mapping
  const channels = [];
  for (let i = 1; i <= count; i++) {
    const colorIndex = ((i - 1) % 12);
    const colorInfo = TIA598_COLOR_CODES[colorIndex];

    let endBIndex = i;
    if (methodId === 'METHOD_B') {
      // Inverted: 1 -> count, 2 -> count - 1
      endBIndex = (count - i) + 1;
    } else if (methodId === 'METHOD_C') {
      // Pair-flipped: 1->2, 2->1, 3->4, 4->3
      endBIndex = (i % 2 === 1) ? i + 1 : i - 1;
    } else {
      // Method A: Straight 1 -> 1
      endBIndex = i;
    }

    // Role in 40G/100G-SR4:
    // Fibers 1-4: Tx 1 to 4
    // Fibers 5-8: Unused / Dark
    // Fibers 9-12: Rx 4 to 1
    let sr4Role = 'DATA';
    if (count === 12) {
      if (i <= 4) sr4Role = `Tx ${i}`;
      else if (i >= 9) sr4Role = `Rx ${13 - i}`;
      else sr4Role = 'Dark';
    }

    channels.push({
      channelIndex: i,
      endAPort: i,
      endBPort: endBIndex,
      colorName: colorInfo.name,
      colorHex: colorInfo.hex,
      textColor: colorInfo.textColor,
      sr4Role
    });
  }

  let advisoryUrdu = '';
  if (matingSafety === 'DANGER_PIN_COLLISION') {
    advisoryUrdu = 'خطرہ: دونوں کنیکٹر میل (پن والے) ہیں۔ آپس میں لگانے سے گائیڈ پنیں ٹکرا کر ٹوٹ جائیں گی۔';
  } else if (matingSafety === 'WARNING_UNPINNED') {
    advisoryUrdu = 'انتباہ: دونوں کنیکٹر فیمیل (بغیر پن) ہیں۔ بغیر گائیڈ پن کے سگنل ختم یا ڈراپ ہو جائے گا۔';
  } else {
    advisoryUrdu = 'تسلی بخش: پننگ اور پولرٹی معیاری ہے۔ چینل الائنمنٹ درست ہے۔';
  }

  return {
    fiberCount: count,
    method,
    genderA: gA,
    genderB: gB,
    directMating,
    matingSafety,
    matingMessage,
    matingColor,
    channels,
    advisoryUrdu
  };
}

/**
 * Render Vector SVG MPO Connector Ferrules & Ribbon Traces
 */
export function renderMpoPolaritySvg({
  mapping = [],
  methodId = 'METHOD_B',
  fiberCount = 12,
  genderA = 'FEMALE_UNPINNED',
  genderB = 'FEMALE_UNPINNED',
  matingSafety = 'SAFE',
  trunkName = 'Shahdara MPO Trunk'
} = {}) {
  const count = mapping.length || fiberCount;
  const gA = CONNECTOR_GENDERS[genderA] || CONNECTOR_GENDERS.FEMALE_UNPINNED;
  const gB = CONNECTOR_GENDERS[genderB] || CONNECTOR_GENDERS.FEMALE_UNPINNED;

  const keyA = 'KEY-UP';
  const keyB = methodId === 'METHOD_B' ? 'KEY-UP' : 'KEY-DOWN';

  return `
    <svg viewBox="0 0 760 320" class="mpo-svg" role="img" aria-label="MPO Ribbon Polarity & Pinning Schematic" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mpoBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#090d16" />
          <stop offset="100%" stop-color="#111827" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="760" height="320" rx="14" fill="url(#mpoBg)" stroke="#1e293b" stroke-width="1.5" />

      <!-- Top Header Badge -->
      <g transform="translate(24, 28)">
        <text x="0" y="0" fill="#94a3b8" font-size="11" font-weight="700" letter-spacing="1">TIA-568.3-D / IEC 61754-7 MPO/MTP POLARITY &amp; PINNING</text>
        <text x="0" y="20" fill="#f8fafc" font-size="16" font-weight="700">${escapeXml(trunkName)}</text>
        <rect x="520" y="-12" width="190" height="28" rx="6" fill="${matingSafety === 'SAFE' ? '#10b98122' : '#ef444422'}" stroke="${matingSafety === 'SAFE' ? '#10b981' : '#ef4444'}" stroke-width="1.5" />
        <text x="615" y="6" fill="${matingSafety === 'SAFE' ? '#10b981' : '#ef4444'}" font-size="11" font-weight="800" text-anchor="middle">
          ${matingSafety === 'SAFE' ? 'PINNING: COMPLIANT' : (matingSafety === 'DANGER_PIN_COLLISION' ? 'HAZARD: PIN CLASH' : 'WARNING: UNPINNED')}
        </text>
      </g>

      <!-- Left: Connector End A Ferrule -->
      <g transform="translate(24, 75)">
        <rect width="180" height="215" rx="10" fill="#0f172a" stroke="#334155" stroke-width="1" />
        <text x="90" y="22" fill="#38bdf8" font-size="12" font-weight="800" text-anchor="middle">CONNECTOR END A</text>
        <text x="90" y="38" fill="#94a3b8" font-size="9" text-anchor="middle">${escapeXml(gA.name)}</text>

        <!-- Key Tab (Key-UP) -->
        <rect x="75" y="46" width="30" height="8" rx="2" fill="#38bdf8" />
        <text x="90" y="53" fill="#090d16" font-size="7" font-weight="800" text-anchor="middle">KEY-UP</text>

        <!-- Ferrule Body -->
        <rect x="25" y="58" width="130" height="135" rx="8" fill="#1e293b" stroke="#475569" stroke-width="1.5" />

        <!-- Guide Pins / Holes on End A -->
        ${gA.hasPins ? `
          <circle cx="40" cy="125" r="5" fill="#f8fafc" stroke="#38bdf8" stroke-width="2" />
          <circle cx="140" cy="125" r="5" fill="#f8fafc" stroke="#38bdf8" stroke-width="2" />
        ` : `
          <circle cx="40" cy="125" r="4.5" fill="#090d16" stroke="#64748b" stroke-width="1.5" />
          <circle cx="140" cy="125" r="4.5" fill="#090d16" stroke="#64748b" stroke-width="1.5" />
        `}

        <!-- 12 Optical Fibers Array -->
        ${Array.from({ length: 12 }).map((_, idx) => {
          const cy = 70 + (idx * 9.5);
          const ch = mapping[idx] || {};
          return `
            <circle cx="90" cy="${cy}" r="3.2" fill="${ch.colorHex || '#38bdf8'}" stroke="#090d16" stroke-width="0.5" />
            <text x="60" y="${cy + 2.5}" fill="#94a3b8" font-size="7" font-weight="700">#${idx + 1}</text>
          `;
        }).join('')}
      </g>

      <!-- Center: Ribbon Fiber Channel Traces -->
      <g transform="translate(215, 75)">
        <rect width="330" height="215" rx="10" fill="#0f172a" stroke="#334155" stroke-width="1" />
        <text x="165" y="20" fill="#94a3b8" font-size="10" font-weight="700" text-anchor="middle">POLARITY METHOD: ${escapeXml(methodId)}</text>

        <!-- Ribbon Wire Traces -->
        ${mapping.slice(0, 12).map((ch, idx) => {
          const y1 = 70 + (ch.endAPort - 1) * 9.5;
          const y2 = 70 + (ch.endBPort - 1) * 9.5;
          return `
            <path d="M 15 ${y1} C 120 ${y1}, 210 ${y2}, 315 ${y2}" fill="none" stroke="${ch.colorHex}" stroke-width="2.5" opacity="0.9" />
          `;
        }).join('')}
      </g>

      <!-- Right: Connector End B Ferrule -->
      <g transform="translate(555, 75)">
        <rect width="180" height="215" rx="10" fill="#0f172a" stroke="#334155" stroke-width="1" />
        <text x="90" y="22" fill="#fbbf24" font-size="12" font-weight="800" text-anchor="middle">CONNECTOR END B</text>
        <text x="90" y="38" fill="#94a3b8" font-size="9" text-anchor="middle">${escapeXml(gB.name)}</text>

        <!-- Key Tab (Key-UP or Key-DOWN) -->
        ${keyB === 'KEY-UP' ? `
          <rect x="75" y="46" width="30" height="8" rx="2" fill="#fbbf24" />
          <text x="90" y="53" fill="#090d16" font-size="7" font-weight="800" text-anchor="middle">KEY-UP</text>
        ` : `
          <rect x="75" y="196" width="30" height="8" rx="2" fill="#fbbf24" />
          <text x="90" y="203" fill="#090d16" font-size="7" font-weight="800" text-anchor="middle">KEY-DOWN</text>
        `}

        <!-- Ferrule Body -->
        <rect x="25" y="58" width="130" height="135" rx="8" fill="#1e293b" stroke="#475569" stroke-width="1.5" />

        <!-- Guide Pins / Holes on End B -->
        ${gB.hasPins ? `
          <circle cx="40" cy="125" r="5" fill="#f8fafc" stroke="#fbbf24" stroke-width="2" />
          <circle cx="140" cy="125" r="5" fill="#f8fafc" stroke="#fbbf24" stroke-width="2" />
        ` : `
          <circle cx="40" cy="125" r="4.5" fill="#090d16" stroke="#64748b" stroke-width="1.5" />
          <circle cx="140" cy="125" r="4.5" fill="#090d16" stroke="#64748b" stroke-width="1.5" />
        `}

        <!-- 12 Optical Fibers Array on End B -->
        ${Array.from({ length: 12 }).map((_, idx) => {
          const cy = 70 + (idx * 9.5);
          const found = mapping.find(m => m.endBPort === idx + 1);
          return `
            <circle cx="90" cy="${cy}" r="3.2" fill="${found?.colorHex || '#fbbf24'}" stroke="#090d16" stroke-width="0.5" />
            <text x="110" y="${cy + 2.5}" fill="#94a3b8" font-size="7" font-weight="700">#${idx + 1}</text>
          `;
        }).join('')}
      </g>
    </svg>
  `;
}

/**
 * Generate Comprehensive Engineering Audit Report
 */
export function generateMpoPolarityReport(data = {}) {
  const dateStr = data.timestamp ? new Date(data.timestamp).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) : new Date().toLocaleString();
  return `
======================================================================
SHAHDARA ISP - MPO/MTP RIBBON TRUNK POLARITY & PINNING AUDIT
Standard: TIA-568.3-D / IEC 61754-7
======================================================================
Report Generated  : ${dateStr} PKT
Trunk Identifier  : ${data.trunkName || 'Shahdara MPO Backbone'}
Technician Name   : ${data.technician || 'Datacenter Specialist'}
Location / Rack   : ${data.location || 'Shahdara Core POP'}

TRUNK CONFIGURATION:
- Polarity Method : ${data.methodName || 'Method B (Inverted / Rollover)'}
- Fiber Count     : ${data.fiberCount || 12}-Fiber Ribbon
- End A Gender    : ${data.genderAName || 'Female (Unpinned)'}
- End B Gender    : ${data.genderBName || 'Female (Unpinned)'}
- Direct Mating?  : ${data.directMating ? 'Yes (Adapter Sleeve)' : 'No (Cassette/Panel)'}
- Pinning Safety  : [ ${data.matingSafety || 'SAFE'} ]

SAFETY & MATING ADVISORY:
${data.matingMessage || ''}

CHANNEL MAPPING TABLE (End A -> End B):
${(data.channels || []).map(ch => `Port ${ch.endAPort.toString().padStart(2, ' ')} [${ch.colorName.padEnd(6, ' ')}] ➔ Port ${ch.endBPort.toString().padStart(2, ' ')} (${ch.sr4Role})`).join('\n')}

Urdu Technician Advisory:
${data.advisoryUrdu || ''}
======================================================================
`.trim();
}

/**
 * Generate WhatsApp Field Dispatch Message
 */
export function generateMpoPolarityWhatsAppDispatch(data = {}) {
  const emoji = data.matingSafety === 'SAFE' ? '✅' : '🚨';
  return `*SHAHDARA ISP - MPO TRUNK POLARITY AUDIT* ${emoji}
----------------------------------------
📍 *Trunk:* ${data.trunkName || 'MPO Backbone'}
👷 *Tech:* ${data.technician || 'Lineman'} (${data.location || 'Shahdara'})
📐 *Method:* ${data.methodName || 'Method B'} | 🧵 *Fibers:* ${data.fiberCount || 12}F
🔌 *Genders:* End A: ${data.genderAName || 'Female'} | End B: ${data.genderBName || 'Female'}

📊 *PINNING RESULT:* *${data.matingSafety === 'SAFE' ? 'PASSED (Compliant)' : 'HAZARD / MISMATCH'}*
📋 *Advisory:*
${data.advisoryUrdu || ''}
----------------------------------------
_Verified via Shahdara Mobile ISP Field Assistant (TIA-568.3-D)_`.trim();
}

/**
 * LocalStorage Audit Persistence
 */
export function loadMpoPolarityAuditLog(storage = null) {
  try {
    const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s) return [];
    const raw = s.getItem(MPO_POLARITY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load MPO audit log:', e);
    return [];
  }
}

export function saveMpoPolarityAuditLog(record, storage = null) {
  try {
    const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s) return [];
    const list = loadMpoPolarityAuditLog(s);
    const newRecord = {
      id: 'MPO_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      ...record
    };
    list.unshift(newRecord);
    const trimmed = list.slice(0, 50);
    s.setItem(MPO_POLARITY_STORAGE_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch (e) {
    console.error('Failed to save MPO audit record:', e);
    return [];
  }
}

export function clearMpoPolarityAuditLog(storage = null) {
  try {
    const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s) return;
    s.removeItem(MPO_POLARITY_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear MPO audit log:', e);
  }
}

/**
 * Export Audit Records as CSV
 */
export function exportMpoPolarityAuditsCsv(records = []) {
  const headers = [
    'Record ID', 'Timestamp', 'Trunk Name', 'Technician', 'Location',
    'Polarity Method', 'Fiber Count', 'End A Gender', 'End B Gender',
    'Mating Safety'
  ];

  const rows = records.map(r => [
    r.id,
    r.timestamp,
    `"${(r.trunkName || '').replace(/"/g, '""')}"`,
    `"${(r.technician || '').replace(/"/g, '""')}"`,
    `"${(r.location || '').replace(/"/g, '""')}"`,
    r.methodName,
    r.fiberCount,
    r.genderAName,
    r.genderBName,
    r.matingSafety
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
 * Setup and initialize Mobile MPO Polarity Modal
 */
export function setupMobileMpoModal(state = {}, options = {}) {
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const onToast = options.onToast || ((msg) => console.log(msg));

  const modal = document.getElementById('mobileMpoModal');
  const openBtn = document.getElementById('mobileMoreMpoBtn');
  const closeBtn = document.getElementById('mobileMpoModalCloseBtn');

  if (!modal) return null;

  // Form input elements
  const presetSelect = document.getElementById('mpoPresetSelect');
  const trunkNameInput = document.getElementById('mpoTrunkName');
  const techInput = document.getElementById('mpoTechnician');
  const locationInput = document.getElementById('mpoLocation');
  const methodSelect = document.getElementById('mpoMethodSelect');
  const countSelect = document.getElementById('mpoCountSelect');
  const genderASelect = document.getElementById('mpoGenderASelect');
  const genderBSelect = document.getElementById('mpoGenderBSelect');
  const directMatingCheck = document.getElementById('mpoDirectMatingCheck');

  // Display elements
  const svgContainer = document.getElementById('mpoSvgContainer');
  const statusBadge = document.getElementById('mpoStatusBadge');
  const methodDisplay = document.getElementById('mpoMethodDisplay');
  const countDisplay = document.getElementById('mpoCountDisplay');
  const genderPairDisplay = document.getElementById('mpoGenderPairDisplay');
  const safetyDisplay = document.getElementById('mpoSafetyDisplay');
  const urduAdvisory = document.getElementById('mpoUrduAdvisory');
  const channelsTbody = document.getElementById('mpoChannelsTbody');

  // Action buttons
  const saveBtn = document.getElementById('mpoSaveAuditBtn');
  const whatsappBtn = document.getElementById('mpoWhatsappBtn');
  const copyReportBtn = document.getElementById('mpoCopyReportBtn');
  const exportCsvBtn = document.getElementById('mpoExportCsvBtn');
  const clearHistoryBtn = document.getElementById('mpoClearHistoryBtn');
  const historyTbody = document.getElementById('mpoHistoryTbody');

  function calculateCurrent() {
    const methodId = methodSelect?.value || 'METHOD_B';
    const fiberCount = parseInt(countSelect?.value, 10) || 12;
    const genderA = genderASelect?.value || 'FEMALE_UNPINNED';
    const genderB = genderBSelect?.value || 'FEMALE_UNPINNED';
    const directMating = directMatingCheck ? directMatingCheck.checked : true;

    const calc = calculateMpoChannelMapping({
      methodId,
      fiberCount,
      genderA,
      genderB,
      directMating
    });

    return {
      ...calc,
      trunkName: trunkNameInput?.value || 'Shahdara MPO Backbone',
      technician: techInput?.value || 'Datacenter Specialist',
      location: locationInput?.value || 'Shahdara Core POP',
      methodName: methodSelect?.options[methodSelect?.selectedIndex]?.text || 'Method B',
      genderAName: genderASelect?.options[genderASelect?.selectedIndex]?.text || 'Female',
      genderBName: genderBSelect?.options[genderBSelect?.selectedIndex]?.text || 'Female'
    };
  }

  function updateUi() {
    const current = calculateCurrent();

    if (methodDisplay) methodDisplay.textContent = current.method.name;
    if (countDisplay) countDisplay.textContent = `${current.fiberCount} Fibers`;
    if (genderPairDisplay) genderPairDisplay.textContent = `${current.genderA.hasPins ? 'Male' : 'Female'} ➔ ${current.genderB.hasPins ? 'Male' : 'Female'}`;
    if (safetyDisplay) {
      safetyDisplay.textContent = current.matingSafety;
      safetyDisplay.style.color = current.matingColor;
    }

    if (statusBadge) {
      statusBadge.textContent = current.matingSafety === 'SAFE' ? 'POLARITY & PINNING VALID' : 'PINNING HAZARD';
      statusBadge.className = 'status-badge ' + (current.matingSafety === 'SAFE' ? 'badge-pass' : 'badge-fail');
      statusBadge.style.backgroundColor = current.matingColor + '22';
      statusBadge.style.color = current.matingColor;
      statusBadge.style.borderColor = current.matingColor;
    }

    if (urduAdvisory) {
      urduAdvisory.textContent = current.advisoryUrdu;
      urduAdvisory.style.color = current.matingSafety === 'SAFE' ? '#34d399' : '#f87171';
    }

    if (channelsTbody) {
      channelsTbody.innerHTML = '';
      current.channels.forEach(ch => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>Port ${ch.endAPort}</strong></td>
          <td><span style="display:inline-block;width:12px;height:12px;background:${ch.colorHex};border-radius:2px;margin-right:4px;vertical-align:middle;"></span>${ch.colorName}</td>
          <td><strong>Port ${ch.endBPort}</strong></td>
          <td><span style="font-size:10px;font-weight:700;color:#94a3b8">${ch.sr4Role}</span></td>
        `;
        channelsTbody.appendChild(tr);
      });
    }

    if (svgContainer) {
      svgContainer.innerHTML = renderMpoPolaritySvg({
        mapping: current.channels,
        methodId: current.method.id,
        fiberCount: current.fiberCount,
        genderA: current.genderA.id,
        genderB: current.genderB.id,
        matingSafety: current.matingSafety,
        trunkName: current.trunkName
      });
    }
  }

  function renderHistory() {
    if (!historyTbody) return;
    const history = loadMpoPolarityAuditLog(storage);
    historyTbody.innerHTML = '';

    if (history.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="6" class="empty-table-cell">No MPO polarity audits recorded yet.</td>';
      historyTbody.appendChild(tr);
      return;
    }

    history.forEach(item => {
      const tr = document.createElement('tr');
      const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const color = item.matingSafety === 'SAFE' ? '#10b981' : '#ef4444';

      tr.innerHTML = `
        <td>${escapeXml(item.trunkName || '')}</td>
        <td>${escapeXml(timeStr)}</td>
        <td>${item.fiberCount || 12}F</td>
        <td>${escapeXml(item.methodName || '')}</td>
        <td><span style="color: ${color}; font-weight: bold;">${item.matingSafety}</span></td>
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
          const text = generateMpoPolarityWhatsAppDispatch(found);
          const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text);
          window.open(url, '_blank');
        }
      });
    });
  }

  // Preset Selection
  presetSelect?.addEventListener('change', () => {
    const presetKey = presetSelect.value;
    const p = MPO_PRESETS[presetKey];
    if (p) {
      if (trunkNameInput) trunkNameInput.value = p.name;
      if (methodSelect) methodSelect.value = p.methodId;
      if (countSelect) countSelect.value = p.fiberCount;
      if (genderASelect) genderASelect.value = p.genderA;
      if (genderBSelect) genderBSelect.value = p.genderB;
      if (directMatingCheck) directMatingCheck.checked = p.directMating;
      updateUi();
      onToast(`Loaded preset: ${p.name}`);
    }
  });

  const liveInputs = [trunkNameInput, techInput, locationInput, methodSelect, countSelect, genderASelect, genderBSelect, directMatingCheck];
  liveInputs.forEach(input => {
    input?.addEventListener('input', updateUi);
    input?.addEventListener('change', updateUi);
  });

  saveBtn?.addEventListener('click', () => {
    const current = calculateCurrent();
    saveMpoPolarityAuditLog(current, storage);
    renderHistory();
    onToast(`Saved MPO polarity audit: ${current.matingSafety}`);
  });

  whatsappBtn?.addEventListener('click', () => {
    const current = calculateCurrent();
    const text = generateMpoPolarityWhatsAppDispatch(current);
    const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text);
    window.open(url, '_blank');
    onToast('Opening WhatsApp dispatch ticket...');
  });

  copyReportBtn?.addEventListener('click', () => {
    const current = calculateCurrent();
    const report = generateMpoPolarityReport(current);
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
    const history = loadMpoPolarityAuditLog(storage);
    if (history.length === 0) {
      onToast('No audit records to export');
      return;
    }
    const csv = exportMpoPolarityAuditsCsv(history);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shahdara_mpo_polarity_audits_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Exported audits to CSV');
  });

  clearHistoryBtn?.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all MPO polarity audit logs?')) {
      clearMpoPolarityAuditLog(storage);
      renderHistory();
      onToast('MPO polarity audit logs cleared');
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

  updateUi();
  renderHistory();

  return {
    modal,
    updateUi,
    renderHistory,
    calculateCurrent
  };
}
