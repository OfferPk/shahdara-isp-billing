import { formatPKR } from './core.js';

/**
 * Optical Supervisory Channel (OSC) Telemetry, Out-of-Band Remote Loopback Testing & Amplified Line Health Matrix
 *
 * Models ITU-T G.692 / G.709 Optical Transport Network (OTN) supervisory channels (1510nm / 1610nm)
 * operating outside the C-band EDFA gain spectrum across Shahdara ISP optical fiber rings and feeder trunks.
 * Provides real-time optical power budget telemetry (Tx power, fiber loss, connector/splice loss,
 * WDM filter insertion loss, Rx sensitivity, optical link margin, and estimated Bit Error Rate - BER).
 * Supports diagnostic remote loopback modes (Terminal Loopback, Facility Line Loopback, PRBS-31 BERT Pattern)
 * and assesses subscriber revenue and dues at risk during maintenance and optical degradation.
 */

export const OSC_CONSTANTS = {
  SPEED_OF_LIGHT_KM_S: 299792.458,
  SILICA_REFRACTIVE_INDEX: 1.4682,
  C_BAND_START_NM: 1528.0,
  C_BAND_END_NM: 1565.0,
  OSC_WAVELENGTH_1510_NM: 1510.0,
  OSC_WAVELENGTH_1610_NM: 1610.0,
  DEFAULT_OVERLOAD_DBM: -8.0,
  MARGIN_OPTIMAL_THRESHOLD_DB: 6.0,
  MARGIN_ADEQUATE_THRESHOLD_DB: 3.0,
  MARGIN_CRITICAL_THRESHOLD_DB: 1.0,
  BER_FLOOR: 1e-13,
  LOOPBACK_MODES: {
    NORMAL: 'NORMAL',
    TERMINAL: 'TERMINAL',
    FACILITY: 'FACILITY',
    PRBS31: 'PRBS31'
  }
};

export const SHAHDARA_OSC_LINKS = [
  {
    id: 'osc-link-1510-core',
    name: 'OSC-1510 (1510nm) - Shahdara Town Core Ring',
    wavelengthNm: 1510,
    spanLengthKm: 28.5,
    transponderModel: 'Huawei OptiX OSN 9800 OSC Transceiver',
    feederRoute: 'Main G.T. Road to Ravi Siphon Metro Ring',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    baseTxPowerDbm: 3.0,
    baseRxSensitivityDbm: -38.0,
    baseFiberLossCoeffDbPerKm: 0.24,
    filterLossDb: 2.4, // Dual WDM Mux/Demux filters (1.2 dB each)
    baseSpliceCount: 10,
    baseSpliceLossDb: 0.50, // 0.05 dB per splice
    connectorLossDb: 0.50, // Patch panel connectors
    normalBitrateMbps: 155.52 // STM-1/OC-3 supervisory channel
  },
  {
    id: 'osc-link-1510-baradari',
    name: 'OSC-1510 (1510nm) - Baradari Industrial Trunk',
    wavelengthNm: 1510,
    spanLengthKm: 22.0,
    transponderModel: 'ZTE ZXMP M721 OSC Transceiver',
    feederRoute: 'Baradari Mill Road Industrial Backhaul',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    baseTxPowerDbm: 2.5,
    baseRxSensitivityDbm: -36.0,
    baseFiberLossCoeffDbPerKm: 0.25,
    filterLossDb: 2.2,
    baseSpliceCount: 8,
    baseSpliceLossDb: 0.40,
    connectorLossDb: 0.50,
    normalBitrateMbps: 155.52
  },
  {
    id: 'osc-link-1610-vandala',
    name: 'OSC-1610 (1610nm) - Vandala West Feeder Ring',
    wavelengthNm: 1610,
    spanLengthKm: 34.0,
    transponderModel: 'Cisco NCS 2000 OSC Line Card',
    feederRoute: 'Vandala Dayal Shah Road Aggregation Link',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    baseTxPowerDbm: 3.5,
    baseRxSensitivityDbm: -40.0,
    baseFiberLossCoeffDbPerKm: 0.26,
    filterLossDb: 2.5,
    baseSpliceCount: 12,
    baseSpliceLossDb: 0.60,
    connectorLossDb: 0.50,
    normalBitrateMbps: 155.52
  },
  {
    id: 'osc-link-1510-jiamusa',
    name: 'OSC-1510 (1510nm) - Jia Musa Metro Aggregation',
    wavelengthNm: 1510,
    spanLengthKm: 18.5,
    transponderModel: 'Ciena 6500 WaveLogic OSC Module',
    feederRoute: 'Old Shahdara Railway Road Feeder',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    baseTxPowerDbm: 2.0,
    baseRxSensitivityDbm: -36.0,
    baseFiberLossCoeffDbPerKm: 0.24,
    filterLossDb: 2.0,
    baseSpliceCount: 6,
    baseSpliceLossDb: 0.30,
    connectorLossDb: 0.50,
    normalBitrateMbps: 155.52
  },
  {
    id: 'osc-link-1610-saeed',
    name: 'OSC-1610 (1610nm) - Saeed Park Distribution Feeder',
    wavelengthNm: 1610,
    spanLengthKm: 14.2,
    transponderModel: 'FiberHome FONST 1000 OSC Unit',
    feederRoute: 'Saeed Park Main Boulevard Distribution Line',
    primaryArea: 'Saeed Park',
    aliasAreas: ['Saeed Park'],
    baseTxPowerDbm: 2.0,
    baseRxSensitivityDbm: -35.0,
    baseFiberLossCoeffDbPerKm: 0.25,
    filterLossDb: 2.0,
    baseSpliceCount: 5,
    baseSpliceLossDb: 0.25,
    connectorLossDb: 0.50,
    normalBitrateMbps: 155.52
  },
  {
    id: 'osc-link-1510-begumkot',
    name: 'OSC-1510 (1510nm) - Begum Kot Outer Perimeter',
    wavelengthNm: 1510,
    spanLengthKm: 26.8,
    transponderModel: 'Nokia 1830 PSS OSC Transponder',
    feederRoute: 'Sheikhupura Road Feeder Outer Ring',
    primaryArea: 'Begum Kot',
    aliasAreas: ['Begum Kot', 'Sheikhupura Road', 'Kot Begum'],
    baseTxPowerDbm: 3.0,
    baseRxSensitivityDbm: -38.0,
    baseFiberLossCoeffDbPerKm: 0.24,
    filterLossDb: 2.4,
    baseSpliceCount: 9,
    baseSpliceLossDb: 0.45,
    connectorLossDb: 0.50,
    normalBitrateMbps: 155.52
  }
];

// Interactive simulation state
let currentSelectedLinkId = 'osc-link-1510-core';
let currentFiberLossDelta = 0.0; // additional dB/km
let currentSpliceLossDelta = 0.0; // additional dB total
let currentLoopbackMode = OSC_CONSTANTS.LOOPBACK_MODES.NORMAL;

export function getOscSelectedLink() {
  return currentSelectedLinkId;
}

export function setOscSelectedLink(id) {
  if (SHAHDARA_OSC_LINKS.some(link => link.id === id)) {
    currentSelectedLinkId = id;
  }
}

export function getOscFiberLossDelta() {
  return currentFiberLossDelta;
}

export function setOscFiberLossDelta(delta) {
  if (typeof delta === 'number' && !Number.isNaN(delta)) {
    currentFiberLossDelta = Math.max(-0.10, Math.min(0.50, delta));
  }
}

export function getOscSpliceLossDelta() {
  return currentSpliceLossDelta;
}

export function setOscSpliceLossDelta(delta) {
  if (typeof delta === 'number' && !Number.isNaN(delta)) {
    currentSpliceLossDelta = Math.max(0.0, Math.min(10.0, delta));
  }
}

export function getOscLoopbackMode() {
  return currentLoopbackMode;
}

export function setOscLoopbackMode(mode) {
  if (Object.values(OSC_CONSTANTS.LOOPBACK_MODES).includes(mode)) {
    currentLoopbackMode = mode;
  }
}

export function resetOscSimState() {
  currentSelectedLinkId = 'osc-link-1510-core';
  currentFiberLossDelta = 0.0;
  currentSpliceLossDelta = 0.0;
  currentLoopbackMode = OSC_CONSTANTS.LOOPBACK_MODES.NORMAL;
}

/**
 * Calculates optical propagation delay (round trip) in microseconds
 */
export function calculateOpticalRttMicroseconds(spanLengthKm) {
  const speedInMedium = OSC_CONSTANTS.SPEED_OF_LIGHT_KM_S / OSC_CONSTANTS.SILICA_REFRACTIVE_INDEX;
  const oneWaySeconds = spanLengthKm / speedInMedium;
  return Number((oneWaySeconds * 2 * 1e6).toFixed(2));
}

/**
 * Calculates optical link budget for a single OSC link
 */
export function calculateOscLinkBudget(link, overrides = {}) {
  const fiberLossDelta = overrides.fiberLossDelta ?? currentFiberLossDelta;
  const spliceLossDelta = overrides.spliceLossDelta ?? currentSpliceLossDelta;
  const loopbackMode = overrides.loopbackMode ?? (link.id === currentSelectedLinkId ? currentLoopbackMode : OSC_CONSTANTS.LOOPBACK_MODES.NORMAL);

  const effectiveFiberLossCoeff = Number(Math.max(0.15, link.baseFiberLossCoeffDbPerKm + fiberLossDelta).toFixed(3));
  const fiberLossTotalDb = Number((link.spanLengthKm * effectiveFiberLossCoeff).toFixed(2));
  const effectiveSpliceLossDb = Number((link.baseSpliceLossDb + spliceLossDelta).toFixed(2));
  const totalAttenuationDb = Number((fiberLossTotalDb + effectiveSpliceLossDb + link.filterLossDb + link.connectorLossDb).toFixed(2));

  const txPowerDbm = link.baseTxPowerDbm;
  const rxPowerDbm = Number((txPowerDbm - totalAttenuationDb).toFixed(2));
  const rxSensitivityDbm = link.baseRxSensitivityDbm;
  const linkMarginDb = Number((rxPowerDbm - rxSensitivityDbm).toFixed(2));

  // Determine Bit Error Rate (BER) based on link margin
  let ber;
  let berExponent;
  if (linkMarginDb >= 8.0) {
    ber = 1.0e-13;
    berExponent = -13;
  } else if (linkMarginDb >= 6.0) {
    ber = 2.4e-12;
    berExponent = -12;
  } else if (linkMarginDb >= 3.0) {
    ber = 1.5e-9;
    berExponent = -9;
  } else if (linkMarginDb >= 1.0) {
    ber = 8.2e-6;
    berExponent = -6;
  } else if (linkMarginDb >= 0.0) {
    ber = 4.5e-3;
    berExponent = -3;
  } else {
    ber = 1.0e-1; // Loss of Signal (LOS) / severe degradation
    berExponent = -1;
  }

  // Health status classification
  let status = 'OPTIMAL';
  let badgeClass = 'badge-success';
  if (linkMarginDb < 1.0 || rxPowerDbm < rxSensitivityDbm) {
    status = 'CRITICAL';
    badgeClass = 'badge-danger';
  } else if (linkMarginDb < 3.0) {
    status = 'MARGINAL';
    badgeClass = 'badge-warning';
  } else if (linkMarginDb < 6.0) {
    status = 'ADEQUATE';
    badgeClass = 'badge-info';
  }

  // Descriptions for loopback mode
  let loopbackDesc = 'Operational duplex supervisory link (telemetry & APS active)';
  let loopbackActive = false;
  if (loopbackMode === OSC_CONSTANTS.LOOPBACK_MODES.TERMINAL) {
    loopbackActive = true;
    loopbackDesc = 'Near-end transceiver ASIC loopback active (optical transmitter bypassed for local chip verification)';
  } else if (loopbackMode === OSC_CONSTANTS.LOOPBACK_MODES.FACILITY) {
    loopbackActive = true;
    loopbackDesc = 'Far-end line facility loopback active (optical carrier reflected through WDM demux back to source)';
  } else if (loopbackMode === OSC_CONSTANTS.LOOPBACK_MODES.PRBS31) {
    loopbackActive = true;
    loopbackDesc = 'PRBS-31 BERT stress pattern active (transmitting 2^31-1 pseudorandom sequence for bit error audit)';
  }

  const propagationDelayUs = calculateOpticalRttMicroseconds(link.spanLengthKm);

  return {
    ...link,
    effectiveFiberLossCoeff,
    fiberLossTotalDb,
    effectiveSpliceLossDb,
    totalAttenuationDb,
    txPowerDbm,
    rxPowerDbm,
    rxSensitivityDbm,
    linkMarginDb,
    ber,
    berExponent,
    status,
    badgeClass,
    loopbackMode,
    loopbackActive,
    loopbackDesc,
    propagationDelayUs
  };
}

/**
 * Calculates aggregate OSC metrics combined with Shahdara subscriber state
 */
export function calculateOscMetrics(state, options = {}) {
  const selectedId = options.selectedLinkId || currentSelectedLinkId;
  const customers = (state && Array.isArray(state.customers)) ? state.customers : [];
  const bills = (state && Array.isArray(state.bills)) ? state.bills : [];
  const payments = (state && Array.isArray(state.payments)) ? state.payments : [];

  // Map subscriber finances per primary and alias areas
  const allLinks = SHAHDARA_OSC_LINKS.map(link => {
    const budget = calculateOscLinkBudget(link, {
      loopbackMode: link.id === selectedId ? currentLoopbackMode : OSC_CONSTANTS.LOOPBACK_MODES.NORMAL
    });

    const matchingCustomers = customers.filter(c => {
      const custArea = (c.area || '').trim().toLowerCase();
      return link.aliasAreas.some(alias => custArea === alias.toLowerCase());
    });

    const activeCustomers = matchingCustomers.filter(c => !c.archived && c.status !== 'Inactive');
    const offlineCustomers = matchingCustomers.filter(c => !c.archived && c.status === 'Offline');

    // Calculate monthly billed dues & total balance for matching customers
    let totalBilledRevenue = 0;
    let totalOutstandingDues = 0;

    matchingCustomers.forEach(cust => {
      const custBills = Array.isArray(cust.bills) && cust.bills.length > 0 ? cust.bills : bills.filter(b => b.customerId === cust.id);
      const custPayments = payments.filter(p => p.customerId === cust.id);
      const billedSum = custBills.reduce((sum, b) => sum + (Number(b.dueAmount) || Number(b.amount) || 0), 0);
      const paidSum = custPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const balance = Math.max(0, billedSum - paidSum);

      const pkgPrice = Number(cust.packagePrice) || Number(cust.monthlyFee) || Number(cust.monthlySellingAmount) || 0;
      totalBilledRevenue += pkgPrice;
      totalOutstandingDues += balance;
    });


    // Revenue at risk: if link is CRITICAL or MARGINAL or in active test loopback
    const isAtRisk = budget.status === 'CRITICAL' || budget.status === 'MARGINAL' || budget.loopbackActive;
    const revenueAtRisk = isAtRisk ? totalBilledRevenue : 0;
    const duesAtRisk = isAtRisk ? totalOutstandingDues : 0;

    return {
      ...budget,
      matchingCount: matchingCustomers.length,
      activeCount: activeCustomers.length,
      offlineCount: offlineCustomers.length,
      totalBilledRevenue,
      totalOutstandingDues,
      revenueAtRisk,
      duesAtRisk
    };
  });

  const selectedLink = allLinks.find(l => l.id === selectedId) || allLinks[0];

  const totalLinks = allLinks.length;
  const totalSpanKm = Number(allLinks.reduce((sum, l) => sum + l.spanLengthKm, 0).toFixed(1));
  const optimalCount = allLinks.filter(l => l.status === 'OPTIMAL').length;
  const adequateCount = allLinks.filter(l => l.status === 'ADEQUATE').length;
  const marginalCount = allLinks.filter(l => l.status === 'MARGINAL').length;
  const criticalCount = allLinks.filter(l => l.status === 'CRITICAL').length;
  const activeLoopbackCount = allLinks.filter(l => l.loopbackActive).length;

  const totalRevenueAtRisk = allLinks.reduce((sum, l) => sum + l.revenueAtRisk, 0);
  const totalDuesAtRisk = allLinks.reduce((sum, l) => sum + l.duesAtRisk, 0);
  const totalSubscribersMonitored = allLinks.reduce((sum, l) => sum + l.activeCount, 0);

  let overallHealth = 'OPTIMAL';
  if (criticalCount > 0) {
    overallHealth = 'CRITICAL';
  } else if (marginalCount > 0) {
    overallHealth = 'WARNING';
  } else if (adequateCount > 0) {
    overallHealth = 'ADEQUATE';
  }

  return {
    totalLinks,
    totalSpanKm,
    optimalCount,
    adequateCount,
    marginalCount,
    criticalCount,
    activeLoopbackCount,
    totalRevenueAtRisk,
    totalDuesAtRisk,
    totalSubscribersMonitored,
    overallHealth,
    selectedLink,
    allLinks
  };
}

/**
 * Pure SVG Offline Telemetry & Transponder Loopback Schematic Visualizer
 */
export function renderOscTelemetrySvg(metrics, options = {}) {
  const isCompact = !!options.compact;
  const link = metrics.selectedLink;
  if (!link) {
    return `<svg class="${isCompact ? 'osc-compact-svg' : 'osc-expanded-svg'}" viewBox="0 0 600 200"><text x="300" y="100" text-anchor="middle" fill="currentColor">No OSC Telemetry Data Available</text></svg>`;
  }

  if (isCompact) {
    // Compact widget for dashboard card tile (width: 600, height: 210)
    const marginPercent = Math.max(0, Math.min(100, (link.linkMarginDb / 15.0) * 100));
    const statusColor = link.status === 'OPTIMAL' ? '#10b981' : link.status === 'ADEQUATE' ? '#0284c7' : link.status === 'MARGINAL' ? '#f59e0b' : '#ef4444';
    const loopbackBadgeColor = link.loopbackActive ? '#8b5cf6' : '#64748b';

    return `<svg class="osc-compact-svg" viewBox="0 0 600 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="OSC Optical Telemetry Summary">
      <defs>
        <linearGradient id="oscCompactGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0284c7" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.9" />
        </linearGradient>
      </defs>

      <!-- Background container -->
      <rect x="0" y="0" width="600" height="210" rx="10" fill="var(--surface-alt, #f8fafc)" stroke="var(--border-color, #e2e8f0)" stroke-width="1.5" />

      <!-- Top Title Bar -->
      <g transform="translate(18, 28)">
        <text x="0" y="0" font-size="13" font-weight="700" fill="var(--text-color, #0f172a)">${link.name}</text>
        <text x="0" y="18" font-size="11" fill="var(--text-muted, #64748b)">Span: ${link.spanLengthKm} km · ${link.transponderModel} · RTT: ${link.propagationDelayUs} µs</text>
        
        <!-- Status Pills -->
        <rect x="420" y="-14" width="75" height="22" rx="11" fill="${statusColor}" fill-opacity="0.15" stroke="${statusColor}" stroke-width="1.2" />
        <text x="457" y="1" font-size="10" font-weight="700" fill="${statusColor}" text-anchor="middle">${link.status}</text>
        
        <rect x="502" y="-14" width="80" height="22" rx="11" fill="${loopbackBadgeColor}" fill-opacity="0.15" stroke="${loopbackBadgeColor}" stroke-width="1.2" />
        <text x="542" y="1" font-size="10" font-weight="700" fill="${loopbackBadgeColor}" text-anchor="middle">${link.loopbackMode}</text>
      </g>

      <!-- KPI Metrics Row -->
      <g transform="translate(18, 80)">
        <!-- Rx Power Box -->
        <rect x="0" y="0" width="130" height="52" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" />
        <text x="12" y="18" font-size="10" font-weight="600" fill="var(--text-muted, #64748b)">OPTICAL RX POWER</text>
        <text x="12" y="38" font-size="15" font-weight="700" fill="${statusColor}">${link.rxPowerDbm} dBm</text>

        <!-- Link Margin Box -->
        <rect x="142" y="0" width="130" height="52" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" />
        <text x="154" y="18" font-size="10" font-weight="600" fill="var(--text-muted, #64748b)">OPTICAL MARGIN</text>
        <text x="154" y="38" font-size="15" font-weight="700" fill="var(--text-color, #0f172a)">+${link.linkMarginDb} dB</text>

        <!-- BER Box -->
        <rect x="284" y="0" width="130" height="52" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" />
        <text x="296" y="18" font-size="10" font-weight="600" fill="var(--text-muted, #64748b)">ESTIMATED BER</text>
        <text x="296" y="38" font-size="15" font-weight="700" fill="var(--text-color, #0f172a)">10^${link.berExponent}</text>

        <!-- Monitored Subs Box -->
        <rect x="426" y="0" width="138" height="52" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" />
        <text x="438" y="18" font-size="10" font-weight="600" fill="var(--text-muted, #64748b)">MONITORED SUBS</text>
        <text x="438" y="38" font-size="15" font-weight="700" fill="#0284c7">${link.activeCount} active</text>
      </g>

      <!-- Optical Margin Progress Bar -->
      <g transform="translate(18, 150)">
        <text x="0" y="12" font-size="11" font-weight="600" fill="var(--text-muted, #64748b)">OSC Margin vs -38.0 dBm Sensitivity Floor (Goal: &gt; 6 dB)</text>
        <rect x="0" y="20" width="564" height="12" rx="6" fill="var(--border-color, #e2e8f0)" />
        <rect x="0" y="20" width="${(564 * marginPercent) / 100}" height="12" rx="6" fill="url(#oscCompactGrad)" />
        
        <!-- Threshold ticks -->
        <line x1="${(564 * 3.0) / 15.0}" y1="18" x2="${(564 * 3.0) / 15.0}" y2="34" stroke="#f59e0b" stroke-width="2" />
        <text x="${(564 * 3.0) / 15.0}" y="46" font-size="9" fill="#f59e0b" text-anchor="middle">3 dB</text>

        <line x1="${(564 * 6.0) / 15.0}" y1="18" x2="${(564 * 6.0) / 15.0}" y2="34" stroke="#10b981" stroke-width="2" />
        <text x="${(564 * 6.0) / 15.0}" y="46" font-size="9" fill="#10b981" text-anchor="middle">6 dB</text>
      </g>
    </svg>`;
  }

  // Expanded detailed SVG diagram for modal dialog (width: 900, height: 440)
  const statusColor = link.status === 'OPTIMAL' ? '#10b981' : link.status === 'ADEQUATE' ? '#0284c7' : link.status === 'MARGINAL' ? '#f59e0b' : '#ef4444';
  const marginPercent = Math.max(0, Math.min(100, (link.linkMarginDb / 16.0) * 100));

  return `<svg class="osc-expanded-svg" viewBox="0 0 900 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="OSC Telemetry and Remote Loopback Architectural Schematic">
    <defs>
      <linearGradient id="cbandGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3" />
        <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.3" />
      </linearGradient>
      <linearGradient id="fiberSpanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0284c7" />
        <stop offset="50%" stop-color="#06b6d4" />
        <stop offset="100%" stop-color="#10b981" />
      </linearGradient>
      <marker id="arrowHead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#0284c7" />
      </marker>
      <marker id="loopbackArrowHead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#8b5cf6" />
      </marker>
    </defs>

    <!-- Canvas Card -->
    <rect x="0" y="0" width="900" height="440" rx="12" fill="var(--surface, #ffffff)" stroke="var(--border-color, #e2e8f0)" stroke-width="1.5" />

    <!-- SECTION 1: C-Band Payload vs Out-of-Band OSC Spectrum Allocation (Top) -->
    <g transform="translate(24, 20)">
      <text x="0" y="14" font-size="12" font-weight="700" fill="var(--text-color, #0f172a)">OPTICAL SPECTRUM ISOLATION (ITU-T G.692 / G.709)</text>
      <text x="560" y="14" font-size="11" fill="var(--text-muted, #64748b)" text-anchor="end">WDM Filter Attenuation: ${link.filterLossDb} dB · Transceiver Wavelength: ${link.wavelengthNm} nm</text>
      
      <!-- Spectrum axis line -->
      <rect x="0" y="26" width="852" height="42" rx="6" fill="var(--surface-alt, #f8fafc)" stroke="var(--border-color, #e2e8f0)" />
      
      <!-- 1510nm OSC Marker -->
      <g transform="translate(80, 26)">
        <rect x="0" y="0" width="60" height="42" rx="4" fill="${link.wavelengthNm === 1510 ? '#0284c7' : '#94a3b8'}" fill-opacity="0.25" stroke="${link.wavelengthNm === 1510 ? '#0284c7' : '#94a3b8'}" stroke-width="1.5" />
        <text x="30" y="18" font-size="10" font-weight="700" fill="${link.wavelengthNm === 1510 ? '#0284c7' : '#64748b'}" text-anchor="middle">OSC 1510</text>
        <text x="30" y="32" font-size="9" fill="var(--text-muted, #64748b)" text-anchor="middle">1510.0 nm</text>
      </g>

      <!-- EDFA C-Band Payload Window (1528nm - 1565nm) -->
      <g transform="translate(220, 26)">
        <rect x="0" y="0" width="410" height="42" rx="4" fill="url(#cbandGradient)" stroke="#8b5cf6" stroke-dasharray="4,3" stroke-width="1.2" />
        <text x="205" y="18" font-size="11" font-weight="700" fill="#6d28d9" text-anchor="middle">DWDM / CWDM C-BAND AMPLIFIED PAYLOAD WINDOW (1528 nm - 1565 nm)</text>
        <text x="205" y="32" font-size="9" fill="#7c3aed" text-anchor="middle">Amplified by EDFA Spans (OSC Bypasses EDFA via Optical Demux Filter to avoid ASE Noise)</text>
      </g>

      <!-- 1610nm OSC Marker -->
      <g transform="translate(710, 26)">
        <rect x="0" y="0" width="60" height="42" rx="4" fill="${link.wavelengthNm === 1610 ? '#0284c7' : '#94a3b8'}" fill-opacity="0.25" stroke="${link.wavelengthNm === 1610 ? '#0284c7' : '#94a3b8'}" stroke-width="1.5" />
        <text x="30" y="18" font-size="10" font-weight="700" fill="${link.wavelengthNm === 1610 ? '#0284c7' : '#64748b'}" text-anchor="middle">OSC 1610</text>
        <text x="30" y="32" font-size="9" fill="var(--text-muted, #64748b)" text-anchor="middle">1610.0 nm</text>
      </g>
    </g>

    <!-- SECTION 2: Transponder & Optical Loopback Path Schematic (Middle) -->
    <g transform="translate(24, 106)">
      <text x="0" y="12" font-size="12" font-weight="700" fill="var(--text-color, #0f172a)">TRANSPONDER SCHEMATIC &amp; REMOTE LOOPBACK STATE</text>
      <text x="852" y="12" font-size="11" font-weight="600" fill="#8b5cf6" text-anchor="end">${link.loopbackDesc}</text>

      <!-- Schematic Border Box -->
      <rect x="0" y="22" width="852" height="150" rx="8" fill="var(--surface-alt, #f8fafc)" stroke="var(--border-color, #e2e8f0)" />

      <!-- Near-End Terminal Node (Left) -->
      <g transform="translate(20, 36)">
        <rect x="0" y="0" width="160" height="120" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #cbd5e1)" stroke-width="1.5" />
        <text x="80" y="20" font-size="11" font-weight="700" fill="var(--text-color, #0f172a)" text-anchor="middle">NEAR-END NODE</text>
        <text x="80" y="34" font-size="9" fill="var(--text-muted, #64748b)" text-anchor="middle">Shahdara OLT Central Office</text>
        
        <!-- Near-end Transceiver Sub-block -->
        <rect x="15" y="44" width="130" height="34" rx="4" fill="#0284c7" fill-opacity="0.1" stroke="#0284c7" />
        <text x="80" y="58" font-size="10" font-weight="700" fill="#0284c7" text-anchor="middle">${link.transponderModel.split(' ')[0]} OSC ASIC</text>
        <text x="80" y="70" font-size="9" fill="var(--text-muted, #64748b)" text-anchor="middle">Tx: +${link.txPowerDbm} dBm · ${link.normalBitrateMbps}M</text>

        <!-- Near-End Loopback Indicator -->
        ${link.loopbackMode === OSC_CONSTANTS.LOOPBACK_MODES.TERMINAL ? `
          <path d="M 30,85 C 30,105 130,105 130,85" fill="none" stroke="#8b5cf6" stroke-width="2.5" marker-end="url(#loopbackArrowHead)" />
          <text x="80" y="112" font-size="9" font-weight="700" fill="#8b5cf6" text-anchor="middle">TERMINAL ASIC LOOP</text>
        ` : `
          <text x="80" y="102" font-size="9" fill="#10b981" text-anchor="middle">✓ Transceiver Normal</text>
        `}
      </g>

      <!-- Optical Fiber Span & WDM Filters (Center) -->
      <g transform="translate(195, 46)">
        <!-- WDM Mux Filter Left -->
        <polygon points="0,20 25,0 25,80 0,60" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.2" />
        <text x="12" y="44" font-size="8" font-weight="600" fill="#475569" text-anchor="middle">WDM</text>

        <!-- Fiber Line Cable -->
        <line x1="25" y1="40" x2="425" y2="40" stroke="url(#fiberSpanGrad)" stroke-width="5" stroke-linecap="round" />
        <text x="225" y="32" font-size="11" font-weight="700" fill="var(--text-color, #0f172a)" text-anchor="middle">${link.spanLengthKm} km G.652.D SMF · Attenuation: ${link.totalAttenuationDb} dB</text>
        <text x="225" y="58" font-size="9" fill="var(--text-muted, #64748b)" text-anchor="middle">Route: ${link.feederRoute} (${link.baseSpliceCount} Splices, Loss Coeff: ${link.effectiveFiberLossCoeff} dB/km)</text>

        <!-- Signal direction arrows -->
        ${link.loopbackMode !== OSC_CONSTANTS.LOOPBACK_MODES.TERMINAL ? `
          <line x1="100" y1="40" x2="160" y2="40" stroke="#0284c7" stroke-width="2" marker-end="url(#arrowHead)" />
          <line x1="300" y1="40" x2="360" y2="40" stroke="#0284c7" stroke-width="2" marker-end="url(#arrowHead)" />
        ` : `
          <line x1="100" y1="40" x2="360" y2="40" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4,4" />
          <text x="225" y="72" font-size="9" fill="#8b5cf6" text-anchor="middle">LINE QUIET (Local Terminal Loopback Active)</text>
        `}

        ${link.loopbackMode === OSC_CONSTANTS.LOOPBACK_MODES.PRBS31 ? `
          <rect x="140" y="70" width="170" height="20" rx="4" fill="#8b5cf6" fill-opacity="0.15" stroke="#8b5cf6" />
          <text x="225" y="84" font-size="9" font-weight="700" fill="#7c3aed" text-anchor="middle">PRBS-31 INJECTION PATTERN</text>
        ` : ''}

        <!-- WDM Demux Filter Right -->
        <polygon points="425,0 450,20 450,60 425,80" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.2" />
        <text x="438" y="44" font-size="8" font-weight="600" fill="#475569" text-anchor="middle">WDM</text>
      </g>

      <!-- Far-End Remote Terminal Node (Right) -->
      <g transform="translate(670, 36)">
        <rect x="0" y="0" width="160" height="120" rx="6" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #cbd5e1)" stroke-width="1.5" />
        <text x="80" y="20" font-size="11" font-weight="700" fill="var(--text-color, #0f172a)" text-anchor="middle">FAR-END NODE</text>
        <text x="80" y="34" font-size="9" fill="var(--text-muted, #64748b)" text-anchor="middle">${link.primaryArea} Sub-POP</text>

        <!-- Far-end Transceiver Sub-block -->
        <rect x="15" y="44" width="130" height="34" rx="4" fill="#0284c7" fill-opacity="0.1" stroke="#0284c7" />
        <text x="80" y="58" font-size="10" font-weight="700" fill="#0284c7" text-anchor="middle">OSC RECEIVER</text>
        <text x="80" y="70" font-size="9" fill="${statusColor}" text-anchor="middle">Rx: ${link.rxPowerDbm} dBm (Sens: ${link.rxSensitivityDbm})</text>

        <!-- Far-End Loopback Indicator -->
        ${link.loopbackMode === OSC_CONSTANTS.LOOPBACK_MODES.FACILITY ? `
          <path d="M 15,61 C -15,61 -15,100 25,100" fill="none" stroke="#8b5cf6" stroke-width="2.5" marker-end="url(#loopbackArrowHead)" />
          <text x="80" y="112" font-size="9" font-weight="700" fill="#8b5cf6" text-anchor="middle">FACILITY LINE LOOP</text>
        ` : `
          <text x="80" y="102" font-size="9" fill="#10b981" text-anchor="middle">✓ Terminated Far-End</text>
        `}
      </g>
    </g>

    <!-- SECTION 3: Optical Power Budget & Link Margin Gauges (Bottom) -->
    <g transform="translate(24, 305)">
      <rect x="0" y="0" width="852" height="115" rx="8" fill="var(--surface-alt, #f8fafc)" stroke="var(--border-color, #e2e8f0)" />
      
      <!-- Column 1: Power Budget Breakdown -->
      <g transform="translate(18, 18)">
        <text x="0" y="0" font-size="11" font-weight="700" fill="var(--text-color, #0f172a)">OPTICAL LOSS BUDGET WATERFALL</text>
        <text x="0" y="20" font-size="10" fill="var(--text-muted, #64748b)">Tx Launch Power: <tspan font-weight="700" fill="var(--text-color, #0f172a)">+${link.txPowerDbm} dBm</tspan></text>
        <text x="0" y="38" font-size="10" fill="var(--text-muted, #64748b)">Fiber Attenuation (${link.spanLengthKm}km × ${link.effectiveFiberLossCoeff}dB): <tspan font-weight="700" fill="#ef4444">-${link.fiberLossTotalDb} dB</tspan></text>
        <text x="0" y="56" font-size="10" fill="var(--text-muted, #64748b)">Splices (${link.baseSpliceCount}) + Connectors + WDM Filters: <tspan font-weight="700" fill="#ef4444">-${(link.effectiveSpliceLossDb + link.connectorLossDb + link.filterLossDb).toFixed(2)} dB</tspan></text>
        <text x="0" y="74" font-size="10" fill="var(--text-muted, #64748b)">Net Total Span Loss: <tspan font-weight="700" fill="#ef4444">-${link.totalAttenuationDb} dB</tspan></text>
      </g>

      <!-- Column 2: Rx Sensitivity Floor vs Received Power -->
      <g transform="translate(320, 18)">
        <text x="0" y="0" font-size="11" font-weight="700" fill="var(--text-color, #0f172a)">RECEIVER POWER vs SENSITIVITY FLOOR</text>
        
        <rect x="0" y="16" width="240" height="14" rx="7" fill="var(--border-color, #cbd5e1)" />
        <rect x="0" y="16" width="${(240 * marginPercent) / 100}" height="14" rx="7" fill="${statusColor}" />

        <text x="0" y="46" font-size="10" fill="var(--text-muted, #64748b)">Rx: <tspan font-weight="700" fill="${statusColor}">${link.rxPowerDbm} dBm</tspan> (Sens: ${link.rxSensitivityDbm} dBm)</text>
        <text x="0" y="64" font-size="10" fill="var(--text-muted, #64748b)">Optical Link Margin: <tspan font-weight="700" fill="${statusColor}">+${link.linkMarginDb} dB</tspan> (Target: &gt; 6.0 dB)</text>
        <text x="0" y="82" font-size="10" fill="var(--text-muted, #64748b)">Health Tier: <tspan font-weight="700" fill="${statusColor}">${link.status}</tspan></text>
      </g>

      <!-- Column 3: Telemetry BER & Revenue At Risk Callout -->
      <g transform="translate(600, 18)">
        <text x="0" y="0" font-size="11" font-weight="700" fill="var(--text-color, #0f172a)">SIGNAL INTEGRITY &amp; REVENUE</text>
        <text x="0" y="20" font-size="10" fill="var(--text-muted, #64748b)">Bit Error Rate (BER): <tspan font-weight="700" fill="var(--text-color, #0f172a)">1.0 × 10^${link.berExponent}</tspan></text>
        <text x="0" y="38" font-size="10" fill="var(--text-muted, #64748b)">Loopback Mode: <tspan font-weight="700" fill="#8b5cf6">${link.loopbackMode}</tspan></text>
        <text x="0" y="56" font-size="10" fill="var(--text-muted, #64748b)">Subscribers Monitored: <tspan font-weight="700" fill="#0284c7">${link.matchingCount} (${link.activeCount} active)</tspan></text>
        <text x="0" y="74" font-size="10" fill="var(--text-muted, #64748b)">Revenue Exposure: <tspan font-weight="700" fill="${link.revenueAtRisk > 0 ? '#ef4444' : '#10b981'}">${formatPKR(link.revenueAtRisk)} / mo</tspan></text>
      </g>
    </g>
  </svg>`;
}

/**
 * Generates plain text executive briefing audit report
 */
export function generateOscReport(metrics, options = {}) {
  const link = metrics.selectedLink;
  const refDate = options.referenceDate ? new Date(options.referenceDate).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) : new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });

  return `======================================================================
SHAHDARA OPTICAL SUPERVISORY CHANNEL (OSC) & LOOPBACK AUDIT BRIEFING
Generated: ${refDate} PKT
ITU-T G.692 / G.709 Out-of-Band Transport Network Telemetry Register
======================================================================

1. NETWORK FLEET SUMMARY
----------------------------------------------------------------------
Total Monitored Optical Links : ${metrics.totalLinks} links
Total Feeder / Ring Distance  : ${metrics.totalSpanKm} km
Optical Health Classification : ${metrics.overallHealth}
  - Optimal Links (Margin >= 6.0 dB) : ${metrics.optimalCount}
  - Adequate Links (3.0 - 6.0 dB)    : ${metrics.adequateCount}
  - Marginal Links (1.0 - 3.0 dB)    : ${metrics.marginalCount}
  - Critical / LOS Links (< 1.0 dB)  : ${metrics.criticalCount}
Active Diagnostic Loopbacks   : ${metrics.activeLoopbackCount} active
Total Active Subscribers      : ${metrics.totalSubscribersMonitored}
Total Revenue At Risk         : ${formatPKR(metrics.totalRevenueAtRisk)} / month
Total Outstanding Dues At Risk: ${formatPKR(metrics.totalDuesAtRisk)}

2. AUDITED LINK TELEMETRY DETAILS
----------------------------------------------------------------------
Link Name         : ${link.name}
Supervisory Wave  : ${link.wavelengthNm} nm (ITU-T Out-of-Band)
Transponder Model : ${link.transponderModel}
Feeder Span Path  : ${link.feederRoute}
Primary Area      : ${link.primaryArea}
Span Length       : ${link.spanLengthKm} km
Optical Round Trip: ${link.propagationDelayUs} microseconds (RTT)
Transceiver Speed : ${link.normalBitrateMbps} Mbps (Supervisory Channel)

3. OPTICAL POWER BUDGET & ATTENUATION
----------------------------------------------------------------------
Tx Launch Optical Power       : +${link.txPowerDbm} dBm
Effective Fiber Loss Coeff    : ${link.effectiveFiberLossCoeff} dB/km
Fiber Core Attenuation        : ${link.fiberLossTotalDb} dB
Splice Insertion Loss         : ${link.effectiveSpliceLossDb} dB (${link.baseSpliceCount} fusion splices)
Connector / Patch Loss        : ${link.connectorLossDb} dB
WDM Filter Insertion Loss     : ${link.filterLossDb} dB (Dual Mux/Demux filters)
Total Span Optical Loss       : ${link.totalAttenuationDb} dB
Rx Received Optical Power     : ${link.rxPowerDbm} dBm
Receiver Sensitivity Floor    : ${link.rxSensitivityDbm} dBm
Optical Link Margin           : +${link.linkMarginDb} dB
Estimated Bit Error Rate (BER): 1.0 x 10^${link.berExponent}
Optical Health Tier           : ${link.status}

4. DIAGNOSTIC LOOPBACK & SUBSCRIBER EXPOSURE
----------------------------------------------------------------------
Active Loopback Mode          : ${link.loopbackMode}
Loopback Status Description   : ${link.loopbackDesc}
Loopback Active Status        : ${link.loopbackActive ? 'ACTIVE MAINTENANCE' : 'INACTIVE (NORMAL DUPLEX)'}
Matching Area Subscribers    : ${link.matchingCount} (${link.activeCount} active, ${link.offlineCount} offline)
Total Monthly Billing Volume  : ${formatPKR(link.totalBilledRevenue)}
Total Outstanding Balances    : ${formatPKR(link.totalOutstandingDues)}
Immediate Revenue Exposure    : ${formatPKR(link.revenueAtRisk)}

======================================================================
RECOMMENDED FIELD ACTIONS:
${link.status === 'OPTIMAL' ? '✓ Link operating at peak optical performance. No maintenance required.' : link.status === 'ADEQUATE' ? 'ℹ Link within operational specifications. Plan scheduled OTDR verification.' : link.status === 'MARGINAL' ? '⚠ Optical margin degraded. Inspect splice trays and patch cord bend radius.' : '🚨 CRITICAL ATTENUATION / LOS. Dispatch optical emergency crew immediately.'}
======================================================================`;
}

/**
 * Initializes and wires the interactive OSC Telemetry & Loopback Modal Dialog
 */
export function setupOscModal(state, options = {}) {
  const modal = document.getElementById('dashboardOscModal');
  const openBtn = document.getElementById('dashboardOpenOscModalBtn');
  const closeBtn = document.getElementById('dashboardOscModalCloseBtn');

  const linkSelect = document.getElementById('oscLinkSelect');
  const fiberLossSlider = document.getElementById('oscFiberLossSlider');
  const fiberLossVal = document.getElementById('oscFiberLossVal');
  const spliceLossSlider = document.getElementById('oscSpliceLossSlider');
  const spliceLossVal = document.getElementById('oscSpliceLossVal');
  const loopbackModeSelect = document.getElementById('oscLoopbackModeSelect');
  const resetBtn = document.getElementById('oscResetSimBtn');

  // KPI elements
  const kpiLinkName = document.getElementById('oscKpiLinkName');
  const kpiRxPower = document.getElementById('oscKpiRxPower');
  const kpiMargin = document.getElementById('oscKpiMargin');
  const statusBadge = document.getElementById('oscStatusBadge');
  const kpiRevenueRisk = document.getElementById('oscKpiRevenueRisk');

  // Visualization container
  const chartWrap = document.getElementById('oscModalChartWrap');
  const tableBody = document.getElementById('oscLinksTableBody');

  // Action buttons
  const filterAreaBtn = document.getElementById('oscFilterAreaBtn');
  const copyReportBtn = document.getElementById('dashboardCopyOscReportBtn');

  function refreshModalView() {
    const metrics = calculateOscMetrics(state, options);
    const link = metrics.selectedLink;

    if (kpiLinkName) kpiLinkName.textContent = link.name;
    if (kpiRxPower) kpiRxPower.textContent = `${link.rxPowerDbm} dBm`;
    if (kpiMargin) kpiMargin.textContent = `+${link.linkMarginDb} dB`;
    
    if (statusBadge) {
      statusBadge.textContent = link.status;
      statusBadge.className = `sim-delta-badge ${link.badgeClass}`;
    }

    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(link.revenueAtRisk)} at risk (${link.activeCount} subs)`;
    }

    if (chartWrap) {
      chartWrap.innerHTML = renderOscTelemetrySvg(metrics, { compact: false });
    }

    if (tableBody) {
      tableBody.innerHTML = metrics.allLinks.map(l => `
        <tr class="${l.id === link.id ? 'active-row' : ''}">
          <td style="font-weight: 600;">${l.name}</td>
          <td>${l.spanLengthKm} km</td>
          <td>${l.wavelengthNm} nm</td>
          <td>${l.rxPowerDbm} dBm</td>
          <td style="font-weight: 700; color: ${l.linkMarginDb >= 6 ? '#10b981' : l.linkMarginDb >= 3 ? '#0284c7' : '#ef4444'};">+${l.linkMarginDb} dB</td>
          <td>10^${l.berExponent}</td>
          <td><span class="sim-delta-badge ${l.badgeClass}">${l.status}</span></td>
          <td><span class="sim-delta-badge ${l.loopbackActive ? 'badge-warning' : 'badge-info'}">${l.loopbackMode}</span></td>
          <td>${formatPKR(l.revenueAtRisk)}</td>
        </tr>
      `).join('');
    }
  }

  function populateDropdowns() {
    if (linkSelect) {
      linkSelect.innerHTML = SHAHDARA_OSC_LINKS.map(l => `
        <option value="${l.id}" ${l.id === currentSelectedLinkId ? 'selected' : ''}>
          ${l.name} (${l.spanLengthKm} km)
        </option>
      `).join('');
    }

    if (loopbackModeSelect) {
      loopbackModeSelect.innerHTML = Object.values(OSC_CONSTANTS.LOOPBACK_MODES).map(mode => `
        <option value="${mode}" ${mode === currentLoopbackMode ? 'selected' : ''}>
          ${mode === 'NORMAL' ? 'NORMAL (Operational Duplex)' : mode === 'TERMINAL' ? 'TERMINAL (ASIC Loopback)' : mode === 'FACILITY' ? 'FACILITY (Far-End Line Loop)' : 'PRBS-31 (BERT Test Pattern)'}
        </option>
      `).join('');
    }

    if (fiberLossSlider) {
      fiberLossSlider.value = currentFiberLossDelta.toString();
    }
    if (fiberLossVal) {
      fiberLossVal.textContent = `+${currentFiberLossDelta.toFixed(2)} dB/km`;
    }

    if (spliceLossSlider) {
      spliceLossSlider.value = currentSpliceLossDelta.toString();
    }
    if (spliceLossVal) {
      spliceLossVal.textContent = `+${currentSpliceLossDelta.toFixed(2)} dB`;
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

  if (linkSelect) {
    linkSelect.onchange = (e) => {
      setOscSelectedLink(e.target.value);
      populateDropdowns();
      refreshModalView();
    };
  }

  if (fiberLossSlider) {
    fiberLossSlider.oninput = (e) => {
      const val = Number(e.target.value);
      setOscFiberLossDelta(val);
      if (fiberLossVal) fiberLossVal.textContent = `+${val.toFixed(2)} dB/km`;
      refreshModalView();
    };
  }

  if (spliceLossSlider) {
    spliceLossSlider.oninput = (e) => {
      const val = Number(e.target.value);
      setOscSpliceLossDelta(val);
      if (spliceLossVal) spliceLossVal.textContent = `+${val.toFixed(2)} dB`;
      refreshModalView();
    };
  }

  if (loopbackModeSelect) {
    loopbackModeSelect.onchange = (e) => {
      setOscLoopbackMode(e.target.value);
      refreshModalView();
    };
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      resetOscSimState();
      populateDropdowns();
      refreshModalView();
    };
  }

  if (filterAreaBtn) {
    filterAreaBtn.onclick = () => {
      const metrics = calculateOscMetrics(state, options);
      const link = metrics.selectedLink;
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(link.primaryArea);
        if (modal && typeof modal.close === 'function') {
          modal.close();
        }
      }
    };
  }

  if (copyReportBtn) {
    copyReportBtn.onclick = async () => {
      const metrics = calculateOscMetrics(state, options);
      const report = generateOscReport(metrics, options);
      const clipboard = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      let success = false;
      if (clipboard && typeof clipboard.writeText === 'function') {
        try {
          await clipboard.writeText(report);
          success = true;
        } catch (_) {}
      }
      if (typeof options.onToast === 'function') {
        options.onToast(success ? '✓ OSC Telemetry Briefing copied to clipboard' : 'Report generated in console');
      }
    };
  }
}
