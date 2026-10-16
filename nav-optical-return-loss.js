/**
 * Shahdara ISP - Field Technician Optical Return Loss (ORL) & Back-Reflection Assistant
 * 
 * Provides FTTH linemen and field engineers with real-time Optical Return Loss (ORL)
 * calculations, Fresnel back-reflection analysis, APC/UPC connector mismatch detection,
 * laser feedback safety thresholds (ITU-T G.984.2, G.987.2, IEC 61300-3-6),
 * vector SVG schematics, and WhatsApp field dispatch reports.
 */

export const OPTICAL_RETURN_LOSS_STORAGE_KEY = 'shahdara_orl_audits_v1';

export const OPTICAL_NETWORK_STANDARDS = {
  GPON_ITU_G984: {
    id: 'GPON_ITU_G984',
    name: 'ITU-T G.984.2 GPON (2.5G/1.25G)',
    minOrlDb: 32.0,
    optimalOrlDb: 35.0,
    criticalOrlDb: 25.0,
    description: 'Standard residential GPON ODN. Minimum allowable ORL is 32.0 dB.'
  },
  XGSPON_ITU_G9807: {
    id: 'XGSPON_ITU_G9807',
    name: 'ITU-T G.9807.1 XGS-PON (10G/10G)',
    minOrlDb: 32.0,
    optimalOrlDb: 38.0,
    criticalOrlDb: 27.0,
    description: '10G symmetrical PON. Narrow linewidth DFB laser requires ORL >= 32.0 dB.'
  },
  RF_VIDEO_OVERLAY: {
    id: 'RF_VIDEO_OVERLAY',
    name: 'ITU-T J.186 RF Video Overlay (1550 nm)',
    minOrlDb: 40.0,
    optimalOrlDb: 45.0,
    criticalOrlDb: 32.0,
    description: 'High-power analog CATV/RF video overlay. Extremely sensitive to back-reflection (RIN).'
  },
  P2P_ENTERPRISE_ETHERNET: {
    id: 'P2P_ENTERPRISE_ETHERNET',
    name: 'IEEE 802.3ah 1000BASE-BX (P2P Dedicated)',
    minOrlDb: 30.0,
    optimalOrlDb: 34.0,
    criticalOrlDb: 22.0,
    description: 'Point-to-point dedicated fiber link for corporate subscribers.'
  }
};

export const ORL_CONNECTOR_POLISH_TYPES = {
  SC_APC_CLEAN: {
    id: 'SC_APC_CLEAN',
    name: 'SC/APC (Angled Physical Contact - 8°)',
    polish: 'APC',
    reflectanceDb: -65.0,
    insertionLossDb: 0.25,
    color: '#10b981',
    description: 'Green housing 8-degree angled ferrule. Back-reflected light is reflected into cladding.'
  },
  LC_APC_CLEAN: {
    id: 'LC_APC_CLEAN',
    name: 'LC/APC (Small Form-Factor Angled)',
    polish: 'APC',
    reflectanceDb: -65.0,
    insertionLossDb: 0.20,
    color: '#10b981',
    description: 'High-density green LC ferrule. Premium reflection suppression.'
  },
  SC_UPC_CLEAN: {
    id: 'SC_UPC_CLEAN',
    name: 'SC/UPC (Ultra Physical Contact - Flat Domed)',
    polish: 'UPC',
    reflectanceDb: -50.0,
    insertionLossDb: 0.25,
    color: '#0284c7',
    description: 'Blue housing domed UPC polish. Good reflectance (-50 dB) but inferior to APC.'
  },
  SC_PC_LEGACY: {
    id: 'SC_PC_LEGACY',
    name: 'SC/PC (Standard Physical Contact - Legacy)',
    polish: 'PC',
    reflectanceDb: -40.0,
    insertionLossDb: 0.35,
    color: '#f59e0b',
    description: 'Legacy black/beige connector. Marginal reflection performance.'
  },
  APC_UPC_MISMATCH: {
    id: 'APC_UPC_MISMATCH',
    name: 'MISMATCH: SC/APC Plug in SC/UPC Bulkhead (FATAL)',
    polish: 'MISMATCH',
    reflectanceDb: -18.0,
    insertionLossDb: 4.5,
    color: '#ef4444',
    description: 'Critical human error: 8-degree wedge leaves large air wedge causing high reflection and severe loss.'
  },
  OPEN_CLEAVED_FIBER: {
    id: 'OPEN_CLEAVED_FIBER',
    name: 'OPEN END: Uncapped Fiber Core to Air (Fresnel)',
    polish: 'OPEN',
    reflectanceDb: -14.7,
    insertionLossDb: 35.0,
    color: '#ef4444',
    description: 'Fresnel reflection at glass-air boundary (n1=1.468 vs n2=1.000). Maximum reflection peak!'
  },
  DIRTY_CONTAMINATED: {
    id: 'DIRTY_CONTAMINATED',
    name: 'DIRTY: Dust / Oil / Grease Residue on Ferrule',
    polish: 'DIRTY',
    reflectanceDb: -26.0,
    insertionLossDb: 1.8,
    color: '#f97316',
    description: 'Particulate matter prevents physical core contact, creating reflective air pockets.'
  }
};

export const ORL_FIELD_PRESETS = {
  PRESET_ALL_APC_OPTIMAL: {
    id: 'PRESET_ALL_APC_OPTIMAL',
    name: 'Shahdara NOC to Customer All-APC Clean ODN',
    standardId: 'GPON_ITU_G984',
    fiberLengthKm: 2.8,
    fiberAttenuationPerKm: 0.35,
    connector1: 'SC_APC_CLEAN',
    connector2: 'SC_APC_CLEAN',
    connector3: 'SC_APC_CLEAN',
    location: 'Shahdara Town - Main Bazaar Commercial Feeder',
    notes: 'All green SC/APC terminations. Pristine ODN return loss (> 35 dB).'
  },
  PRESET_FAT_CONNECTOR_MISMATCH: {
    id: 'PRESET_FAT_CONNECTOR_MISMATCH',
    name: 'FAT Mismatch: Blue UPC Patch Cord on Green APC Adapter',
    standardId: 'GPON_ITU_G984',
    fiberLengthKm: 1.2,
    fiberAttenuationPerKm: 0.35,
    connector1: 'SC_APC_CLEAN',
    connector2: 'APC_UPC_MISMATCH',
    connector3: 'SC_APC_CLEAN',
    location: 'Kot Abdul Malik - Street 4 Pole FAT-08',
    notes: 'Lineman erroneously used blue UPC drop jumper on green APC port.'
  },
  PRESET_OPEN_SPLITTER_LEG: {
    id: 'PRESET_OPEN_SPLITTER_LEG',
    name: 'Uncapped Splitter 1:8 Output Leg (Fresnel Air Reflection)',
    standardId: 'XGSPON_ITU_G9807',
    fiberLengthKm: 0.6,
    fiberAttenuationPerKm: 0.35,
    connector1: 'SC_APC_CLEAN',
    connector2: 'OPEN_CLEAVED_FIBER',
    connector3: 'SC_APC_CLEAN',
    location: 'Baradari Road - Sub-NOC FDT Distribution Box',
    notes: 'Spare port left without dust-cap. Fresnel reflection disturbs OLT laser.'
  },
  PRESET_DIRTY_NOC_ODF_PIGTAIL: {
    id: 'PRESET_DIRTY_NOC_ODF_PIGTAIL',
    name: 'Dusty ODF Pigtail at Shahdara Central NOC',
    standardId: 'GPON_ITU_G984',
    fiberLengthKm: 3.5,
    fiberAttenuationPerKm: 0.35,
    connector1: 'DIRTY_CONTAMINATED',
    connector2: 'SC_APC_CLEAN',
    connector3: 'SC_APC_CLEAN',
    location: 'Shahdara Central NOC - Rack 2 ODF Tray #3',
    notes: 'Airborne dust contamination on central patch panel ferrule.'
  },
  PRESET_RF_VIDEO_1550_LINK: {
    id: 'PRESET_RF_VIDEO_1550_LINK',
    name: '1550nm RF Cable Video Overlay Trunk',
    standardId: 'RF_VIDEO_OVERLAY',
    fiberLengthKm: 4.2,
    fiberAttenuationPerKm: 0.22,
    connector1: 'SC_APC_CLEAN',
    connector2: 'SC_APC_CLEAN',
    connector3: 'SC_UPC_CLEAN',
    location: 'Ravi Siphon Road - CATV Headend Overlay',
    notes: 'UPC termination at receiver degrades ORL below 40 dB RF video minimum.'
  }
};

/**
 * Calculates cumulative Optical Return Loss (ORL), reflection event power,
 * laser feedback safety margin, and remediation recommendations.
 *
 * @param {Object} params
 * @param {string} params.standardId
 * @param {number} params.fiberLengthKm
 * @param {number} params.fiberAttenuationPerKm
 * @param {Array<string>} params.connectorIds - Array of connector keys along path
 * @returns {Object} Comprehensive calculation result
 */
export function calculateOpticalReturnLoss({
  standardId = 'GPON_ITU_G984',
  fiberLengthKm = 2.0,
  fiberAttenuationPerKm = 0.35,
  connectorIds = ['SC_APC_CLEAN', 'SC_APC_CLEAN', 'SC_APC_CLEAN']
} = {}) {
  const standard = OPTICAL_NETWORK_STANDARDS[standardId] || OPTICAL_NETWORK_STANDARDS.GPON_ITU_G984;
  const safeLengthKm = Math.max(0.05, Math.min(30.0, Number(fiberLengthKm) || 2.0));
  const safeAttPerKm = Math.max(0.15, Math.min(1.0, Number(fiberAttenuationPerKm) || 0.35));

  // Rayleigh backscattering contribution (backscattering factor B_R ~ -38 dB for typical ODN link)
  const totalFiberLossDb = safeLengthKm * safeAttPerKm;
  const rayleighReturnLossDb = Math.max(34.0, 42.0 - (4.0 * Math.log10(Math.max(0.1, safeLengthKm))));

  // Discrete reflection events
  const events = [];
  let cumulativeOneWayLossDb = 0.0;
  let totalReflectedPowerFraction = Math.pow(10, -rayleighReturnLossDb / 10);

  const connList = Array.isArray(connectorIds) && connectorIds.length > 0
    ? connectorIds
    : ['SC_APC_CLEAN', 'SC_APC_CLEAN', 'SC_APC_CLEAN'];

  const stepDistanceKm = safeLengthKm / Math.max(1, connList.length);

  connList.forEach((connId, idx) => {
    const conn = ORL_CONNECTOR_POLISH_TYPES[connId] || ORL_CONNECTOR_POLISH_TYPES.SC_APC_CLEAN;
    const distanceKm = Math.round((stepDistanceKm * (idx + 1)) * 100) / 100;
    const fiberSpanLossToPoint = distanceKm * safeAttPerKm;

    // Two-way fiber attenuation from OLT to reflection point and back
    const twoWayLossDb = 2.0 * (fiberSpanLossToPoint + cumulativeOneWayLossDb);
    const effectiveReturnLossDb = Math.round((-conn.reflectanceDb + twoWayLossDb) * 10) / 10;
    const reflectedPowerFraction = Math.pow(10, -effectiveReturnLossDb / 10);

    totalReflectedPowerFraction += reflectedPowerFraction;
    cumulativeOneWayLossDb += conn.insertionLossDb;

    events.push({
      index: idx + 1,
      connector: conn,
      distanceKm,
      pointReflectanceDb: conn.reflectanceDb,
      twoWayLossDb: Math.round(twoWayLossDb * 10) / 10,
      effectiveReturnLossDb,
      isSevere: conn.reflectanceDb > -30.0
    });
  });

  // Total Cumulative ORL in dB
  const totalOrlDb = Math.round((-10 * Math.log10(Math.max(1e-12, totalReflectedPowerFraction))) * 10) / 10;
  const orlMarginDb = Math.round((totalOrlDb - standard.minOrlDb) * 10) / 10;

  // Determine Compliance Status
  let status = 'OPTIMAL';
  let statusLabel = 'EXCELLENT PASS';
  let message = `System ORL (${totalOrlDb.toFixed(1)} dB) safely exceeds the ${standard.name} threshold (${standard.minOrlDb.toFixed(1)} dB). Laser feedback is negligible.`;

  const hasMismatch = events.some(e => e.connector.id === 'APC_UPC_MISMATCH');
  const hasOpenEnd = events.some(e => e.connector.id === 'OPEN_CLEAVED_FIBER');
  const hasDirty = events.some(e => e.connector.id === 'DIRTY_CONTAMINATED');

  if (hasMismatch || hasOpenEnd || totalOrlDb < standard.criticalOrlDb) {
    status = 'CRITICAL_REFLECTANCE';
    statusLabel = 'CRITICAL BACK-REFLECTION';
    if (hasMismatch) {
      message = `CRITICAL DANGER: APC/UPC connector mismatch detected! High back-reflection (${totalOrlDb.toFixed(1)} dB) destabilizes OLT transmitter laser diode. Replace mismatched adapter/patch cord immediately.`;
    } else if (hasOpenEnd) {
      message = `CRITICAL DANGER: Open uncapped fiber end detected. 4% Fresnel glass-to-air reflection (${totalOrlDb.toFixed(1)} dB) degrades upstream transmission. Cap or terminate fiber.`;
    } else {
      message = `CRITICAL DANGER: Optical Return Loss (${totalOrlDb.toFixed(1)} dB) is far below critical limit (${standard.criticalOrlDb.toFixed(1)} dB). Laser Relative Intensity Noise (RIN) will cause framing errors.`;
    }
  } else if (totalOrlDb < standard.minOrlDb) {
    status = 'NON_COMPLIANT';
    statusLabel = 'NON-COMPLIANT';
    message = `WARNING: ORL (${totalOrlDb.toFixed(1)} dB) fails ${standard.name} requirement of ${standard.minOrlDb.toFixed(1)} dB by ${Math.abs(orlMarginDb).toFixed(1)} dB. Clean connectors or upgrade to angled APC polish.`;
  } else if (totalOrlDb < standard.optimalOrlDb) {
    status = 'ACCEPTABLE';
    statusLabel = 'ACCEPTABLE MARGIN';
    message = `NOTICE: ORL (${totalOrlDb.toFixed(1)} dB) meets minimum compliance (${standard.minOrlDb.toFixed(1)} dB), but has narrow margin to optimal target (${standard.optimalOrlDb.toFixed(1)} dB).`;
  }

  // Identify worst offending reflection event
  let worstEvent = events[0] || null;
  events.forEach(e => {
    if (!worstEvent || e.pointReflectanceDb > worstEvent.pointReflectanceDb) {
      worstEvent = e;
    }
  });

  return {
    standard,
    fiberLengthKm: safeLengthKm,
    fiberAttenuationPerKm: safeAttPerKm,
    totalFiberLossDb: Math.round(totalFiberLossDb * 10) / 10,
    rayleighReturnLossDb: Math.round(rayleighReturnLossDb * 10) / 10,
    events,
    worstEvent,
    totalOrlDb,
    orlMarginDb,
    status,
    statusLabel,
    message,
    hasMismatch,
    hasOpenEnd,
    hasDirty
  };
}

/**
 * Renders an offline SVG diagram illustrating laser transmitter,
 * forward propagation, back-reflection waves, discrete reflection events,
 * and ORL gauge.
 */
export function renderMobileOrlSvg(calcResult, options = {}) {
  const width = options.width || 720;
  const height = options.height || 260;
  const res = calcResult;
  const std = res.standard;

  const statusColor = res.status === 'OPTIMAL' ? '#10b981'
    : res.status === 'ACCEPTABLE' ? '#0284c7'
    : res.status === 'NON_COMPLIANT' ? '#f59e0b' : '#ef4444';

  const txX = 30;
  const txY = 45;
  const txW = 85;
  const txH = 46;

  const spanStartX = txX + txW + 15;
  const spanEndX = width - 40;
  const fiberY = txY + txH / 2;

  // Render discrete reflection points along fiber line
  const eventPinsSvg = res.events.map((ev, i) => {
    const fraction = (i + 1) / (res.events.length + 1);
    const pinX = spanStartX + (spanEndX - spanStartX) * fraction;
    const pinColor = ev.connector.color;
    const isBad = ev.pointReflectanceDb > -30.0;

    return `
      <!-- Event ${ev.index}: ${ev.connector.name} -->
      <line x1="${pinX}" y1="${fiberY - 14}" x2="${pinX}" y2="${fiberY + 14}" stroke="${pinColor}" stroke-width="${isBad ? '3.5' : '2'}"/>
      <circle cx="${pinX}" cy="${fiberY}" r="${isBad ? '6' : '4'}" fill="${pinColor}" stroke="#ffffff" stroke-width="1.5"/>
      <!-- Label -->
      <text x="${pinX}" y="${fiberY - 18}" fill="${pinColor}" font-size="9" font-weight="700" text-anchor="middle">
        ${ev.connector.polish} (${ev.pointReflectanceDb} dB)
      </text>
      <text x="${pinX}" y="${fiberY + 26}" fill="var(--muted,#64748b)" font-size="8.5" text-anchor="middle">
        ${ev.distanceKm} km
      </text>
    `;
  }).join('');

  // ORL Meter Gauge Bar calculations
  const meterX = 40;
  const meterY = 160;
  const meterW = width - 80;
  const meterH = 22;

  // Scale: 10 dB (critical) to 50 dB (excellent)
  const minScale = 10;
  const maxScale = 50;
  const clampOrl = Math.max(minScale, Math.min(maxScale, res.totalOrlDb));
  const pointerX = meterX + ((clampOrl - minScale) / (maxScale - minScale)) * meterW;

  const critThresholdX = meterX + ((std.criticalOrlDb - minScale) / (maxScale - minScale)) * meterW;
  const minThresholdX = meterX + ((std.minOrlDb - minScale) / (maxScale - minScale)) * meterW;
  const optThresholdX = meterX + ((std.optimalOrlDb - minScale) / (maxScale - minScale)) * meterW;

  return `
    <svg class="orl-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Optical Return Loss Wave Schematic">
      <defs>
        <linearGradient id="orlFiberGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#10b981"/>
        </linearGradient>
        <marker id="orlArrowFwd" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8"/>
        </marker>
        <marker id="orlArrowReflect" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#ef4444"/>
        </marker>
      </defs>

      <!-- Background Card Base -->
      <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="#0b1329"/>

      <!-- OLT Laser Transmitter Module Box -->
      <rect x="${txX}" y="${txY}" width="${txW}" height="${txH}" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="1.8"/>
      <text x="${txX + txW / 2}" y="${txY + 18}" fill="#38bdf8" font-size="10.5" font-weight="700" text-anchor="middle">OLT LASER</text>
      <text x="${txX + txW / 2}" y="${txY + 34}" fill="var(--muted,#94a3b8)" font-size="8.5" text-anchor="middle">Isolator 1490nm</text>

      <!-- Forward Propagating Lightwave Line -->
      <line x1="${spanStartX}" y1="${fiberY - 4}" x2="${spanEndX}" y2="${fiberY - 4}" stroke="#38bdf8" stroke-width="3" stroke-dasharray="8,4"/>
      <text x="${spanStartX + 50}" y="${fiberY - 9}" fill="#38bdf8" font-size="8.5" font-weight="700">Forward Signal &rarr;</text>

      <!-- Counter-Propagating Back-Reflection Line -->
      <line x1="${spanEndX}" y1="${fiberY + 6}" x2="${spanStartX}" y2="${fiberY + 6}" stroke="#ef4444" stroke-width="${res.status === 'CRITICAL_REFLECTANCE' ? '3' : '1.5'}" stroke-dasharray="6,3"/>
      <text x="${spanStartX + 50}" y="${fiberY + 18}" fill="#ef4444" font-size="8.5" font-weight="700">&larr; Back-Reflection (ORL)</text>

      <!-- End Termination Block -->
      <rect x="${spanEndX}" y="${txY + 5}" width="25" height="${txH - 10}" rx="4" fill="#334155" stroke="#64748b" stroke-width="1.5"/>

      <!-- Discrete Event Pins -->
      ${eventPinsSvg}

      <!-- ORL Compliance Scale Bar -->
      <rect x="${meterX}" y="${meterY}" width="${meterW}" height="${meterH}" rx="6" fill="#1e293b" stroke="#334155"/>

      <!-- Red Critical Zone (< 25 dB) -->
      <rect x="${meterX}" y="${meterY}" width="${Math.max(1, critThresholdX - meterX)}" height="${meterH}" fill="rgba(239, 68, 68, 0.45)"/>
      <!-- Orange Warning Zone (25 dB to minOrl) -->
      <rect x="${critThresholdX}" y="${meterY}" width="${Math.max(1, minThresholdX - critThresholdX)}" height="${meterH}" fill="rgba(245, 158, 11, 0.4)"/>
      <!-- Green Pass Zone (> minOrl) -->
      <rect x="${minThresholdX}" y="${meterY}" width="${Math.max(1, meterX + meterW - minThresholdX)}" height="${meterH}" fill="rgba(16, 185, 129, 0.35)"/>

      <!-- Threshold Lines -->
      <line x1="${minThresholdX}" y1="${meterY - 4}" x2="${minThresholdX}" y2="${meterY + meterH + 4}" stroke="#10b981" stroke-width="2"/>
      <text x="${minThresholdX}" y="${meterY - 6}" fill="#10b981" font-size="8.5" font-weight="700" text-anchor="middle">MIN: ${std.minOrlDb} dB</text>

      <line x1="${optThresholdX}" y1="${meterY - 4}" x2="${optThresholdX}" y2="${meterY + meterH + 4}" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="2,2"/>
      <text x="${optThresholdX}" y="${meterY - 6}" fill="#38bdf8" font-size="8.5" font-weight="700" text-anchor="middle">OPT: ${std.optimalOrlDb} dB</text>

      <!-- Active ORL Needle Marker -->
      <polygon points="${pointerX},${meterY + meterH / 2 - 8} ${pointerX + 7},${meterY + meterH / 2 + 10} ${pointerX - 7},${meterY + meterH / 2 + 10}" fill="${statusColor}" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="${pointerX}" cy="${meterY + meterH / 2}" r="5" fill="${statusColor}" stroke="#ffffff" stroke-width="1.5"/>

      <!-- Bottom KPI Text Readout -->
      <text x="${meterX}" y="${height - 18}" fill="var(--muted,#94a3b8)" font-size="10.5">
        Cumulative ORL: <tspan font-weight="700" fill="${statusColor}">${res.totalOrlDb.toFixed(1)} dB</tspan> &bull;
        Margin: <tspan font-weight="700" fill="${res.orlMarginDb >= 0 ? '#10b981' : '#ef4444'}">${res.orlMarginDb >= 0 ? '+' : ''}${res.orlMarginDb.toFixed(1)} dB</tspan> &bull;
        Worst Event: <tspan font-weight="700" fill="${res.worstEvent?.connector.color || '#38bdf8'}">${res.worstEvent?.connector.name.split(' ')[0] || 'Clean'} (${res.worstEvent?.pointReflectanceDb} dB)</tspan>
      </text>

      <!-- Status Badge Pill in Top Right -->
      <rect x="${width - 150}" y="12" width="138" height="24" rx="12" fill="${statusColor}22" stroke="${statusColor}" stroke-width="1.2"/>
      <text x="${width - 81}" y="28" fill="${statusColor}" font-size="9.5" font-weight="700" text-anchor="middle">${res.statusLabel}</text>
    </svg>
  `;
}

export function getDefaultOrlAudits() {
  return [
    {
      id: 'orl-audit-101',
      timestamp: '2026-10-16T19:20:00+05:00',
      location: 'Shahdara Town - Main Bazaar Commercial Feeder',
      technician: 'Imran Lineman',
      standardId: 'GPON_ITU_G984',
      fiberLengthKm: 2.8,
      totalOrlDb: 36.2,
      orlMarginDb: 4.2,
      status: 'OPTIMAL',
      notes: 'All-APC clean network. Measured ORL 36.2 dB safely above 32 dB threshold.'
    },
    {
      id: 'orl-audit-102',
      timestamp: '2026-10-16T22:05:00+05:00',
      location: 'Kot Abdul Malik - Street 4 Pole FAT-08',
      technician: 'Tariq Field Engineer',
      standardId: 'GPON_ITU_G984',
      fiberLengthKm: 1.2,
      totalOrlDb: 17.8,
      orlMarginDb: -14.2,
      status: 'CRITICAL_REFLECTANCE',
      notes: 'Lineman plugged blue UPC drop cord into green APC FAT port. Relieved and replaced.'
    }
  ];
}

export function getOrlStore(storage) {
  if (!storage) return getDefaultOrlAudits();
  try {
    const raw = storage.getItem(OPTICAL_RETURN_LOSS_STORAGE_KEY);
    if (!raw) {
      const initial = getDefaultOrlAudits();
      saveOrlStore(initial, storage);
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : getDefaultOrlAudits();
  } catch (e) {
    return getDefaultOrlAudits();
  }
}

export function saveOrlStore(audits, storage) {
  if (!storage) return;
  try {
    storage.setItem(OPTICAL_RETURN_LOSS_STORAGE_KEY, JSON.stringify(audits));
  } catch (e) {
    // quota fallback
  }
}

export function recordOrlAudit(entry, storage) {
  const current = getOrlStore(storage);
  const newAudit = {
    id: `orl-audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...entry
  };
  const updated = [newAudit, ...current].slice(0, 30);
  saveOrlStore(updated, storage);
  return updated;
}

export function clearOrlStore(storage) {
  return saveOrlStore([], storage);
}

/**
 * Generates formatted WhatsApp dispatch report for field technicians.
 */
export function generateOrlWhatsAppReport(audit) {
  return `*SHAHDARA ISP - OPTICAL RETURN LOSS (ORL) AUDIT*
----------------------------------------
*Location:* ${audit.location || 'Shahdara Field Span'}
*Lineman:* ${audit.technician || 'On-Duty Tech'}
*Date:* ${audit.timestamp ? new Date(audit.timestamp).toLocaleString() : new Date().toLocaleString()}

*OPTICAL RETURN LOSS METRICS:*
- *Total ODN ORL:* ${audit.totalOrlDb ? audit.totalOrlDb.toFixed(1) : '32.0'} dB
- *Network Standard:* ${audit.standardName || 'ITU-T G.984 GPON'}
- *Span Distance:* ${audit.fiberLengthKm ? audit.fiberLengthKm.toFixed(2) : '2.00'} km
- *Compliance Verdict:* ${audit.status === 'OPTIMAL' ? 'PASS - OPTIMAL (> 35 dB)' : audit.status}

*TECH OBSERVATIONS:*
${audit.notes || 'Optical return loss verified. Laser cavity feedback within safe tolerances.'}
----------------------------------------
_Verified via Shahdara ISP Mobile Field Assistant_`;
}

/**
 * Initializes and wires the mobile optical return loss modal dialog and triggers.
 */
export function setupMobileOrlModal(options = {}) {
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const onToast = options.onToast || (() => {});
  const clipboard = options.clipboard;

  const modal = document.getElementById('mobileOrlModal');
  const closeBtn = document.getElementById('mobileOrlCloseBtn');

  // Trigger buttons across mobile surfaces
  const drawerBtn = document.getElementById('navOrlBtn');
  const speedDialBtn = document.querySelector('[data-open-orl]');
  const actionSheetBtn = document.querySelector('[data-action-orl]');

  // Inputs
  const presetSelect = document.getElementById('orlPresetSelect');
  const standardSelect = document.getElementById('orlStandardSelect');
  const lengthSlider = document.getElementById('orlLengthSlider');
  const lengthVal = document.getElementById('orlLengthVal');
  const conn1Select = document.getElementById('orlConn1Select');
  const conn2Select = document.getElementById('orlConn2Select');
  const conn3Select = document.getElementById('orlConn3Select');

  // KPI elements
  const kpiOrl = document.getElementById('orlKpiTotal');
  const kpiMargin = document.getElementById('orlKpiMargin');
  const kpiWorst = document.getElementById('orlKpiWorst');
  const kpiStatus = document.getElementById('orlKpiStatus');

  const svgWrap = document.getElementById('orlSvgWrap');
  const remediationText = document.getElementById('orlRemediationText');

  // Metadata & Action Buttons
  const locationInput = document.getElementById('orlLocationInput');
  const techInput = document.getElementById('orlTechInput');
  const notesInput = document.getElementById('orlNotesInput');
  const saveBtn = document.getElementById('orlSaveBtn');
  const whatsappBtn = document.getElementById('orlWhatsappBtn');
  const clearHistoryBtn = document.getElementById('orlClearHistoryBtn');
  const historyList = document.getElementById('orlHistoryList');

  function getCurrentCalc() {
    const stdId = standardSelect ? standardSelect.value : 'GPON_ITU_G984';
    const lenKm = lengthSlider ? Number(lengthSlider.value) : 2.0;
    const c1 = conn1Select ? conn1Select.value : 'SC_APC_CLEAN';
    const c2 = conn2Select ? conn2Select.value : 'SC_APC_CLEAN';
    const c3 = conn3Select ? conn3Select.value : 'SC_APC_CLEAN';

    return calculateOpticalReturnLoss({
      standardId: stdId,
      fiberLengthKm: lenKm,
      connectorIds: [c1, c2, c3]
    });
  }

  function renderView() {
    const res = getCurrentCalc();

    if (lengthVal && lengthSlider) {
      lengthVal.textContent = `${Number(lengthSlider.value).toFixed(1)} km`;
    }

    if (kpiOrl) {
      kpiOrl.textContent = `${res.totalOrlDb.toFixed(1)} dB`;
      kpiOrl.style.color = res.status === 'OPTIMAL' ? '#10b981'
        : res.status === 'ACCEPTABLE' ? '#0284c7'
        : res.status === 'NON_COMPLIANT' ? '#f59e0b' : '#ef4444';
    }

    if (kpiMargin) {
      kpiMargin.textContent = `${res.orlMarginDb >= 0 ? '+' : ''}${res.orlMarginDb.toFixed(1)} dB`;
      kpiMargin.style.color = res.orlMarginDb >= 0 ? '#10b981' : '#ef4444';
    }

    if (kpiWorst) {
      const w = res.worstEvent;
      kpiWorst.textContent = w ? `${w.pointReflectanceDb} dB (${w.connector.name.split(' ')[0]})` : '-65 dB';
    }

    if (kpiStatus) {
      kpiStatus.textContent = res.statusLabel;
      kpiStatus.style.color = res.status === 'OPTIMAL' ? '#10b981'
        : res.status === 'ACCEPTABLE' ? '#0284c7'
        : res.status === 'NON_COMPLIANT' ? '#f59e0b' : '#ef4444';
    }

    if (remediationText) {
      remediationText.textContent = res.message;
      remediationText.style.borderColor = res.status === 'OPTIMAL' ? 'rgba(16, 185, 129, 0.3)'
        : res.status === 'ACCEPTABLE' ? 'rgba(2, 132, 199, 0.3)'
        : res.status === 'NON_COMPLIANT' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)';
      remediationText.style.background = res.status === 'OPTIMAL' ? 'rgba(16, 185, 129, 0.1)'
        : res.status === 'ACCEPTABLE' ? 'rgba(2, 132, 199, 0.1)'
        : res.status === 'NON_COMPLIANT' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)';
      remediationText.style.color = res.status === 'OPTIMAL' ? '#10b981'
        : res.status === 'ACCEPTABLE' ? '#0284c7'
        : res.status === 'NON_COMPLIANT' ? '#f59e0b' : '#ef4444';
    }

    if (svgWrap) {
      svgWrap.innerHTML = renderMobileOrlSvg(res);
    }

    renderHistory();
  }

  function renderHistory() {
    if (!historyList) return;
    const items = getOrlStore(storage);
    if (items.length === 0) {
      historyList.innerHTML = '<li class="probe-history-item empty" style="color:var(--muted);font-size:12px;padding:8px">No optical return loss audits recorded yet.</li>';
      return;
    }
    historyList.innerHTML = items.map(item => `
      <li class="probe-history-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid var(--line);font-size:12px;">
        <div>
          <div style="font-weight:700;color:var(--ink)">${item.location || 'Shahdara Drop'} &bull; <span style="color:#0284c7">ORL: ${item.totalOrlDb} dB</span></div>
          <div style="color:var(--muted);font-size:11px">${item.technician || 'Lineman'} &bull; Dist: ${item.fiberLengthKm} km &bull; Margin: ${item.orlMarginDb >= 0 ? '+' : ''}${item.orlMarginDb} dB</div>
        </div>
        <div style="text-align:right">
          <span class="badge ${item.status === 'OPTIMAL' ? 'badge-pass' : 'badge-fail'}" style="font-weight:700;font-size:10px;padding:2px 6px;border-radius:4px;background:${item.status === 'OPTIMAL' ? '#10b98122' : '#ef444422'};color:${item.status === 'OPTIMAL' ? '#10b981' : '#ef4444'}">${item.status}</span>
        </div>
      </li>
    `).join('');
  }

  // Preset Selection
  if (presetSelect) {
    presetSelect.onchange = () => {
      const pKey = presetSelect.value;
      const preset = ORL_FIELD_PRESETS[pKey];
      if (preset) {
        if (standardSelect) standardSelect.value = preset.standardId;
        if (lengthSlider) lengthSlider.value = preset.fiberLengthKm;
        if (conn1Select) conn1Select.value = preset.connector1;
        if (conn2Select) conn2Select.value = preset.connector2;
        if (conn3Select) conn3Select.value = preset.connector3;
        if (locationInput) locationInput.value = preset.location;
        if (notesInput) notesInput.value = preset.notes;
        renderView();
        onToast(`Loaded preset: ${preset.name}`);
      }
    };
  }

  // Interactive controls
  [standardSelect, conn1Select, conn2Select, conn3Select].forEach(el => {
    if (el) el.onchange = renderView;
  });

  if (lengthSlider) {
    lengthSlider.oninput = renderView;
  }

  // Audit actions
  if (saveBtn) {
    saveBtn.onclick = () => {
      const calc = getCurrentCalc();
      const audit = {
        location: locationInput?.value?.trim() || 'Shahdara Drop',
        technician: techInput?.value?.trim() || 'Field Lineman',
        standardId: calc.standard.id,
        standardName: calc.standard.name,
        fiberLengthKm: calc.fiberLengthKm,
        totalOrlDb: calc.totalOrlDb,
        orlMarginDb: calc.orlMarginDb,
        status: calc.status,
        notes: notesInput?.value?.trim() || calc.message
      };
      recordOrlAudit(audit, storage);
      renderHistory();
      onToast('Optical return loss audit saved to device!');
    };
  }

  if (whatsappBtn) {
    whatsappBtn.onclick = async () => {
      const calc = getCurrentCalc();
      const audit = {
        location: locationInput?.value?.trim() || 'Shahdara Drop',
        technician: techInput?.value?.trim() || 'Field Lineman',
        standardName: calc.standard.name,
        fiberLengthKm: calc.fiberLengthKm,
        totalOrlDb: calc.totalOrlDb,
        status: calc.status,
        notes: notesInput?.value?.trim() || calc.message
      };
      const text = generateOrlWhatsAppReport(audit);
      try {
        const cb = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
        if (cb?.writeText) {
          await cb.writeText(text);
          onToast('WhatsApp audit report copied to clipboard!');
        } else if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
          window.prompt('Copy WhatsApp Report:', text);
        }
      } catch (e) {
        if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
          window.prompt('Copy WhatsApp Report:', text);
        }
      }
    };
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.onclick = () => {
      clearOrlStore(storage);
      renderHistory();
      onToast('Optical return loss audit history cleared.');
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

  if (closeBtn) closeBtn.onclick = closeModal;
  if (drawerBtn) drawerBtn.onclick = openModal;
  if (speedDialBtn) speedDialBtn.onclick = openModal;
  if (actionSheetBtn) actionSheetBtn.onclick = openModal;

  // Backdrop click closes dialog
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }

  // Initial render
  renderView();

  return {
    open: openModal,
    close: closeModal,
    render: renderView,
    getCalculation: getCurrentCalc
  };
}
