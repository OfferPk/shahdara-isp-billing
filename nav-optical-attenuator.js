/**
 * Shahdara ISP - Field Technician Optical Power Attenuation, VOA Tuning & Optical Receiver Overdrive Protection Assistant
 * Part of mobile navigation and field crew tools (agent2 - shahdara-mobile-nav).
 *
 * Implements ITU-T G.984.2 (GPON), G.9807.1 (XGS-PON), and IEEE 802.3ah (EPON) optical receiver models:
 * - Optical power overload & saturation protection
 * - Fixed Optical Attenuator (FOA) plug-in pad calculation (1, 2, 3, 5, 7, 10, 15, 20 dB)
 * - Variable Optical Attenuator (VOA) continuous micrometer dial calibration (0.0 - 30.0 dB)
 * - Optimal target receiver power delta & recommended pad recommendation
 * - Dynamic Range Eye Diagram & Photo-Detector Saturation Gauge SVG Visualizer
 * - Field technician presets, localStorage audit logs, and WhatsApp lineman dispatch
 */

export const OPTICAL_ATTENUATOR_STORAGE_KEY = 'shahdara_attenuator_audits_v1';

export const ONU_RECEIVER_CLASSES = {
  GPON_CLASS_B_PLUS: {
    id: 'GPON_CLASS_B_PLUS',
    name: 'ITU-T G.984.2 GPON Class B+',
    category: 'Standard Residential GPON',
    minSensitivityDbm: -27.0,
    maxOverloadDbm: -8.0,
    optimalTargetDbm: -18.0,
    defaultWavelengthNm: 1490,
    description: 'Standard residential GPON ONT. Receiver saturates if input power exceeds -8.0 dBm.'
  },
  GPON_CLASS_C_PLUS: {
    id: 'GPON_CLASS_C_PLUS',
    name: 'ITU-T G.984.2 GPON Class C+',
    category: 'High-Budget GPON Long-Reach',
    minSensitivityDbm: -30.0,
    maxOverloadDbm: -8.0,
    optimalTargetDbm: -19.0,
    defaultWavelengthNm: 1490,
    description: 'High-budget GPON optics. Extended reach sensitivity down to -30 dBm, but still overloads at -8.0 dBm.'
  },
  XGSPON_CLASS_N1: {
    id: 'XGSPON_CLASS_N1',
    name: 'ITU-T G.9807.1 XGS-PON Class N1 (10G/10G)',
    category: '10G Symmetrical Enterprise',
    minSensitivityDbm: -28.0,
    maxOverloadDbm: -7.0,
    optimalTargetDbm: -17.5,
    defaultWavelengthNm: 1577,
    description: '10-Gigabit symmetrical PON. 1577nm DFB receiver overloads at -7.0 dBm.'
  },
  XGSPON_CLASS_N2: {
    id: 'XGSPON_CLASS_N2',
    name: 'ITU-T G.9807.1 XGS-PON Class N2 (10G/10G High Budget)',
    category: 'Carrier-Grade 10G Metro',
    minSensitivityDbm: -29.0,
    maxOverloadDbm: -6.0,
    optimalTargetDbm: -17.5,
    defaultWavelengthNm: 1577,
    description: 'Carrier-grade enterprise 10G optical receiver. Saturation threshold at -6.0 dBm.'
  },
  EPON_1000BASE_PX20: {
    id: 'EPON_1000BASE_PX20',
    name: 'IEEE 802.3ah EPON 1000BASE-PX20+',
    category: 'Gigabit EPON Legacy',
    minSensitivityDbm: -26.0,
    maxOverloadDbm: -6.0,
    optimalTargetDbm: -16.0,
    defaultWavelengthNm: 1490,
    description: 'Legacy Gigabit EPON optical receiver with -6.0 dBm saturation limit.'
  }
};

export const ATTENUATOR_HARDWARE_TYPES = {
  NONE_DIRECT: {
    id: 'NONE_DIRECT',
    name: 'No Attenuator (Direct Patch Cord 0.0 dB)',
    attenuationDb: 0.0,
    type: 'NONE',
    returnLossDb: 60,
    connector: 'SC/APC or SC/UPC Direct',
    accuracyDb: 0.1,
    description: 'Direct straight-through patch cord without deliberate optical attenuation.'
  },
  FIXED_FOA_1DB: {
    id: 'FIXED_FOA_1DB',
    name: '1 dB Fixed Optical Attenuator (FOA Pad)',
    attenuationDb: 1.0,
    type: 'FIXED',
    returnLossDb: 55,
    connector: 'SC/APC Male-Female',
    accuracyDb: 0.3,
    description: 'Doped-fiber absorption pad for minor power trim.'
  },
  FIXED_FOA_2DB: {
    id: 'FIXED_FOA_2DB',
    name: '2 dB Fixed Optical Attenuator (FOA Pad)',
    attenuationDb: 2.0,
    type: 'FIXED',
    returnLossDb: 55,
    connector: 'SC/APC Male-Female',
    accuracyDb: 0.3,
    description: '2 dB precision pad for optical margin fine-tuning.'
  },
  FIXED_FOA_3DB: {
    id: 'FIXED_FOA_3DB',
    name: '3 dB Fixed Optical Attenuator (FOA Pad)',
    attenuationDb: 3.0,
    type: 'FIXED',
    returnLossDb: 55,
    connector: 'SC/APC Male-Female',
    accuracyDb: 0.4,
    description: 'Halves optical power (-3 dB). Standard for medium drops.'
  },
  FIXED_FOA_5DB: {
    id: 'FIXED_FOA_5DB',
    name: '5 dB Fixed Optical Attenuator (FOA Pad)',
    attenuationDb: 5.0,
    type: 'FIXED',
    returnLossDb: 55,
    connector: 'SC/APC Male-Female',
    accuracyDb: 0.5,
    description: 'Common plug-in pad for short subscriber drops.'
  },
  FIXED_FOA_7DB: {
    id: 'FIXED_FOA_7DB',
    name: '7 dB Fixed Optical Attenuator (FOA Pad)',
    attenuationDb: 7.0,
    type: 'FIXED',
    returnLossDb: 55,
    connector: 'SC/APC Male-Female',
    accuracyDb: 0.5,
    description: 'High-reduction pad for close-proximity OLT distribution.'
  },
  FIXED_FOA_10DB: {
    id: 'FIXED_FOA_10DB',
    name: '10 dB Fixed Optical Attenuator (FOA Pad)',
    attenuationDb: 10.0,
    type: 'FIXED',
    returnLossDb: 55,
    connector: 'SC/APC Male-Female',
    accuracyDb: 0.6,
    description: 'Reduces optical power to 10%. Essential for short runs next to central OLT.'
  },
  FIXED_FOA_15DB: {
    id: 'FIXED_FOA_15DB',
    name: '15 dB Fixed Optical Attenuator (FOA Pad)',
    attenuationDb: 15.0,
    type: 'FIXED',
    returnLossDb: 55,
    connector: 'SC/APC Male-Female',
    accuracyDb: 0.8,
    description: 'Very high attenuation pad for lab testing or direct EDFA booster monitoring.'
  },
  FIXED_FOA_20DB: {
    id: 'FIXED_FOA_20DB',
    name: '20 dB Fixed Optical Attenuator (FOA Pad)',
    attenuationDb: 20.0,
    type: 'FIXED',
    returnLossDb: 55,
    connector: 'SC/APC Male-Female',
    accuracyDb: 1.0,
    description: 'Drops optical power by 99% (-20 dB). Used for bench testing and extreme cases.'
  },
  VARIABLE_VOA_CONTINUOUS: {
    id: 'VARIABLE_VOA_CONTINUOUS',
    name: 'Variable Optical Attenuator (VOA - Micrometer 0-30 dB)',
    type: 'VARIABLE',
    returnLossDb: 50,
    connector: 'SC/UPC or SC/APC In-Line Dial',
    accuracyDb: 0.2,
    description: 'Continuous calibrated micrometer screw dial for precise dynamic target tuning.'
  }
};

export const ATTENUATOR_FIELD_PRESETS = {
  PRESET_CLOSE_CENTRAL_OLT: {
    id: 'PRESET_CLOSE_CENTRAL_OLT',
    name: 'Shahdara Central NOC Short Drop (< 120m)',
    onuClass: 'GPON_CLASS_B_PLUS',
    inputPowerDbm: -4.5,
    selectedAttenuatorId: 'FIXED_FOA_10DB',
    voaTunedDb: 10.0,
    location: 'Shahdara Town - Main Bazaar Commercial Node',
    notes: 'Short drop close to OLT port. Overdrive saturation relieved with 10 dB fixed pad.'
  },
  PRESET_VANDALA_MINI_OLT: {
    id: 'PRESET_VANDALA_MINI_OLT',
    name: 'Vandala Road Pole Mini-OLT Tap',
    onuClass: 'GPON_CLASS_B_PLUS',
    inputPowerDbm: -6.2,
    selectedAttenuatorId: 'FIXED_FOA_7DB',
    voaTunedDb: 7.0,
    location: 'Vandala Road - Street 3 pole tap',
    notes: 'High launch power at 1st-level splitter. 7 dB attenuation keeps Rx at safe -13.2 dBm.'
  },
  PRESET_KAM_INDUSTRIAL_XGSPON: {
    id: 'PRESET_KAM_INDUSTRIAL_XGSPON',
    name: 'Kot Abdul Malik 10G XGS-PON Enterprise Feeder',
    onuClass: 'XGSPON_CLASS_N1',
    inputPowerDbm: -5.0,
    selectedAttenuatorId: 'FIXED_FOA_5DB',
    voaTunedDb: 5.0,
    location: 'Kot Abdul Malik - Mill Area Factory #12',
    notes: '10G XGS-PON 1577nm laser. Installed 5 dB SC/APC pad; BER zero errors.'
  },
  PRESET_RAVI_REMOTE_DROP: {
    id: 'PRESET_RAVI_REMOTE_DROP',
    name: 'Ravi Siphon Remote Drop (Long-Span 3.8 km)',
    onuClass: 'GPON_CLASS_C_PLUS',
    inputPowerDbm: -24.5,
    selectedAttenuatorId: 'NONE_DIRECT',
    voaTunedDb: 0.0,
    location: 'Ravi Siphon - Riverside Farmhouse #4',
    notes: 'Weak optical signal due to distance. No attenuator pad needed; Rx inside sensitivity range.'
  },
  PRESET_LIVE_VOA_TUNING: {
    id: 'PRESET_LIVE_VOA_TUNING',
    name: 'Field Technician Continuous VOA Calibration',
    onuClass: 'GPON_CLASS_B_PLUS',
    inputPowerDbm: -3.8,
    selectedAttenuatorId: 'VARIABLE_VOA_CONTINUOUS',
    voaTunedDb: 12.5,
    location: 'Baradari Metro Loop - Distribution Box #7',
    notes: 'Tuned variable VOA micrometer screw to precisely 12.5 dB.'
  }
};

/**
 * Calculates optical receiver attenuation, overdrive risk, margins, and recommended pad.
 */
export function calculateAttenuationLoss(inputPowerDbm, onuClassKey = 'GPON_CLASS_B_PLUS', attenuatorId = 'NONE_DIRECT', voaTunedDb = 0.0) {
  const inPwr = Number(inputPowerDbm ?? -15.0);
  const safeInPwr = Number.isNaN(inPwr) ? -15.0 : Math.max(-50.0, Math.min(15.0, inPwr));

  const onuClass = ONU_RECEIVER_CLASSES[onuClassKey] || ONU_RECEIVER_CLASSES.GPON_CLASS_B_PLUS;
  const attObj = ATTENUATOR_HARDWARE_TYPES[attenuatorId] || ATTENUATOR_HARDWARE_TYPES.NONE_DIRECT;

  // Determine applied attenuation
  let appliedAttenuationDb = 0.0;
  if (attObj.type === 'VARIABLE') {
    const voaNum = Number(voaTunedDb ?? 0.0);
    appliedAttenuationDb = Number.isNaN(voaNum) ? 0.0 : Math.max(0.0, Math.min(30.0, Math.round(voaNum * 10) / 10));
  } else {
    appliedAttenuationDb = attObj.attenuationDb;
  }

  // Resulting received optical power at the ONU photodiode
  const rxPowerDbm = Math.round((safeInPwr - appliedAttenuationDb) * 10) / 10;

  // Overload margin: P_overload - P_rx. Positive means safe, negative means saturated/overdriven!
  const overloadMarginDb = Math.round((onuClass.maxOverloadDbm - rxPowerDbm) * 10) / 10;

  // Sensitivity margin: P_rx - P_sensitivity. Positive means above sensitivity, negative means under sensitivity
  const sensitivityMarginDb = Math.round((rxPowerDbm - onuClass.minSensitivityDbm) * 10) / 10;

  // Recommended ideal attenuation to hit optimalTargetDbm:
  // Required attenuation = inPwr - optimalTargetDbm
  const idealRawAttDb = safeInPwr - onuClass.optimalTargetDbm;
  const recommendedAttDb = Math.max(0.0, Math.round(idealRawAttDb * 10) / 10);

  // Find closest standard fixed pad recommendation
  let bestPadRecommendation = ATTENUATOR_HARDWARE_TYPES.NONE_DIRECT;
  if (recommendedAttDb > 0.5) {
    const fixedPads = Object.values(ATTENUATOR_HARDWARE_TYPES).filter(p => p.type === 'FIXED');
    let minDiff = Infinity;
    for (const pad of fixedPads) {
      const diff = Math.abs(pad.attenuationDb - recommendedAttDb);
      if (diff < minDiff) {
        minDiff = diff;
        bestPadRecommendation = pad;
      }
    }
  }

  // Compliance status & assessment
  let status = 'OPTIMAL';
  let statusLabel = 'OPTIMAL';
  let message = 'Optical power is safely within the receiver linear dynamic range.';

  if (rxPowerDbm > onuClass.maxOverloadDbm) {
    status = 'OVERDRIVE_CRITICAL';
    statusLabel = 'CRITICAL OVERDRIVE';
    message = `DANGER: Received power (${rxPowerDbm.toFixed(1)} dBm) exceeds overload threshold (${onuClass.maxOverloadDbm.toFixed(1)} dBm) by ${Math.abs(overloadMarginDb).toFixed(1)} dB! Photodiode saturation / burn-in hazard. Install ${recommendedAttDb.toFixed(1)} dB attenuator immediately.`;
  } else if (rxPowerDbm < onuClass.minSensitivityDbm) {
    status = 'UNDER_SENSITIVITY';
    statusLabel = 'UNDER-POWER';
    message = `Received power (${rxPowerDbm.toFixed(1)} dBm) is below receiver sensitivity limit (${onuClass.minSensitivityDbm.toFixed(1)} dBm). Optical link loss too high; reduce or remove attenuation.`;
  } else if (overloadMarginDb < 3.0) {
    status = 'NEAR_OVERLOAD';
    statusLabel = 'NEAR SATURATION';
    message = `Caution: Optical power (${rxPowerDbm.toFixed(1)} dBm) is within 3 dB of receiver overload (${onuClass.maxOverloadDbm.toFixed(1)} dBm). Add a 2 dB or 3 dB pad for safety buffer.`;
  } else if (sensitivityMarginDb < 3.0) {
    status = 'NEAR_SENSITIVITY';
    statusLabel = 'LOW MARGIN';
    message = `Caution: Optical power (${rxPowerDbm.toFixed(1)} dBm) is within 3 dB of receiver sensitivity limit (${onuClass.minSensitivityDbm.toFixed(1)} dBm). Optical headroom is narrow.`;
  }

  return {
    inputPowerDbm: safeInPwr,
    onuClass,
    attenuator: attObj,
    appliedAttenuationDb,
    rxPowerDbm,
    overloadMarginDb,
    sensitivityMarginDb,
    recommendedAttDb,
    bestPadRecommendation,
    status,
    statusLabel,
    message
  };
}

/**
 * Pure offline SVG visualization of Optical Power Ingress, Attenuator Pad, and Receiver Dynamic Range Gauge.
 */
export function renderMobileAttenuatorSvg(calcResult, options = {}) {
  const width = options.width || 720;
  const height = options.height || 260;

  const res = calcResult;
  const onu = res.onuClass;
  const statusColor = res.status === 'OPTIMAL' ? '#10b981'
    : (res.status === 'NEAR_OVERLOAD' || res.status === 'NEAR_SENSITIVITY') ? '#f59e0b' : '#ef4444';

  // Dynamic Range Scale Parameters (Sensitivity to Overload + 5dB headroom)
  const minScaleDbm = onu.minSensitivityDbm - 4.0; // e.g. -31 dBm
  const maxScaleDbm = onu.maxOverloadDbm + 6.0; // e.g. -2 dBm
  const scaleSpan = maxScaleDbm - minScaleDbm;

  const barX = 70;
  const barY = 165;
  const barW = width - 140;
  const barH = 26;

  const getBarX = pDbm => {
    const clamped = Math.max(minScaleDbm, Math.min(maxScaleDbm, pDbm));
    return barX + ((clamped - minScaleDbm) / scaleSpan) * barW;
  };

  const sensX = getBarX(onu.minSensitivityDbm);
  const overX = getBarX(onu.maxOverloadDbm);
  const optX = getBarX(onu.optimalTargetDbm);
  const rxX = getBarX(res.rxPowerDbm);

  // Ingress & Attenuator Diagram Layout (Top section)
  const dropStartX = 70;
  const padX = width / 2 - 45;
  const padW = 90;
  const padH = 44;
  const padY = 55;
  const ontX = width - 110;
  const ontY = 55;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="attenuator-svg" style="width:100%;height:auto;background:var(--bg-card,#ffffff);border-radius:10px;font-family:Manrope,system-ui,sans-serif;">
      <!-- Title & Status Header -->
      <text x="30" y="28" fill="var(--ink,#182e2a)" font-size="13" font-weight="700">
        Optical Attenuation &amp; Receiver Protection: ${onu.name}
      </text>
      <rect x="${width - 160}" y="12" width="130" height="22" rx="4" fill="${statusColor}22" stroke="${statusColor}" stroke-width="1"/>
      <text x="${width - 95}" y="27" fill="${statusColor}" font-size="10.5" font-weight="700" text-anchor="middle">
        ${res.statusLabel}
      </text>

      <!-- Optical Drop Fiber Line -->
      <line x1="${dropStartX}" y1="${padY + padH / 2}" x2="${padX}" y2="${padY + padH / 2}" stroke="#38bdf8" stroke-width="3"/>
      <circle cx="${dropStartX}" cy="${padY + padH / 2}" r="5" fill="#0284c7"/>
      <text x="${dropStartX}" y="${padY + padH / 2 - 10}" fill="var(--muted,#60756c)" font-size="10" font-weight="700">
        DROP IN: ${res.inputPowerDbm.toFixed(1)} dBm
      </text>

      <!-- Attenuator Pad Module -->
      <rect x="${padX}" y="${padY}" width="${padW}" height="${padH}" rx="6" fill="var(--bg-soft,#f1f5f9)" stroke="${res.appliedAttenuationDb > 0 ? '#38bdf8' : 'var(--line,#cbd5e1)'}" stroke-width="2"/>
      <!-- Internal Absorption Filter Symbol -->
      <line x1="${padX + 25}" y1="${padY + 10}" x2="${padX + 25}" y2="${padY + padH - 10}" stroke="#64748b" stroke-width="2"/>
      <line x1="${padX + 45}" y1="${padY + 8}" x2="${padX + 45}" y2="${padY + padH - 8}" stroke="#f59e0b" stroke-width="2.5"/>
      <line x1="${padX + 65}" y1="${padY + 10}" x2="${padX + 65}" y2="${padY + padH - 10}" stroke="#64748b" stroke-width="2"/>
      <text x="${padX + padW / 2}" y="${padY + padH + 16}" fill="var(--ink,#182e2a)" font-size="10.5" font-weight="700" text-anchor="middle">
        ${res.appliedAttenuationDb > 0 ? `-${res.appliedAttenuationDb.toFixed(1)} dB Pad` : '0.0 dB (Direct)'}
      </text>

      <!-- Connecting Patch Cord to ONT -->
      <line x1="${padX + padW}" y1="${padY + padH / 2}" x2="${ontX}" y2="${padY + padH / 2}" stroke="${statusColor}" stroke-width="3"/>

      <!-- ONT / Photodiode Receiver Box -->
      <rect x="${ontX}" y="${ontY}" width="80" height="${padH}" rx="6" fill="#0f172a" stroke="${statusColor}" stroke-width="2"/>
      <!-- Photodiode Symbol -->
      <polygon points="${ontX + 25},${ontY + 12} ${ontX + 55},${ontY + 22} ${ontX + 25},${ontY + 32}" fill="#38bdf8"/>
      <line x1="${ontX + 55}" y1="${ontY + 10}" x2="${ontX + 55}" y2="${ontY + 34}" stroke="#ffffff" stroke-width="2"/>
      <text x="${ontX + 40}" y="${ontY + padH + 16}" fill="${statusColor}" font-size="10.5" font-weight="700" text-anchor="middle">
        Rx: ${res.rxPowerDbm.toFixed(1)} dBm
      </text>

      <!-- Receiver Dynamic Range Scale Bar -->
      <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="6" fill="var(--bg-soft,#f1f5f9)" stroke="var(--line,#e2ece7)"/>

      <!-- Linear Operating Window (Sensitivity to Overload) -->
      <rect x="${sensX}" y="${barY}" width="${Math.max(1, overX - sensX)}" height="${barH}" fill="rgba(16, 185, 129, 0.25)" stroke="#10b981" stroke-width="1.2"/>

      <!-- Overload / Saturation Zone (Red) -->
      <rect x="${overX}" y="${barY}" width="${barX + barW - overX}" height="${barH}" fill="rgba(239, 68, 68, 0.3)" stroke="#ef4444" stroke-width="1.2"/>

      <!-- Marker: Optimal Target Indicator -->
      <line x1="${optX}" y1="${barY - 4}" x2="${optX}" y2="${barY + barH + 4}" stroke="#0284c7" stroke-width="2" stroke-dasharray="2,2"/>
      <text x="${optX}" y="${barY - 7}" fill="#0284c7" font-size="9" font-weight="700" text-anchor="middle">TARGET: ${onu.optimalTargetDbm} dBm</text>

      <!-- Marker: Max Overload Threshold -->
      <line x1="${overX}" y1="${barY - 4}" x2="${overX}" y2="${barY + barH + 4}" stroke="#ef4444" stroke-width="2"/>
      <text x="${overX}" y="${barY + barH + 16}" fill="#ef4444" font-size="9.5" font-weight="700" text-anchor="middle">OVERLOAD: ${onu.maxOverloadDbm} dBm</text>

      <!-- Marker: Min Sensitivity Threshold -->
      <line x1="${sensX}" y1="${barY - 4}" x2="${sensX}" y2="${barY + barH + 4}" stroke="#10b981" stroke-width="2"/>
      <text x="${sensX}" y="${barY + barH + 16}" fill="#10b981" font-size="9.5" font-weight="700" text-anchor="middle">SENSITIVITY: ${onu.minSensitivityDbm} dBm</text>

      <!-- Active Rx Pointer Needle -->
      <polygon points="${rxX},${barY + barH / 2 - 8} ${rxX + 7},${barY + barH / 2 + 10} ${rxX - 7},${barY + barH / 2 + 10}" fill="${statusColor}" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="${rxX}" cy="${barY + barH / 2}" r="5" fill="${statusColor}" stroke="#ffffff" stroke-width="1.5"/>

      <!-- Bottom Info Line -->
      <text x="${barX}" y="${height - 12}" fill="var(--muted,#60756c)" font-size="10.5">
        Overload Margin: <tspan font-weight="700" fill="${res.overloadMarginDb < 0 ? '#ef4444' : '#10b981'}">${res.overloadMarginDb >= 0 ? '+' : ''}${res.overloadMarginDb.toFixed(1)} dB</tspan> &bull;
        Sensitivity Margin: <tspan font-weight="700">${res.sensitivityMarginDb >= 0 ? '+' : ''}${res.sensitivityMarginDb.toFixed(1)} dB</tspan> &bull;
        Recommended Pad: <tspan font-weight="700" fill="#0284c7">${res.bestPadRecommendation.name}</tspan>
      </text>
    </svg>
  `;
}

/**
 * Storage helpers for field audit history
 */
export function getDefaultAttenuatorAudits() {
  return [
    {
      id: 'att-audit-101',
      timestamp: '2026-10-16T18:40:00+05:00',
      location: 'Shahdara Town - Main Bazaar Commercial Node',
      technician: 'Imran Lineman',
      onuClass: 'GPON_CLASS_B_PLUS',
      inputPowerDbm: -4.5,
      attenuatorId: 'FIXED_FOA_10DB',
      appliedAttenuationDb: 10.0,
      rxPowerDbm: -14.5,
      status: 'OPTIMAL',
      notes: 'Installed 10 dB fixed pad. Overdrive saturation relieved; BER clean.'
    },
    {
      id: 'att-audit-102',
      timestamp: '2026-10-16T21:15:00+05:00',
      location: 'Kot Abdul Malik - Mill Area Factory #12',
      technician: 'Tariq Field Engineer',
      onuClass: 'XGSPON_CLASS_N1',
      inputPowerDbm: -5.0,
      attenuatorId: 'FIXED_FOA_5DB',
      appliedAttenuationDb: 5.0,
      rxPowerDbm: -10.0,
      status: 'OPTIMAL',
      notes: '10G XGS-PON enterprise fiber drop. 5 dB pad applied; frame sync 100% stable.'
    }
  ];
}

export function getAttenuatorStore(storage) {
  if (!storage) return getDefaultAttenuatorAudits();
  try {
    const raw = storage.getItem(OPTICAL_ATTENUATOR_STORAGE_KEY);
    if (!raw) {
      const initial = getDefaultAttenuatorAudits();
      saveAttenuatorStore(initial, storage);
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : getDefaultAttenuatorAudits();
  } catch (e) {
    return getDefaultAttenuatorAudits();
  }
}

export function saveAttenuatorStore(audits, storage) {
  if (!storage) return;
  try {
    storage.setItem(OPTICAL_ATTENUATOR_STORAGE_KEY, JSON.stringify(audits));
  } catch (e) {
    // quota error fallback
  }
}

export function recordAttenuatorAudit(entry, storage) {
  const current = getAttenuatorStore(storage);
  const newAudit = {
    id: `att-audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...entry
  };
  const updated = [newAudit, ...current].slice(0, 30);
  saveAttenuatorStore(updated, storage);
  return updated;
}

export function clearAttenuatorStore(storage) {
  return saveAttenuatorStore([], storage);
}

/**
 * Generates formatted WhatsApp dispatch report for field technicians.
 */
export function generateAttenuatorWhatsAppReport(audit) {
  return `*SHAHDARA ISP - OPTICAL ATTENUATION FIELD AUDIT*
----------------------------------------
*Location:* ${audit.location || 'Shahdara Field Span'}
*Lineman:* ${audit.technician || 'On-Duty Tech'}
*Date:* ${audit.timestamp ? new Date(audit.timestamp).toLocaleString() : new Date().toLocaleString()}

*OPTICAL POWER READINGS*
- *Input Power (Drop In):* ${audit.inputPowerDbm.toFixed(1)} dBm
- *Attenuator Applied:* ${audit.appliedAttenuationDb.toFixed(1)} dB (${audit.attenuatorName || 'Pad'})
- *Receiver Power (Rx):* ${audit.rxPowerDbm.toFixed(1)} dBm
- *Receiver Class:* ${audit.onuClassName || 'GPON Class B+'}
- *Verdict:* ${audit.status === 'OPTIMAL' ? 'PASS - OPTIMAL' : audit.status}

*TECH OBSERVATIONS:*
${audit.notes || 'Optical receiver levels calibrated within linear dynamic range.'}
----------------------------------------
_Verified via Shahdara ISP Mobile Field Assistant_`;
}

/**
 * Initializes and wires the mobile optical attenuator modal dialog and triggers.
 */
export function setupMobileAttenuatorModal(options = {}) {
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const onToast = options.onToast || (() => {});
  const clipboard = options.clipboard;

  const modal = document.getElementById('mobileAttenuatorModal');
  const closeBtn = document.getElementById('mobileAttenuatorCloseBtn');

  // Trigger buttons across mobile surfaces
  const drawerBtn = document.getElementById('navAttenuatorBtn');
  const speedDialBtn = document.querySelector('[data-open-attenuator]');
  const actionSheetBtn = document.querySelector('[data-action-attenuator]');

  // Inputs
  const presetSelect = document.getElementById('attenuatorPresetSelect');
  const onuClassSelect = document.getElementById('attenuatorOnuClassSelect');
  const inputPowerField = document.getElementById('attenuatorInputPower');
  const padSelect = document.getElementById('attenuatorPadSelect');
  const voaGroup = document.getElementById('attenuatorVoaGroup');
  const voaSlider = document.getElementById('attenuatorVoaSlider');
  const voaVal = document.getElementById('attenuatorVoaVal');

  // KPI elements
  const kpiRx = document.getElementById('attenuatorKpiRx');
  const kpiOverloadMargin = document.getElementById('attenuatorKpiOverloadMargin');
  const kpiSensitivityMargin = document.getElementById('attenuatorKpiSensitivityMargin');
  const kpiRecommended = document.getElementById('attenuatorKpiRecommended');
  const kpiStatus = document.getElementById('attenuatorKpiStatus');

  const svgWrap = document.getElementById('attenuatorSvgWrap');
  const remediationText = document.getElementById('attenuatorRemediationText');

  // Form audit meta
  const locationInput = document.getElementById('attenuatorLocationInput');
  const techInput = document.getElementById('attenuatorTechInput');
  const notesInput = document.getElementById('attenuatorNotesInput');
  const saveBtn = document.getElementById('attenuatorSaveBtn');
  const whatsappBtn = document.getElementById('attenuatorWhatsappBtn');
  const clearHistoryBtn = document.getElementById('attenuatorClearHistoryBtn');
  const historyList = document.getElementById('attenuatorHistoryList');

  function getCurrentCalc() {
    const inPwr = inputPowerField ? Number(inputPowerField.value) : -15.0;
    const onuClassKey = onuClassSelect ? onuClassSelect.value : 'GPON_CLASS_B_PLUS';
    const attId = padSelect ? padSelect.value : 'NONE_DIRECT';
    const voaDb = voaSlider ? Number(voaSlider.value) : 0.0;
    return calculateAttenuationLoss(inPwr, onuClassKey, attId, voaDb);
  }

  function renderView() {
    const res = getCurrentCalc();

    // Toggle VOA slider visibility
    if (voaGroup) {
      voaGroup.style.display = res.attenuator.type === 'VARIABLE' ? 'block' : 'none';
    }
    if (voaVal && voaSlider) {
      voaVal.textContent = `${Number(voaSlider.value).toFixed(1)} dB`;
    }

    if (kpiRx) {
      kpiRx.textContent = `${res.rxPowerDbm.toFixed(1)} dBm`;
      kpiRx.style.color = res.status === 'OPTIMAL' ? '#10b981' : (res.status === 'NEAR_OVERLOAD' || res.status === 'NEAR_SENSITIVITY') ? '#f59e0b' : '#ef4444';
    }
    if (kpiOverloadMargin) {
      kpiOverloadMargin.textContent = `${res.overloadMarginDb >= 0 ? '+' : ''}${res.overloadMarginDb.toFixed(1)} dB`;
      kpiOverloadMargin.style.color = res.overloadMarginDb < 0 ? '#ef4444' : '#10b981';
    }
    if (kpiSensitivityMargin) {
      kpiSensitivityMargin.textContent = `${res.sensitivityMarginDb >= 0 ? '+' : ''}${res.sensitivityMarginDb.toFixed(1)} dB`;
    }
    if (kpiRecommended) {
      kpiRecommended.textContent = `${res.recommendedAttDb.toFixed(1)} dB (${res.bestPadRecommendation.name.split(' ')[0]} ${res.bestPadRecommendation.name.split(' ')[1] || ''})`;
    }
    if (kpiStatus) {
      kpiStatus.textContent = res.statusLabel;
      kpiStatus.style.color = res.status === 'OPTIMAL' ? '#10b981' : (res.status === 'NEAR_OVERLOAD' || res.status === 'NEAR_SENSITIVITY') ? '#f59e0b' : '#ef4444';
    }

    if (remediationText) {
      remediationText.textContent = res.message;
      remediationText.style.borderColor = res.status === 'OPTIMAL' ? 'rgba(16, 185, 129, 0.3)' : (res.status === 'NEAR_OVERLOAD' || res.status === 'NEAR_SENSITIVITY') ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)';
      remediationText.style.background = res.status === 'OPTIMAL' ? 'rgba(16, 185, 129, 0.1)' : (res.status === 'NEAR_OVERLOAD' || res.status === 'NEAR_SENSITIVITY') ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)';
      remediationText.style.color = res.status === 'OPTIMAL' ? '#10b981' : (res.status === 'NEAR_OVERLOAD' || res.status === 'NEAR_SENSITIVITY') ? '#f59e0b' : '#ef4444';
    }

    if (svgWrap) {
      svgWrap.innerHTML = renderMobileAttenuatorSvg(res);
    }

    renderHistory();
  }

  function renderHistory() {
    if (!historyList) return;
    const items = getAttenuatorStore(storage);
    if (items.length === 0) {
      historyList.innerHTML = '<li class="probe-history-item empty" style="color:var(--muted);font-size:12px;padding:8px">No optical attenuation audits recorded yet.</li>';
      return;
    }
    historyList.innerHTML = items.map(item => `
      <li class="probe-history-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid var(--line);font-size:12px;">
        <div>
          <div style="font-weight:700;color:var(--ink)">${item.location || 'Shahdara Drop'} &bull; <span style="color:#0284c7">${item.appliedAttenuationDb} dB Pad</span></div>
          <div style="color:var(--muted);font-size:11px">${item.technician || 'Lineman'} &bull; In: ${item.inputPowerDbm} dBm &rarr; Rx: ${item.rxPowerDbm} dBm</div>
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
      const preset = ATTENUATOR_FIELD_PRESETS[pKey];
      if (preset) {
        if (onuClassSelect) onuClassSelect.value = preset.onuClass;
        if (inputPowerField) inputPowerField.value = preset.inputPowerDbm;
        if (padSelect) padSelect.value = preset.selectedAttenuatorId;
        if (voaSlider) voaSlider.value = preset.voaTunedDb;
        if (locationInput) locationInput.value = preset.location;
        if (notesInput) notesInput.value = preset.notes;
        renderView();
        onToast(`Loaded preset: ${preset.name}`);
      }
    };
  }

  // Interactive controls
  [onuClassSelect, padSelect].forEach(el => {
    if (el) el.onchange = renderView;
  });

  if (inputPowerField) {
    inputPowerField.oninput = renderView;
  }

  if (voaSlider) {
    voaSlider.oninput = () => {
      if (voaVal) voaVal.textContent = `${Number(voaSlider.value).toFixed(1)} dB`;
      renderView();
    };
  }

  // Audit actions
  if (saveBtn) {
    saveBtn.onclick = () => {
      const calc = getCurrentCalc();
      const audit = {
        location: locationInput?.value?.trim() || 'Shahdara Drop',
        technician: techInput?.value?.trim() || 'Field Lineman',
        onuClass: calc.onuClass.id,
        onuClassName: calc.onuClass.name,
        inputPowerDbm: calc.inputPowerDbm,
        attenuatorId: calc.attenuator.id,
        attenuatorName: calc.attenuator.name,
        appliedAttenuationDb: calc.appliedAttenuationDb,
        rxPowerDbm: calc.rxPowerDbm,
        status: calc.status,
        notes: notesInput?.value?.trim() || calc.message
      };
      recordAttenuatorAudit(audit, storage);
      renderHistory();
      onToast('Optical attenuation audit saved to device!');
    };
  }

  if (whatsappBtn) {
    whatsappBtn.onclick = async () => {
      const calc = getCurrentCalc();
      const audit = {
        location: locationInput?.value?.trim() || 'Shahdara Drop',
        technician: techInput?.value?.trim() || 'Field Lineman',
        onuClassName: calc.onuClass.name,
        inputPowerDbm: calc.inputPowerDbm,
        attenuatorName: calc.attenuator.name,
        appliedAttenuationDb: calc.appliedAttenuationDb,
        rxPowerDbm: calc.rxPowerDbm,
        status: calc.status,
        notes: notesInput?.value?.trim() || calc.message
      };
      const text = generateAttenuatorWhatsAppReport(audit);
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
      clearAttenuatorStore(storage);
      renderHistory();
      onToast('Attenuation audit history cleared.');
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

  // Initial draw
  renderView();

  return {
    open: openModal,
    close: closeModal,
    render: renderView
  };
}
