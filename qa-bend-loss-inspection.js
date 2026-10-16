/**
 * Shahdara ISP Billing & Network Operations - Customer Premises Fiber Bending Radius & Macro-Bend QA Certification Suite
 * Standards: ITU-T G.652.D, ITU-T G.657.A1/A2/B3, IEC 60793-1-47, and ITU-T L.12 / L.400
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Certification
 */

export const BEND_LOSS_STORAGE_KEY = 'shahdara_bend_loss_certs_v1';

export const FIBER_BEND_STANDARDS = {
  G652D: {
    id: 'G652D',
    name: 'ITU-T G.652.D Standard Singlemode (SMF-28)',
    category: 'Legacy & Standard Feeder Core',
    minRadiusMm: 30.0,
    recommendedSlackTrayRadiusMm: 35.0,
    bendSensitivityFactor: 1.0,
    baseLossAt10mm1550: 3.2, // dB per turn
    baseLossAt7_5mm1550: 8.5,
    baseLossAt5mm1550: 16.0,
    description: 'Requires wide 30mm radius. Prone to high macro-bend attenuation if looped in tight rosette.'
  },
  G657A1: {
    id: 'G657A1',
    name: 'ITU-T G.657.A1 Bend-Insensitive Access Drop',
    category: 'FTTH Outdoor/Indoor Distribution',
    minRadiusMm: 10.0,
    recommendedSlackTrayRadiusMm: 15.0,
    bendSensitivityFactor: 0.15,
    baseLossAt10mm1550: 0.20,
    baseLossAt7_5mm1550: 0.75,
    baseLossAt5mm1550: 2.8,
    description: 'Tolerates 10mm radius turns around internal walls with low macro-bend leakage.'
  },
  G657A2: {
    id: 'G657A2',
    name: 'ITU-T G.657.A2 Enhanced Bend-Insensitive Drop',
    category: 'Last-Mile Residential Drop & Riser',
    minRadiusMm: 7.5,
    recommendedSlackTrayRadiusMm: 10.0,
    bendSensitivityFactor: 0.05,
    baseLossAt10mm1550: 0.03,
    baseLossAt7_5mm1550: 0.10,
    baseLossAt5mm1550: 0.55,
    description: 'Highly flexible 7.5mm radius. Recommended standard for Shahdara customer in-home drops.'
  },
  G657B3: {
    id: 'G657B3',
    name: 'ITU-T G.657.B3 Ultra-Bend Robust In-Premises',
    category: 'Molding, Skirting & Door Jamb Tight Routing',
    minRadiusMm: 5.0,
    recommendedSlackTrayRadiusMm: 7.5,
    bendSensitivityFactor: 0.015,
    baseLossAt10mm1550: 0.01,
    baseLossAt7_5mm1550: 0.03,
    baseLossAt5mm1550: 0.08,
    description: 'Extreme bend resilience down to 5mm radius around sharp 90-degree indoor architectural corners.'
  }
};

export const WAVELENGTH_BEND_MULTIPLIERS = {
  '1310': { wavelengthNm: 1310, factor: 0.22, name: '1310 nm (GPON Upstream - Least Sensitive)' },
  '1490': { wavelengthNm: 1490, factor: 0.70, name: '1490 nm (GPON Downstream - Moderate)' },
  '1550': { wavelengthNm: 1550, factor: 1.00, name: '1550 nm (Standard Diagnostic Benchmark)' },
  '1577': { wavelengthNm: 1577, factor: 1.65, name: '1577 nm (XGS-PON Downstream - High Loss)' },
  '1625': { wavelengthNm: 1625, factor: 3.20, name: '1625 nm (Maintenance OTDR - Extreme Sensitivity)' }
};

export const ROUTING_CHECKLIST_ITEMS = [
  { id: 'rosette_slack', label: 'Rosette Slack Coil >= Standard Min Radius', critical: true },
  { id: 'wall_corners', label: 'Corner Bend Protectors / Guides Installed at 90° Turns', critical: false },
  { id: 'clip_tension', label: 'Cable Clips / Staples Round & Non-Pinching', critical: true },
  { id: 'entry_conduit', label: 'Exterior Wall Pass-Through Sleeve & Drip Loop in Place', critical: true },
  { id: 'onu_pigtail', label: 'ONU Patch Cord Uncrushed with Free Strain Relief', critical: true }
];

export const BEND_VERDICTS = {
  OPTIMAL_PASS: {
    id: 'OPTIMAL_PASS',
    label: 'OPTIMAL PASS',
    badgeClass: 'badge-success',
    colorHex: '#10b981',
    description: 'Flawless Cable Trajectory. Zero measurable macro-bend or micro-bend light leakage.'
  },
  ACCEPTABLE_PASS: {
    id: 'ACCEPTABLE_PASS',
    label: 'ACCEPTABLE PASS',
    badgeClass: 'badge-info',
    colorHex: '#0284c7',
    description: 'Minor Cable Curvature within safe operational limits. Suitable for service.'
  },
  MARGINAL_WARNING: {
    id: 'MARGINAL_WARNING',
    label: 'MARGINAL WARNING',
    badgeClass: 'badge-warning',
    colorHex: '#f59e0b',
    description: 'Tight Bend Detected. High differential loss at 1550/1625nm. Relax slack loops.'
  },
  CRITICAL_MACROBEND_FAIL: {
    id: 'CRITICAL_MACROBEND_FAIL',
    label: 'CRITICAL FAIL / MACRO-BEND',
    badgeClass: 'badge-danger',
    colorHex: '#ef4444',
    description: 'Severe Macro-Bend or Crushed Staple. Massive optical loss. Re-routing mandated.'
  }
};

/**
 * Calculates theoretical macro-bending attenuation based on ITU-T G.657 physics models.
 */
export function calculateMacroBendLoss({
  fiberType = 'G657A2',
  radiusMm = 15.0,
  turnsCount = 2,
  microBendStressIndex = 0, // 0 to 100
  checklist = {}
} = {}) {
  const profile = FIBER_BEND_STANDARDS[fiberType] || FIBER_BEND_STANDARDS.G657A2;
  const radius = Math.max(2.5, Math.min(60.0, Number(radiusMm) || profile.minRadiusMm));
  const turns = Math.max(1, Math.min(20, parseInt(turnsCount, 10) || 1));
  const microStress = Math.max(0, Math.min(100, parseInt(microBendStressIndex, 10) || 0));

  // Empirical exponential bend loss curve calibrated against ITU-T G.657 benchmark tables
  let singleTurnLoss1550 = 0;
  if (radius < profile.minRadiusMm) {
    const deltaMm = profile.minRadiusMm - radius;
    // Exponential runaway when radius drops below specification
    singleTurnLoss1550 = profile.baseLossAt10mm1550 * Math.pow(1.85, deltaMm * 0.85);
  } else {
    // Graceful baseline drop when radius is greater than or equal to minimum
    const excessMm = radius - profile.minRadiusMm;
    singleTurnLoss1550 = (profile.baseLossAt10mm1550 * 0.12) / (1 + excessMm * 0.45);
  }

  // Micro-bend pinch penalty (crushed staples, tight zip-ties)
  const microBendPenaltyDb = microStress * 0.016;

  // Calculate losses across key optical wavelengths
  const wavelengthLosses = {};
  for (const [key, wl] of Object.entries(WAVELENGTH_BEND_MULTIPLIERS)) {
    const rawLoss = singleTurnLoss1550 * turns * wl.factor + microBendPenaltyDb;
    wavelengthLosses[key] = Number(Math.max(0.005, rawLoss).toFixed(3));
  }

  const loss1310 = wavelengthLosses['1310'];
  const loss1490 = wavelengthLosses['1490'];
  const loss1550 = wavelengthLosses['1550'];
  const loss1577 = wavelengthLosses['1577'];
  const loss1625 = wavelengthLosses['1625'];

  // Wavelength differential (Macro-bend fingerprint: 1550nm - 1310nm)
  const differential1550_1310 = Number((loss1550 - loss1310).toFixed(3));
  const differential1625_1310 = Number((loss1625 - loss1310).toFixed(3));

  // Physical checklist verification
  let failedChecklistCount = 0;
  let criticalChecklistFailed = false;
  const checklistResults = ROUTING_CHECKLIST_ITEMS.map(item => {
    const passed = Boolean(checklist[item.id]);
    if (!passed) {
      failedChecklistCount++;
      if (item.critical) criticalChecklistFailed = true;
    }
    return { ...item, passed };
  });

  // Evaluate Verdict
  let verdict = BEND_VERDICTS.OPTIMAL_PASS;
  if (criticalChecklistFailed || loss1550 >= 1.50 || differential1550_1310 >= 1.0) {
    verdict = BEND_VERDICTS.CRITICAL_MACROBEND_FAIL;
  } else if (failedChecklistCount > 0 || loss1550 >= 0.45 || differential1550_1310 >= 0.30) {
    verdict = BEND_VERDICTS.MARGINAL_WARNING;
  } else if (loss1550 > 0.12 || radius < profile.minRadiusMm) {
    verdict = BEND_VERDICTS.ACCEPTABLE_PASS;
  }

  return {
    fiberType,
    profile,
    radiusMm: radius,
    turnsCount: turns,
    microBendStressIndex: microStress,
    wavelengthLosses,
    loss1310Db: loss1310,
    loss1490Db: loss1490,
    loss1550Db: loss1550,
    loss1577Db: loss1577,
    loss1625Db: loss1625,
    differential1550_1310Db: differential1550_1310,
    differential1625_1310Db: differential1625_1310,
    microBendPenaltyDb: Number(microBendPenaltyDb.toFixed(3)),
    checklistResults,
    failedChecklistCount,
    criticalChecklistFailed,
    verdict,
    compliant: verdict.id === 'OPTIMAL_PASS' || verdict.id === 'ACCEPTABLE_PASS'
  };
}

/**
 * Builds sequential certificate record for local storage auditing.
 */
export function buildBendLossCertRecord(data = {}, existingRecords = []) {
  const count = (existingRecords && existingRecords.length) ? existingRecords.length + 1 : 1;
  const seq = String(count).padStart(4, '0');
  const d = new Date();
  const yyyymm = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const certId = `BND-${yyyymm}-${seq}`;

  return {
    id: certId,
    timestamp: d.toISOString(),
    customerNumber: data.customerNumber || '—',
    customerName: String(data.customerName || 'Walk-in Subscriber').trim(),
    customerPhone: String(data.customerPhone || '—').trim(),
    area: String(data.area || 'Shahdara Central').trim(),
    premisesType: String(data.premisesType || 'Residential Home').trim(),
    fiberType: data.fiberType || 'G657A2',
    radiusMm: Number(data.radiusMm) || 15.0,
    turnsCount: parseInt(data.turnsCount, 10) || 2,
    microBendStressIndex: parseInt(data.microBendStressIndex, 10) || 0,
    loss1310Db: data.loss1310Db || 0.05,
    loss1490Db: data.loss1490Db || 0.12,
    loss1550Db: data.loss1550Db || 0.20,
    loss1625Db: data.loss1625Db || 0.55,
    differential1550_1310Db: data.differential1550_1310Db || 0.15,
    verdict: data.verdict || BEND_VERDICTS.OPTIMAL_PASS,
    technicianName: String(data.technicianName || 'Shahdara Field Lineman').trim(),
    notes: String(data.notes || '').trim()
  };
}

/**
 * Validates certification form inputs before persistence.
 */
export function validateBendLossCertInput(data = {}) {
  const errors = {};

  if (!data.customerName || !String(data.customerName).trim()) {
    errors.customerName = 'Subscriber name is required.';
  }

  const radius = Number(data.radiusMm);
  if (isNaN(radius) || radius < 2.5 || radius > 60.0) {
    errors.radiusMm = 'Bending radius must be between 2.5 mm and 60.0 mm.';
  }

  const turns = parseInt(data.turnsCount, 10);
  if (isNaN(turns) || turns < 1 || turns > 20) {
    errors.turnsCount = 'Turns count must be between 1 and 20 loops.';
  }

  const stress = parseInt(data.microBendStressIndex, 10);
  if (isNaN(stress) || stress < 0 || stress > 100) {
    errors.microBendStressIndex = 'Micro-bend stress index must be 0 to 100.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Retrieves saved inspection certificates from LocalStorage.
 */
export function getSavedBendLossCerts(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(BEND_LOSS_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Persists an inspection certificate into LocalStorage.
 */
export function saveBendLossCert(cert, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage || !cert) return false;
  try {
    const existing = getSavedBendLossCerts(storage);
    const updated = [cert, ...existing.filter(x => x.id !== cert.id)].slice(0, 100);
    storage.setItem(BEND_LOSS_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears saved inspection certificates from LocalStorage.
 */
export function clearBendLossCerts(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return false;
  try {
    storage.removeItem(BEND_LOSS_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates an interactive, responsive vector SVG fiber bend trajectory diagram.
 */
export function renderBendLossAnalysisSvg(result = {}) {
  const r = result.radiusMm || 15.0;
  const turns = result.turnsCount || 2;
  const profile = result.profile || FIBER_BEND_STANDARDS.G657A2;
  const minR = profile.minRadiusMm || 7.5;
  const verdict = result.verdict || BEND_VERDICTS.OPTIMAL_PASS;
  const color = verdict.colorHex || '#10b981';

  // SVG dimensions
  const width = 760;
  const height = 300;

  // Arc geometry
  const cx = 380;
  const cy = 160;
  // Visual scaling of radius in SVG pixels: map 5mm - 40mm to 35px - 110px
  const svgRadius = Math.max(30, Math.min(125, 30 + (r / 40.0) * 85));
  const svgMinRadius = Math.max(30, Math.min(125, 30 + (minR / 40.0) * 85));

  // Evanescent wave leakage beams count when radius < minR
  const leakageIntensity = r < minR ? Math.min(8, Math.round(((minR - r) / minR) * 8) + 2) : 0;
  let leakageRays = '';
  if (leakageIntensity > 0) {
    for (let i = 0; i < leakageIntensity; i++) {
      const angle = (Math.PI / 4) + (i * 0.15);
      const x1 = cx + Math.cos(angle) * (svgRadius + 4);
      const y1 = cy - Math.sin(angle) * (svgRadius + 4);
      const x2 = cx + Math.cos(angle) * (svgRadius + 28);
      const y2 = cy - Math.sin(angle) * (svgRadius + 28);
      leakageRays += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-dasharray="3,2" opacity="0.85" />`;
    }
  }

  // Wavelength bar charts
  const wlKeys = ['1310', '1490', '1550', '1625'];
  let wlBars = '';
  const maxLossForScale = Math.max(0.5, (result.loss1625Db || 0.5) * 1.2);
  const barStartY = 190;
  const barAreaW = 200;

  wlKeys.forEach((k, idx) => {
    const val = (result.wavelengthLosses && result.wavelengthLosses[k]) ? result.wavelengthLosses[k] : 0.05;
    const barH = Math.min(95, Math.max(4, (val / maxLossForScale) * 80));
    const bx = 520 + idx * 52;
    const by = barStartY + 80 - barH;
    const barColor = k === '1625' ? '#ec4899' : k === '1550' ? '#ef4444' : k === '1490' ? '#f59e0b' : '#10b981';

    wlBars += `
      <g>
        <rect x="${bx}" y="${by}" width="36" height="${barH}" rx="4" fill="${barColor}" fill-opacity="0.85" />
        <text x="${bx + 18}" y="${by - 6}" font-size="10" font-weight="700" fill="${barColor}" text-anchor="middle">${val.toFixed(2)}</text>
        <text x="${bx + 18}" y="${barStartY + 95}" font-size="10" font-weight="600" fill="currentColor" opacity="0.75" text-anchor="middle">${k}nm</text>
      </g>
    `;
  });

  return `
    <svg class="bend-loss-analysis-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fiber Core Bending Radius and Evanescent Cladding Leakage Diagram">
      <defs>
        <radialGradient id="bendCoreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#0284c7" stop-opacity="0.1" />
        </radialGradient>
      </defs>

      <!-- Outer Frame & Gridlines -->
      <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="transparent" />

      <!-- Section Titles -->
      <text x="24" y="32" font-size="13" font-weight="800" fill="currentColor" letter-spacing="0.5">ITU-T G.657 FIBER BEND DYNAMICS &amp; CORE TRAJECTORY</text>
      <text x="520" y="32" font-size="12" font-weight="700" fill="currentColor" opacity="0.8">SPECTRAL LOSS DIFFERENTIAL (dB)</text>

      <!-- Curvature Radius Mandrel Circle -->
      <circle cx="${cx}" cy="${cy}" r="${svgRadius}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" />
      <circle cx="${cx}" cy="${cy}" r="${svgRadius + 4}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.6" />
      <circle cx="${cx}" cy="${cy}" r="${svgMinRadius}" fill="none" stroke="#f59e0b" stroke-width="1" stroke-dasharray="2,3" opacity="0.7" />

      <!-- Mandrel Center & Radius Pointer -->
      <circle cx="${cx}" cy="${cy}" r="3.5" fill="currentColor" />
      <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - svgRadius}" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2,2" opacity="0.7" />
      <text x="${cx + 8}" y="${cy - (svgRadius / 2)}" font-size="11" font-weight="700" fill="currentColor">R = ${r.toFixed(1)} mm</text>

      <!-- Evanescent Leakage Rays -->
      ${leakageRays}

      <!-- Status HUD Box -->
      <g transform="translate(24, 60)">
        <rect x="0" y="0" width="220" height="195" rx="8" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.15" />
        <text x="14" y="26" font-size="11" font-weight="700" fill="currentColor" opacity="0.7">FIBER SPECIFICATION:</text>
        <text x="14" y="44" font-size="13" font-weight="800" fill="currentColor">${profile.id} (${profile.name.split(' ')[0]})</text>
        <text x="14" y="70" font-size="11" font-weight="700" fill="currentColor" opacity="0.7">MIN COMPLIANT RADIUS:</text>
        <text x="14" y="88" font-size="14" font-weight="800" fill="#f59e0b">≥ ${minR.toFixed(1)} mm</text>
        <text x="14" y="114" font-size="11" font-weight="700" fill="currentColor" opacity="0.7">MEASURED RADIUS &amp; TURNS:</text>
        <text x="14" y="132" font-size="14" font-weight="800" fill="${color}">${r.toFixed(1)} mm · ${turns} turn(s)</text>
        <text x="14" y="158" font-size="11" font-weight="700" fill="currentColor" opacity="0.7">MACROBEND VERDICT:</text>
        <rect x="14" y="166" width="192" height="22" rx="4" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1" />
        <text x="110" y="181" font-size="11" font-weight="800" fill="${color}" text-anchor="middle">${verdict.label}</text>
      </g>

      <!-- Center Explanatory Callout -->
      <text x="${cx}" y="260" font-size="11" font-weight="600" fill="currentColor" opacity="0.8" text-anchor="middle">
        ${r < minR ? '⚠️ Critical Angle Exceeded: Evanescent wave radiation escaping core' : '✓ Full Internal Reflection Maintained within Guided Mode'}
      </text>

      <!-- Wavelength Multi-Bar Graph -->
      <line x1="510" y1="${barStartY + 80}" x2="730" y2="${barStartY + 80}" stroke="currentColor" stroke-opacity="0.25" stroke-width="1.5" />
      ${wlBars}
    </svg>
  `.trim();
}

/**
 * Generates formatted WhatsApp lineman dispatch report text.
 */
export function formatBendLossCertWhatsApp(cert = {}) {
  const c = cert || {};
  const v = c.verdict || BEND_VERDICTS.OPTIMAL_PASS;
  const dateStr = new Date(c.timestamp || Date.now()).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = new Date(c.timestamp || Date.now()).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });

  const lines = [
    `*SHAHDARA FIBER NET · BENDING RADIUS & MACRO-BEND QA REPORT* 🔍⚡`,
    `----------------------------------------`,
    `📄 *Inspection ID:* ${c.id || 'BND-NEW'}`,
    `📅 *Date:* ${dateStr} at ${timeStr}`,
    `👤 *Technician:* ${c.technicianName || 'Field Lineman'}`,
    `🏢 *Location / Mohalla:* ${c.area || 'Shahdara Central'}`,
    `🎯 *Subscriber:* ${c.customerName || 'Resident'} (${c.customerNumber ? '#' + c.customerNumber : 'New'})`,
    `----------------------------------------`,
    `📶 *Fiber Core Profile:* ${c.fiberType || 'G.657.A2'}`,
    `📏 *Measured Bend Radius:* ${c.radiusMm || 15} mm (Loops: ${c.turnsCount || 1})`,
    `🛠️ *Micro-Bend Pinch Index:* ${c.microBendStressIndex || 0} / 100`,
    `----------------------------------------`,
    `*SPECTRAL ATTENUATION LEAKAGE:*`,
    `• 1310 nm (GPON Upstream): ${c.loss1310Db || 0.05} dB`,
    `• 1490 nm (GPON Downstream): ${c.loss1490Db || 0.12} dB`,
    `• 1550 nm (Benchmark Loss): ${c.loss1550Db || 0.20} dB`,
    `• 1625 nm (Macro-bend Probe): ${c.loss1625Db || 0.55} dB`,
    `👉 *Differential (1550 - 1310):* ${c.differential1550_1310Db || 0.15} dB`,
    `----------------------------------------`,
    `🚦 *QA Accreditation Verdict:* ${v.label}`,
    `📝 *Remedy / Field Guidance:* ${v.description}`,
    c.notes ? `💬 *Lineman Note:* ${c.notes}` : null,
    `----------------------------------------`,
    `_Generated via Shahdara ISP Billing & Engineering QA Portal_`
  ].filter(Boolean);

  return lines.join('\n');
}

/**
 * Generates dual printable HTML (Formal A4 accreditation cert or 80mm POS field slip).
 */
export function generateBendLossCertHtml(cert = {}, { format = 'sheet' } = {}) {
  const c = cert || {};
  const v = c.verdict || BEND_VERDICTS.OPTIMAL_PASS;
  const isSlip = format === 'slip';

  if (isSlip) {
    return `
      <div class="bend-thermal-slip" style="font-family: monospace; font-size: 11px; max-width: 280px; margin: 0 auto; padding: 8px;">
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px;">
          <h3 style="margin: 0; font-size: 14px;">SHAHDARA FIBER NET</h3>
          <p style="margin: 2px 0;">BEND RADIUS &amp; MACRO-BEND QA</p>
          <p style="margin: 0; font-size: 10px;">ID: ${c.id || 'BND-SLIP'}</p>
        </div>
        <div style="padding: 6px 0; border-bottom: 1px dashed #000;">
          <div>Cust: <strong>${c.customerName || 'Subscriber'}</strong></div>
          <div>Area: ${c.area || 'Shahdara'}</div>
          <div>Fiber: ${c.fiberType || 'G.657.A2'}</div>
          <div>Radius: <strong>${c.radiusMm || 15} mm</strong> (${c.turnsCount || 1} loops)</div>
        </div>
        <div style="padding: 6px 0; border-bottom: 1px dashed #000;">
          <div>1310nm Loss: ${c.loss1310Db || 0.05} dB</div>
          <div>1550nm Loss: <strong>${c.loss1550Db || 0.20} dB</strong></div>
          <div>Diff (1550-1310): ${c.differential1550_1310Db || 0.15} dB</div>
          <div>Micro-Stress: ${c.microBendStressIndex || 0}/100</div>
        </div>
        <div style="text-align: center; padding: 8px 0;">
          <div style="font-size: 13px; font-weight: bold;">VERDICT: ${v.label}</div>
          <div style="font-size: 9px; margin-top: 4px;">Lineman: ${c.technicianName || 'Field Tech'}</div>
        </div>
      </div>
    `;
  }

  // Formal A4 Certificate
  return `
    <div class="bend-cert-a4" style="font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; border: 2px solid #0f172a;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px;">
        <div>
          <h2 style="margin: 0; font-size: 20px; color: #0e5b4d;">SHAHDARA ISP BROADBAND &amp; OPTICAL NETWORKS</h2>
          <p style="margin: 4px 0 0; font-size: 12px; font-weight: 600; color: #475569;">OUTSIDE PLANT &amp; SUBSCRIBER PREMISES BEND LOSS QA CERTIFICATE</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 13px; font-weight: 800;">${c.id || 'BND-CERT'}</div>
          <div style="font-size: 11px; color: #64748b;">${new Date().toLocaleDateString('en-PK')}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
        <div>
          <div style="font-size: 11px; color: #64748b; font-weight: 700;">SUBSCRIBER DETAILS</div>
          <div style="font-size: 14px; font-weight: 800; margin-top: 2px;">${c.customerName || 'Subscriber'}</div>
          <div style="font-size: 12px; color: #334155;">Customer #: ${c.customerNumber || '—'} · Phone: ${c.customerPhone || '—'}</div>
          <div style="font-size: 12px; color: #334155;">Area / Distribution: ${c.area || 'Shahdara'}</div>
        </div>
        <div>
          <div style="font-size: 11px; color: #64748b; font-weight: 700;">OPTICAL ROUTING SPECIFICATION</div>
          <div style="font-size: 13px; font-weight: 700; margin-top: 2px;">Fiber Standard: ${c.fiberType || 'G657A2'}</div>
          <div style="font-size: 12px; color: #334155;">Measured Curvature Radius: <strong>${c.radiusMm || 15} mm</strong> (${c.turnsCount || 1} loops)</div>
          <div style="font-size: 12px; color: #334155;">Micro-Bend Mechanical Stress: ${c.microBendStressIndex || 0} / 100</div>
        </div>
      </div>

      <div style="margin: 16px 0;">
        <h4 style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; color: #475569;">Spectral Attenuation Loss Breakdown (ITU-T G.657)</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 6px 10px;">Wavelength</th>
              <th style="padding: 6px 10px;">Application</th>
              <th style="padding: 6px 10px;">Macro-Bend Loss (dB)</th>
              <th style="padding: 6px 10px;">Differential to 1310nm</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px; font-weight: 700;">1310 nm</td>
              <td style="padding: 6px 10px;">GPON Upstream Burst</td>
              <td style="padding: 6px 10px;">${c.loss1310Db || 0.05} dB</td>
              <td style="padding: 6px 10px; color: #64748b;">0.00 dB (Baseline)</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px; font-weight: 700;">1490 nm</td>
              <td style="padding: 6px 10px;">GPON Continuous Downstream</td>
              <td style="padding: 6px 10px;">${c.loss1490Db || 0.12} dB</td>
              <td style="padding: 6px 10px;">+${((c.loss1490Db || 0.12) - (c.loss1310Db || 0.05)).toFixed(3)} dB</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0; background: #fffbeb;">
              <td style="padding: 6px 10px; font-weight: 800; color: #92400e;">1550 nm</td>
              <td style="padding: 6px 10px; color: #92400e;">Benchmark Diagnostic</td>
              <td style="padding: 6px 10px; font-weight: 800; color: #92400e;">${c.loss1550Db || 0.20} dB</td>
              <td style="padding: 6px 10px; font-weight: 800; color: #92400e;">+${c.differential1550_1310Db || 0.15} dB</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px; font-weight: 700;">1625 nm</td>
              <td style="padding: 6px 10px;">Out-of-Band Macro-Bend OTDR</td>
              <td style="padding: 6px 10px;">${c.loss1625Db || 0.55} dB</td>
              <td style="padding: 6px 10px;">+${((c.loss1625Db || 0.55) - (c.loss1310Db || 0.05)).toFixed(3)} dB</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin: 16px 0;">
        <div>
          <div style="font-size: 11px; color: #64748b; font-weight: 700;">FINAL QUALITY ASSURANCE VERDICT:</div>
          <div style="font-size: 16px; font-weight: 800; color: ${v.colorHex || '#10b981'};">${v.label}</div>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">${v.description}</div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 36px; padding-top: 12px; border-top: 1px solid #cbd5e1; font-size: 11px; color: #64748b;">
        <div>Field Technician: _______________________</div>
        <div>QA Inspector / NOC Lead: _______________________</div>
      </div>
    </div>
  `;
}

/**
 * Calculates recommended slack loop coil dimensions and enclosure compatibility
 * based on ITU-T G.657 bend tolerance and physical cassette tray clearance.
 */
export function calculateRecommendedSlackLoopDimensions({
  fiberType = 'G657A2',
  enclosureWidthMm = 86,  // standard Pakistani 86-type wall faceplate rosette
  enclosureHeightMm = 86,
  targetSlackLengthMeters = 1.0
} = {}) {
  const profile = FIBER_BEND_STANDARDS[fiberType] || FIBER_BEND_STANDARDS.G657A2;
  const minRadiusMm = profile.minRadiusMm;
  const safeRadiusMm = profile.recommendedSlackTrayRadiusMm || (minRadiusMm * 1.5);
  const minCoilDiameterMm = minRadiusMm * 2;
  const safeCoilDiameterMm = safeRadiusMm * 2;

  // Max usable diameter within rectangular enclosure (with 12mm wall clearance buffer)
  const maxAllowableDiameterMm = Math.max(0, Math.min(enclosureWidthMm, enclosureHeightMm) - 12);
  const isCompatible = maxAllowableDiameterMm >= minCoilDiameterMm;
  const clearanceMarginMm = Number((maxAllowableDiameterMm - minCoilDiameterMm).toFixed(1));

  // Circumference of one safe coil loop (in meters)
  const loopCircumferenceM = (2 * Math.PI * safeRadiusMm) / 1000;
  const recommendedTurns = Math.max(1, Math.round(targetSlackLengthMeters / loopCircumferenceM));
  const actualSlackStoredMeters = Number((recommendedTurns * loopCircumferenceM).toFixed(2));

  // Fastener spacing guidance
  const clipSpacingCm = profile.minRadiusMm <= 7.5 ? 20 : 15;
  const cornerClearanceCm = profile.minRadiusMm <= 7.5 ? 2.5 : 4.0;

  return {
    fiberType,
    minRadiusMm,
    safeRadiusMm,
    minCoilDiameterMm,
    safeCoilDiameterMm,
    maxAllowableDiameterMm,
    isCompatible,
    clearanceMarginMm,
    targetSlackLengthMeters,
    recommendedTurns,
    actualSlackStoredMeters,
    clipSpacingCm,
    cornerClearanceCm,
    advisory: isCompatible
      ? `Enclosure accommodates safe ${safeCoilDiameterMm.toFixed(0)}mm coil for ${profile.name.split(' ')[0]}. Store ${recommendedTurns} loop(s) for ~${actualSlackStoredMeters}m maintenance slack.`
      : `INCOMPATIBLE: Enclosure width (${Math.min(enclosureWidthMm, enclosureHeightMm)}mm) violates ${profile.name.split(' ')[0]} minimum diameter (${minCoilDiameterMm}mm). Upgrade to G.657.A2/B3 drop cable or larger rosette.`
  };
}

/**
 * Generates RFC-4180 CSV export with UTF-8 BOM.
 */
export function generateBendLossCertsCsv(records = []) {
  if (!Array.isArray(records) || records.length === 0) {
    return '\uFEFFInspection_ID,Date,Customer_No,Customer_Name,Phone,Area,Fiber_Type,Radius_mm,Turns,Stress_Index,Loss_1310_dB,Loss_1550_dB,Diff_1550_1310_dB,Verdict,Technician,Notes\r\n';
  }

  const escapeCsv = (str) => {
    const s = String(str ?? '').replace(/"/g, '""');
    return /[",\r\n]/.test(s) ? `"${s}"` : s;
  };

  const header = ['Inspection_ID', 'Date', 'Customer_No', 'Customer_Name', 'Phone', 'Area', 'Fiber_Type', 'Radius_mm', 'Turns', 'Stress_Index', 'Loss_1310_dB', 'Loss_1550_dB', 'Diff_1550_1310_dB', 'Verdict', 'Technician', 'Notes'];

  const rows = records.map(r => [
    r.id,
    r.timestamp,
    r.customerNumber,
    r.customerName,
    r.customerPhone,
    r.area,
    r.fiberType,
    r.radiusMm,
    r.turnsCount,
    r.microBendStressIndex,
    r.loss1310Db,
    r.loss1550Db,
    r.differential1550_1310Db,
    (r.verdict && r.verdict.label) ? r.verdict.label : r.verdict,
    r.technicianName,
    r.notes
  ].map(escapeCsv).join(','));

  return '\uFEFF' + [header.join(','), ...rows].join('\r\n') + '\r\n';
}

/**
 * Initializes and wires the Customer Fiber Bending Radius & Macro-Bend QA Modal.
 */
export function setupBendLossCertModal({
  document: doc = (typeof document !== 'undefined' ? document : null),
  storage = (typeof window !== 'undefined' ? window.localStorage : null),
  onToast,
  getCustomerData = () => null
} = {}) {
  if (!doc) {
    return {
      open: () => {},
      close: () => {},
      getCurrentReading: () => ({}),
      setReading: () => {}
    };
  }

  const modal = doc.getElementById('bendLossCertModal');
  const closeBtn = doc.getElementById('bendLossCertModalCloseBtn');
  const triggers = doc.querySelectorAll('[data-open-bend-loss-cert]');

  // Inputs
  const fiberSelect = doc.getElementById('bendLossFiberSelect');
  const radiusSlider = doc.getElementById('bendLossRadiusSlider');
  const radiusVal = doc.getElementById('bendLossRadiusVal');
  const turnsSlider = doc.getElementById('bendLossTurnsSlider');
  const turnsVal = doc.getElementById('bendLossTurnsVal');
  const stressSlider = doc.getElementById('bendLossStressSlider');
  const stressVal = doc.getElementById('bendLossStressVal');
  const notesInput = doc.getElementById('bendLossNotesInput');

  // Checklist Checkboxes
  const checkRosette = doc.getElementById('bendCheckRosette');
  const checkCorners = doc.getElementById('bendCheckCorners');
  const checkClips = doc.getElementById('bendCheckClips');
  const checkEntry = doc.getElementById('bendCheckEntry');
  const checkOnu = doc.getElementById('bendCheckOnu');

  // Outputs
  const svgContainer = doc.getElementById('bendLossSvgContainer');
  const loss1310Readout = doc.getElementById('bendLoss1310Readout');
  const loss1550Readout = doc.getElementById('bendLoss1550Readout');
  const diffReadout = doc.getElementById('bendLossDiffReadout');
  const verdictBadge = doc.getElementById('bendLossVerdictBadge');

  // Buttons
  const recordBtn = doc.getElementById('bendLossRecordCertBtn');
  const copyReportBtn = doc.getElementById('bendLossCopyReportBtn');
  const printA4Btn = doc.getElementById('bendLossPrintA4Btn');
  const printThermalBtn = doc.getElementById('bendLossPrintThermalBtn');
  const exportCsvBtn = doc.getElementById('bendLossExportCsvBtn');
  const clearHistoryBtn = doc.getElementById('bendLossClearHistoryBtn');
  const historyTbody = doc.getElementById('bendLossHistoryTableBody');

  let activeCustomer = null;

  function getFormChecklist() {
    return {
      rosette_slack: checkRosette ? checkRosette.checked : true,
      wall_corners: checkCorners ? checkCorners.checked : true,
      clip_tension: checkClips ? checkClips.checked : true,
      entry_conduit: checkEntry ? checkEntry.checked : true,
      onu_pigtail: checkOnu ? checkOnu.checked : true
    };
  }

  function getFormValues() {
    return {
      fiberType: fiberSelect ? fiberSelect.value : 'G657A2',
      radiusMm: radiusSlider ? Number(radiusSlider.value) : 15.0,
      turnsCount: turnsSlider ? parseInt(turnsSlider.value, 10) : 2,
      microBendStressIndex: stressSlider ? parseInt(stressSlider.value, 10) : 0,
      checklist: getFormChecklist()
    };
  }

  function updateView() {
    const vals = getFormValues();
    const result = calculateMacroBendLoss(vals);

    if (radiusVal && radiusSlider) radiusVal.textContent = `${Number(radiusSlider.value).toFixed(1)} mm`;
    if (turnsVal && turnsSlider) turnsVal.textContent = `${turnsSlider.value} turn(s)`;
    if (stressVal && stressSlider) stressVal.textContent = `${stressSlider.value} / 100`;

    if (loss1310Readout) loss1310Readout.textContent = `${result.loss1310Db.toFixed(2)} dB`;
    if (loss1550Readout) loss1550Readout.textContent = `${result.loss1550Db.toFixed(2)} dB`;
    if (diffReadout) diffReadout.textContent = `${result.differential1550_1310Db.toFixed(2)} dB`;

    if (verdictBadge) {
      verdictBadge.textContent = result.verdict.label;
      verdictBadge.className = `badge ${result.verdict.badgeClass}`;
    }

    if (svgContainer) {
      svgContainer.innerHTML = renderBendLossAnalysisSvg(result);
    }
  }

  function renderHistory() {
    if (!historyTbody) return;
    const certs = getSavedBendLossCerts(storage);
    if (certs.length === 0) {
      historyTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--muted, #94a3b8); padding: 12px;">No macro-bend inspection certificates recorded yet.</td></tr>`;
      return;
    }

    historyTbody.innerHTML = certs.map(c => `
      <tr style="border-bottom: 1px solid var(--border, #334155);">
        <td style="padding: 6px 8px; font-weight: 700;">${c.id}</td>
        <td style="padding: 6px 8px;">${c.customerName}</td>
        <td style="padding: 6px 8px;">${c.fiberType}</td>
        <td style="padding: 6px 8px;">${c.radiusMm}mm (${c.turnsCount}T)</td>
        <td style="padding: 6px 8px;">${c.loss1550Db} dB</td>
        <td style="padding: 6px 8px;"><span class="badge ${c.verdict.badgeClass}">${c.verdict.label}</span></td>
      </tr>
    `).join('');
  }

  function openModal(cust) {
    activeCustomer = cust || (typeof getCustomerData === 'function' ? getCustomerData() : null);
    updateView();
    renderHistory();
    if (modal) {
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
    }
  }

  function closeModal() {
    if (modal) {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    }
  }

  // Bind input change events
  [fiberSelect, radiusSlider, turnsSlider, stressSlider, checkRosette, checkCorners, checkClips, checkEntry, checkOnu].forEach(el => {
    if (el) {
      el.addEventListener('input', updateView);
      el.addEventListener('change', updateView);
    }
  });

  // Action Buttons
  if (recordBtn) {
    recordBtn.addEventListener('click', () => {
      const vals = getFormValues();
      const result = calculateMacroBendLoss(vals);
      const cust = activeCustomer || (typeof getCustomerData === 'function' ? getCustomerData() : null) || {};
      const record = buildBendLossCertRecord({
        ...result,
        customerNumber: cust.customerNumber || cust.id || '—',
        customerName: cust.name || 'Premises Subscriber',
        customerPhone: cust.phone || '—',
        area: cust.area || cust.mohalla || 'Shahdara Area',
        notes: notesInput ? notesInput.value : ''
      }, getSavedBendLossCerts(storage));

      saveBendLossCert(record, storage);
      renderHistory();
      if (typeof onToast === 'function') onToast(`Recorded Macro-Bend QA Certificate: ${record.id}`);
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const vals = getFormValues();
      const result = calculateMacroBendLoss(vals);
      const cust = activeCustomer || (typeof getCustomerData === 'function' ? getCustomerData() : null) || {};
      const record = buildBendLossCertRecord({
        ...result,
        customerNumber: cust.customerNumber || cust.id || '—',
        customerName: cust.name || 'Premises Subscriber',
        customerPhone: cust.phone || '—',
        area: cust.area || cust.mohalla || 'Shahdara Area',
        notes: notesInput ? notesInput.value : ''
      }, getSavedBendLossCerts(storage));

      const text = formatBendLossCertWhatsApp(record);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          if (typeof onToast === 'function') onToast('Copied WhatsApp Macro-Bend QA report to clipboard.');
        }).catch(() => {
          if (typeof onToast === 'function') onToast('Error copying to clipboard.');
        });
      }
    });
  }

  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      const vals = getFormValues();
      const result = calculateMacroBendLoss(vals);
      const cust = activeCustomer || (typeof getCustomerData === 'function' ? getCustomerData() : null) || {};
      const record = buildBendLossCertRecord({
        ...result,
        customerNumber: cust.customerNumber || cust.id || '—',
        customerName: cust.name || 'Premises Subscriber',
        customerPhone: cust.phone || '—',
        area: cust.area || cust.mohalla || 'Shahdara Area',
        notes: notesInput ? notesInput.value : ''
      }, getSavedBendLossCerts(storage));

      const html = generateBendLossCertHtml(record, { format: 'sheet' });
      if (typeof window !== 'undefined') {
        const printWin = window.open('', '_blank', 'width=850,height=900');
        if (printWin) {
          printWin.document.write(`<!DOCTYPE html><html><head><title>Macro-Bend Certificate</title></head><body>${html}<script>window.print();</script></body></html>`);
          printWin.document.close();
        }
      }
    });
  }

  if (printThermalBtn) {
    printThermalBtn.addEventListener('click', () => {
      const vals = getFormValues();
      const result = calculateMacroBendLoss(vals);
      const cust = activeCustomer || (typeof getCustomerData === 'function' ? getCustomerData() : null) || {};
      const record = buildBendLossCertRecord({
        ...result,
        customerNumber: cust.customerNumber || cust.id || '—',
        customerName: cust.name || 'Premises Subscriber',
        customerPhone: cust.phone || '—',
        area: cust.area || cust.mohalla || 'Shahdara Area',
        notes: notesInput ? notesInput.value : ''
      }, getSavedBendLossCerts(storage));

      const html = generateBendLossCertHtml(record, { format: 'slip' });
      if (typeof window !== 'undefined') {
        const printWin = window.open('', '_blank', 'width=380,height=600');
        if (printWin) {
          printWin.document.write(`<!DOCTYPE html><html><head><title>Thermal Field Slip</title></head><body>${html}<script>window.print();</script></body></html>`);
          printWin.document.close();
        }
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const certs = getSavedBendLossCerts(storage);
      const csv = generateBendLossCertsCsv(certs);
      if (typeof window !== 'undefined' && typeof Blob !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = doc.createElement('a');
        a.href = url;
        a.download = `shahdara-macro-bend-certs-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        if (typeof onToast === 'function') onToast('Exported Macro-Bend QA CSV log.');
      }
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      clearBendLossCerts(storage);
      renderHistory();
      if (typeof onToast === 'function') onToast('Cleared Macro-Bend QA certificate history.');
    });
  }

  // Trigger bindings
  triggers.forEach(btn => {
    btn.addEventListener('click', () => openModal());
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  return {
    open: openModal,
    close: closeModal,
    getCurrentReading: () => calculateMacroBendLoss(getFormValues()),
    setReading: (vals = {}) => {
      if (vals.radiusMm !== undefined && radiusSlider) radiusSlider.value = vals.radiusMm;
      if (vals.turnsCount !== undefined && turnsSlider) turnsSlider.value = vals.turnsCount;
      if (vals.fiberType !== undefined && fiberSelect) fiberSelect.value = vals.fiberType;
      updateView();
    }
  };
}
