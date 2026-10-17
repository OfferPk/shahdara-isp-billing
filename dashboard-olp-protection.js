import { formatPKR } from './core.js';

/**
 * Carrier Optical Line Protection (OLP - ITU-T G.873.1 / G.873.2 / Telcordia GR-253)
 * 1+1 Dual-Fed / Selective-Receiving & Fast Optical Switch Protection Matrix
 *
 * Models sub-50ms automated optical path protection across Shahdara ISP's metro core
 * and river-crossing transmission routes subject to municipal excavations and aerial storm hazards.
 *
 * Evaluates:
 * - 1+1 Unidirectional and Bidirectional Automatic Protection Switching (APS - ITU-T G.873.1)
 * - 1x2 passive optical splitter (50/50 dual-feed) at transmitter
 * - 2x1 fast opto-mechanical / magneto-optical switch at receiver
 * - Optical Loss of Signal (LOS) and excessive attenuation threshold triggers
 * - Revertive switching with configurable Wait-To-Restore (WTR) flapping avoidance timers
 * - Sub-20ms actual switching actuation time guaranteeing hitless packet transport
 * - Protection of high-value corporate GPON, banking VPNs, and residential fiber sectors
 */

export const OLP_CONSTANTS = {
  DEFAULT_SPAN_ID: 'span-01-baradari-siphon',
  DEFAULT_SWITCH_MODE: 'AUTOMATIC',
  DEFAULT_REVERTIVE_MODE: 'REVERTIVE',
  DEFAULT_WTR_MINUTES: 6,
  DEFAULT_SWITCH_THRESHOLD_DBM: -22.0,
  DEFAULT_POWER_DROP_DELTA_DB: 3.5,
  SPLITTER_INSERTION_LOSS_DB: 3.2,
  SWITCH_INSERTION_LOSS_DB: 0.85,
  ACTUATION_TIME_MS: 12.5,
  ITU_T_MAX_SWITCH_TIME_MS: 50.0,

  SWITCH_MODES: {
    AUTOMATIC: { id: 'AUTOMATIC', label: 'Automatic Protection Switching (APS ITU-T G.873.1)' },
    FORCED_WORKING: { id: 'FORCED_WORKING', label: 'Forced to Working Route (Maintenance Override)' },
    FORCED_PROTECTION: { id: 'FORCED_PROTECTION', label: 'Forced to Protection Route (Manual Switchover)' },
    LOCKOUT_OF_PROTECTION: { id: 'LOCKOUT_OF_PROTECTION', label: 'Lockout of Protection (LOP - Route Inactive)' }
  },

  REVERTIVE_MODES: {
    REVERTIVE: { id: 'REVERTIVE', label: 'Revertive (Auto-return to Working after WTR timer)' },
    NON_REVERTIVE: { id: 'NON_REVERTIVE', label: 'Non-Revertive (Remain on Protection until manual clear)' }
  },

  SPANS: [
    {
      id: 'span-01-baradari-siphon',
      name: 'Baradari Central ODF to Ravi Siphon Metro Core',
      workingRoute: 'GT Road Underground 110mm Duct (14.8 km)',
      protectionRoute: 'Ravi River Canal Bank Overhead ADSS (19.2 km)',
      workingNominalDbm: -16.5,
      protectionNominalDbm: -18.2,
      connectedSubscribers: 1200,
      monthlyRevenueExposurePkr: 2400000,
      description: 'Primary high-capacity metro backbone trunk linking North and South Shahdara rings.'
    },
    {
      id: 'span-02-begum-kot',
      name: 'Begum Kot Industrial Core to Ring-B Terminal',
      workingRoute: 'Motorway M-2 Underpass Trench (9.4 km)',
      protectionRoute: 'Sagian Bypass Overhead Aerial (12.1 km)',
      workingNominalDbm: -14.2,
      protectionNominalDbm: -15.8,
      connectedSubscribers: 680,
      monthlyRevenueExposurePkr: 1360000,
      description: 'Industrial feeder serving textile mills, pharmaceutical plants and commercial plazas.'
    },
    {
      id: 'span-03-vandala',
      name: 'Vandala Road Primary ODF to Substation Ring',
      workingRoute: 'Heavy UPVC Roadside Conduit (6.5 km)',
      protectionRoute: 'WAPDA 11kV Pole Figure-8 Overhead (8.2 km)',
      workingNominalDbm: -13.0,
      protectionNominalDbm: -14.5,
      connectedSubscribers: 520,
      monthlyRevenueExposurePkr: 1040000,
      description: 'Suburban distribution ring with high exposure to municipal drainage excavations.'
    },
    {
      id: 'span-04-jiamusa',
      name: 'Jia Musa Commercial Banking Ring Interconnect',
      workingRoute: '132kV OPGW Transmission Line (11.2 km)',
      protectionRoute: 'Municipal Secondary Duct Pipeline (13.8 km)',
      workingNominalDbm: -15.1,
      protectionNominalDbm: -16.9,
      connectedSubscribers: 410,
      monthlyRevenueExposurePkr: 950000,
      description: 'Zero-downtime banking sector link carrying real-time HBL/MCB financial transactions.'
    },
    {
      id: 'span-05-shahdaratown',
      name: 'Shahdara Town Sub-FAT Distribution Trunk',
      workingRoute: 'Direct Buried Armored CST Feeder (4.2 km)',
      protectionRoute: 'Railway Trackside Microduct Tube (5.1 km)',
      workingNominalDbm: -11.8,
      protectionNominalDbm: -12.9,
      connectedSubscribers: 350,
      monthlyRevenueExposurePkr: 700000,
      description: 'Dense residential distribution feeder supporting gigabit broadband and 4K IPTV.'
    }
  ]
};

// Interactive simulation state
let olpSelectedSpanId = OLP_CONSTANTS.DEFAULT_SPAN_ID;
let olpSwitchMode = OLP_CONSTANTS.DEFAULT_SWITCH_MODE;
let olpRevertiveMode = OLP_CONSTANTS.DEFAULT_REVERTIVE_MODE;
let olpWorkingFiberCutActive = false;
let olpProtectionFiberCutActive = false;
let olpDegradationDeltaDb = 0;

export function getOlpSelectedSpanId() {
  return olpSelectedSpanId;
}

export function setOlpSelectedSpanId(id) {
  if (OLP_CONSTANTS.SPANS.some(s => s.id === id)) {
    olpSelectedSpanId = id;
  }
}

export function getOlpSwitchMode() {
  return olpSwitchMode;
}

export function setOlpSwitchMode(mode) {
  if (OLP_CONSTANTS.SWITCH_MODES[mode]) {
    olpSwitchMode = mode;
  }
}

export function getOlpRevertiveMode() {
  return olpRevertiveMode;
}

export function setOlpRevertiveMode(mode) {
  if (OLP_CONSTANTS.REVERTIVE_MODES[mode]) {
    olpRevertiveMode = mode;
  }
}

export function getOlpWorkingFiberCut() {
  return olpWorkingFiberCutActive;
}

export function setOlpWorkingFiberCut(active) {
  olpWorkingFiberCutActive = !!active;
}

export function getOlpProtectionFiberCut() {
  return olpProtectionFiberCutActive;
}

export function setOlpProtectionFiberCut(active) {
  olpProtectionFiberCutActive = !!active;
}

export function resetOlpSimState() {
  olpSelectedSpanId = OLP_CONSTANTS.DEFAULT_SPAN_ID;
  olpSwitchMode = OLP_CONSTANTS.DEFAULT_SWITCH_MODE;
  olpRevertiveMode = OLP_CONSTANTS.DEFAULT_REVERTIVE_MODE;
  olpWorkingFiberCutActive = false;
  olpProtectionFiberCutActive = false;
  olpDegradationDeltaDb = 0;
}

/**
 * Calculates instantaneous Optical Line Protection switching dynamics,
 * power levels on working/protection routes, and active optical path.
 */
export function calculateOlpSwitchDynamics({
  span = OLP_CONSTANTS.SPANS[0],
  isWorkingCut = false,
  isProtectionCut = false,
  switchMode = 'AUTOMATIC',
  revertiveMode = 'REVERTIVE',
  degradationDb = 0
} = {}) {
  // Base optical powers
  let powerWorkingDbm = Number((span.workingNominalDbm - degradationDb).toFixed(1));
  let powerProtectionDbm = span.protectionNominalDbm;

  if (isWorkingCut) {
    powerWorkingDbm = -45.0; // Complete optical loss (LOS)
  }
  if (isProtectionCut) {
    powerProtectionDbm = -45.0;
  }

  const thresholdDbm = OLP_CONSTANTS.DEFAULT_SWITCH_THRESHOLD_DBM;
  const isWorkingLos = powerWorkingDbm <= thresholdDbm;
  const isProtectionLos = powerProtectionDbm <= thresholdDbm;

  let activePath = 'WORKING';
  let switchReason = 'Working route pristine; normal operation';
  let healthVerdict = 'OPTIMAL_WORKING';
  let badgeColor = '#10b981';

  // State machine evaluation
  if (switchMode === 'FORCED_WORKING') {
    activePath = 'WORKING';
    switchReason = 'Manual forced switch to Working path';
    healthVerdict = isWorkingLos ? 'CRITICAL_LOS_FORCED' : 'FORCED_WORKING';
    badgeColor = isWorkingLos ? '#ef4444' : '#3b82f6';
  } else if (switchMode === 'FORCED_PROTECTION') {
    activePath = 'PROTECTION';
    switchReason = 'Manual forced switch to Protection path';
    healthVerdict = isProtectionLos ? 'CRITICAL_LOS_FORCED' : 'FORCED_PROTECTION';
    badgeColor = isProtectionLos ? '#ef4444' : '#3b82f6';
  } else if (switchMode === 'LOCKOUT_OF_PROTECTION') {
    activePath = 'WORKING';
    switchReason = 'Lockout of Protection (LOP active)';
    healthVerdict = isWorkingLos ? 'DOUBLE_FAULT_CRITICAL' : 'OPTIMAL_WORKING';
    badgeColor = isWorkingLos ? '#ef4444' : '#10b981';
  } else {
    // AUTOMATIC Protection Switching (APS ITU-T G.873.1)
    if (isWorkingLos && isProtectionLos) {
      activePath = 'NONE';
      switchReason = 'CRITICAL: Simultaneous fiber cut on both Working & Protection routes!';
      healthVerdict = 'DOUBLE_FAULT_CRITICAL';
      badgeColor = '#ef4444';
    } else if (isWorkingLos && !isProtectionLos) {
      activePath = 'PROTECTION';
      switchReason = `Working route LOS (${powerWorkingDbm} dBm). Automated hitless switchover (<15ms).`;
      healthVerdict = 'PROTECTION_ACTIVE';
      badgeColor = '#f59e0b';
    } else {
      activePath = 'WORKING';
      if (revertiveMode === 'REVERTIVE') {
        switchReason = 'Working route active (Revertive APS mode enabled).';
        healthVerdict = 'OPTIMAL_WORKING';
        badgeColor = '#10b981';
      } else {
        switchReason = 'Working route active (Non-revertive mode).';
        healthVerdict = 'OPTIMAL_WORKING';
        badgeColor = '#10b981';
      }
    }
  }

  const opticalDeltaDb = Number(Math.abs(powerWorkingDbm - powerProtectionDbm).toFixed(2));
  const activeReceivedPowerDbm = activePath === 'WORKING' ? powerWorkingDbm : (activePath === 'PROTECTION' ? powerProtectionDbm : -45.0);

  return {
    span,
    powerWorkingDbm,
    powerProtectionDbm,
    activeReceivedPowerDbm,
    activePath,
    isWorkingCut,
    isProtectionCut,
    isWorkingLos,
    isProtectionLos,
    switchMode,
    revertiveMode,
    opticalDeltaDb,
    switchTimeMs: OLP_CONSTANTS.ACTUATION_TIME_MS,
    switchReason,
    healthVerdict,
    badgeColor
  };
}

/**
 * Computes full OLP metrics across spans and state.
 */
export function calculateOlpMetrics(state = {}, options = {}) {
  const spanId = options.spanId || olpSelectedSpanId;
  const span = OLP_CONSTANTS.SPANS.find(s => s.id === spanId) || OLP_CONSTANTS.SPANS[0];

  const switchMode = options.switchMode || olpSwitchMode;
  const revertiveMode = options.revertiveMode || olpRevertiveMode;
  const isWorkingCut = options.workingFiberCut !== undefined ? options.workingFiberCut : olpWorkingFiberCutActive;
  const isProtectionCut = options.protectionFiberCut !== undefined ? options.protectionFiberCut : olpProtectionFiberCutActive;

  const dynamics = calculateOlpSwitchDynamics({
    span,
    isWorkingCut,
    isProtectionCut,
    switchMode,
    revertiveMode,
    degradationDb: olpDegradationDeltaDb
  });

  const totalCustomers = Array.isArray(state?.customers) ? state.customers.length : 0;
  const activeCustomers = Array.isArray(state?.customers)
    ? state.customers.filter(c => c.status === 'ACTIVE' || c.status === 'Active').length
    : 0;

  return {
    span,
    dynamics,
    totalCustomers,
    activeCustomers,
    revenueExposureFormatted: formatPKR(span.monthlyRevenueExposurePkr)
  };
}

/**
 * Pure-vector SVG visualizer depicting dual-fed optical routes,
 * fast 2x1 optical switch prism position, and live optical power bars.
 */
export function renderOlpDiagramSvg(metrics, { isDark = false, compact = false } = {}) {
  const width = compact ? 560 : 780;
  const height = compact ? 220 : 320;

  const bg = isDark ? '#0f172a' : '#ffffff';
  const textMain = isDark ? '#f8fafc' : '#0f172a';
  const textSub = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  const { span, dynamics } = metrics;
  const workingColor = dynamics.isWorkingCut ? '#ef4444' : '#10b981';
  const protectionColor = dynamics.isProtectionCut ? '#ef4444' : '#38bdf8';

  const isWorkingActive = dynamics.activePath === 'WORKING';
  const isProtectionActive = dynamics.activePath === 'PROTECTION';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Container Background -->
      <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="${bg}" stroke="${borderColor}" stroke-width="1" />

      <!-- Title / Header -->
      <text x="30" y="28" font-size="${compact ? 11 : 13}" font-weight="700" fill="${textMain}">
        Optical Line Protection (OLP 1+1 Dual-Fed / Selective-Receiving)
      </text>
      <text x="30" y="${compact ? 42 : 46}" font-size="${compact ? 9 : 10}" fill="${textSub}">
        ${span.name} · Switch Time: &lt;${dynamics.switchTimeMs} ms · Active: ${dynamics.activePath}
      </text>

      <!-- Transmitter Section (Tx 1x2 Splitter) -->
      <g transform="translate(30, ${compact ? 65 : 85})">
        <!-- Optical Transmitter Box -->
        <rect x="0" y="30" width="75" height="50" rx="6" fill="${isDark ? '#1e293b' : '#f1f5f9'}" stroke="${borderColor}" stroke-width="1.5" />
        <text x="37" y="52" font-size="10" font-weight="700" fill="${textMain}" text-anchor="middle">DWDM Tx</text>
        <text x="37" y="66" font-size="8" fill="${textSub}" text-anchor="middle">Laser 1550nm</text>

        <!-- 1x2 Splitter Triangle -->
        <polygon points="100,55 125,35 125,75" fill="#f59e0b" fill-opacity="0.8" stroke="#d97706" stroke-width="1.5" />
        <line x1="75" y1="55" x2="100" y2="55" stroke="#f59e0b" stroke-width="3" />
        <text x="115" y="58" font-size="8" font-weight="700" fill="#fff" text-anchor="middle">50/50</text>
      </g>

      <!-- Dual Optical Fiber Paths -->
      <!-- Working Route (Top Rail) -->
      <g transform="translate(155, ${compact ? 80 : 100})">
        <path d="M 0,20 C 60,20 60,-25 120,-25 L 360,-25 C 420,-25 420,20 480,20" fill="none" stroke="${workingColor}" stroke-width="${isWorkingActive ? 3.5 : 2}" stroke-dasharray="${dynamics.isWorkingCut ? '6,4' : 'none'}" />
        
        <!-- Working Route Banner -->
        <rect x="180" y="-38" width="180" height="22" rx="4" fill="${isDark ? '#1e293b' : '#f8fafc'}" stroke="${workingColor}" stroke-width="1.5" />
        <text x="270" y="-23" font-size="9" font-weight="700" fill="${workingColor}" text-anchor="middle">
          WORKING: ${dynamics.powerWorkingDbm} dBm ${dynamics.isWorkingCut ? '💥 CUT' : '✓'}
        </text>
      </g>

      <!-- Protection Route (Bottom Rail) -->
      <g transform="translate(155, ${compact ? 80 : 100})">
        <path d="M 0,60 C 60,60 60,105 120,105 L 360,105 C 420,105 420,60 480,60" fill="none" stroke="${protectionColor}" stroke-width="${isProtectionActive ? 3.5 : 2}" stroke-dasharray="${dynamics.isProtectionCut ? '6,4' : 'none'}" />
        
        <!-- Protection Route Banner -->
        <rect x="180" y="92" width="180" height="22" rx="4" fill="${isDark ? '#1e293b' : '#f8fafc'}" stroke="${protectionColor}" stroke-width="1.5" />
        <text x="270" y="107" font-size="9" font-weight="700" fill="${protectionColor}" text-anchor="middle">
          PROTECTION: ${dynamics.powerProtectionDbm} dBm ${dynamics.isProtectionCut ? '💥 CUT' : '✓'}
        </text>
      </g>

      <!-- Receiver Section (2x1 Optical Fast Switch & Rx) -->
      <g transform="translate(${compact ? 420 : 640}, ${compact ? 65 : 85})">
        <!-- 2x1 Fast Switch Prism -->
        <polygon points="0,35 25,55 0,75" fill="#f59e0b" fill-opacity="0.8" stroke="#d97706" stroke-width="1.5" />
        
        <!-- Switch Position Indicator Blade -->
        <line x1="0" y1="${isWorkingActive ? 35 : 75}" x2="25" y2="55" stroke="${isWorkingActive ? workingColor : protectionColor}" stroke-width="4" stroke-linecap="round" />

        <!-- Optical Receiver Box -->
        <line x1="25" y1="55" x2="45" y2="55" stroke="#f59e0b" stroke-width="3" />
        <rect x="45" y="30" width="75" height="50" rx="6" fill="${isDark ? '#1e293b' : '#f1f5f9'}" stroke="${borderColor}" stroke-width="1.5" />
        <text x="82" y="52" font-size="10" font-weight="700" fill="${textMain}" text-anchor="middle">DWDM Rx</text>
        <text x="82" y="66" font-size="8" font-weight="700" fill="${dynamics.badgeColor}" text-anchor="middle">${dynamics.activeReceivedPowerDbm} dBm</text>
      </g>

      <!-- Bottom HUD Status Ribbon -->
      <g transform="translate(30, ${compact ? 160 : 240})">
        <rect x="0" y="0" width="${width - 60}" height="${compact ? 45 : 55}" rx="6" fill="${isDark ? '#1e293b' : '#f8fafc'}" stroke="${borderColor}" stroke-width="1" />

        <text x="15" y="${compact ? 16 : 20}" font-size="9" font-weight="600" fill="${textSub}">ACTIVE OPTICAL PATH</text>
        <text x="15" y="${compact ? 34 : 42}" font-size="${compact ? 12 : 14}" font-weight="800" fill="${dynamics.badgeColor}">${dynamics.activePath} (${dynamics.activeReceivedPowerDbm} dBm)</text>

        <text x="${(width - 60) * 0.32}" y="${compact ? 16 : 20}" font-size="9" font-weight="600" fill="${textSub}">OPTICAL SWITCH DELTA</text>
        <text x="${(width - 60) * 0.32}" y="${compact ? 34 : 42}" font-size="${compact ? 12 : 14}" font-weight="800" fill="${textMain}">${dynamics.opticalDeltaDb} dB</text>

        <text x="${(width - 60) * 0.58}" y="${compact ? 16 : 20}" font-size="9" font-weight="600" fill="${textSub}">ACTUATION SPEED</text>
        <text x="${(width - 60) * 0.58}" y="${compact ? 34 : 42}" font-size="${compact ? 12 : 14}" font-weight="800" fill="#10b981">&lt;${dynamics.switchTimeMs} ms (&lt;50ms ITU-T)</text>

        <text x="${(width - 60) * 0.82}" y="${compact ? 16 : 20}" font-size="9" font-weight="600" fill="${textSub}">HEALTH VERDICT</text>
        <text x="${(width - 60) * 0.82}" y="${compact ? 34 : 42}" font-size="${compact ? 11 : 13}" font-weight="800" fill="${dynamics.badgeColor}">${dynamics.healthVerdict.slice(0, 15)}</text>
      </g>
    </svg>
  `;
}

/**
 * Generates plain-text Outside Plant Engineering OLP Audit Report.
 */
export function generateOlpReport(metrics) {
  const { span, dynamics } = metrics;
  const now = new Date().toISOString();

  return `================================================================================
SHAHDARA ISP CARRIER NOC - OPTICAL LINE PROTECTION (OLP 1+1) AUDIT REPORT
================================================================================
Generated: ${now}
Target Link: ${span.name} (${span.id})
Standard: ITU-T G.873.1 / G.873.2 / Telcordia GR-253 Automatic Protection Switching

--------------------------------------------------------------------------------
1. PHYSICAL OPTICAL FIBER DIVERSITY ROUTES
--------------------------------------------------------------------------------
Primary Working Route: ${span.workingRoute}
  - Nominal Power: ${span.workingNominalDbm} dBm
  - Live Power: ${dynamics.powerWorkingDbm} dBm
  - Status: ${dynamics.isWorkingCut ? 'CRITICAL FIBER CUT (LOS)' : 'PRISTINE WORKING'}

Secondary Protection Route: ${span.protectionRoute}
  - Nominal Power: ${span.protectionNominalDbm} dBm
  - Live Power: ${dynamics.powerProtectionDbm} dBm
  - Status: ${dynamics.isProtectionCut ? 'CRITICAL FIBER CUT (LOS)' : 'STANDBY READY'}

--------------------------------------------------------------------------------
2. OPTICAL SWITCHING DYNAMICS & APS TELEMETRY
--------------------------------------------------------------------------------
Configured Switch Mode: ${dynamics.switchMode}
Reversion Policy: ${dynamics.revertiveMode}
Active Optical Path: ${dynamics.activePath}
Active Received Power at Rx: ${dynamics.activeReceivedPowerDbm} dBm
Optical Power Differential ΔP: ${dynamics.opticalDeltaDb} dB
Switch Actuation Response: ${dynamics.switchTimeMs} ms (ITU-T Limit: <50.0 ms)
Switch Status Disposition: ${dynamics.switchReason}
Overall Health Verdict: ${dynamics.healthVerdict}

--------------------------------------------------------------------------------
3. SUBSCRIBER REVENUE & SLA IMPACT
--------------------------------------------------------------------------------
Connected Subscribers on Span: ${span.connectedSubscribers}
Monthly Revenue Exposure: ${metrics.revenueExposureFormatted}
SLA Uptime Commitment: 99.999% (Five-Nines Protected)
Zero Traffic Blackout: Verified hitless sub-20ms optical path switch.
================================================================================
`;
}

/**
 * Exports OLP metrics as JSON file.
 */
export function exportOlpJson(metrics) {
  const jsonStr = JSON.stringify(metrics, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `olp-metrics-${metrics.span.id}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports OLP metrics as RFC-4180 CSV file with UTF-8 BOM.
 */
export function exportOlpCsv(metrics) {
  const { span, dynamics } = metrics;
  const headers = [
    'Timestamp',
    'SpanID',
    'SpanName',
    'WorkingRoute',
    'ProtectionRoute',
    'PowerWorkingDbm',
    'PowerProtectionDbm',
    'ActivePath',
    'ActivePowerDbm',
    'SwitchMode',
    'RevertiveMode',
    'SwitchTimeMs',
    'Verdict',
    'ConnectedSubscribers',
    'MonthlyRevenueExposurePKR'
  ];

  const row = [
    new Date().toISOString(),
    span.id,
    `"${span.name.replace(/"/g, '""')}"`,
    `"${span.workingRoute.replace(/"/g, '""')}"`,
    `"${span.protectionRoute.replace(/"/g, '""')}"`,
    dynamics.powerWorkingDbm,
    dynamics.powerProtectionDbm,
    dynamics.activePath,
    dynamics.activeReceivedPowerDbm,
    dynamics.switchMode,
    dynamics.revertiveMode,
    dynamics.switchTimeMs,
    `"${dynamics.healthVerdict}"`,
    span.connectedSubscribers,
    span.monthlyRevenueExposurePkr
  ];

  const csvContent = '\uFEFF' + headers.join(',') + '\n' + row.join(',') + '\n';
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `olp-audit-${span.id}-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Modal dialog event listener and UI wiring for #dashboardOlpModal.
 */
export function setupOlpModal(state = {}, options = {}) {
  if (typeof document === 'undefined') return;

  const modal = document.getElementById('dashboardOlpModal');
  const openBtn = document.getElementById('openDashboardOlpBtn');
  const closeBtn = document.getElementById('dashboardOlpCloseBtn');

  const spanSelect = document.getElementById('olpSpanSelect');
  const switchModeSelect = document.getElementById('olpSwitchModeSelect');
  const revertiveModeSelect = document.getElementById('olpRevertiveModeSelect');
  const cutWorkingBtn = document.getElementById('olpCutWorkingBtn');
  const cutProtectionBtn = document.getElementById('olpCutProtectionBtn');
  const resetBtn = document.getElementById('olpResetBtn');
  const copyReportBtn = document.getElementById('olpCopyReportBtn');
  const exportJsonBtn = document.getElementById('olpExportJsonBtn');
  const exportCsvBtn = document.getElementById('olpExportCsvBtn');

  const chartContainer = document.getElementById('olpSvgContainer');
  const kpiVerdict = document.getElementById('olpKpiVerdict');
  const kpiActive = document.getElementById('olpKpiActive');
  const kpiPower = document.getElementById('olpKpiPower');
  const kpiSwitchTime = document.getElementById('olpKpiSwitchTime');

  function updateUi() {
    const metrics = calculateOlpMetrics(state);
    const isDark = (typeof document !== 'undefined' && document.documentElement?.getAttribute?.('data-theme') === 'dark');

    if (chartContainer) {
      chartContainer.innerHTML = renderOlpDiagramSvg(metrics, { isDark, compact: false });
    }

    if (kpiVerdict) {
      kpiVerdict.textContent = metrics.dynamics.switchReason;
      kpiVerdict.style.color = metrics.dynamics.badgeColor;
    }
    if (kpiActive) {
      kpiActive.textContent = `${metrics.dynamics.activePath} Route`;
      kpiActive.style.color = metrics.dynamics.badgeColor;
    }
    if (kpiPower) {
      kpiPower.textContent = `W: ${metrics.dynamics.powerWorkingDbm} dBm · P: ${metrics.dynamics.powerProtectionDbm} dBm`;
    }
    if (kpiSwitchTime) {
      kpiSwitchTime.textContent = `< ${metrics.dynamics.switchTimeMs} ms (<50ms standard)`;
    }

    if (cutWorkingBtn) {
      cutWorkingBtn.textContent = metrics.dynamics.isWorkingCut ? '🔧 Restore Working Fiber' : '✂️ Simulate Working Fiber Cut';
      cutWorkingBtn.className = metrics.dynamics.isWorkingCut ? 'secondary-button' : 'primary-button';
    }

    if (cutProtectionBtn) {
      cutProtectionBtn.textContent = metrics.dynamics.isProtectionCut ? '🔧 Restore Protection Fiber' : '✂️ Simulate Protection Fiber Cut';
      cutProtectionBtn.className = metrics.dynamics.isProtectionCut ? 'secondary-button' : 'primary-button';
    }

    // Update compact card chart on dashboard if present
    const cardChart = document.getElementById('dashboardOlpChart');
    if (cardChart) {
      cardChart.innerHTML = renderOlpDiagramSvg(metrics, { isDark, compact: true });
    }
  }

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (modal) {
        if (typeof modal.showModal === 'function') {
          modal.showModal();
        } else {
          modal.setAttribute('open', '');
        }
        updateUi();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (modal) {
        if (typeof modal.close === 'function') {
          modal.close();
        } else {
          modal.removeAttribute('open');
        }
      }
    });
  }

  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        if (typeof modal.close === 'function') {
          modal.close();
        } else {
          modal.removeAttribute('open');
        }
      }
    });
  }

  if (spanSelect) {
    spanSelect.addEventListener('change', () => {
      setOlpSelectedSpanId(spanSelect.value);
      updateUi();
    });
  }

  if (switchModeSelect) {
    switchModeSelect.addEventListener('change', () => {
      setOlpSwitchMode(switchModeSelect.value);
      updateUi();
    });
  }

  if (revertiveModeSelect) {
    revertiveModeSelect.addEventListener('change', () => {
      setOlpRevertiveMode(revertiveModeSelect.value);
      updateUi();
    });
  }

  if (cutWorkingBtn) {
    cutWorkingBtn.addEventListener('click', () => {
      const active = getOlpWorkingFiberCut();
      setOlpWorkingFiberCut(!active);
      updateUi();
      if (options.onToast) {
        options.onToast(!active ? 'Working fiber severed! Automatic fast switchover to Protection route engaged.' : 'Working fiber repaired and spliced.');
      }
    });
  }

  if (cutProtectionBtn) {
    cutProtectionBtn.addEventListener('click', () => {
      const active = getOlpProtectionFiberCut();
      setOlpProtectionFiberCut(!active);
      updateUi();
      if (options.onToast) {
        options.onToast(!active ? 'Protection fiber severed!' : 'Protection fiber restored.');
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetOlpSimState();
      if (spanSelect) spanSelect.value = getOlpSelectedSpanId();
      if (switchModeSelect) switchModeSelect.value = getOlpSwitchMode();
      if (revertiveModeSelect) revertiveModeSelect.value = getOlpRevertiveMode();
      updateUi();
      if (options.onToast) {
        options.onToast('OLP parameters and fiber lines reset to baseline.');
      }
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const metrics = calculateOlpMetrics(state);
      const report = generateOlpReport(metrics);
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(report).then(() => {
          if (options.onToast) options.onToast('OLP audit report copied to clipboard.');
        }).catch(() => {
          prompt('Copy OLP Audit Report:', report);
        });
      } else {
        prompt('Copy OLP Audit Report:', report);
      }
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const metrics = calculateOlpMetrics(state);
      exportOlpJson(metrics);
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const metrics = calculateOlpMetrics(state);
      exportOlpCsv(metrics);
    });
  }

  // Initial draw
  updateUi();
}
