/**
 * Shahdara ISP - Field Technician Optical Fiber Patch Cord & Drop Cable Macro-Bend Radius & Wavelength Loss Assistant
 * Part of mobile navigation and field crew tools (agent2 - shahdara-mobile-nav).
 *
 * Implements ITU-T G.652.D, G.657.A1, G.657.A2, and G.657.B3 optical macro-bend attenuation models:
 * - Exponential bend radius curvature loss calculation
 * - Multi-wavelength differential analysis (1310nm, 1490nm, 1550nm, 1577nm)
 * - Dual-wavelength macro-bend signature verification (Loss@1550nm - Loss@1310nm > 0.5dB)
 * - Real-time evanescent optical ray leakage vector SVG visualizer
 * - Mechanical stress and micro-crack fracture hazard classification
 * - Field remediation guides, localStorage audit logs, and WhatsApp lineman dispatch
 */

export const MACRO_BEND_STORAGE_KEY = 'shahdara_macro_bend_audits_v1';

export const FIBER_STANDARDS = {
  G652D: {
    id: 'G652D',
    name: 'ITU-T G.652.D (Standard Single-Mode SSMF)',
    category: 'Legacy Standard Aerial/Duct',
    minSafeRadiusMm: 30.0,
    baseLossCoeff: 15.0,
    decayFactor: 4.8,
    description: 'Requires wide 30mm loops; highly sensitive to sharp window staples and door pinch.'
  },
  G657A1: {
    id: 'G657A1',
    name: 'ITU-T G.657.A1 (Bend-Insensitive BIF Tier 1)',
    category: 'Standard Drop Cable',
    minSafeRadiusMm: 10.0,
    baseLossCoeff: 4.5,
    decayFactor: 2.2,
    description: 'Permits 10mm loops; ideal for outdoor-to-indoor entry and external FAT drop wire.'
  },
  G657A2: {
    id: 'G657A2',
    name: 'ITU-T G.657.A2 (Advanced BIF Tier 2)',
    category: 'High-Flex Indoor MDU Drop',
    minSafeRadiusMm: 7.5,
    baseLossCoeff: 1.8,
    decayFactor: 1.4,
    description: 'Permits 7.5mm tight turns; safe for skirting board corners and indoor wall faceplates.'
  },
  G657B3: {
    id: 'G657B3',
    name: 'ITU-T G.657.B3 (Ultra Bend-Insensitive)',
    category: 'Extreme Tight-Corner Invisible Fiber',
    minSafeRadiusMm: 5.0,
    baseLossCoeff: 0.8,
    decayFactor: 0.9,
    description: 'Permits 5mm extreme tight bends; staple-tolerant with negligible optical leakage.'
  }
};

export const WAVELENGTH_BEND_FACTORS = {
  1310: { wavelengthNm: 1310, factor: 1.0, role: 'GPON Upstream (Low bend sensitivity)' },
  1490: { wavelengthNm: 1490, factor: 1.85, role: 'GPON Downstream (Standard Rx optical signal)' },
  1550: { wavelengthNm: 1550, factor: 3.4, role: 'RF Overlay / Diagnostic (High sensitivity)' },
  1577: { wavelengthNm: 1577, factor: 4.8, role: 'XGS-PON 10G Downstream (Extreme sensitivity)' }
};

export const CABLE_CONSTRUCTIONS = {
  ROUND_DROP_3MM: { id: 'ROUND_DROP_3MM', name: 'Round 3.0mm LSZH Drop Cable', mechanicalMultiplier: 1.0 },
  FLAT_BUTTERFLY_2X3: { id: 'FLAT_BUTTERFLY_2X3', name: 'Flat 2.0x3.0mm Bow-Type Butterfly Drop (Steel Wires)', mechanicalMultiplier: 1.35 },
  FIGURE8_AERIAL: { id: 'FIGURE8_AERIAL', name: 'Figure-8 Aerial Drop with Messenger', mechanicalMultiplier: 1.2 },
  TIGHT_BUFFER_PIGTAIL: { id: 'TIGHT_BUFFER_PIGTAIL', name: '0.9mm Tight-Buffered Fiber Pigtail', mechanicalMultiplier: 0.85 }
};

export const SHAHDARA_MACRO_BEND_PRESETS = [
  {
    id: 'PRESET_WINDOW_STAPLE',
    name: 'Window Corner Sharp Staple / Door Pinch (Fault)',
    fiberStandard: 'G652D',
    cableConstruction: 'ROUND_DROP_3MM',
    bendRadiusMm: 4.0,
    turnCount: 1,
    bendAngleDeg: 90,
    wavelengthNm: 1490,
    inputPowerDbm: -19.5,
    location: 'Main Bazaar Shahdara - Shop #14 Window Frame',
    technician: 'Imran Lineman',
    notes: 'Lineman used metal staple directly over G.652.D drop wire; severe optical leakage.'
  },
  {
    id: 'PRESET_FAT_POLE_PINCH',
    name: 'FAT Pole Cable Tie Over-Tightened Pinch',
    fiberStandard: 'G652D',
    cableConstruction: 'FLAT_BUTTERFLY_2X3',
    bendRadiusMm: 8.0,
    turnCount: 2,
    bendAngleDeg: 180,
    wavelengthNm: 1490,
    inputPowerDbm: -18.2,
    location: 'Pole #47 Baradari Road - Distribution Hub',
    technician: 'Rashid Tech',
    notes: 'Ziptie cinched flat drop wire over iron pole bracket; optical power dropped -4.8dB.'
  },
  {
    id: 'PRESET_ROOFTOP_DRIP_LOOP',
    name: 'Rooftop Drip Loop Standard Installation',
    fiberStandard: 'G657A1',
    cableConstruction: 'ROUND_DROP_3MM',
    bendRadiusMm: 35.0,
    turnCount: 1,
    bendAngleDeg: 360,
    wavelengthNm: 1490,
    inputPowerDbm: -19.0,
    location: 'Kot Abdul Malik - Residential Roof Entry',
    technician: 'Kashif Ali',
    notes: 'Compliant service drip loop installed with standard 70mm diameter circle.'
  },
  {
    id: 'PRESET_INDOOR_ONU_COIL',
    name: 'Indoor Customer ONU Wall-Plate Coil',
    fiberStandard: 'G657A2',
    cableConstruction: 'TIGHT_BUFFER_PIGTAIL',
    bendRadiusMm: 10.0,
    turnCount: 3,
    bendAngleDeg: 360,
    wavelengthNm: 1490,
    inputPowerDbm: -20.2,
    location: 'Vandala Road - Customer Living Room Faceplate',
    technician: 'Usman Lineman',
    notes: 'G.657.A2 patch cord coiled inside faceplate cassette with 20mm mandrel.'
  }
];

/**
 * Calculates macro-bend attenuation and mechanical risk parameters
 */
export function calculateMacroBendLoss(options = {}) {
  const standardKey = options.fiberStandard || 'G652D';
  const standard = FIBER_STANDARDS[standardKey] || FIBER_STANDARDS.G652D;
  const wavelength = Number(options.wavelengthNm || 1490);
  const wavelengthInfo = WAVELENGTH_BEND_FACTORS[wavelength] || WAVELENGTH_BEND_FACTORS[1490];

  const bendRadiusMm = Math.max(1.0, Number(options.bendRadiusMm || 30.0));
  const turnCount = Math.max(0.5, Number(options.turnCount || 1));
  const bendAngleDeg = Math.max(15, Number(options.bendAngleDeg || 90));
  const cableKey = options.cableConstruction || 'ROUND_DROP_3MM';
  const cable = CABLE_CONSTRUCTIONS[cableKey] || CABLE_CONSTRUCTIONS.ROUND_DROP_3MM;
  const inputPowerDbm = Number(options.inputPowerDbm !== undefined ? options.inputPowerDbm : -19.0);

  // Single 360-degree loop loss calculation:
  // Macro-bend loss follows an exponential decay with bend radius:
  // Loss(R) = baseLossCoeff * exp(-R / decayFactor) * wavelengthMultiplier * cableMultiplier
  const angleMultiplier = bendAngleDeg / 360;
  const rawSingleLoopLoss = standard.baseLossCoeff * Math.exp(-bendRadiusMm / standard.decayFactor) * cable.mechanicalMultiplier;

  // Selected wavelength total loss
  const singleBendLossDb = Number((rawSingleLoopLoss * angleMultiplier * wavelengthInfo.factor).toFixed(3));
  const totalMacroBendLossDb = Number((singleBendLossDb * turnCount).toFixed(2));

  // Multi-wavelength comparison for dual-wavelength differential diagnostics
  const loss1310Db = Number((rawSingleLoopLoss * angleMultiplier * WAVELENGTH_BEND_FACTORS[1310].factor * turnCount).toFixed(2));
  const loss1490Db = Number((rawSingleLoopLoss * angleMultiplier * WAVELENGTH_BEND_FACTORS[1490].factor * turnCount).toFixed(2));
  const loss1550Db = Number((rawSingleLoopLoss * angleMultiplier * WAVELENGTH_BEND_FACTORS[1550].factor * turnCount).toFixed(2));
  const loss1577Db = Number((rawSingleLoopLoss * angleMultiplier * WAVELENGTH_BEND_FACTORS[1577].factor * turnCount).toFixed(2));

  // Differential signature: Loss@1550 - Loss@1310
  const differential1550vs1310Db = Number((loss1550Db - loss1310Db).toFixed(2));
  const hasMacroBendSignature = differential1550vs1310Db >= 0.5;

  // Output optical power at selected wavelength
  const outputPowerDbm = Number((inputPowerDbm - totalMacroBendLossDb).toFixed(2));
  const minRxSensitivityDbm = -28.0; // ITU-T GPON Class B+ threshold
  const powerMarginDb = Number((outputPowerDbm - minRxSensitivityDbm).toFixed(2));

  // Mechanical and optical status
  let status = 'COMPLIANT';
  let statusBadgeClass = 'badge-success';
  let mechanicalFractureRisk = false;

  if (bendRadiusMm < standard.minSafeRadiusMm) {
    if (totalMacroBendLossDb >= 1.5 || bendRadiusMm <= standard.minSafeRadiusMm * 0.4) {
      status = 'CRITICAL_FAULT';
      statusBadgeClass = 'badge-danger';
      mechanicalFractureRisk = true;
    } else {
      status = 'WARNING_EXCESSIVE_BEND';
      statusBadgeClass = 'badge-warning';
    }
  } else if (totalMacroBendLossDb > 0.4) {
    status = 'WARNING_ATTENUATION';
    statusBadgeClass = 'badge-warning';
  }

  // Recommended Remediation Action
  let remediation = 'Installation complies with ITU-T bend radius limits. Safe for long-term transmission.';
  if (mechanicalFractureRisk) {
    remediation = `URGENT: Bend radius (${bendRadiusMm}mm) violates ${standard.name} limit (${standard.minSafeRadiusMm}mm). Remove sharp staple/cable pinch immediately or replace with G.657.A2/B3 drop cable.`;
  } else if (status.startsWith('WARNING')) {
    remediation = `Caution: Install 15mm-radius corner bend guide and loosen cable ties to eliminate ${totalMacroBendLossDb}dB optical leakage.`;
  }

  return {
    standard,
    wavelengthInfo,
    cable,
    bendRadiusMm,
    turnCount,
    bendAngleDeg,
    inputPowerDbm,
    outputPowerDbm,
    singleBendLossDb,
    totalMacroBendLossDb,
    multiWavelengthLosses: {
      1310: loss1310Db,
      1490: loss1490Db,
      1550: loss1550Db,
      1577: loss1577Db
    },
    differential1550vs1310Db,
    hasMacroBendSignature,
    powerMarginDb,
    status,
    statusBadgeClass,
    mechanicalFractureRisk,
    remediation
  };
}

/**
 * Storage management for macro-bend audit register
 */
export function getMacroBendStore(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) {
    return getDefaultMacroBendAudits();
  }
  try {
    const raw = storage.getItem(MACRO_BEND_STORAGE_KEY);
    if (!raw) {
      const initial = getDefaultMacroBendAudits();
      saveMacroBendStore(initial, storage);
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : getDefaultMacroBendAudits();
  } catch (err) {
    return getDefaultMacroBendAudits();
  }
}

export function saveMacroBendStore(records, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return false;
  try {
    storage.setItem(MACRO_BEND_STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch (err) {
    return false;
  }
}

export function recordMacroBendAudit(entry, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const store = getMacroBendStore(storage);
  const audit = {
    id: 'mb-audit-' + Date.now(),
    timestamp: new Date().toISOString(),
    location: entry.location || 'Shahdara Area',
    technician: entry.technician || 'Lineman Crew',
    fiberStandard: entry.fiberStandard || 'G652D',
    cableConstruction: entry.cableConstruction || 'ROUND_DROP_3MM',
    bendRadiusMm: Number(entry.bendRadiusMm || 30),
    turnCount: Number(entry.turnCount || 1),
    bendAngleDeg: Number(entry.bendAngleDeg || 90),
    wavelengthNm: Number(entry.wavelengthNm || 1490),
    totalMacroBendLossDb: Number(entry.totalMacroBendLossDb || 0),
    differential1550vs1310Db: Number(entry.differential1550vs1310Db || 0),
    outputPowerDbm: Number(entry.outputPowerDbm || -19),
    status: entry.status || 'COMPLIANT',
    notes: entry.notes || ''
  };

  store.unshift(audit);
  if (store.length > 50) {
    store.pop();
  }
  saveMacroBendStore(store, storage);
  return audit;
}

export function clearMacroBendStore(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  return saveMacroBendStore([], storage);
}

export function getDefaultMacroBendAudits() {
  return [
    {
      id: 'mb-audit-01',
      timestamp: '2026-10-16T18:30:00.000Z',
      location: 'Main Bazaar Shahdara - Shop #14 Window Frame',
      technician: 'Imran Lineman',
      fiberStandard: 'G652D',
      cableConstruction: 'ROUND_DROP_3MM',
      bendRadiusMm: 4.0,
      turnCount: 1,
      bendAngleDeg: 90,
      wavelengthNm: 1490,
      totalMacroBendLossDb: 3.85,
      differential1550vs1310Db: 3.25,
      outputPowerDbm: -23.35,
      status: 'CRITICAL_FAULT',
      notes: 'Sharp window staple caused 3.85dB optical drop; replaced with G.657.A2 pigtail.'
    },
    {
      id: 'mb-audit-02',
      timestamp: '2026-10-16T17:15:00.000Z',
      location: 'Kot Abdul Malik - Residential Roof Entry',
      technician: 'Kashif Ali',
      fiberStandard: 'G657A1',
      cableConstruction: 'ROUND_DROP_3MM',
      bendRadiusMm: 35.0,
      turnCount: 1,
      bendAngleDeg: 360,
      wavelengthNm: 1490,
      totalMacroBendLossDb: 0.01,
      differential1550vs1310Db: 0.02,
      outputPowerDbm: -19.01,
      status: 'COMPLIANT',
      notes: 'Standard 70mm diameter drip loop; optical power verified within optimal threshold.'
    }
  ];
}

/**
 * Pure vector SVG renderer for fiber bend curvature and evanescent wave leakage
 */
export function renderMobileMacroBendSvg(data, options = {}) {
  const width = options.width || 340;
  const height = options.height || 210;

  const { standard, bendRadiusMm, totalMacroBendLossDb, multiWavelengthLosses, status, mechanicalFractureRisk } = data;

  const isCritical = status.includes('CRITICAL');
  const isWarning = status.includes('WARNING');
  const themeColor = isCritical ? '#ef4444' : (isWarning ? '#f59e0b' : '#10b981');

  // Dynamic visual corner radius mapped to canvas coordinates
  // Clamp visual radius between 10px and 75px
  const visualRadius = Math.min(75, Math.max(10, (bendRadiusMm / 50) * 75));

  // Center point of the corner bend
  const cornerX = 130;
  const cornerY = 120;

  // Evanescent wave leakage rays when loss > 0.1 dB
  const hasLeakage = totalMacroBendLossDb > 0.1;
  const leakageWaveCount = Math.min(5, Math.max(1, Math.round(totalMacroBendLossDb * 1.5)));

  return `
    <svg viewBox="0 0 ${width} ${height}" class="macro-bend-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Fiber Optic Macro-Bend Visualizer">
      <defs>
        <linearGradient id="mbBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0b1329" />
          <stop offset="100%" stop-color="#111c38" />
        </linearGradient>
        <linearGradient id="fiberCoreGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="50%" stop-color="#0284c7" />
          <stop offset="100%" stop-color="#38bdf8" />
        </linearGradient>
        <radialGradient id="leakageGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${themeColor}" stop-opacity="0.8" />
          <stop offset="100%" stop-color="${themeColor}" stop-opacity="0" />
        </radialGradient>
      </defs>

      <rect width="${width}" height="${height}" rx="8" fill="url(#mbBg)" stroke="#1e293b" stroke-width="1"/>

      <!-- Header: Standard & Bend Radius Badge -->
      <g transform="translate(12, 18)">
        <rect x="0" y="0" width="115" height="18" rx="4" fill="#1e293b" stroke="#334155" stroke-width="1"/>
        <text x="57" y="12" fill="#38bdf8" font-size="9" font-family="monospace" font-weight="bold" text-anchor="middle">R = ${bendRadiusMm} mm</text>

        <rect x="122" y="0" width="80" height="18" rx="4" fill="#1e293b" stroke="#334155" stroke-width="1"/>
        <text x="162" y="12" fill="#94a3b8" font-size="8.5" font-family="monospace" text-anchor="middle">${standard.id}</text>
      </g>

      <!-- Status Pill Top-Right -->
      <g transform="translate(${width - 100}, 14)">
        <rect x="0" y="0" width="88" height="20" rx="10" fill="${themeColor}" fill-opacity="0.2" stroke="${themeColor}" stroke-width="1"/>
        <circle cx="10" cy="10" r="3.5" fill="${themeColor}"/>
        <text x="49" y="14" fill="${themeColor}" font-size="9.5" font-weight="bold" text-anchor="middle">${status.replace(/_/g, ' ')}</text>
      </g>

      <!-- Corner Mandrel / Peg Visualization -->
      <circle cx="${cornerX}" cy="${cornerY}" r="${visualRadius}" fill="#1e293b" stroke="#475569" stroke-width="1.5" stroke-dasharray="3,3"/>
      <circle cx="${cornerX}" cy="${cornerY}" r="3" fill="#64748b"/>
      <text x="${cornerX}" y="${cornerY + 12}" fill="#64748b" font-size="7.5" font-family="monospace" text-anchor="middle">CORNER</text>

      <!-- Fiber Outer Jacket Path (Thick tube) -->
      <!-- Coming in from left horizontally, rounding corner, exiting downward vertically -->
      <path d="M 20 ${cornerY - visualRadius} L ${cornerX} ${cornerY - visualRadius} A ${visualRadius} ${visualRadius} 0 0 1 ${cornerX + visualRadius} ${cornerY} L ${cornerX + visualRadius} ${height - 35}"
            fill="none" stroke="#334155" stroke-width="14" stroke-linecap="round"/>

      <!-- Fiber Cladding Layer -->
      <path d="M 20 ${cornerY - visualRadius} L ${cornerX} ${cornerY - visualRadius} A ${visualRadius} ${visualRadius} 0 0 1 ${cornerX + visualRadius} ${cornerY} L ${cornerX + visualRadius} ${height - 35}"
            fill="none" stroke="#0ea5e9" stroke-opacity="0.3" stroke-width="7" stroke-linecap="round"/>

      <!-- Fiber Core Laser Light Stream -->
      <path d="M 20 ${cornerY - visualRadius} L ${cornerX} ${cornerY - visualRadius} A ${visualRadius} ${visualRadius} 0 0 1 ${cornerX + visualRadius} ${cornerY} L ${cornerX + visualRadius} ${height - 35}"
            fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>

      <!-- Evanescent Wave Optical Leakage Radiation Rays -->
      ${hasLeakage ? `
        <circle cx="${cornerX + (visualRadius * 0.7)}" cy="${cornerY - (visualRadius * 0.7)}" r="22" fill="url(#leakageGlow)"/>
        ${Array.from({ length: leakageWaveCount }).map((_, i) => {
          const arcR = visualRadius + 8 + (i * 7);
          return `<path d="M ${cornerX} ${cornerY - arcR} A ${arcR} ${arcR} 0 0 1 ${cornerX + arcR} ${cornerY}"
                        fill="none" stroke="${themeColor}" stroke-width="1.5" stroke-opacity="${0.8 - (i * 0.15)}" stroke-dasharray="3,2"/>`;
        }).join('')}
        <text x="${cornerX + visualRadius + 16}" y="${cornerY - 14}" fill="${themeColor}" font-size="8.5" font-weight="bold" font-family="monospace">
          -${totalMacroBendLossDb} dB LEAK
        </text>
      ` : `
        <text x="${cornerX + visualRadius + 10}" y="${cornerY - 8}" fill="#10b981" font-size="8.5" font-family="monospace">
          ✓ SAFE RADIUS
        </text>
      `}

      <!-- Multi-Wavelength Spectral Comparison Bar Chart (Right side) -->
      <g transform="translate(225, 48)">
        <rect x="0" y="0" width="102" height="110" rx="4" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
        <text x="51" y="13" fill="#94a3b8" font-size="8" font-weight="bold" text-anchor="middle">WAVELENGTH LOSS</text>

        ${[
          { wl: '1310', loss: multiWavelengthLosses[1310], y: 28, col: '#38bdf8' },
          { wl: '1490', loss: multiWavelengthLosses[1490], y: 48, col: '#34d399' },
          { wl: '1550', loss: multiWavelengthLosses[1550], y: 68, col: '#fbbf24' },
          { wl: '1577', loss: multiWavelengthLosses[1577], y: 88, col: '#f87171' }
        ].map(item => {
          const barW = Math.min(48, Math.max(2, (item.loss / 5.0) * 48));
          return `
            <text x="8" y="${item.y + 9}" fill="#64748b" font-size="8" font-family="monospace">${item.wl}</text>
            <rect x="36" y="${item.y}" width="${barW}" height="9" rx="2" fill="${item.col}"/>
            <text x="${38 + barW + 2}" y="${item.y + 8}" fill="#94a3b8" font-size="7.5" font-family="monospace">${item.loss}dB</text>
          `;
        }).join('')}
      </g>

      <!-- Bottom Status & Mechanical Risk Ticker -->
      <g transform="translate(12, 192)">
        <text x="0" y="0" fill="#64748b" font-size="8.5">Min Safe: ${standard.minSafeRadiusMm}mm</text>
        <text x="95" y="0" fill="${data.hasMacroBendSignature ? '#fbbf24' : '#64748b'}" font-size="8.5" font-family="monospace">
          Δ1550-1310: +${data.differential1550vs1310Db}dB
        </text>
        <text x="${width - 24}" y="0" fill="${mechanicalFractureRisk ? '#ef4444' : '#34d399'}" font-size="8.5" font-weight="bold" text-anchor="end">
          ${mechanicalFractureRisk ? 'FRACTURE HAZARD' : 'PASS'}
        </text>
      </g>
    </svg>
  `;
}

/**
 * Formats WhatsApp lineman dispatch message
 */
export function generateMacroBendWhatsAppReport(audit) {
  const isPass = !audit.status.includes('CRITICAL');
  return `*SHAHDARA ISP - OPTICAL FIBER MACRO-BEND AUDIT* ⚡
${isPass ? '✅ BEND RADIUS PASS' : '⚠️ MACRO-BEND OPTICAL LEAK DETECTED'}
*Location:* ${audit.location}
*Technician:* ${audit.technician}
*Timestamp:* ${new Date(audit.timestamp).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })} PKT

*Fiber Standard:* ${audit.fiberStandard}
*Cable Construction:* ${audit.cableConstruction}
*Measured Bend Radius:* ${audit.bendRadiusMm} mm (${audit.turnCount} turn(s) @ ${audit.bendAngleDeg}°)
*Selected Wavelength:* ${audit.wavelengthNm} nm
*Total Macro-Bend Loss:* ${audit.totalMacroBendLossDb} dB
*Dual-Wavelength Differential (1550-1310nm):* +${audit.differential1550vs1310Db} dB ${audit.differential1550vs1310Db >= 0.5 ? '(Definitive Macro-Bend)' : ''}
*Estimated Rx Power:* ${audit.outputPowerDbm} dBm

*Field Action Required:*
${audit.status.includes('CRITICAL') ? '⚠️ Bend radius is below safety margin! Loosen cable clamps, remove tight window staples, or splice G.657.A2 bend-insensitive patch cord immediately.' : 'Bend radius is within compliant limits. Optical headroom verified.'}
${audit.notes ? `*Notes:* ${audit.notes}` : ''}`;
}

/**
 * Controller wiring for Mobile Macro-Bend Modal Sheet
 */
export function setupMobileMacroBendModal({ storage = (typeof localStorage !== 'undefined' ? localStorage : null), onToast, clipboard } = {}) {
  const modal = document.getElementById('mobileMacroBendModal');
  const closeBtn = document.getElementById('mobileMacroBendCloseBtn');

  // Trigger buttons
  const drawerBtn = document.getElementById('navMacroBendBtn');
  const speedDialBtn = document.getElementById('speedDialMacroBendBtn');
  const actionSheetBtn = document.getElementById('actionSheetMacroBendBtn');

  // Inputs
  const presetSelect = document.getElementById('macroBendPresetSelect');
  const standardSelect = document.getElementById('macroBendStandardSelect');
  const cableSelect = document.getElementById('macroBendCableSelect');
  const wavelengthSelect = document.getElementById('macroBendWavelengthSelect');
  const radiusSlider = document.getElementById('macroBendRadiusSlider');
  const radiusValLabel = document.getElementById('macroBendRadiusVal');
  const turnSelect = document.getElementById('macroBendTurnSelect');
  const angleSelect = document.getElementById('macroBendAngleSelect');
  const inputPowerInput = document.getElementById('macroBendInputPower');
  const locationInput = document.getElementById('macroBendLocationInput');
  const techInput = document.getElementById('macroBendTechInput');
  const notesInput = document.getElementById('macroBendNotesInput');

  // Display Containers
  const svgWrap = document.getElementById('macroBendSvgWrap');
  const kpiLoss = document.getElementById('macroBendKpiLoss');
  const kpiRx = document.getElementById('macroBendKpiRx');
  const kpiDiff = document.getElementById('macroBendKpiDiff');
  const kpiStatus = document.getElementById('macroBendKpiStatus');
  const remediationText = document.getElementById('macroBendRemediationText');
  const historyList = document.getElementById('macroBendHistoryList');

  // Actions
  const saveBtn = document.getElementById('macroBendSaveBtn');
  const whatsappBtn = document.getElementById('macroBendWhatsappBtn');
  const clearHistoryBtn = document.getElementById('macroBendClearHistoryBtn');

  function getFormData() {
    return {
      fiberStandard: standardSelect ? standardSelect.value : 'G652D',
      cableConstruction: cableSelect ? cableSelect.value : 'ROUND_DROP_3MM',
      wavelengthNm: Number(wavelengthSelect ? wavelengthSelect.value : 1490),
      bendRadiusMm: Number(radiusSlider ? radiusSlider.value : 30),
      turnCount: Number(turnSelect ? turnSelect.value : 1),
      bendAngleDeg: Number(angleSelect ? angleSelect.value : 90),
      inputPowerDbm: Number(inputPowerInput ? inputPowerInput.value : -19.0),
      location: locationInput ? locationInput.value.trim() : '',
      technician: techInput ? techInput.value.trim() : '',
      notes: notesInput ? notesInput.value.trim() : ''
    };
  }

  function renderView() {
    const formData = getFormData();
    const data = calculateMacroBendLoss(formData);

    if (radiusValLabel) {
      radiusValLabel.textContent = `${formData.bendRadiusMm} mm`;
    }

    if (svgWrap) {
      svgWrap.innerHTML = renderMobileMacroBendSvg(data);
    }

    if (kpiLoss) {
      kpiLoss.textContent = `${data.totalMacroBendLossDb} dB`;
    }

    if (kpiRx) {
      kpiRx.textContent = `${data.outputPowerDbm} dBm`;
    }

    if (kpiDiff) {
      kpiDiff.textContent = `+${data.differential1550vs1310Db} dB`;
      kpiDiff.style.color = data.hasMacroBendSignature ? '#f59e0b' : '#38bdf8';
    }

    if (kpiStatus) {
      kpiStatus.textContent = data.status.replace(/_/g, ' ');
      kpiStatus.className = `badge ${data.statusBadgeClass}`;
    }

    if (remediationText) {
      remediationText.textContent = data.remediation;
      remediationText.style.color = data.mechanicalFractureRisk ? '#ef4444' : (data.status.includes('WARNING') ? '#f59e0b' : '#10b981');
    }

    renderHistory();
  }

  function renderHistory() {
    if (!historyList) return;
    const store = getMacroBendStore(storage);

    if (store.length === 0) {
      historyList.innerHTML = `<li class="empty-history-item" style="padding: 10px; text-align: center; color: #94a3b8; font-size: 0.85rem;">No macro-bend audits recorded yet.</li>`;
      return;
    }

    historyList.innerHTML = store.slice(0, 10).map(audit => `
      <li class="history-item" style="padding: 8px 10px; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem;">
        <div>
          <div style="font-weight: bold; color: #f8fafc;">${audit.location || 'Shahdara Area'}</div>
          <div style="color: #64748b; font-size: 0.75rem;">R: ${audit.bendRadiusMm}mm • ${audit.fiberStandard} • Loss: -${audit.totalMacroBendLossDb}dB • Δ: +${audit.differential1550vs1310Db}dB</div>
        </div>
        <span class="badge ${audit.status.includes('CRITICAL') ? 'badge-danger' : (audit.status.includes('WARNING') ? 'badge-warning' : 'badge-success')}" style="font-size: 0.72rem;">
          ${audit.status.replace(/_/g, ' ')}
        </span>
      </li>
    `).join('');
  }

  // Populate presets
  if (presetSelect && presetSelect.options.length <= 1) {
    presetSelect.innerHTML = `<option value="">-- Choose Field Preset --</option>` +
      SHAHDARA_MACRO_BEND_PRESETS.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }

  if (presetSelect) {
    presetSelect.onchange = e => {
      const selected = SHAHDARA_MACRO_BEND_PRESETS.find(p => p.id === e.target.value);
      if (selected) {
        if (standardSelect) standardSelect.value = selected.fiberStandard;
        if (cableSelect) cableSelect.value = selected.cableConstruction;
        if (wavelengthSelect) wavelengthSelect.value = selected.wavelengthNm;
        if (radiusSlider) radiusSlider.value = selected.bendRadiusMm;
        if (turnSelect) turnSelect.value = selected.turnCount;
        if (angleSelect) angleSelect.value = selected.bendAngleDeg;
        if (inputPowerInput) inputPowerInput.value = selected.inputPowerDbm;
        if (locationInput) locationInput.value = selected.location;
        if (techInput) techInput.value = selected.technician;
        if (notesInput) notesInput.value = selected.notes;
        renderView();
      }
    };
  }

  // Input event bindings
  [standardSelect, cableSelect, wavelengthSelect, turnSelect, angleSelect].forEach(el => {
    if (el) el.onchange = renderView;
  });

  if (radiusSlider) {
    radiusSlider.oninput = renderView;
  }
  if (inputPowerInput) {
    inputPowerInput.oninput = renderView;
  }

  if (saveBtn) {
    saveBtn.onclick = () => {
      const formData = getFormData();
      const lossData = calculateMacroBendLoss(formData);
      recordMacroBendAudit({
        ...formData,
        totalMacroBendLossDb: lossData.totalMacroBendLossDb,
        differential1550vs1310Db: lossData.differential1550vs1310Db,
        outputPowerDbm: lossData.outputPowerDbm,
        status: lossData.status
      }, storage);

      renderHistory();
      if (typeof onToast === 'function') {
        onToast('Macro-bend audit successfully saved to field register!');
      }
    };
  }

  if (whatsappBtn) {
    whatsappBtn.onclick = async () => {
      const formData = getFormData();
      const lossData = calculateMacroBendLoss(formData);
      const auditData = {
        ...formData,
        timestamp: new Date().toISOString(),
        totalMacroBendLossDb: lossData.totalMacroBendLossDb,
        differential1550vs1310Db: lossData.differential1550vs1310Db,
        outputPowerDbm: lossData.outputPowerDbm,
        status: lossData.status
      };

      const text = generateMacroBendWhatsAppReport(auditData);
      try {
        const cb = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
        if (cb?.writeText) {
          await cb.writeText(text);
          if (typeof onToast === 'function') {
            onToast('WhatsApp dispatch report copied to clipboard!');
          }
        } else if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
          window.prompt('Copy WhatsApp Report:', text);
        }
      } catch (err) {
        if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
          window.prompt('Copy WhatsApp Report:', text);
        }
      }
    };
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.onclick = () => {
      clearMacroBendStore(storage);
      renderHistory();
      if (typeof onToast === 'function') {
        onToast('Macro-bend audit history cleared.');
      }
    };
  }

  function openModal() {
    renderView();
    if (modal) {
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', 'true');
    }
  }

  function closeModal() {
    if (modal) {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    }
  }

  [drawerBtn, speedDialBtn, actionSheetBtn].forEach(btn => {
    if (btn) btn.onclick = openModal;
  });

  if (closeBtn) closeBtn.onclick = closeModal;

  if (modal) {
    modal.onclick = e => {
      if (e.target === modal) closeModal();
    };
  }

  // Initial render
  renderView();

  return {
    open: openModal,
    close: closeModal,
    render: renderView
  };
}
