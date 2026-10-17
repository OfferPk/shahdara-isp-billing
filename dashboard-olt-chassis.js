import { formatPKR } from './core.js';

/**
 * Carrier Optical Line Terminal (OLT) Chassis Line Card & PON Splitter Saturation Matrix
 * Standards: ITU-T G.984 (GPON Class C+), ITU-T G.9807.1 (XGS-PON Class N1), IEC 61753-022-2
 * Area: agent1 (shahdara-dashboard) - KPIs, Charts, SVG Elevation & Optical Budget Telemetry
 */

export const OLT_CHASSIS_CONSTANTS = {
  DEFAULT_CHASSIS_ID: 'olt-shahdara-central-x17',

  STANDARDS: {
    GPON: 'GPON (ITU-T G.984 Class C+)',
    XGS_PON: 'XGS-PON (ITU-T G.9807.1 Class N1)',
    COMBO_PON: 'Combo PON (Simultaneous GPON + XGS-PON)'
  },

  OPTICAL_BUDGET: {
    GPON_TX_DBM: 4.5,
    GPON_SENSITIVITY_DBM: -28.0,
    GPON_MAX_BUDGET_DB: 32.5,

    XGS_TX_DBM: 6.0,
    XGS_SENSITIVITY_DBM: -29.0,
    XGS_MAX_BUDGET_DB: 35.0,

    FIBER_ATTENUATION_DB_PER_KM: 0.35, // 1310/1490nm average attenuation
    CONNECTOR_LOSS_PER_PAIR_DB: 0.30,
    TYPICAL_CONNECTORS_COUNT: 4, // OLT patch, ODF, FDT, FAT
    SPLICE_LOSS_PER_KM_DB: 0.05
  },

  SPLITTER_LOSSES_DB: {
    '1:2': 3.5,
    '1:4': 7.0,
    '1:8': 10.3,
    '1:16': 13.5,
    '1:32': 16.8,
    '1:64': 20.2,
    '1:128': 23.6
  },

  MAX_ONUS_PER_PORT: {
    GPON: 64,
    XGS_PON: 128,
    COMBO_PON: 128
  },

  STATUS: {
    OPTIMAL: 'Optimal Margin & Capacity',
    CAPACITY_WARNING: 'High Port Saturation (>=85%)',
    OPTICAL_DEFICIT: 'Low Optical Margin (<1.5 dB)',
    PORT_SATURATED: 'Port Capacity Saturated (100%)'
  }
};

export const SHAHDARA_OLT_CHASSIS = [
  {
    id: 'olt-shahdara-central-x17',
    name: 'Shahdara Town Hall Central CO Modular OLT Chassis',
    chassisCode: 'OLT-CH-01',
    model: 'Huawei SmartAX MA5800-X17 High-Capacity Multi-Service Chassis',
    primaryArea: 'Shahdara Town',
    secondaryAreas: ['Baradari', 'Begum Kot'],
    standard: OLT_CHASSIS_CONSTANTS.STANDARDS.COMBO_PON,
    installedSlotsCount: 12,
    totalSlotsAvailable: 17,
    portsPerSlot: 16,
    totalInstalledPorts: 192,
    activeSubscribers: 8840,
    defaultSplitRatio: '1:64',
    averageDropDistanceKm: 5.4,
    switchingFabricGbps: 400,
    monthlyRevenuePkr: 4200000,
    coFacility: 'Central Office Headend - Room A',
    powerDrawWatts: 1450
  },
  {
    id: 'olt-begum-kot-x7',
    name: 'Begum Kot Industrial Ring OLT Chassis',
    chassisCode: 'OLT-CH-02',
    model: 'ZTE Titan C600 Modular Optical Access Chassis',
    primaryArea: 'Begum Kot',
    secondaryAreas: ['Shahdara Town', 'Vandala Road'],
    standard: OLT_CHASSIS_CONSTANTS.STANDARDS.GPON,
    installedSlotsCount: 6,
    totalSlotsAvailable: 7,
    portsPerSlot: 16,
    totalInstalledPorts: 96,
    activeSubscribers: 4680,
    defaultSplitRatio: '1:64',
    averageDropDistanceKm: 6.8,
    switchingFabricGbps: 200,
    monthlyRevenuePkr: 2850000,
    coFacility: 'Begum Kot Ring Substation Shelter',
    powerDrawWatts: 820
  },
  {
    id: 'olt-baradari-hub-x7',
    name: 'Baradari High-Density FTTH Distribution Hub Chassis',
    chassisCode: 'OLT-CH-03',
    model: 'Huawei SmartAX MA5800-X7 Modular Chassis',
    primaryArea: 'Baradari',
    secondaryAreas: ['Shahdara Town'],
    standard: OLT_CHASSIS_CONSTANTS.STANDARDS.GPON,
    installedSlotsCount: 5,
    totalSlotsAvailable: 7,
    portsPerSlot: 16,
    totalInstalledPorts: 80,
    activeSubscribers: 4120,
    defaultSplitRatio: '1:64',
    averageDropDistanceKm: 4.2,
    switchingFabricGbps: 200,
    monthlyRevenuePkr: 2150000,
    coFacility: 'Baradari Telehouse Node',
    powerDrawWatts: 690
  },
  {
    id: 'olt-vandala-compact',
    name: 'Vandala Road Feeder Compact Access Chassis',
    chassisCode: 'OLT-CH-04',
    model: 'Nokia 7360 ISAM FX-4 Compact Modular OLT',
    primaryArea: 'Vandala Road',
    secondaryAreas: ['Begum Kot'],
    standard: OLT_CHASSIS_CONSTANTS.STANDARDS.GPON,
    installedSlotsCount: 3,
    totalSlotsAvailable: 4,
    portsPerSlot: 16,
    totalInstalledPorts: 48,
    activeSubscribers: 2240,
    defaultSplitRatio: '1:64',
    averageDropDistanceKm: 7.5,
    switchingFabricGbps: 100,
    monthlyRevenuePkr: 1180000,
    coFacility: 'Vandala Exchange Hut',
    powerDrawWatts: 420
  },
  {
    id: 'olt-ravi-siphon-micro',
    name: 'Ravi Siphon Edge Remote Hardened Pizza-Box OLT',
    chassisCode: 'OLT-CH-05',
    model: 'Huawei SmartAX MA5801-GP16 Outdoor Hardened 1U Unit',
    primaryArea: 'Ravi Siphon',
    secondaryAreas: ['Baradari'],
    standard: OLT_CHASSIS_CONSTANTS.STANDARDS.GPON,
    installedSlotsCount: 1,
    totalSlotsAvailable: 1,
    portsPerSlot: 16,
    totalInstalledPorts: 16,
    activeSubscribers: 780,
    defaultSplitRatio: '1:64',
    averageDropDistanceKm: 8.9,
    switchingFabricGbps: 40,
    monthlyRevenuePkr: 760000,
    coFacility: 'Ravi Bridge Pole-Mounted Cabinet',
    powerDrawWatts: 180
  }
];

/**
 * Calculates optical insertion loss of a cascading passive splitter stage
 * @param {string} splitRatio - e.g. '1:32', '1:64', '1:128'
 * @returns {number} Splitter insertion loss in dB
 */
export function calculateSplitterLossDb(splitRatio) {
  return OLT_CHASSIS_CONSTANTS.SPLITTER_LOSSES_DB[splitRatio] || OLT_CHASSIS_CONSTANTS.SPLITTER_LOSSES_DB['1:64'];
}

/**
 * Calculates chassis port capacity, optical link margin, and power metrics
 * @param {Object} chassis - OLT chassis definition
 * @param {Object} overrides - Interactive simulation parameters
 * @returns {Object} Calculated dynamics and telemetry
 */
export function calculateOltChassisDynamics(chassis, overrides = {}) {
  const c = chassis || SHAHDARA_OLT_CHASSIS[0];

  const splitRatio = overrides.splitRatio || c.defaultSplitRatio || '1:64';
  const installedSlots = overrides.installedSlots !== undefined
    ? Number(overrides.installedSlots)
    : c.installedSlotsCount;

  const totalPorts = installedSlots * c.portsPerSlot;

  // Max ONUs per port depends on standard (GPON: 64, XGS: 128)
  const isXgs = c.standard.includes('XGS') || c.standard.includes('Combo');
  const maxOnusPerPort = isXgs
    ? OLT_CHASSIS_CONSTANTS.MAX_ONUS_PER_PORT.XGS_PON
    : OLT_CHASSIS_CONSTANTS.MAX_ONUS_PER_PORT.GPON;

  const maxTotalSubscribers = totalPorts * maxOnusPerPort;

  const activeSubs = overrides.activeSubscribers !== undefined
    ? Number(overrides.activeSubscribers)
    : c.activeSubscribers;

  const dropDistanceKm = overrides.dropDistanceKm !== undefined
    ? Number(overrides.dropDistanceKm)
    : c.averageDropDistanceKm;

  // Port Saturation Rate
  const portSaturationPct = maxTotalSubscribers > 0
    ? Math.min(100, Math.round((activeSubs / maxTotalSubscribers) * 1000) / 10)
    : 0;

  const avgSubscribersPerPort = totalPorts > 0
    ? Math.round((activeSubs / totalPorts) * 10) / 10
    : 0;

  // Optical Budget & Received Sensitivity Margin
  const txPowerDbm = isXgs
    ? OLT_CHASSIS_CONSTANTS.OPTICAL_BUDGET.XGS_TX_DBM
    : OLT_CHASSIS_CONSTANTS.OPTICAL_BUDGET.GPON_TX_DBM;

  const rxSensitivityDbm = isXgs
    ? OLT_CHASSIS_CONSTANTS.OPTICAL_BUDGET.XGS_SENSITIVITY_DBM
    : OLT_CHASSIS_CONSTANTS.OPTICAL_BUDGET.GPON_SENSITIVITY_DBM;

  const splitterLossDb = calculateSplitterLossDb(splitRatio);
  const fiberLossDb = Math.round(dropDistanceKm * (OLT_CHASSIS_CONSTANTS.OPTICAL_BUDGET.FIBER_ATTENUATION_DB_PER_KM + OLT_CHASSIS_CONSTANTS.OPTICAL_BUDGET.SPLICE_LOSS_PER_KM_DB) * 100) / 100;
  const connectorLossDb = OLT_CHASSIS_CONSTANTS.OPTICAL_BUDGET.TYPICAL_CONNECTORS_COUNT * OLT_CHASSIS_CONSTANTS.OPTICAL_BUDGET.CONNECTOR_LOSS_PER_PAIR_DB;

  const totalLinkLossDb = Math.round((splitterLossDb + fiberLossDb + connectorLossDb) * 100) / 100;
  const receivedPowerDbm = Math.round((txPowerDbm - totalLinkLossDb) * 100) / 100;
  const opticalMarginDb = Math.round((receivedPowerDbm - rxSensitivityDbm) * 100) / 100;

  // Slot utilization
  const slotUtilizationPct = Math.round((installedSlots / c.totalSlotsAvailable) * 100);

  // Status & SLA Penalty Evaluation
  let status = OLT_CHASSIS_CONSTANTS.STATUS.OPTIMAL;
  let statusColor = '#10b981';
  let penaltyRebatePct = 0;

  if (opticalMarginDb < 1.0) {
    status = OLT_CHASSIS_CONSTANTS.STATUS.OPTICAL_DEFICIT;
    statusColor = '#ef4444';
    penaltyRebatePct = 15;
  } else if (portSaturationPct >= 95.0) {
    status = OLT_CHASSIS_CONSTANTS.STATUS.PORT_SATURATED;
    statusColor = '#ef4444';
    penaltyRebatePct = 10;
  } else if (portSaturationPct >= 85.0 || opticalMarginDb < 2.5) {
    status = OLT_CHASSIS_CONSTANTS.STATUS.CAPACITY_WARNING;
    statusColor = '#f59e0b';
    penaltyRebatePct = 5;
  }

  const penaltyPkr = Math.round((c.monthlyRevenuePkr * penaltyRebatePct) / 100);

  return {
    chassisId: c.id,
    chassisName: c.name,
    chassisCode: c.chassisCode,
    model: c.model,
    primaryArea: c.primaryArea,
    secondaryAreas: c.secondaryAreas || [],
    standard: c.standard,
    coFacility: c.coFacility,
    monthlyRevenuePkr: c.monthlyRevenuePkr,
    powerDrawWatts: c.powerDrawWatts,
    switchingFabricGbps: c.switchingFabricGbps,

    // Configured Parameters
    splitRatio,
    installedSlots,
    totalSlotsAvailable: c.totalSlotsAvailable,
    portsPerSlot: c.portsPerSlot,
    totalPorts,
    maxOnusPerPort,
    maxTotalSubscribers,
    activeSubscribers: activeSubs,
    dropDistanceKm,

    // Utilization KPIs
    slotUtilizationPct,
    portSaturationPct,
    avgSubscribersPerPort,

    // Optical Budget Telemetry
    txPowerDbm,
    rxSensitivityDbm,
    splitterLossDb,
    fiberLossDb,
    connectorLossDb,
    totalLinkLossDb,
    receivedPowerDbm,
    opticalMarginDb,

    // Health & SLA
    status,
    statusColor,
    penaltyRebatePct,
    penaltyPkr
  };
}

/**
 * Aggregates fleet metrics across all Shahdara Central Office OLT chassis
 * @param {Array} chassisList - List of OLT chassis
 * @param {Object} state - Application state
 * @returns {Object} Fleet metrics
 */
export function calculateOltChassisMetrics(chassisList = SHAHDARA_OLT_CHASSIS, state = {}) {
  const list = Array.isArray(chassisList) && chassisList.length > 0 ? chassisList : SHAHDARA_OLT_CHASSIS;

  let totalChassis = list.length;
  let totalPorts = 0;
  let totalSubscribers = 0;
  let totalMaxCapacity = 0;
  let totalRevenuePkr = 0;
  let totalPenaltiesPkr = 0;
  let totalPowerWatts = 0;
  let optimalCount = 0;
  let warningCount = 0;
  let deficitCount = 0;

  const evaluatedChassis = list.map(c => {
    const d = calculateOltChassisDynamics(c);
    totalPorts += d.totalPorts;
    totalSubscribers += d.activeSubscribers;
    totalMaxCapacity += d.maxTotalSubscribers;
    totalRevenuePkr += d.monthlyRevenuePkr;
    totalPenaltiesPkr += d.penaltyPkr;
    totalPowerWatts += d.powerDrawWatts;

    if (d.status === OLT_CHASSIS_CONSTANTS.STATUS.OPTICAL_DEFICIT || d.status === OLT_CHASSIS_CONSTANTS.STATUS.PORT_SATURATED) {
      deficitCount++;
    } else if (d.status === OLT_CHASSIS_CONSTANTS.STATUS.CAPACITY_WARNING) {
      warningCount++;
    } else {
      optimalCount++;
    }

    return d;
  });

  const fleetSaturationPct = totalMaxCapacity > 0
    ? Math.round((totalSubscribers / totalMaxCapacity) * 1000) / 10
    : 0;

  return {
    totalChassis,
    totalPorts,
    totalSubscribers,
    totalMaxCapacity,
    fleetSaturationPct,
    totalRevenuePkr,
    totalPenaltiesPkr,
    totalPowerWatts,
    optimalCount,
    warningCount,
    deficitCount,
    evaluatedChassis
  };
}

/**
 * Renders pure vector SVG diagram of OLT chassis elevation and optical splitter tree
 * @param {Object} dynamics - Chassis dynamics from calculateOltChassisDynamics
 * @param {Object} options - Rendering options (isCompact: boolean)
 * @returns {string} SVG markup string
 */
export function renderOltChassisDiagramSvg(dynamics, options = {}) {
  const d = dynamics || calculateOltChassisDynamics(SHAHDARA_OLT_CHASSIS[0]);
  const isCompact = Boolean(options.isCompact);

  if (isCompact) {
    // Compact card SVG: Chassis Front Slot Grid + Optical Budget Gauge
    const width = 360;
    const height = 150;

    const satBarWidth = Math.round((Math.min(100, d.portSaturationPct) / 100) * 260);
    const satColor = d.portSaturationPct >= 85 ? '#f59e0b' : '#10b981';

    return `<svg class="olt-chassis-svg olt-compact-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Carrier OLT Chassis and Port Capacity Summary">
      <rect width="${width}" height="${height}" rx="8" fill="var(--bg-card, #1e293b)" stroke="var(--border, #334155)"/>

      <!-- Header -->
      <text x="20" y="24" fill="#38bdf8" font-size="10.5" font-weight="700">OPTICAL OLT CHASSIS MATRIX</text>
      <text x="340" y="24" fill="${d.statusColor}" font-size="9.5" font-weight="700" text-anchor="end">${d.status}</text>

      <!-- Port Saturation Bar -->
      <text x="20" y="45" fill="var(--text-muted, #94a3b8)" font-size="8.5">CHASSIS PORT SATURATION: <tspan fill="#e2e8f0" font-weight="700">${d.portSaturationPct}%</tspan> (${d.activeSubscribers} / ${d.maxTotalSubscribers})</text>
      <rect x="20" y="52" width="260" height="12" rx="3" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <rect x="20" y="52" width="${satBarWidth}" height="12" rx="3" fill="${satColor}"/>
      <text x="290" y="62" fill="var(--text-muted, #94a3b8)" font-size="8.5" font-weight="600">${d.totalPorts} Ports</text>

      <!-- Slot Schematic representation -->
      <g transform="translate(20, 75)">
        <text x="0" y="10" fill="var(--text-muted, #94a3b8)" font-size="8">SLOT ELEVATION (${d.installedSlots}/${d.totalSlotsAvailable} Installed):</text>
        <rect x="0" y="15" width="320" height="18" rx="2" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
        ${Array.from({ length: 17 }).map((_, i) => {
          const slotX = i * 18.5 + 2;
          const isInstalled = i < d.installedSlots;
          const fill = isInstalled ? '#38bdf8' : 'none';
          return `<rect x="${slotX}" y="17" width="16" height="14" rx="1.5" fill="${fill}" opacity="${isInstalled ? '0.85' : '0.15'}" stroke="var(--border, #334155)"/>`;
        }).join('')}
      </g>

      <!-- Bottom telemetry metrics row -->
      <rect x="15" y="112" width="105" height="26" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <text x="67" y="123" fill="var(--text-muted, #94a3b8)" font-size="7.5" text-anchor="middle">OPTICAL MARGIN</text>
      <text x="67" y="133" fill="${d.opticalMarginDb < 2.0 ? '#f59e0b' : '#10b981'}" font-size="9" font-weight="700" text-anchor="middle">+${d.opticalMarginDb} dB</text>

      <rect x="128" y="112" width="105" height="26" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <text x="180" y="123" fill="var(--text-muted, #94a3b8)" font-size="7.5" text-anchor="middle">SPLIT RATIO</text>
      <text x="180" y="133" fill="#a78bfa" font-size="9" font-weight="700" text-anchor="middle">${d.splitRatio} (${d.splitterLossDb} dB)</text>

      <rect x="240" y="112" width="105" height="26" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <text x="292" y="123" fill="var(--text-muted, #94a3b8)" font-size="7.5" text-anchor="middle">RX SENSITIVITY</text>
      <text x="292" y="133" fill="#38bdf8" font-size="9" font-weight="700" text-anchor="middle">${d.receivedPowerDbm} dBm</text>
    </svg>`;
  }

  // Expanded detailed SVG diagram for Modal
  const width = 800;
  const height = 430;

  return `<svg class="olt-chassis-svg olt-expanded-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Optical Line Terminal Chassis Slot Architecture and Splitter Loss Budget">
    <rect width="${width}" height="${height}" rx="10" fill="var(--bg-card, #1e293b)" stroke="var(--border, #334155)"/>

    <!-- PANEL 1: CHASSIS HARDWARE ELEVATION & LINE CARDS -->
    <rect x="25" y="20" width="750" height="185" rx="6" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="40" y="42" fill="#38bdf8" font-size="12" font-weight="700">PANEL 1: MODULAR OLT CHASSIS SLOT ELEVATION (${d.model})</text>
    <text x="755" y="42" fill="var(--text-muted, #94a3b8)" font-size="10" text-anchor="end">Facility: ${d.coFacility} | Power: ${d.powerDrawWatts} W</text>

    <!-- Main Chassis Outer Frame -->
    <rect x="40" y="60" width="720" height="125" rx="4" fill="#1e293b" stroke="#475569" stroke-width="2"/>

    <!-- Power & Fan Tray / MPU Fabric -->
    <rect x="50" y="70" width="80" height="105" rx="3" fill="#0f172a" stroke="#334155"/>
    <text x="90" y="90" fill="#a78bfa" font-size="9" font-weight="700" text-anchor="middle">DUAL MPU</text>
    <circle cx="70" cy="115" r="4" fill="#10b981"/>
    <text x="80" y="118" fill="var(--text-muted, #94a3b8)" font-size="8">MPU-0 (Act)</text>
    <circle cx="70" cy="135" r="4" fill="#10b981"/>
    <text x="80" y="138" fill="var(--text-muted, #94a3b8)" font-size="8">MPU-1 (Stby)</text>
    <text x="90" y="160" fill="#38bdf8" font-size="8" text-anchor="middle">${d.switchingFabricGbps}G Fabric</text>

    <!-- 17 Line Card Slots -->
    <g transform="translate(145, 70)">
      ${Array.from({ length: 17 }).map((_, i) => {
        const slotX = i * 35;
        const isInstalled = i < d.installedSlots;
        const fill = isInstalled ? '#1e293b' : '#0f172a';
        const stroke = isInstalled ? '#38bdf8' : '#334155';
        const cardLabel = isInstalled ? `SL-${i + 1}` : 'BLANK';
        const ledFill = isInstalled ? (d.portSaturationPct >= 85 ? '#f59e0b' : '#10b981') : '#475569';

        return `
          <rect x="${slotX}" y="0" width="31" height="105" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>
          <text x="${slotX + 15.5}" y="15" fill="${isInstalled ? '#e2e8f0' : '#64748b'}" font-size="7.5" font-weight="700" text-anchor="middle">${cardLabel}</text>
          <circle cx="${slotX + 15.5}" cy="30" r="3" fill="${ledFill}"/>
          ${isInstalled ? `
            <text x="${slotX + 15.5}" y="52" fill="#38bdf8" font-size="7" text-anchor="middle">16P</text>
            <text x="${slotX + 15.5}" y="65" fill="var(--text-muted, #94a3b8)" font-size="6.5" text-anchor="middle">PON</text>
            <rect x="${slotX + 6}" y="74" width="19" height="24" rx="2" fill="#0f172a" stroke="#334155"/>
            <text x="${slotX + 15.5}" y="88" fill="#10b981" font-size="6" text-anchor="middle">C+</text>
          ` : `
            <line x1="${slotX + 6}" y1="50" x2="${slotX + 25}" y2="50" stroke="#334155"/>
          `}
        `;
      }).join('')}
    </g>

    <!-- PANEL 2: OPTICAL POWER LINK BUDGET & SPLITTER CASCADE -->
    <rect x="25" y="220" width="750" height="195" rx="6" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="40" y="242" fill="#a78bfa" font-size="12" font-weight="700">PANEL 2: ODN PASSIVE SPLITTER &amp; POWER LOSS BUDGET (ITU-T G.984.2)</text>
    <text x="755" y="242" fill="${d.statusColor}" font-size="10" font-weight="700" text-anchor="end">Status: ${d.status}</text>

    <!-- Budget Step Diagram: OLT Tx -> Fiber -> Splitter -> Subscriber ONT -->
    <!-- Node 1: OLT Optical Transceiver -->
    <rect x="50" y="270" width="130" height="80" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="115" y="292" fill="#38bdf8" font-size="10" font-weight="700" text-anchor="middle">OLT SFP+ (Tx)</text>
    <text x="115" y="310" fill="#e2e8f0" font-size="12" font-weight="700" text-anchor="middle">+${d.txPowerDbm} dBm</text>
    <text x="115" y="328" fill="var(--text-muted, #94a3b8)" font-size="8.5" text-anchor="middle">1490nm DFB Laser</text>

    <!-- Fiber Loss Arrow -->
    <path d="M 180 310 L 260 310" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3,3" fill="none"/>
    <text x="220" y="302" fill="#f59e0b" font-size="8.5" font-weight="600" text-anchor="middle">-${d.fiberLossDb} dB</text>
    <text x="220" y="325" fill="var(--text-muted, #94a3b8)" font-size="8" text-anchor="middle">${d.dropDistanceKm} km G.652</text>

    <!-- Node 2: Cascaded Splitter Stage (FDT / FAT) -->
    <rect x="260" y="260" width="170" height="100" rx="4" fill="#1e293b" stroke="#a78bfa" stroke-width="2"/>
    <text x="345" y="282" fill="#a78bfa" font-size="10.5" font-weight="700" text-anchor="middle">ODN SPLITTER STAGE</text>
    <text x="345" y="302" fill="#f59e0b" font-size="12" font-weight="700" text-anchor="middle">-${d.splitterLossDb} dB Loss</text>
    <text x="345" y="320" fill="#e2e8f0" font-size="9" text-anchor="middle">Ratio: ${d.splitRatio} (PLC)</text>
    <text x="345" y="338" fill="var(--text-muted, #94a3b8)" font-size="8" text-anchor="middle">Connectors: -${d.connectorLossDb} dB</text>

    <!-- Drop Cable Arrow -->
    <path d="M 430 310 L 510 310" stroke="#a78bfa" stroke-width="2" fill="none"/>
    <text x="470" y="302" fill="#38bdf8" font-size="8.5" font-weight="600" text-anchor="middle">Drop Cable</text>

    <!-- Node 3: Subscriber ONT Receiver -->
    <rect x="510" y="270" width="230" height="80" rx="4" fill="#1e293b" stroke="${d.opticalMarginDb < 2.0 ? '#f59e0b' : '#10b981'}" stroke-width="1.5"/>
    <text x="625" y="292" fill="#10b981" font-size="10" font-weight="700" text-anchor="middle">SUBSCRIBER ONT (Rx)</text>
    <text x="625" y="312" fill="#e2e8f0" font-size="12" font-weight="700" text-anchor="middle">${d.receivedPowerDbm} dBm</text>
    <text x="625" y="330" fill="${d.opticalMarginDb < 1.5 ? '#ef4444' : '#38bdf8'}" font-size="9" font-weight="700" text-anchor="middle">Margin: +${d.opticalMarginDb} dB (Sens: ${d.rxSensitivityDbm} dBm)</text>

    <!-- Bottom summary row -->
    <text x="40" y="395" fill="var(--text-muted, #94a3b8)" font-size="9">Chassis Ports: <tspan fill="#e2e8f0" font-weight="600">${d.totalPorts} Ports (${d.installedSlots} Cards)</tspan> | Capacity: <tspan fill="#38bdf8" font-weight="600">${d.maxTotalSubscribers} Max Subs</tspan> | Active: <tspan fill="${d.portSaturationPct > 85 ? '#f59e0b' : '#10b981'}" font-weight="700">${d.activeSubscribers} (${d.portSaturationPct}%)</tspan> | Link Budget: <tspan fill="#a78bfa" font-weight="600">Total Loss ${d.totalLinkLossDb} dB</tspan></text>
  </svg>`;
}

/**
 * Generates plain-text OLT chassis optical engineering audit report
 * @param {Object} dynamics - Current chassis dynamics
 * @param {Object} metrics - Fleet metrics
 * @returns {string} Formatted audit report text
 */
export function generateOltChassisReport(dynamics, metrics) {
  const d = dynamics || calculateOltChassisDynamics(SHAHDARA_OLT_CHASSIS[0]);
  const m = metrics || calculateOltChassisMetrics();

  const timestamp = new Date().toISOString();

  return `================================================================================
SHAHDARA ISP OPTICAL ACCESS (OLT CHASSIS) INFRASTRUCTURE REPORT
Standard Compliance: ITU-T G.984 / ITU-T G.9807.1 (XGS-PON) / IEC 61753-022-2
Generated At: ${timestamp}
================================================================================

1. CHASSIS HARDWARE SPECIFICATIONS:
--------------------------------------------------------------------------------
Chassis Identifier:      ${d.chassisCode} (${d.chassisId})
Chassis Description:     ${d.chassisName}
Hardware Model:          ${d.model}
Primary Operational Area:${d.primaryArea}
Secondary Coverage:      ${d.secondaryAreas.join(', ')}
Physical CO Location:    ${d.coFacility}
Optical PON Standard:    ${d.standard}
Switching Fabric Bus:    ${d.switchingFabricGbps} Gbps
DC Power Consumption:    ${d.powerDrawWatts} Watts
Monthly Revenue:         ${formatPKR(d.monthlyRevenuePkr)}

2. LINE CARDS & PORT CAPACITY METRICS:
--------------------------------------------------------------------------------
Installed Service Cards: ${d.installedSlots} of ${d.totalSlotsAvailable} Available Slots (${d.slotUtilizationPct}% Slot Density)
Ports per Card:          ${d.portsPerSlot} Ports / Card
Total Installed Ports:   ${d.totalPorts} Optical PON Interfaces
Max ONUs per PON Port:   ${d.maxOnusPerPort} Terminals
Total Chassis Capacity:  ${d.maxTotalSubscribers} Simultaneous ONT Registrations
Active Connected Subs:   ${d.activeSubscribers} Subscribers
Port Saturation Rate:    ${d.portSaturationPct}%
Average Load per Port:   ${d.avgSubscribersPerPort} ONUs / Port

3. OPTICAL DISTRIBUTION NETWORK (ODN) LOSS BUDGET:
--------------------------------------------------------------------------------
Configured Split Ratio:  ${d.splitRatio} Cascaded Splitters
Splitter Insertion Loss: -${d.splitterLossDb} dB
Drop Fiber Distance:     ${d.dropDistanceKm} km (Loss: -${d.fiberLossDb} dB)
Connector / Patch Loss:  -${d.connectorLossDb} dB (4 pairs @ 0.30 dB)
Total Optical Link Loss: -${d.totalLinkLossDb} dB
OLT Transmitter Power:   +${d.txPowerDbm} dBm (1490nm DFB)
Subscriber ONT Received: ${d.receivedPowerDbm} dBm
ONT Receiver Sensitivity:${d.rxSensitivityDbm} dBm
Net Optical Link Margin: +${d.opticalMarginDb} dB

4. STATUS, SLA PERFORMANCE & PENALTIES:
--------------------------------------------------------------------------------
Operational Status:      ${d.status}
SLA Penalty / Rebate:    ${d.penaltyRebatePct}% (${formatPKR(d.penaltyPkr)})

5. FLEET-WIDE OLT INFRASTRUCTURE SUMMARY:
--------------------------------------------------------------------------------
Total Monitored Chassis: ${m.totalChassis} Units
Total Installed Ports:   ${m.totalPorts} PON Interfaces
Total Connected Subs:    ${m.totalSubscribers} Subscribers
Fleet Max Capacity:      ${m.totalMaxCapacity} Terminals
Fleet Saturation Rate:   ${m.fleetSaturationPct}%
Total Power Draw:        ${m.totalPowerWatts} Watts
Total Monthly Revenue:   ${formatPKR(m.totalRevenuePkr)}
Total Monthly Penalties: ${formatPKR(m.totalPenaltiesPkr)}
Optimal Chassis:         ${m.optimalCount}
Warning / Near Full:     ${m.warningCount}
Optical Deficit Chassis: ${m.deficitCount}
================================================================================
END OF OPTICAL OLT CHASSIS REPORT`;
}

/**
 * Exports current OLT chassis telemetry in structured JSON format
 * @param {Object} dynamics - Current chassis dynamics
 * @param {Object} metrics - Fleet metrics
 * @returns {string} JSON string
 */
export function exportOltChassisJson(dynamics, metrics) {
  const d = dynamics || calculateOltChassisDynamics(SHAHDARA_OLT_CHASSIS[0]);
  const m = metrics || calculateOltChassisMetrics();

  return JSON.stringify({
    metadata: {
      generator: 'Shahdara ISP Optical OLT Chassis Infrastructure Engine',
      standards: ['ITU-T G.984', 'ITU-T G.9807.1', 'IEC 61753-022-2'],
      exportedAt: new Date().toISOString()
    },
    currentChassis: d,
    fleetSummary: m
  }, null, 2);
}

/**
 * Exports OLT chassis telemetry as RFC 4180 compliant CSV
 * @param {Object} dynamics - Current chassis dynamics
 * @param {Object} metrics - Fleet metrics
 * @returns {string} CSV text
 */
export function exportOltChassisCsv(dynamics, metrics) {
  const list = SHAHDARA_OLT_CHASSIS;

  const headers = [
    'Chassis_Code',
    'Chassis_Name',
    'Model',
    'Primary_Area',
    'Standard',
    'Installed_Slots',
    'Total_Ports',
    'Active_Subscribers',
    'Max_Capacity',
    'Saturation_Pct',
    'Split_Ratio',
    'Link_Loss_dB',
    'Optical_Margin_dB',
    'Monthly_Revenue_PKR',
    'Status',
    'Penalty_PKR'
  ];

  const rows = list.map(c => {
    const d = calculateOltChassisDynamics(c);
    return [
      `"${d.chassisCode}"`,
      `"${d.chassisName.replace(/"/g, '""')}"`,
      `"${d.model.replace(/"/g, '""')}"`,
      `"${d.primaryArea}"`,
      `"${d.standard}"`,
      d.installedSlots,
      d.totalPorts,
      d.activeSubscribers,
      d.maxTotalSubscribers,
      d.portSaturationPct,
      `"${d.splitRatio}"`,
      d.totalLinkLossDb,
      d.opticalMarginDb,
      d.monthlyRevenuePkr,
      `"${d.status}"`,
      d.penaltyPkr
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Modal and Dashboard Card Controller for OLT Chassis Telemetry
 * @param {Object} state - Application state
 * @param {Object} options - Controller options (document, onFilterArea, onToast)
 * @returns {Object} Controller interface
 */
export function setupOltChassisModal(state, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const modal = doc.getElementById('dashboardOltChassisModal');
  const closeBtn = doc.getElementById('dashboardOltChassisModalCloseBtn');
  const openBtn = doc.getElementById('dashboardOpenOltChassisModalBtn');

  const cardChartContainer = doc.getElementById('dashboardOltChassisChart');
  const modalDiagramContainer = doc.getElementById('oltChassisModalDiagramContainer');

  // Input Controls
  const chassisSelect = doc.getElementById('oltChassisSelect');
  const splitRatioSelect = doc.getElementById('oltSplitRatioSelect');
  const slotsSlider = doc.getElementById('oltSlotsSlider');
  const slotsLabel = doc.getElementById('oltSlotsLabel');
  const distanceSlider = doc.getElementById('oltDistanceSlider');
  const distanceLabel = doc.getElementById('oltDistanceLabel');
  const resetBtn = doc.getElementById('oltChassisResetBtn');

  // Stat Labels
  const statStatus = doc.getElementById('oltChassisStatStatus');
  const statSaturation = doc.getElementById('oltChassisStatSaturation');
  const statMargin = doc.getElementById('oltChassisStatMargin');
  const statPorts = doc.getElementById('oltChassisStatPorts');
  const statLoss = doc.getElementById('oltChassisStatLoss');
  const statPenalty = doc.getElementById('oltChassisStatPenalty');

  // Action Buttons
  const filterAreaBtn = doc.getElementById('oltChassisFilterAreaBtn');
  const exportJsonBtn = doc.getElementById('oltChassisExportJsonBtn');
  const exportCsvBtn = doc.getElementById('oltChassisExportCsvBtn');
  const copyReportBtn = doc.getElementById('oltChassisCopyReportBtn');

  let currentChassisId = OLT_CHASSIS_CONSTANTS.DEFAULT_CHASSIS_ID;
  let customSplitRatio = null;
  let customSlots = null;
  let customDistance = null;

  function getCurrentChassis() {
    return SHAHDARA_OLT_CHASSIS.find(c => c.id === currentChassisId) || SHAHDARA_OLT_CHASSIS[0];
  }

  function getCalculatedDynamics() {
    const c = getCurrentChassis();
    return calculateOltChassisDynamics(c, {
      splitRatio: customSplitRatio !== null ? customSplitRatio : c.defaultSplitRatio,
      installedSlots: customSlots !== null ? customSlots : c.installedSlotsCount,
      dropDistanceKm: customDistance !== null ? customDistance : c.averageDropDistanceKm
    });
  }

  function updateUi() {
    const dynamics = getCalculatedDynamics();
    const allMetrics = calculateOltChassisMetrics(SHAHDARA_OLT_CHASSIS, state);

    // Update Card Chart if present
    if (cardChartContainer) {
      cardChartContainer.innerHTML = renderOltChassisDiagramSvg(dynamics, { isCompact: true });
    }

    // Update Modal Diagram if present
    if (modalDiagramContainer) {
      modalDiagramContainer.innerHTML = renderOltChassisDiagramSvg(dynamics, { isCompact: false });
    }

    // Update KPI Stat Elements
    if (statStatus) {
      statStatus.textContent = dynamics.status;
      statStatus.style.color = dynamics.statusColor;
    }
    if (statSaturation) {
      statSaturation.textContent = `${dynamics.portSaturationPct}% (${dynamics.activeSubscribers} Subs)`;
      statSaturation.style.color = dynamics.portSaturationPct >= 85 ? '#f59e0b' : '#10b981';
    }
    if (statMargin) {
      statMargin.textContent = `+${dynamics.opticalMarginDb} dB`;
      statMargin.style.color = dynamics.opticalMarginDb < 1.5 ? '#ef4444' : '#38bdf8';
    }
    if (statPorts) {
      statPorts.textContent = `${dynamics.totalPorts} Ports (${dynamics.installedSlots} Slots)`;
      statPorts.style.color = '#a78bfa';
    }
    if (statLoss) {
      statLoss.textContent = `${dynamics.totalLinkLossDb} dB (${dynamics.receivedPowerDbm} dBm)`;
      statLoss.style.color = dynamics.totalLinkLossDb > 26 ? '#f59e0b' : '#10b981';
    }
    if (statPenalty) {
      statPenalty.textContent = `${dynamics.penaltyRebatePct}% (${formatPKR(dynamics.penaltyPkr)})`;
      statPenalty.style.color = dynamics.penaltyPkr > 0 ? '#ef4444' : '#10b981';
    }

    // Update Slider Labels
    if (slotsLabel) slotsLabel.textContent = `${dynamics.installedSlots} / ${dynamics.totalSlotsAvailable} slots (${dynamics.totalPorts} ports)`;
    if (distanceLabel) distanceLabel.textContent = `${dynamics.dropDistanceKm} km`;
  }

  function syncControls() {
    const c = getCurrentChassis();
    if (chassisSelect) chassisSelect.value = c.id;
    if (splitRatioSelect) splitRatioSelect.value = customSplitRatio !== null ? customSplitRatio : c.defaultSplitRatio;
    if (slotsSlider) {
      slotsSlider.max = String(c.totalSlotsAvailable);
      slotsSlider.value = String(customSlots !== null ? customSlots : c.installedSlotsCount);
    }
    if (distanceSlider) distanceSlider.value = String(customDistance !== null ? customDistance : c.averageDropDistanceKm);
    updateUi();
  }

  // Event Listeners
  if (chassisSelect) {
    chassisSelect.addEventListener('change', () => {
      currentChassisId = chassisSelect.value;
      customSplitRatio = null;
      customSlots = null;
      customDistance = null;
      syncControls();
    });
  }

  if (splitRatioSelect) {
    splitRatioSelect.addEventListener('change', () => {
      customSplitRatio = splitRatioSelect.value;
      updateUi();
    });
  }

  if (slotsSlider) {
    slotsSlider.addEventListener('input', () => {
      customSlots = Number(slotsSlider.value);
      updateUi();
    });
  }

  if (distanceSlider) {
    distanceSlider.addEventListener('input', () => {
      customDistance = Number(distanceSlider.value);
      updateUi();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      customSplitRatio = null;
      customSlots = null;
      customDistance = null;
      syncControls();
      if (typeof options.onToast === 'function') {
        options.onToast('OLT chassis parameters reset to baseline.');
      }
    });
  }

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      syncControls();
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    });
  }

  if (filterAreaBtn) {
    filterAreaBtn.addEventListener('click', () => {
      const c = getCurrentChassis();
      if (modal && typeof modal.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(c.primaryArea);
      }
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const dynamics = getCalculatedDynamics();
      const allMetrics = calculateOltChassisMetrics(SHAHDARA_OLT_CHASSIS, state);
      const json = exportOltChassisJson(dynamics, allMetrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(json).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('OLT Chassis JSON telemetry copied to clipboard.');
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const dynamics = getCalculatedDynamics();
      const allMetrics = calculateOltChassisMetrics(SHAHDARA_OLT_CHASSIS, state);
      const csv = exportOltChassisCsv(dynamics, allMetrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(csv).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('OLT Chassis CSV telemetry copied to clipboard.');
      }
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const dynamics = getCalculatedDynamics();
      const allMetrics = calculateOltChassisMetrics(SHAHDARA_OLT_CHASSIS, state);
      const report = generateOltChassisReport(dynamics, allMetrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(report).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('OLT chassis audit report copied to clipboard.');
      }
    });
  }

  // Initial render
  updateUi();

  return {
    open: () => {
      syncControls();
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
    getDynamics: getCalculatedDynamics,
    getMetrics: () => calculateOltChassisMetrics(SHAHDARA_OLT_CHASSIS, state)
  };
}
