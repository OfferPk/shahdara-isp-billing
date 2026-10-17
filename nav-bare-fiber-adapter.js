/**
 * Shahdara ISP - Field Optical Fiber Bare Fiber Adapter (BFA) & Temporary Splice Assistant
 *
 * Provides FTTH field technicians, linesmen, and OSP cable testers with:
 * - IEC 60793-1-40 / TIA-455-171 / Telcordia GR-326-CORE temporary fiber coupling validation
 * - SC/APC (Green), SC/UPC (Blue), and FC/UPC (Metal) bare fiber adapter metrology
 * - Strip length gauge verification (12.0mm bare silica glass 125µm, 250µm primary coating)
 * - Internal ferrule stop contact & air-gap Fresnel back-reflection modeling
 * - Index Matching Fluid (IMF) condition: Fresh silicone oil (n=1.465), Dry air-gap, or Contaminated
 * - Precision V-groove ceramic alignment channel condition (Pristine, Dirty, Damaged)
 * - Magnetic/spring clamp retention force (>= 2.0 N) preventing testing slip
 * - Interactive pure-vector SVG cutaway schematic of ferrule, internal stop, V-groove, and fluid pool
 * - LocalStorage audit log (shahdara_bare_fiber_adapter_audits_v1), bilingual WhatsApp dispatch, and CSV export
 */

export const BARE_FIBER_ADAPTER_STORAGE_KEY = 'shahdara_bare_fiber_adapter_audits_v1';

export const BFA_CONNECTOR_TYPES = {
  SC_APC: {
    id: 'SC_APC',
    name: 'SC/APC (8° Angled Physical Contact - Green)',
    ferruleType: 'Zirconia 2.5mm Ceramic',
    housingColor: '#16a34a',
    targetStripMm: 12.0,
    nominalIlMaxDb: 0.40,
    nominalRlMinDb: 50.0,
    endfaceTiltDeg: 8.0
  },
  SC_UPC: {
    id: 'SC_UPC',
    name: 'SC/UPC (Ultra Physical Contact - Blue)',
    ferruleType: 'Zirconia 2.5mm Ceramic',
    housingColor: '#2563eb',
    targetStripMm: 12.0,
    nominalIlMaxDb: 0.35,
    nominalRlMinDb: 45.0,
    endfaceTiltDeg: 0.0
  },
  FC_UPC: {
    id: 'FC_UPC',
    name: 'FC/UPC (Screw-Threaded Precision Metallic)',
    ferruleType: 'Zirconia 2.5mm Ceramic with Nickel Brass Housing',
    housingColor: '#64748b',
    targetStripMm: 12.0,
    nominalIlMaxDb: 0.35,
    nominalRlMinDb: 45.0,
    endfaceTiltDeg: 0.0
  }
};

export const INDEX_MATCHING_CONDITIONS = {
  FRESH_IMF: {
    id: 'FRESH_IMF',
    name: 'Fresh Index Matching Fluid (n=1.465, Optimal)',
    refractiveIndex: 1.4650,
    lossPenaltyDb: 0.05,
    returnLossBonusDb: 6.0,
    description: 'High-purity optical silicone fluid eliminates air gap and suppresses Fresnel reflections.'
  },
  AIR_GAP_DRY: {
    id: 'AIR_GAP_DRY',
    name: 'Dry Coupling without Fluid (n=1.000, Air Gap)',
    refractiveIndex: 1.0000,
    lossPenaltyDb: 0.55,
    returnLossBonusDb: -22.0,
    description: 'Dry air gap creates glass-to-air refractive index mismatch and -14.7 dB Fresnel reflection spikes.'
  },
  CONTAMINATED_IMF: {
    id: 'CONTAMINATED_IMF',
    name: 'Dust / Grit Contaminated Fluid Pool',
    refractiveIndex: 1.4400,
    lossPenaltyDb: 1.25,
    returnLossBonusDb: -12.0,
    description: 'Airborne dust and fine grit suspended in fluid pool causing core shadowing and beam scattering.'
  }
};

export const VGROOVE_CONDITIONS = {
  PRISTINE: {
    id: 'PRISTINE',
    name: 'Pristine Clean Ceramic V-Groove Channel',
    lateralOffsetUm: 0.2,
    offsetLossDb: 0.03,
    description: 'Clean ceramic guide channel holds fiber core perfectly on optical axis.'
  },
  DIRTY: {
    id: 'DIRTY',
    name: 'Dust / Coating Slag in V-Groove Channel',
    lateralOffsetUm: 1.8,
    offsetLossDb: 0.45,
    description: 'Residual acrylate coating flakes elevate fiber core out of V-groove center.'
  },
  DAMAGED: {
    id: 'DAMAGED',
    name: 'Chipped / Worn V-Groove Bed',
    lateralOffsetUm: 3.5,
    offsetLossDb: 1.35,
    description: 'Physical notch damage inducing severe angular tilt and core lateral displacement.'
  }
};

export const BFA_PRESETS = [
  {
    id: 'shahdara-town-emergency-bfa',
    name: 'Shahdara Town FAT-04 Cut Cable Emergency Verification',
    area: 'Shahdara Town',
    connectorType: 'SC_APC',
    indexMatching: 'FRESH_IMF',
    vgrooveCondition: 'PRISTINE',
    bareGlassStripMm: 12.0,
    clampRetentionN: 3.5,
    cleaveQuality: 'OPTIMAL',
    technicianName: 'Arshad Ali (Lead Splicer)',
    notes: 'Emergency verification of severed feeder tube before fusion splice tray installation.'
  },
  {
    id: 'begum-kot-dry-airgap',
    name: 'Begum Kot Industrial Trunk Dry Air-Gap Defect',
    area: 'Begum Kot',
    connectorType: 'SC_UPC',
    indexMatching: 'AIR_GAP_DRY',
    vgrooveCondition: 'PRISTINE',
    bareGlassStripMm: 10.2, // Under-inserted
    clampRetentionN: 2.8,
    cleaveQuality: 'ACCEPTABLE',
    technicianName: 'Tariq Mehmood',
    notes: 'No index matching fluid applied in field. Severe Fresnel backscatter observed on OTDR.'
  },
  {
    id: 'baradari-dirty-vgroove',
    name: 'Baradari Feeder Dusty Trench Contaminated V-Groove',
    area: 'Baradari',
    connectorType: 'SC_APC',
    indexMatching: 'CONTAMINATED_IMF',
    vgrooveCondition: 'DIRTY',
    bareGlassStripMm: 12.0,
    clampRetentionN: 2.2,
    cleaveQuality: 'ACCEPTABLE',
    technicianName: 'Zahid Khan',
    notes: 'Dusty road excavation environment contaminated bare fiber adapter V-groove channel.'
  },
  {
    id: 'vandala-excess-strip-chip',
    name: 'Vandala Road Long Bare Glass Core Chip Hazard',
    area: 'Vandala Road',
    connectorType: 'FC_UPC',
    indexMatching: 'FRESH_IMF',
    vgrooveCondition: 'DAMAGED',
    bareGlassStripMm: 16.5, // Over-stripped
    clampRetentionN: 1.2, // Loose clamp
    cleaveQuality: 'CHIPPED',
    technicianName: 'Imran Bashir',
    notes: 'Fiber stripped too long; bare glass buckled against stop with insufficient clamp hold.'
  },
  {
    id: 'ravi-siphon-fc-upc-otdr',
    name: 'Ravi Siphon Pylon OTDR Bare Spool Verification',
    area: 'Ravi Siphon',
    connectorType: 'FC_UPC',
    indexMatching: 'FRESH_IMF',
    vgrooveCondition: 'PRISTINE',
    bareGlassStripMm: 12.0,
    clampRetentionN: 4.2,
    cleaveQuality: 'OPTIMAL',
    technicianName: 'Arshad Ali',
    notes: 'Factory drum qualification prior to pulling aerial ADSS cable across Ravi river pylon.'
  }
];

/**
 * Calculates optical coupling insertion loss, return loss, and physical integrity
 * @param {Object} inputs - User and preset inputs
 * @returns {Object} Calculated metrics
 */
export function calculateBareFiberAdapterMetrics(inputs = {}) {
  const connType = BFA_CONNECTOR_TYPES[inputs.connectorType] || BFA_CONNECTOR_TYPES.SC_APC;
  const imf = INDEX_MATCHING_CONDITIONS[inputs.indexMatching] || INDEX_MATCHING_CONDITIONS.FRESH_IMF;
  const vgroove = VGROOVE_CONDITIONS[inputs.vgrooveCondition] || VGROOVE_CONDITIONS.PRISTINE;

  const stripMm = Number(inputs.bareGlassStripMm) || 12.0;
  const clampN = Number(inputs.clampRetentionN) || 3.0;
  const cleaveQuality = inputs.cleaveQuality || 'OPTIMAL';

  // 1. Strip Length Gap / Buckle Modeling (Target: 12.0 mm, nominal tolerance 11.0 - 13.0 mm)
  const stripDeltaMm = stripMm - connType.targetStripMm;
  let stripPenaltyLossDb = 0;
  let gapWarning = null;

  if (stripMm < 10.8) {
    // Under-stripped: bare glass does not reach internal ferrule stop, creating an air gap
    const gapUm = Math.round((10.8 - stripMm) * 100);
    stripPenaltyLossDb = Math.min(2.5, Math.round((gapUm * 0.015) * 100) / 100);
    gapWarning = `Fiber under-inserted by ~${gapUm} µm from internal stop (high coupling loss)`;
  } else if (stripMm > 14.0) {
    // Over-stripped: excessive bare glass unsupported, risk of micro-bend buckle or endface shatter
    const excessMm = Math.round((stripMm - 14.0) * 10) / 10;
    stripPenaltyLossDb = Math.min(1.0, Math.round((excessMm * 0.20) * 100) / 100);
    gapWarning = `Excess bare glass (${excessMm} mm beyond guide); risk of micro-bend or glass shatter`;
  }

  // 2. Cleave Quality Degradation
  let cleavePenaltyLossDb = 0;
  let cleaveRlPenaltyDb = 0;
  if (cleaveQuality === 'ACCEPTABLE') {
    cleavePenaltyLossDb = 0.15;
    cleaveRlPenaltyDb = -4.0;
  } else if (cleaveQuality === 'CHIPPED') {
    cleavePenaltyLossDb = 0.85;
    cleaveRlPenaltyDb = -18.0;
  }

  // 3. Total Insertion Loss (IL)
  const estimatedIlDb = Math.round((
    0.15 + // intrinsic Fresnel/guide baseline
    imf.lossPenaltyDb +
    vgroove.offsetLossDb +
    stripPenaltyLossDb +
    cleavePenaltyLossDb
  ) * 100) / 100;

  // 4. Optical Return Loss (RL)
  let estimatedRlDb = Math.max(14.0, Math.round((
    connType.nominalRlMinDb +
    imf.returnLossBonusDb +
    cleaveRlPenaltyDb -
    (stripMm < 10.8 ? 12.0 : 0)
  ) * 10) / 10);

  // 5. Clamp Retention Proof
  const isClampSufficient = clampN >= 2.0;

  // 6. Overall Pass/Fail Evaluation
  const isIlPass = estimatedIlDb <= connType.nominalIlMaxDb;
  const isRlPass = estimatedRlDb >= (connType.nominalRlMinDb - 5.0);
  const isStripPass = stripMm >= 11.0 && stripMm <= 13.5;
  const isOverallPass = isIlPass && isRlPass && isClampSufficient && isStripPass;

  let verdict = 'PASS';
  let verdictColor = '#10b981';
  let statusBadge = 'COMPLIANT COUPLING';

  if (!isOverallPass) {
    if (estimatedIlDb > 1.0 || estimatedRlDb < 25.0 || !isClampSufficient) {
      verdict = 'FAIL';
      verdictColor = '#ef4444';
      statusBadge = 'REJECTED COUPLING';
    } else {
      verdict = 'CAUTION';
      verdictColor = '#f59e0b';
      statusBadge = 'ELEVATED INSERTION LOSS';
    }
  }

  return {
    connectorType: connType.id,
    connectorName: connType.name,
    housingColor: connType.housingColor,
    ferruleType: connType.ferruleType,
    targetStripMm: connType.targetStripMm,
    actualStripMm: stripMm,
    stripDeltaMm,
    gapWarning,

    indexMatchingId: imf.id,
    indexMatchingName: imf.name,
    refractiveIndex: imf.refractiveIndex,

    vgrooveId: vgroove.id,
    vgrooveName: vgroove.name,
    lateralOffsetUm: vgroove.lateralOffsetUm,

    clampRetentionN: clampN,
    isClampSufficient,
    cleaveQuality,

    estimatedIlDb,
    maxAllowedIlDb: connType.nominalIlMaxDb,
    isIlPass,

    estimatedRlDb,
    minRequiredRlDb: connType.nominalRlMinDb,
    isRlPass,

    isStripPass,
    isOverallPass,
    verdict,
    verdictColor,
    statusBadge
  };
}

/**
 * Renders pure vector cutaway SVG schematic of Bare Fiber Adapter coupling
 * @param {Object} dynamics - Calculated metrics from calculateBareFiberAdapterMetrics
 * @param {Object} inputs - User inputs
 * @returns {string} SVG markup string
 */
export function renderBareFiberAdapterSvg(dynamics, inputs = {}) {
  const d = dynamics || calculateBareFiberAdapterMetrics();
  const width = 640;
  const height = 250;

  // Zirconia ferrule: x=50, y=70, w=160, h=100
  // Precision V-groove bed: x=210, y=85, w=220, h=70
  // Fiber clamp: x=430, y=75, w=150, h=90

  // Bare fiber core line (125 um glass) extends from clamp (x=430) through V-groove into ferrule
  const stripLen = d.actualStripMm || 12.0;
  // Map 12.0mm to target stop at x=140
  // Delta shift: each 1mm difference maps to 8px
  const stopX = 140;
  const fiberEndX = Math.max(100, Math.min(180, Math.round(stopX - (12.0 - stripLen) * 12)));

  const isAirGap = fiberEndX > stopX + 5;
  const isOverInserted = fiberEndX < stopX - 5;
  const beamColor = d.isOverallPass ? '#10b981' : d.verdict === 'CAUTION' ? '#f59e0b' : '#ef4444';

  return `<svg class="bfa-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bare Fiber Adapter Cutaway Schematic">
    <defs>
      <linearGradient id="ferruleGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f8fafc"/>
        <stop offset="50%" stop-color="#cbd5e1"/>
        <stop offset="100%" stop-color="#94a3b8"/>
      </linearGradient>
      <linearGradient id="vgrooveGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#334155"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
      <linearGradient id="imfGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.7"/>
        <stop offset="100%" stop-color="#0284c7" stop-opacity="0.3"/>
      </linearGradient>
    </defs>

    <rect width="${width}" height="${height}" rx="8" fill="var(--bg-card, #1e293b)" stroke="var(--border, #334155)"/>

    <!-- TITLE & STATUS -->
    <text x="25" y="30" fill="${d.housingColor}" font-size="12" font-weight="700">BARE FIBER ADAPTER: ${d.connectorName}</text>
    <rect x="${width - 170}" y="14" width="145" height="22" rx="4" fill="${d.verdictColor}" opacity="0.15"/>
    <text x="${width - 97}" y="29" fill="${d.verdictColor}" font-size="10.5" font-weight="700" text-anchor="middle">${d.statusBadge}</text>

    <!-- SECTION 1: Zirconia Ferrule Body -->
    <rect x="50" y="65" width="160" height="110" rx="4" fill="url(#ferruleGrad)" stroke="#475569" stroke-width="1.5"/>
    <text x="130" y="82" fill="#1e293b" font-size="9" font-weight="700" text-anchor="middle">${d.ferruleType}</text>

    <!-- Internal Bore & Stop -->
    <rect x="50" y="112" width="160" height="16" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
    <line x1="${stopX}" y1="108" x2="${stopX}" y2="132" stroke="#f59e0b" stroke-width="2" stroke-dasharray="2,2"/>
    <text x="${stopX}" y="103" fill="#f59e0b" font-size="7.5" font-weight="700" text-anchor="middle">Internal Stop</text>

    <!-- Optical Core inside Ferrule Stub (Left output) -->
    <line x1="50" y1="120" x2="${stopX}" y2="120" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>

    <!-- Index Matching Fluid Reservoir Droplet -->
    <ellipse cx="${stopX + 15}" cy="120" rx="18" ry="12" fill="url(#imfGrad)" stroke="#38bdf8" stroke-width="1"/>
    <text x="${stopX + 15}" y="145" fill="#38bdf8" font-size="7.5" text-anchor="middle">IMF Pool (n=${d.refractiveIndex})</text>

    <!-- SECTION 2: Precision Ceramic V-Groove Bed -->
    <rect x="210" y="75" width="220" height="95" rx="3" fill="url(#vgrooveGrad)" stroke="#475569" stroke-width="1.5"/>
    <text x="320" y="93" fill="#cbd5e1" font-size="9" font-weight="700" text-anchor="middle">Ceramic Alignment V-Groove Channel</text>

    <!-- V-Groove notch line -->
    <polygon points="210,120 225,124 415,124 430,120 415,116 225,116" fill="#0f172a" stroke="#334155"/>

    <!-- SECTION 3: Fiber Clamp & Retention Mechanism -->
    <rect x="430" y="65" width="160" height="110" rx="4" fill="#0f172a" stroke="${d.isClampSufficient ? '#10b981' : '#ef4444'}" stroke-width="1.5"/>
    <text x="510" y="82" fill="#cbd5e1" font-size="9" font-weight="700" text-anchor="middle">Magnetic Fiber Clamp</text>

    <!-- Clamp Pressure Pad -->
    <rect x="445" y="95" width="130" height="15" rx="2" fill="#334155" stroke="#475569"/>
    <text x="510" y="106" fill="#e2e8f0" font-size="8" font-weight="600" text-anchor="middle">Clamp Force: ${d.clampRetentionN} N</text>

    <!-- 250um Buffer Fiber (Enters from right) -->
    <rect x="445" y="117" width="145" height="6" rx="2" fill="#eab308" stroke="#ca8a04"/>
    <text x="510" y="137" fill="#eab308" font-size="7.5" text-anchor="middle">250µm Primary Acrylate Coating</text>

    <!-- Bare 125um Silica Glass Core (Spans from buffer at x=445 to fiberEndX) -->
    <line x1="445" y1="120" x2="${fiberEndX}" y2="120" stroke="#f8fafc" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${fiberEndX}" cy="120" r="3.5" fill="${beamColor}" stroke="#ffffff" stroke-width="1"/>

    <!-- Light Path Propagation Ray Trace -->
    <path d="M 50 120 L ${fiberEndX} 120" stroke="${beamColor}" stroke-width="1.5" stroke-dasharray="4,2"/>

    <!-- Air Gap Indicator if any -->
    ${isAirGap ? `
      <rect x="${stopX}" y="113" width="${fiberEndX - stopX}" height="14" fill="rgba(239, 68, 68, 0.3)" stroke="#ef4444" stroke-width="1"/>
      <text x="${(stopX + fiberEndX) / 2}" y="110" fill="#ef4444" font-size="7.5" font-weight="700" text-anchor="middle">Air Gap</text>
    ` : ''}

    <!-- Cleave length scale dimension line below -->
    <line x1="${fiberEndX}" y1="165" x2="445" y2="165" stroke="var(--text-muted, #94a3b8)" stroke-width="1"/>
    <line x1="${fiberEndX}" y1="160" x2="${fiberEndX}" y2="170" stroke="var(--text-muted, #94a3b8)" stroke-width="1"/>
    <line x1="445" y1="160" x2="445" y2="170" stroke="var(--text-muted, #94a3b8)" stroke-width="1"/>
    <text x="${(fiberEndX + 445) / 2}" y="178" fill="${d.isStripPass ? '#38bdf8' : '#f59e0b'}" font-size="8.5" font-weight="700" text-anchor="middle">Strip Length: ${d.actualStripMm} mm (Nominal 12.0mm)</text>

    <!-- BOTTOM TELEMETRY TILES -->
    <rect x="25" y="195" width="135" height="42" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="35" y="210" fill="var(--text-muted, #94a3b8)" font-size="8">INSERTION LOSS (IL)</text>
    <text x="35" y="228" fill="${d.isIlPass ? '#10b981' : '#ef4444'}" font-size="12" font-weight="700">${d.estimatedIlDb} dB <tspan font-size="8.5" fill="var(--text-muted, #94a3b8)">(max ${d.maxAllowedIlDb})</tspan></text>

    <rect x="175" y="195" width="135" height="42" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="185" y="210" fill="var(--text-muted, #94a3b8)" font-size="8">RETURN LOSS (RL)</text>
    <text x="185" y="228" fill="${d.isRlPass ? '#38bdf8' : '#ef4444'}" font-size="12" font-weight="700">${d.estimatedRlDb} dB <tspan font-size="8.5" fill="var(--text-muted, #94a3b8)">(min ${d.minRequiredRlDb})</tspan></text>

    <rect x="325" y="195" width="145" height="42" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="335" y="210" fill="var(--text-muted, #94a3b8)" font-size="8">CLAMP RETENTION FORCE</text>
    <text x="335" y="228" fill="${d.isClampSufficient ? '#10b981' : '#ef4444'}" font-size="12" font-weight="700">${d.clampRetentionN} N <tspan font-size="8.5" fill="var(--text-muted, #94a3b8)">(min 2.0 N)</tspan></text>

    <rect x="485" y="195" width="130" height="42" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="495" y="210" fill="var(--text-muted, #94a3b8)" font-size="8">V-GROOVE OFFSET</text>
    <text x="495" y="228" fill="${d.lateralOffsetUm > 1.0 ? '#f59e0b' : '#38bdf8'}" font-size="12" font-weight="700">${d.lateralOffsetUm} µm <tspan font-size="8.5" fill="var(--text-muted, #94a3b8)">Offset</tspan></text>
  </svg>`;
}

/**
 * Formats a bilingual WhatsApp dispatch message for the bare fiber adapter inspection
 * @param {Object} dynamics - Calculated metrics
 * @param {Object} inputs - Inputs and metadata
 * @returns {string} WhatsApp text
 */
export function formatBareFiberAdapterWhatsApp(dynamics, inputs = {}) {
  const d = dynamics || calculateBareFiberAdapterMetrics();
  const tech = inputs.technicianName || 'Field Linesman';
  const area = inputs.area || 'Shahdara Town';
  const notes = inputs.notes || 'None';

  return `*SHAHDARA ISP - BARE FIBER ADAPTER (BFA) AUDIT*
*شاہدرا آئی ایس پی - بیئر فائبر اڈاپٹر اور عارضی سپلائس رپورٹ*
---------------------------------------
*Date / تاریخ:* ${new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
*Technician / ٹیکنیشن:* ${tech}
*Area / علاقہ:* ${area}
*Connector / کنیکٹر:* ${d.connectorName}
*Fluid Condition:* ${d.indexMatchingName}
*V-Groove Bed:* ${d.vgrooveName}
---------------------------------------
*METROLOGY & COUPLING RESULTS:*
- Bare Glass Strip: ${d.actualStripMm} mm (Target: 12.0 mm)
- Insertion Loss (IL): ${d.estimatedIlDb} dB [Limit: <= ${d.maxAllowedIlDb} dB] -> *${d.isIlPass ? 'PASS' : 'FAIL'}*
- Return Loss (RL): ${d.estimatedRlDb} dB [Limit: >= ${d.minRequiredRlDb} dB] -> *${d.isRlPass ? 'PASS' : 'FAIL'}*
- Clamp Retention: ${d.clampRetentionN} N -> *${d.isClampSufficient ? 'PASS' : 'FAIL'}*
- Coupling Verdict: *${d.verdict}* (${d.statusBadge})
${d.gapWarning ? `*Defect Alert:* ${d.gapWarning}` : ''}
*Field Notes:* ${notes}
---------------------------------------
_Standard: IEC 60793-1-40 / TIA-455-171_
_Shahdara ISP Field Network Operations Center_`;
}

/**
 * Loads audit log from localStorage
 * @param {Storage} storage - Storage backend
 * @returns {Array} Array of audit entries
 */
export function loadBareFiberAdapterAuditLog(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(BARE_FIBER_ADAPTER_STORAGE_KEY);
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
export function saveBareFiberAdapterAuditLog(audit, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  const current = loadBareFiberAdapterAuditLog(storage);
  const entry = {
    id: `bfa-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ...audit
  };
  const updated = [entry, ...current].slice(0, 50);
  try {
    storage.setItem(BARE_FIBER_ADAPTER_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}

/**
 * Clears audit log from localStorage
 * @param {Storage} storage - Storage backend
 */
export function clearBareFiberAdapterAuditLog(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.removeItem(BARE_FIBER_ADAPTER_STORAGE_KEY);
  } catch {}
}

/**
 * Exports bare fiber adapter audits as RFC-4180 CSV with UTF-8 BOM
 * @param {Array} audits - List of audits
 * @returns {string} CSV text
 */
export function generateBareFiberAdapterCsv(audits = []) {
  const headers = [
    'Audit_ID',
    'Timestamp',
    'Technician',
    'Area',
    'Connector_Type',
    'Index_Matching',
    'VGroove_Condition',
    'Strip_Length_mm',
    'Clamp_Force_N',
    'Estimated_IL_dB',
    'Estimated_RL_dB',
    'Verdict',
    'Notes'
  ];

  const rows = (audits || []).map(a => [
    `"${a.id || ''}"`,
    `"${a.timestamp || ''}"`,
    `"${(a.technicianName || '').replace(/"/g, '""')}"`,
    `"${(a.area || '').replace(/"/g, '""')}"`,
    `"${a.connectorType || ''}"`,
    `"${a.indexMatching || ''}"`,
    `"${a.vgrooveCondition || ''}"`,
    a.actualStripMm || a.bareGlassStripMm || 12.0,
    a.clampRetentionN || 0,
    a.estimatedIlDb || 0,
    a.estimatedRlDb || 0,
    `"${a.verdict || ''}"`,
    `"${(a.notes || '').replace(/"/g, '""')}"`
  ].join(','));

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Controller for Mobile Bare Fiber Adapter Modal
 * @param {Object} state - Application state
 * @param {Object} options - Controller options (document, storage, onToast)
 * @returns {Object} Controller interface
 */
export function setupMobileBareFiberAdapterModal(state, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

  const modal = doc.getElementById('mobileBareFiberAdapterModal');
  const closeBtn = doc.getElementById('mobileBareFiberAdapterModalCloseBtn');
  const openBtn = doc.getElementById('mobileMoreBareFiberAdapterBtn');

  // Input Elements
  const presetSelect = doc.getElementById('bfaPresetSelect');
  const areaSelect = doc.getElementById('bfaAreaSelect');
  const techInput = doc.getElementById('bfaTechInput');
  const connectorTypeSelect = doc.getElementById('bfaConnectorTypeSelect');
  const imfSelect = doc.getElementById('bfaImfSelect');
  const vgrooveSelect = doc.getElementById('bfaVgrooveSelect');
  const stripSlider = doc.getElementById('bfaStripSlider');
  const stripLabel = doc.getElementById('bfaStripLabel');
  const clampSlider = doc.getElementById('bfaClampSlider');
  const clampLabel = doc.getElementById('bfaClampLabel');
  const cleaveSelect = doc.getElementById('bfaCleaveSelect');
  const notesInput = doc.getElementById('bfaNotesInput');

  // Action Buttons
  const resetBtn = doc.getElementById('bfaResetBtn');
  const saveBtn = doc.getElementById('bfaSaveBtn');
  const whatsAppBtn = doc.getElementById('bfaWhatsAppBtn');
  const exportCsvBtn = doc.getElementById('bfaExportCsvBtn');

  // Output Elements
  const diagramContainer = doc.getElementById('bfaDiagramContainer');
  const historyTbody = doc.getElementById('bfaHistoryTbody');
  const historySearch = doc.getElementById('bfaHistorySearch');
  const historyVerdictFilter = doc.getElementById('bfaHistoryVerdictFilter');

  let currentInputs = {
    connectorType: 'SC_APC',
    indexMatching: 'FRESH_IMF',
    vgrooveCondition: 'PRISTINE',
    bareGlassStripMm: 12.0,
    clampRetentionN: 3.5,
    cleaveQuality: 'OPTIMAL',
    technicianName: 'Arshad Ali',
    area: 'Shahdara Town',
    notes: ''
  };

  function loadPreset(presetId) {
    const p = BFA_PRESETS.find(item => item.id === presetId) || BFA_PRESETS[0];
    currentInputs = {
      connectorType: p.connectorType,
      indexMatching: p.indexMatching,
      vgrooveCondition: p.vgrooveCondition,
      bareGlassStripMm: p.bareGlassStripMm,
      clampRetentionN: p.clampRetentionN,
      cleaveQuality: p.cleaveQuality,
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
    if (connectorTypeSelect) connectorTypeSelect.value = currentInputs.connectorType;
    if (imfSelect) imfSelect.value = currentInputs.indexMatching;
    if (vgrooveSelect) vgrooveSelect.value = currentInputs.vgrooveCondition;
    if (stripSlider) stripSlider.value = String(currentInputs.bareGlassStripMm);
    if (clampSlider) clampSlider.value = String(currentInputs.clampRetentionN);
    if (cleaveSelect) cleaveSelect.value = currentInputs.cleaveQuality;
    if (notesInput) notesInput.value = currentInputs.notes || '';
    if (stripLabel) stripLabel.textContent = `${currentInputs.bareGlassStripMm} mm`;
    if (clampLabel) clampLabel.textContent = `${currentInputs.clampRetentionN} N`;
  }

  function syncInputsFromUi() {
    if (areaSelect) currentInputs.area = areaSelect.value;
    if (techInput) currentInputs.technicianName = techInput.value;
    if (connectorTypeSelect) currentInputs.connectorType = connectorTypeSelect.value;
    if (imfSelect) currentInputs.indexMatching = imfSelect.value;
    if (vgrooveSelect) currentInputs.vgrooveCondition = vgrooveSelect.value;
    if (stripSlider) currentInputs.bareGlassStripMm = Number(stripSlider.value);
    if (clampSlider) currentInputs.clampRetentionN = Number(clampSlider.value);
    if (cleaveSelect) currentInputs.cleaveQuality = cleaveSelect.value;
    if (notesInput) currentInputs.notes = notesInput.value;
  }

  function renderHistoryTable() {
    if (!historyTbody) return;
    const audits = loadBareFiberAdapterAuditLog(storage);
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
      historyTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted,#94a3b8);padding:12px;">No bare fiber adapter audits recorded.</td></tr>`;
      return;
    }

    historyTbody.innerHTML = filtered.map(a => `
      <tr style="border-bottom:1px solid var(--border,#334155);font-size:11px;">
        <td style="padding:6px 8px;">${a.timestamp ? a.timestamp.slice(0, 16).replace('T', ' ') : 'Just now'}</td>
        <td style="padding:6px 8px;">${a.technicianName || 'Tech'}</td>
        <td style="padding:6px 8px;">${a.area || 'Shahdara'}</td>
        <td style="padding:6px 8px;">${a.connectorType || 'SC_APC'}</td>
        <td style="padding:6px 8px;font-weight:700;">${a.estimatedIlDb || 0} dB</td>
        <td style="padding:6px 8px;"><span style="color:${a.verdict === 'PASS' ? '#10b981' : a.verdict === 'CAUTION' ? '#f59e0b' : '#ef4444'};font-weight:700;">${a.verdict || 'PASS'}</span></td>
        <td style="padding:6px 8px;">
          <button class="bfa-inspect-btn secondary-button" data-audit-id="${a.id}" type="button" style="padding:2px 6px;font-size:10px;">Inspect</button>
        </td>
      </tr>
    `).join('');

    // Wire inspect buttons
    historyTbody.querySelectorAll('.bfa-inspect-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const auditId = btn.getAttribute('data-audit-id');
        const item = audits.find(x => x.id === auditId);
        if (item) {
          currentInputs = {
            connectorType: item.connectorType || 'SC_APC',
            indexMatching: item.indexMatching || 'FRESH_IMF',
            vgrooveCondition: item.vgrooveCondition || 'PRISTINE',
            bareGlassStripMm: item.actualStripMm || item.bareGlassStripMm || 12.0,
            clampRetentionN: item.clampRetentionN || 3.5,
            cleaveQuality: item.cleaveQuality || 'OPTIMAL',
            technicianName: item.technicianName || 'Tech',
            area: item.area || 'Shahdara Town',
            notes: item.notes || ''
          };
          syncInputsToUi();
          updateUi();
          if (typeof options.onToast === 'function') {
            options.onToast(`Inspecting audit ${auditId}`);
          }
        }
      });
    });
  }

  function updateUi() {
    syncInputsFromUi();
    const dynamics = calculateBareFiberAdapterMetrics(currentInputs);

    if (stripLabel) stripLabel.textContent = `${currentInputs.bareGlassStripMm} mm`;
    if (clampLabel) clampLabel.textContent = `${currentInputs.clampRetentionN} N`;

    if (diagramContainer) {
      diagramContainer.innerHTML = renderBareFiberAdapterSvg(dynamics, currentInputs);
    }

    renderHistoryTable();
  }

  // Event Listeners
  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      loadPreset(presetSelect.value);
    });
  }

  [areaSelect, techInput, connectorTypeSelect, imfSelect, vgrooveSelect, cleaveSelect, notesInput].forEach(el => {
    if (el) {
      el.addEventListener('change', updateUi);
      el.addEventListener('input', updateUi);
    }
  });

  if (stripSlider) {
    stripSlider.addEventListener('input', () => {
      currentInputs.bareGlassStripMm = Number(stripSlider.value);
      if (stripLabel) stripLabel.textContent = `${currentInputs.bareGlassStripMm} mm`;
      updateUi();
    });
  }

  if (clampSlider) {
    clampSlider.addEventListener('input', () => {
      currentInputs.clampRetentionN = Number(clampSlider.value);
      if (clampLabel) clampLabel.textContent = `${currentInputs.clampRetentionN} N`;
      updateUi();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      loadPreset('shahdara-town-emergency-bfa');
      if (presetSelect) presetSelect.value = 'shahdara-town-emergency-bfa';
      if (typeof options.onToast === 'function') {
        options.onToast('Bare Fiber Adapter parameters reset to baseline.');
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const dynamics = calculateBareFiberAdapterMetrics(currentInputs);
      saveBareFiberAdapterAuditLog({ ...currentInputs, ...dynamics }, storage);
      renderHistoryTable();
      if (typeof options.onToast === 'function') {
        options.onToast(`Bare fiber adapter audit saved (${dynamics.verdict}).`);
      }
    });
  }

  if (whatsAppBtn) {
    whatsAppBtn.addEventListener('click', () => {
      const dynamics = calculateBareFiberAdapterMetrics(currentInputs);
      const msg = formatBareFiberAdapterWhatsApp(dynamics, currentInputs);
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
      let audits = loadBareFiberAdapterAuditLog(storage);
      if (audits.length === 0) {
        const dynamics = calculateBareFiberAdapterMetrics(currentInputs);
        audits = saveBareFiberAdapterAuditLog({ ...currentInputs, ...dynamics }, storage);
      }
      const csv = generateBareFiberAdapterCsv(audits);
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
    getMetrics: () => calculateBareFiberAdapterMetrics(currentInputs),
    getSavedAudits: () => loadBareFiberAdapterAuditLog(storage)
  };
}
