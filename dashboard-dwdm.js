import { formatPKR } from './core.js';

/**
 * Dense Wavelength Division Multiplexing (DWDM) Optical Channel Transponder OSNR Budget
 * Models Shahdara ISP C-Band ITU-T 100GHz grid optical channels (Ch 21 - Ch 56),
 * Coherent CFP2-DCO / QSFP-DD transponders, EDFA optical amplification with Amplified Spontaneous
 * Emission (ASE) noise, fiber attenuation (dB/km), optical signal-to-noise ratio (OSNR dB),
 * Soft-Decision Forward Error Correction (SD-FEC) threshold & margin, Chromatic Dispersion (CD),
 * and aggregate subscriber traffic & dues at risk from transponder degradation.
 */

export const SHAHDARA_DWDM_CHANNELS = [
  {
    id: 'dwdm-ch-21',
    channelNumber: 21,
    frequencyThz: 192.1,
    wavelengthNm: 1560.61,
    name: 'Ch 21 (192.1 THz / 1560.61nm) - Shahdara Core Transit',
    transponderModel: 'Cisco CFP2-DCO 100G/200G Coherent',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    bitrateGbps: 100,
    modulation: 'DP-QPSK',
    baseLaunchPowerDbm: 2.0,
    spanLengthKm: 28.5,
    baseFiberLossDbPerKm: 0.22,
    baseEdfaNfDb: 5.2,
    baseSpansCount: 2,
    sdFecThresholdDb: 12.8,
    dispersionTolerancePsPerNm: 24000,
    opticalBandwidthGhz: 50
  },
  {
    id: 'dwdm-ch-28',
    channelNumber: 28,
    frequencyThz: 192.8,
    wavelengthNm: 1555.05,
    name: 'Ch 28 (192.8 THz / 1555.05nm) - Baradari Industrial Trunk',
    transponderModel: 'Huawei CFP2-DCO 200G 16QAM',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    bitrateGbps: 200,
    modulation: 'DP-16QAM',
    baseLaunchPowerDbm: 3.0,
    spanLengthKm: 22.0,
    baseFiberLossDbPerKm: 0.23,
    baseEdfaNfDb: 5.4,
    baseSpansCount: 2,
    sdFecThresholdDb: 14.5,
    dispersionTolerancePsPerNm: 20000,
    opticalBandwidthGhz: 50
  },
  {
    id: 'dwdm-ch-35',
    channelNumber: 35,
    frequencyThz: 193.5,
    wavelengthNm: 1549.32,
    name: 'Ch 35 (193.5 THz / 1549.32nm) - Vandala West Backhaul',
    transponderModel: 'Infinera Groove QSFP-DD 100G',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    bitrateGbps: 100,
    modulation: 'DP-QPSK',
    baseLaunchPowerDbm: 2.5,
    spanLengthKm: 34.0,
    baseFiberLossDbPerKm: 0.21,
    baseEdfaNfDb: 5.0,
    baseSpansCount: 3,
    sdFecThresholdDb: 12.5,
    dispersionTolerancePsPerNm: 28000,
    opticalBandwidthGhz: 50
  },
  {
    id: 'dwdm-ch-42',
    channelNumber: 42,
    frequencyThz: 194.2,
    wavelengthNm: 1543.73,
    name: 'Ch 42 (194.2 THz / 1543.73nm) - Jia Musa Metro Ring',
    transponderModel: 'Ciena WaveLogic 5 Nano 100G',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    bitrateGbps: 100,
    modulation: 'DP-QPSK',
    baseLaunchPowerDbm: 2.0,
    spanLengthKm: 18.5,
    baseFiberLossDbPerKm: 0.24,
    baseEdfaNfDb: 5.5,
    baseSpansCount: 1,
    sdFecThresholdDb: 12.5,
    dispersionTolerancePsPerNm: 18000,
    opticalBandwidthGhz: 50
  },
  {
    id: 'dwdm-ch-49',
    channelNumber: 49,
    frequencyThz: 194.9,
    wavelengthNm: 1538.19,
    name: 'Ch 49 (194.9 THz / 1538.19nm) - Saeed Park Distribution',
    transponderModel: 'ZTE ZXONE 100G Transponder',
    primaryArea: 'Saeed Park',
    aliasAreas: ['Saeed Park', 'Rehman Park'],
    bitrateGbps: 100,
    modulation: 'DP-QPSK',
    baseLaunchPowerDbm: 1.5,
    spanLengthKm: 15.0,
    baseFiberLossDbPerKm: 0.25,
    baseEdfaNfDb: 5.6,
    baseSpansCount: 1,
    sdFecThresholdDb: 12.8,
    dispersionTolerancePsPerNm: 15000,
    opticalBandwidthGhz: 50
  },
  {
    id: 'dwdm-ch-56',
    channelNumber: 56,
    frequencyThz: 195.6,
    wavelengthNm: 1532.68,
    name: 'Ch 56 (195.6 THz / 1532.68nm) - Begum Kot Interconnect',
    transponderModel: 'Cisco CFP2-DCO 200G 16QAM',
    primaryArea: 'Begum Kot',
    aliasAreas: ['Begum Kot', 'Kot Abdul Malik Road'],
    bitrateGbps: 200,
    modulation: 'DP-16QAM',
    baseLaunchPowerDbm: 3.5,
    spanLengthKm: 31.0,
    baseFiberLossDbPerKm: 0.23,
    baseEdfaNfDb: 5.8,
    baseSpansCount: 2,
    sdFecThresholdDb: 14.8,
    dispersionTolerancePsPerNm: 22000,
    opticalBandwidthGhz: 50
  }
];

export const DWDM_CONSTANTS = {
  PLANCK_H: 6.626e-34,
  LIGHT_SPEED_C: 3e8,
  REF_BW_0_1_NM_HZ: 12.5e9, // 12.5 GHz equivalent optical bandwidth for 0.1nm at 1550nm
  STANDARD_CHROMATIC_DISPERSION_PS_PER_NM_KM: 17.0, // G.652 standard single mode fiber
  CONNECTOR_LOSS_PER_SPAN_DB: 0.75, // Patch panel / connector insertion loss per span
  OPTIMAL_MARGIN_MIN_DB: 3.0,
  MARGINAL_MARGIN_MIN_DB: 1.0,
  DEFAULT_SELECTED_CHANNEL: 'dwdm-ch-21'
};

// Simulation State
let simSelectedChannelId = DWDM_CONSTANTS.DEFAULT_SELECTED_CHANNEL;
let simFiberLossCoeff = null; // null = use channel default (dB/km)
let simEdfaNoiseFigure = null; // null = use channel default (dB)
let simSpanCount = null; // null = use channel default

export function getDwdmSelectedChannel() {
  return simSelectedChannelId;
}

export function setDwdmSelectedChannel(channelId) {
  const found = SHAHDARA_DWDM_CHANNELS.find(c => c.id === channelId);
  if (found) {
    simSelectedChannelId = channelId;
  }
  return simSelectedChannelId;
}

export function getDwdmFiberLossCoeff() {
  return simFiberLossCoeff;
}

export function setDwdmFiberLossCoeff(loss) {
  if (loss === null) {
    simFiberLossCoeff = null;
  } else {
    const num = Number(loss);
    simFiberLossCoeff = Math.max(0.18, Math.min(0.45, Number.isNaN(num) ? 0.22 : num));
  }
  return simFiberLossCoeff;
}

export function getDwdmEdfaNoiseFigure() {
  return simEdfaNoiseFigure;
}

export function setDwdmEdfaNoiseFigure(nf) {
  if (nf === null) {
    simEdfaNoiseFigure = null;
  } else {
    const num = Number(nf);
    simEdfaNoiseFigure = Math.max(3.5, Math.min(9.5, Number.isNaN(num) ? 5.2 : num));
  }
  return simEdfaNoiseFigure;
}

export function getDwdmSpanCount() {
  return simSpanCount;
}

export function setDwdmSpanCount(spans) {
  if (spans === null) {
    simSpanCount = null;
  } else {
    const num = Number(spans);
    simSpanCount = Math.max(1, Math.min(6, Math.round(Number.isNaN(num) ? 2 : num)));
  }
  return simSpanCount;
}


export function resetDwdmSimState() {
  simSelectedChannelId = DWDM_CONSTANTS.DEFAULT_SELECTED_CHANNEL;
  simFiberLossCoeff = null;
  simEdfaNoiseFigure = null;
  simSpanCount = null;
}

/**
 * Calculates Optical Signal-to-Noise Ratio (OSNR) budget in 0.1nm reference bandwidth across optical spans.
 * Standard ITU-T / EDFA ASE equation:
 * OSNR (dB) = P_in - Span_Loss - NF + 58 - 10*log10(N_spans)
 * where 58 dBm is roughly 10*log10(1mW / (h * nu * delta_nu_0.1nm)) at 1550nm (~ -58 dBm ASE per unit gain).
 */
export function calculateOsnrBudget(launchPowerDbm, spanLossDb, edfaNfDb, spansCount, options = {}) {
  const pIn = Number(launchPowerDbm) || 2.0;
  const loss = Number(spanLossDb) || 6.5;
  const nf = Number(edfaNfDb) || 5.2;
  const spans = Math.max(1, Number(spansCount) || 1);
  const fecThreshold = Number(options.sdFecThresholdDb) || 12.8;

  // Single span OSNR in 0.1nm bandwidth
  // OSNR_1 = P_in - loss - NF + 58.0
  const singleSpanOsnrDb = pIn - loss - nf + 58.0;

  // Total accumulated OSNR over N identical spans with cascaded ASE noise:
  // 10*log10(spans) degradation
  const accumulatedOsnrDb = singleSpanOsnrDb - (10 * Math.log10(spans));

  // Received optical power after final span and booster/in-line gain
  const rxPowerDbm = pIn - (loss * 0.15); // Compensated by AGC in-line amplifiers to ~ -1 to +1 dBm

  // Margin above Soft-Decision FEC limit
  const fecMarginDb = accumulatedOsnrDb - fecThreshold;

  let healthTier = 'OPTIMAL';
  let healthClass = 'badge-success';
  if (fecMarginDb < DWDM_CONSTANTS.MARGINAL_MARGIN_MIN_DB) {
    healthTier = 'CRITICAL (BER EXCEEDED)';
    healthClass = 'badge-danger';
  } else if (fecMarginDb < DWDM_CONSTANTS.OPTIMAL_MARGIN_MIN_DB) {
    healthTier = 'MARGINAL (FEC ACTIVE)';
    healthClass = 'badge-warning';
  }

  // Pre-FEC Bit Error Rate estimation based on OSNR margin
  let preFecBer = 1e-7;
  if (fecMarginDb <= 0) {
    preFecBer = 3.8e-2; // Uncorrectable SD-FEC limit
  } else if (fecMarginDb < 1.0) {
    preFecBer = 1.2e-2;
  } else if (fecMarginDb < 2.0) {
    preFecBer = 4.5e-3;
  } else if (fecMarginDb < 3.0) {
    preFecBer = 8.0e-4;
  } else if (fecMarginDb < 5.0) {
    preFecBer = 2.4e-5;
  }

  return {
    launchPowerDbm: pIn,
    spanLossDb: Math.round(loss * 10) / 10,
    edfaNfDb: nf,
    spansCount: spans,
    singleSpanOsnrDb: Math.round(singleSpanOsnrDb * 10) / 10,
    accumulatedOsnrDb: Math.round(accumulatedOsnrDb * 10) / 10,
    rxPowerDbm: Math.round(rxPowerDbm * 10) / 10,
    sdFecThresholdDb: fecThreshold,
    fecMarginDb: Math.round(fecMarginDb * 10) / 10,
    healthTier,
    healthClass,
    preFecBer
  };
}

/**
 * Calculates DWDM metrics across Shahdara customer base and active transponder channels.
 */
export function calculateDwdmMetrics(state, options = {}) {
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const selectedId = options.selectedChannelId || simSelectedChannelId;
  const simLoss = (simFiberLossCoeff !== null) ? simFiberLossCoeff : null;
  const simNf = (simEdfaNoiseFigure !== null) ? simEdfaNoiseFigure : null;
  const simSpans = (simSpanCount !== null) ? simSpanCount : null;

  const channels = SHAHDARA_DWDM_CHANNELS.map(ch => {
    const isSelected = ch.id === selectedId;
    const lossCoeff = (isSelected && simLoss !== null) ? simLoss : ch.baseFiberLossDbPerKm;
    const nf = (isSelected && simNf !== null) ? simNf : ch.baseEdfaNfDb;
    const spans = (isSelected && simSpans !== null) ? simSpans : ch.baseSpansCount;

    // Span loss = (lossCoeff * spanLengthKm) + connector loss
    const spanLossDb = (lossCoeff * ch.spanLengthKm) + DWDM_CONSTANTS.CONNECTOR_LOSS_PER_SPAN_DB;

    const budget = calculateOsnrBudget(ch.baseLaunchPowerDbm, spanLossDb, nf, spans, {
      sdFecThresholdDb: ch.sdFecThresholdDb
    });

    // Chromatic dispersion accumulated over total route
    const totalDistanceKm = ch.spanLengthKm * spans;
    const accumulatedCdPsPerNm = Math.round(totalDistanceKm * DWDM_CONSTANTS.STANDARD_CHROMATIC_DISPERSION_PS_PER_NM_KM);
    const cdCompensationPct = Math.min(100, Math.round((accumulatedCdPsPerNm / ch.dispersionTolerancePsPerNm) * 100));

    // Linked subscribers matching channel primary & alias areas
    const areaSet = new Set([ch.primaryArea, ...(ch.aliasAreas || [])].map(a => a.toLowerCase().trim()));
    let linkedSubscribers = 0;
    let activeSubscribers = 0;
    let monthlyRevenue = 0;
    let duesAtRisk = 0;

    for (const c of customers) {
      if (c.archived) continue;
      const cArea = (c.area || '').toLowerCase().trim();
      const match = areaSet.has(cArea) || Array.from(areaSet).some(a => cArea.includes(a) || a.includes(cArea));
      if (match) {
        linkedSubscribers++;
        const isActive = c.status === 'Active' || !c.status;
        if (isActive) activeSubscribers++;

        const bills = Array.isArray(c.bills) ? c.bills : [];
        for (const b of bills) {
          const amt = Number(b.dueAmount) || Number(b.amount) || 0;
          duesAtRisk += amt;
        }

        const pkgPrice = Number(c.packagePrice) || Number(c.monthlyFee) || 1500;
        monthlyRevenue += pkgPrice;
      }
    }

    return {
      ...ch,
      lossCoeff,
      edfaNfDb: nf,
      spansCount: spans,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      accumulatedCdPsPerNm,
      cdCompensationPct,
      budget,
      linkedSubscribers,
      activeSubscribers,
      monthlyRevenue,
      duesAtRisk,
      isSelected
    };
  });

  const selectedChannel = channels.find(c => c.id === selectedId) || channels[0];

  const totalBandwidthGbps = channels.reduce((sum, c) => sum + c.bitrateGbps, 0);
  const totalSubscribersCovered = channels.reduce((sum, c) => sum + c.linkedSubscribers, 0);
  const networkAvgOsnrDb = Math.round((channels.reduce((sum, c) => sum + c.budget.accumulatedOsnrDb, 0) / channels.length) * 10) / 10;
  const networkAvgMarginDb = Math.round((channels.reduce((sum, c) => sum + c.budget.fecMarginDb, 0) / channels.length) * 10) / 10;
  const totalDuesAtRisk = channels.reduce((sum, c) => sum + (c.budget.healthTier !== 'OPTIMAL' ? c.duesAtRisk : 0), 0);

  return {
    channels,
    selectedChannel,
    totalBandwidthGbps,
    totalSubscribersCovered,
    networkAvgOsnrDb,
    networkAvgMarginDb,
    totalDuesAtRisk
  };
}

/**
 * Pure client-side SVG rendering for DWDM Channel OSNR Budget & Transponder Health.
 */
export function renderDwdmBudgetSvg(metrics, options = {}) {
  const compact = !!options.compact;
  const ch = metrics.selectedChannel || metrics.channels[0];
  const b = ch.budget;

  if (compact) {
    // Compact widget for dashboard overview card
    const marginRatio = Math.max(0, Math.min(1, b.fecMarginDb / 8.0));
    const needleAngle = marginRatio * 180;
    const rad = (180 - needleAngle) * (Math.PI / 180);
    const nx = 100 - 65 * Math.cos(rad);
    const ny = 95 - 65 * Math.sin(rad);

    return `
      <svg class="dwdm-compact-svg" viewBox="0 0 340 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DWDM Optical Channel Transponder OSNR Budget Gauge">
        <defs>
          <linearGradient id="dwdmGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ef4444" />
            <stop offset="25%" stop-color="#f59e0b" />
            <stop offset="60%" stop-color="#10b981" />
            <stop offset="100%" stop-color="#06b6d4" />
          </linearGradient>
        </defs>

        <!-- Semicircular Gauge Track -->
        <path d="M 30,95 A 70,70 0 0,1 170,95" fill="none" stroke="rgba(148, 163, 184, 0.25)" stroke-width="12" stroke-linecap="round" />
        <path d="M 30,95 A 70,70 0 0,1 170,95" fill="none" stroke="url(#dwdmGaugeGrad)" stroke-width="10" stroke-linecap="round" stroke-dasharray="220" stroke-dashoffset="${220 - (220 * marginRatio)}" />

        <!-- Gauge Needle -->
        <circle cx="100" cy="95" r="5" fill="#3b82f6" />
        <line x1="100" y1="95" x2="${nx}" y2="${ny}" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" />

        <!-- Gauge Text -->
        <text x="100" y="80" text-anchor="middle" font-size="16px" font-weight="800" fill="var(--text-color, #0f172a)">+${b.fecMarginDb} dB</text>
        <text x="100" y="112" text-anchor="middle" font-size="9px" font-weight="600" fill="#64748b">SD-FEC MARGIN</text>

        <!-- Right Side Stat Summary -->
        <g transform="translate(190, 24)">
          <text x="0" y="12" font-size="9px" font-weight="700" fill="#64748b">ACCUMULATED OSNR</text>
          <text x="0" y="30" font-size="18px" font-weight="800" fill="${b.fecMarginDb < 1 ? '#ef4444' : b.fecMarginDb < 3 ? '#f59e0b' : '#10b981'}">${b.accumulatedOsnrDb} dB</text>
          <text x="0" y="44" font-size="9px" fill="#64748b">Limit: ${b.sdFecThresholdDb} dB (0.1nm)</text>

          <text x="0" y="68" font-size="9px" font-weight="700" fill="#64748b">ITU GRID CHANNEL</text>
          <text x="0" y="86" font-size="14px" font-weight="700" fill="var(--text-color, #0f172a)">Ch ${ch.channelNumber} (${ch.bitrateGbps}G)</text>
          <text x="0" y="100" font-size="9px" fill="#64748b">${ch.wavelengthNm}nm · ${ch.modulation}</text>

          <rect x="0" y="112" width="130" height="20" rx="4" fill="${b.healthTier === 'OPTIMAL' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}" />
          <text x="65" y="126" text-anchor="middle" font-size="9px" font-weight="700" fill="${b.healthTier === 'OPTIMAL' ? '#10b981' : '#ef4444'}">${b.healthTier} (${ch.primaryArea})</text>
        </g>

        <!-- Bottom Waterfall Spectrum Representation -->
        <g transform="translate(20, 140)">
          <text x="0" y="-4" font-size="8.5px" font-weight="600" fill="#64748b">C-BAND ITU-T CHANNELS (1530nm - 1565nm / 100GHz GRID)</text>
          <rect x="0" y="2" width="300" height="12" rx="3" fill="rgba(148, 163, 184, 0.15)" />

          <!-- Channel markers along spectrum bar -->
          ${metrics.channels.map((c, i) => {
            const cx = 20 + (i * 52);
            const isSel = c.id === ch.id;
            return `
              <rect x="${cx - 10}" y="2" width="20" height="12" rx="2" fill="${isSel ? '#3b82f6' : c.budget.healthTier === 'OPTIMAL' ? '#10b981' : '#f59e0b'}" />
              <text x="${cx}" y="24" text-anchor="middle" font-size="8px" font-weight="${isSel ? '700' : '400'}" fill="${isSel ? '#3b82f6' : '#64748b'}">C${c.channelNumber}</text>
            `;
          }).join('')}
        </g>
      </svg>
    `;
  }

  // Expanded Diagnostic View (Modal Dialog)
  const statusColor = b.healthTier === 'OPTIMAL' ? '#10b981' : b.healthTier.startsWith('MARGINAL') ? '#f59e0b' : '#ef4444';

  return `
    <svg class="dwdm-expanded-svg" viewBox="0 0 760 380" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DWDM Optical Channel Link Budget and OSNR Waterfall Diagram">
      <defs>
        <pattern id="dwdmGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="20" y2="0" stroke="rgba(148, 163, 184, 0.12)" stroke-width="0.75" />
          <line x1="0" y1="0" x2="0" y2="20" stroke="rgba(148, 163, 184, 0.12)" stroke-width="0.75" />
        </pattern>
      </defs>

      <!-- Background -->
      <rect width="760" height="380" rx="10" fill="var(--card-bg, #ffffff)" />
      <rect width="760" height="380" rx="10" fill="url(#dwdmGrid)" />

      <!-- Left Panel: Optical Span Budget & OSNR Waterfall -->
      <g transform="translate(24, 20)">
        <text x="0" y="16" font-size="13px" font-weight="700" fill="var(--text-color, #0f172a)">Optical Link Budget &amp; Cascaded EDFA ASE Waterfall</text>
        <text x="0" y="32" font-size="10px" fill="#64748b">Route: ${ch.name} | Total Span: ${ch.totalDistanceKm} km (${ch.spansCount} spans)</text>

        <!-- Waterfall Chart -->
        <g transform="translate(0, 48)">
          <!-- Grid & Axes -->
          <line x1="45" y1="140" x2="330" y2="140" stroke="#94a3b8" stroke-width="1" />
          <line x1="45" y1="20" x2="45" y2="140" stroke="#94a3b8" stroke-width="1" />

          <!-- Y Ticks for Power / OSNR -->
          <text x="40" y="24" text-anchor="end" font-size="8.5px" fill="#64748b">+40dB</text>
          <line x1="42" y1="20" x2="330" y2="20" stroke="rgba(148, 163, 184, 0.2)" stroke-dasharray="3,3" />

          <text x="40" y="64" text-anchor="end" font-size="8.5px" fill="#64748b">+25dB</text>
          <line x1="42" y1="60" x2="330" y2="60" stroke="rgba(148, 163, 184, 0.2)" stroke-dasharray="3,3" />

          <text x="40" y="104" text-anchor="end" font-size="8.5px" fill="#64748b">+10dB</text>
          <line x1="42" y1="100" x2="330" y2="100" stroke="rgba(148, 163, 184, 0.2)" stroke-dasharray="3,3" />

          <text x="40" y="144" text-anchor="end" font-size="8.5px" fill="#64748b">0dB</text>

          <!-- SD-FEC Threshold Dashed Line -->
          <line x1="45" y1="${140 - (b.sdFecThresholdDb / 40) * 120}" x2="330" y2="${140 - (b.sdFecThresholdDb / 40) * 120}" stroke="#ef4444" stroke-width="1.8" stroke-dasharray="4,3" />
          <text x="332" y="${144 - (b.sdFecThresholdDb / 40) * 120}" font-size="8.5px" font-weight="700" fill="#ef4444">FEC Limit (${b.sdFecThresholdDb}dB)</text>

          <!-- Waterfall Step 1: Launch Power -->
          <g transform="translate(60, 0)">
            <rect x="0" y="30" width="40" height="110" rx="3" fill="#06b6d4" />
            <text x="20" y="24" text-anchor="middle" font-size="9px" font-weight="700" fill="#06b6d4">+${b.launchPowerDbm}dBm</text>
            <text x="20" y="154" text-anchor="middle" font-size="8.5px" fill="#64748b">Tx Launch</text>
          </g>

          <!-- Waterfall Step 2: Span Fiber Loss -->
          <g transform="translate(125, 0)">
            <rect x="0" y="55" width="40" height="85" rx="3" fill="#f59e0b" />
            <text x="20" y="48" text-anchor="middle" font-size="9px" font-weight="700" fill="#f59e0b">-${b.spanLossDb}dB</text>
            <text x="20" y="154" text-anchor="middle" font-size="8.5px" fill="#64748b">Span Loss</text>
          </g>

          <!-- Waterfall Step 3: EDFA ASE Noise -->
          <g transform="translate(190, 0)">
            <rect x="0" y="70" width="40" height="70" rx="3" fill="#8b5cf6" />
            <text x="20" y="64" text-anchor="middle" font-size="9px" font-weight="700" fill="#8b5cf6">NF ${b.edfaNfDb}dB</text>
            <text x="20" y="154" text-anchor="middle" font-size="8.5px" fill="#64748b">EDFA ASE</text>
          </g>

          <!-- Waterfall Step 4: Rx OSNR -->
          <g transform="translate(255, 0)">
            <rect x="0" y="${Math.max(20, 140 - (b.accumulatedOsnrDb / 40) * 120)}" width="40" height="${Math.min(120, (b.accumulatedOsnrDb / 40) * 120)}" rx="3" fill="${statusColor}" />
            <text x="20" y="${Math.max(16, 134 - (b.accumulatedOsnrDb / 40) * 120)}" text-anchor="middle" font-size="9px" font-weight="700" fill="${statusColor}">${b.accumulatedOsnrDb}dB</text>
            <text x="20" y="154" text-anchor="middle" font-size="8.5px" fill="#64748b">Rx OSNR</text>
          </g>
        </g>

        <!-- Margin Callout Box -->
        <g transform="translate(0, 240)">
          <rect x="0" y="0" width="340" height="88" rx="6" fill="rgba(148, 163, 184, 0.1)" stroke="rgba(148, 163, 184, 0.2)" />
          <text x="14" y="20" font-size="10px" font-weight="700" fill="#64748b">FEC OSNR MARGIN ABOVE LIMIT</text>
          <text x="14" y="44" font-size="22px" font-weight="800" fill="${statusColor}">+${b.fecMarginDb} dB</text>
          <text x="140" y="44" font-size="11px" font-weight="600" fill="var(--text-color, #0f172a)">Target: &gt; +3.0 dB</text>

          <text x="14" y="66" font-size="9.5px" fill="#64748b">Pre-FEC BER: ${b.preFecBer.toExponential(1)} (Post-FEC: &lt; 1e-15)</text>
          <text x="14" y="78" font-size="9px" fill="#94a3b8">Fiber Loss Coeff: ${ch.lossCoeff} dB/km | Rx Power: ${b.rxPowerDbm} dBm</text>

          <rect x="230" y="16" width="96" height="24" rx="4" fill="${statusColor}" />
          <text x="278" y="32" text-anchor="middle" font-size="9px" font-weight="700" fill="#ffffff">${b.healthTier.split(' ')[0]}</text>
        </g>
      </g>

      <!-- Right Panel: Transponder Hardware DSP & Dispersion -->
      <g transform="translate(390, 20)">
        <text x="0" y="16" font-size="13px" font-weight="700" fill="var(--text-color, #0f172a)">Coherent DSP &amp; Chromatic Dispersion Compensation</text>
        <text x="0" y="32" font-size="10px" fill="#64748b">DSP: 7nm Ultra-Low Power ASIC | Modulation: ${ch.modulation} (${ch.bitrateGbps} Gbps)</text>

        <!-- Dispersion Bar -->
        <g transform="translate(0, 48)">
          <text x="0" y="12" font-size="9px" font-weight="700" fill="#64748b">ACCUMULATED CHROMATIC DISPERSION (G.652 SMF)</text>
          <text x="350" y="12" text-anchor="end" font-size="9.5px" font-weight="700" fill="#3b82f6">${ch.accumulatedCdPsPerNm} ps/nm (${ch.cdCompensationPct}%)</text>
          <rect x="0" y="20" width="350" height="12" rx="3" fill="rgba(148, 163, 184, 0.15)" />
          <rect x="0" y="20" width="${Math.round((ch.cdCompensationPct / 100) * 350)}" height="12" rx="3" fill="#3b82f6" />
          <text x="0" y="44" font-size="8.5px" fill="#64748b">Transponder DSP Tolerance: ±${ch.dispersionTolerancePsPerNm.toLocaleString()} ps/nm</text>
        </g>

        <!-- Optical Constellation & Modulation Quality -->
        <g transform="translate(0, 116)">
          <!-- Card 1: Wavelength & Frequency -->
          <rect x="0" y="0" width="165" height="64" rx="5" fill="rgba(148, 163, 184, 0.1)" />
          <text x="12" y="18" font-size="8.5px" font-weight="700" fill="#64748b">OPTICAL CARRIER</text>
          <text x="12" y="36" font-size="13px" font-weight="800" fill="var(--text-color, #0f172a)">${ch.wavelengthNm} nm</text>
          <text x="12" y="52" font-size="8.5px" fill="#64748b">${ch.frequencyThz} THz (ITU Ch ${ch.channelNumber})</text>

          <!-- Card 2: Optical Bandwidth -->
          <rect x="185" y="0" width="165" height="64" rx="5" fill="rgba(148, 163, 184, 0.1)" />
          <text x="197" y="18" font-size="8.5px" font-weight="700" fill="#64748b">GRID BANDWIDTH</text>
          <text x="197" y="36" font-size="13px" font-weight="800" fill="#10b981">${ch.opticalBandwidthGhz} GHz</text>
          <text x="197" y="52" font-size="8.5px" fill="#64748b">Channel Capacity: ${ch.bitrateGbps} Gbps</text>
        </g>

        <!-- Subscriber QoE & Revenue Exposure -->
        <g transform="translate(0, 196)">
          <rect x="0" y="0" width="350" height="132" rx="6" fill="rgba(148, 163, 184, 0.1)" stroke="rgba(148, 163, 184, 0.2)" />
          <text x="16" y="22" font-size="10px" font-weight="700" fill="#64748b">AGGREGATED SUBSCRIBER EXPOSURE</text>

          <text x="16" y="46" font-size="18px" font-weight="800" fill="var(--text-color, #0f172a)">${ch.linkedSubscribers} Subscribers</text>
          <text x="160" y="46" font-size="11px" font-weight="600" fill="#10b981">${ch.activeSubscribers} Active Accounts</text>

          <line x1="16" y1="62" x2="334" y2="62" stroke="rgba(148, 163, 184, 0.2)" />

          <text x="16" y="80" font-size="9px" fill="#64748b">Primary Coverage Sector: ${ch.primaryArea} (${(ch.aliasAreas || []).join(', ')})</text>
          <text x="16" y="96" font-size="9px" fill="#64748b">Monthly Portfolio Revenue: ${formatPKR(ch.monthlyRevenue)}</text>
          <text x="16" y="112" font-size="9.5px" font-weight="700" fill="${b.healthTier !== 'OPTIMAL' ? '#ef4444' : '#10b981'}">Total Dues At Risk: ${formatPKR(ch.duesAtRisk)}</text>
        </g>
      </g>
    </svg>
  `;
}

/**
 * Generates an executive NOC diagnostic briefing for clipboard export.
 */
export function generateDwdmReport(metrics, options = {}) {
  const ch = metrics.selectedChannel;
  const b = ch.budget;
  const timestamp = options.referenceDate ? new Date(options.referenceDate).toISOString() : new Date().toISOString();

  const lines = [
    '=========================================================================',
    '     SHAHDARA DWDM OPTICAL CHANNEL TRANSPONDER OSNR AUDIT BRIEFING       ',
    '=========================================================================',
    `Generated: ${timestamp}`,
    `Total Active DWDM Channels: ${metrics.channels.length} C-Band Lambdas`,
    `Aggregated Transport Capacity: ${metrics.totalBandwidthGbps} Gbps`,
    `Network Average OSNR (0.1nm): ${metrics.networkAvgOsnrDb} dB`,
    `Network Average FEC Margin: +${metrics.networkAvgMarginDb} dB`,
    `Total Subscribers Transported: ${metrics.totalSubscribersCovered} accounts`,
    `Total Outstanding Dues At Risk: ${formatPKR(metrics.totalDuesAtRisk)}`,
    '',
    '-------------------------------------------------------------------------',
    `SELECTED OPTICAL CHANNEL: ${ch.name}`,
    '-------------------------------------------------------------------------',
    `Channel ID: ${ch.id} | ITU Grid: Channel ${ch.channelNumber} (100GHz Grid)`,
    `Optical Wavelength: ${ch.wavelengthNm} nm | Frequency: ${ch.frequencyThz} THz`,
    `Transponder Model: ${ch.transponderModel}`,
    `Bitrate: ${ch.bitrateGbps} Gbps | Modulation Scheme: ${ch.modulation}`,
    `Total Route Distance: ${ch.totalDistanceKm} km across ${ch.spansCount} optical spans`,
    '',
    '-------------------------------------------------------------------------',
    'OPTICAL SIGNAL-TO-NOISE RATIO (OSNR) & LINK BUDGET',
    '-------------------------------------------------------------------------',
    `Tx Launch Optical Power: +${b.launchPowerDbm} dBm`,
    `Span Fiber Attenuation: ${ch.lossCoeff} dB/km (Span Loss: ${b.spanLossDb} dB)`,
    `EDFA Amplifier Noise Figure: ${b.edfaNfDb} dB`,
    `Single Span OSNR (0.1nm): ${b.singleSpanOsnrDb} dB`,
    `Cascaded Received OSNR: ${b.accumulatedOsnrDb} dB`,
    `Received Optical Power (Rx): ${b.rxPowerDbm} dBm`,
    `SD-FEC Operational Threshold: ${b.sdFecThresholdDb} dB`,
    `Net FEC OSNR Margin: +${b.fecMarginDb} dB (${b.healthTier})`,
    `Estimated Pre-FEC BER: ${b.preFecBer.toExponential(1)}`,
    '',
    '-------------------------------------------------------------------------',
    'CHROMATIC DISPERSION (CD) & DSP COMPENSATION',
    '-------------------------------------------------------------------------',
    `Accumulated G.652 CD: ${ch.accumulatedCdPsPerNm} ps/nm`,
    `Transponder DSP Tolerance: ±${ch.dispersionTolerancePsPerNm.toLocaleString()} ps/nm`,
    `DSP Utilization: ${ch.cdCompensationPct}% of digital compensation window`,
    '',
    '-------------------------------------------------------------------------',
    'SUBSCRIBER QoE & AGGREGATE REVENUE EXPOSURE',
    '-------------------------------------------------------------------------',
    `Coverage Area: ${ch.primaryArea} (${(ch.aliasAreas || []).join(', ')})`,
    `Linked Accounts: ${ch.linkedSubscribers} (${ch.activeSubscribers} Active)`,
    `Monthly Area Revenue: ${formatPKR(ch.monthlyRevenue)}`,
    `Outstanding Area Dues At Risk: ${formatPKR(ch.duesAtRisk)}`,
    '========================================================================='
  ];

  return lines.join('\n');
}

/**
 * Initializes interactive events and simulation controls for DWDM OSNR modal dialog.
 */
export function setupDwdmModal(state, options = {}) {
  const modal = document.getElementById('dashboardDwdmModal');
  const openBtn = document.getElementById('dashboardOpenDwdmModalBtn');
  const closeBtn = document.getElementById('dashboardDwdmModalCloseBtn');

  const channelSelect = document.getElementById('dwdmChannelSelect');
  const lossSlider = document.getElementById('dwdmFiberLossSlider');
  const lossVal = document.getElementById('dwdmFiberLossVal');
  const nfSlider = document.getElementById('dwdmEdfaNfSlider');
  const nfVal = document.getElementById('dwdmEdfaNfVal');
  const spansSlider = document.getElementById('dwdmSpansSlider');
  const spansVal = document.getElementById('dwdmSpansVal');
  const resetBtn = document.getElementById('dwdmResetSimBtn');

  const kpiChannelName = document.getElementById('dwdmKpiChannelName');
  const kpiOsnr = document.getElementById('dwdmKpiOsnr');
  const kpiMargin = document.getElementById('dwdmKpiMargin');
  const statusBadge = document.getElementById('dwdmStatusBadge');
  const kpiRevenueRisk = document.getElementById('dwdmKpiRevenueRisk');

  const chartWrap = document.getElementById('dwdmModalChartWrap');
  const tableBody = document.getElementById('dwdmChannelsTableBody');

  const filterAreaBtn = document.getElementById('dwdmFilterAreaBtn');
  const copyReportBtn = document.getElementById('dashboardCopyDwdmReportBtn');

  function refreshModalView() {
    const metrics = calculateDwdmMetrics(state, options);
    const ch = metrics.selectedChannel;
    const b = ch.budget;

    if (kpiChannelName) {
      kpiChannelName.textContent = `Ch ${ch.channelNumber} (${ch.wavelengthNm}nm)`;
    }
    if (kpiOsnr) {
      kpiOsnr.textContent = `${b.accumulatedOsnrDb} dB (${b.rxPowerDbm} dBm)`;
    }
    if (kpiMargin) {
      kpiMargin.textContent = `+${b.fecMarginDb} dB (BER ${b.preFecBer.toExponential(1)})`;
    }
    if (statusBadge) {
      statusBadge.textContent = b.healthTier.split(' ')[0];
      statusBadge.className = `sim-delta-badge ${b.healthClass}`;
    }
    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(ch.duesAtRisk)} dues (${ch.linkedSubscribers} subs)`;
    }

    if (chartWrap) {
      chartWrap.innerHTML = renderDwdmBudgetSvg(metrics, { compact: false });
    }

    if (tableBody) {
      tableBody.innerHTML = metrics.channels.map(c => `
        <tr class="${c.isSelected ? 'selected-row' : ''}">
          <td><strong>Ch ${c.channelNumber} (${c.wavelengthNm}nm)</strong><br><small class="text-muted">${c.transponderModel}</small></td>
          <td>${c.primaryArea}</td>
          <td>${c.bitrateGbps}G ${c.modulation}</td>
          <td>${c.totalDistanceKm} km (${c.spansCount}sp)</td>
          <td><strong>${c.budget.accumulatedOsnrDb} dB</strong></td>
          <td><span style="color: ${c.budget.fecMarginDb < 1 ? '#ef4444' : c.budget.fecMarginDb < 3 ? '#f59e0b' : '#10b981'}; font-weight: 700;">+${c.budget.fecMarginDb} dB</span></td>
          <td><span class="sim-delta-badge ${c.budget.healthClass}">${c.budget.healthTier.split(' ')[0]}</span></td>
        </tr>
      `).join('');
    }
  }

  function populateDropdowns() {
    if (channelSelect) {
      channelSelect.innerHTML = SHAHDARA_DWDM_CHANNELS.map(c => `
        <option value="${c.id}" ${c.id === simSelectedChannelId ? 'selected' : ''}>
          ${c.name}
        </option>
      `).join('');
    }

    const currentCh = SHAHDARA_DWDM_CHANNELS.find(c => c.id === simSelectedChannelId) || SHAHDARA_DWDM_CHANNELS[0];

    if (lossSlider && lossVal) {
      const val = simFiberLossCoeff !== null ? simFiberLossCoeff : currentCh.baseFiberLossDbPerKm;
      lossSlider.value = val;
      lossVal.textContent = `${val} dB/km`;
    }

    if (nfSlider && nfVal) {
      const val = simEdfaNoiseFigure !== null ? simEdfaNoiseFigure : currentCh.baseEdfaNfDb;
      nfSlider.value = val;
      nfVal.textContent = `${val} dB`;
    }

    if (spansSlider && spansVal) {
      const val = simSpanCount !== null ? simSpanCount : currentCh.baseSpansCount;
      spansSlider.value = val;
      spansVal.textContent = `${val} spans`;
    }
  }

  if (openBtn && modal) {
    openBtn.onclick = () => {
      populateDropdowns();
      refreshModalView();
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
    };
  }

  if (closeBtn && modal) {
    closeBtn.onclick = () => {
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    };
  }

  if (channelSelect) {
    channelSelect.onchange = (e) => {
      setDwdmSelectedChannel(e.target.value);
      populateDropdowns();
      refreshModalView();
    };
  }

  if (lossSlider) {
    lossSlider.oninput = (e) => {
      const val = Number(e.target.value);
      setDwdmFiberLossCoeff(val);
      if (lossVal) lossVal.textContent = `${val} dB/km`;
      refreshModalView();
    };
  }

  if (nfSlider) {
    nfSlider.oninput = (e) => {
      const val = Number(e.target.value);
      setDwdmEdfaNoiseFigure(val);
      if (nfVal) nfVal.textContent = `${val} dB`;
      refreshModalView();
    };
  }

  if (spansSlider) {
    spansSlider.oninput = (e) => {
      const val = Number(e.target.value);
      setDwdmSpanCount(val);
      if (spansVal) spansVal.textContent = `${val} spans`;
      refreshModalView();
    };
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      resetDwdmSimState();
      populateDropdowns();
      refreshModalView();
    };
  }

  if (filterAreaBtn) {
    filterAreaBtn.onclick = () => {
      const metrics = calculateDwdmMetrics(state, options);
      const ch = metrics.selectedChannel;
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(ch.primaryArea);
        if (modal && typeof modal.close === 'function') {
          modal.close();
        }
      }
    };
  }

  if (copyReportBtn) {
    copyReportBtn.onclick = async () => {
      const metrics = calculateDwdmMetrics(state, options);
      const report = generateDwdmReport(metrics, options);
      const clipboard = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      let success = false;
      if (clipboard && typeof clipboard.writeText === 'function') {
        try {
          await clipboard.writeText(report);
          success = true;
        } catch (_) {}
      }
      if (typeof options.onToast === 'function') {
        options.onToast(success ? '✓ DWDM OSNR Diagnostic Briefing copied to clipboard' : 'Report generated in console');
      }
    };
  }
}
