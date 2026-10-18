import { formatPKR } from './core.js';

/**
 * Solar Hybrid Inverter Charge Cycle & Utility Grid Load Shedding Monitor
 * Tracks solar photovoltaic generation (kW), equipment AC load, battery bank SoC autonomy,
 * inverter operational modes (SBU/SUB/Island), and LESCO grid load shedding resilience
 * across Shahdara ISP Central Hub and distribution Point-of-Presence (POP) stations.
 */

export const SHAHDARA_SOLAR_HUBS = [
  {
    id: 'station-main-hub',
    name: 'Shahdara Station Central POP',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Shahdara Chowk', 'Station'],
    inverterModel: 'Inverex Aerox 10kW Pure Sine Wave Hybrid',
    inverterCapacityW: 10000,
    solarArrayWp: 12000, // 12 kWp (24x 500W Mono-PERC)
    batteryType: '48V 400Ah LiFePO4 (19.2 kWh)',
    batteryCapacityWh: 19200,
    nominalVoltageV: 51.2,
    baselineLoadW: 2150, // OLT core chassis, BNG, core switches, cooling
    defaultMode: 'SBU'
  },
  {
    id: 'wandala-sub-station',
    name: 'Wandala Road Optical POP',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Wandala Road', 'Vandala Road', 'Zia Town'],
    inverterModel: 'Growatt SPF 5000ES 5kW Off-Grid/Hybrid',
    inverterCapacityW: 5000,
    solarArrayWp: 6000, // 6 kWp (12x 500W)
    batteryType: '48V 200Ah Deep-Cycle Tubular (9.6 kWh)',
    batteryCapacityWh: 9600,
    nominalVoltageV: 48.0,
    baselineLoadW: 1350,
    defaultMode: 'SBU'
  },
  {
    id: 'saeed-park-optical-pop',
    name: 'Saeed Park Distribution Node',
    primaryArea: 'Saeed Park',
    aliasAreas: ['Saeed Park', 'Tariq Road'],
    inverterModel: 'Fronius Primo 5kW Hybrid Inverter',
    inverterCapacityW: 5000,
    solarArrayWp: 5400, // 5.4 kWp (10x 540W)
    batteryType: '48V 200Ah LiFePO4 (9.6 kWh)',
    batteryCapacityWh: 9600,
    nominalVoltageV: 51.2,
    baselineLoadW: 1100,
    defaultMode: 'SUB'
  },
  {
    id: 'jia-musa-node',
    name: 'Jia Musa Micro-Distribution Hub',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Ghazi Park'],
    inverterModel: 'Inverex Nitrox 6kW Hybrid Inverter',
    inverterCapacityW: 6000,
    solarArrayWp: 6000,
    batteryType: '48V 200Ah Lithium Iron Phosphate',
    batteryCapacityWh: 9600,
    nominalVoltageV: 51.2,
    baselineLoadW: 980,
    defaultMode: 'SBU'
  },
  {
    id: 'baradari-pop',
    name: 'Baradari Riverfront Solar POP',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Ravi Riverfront'],
    inverterModel: 'Crown Micro 4kW Hybrid Inverter',
    inverterCapacityW: 4000,
    solarArrayWp: 4500,
    batteryType: '48V 150Ah Deep-Cycle Tubular',
    batteryCapacityWh: 7200,
    nominalVoltageV: 48.0,
    baselineLoadW: 820,
    defaultMode: 'SUB'
  }
];

let selectedSolarHubId = 'station-main-hub';
let selectedSolarMode = 'SBU';
let simulatedSolarIrradiance = null; // null = use time-of-day natural curve, number 0-100 = override

export function getSolarSelectedHub() {
  return selectedSolarHubId;
}

export function setSolarSelectedHub(hubId) {
  if (SHAHDARA_SOLAR_HUBS.some(h => h.id === hubId)) {
    selectedSolarHubId = hubId;
  }
}

export function getSolarMode() {
  return selectedSolarMode;
}

export function setSolarMode(mode) {
  if (['SBU', 'SUB', 'Island'].includes(mode)) {
    selectedSolarMode = mode;
  }
}

export function getSolarIrradiance() {
  return simulatedSolarIrradiance;
}

export function setSolarIrradiance(val) {
  if (val === null || val === undefined) {
    simulatedSolarIrradiance = null;
  } else {
    const num = Number(val);
    simulatedSolarIrradiance = isNaN(num) ? null : Math.max(0, Math.min(100, num));
  }
}

function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Calculates Solar PV generation, battery charge status, equipment AC load, and LESCO grid resilience.
 */
export function calculateSolarInverterMetrics(state, options = {}) {
  const referenceDate = options.referenceDate instanceof Date && !isNaN(options.referenceDate)
    ? options.referenceDate
    : new Date(options.referenceDate || Date.now());

  const hubId = options.hubId || selectedSolarHubId || 'station-main-hub';
  const mode = options.mode || selectedSolarMode || 'SBU';
  const customIrradiance = options.simulatedIrradiance !== undefined ? options.simulatedIrradiance : simulatedSolarIrradiance;

  const customers = Array.isArray(state?.customers) ? state.customers.filter(c => !c.archived) : [];

  // Pakistan Standard Time (PKT = UTC+5) hour of day decimal
  const pktHour = ((referenceDate.getUTCHours() + 5) % 24) + (referenceDate.getUTCMinutes() / 60);

  // Natural diurnal solar generation factor (06:00 to 18:30 PKT)
  let naturalIrradianceFactor = 0;
  if (pktHour >= 6.0 && pktHour <= 18.5) {
    // Sinusoidal bell curve peaking at 12:15 PKT
    naturalIrradianceFactor = Math.sin(((pktHour - 6.0) / 12.5) * Math.PI);
  }

  const effectiveIrradianceFactor = customIrradiance !== null
    ? Math.max(0, Math.min(1, customIrradiance / 100))
    : naturalIrradianceFactor;

  let totalFleetSolarWp = 0;
  let totalFleetCurrentGenW = 0;
  let totalFleetLoadW = 0;
  let totalDailySolarKwh = 0;
  let totalAvoidedCostPkr = 0;

  const hubs = SHAHDARA_SOLAR_HUBS.map(hub => {
    totalFleetSolarWp += hub.solarArrayWp;

    // Match customers
    const normPrimary = (hub.primaryArea || '').toLowerCase().trim();
    const aliasSet = new Set((hub.aliasAreas || []).map(a => a.toLowerCase().trim()));
    aliasSet.add(normPrimary);

    const matchedSubs = customers.filter(c => {
      const area = (c.area || '').toLowerCase().trim();
      return aliasSet.has(area) || area.includes(normPrimary);
    });

    const activeSubs = matchedSubs.filter(c => {
      const s = String(c.manualStatus || c.status || '').toLowerCase();
      return s !== 'offline';
    }).length;

    // AC load: baseline + minor incremental load per active subscriber
    const currentLoadW = Math.round(hub.baselineLoadW + (activeSubs * 6.5));
    totalFleetLoadW += currentLoadW;

    // Current PV Generation (Watts)
    const currentPvW = Math.round(hub.solarArrayWp * effectiveIrradianceFactor * 0.88); // 88% system derating / inverter efficiency
    totalFleetCurrentGenW += currentPvW;

    // Daily solar energy yield (kWh) = ratedArrayWp * ~4.8 peak sun hours * 0.82 / 1000
    const dailySolarKwh = Number(((hub.solarArrayWp * 4.8 * 0.82) / 1000).toFixed(1));
    totalDailySolarKwh += dailySolarKwh;

    // Commercial LESCO Tariff: ~65 PKR / kWh
    const dailySavedPkr = Math.round(dailySolarKwh * 65);
    const monthlySavedPkr = dailySavedPkr * 30;
    totalAvoidedCostPkr += dailySavedPkr;

    // Power balance & battery state
    const netPowerW = currentPvW - currentLoadW;
    let batteryState = 'IDLE';
    let batteryAmps = 0;
    let batterySoC = 88; // Default good charge

    // LESCO Grid Outage status: check if offline rate > 25% or manual Island mode
    const offlineCount = matchedSubs.length - activeSubs;
    const isGridDown = mode === 'Island' || (matchedSubs.length >= 3 && (offlineCount / matchedSubs.length) >= 0.25);

    let gridStatusLabel = 'LESCO GRID ONLINE (224V / 50.1Hz)';
    let gridBadgeClass = 'badge-success';
    let inverterOperationMode = mode;

    if (isGridDown) {
      gridStatusLabel = 'LOAD SHEDDING ACTIVE (0V / Blackout)';
      gridBadgeClass = 'badge-danger';
      inverterOperationMode = 'Island Backup';
    } else if (mode === 'SUB') {
      gridStatusLabel = 'GRID ASSIST ACTIVE (Solar-Utility-Battery)';
      gridBadgeClass = 'badge-expansion';
    }

    if (netPowerW > 0) {
      batteryState = 'CHARGING';
      batteryAmps = Number((netPowerW / hub.nominalVoltageV).toFixed(1));
      batterySoC = Math.min(100, Math.round(75 + (effectiveIrradianceFactor * 25)));
    } else {
      batteryState = isGridDown ? 'DISCHARGING' : (mode === 'SUB' ? 'FLOAT BUFFER' : 'DISCHARGING');
      const deficitW = Math.abs(netPowerW);
      batteryAmps = Number((deficitW / hub.nominalVoltageV).toFixed(1));
      batterySoC = isGridDown ? 64 : 82;
    }

    // Battery Autonomy (hours remaining until 20% DoD cut-off)
    const usableBatteryWh = hub.batteryCapacityWh * Math.max(0, (batterySoC - 20) / 100);
    const dischargeWatts = Math.max(100, currentLoadW - currentPvW);
    const autonomyHours = Number((usableBatteryWh / dischargeWatts).toFixed(1));

    // Hourly curve data for chart (06:00 to 19:00 PKT)
    const hourlyData = [];
    for (let h = 6; h <= 19; h++) {
      let f = 0;
      if (h >= 6 && h <= 18) {
        f = Math.sin(((h - 6) / 12) * Math.PI);
      }
      const pvGenKw = Number(((hub.solarArrayWp * f * 0.88) / 1000).toFixed(2));
      const loadKw = Number((currentLoadW / 1000).toFixed(2));
      hourlyData.push({
        hour: h,
        hourLabel: `${String(h).padStart(2, '0')}:00`,
        solarKw: pvGenKw,
        loadKw
      });
    }

    return {
      id: hub.id,
      name: hub.name,
      primaryArea: hub.primaryArea,
      inverterModel: hub.inverterModel,
      inverterCapacityW: hub.inverterCapacityW,
      solarArrayWp: hub.solarArrayWp,
      solarArrayKwp: (hub.solarArrayWp / 1000).toFixed(1),
      batteryType: hub.batteryType,
      batteryCapacityWh: hub.batteryCapacityWh,
      nominalVoltageV: hub.nominalVoltageV,
      currentLoadW,
      currentLoadKw: (currentLoadW / 1000).toFixed(2),
      currentPvW,
      currentPvKw: (currentPvW / 1000).toFixed(2),
      netPowerW,
      batteryState,
      batteryAmps,
      batterySoC,
      autonomyHours,
      dailySolarKwh,
      dailySavedPkr,
      monthlySavedPkr,
      isGridDown,
      gridStatusLabel,
      gridBadgeClass,
      inverterOperationMode,
      activeSubscribers: activeSubs,
      totalSubscribers: matchedSubs.length,
      hourlyData
    };
  });

  const selectedHub = hubs.find(h => h.id === hubId) || hubs[0];

  return {
    referenceDate,
    pktHourDecimal: Number(pktHour.toFixed(2)),
    selectedHubId: selectedHub.id,
    selectedHub,
    selectedMode: mode,
    irradiancePercent: Math.round(effectiveIrradianceFactor * 100),
    hubs,
    totalFleetSolarWp,
    totalFleetSolarKwp: (totalFleetSolarWp / 1000).toFixed(1),
    totalFleetCurrentGenW,
    totalFleetCurrentGenKw: (totalFleetCurrentGenW / 1000).toFixed(2),
    totalFleetLoadW,
    totalFleetLoadKw: (totalFleetLoadW / 1000).toFixed(2),
    totalDailySolarKwh: Number(totalDailySolarKwh.toFixed(1)),
    totalDailySavedPkr: totalAvoidedCostPkr,
    totalMonthlySavedPkr: totalAvoidedCostPkr * 30
  };
}

/**
 * Generates an operational WhatsApp / clipboard solar power briefing for field engineers.
 */
export function generateSolarReport(solarData, referenceDate = new Date()) {
  const data = solarData || calculateSolarInverterMetrics();
  const hub = data.selectedHub;
  const dateStr = referenceDate.toISOString().slice(0, 10);

  const lines = [
    '================================================================',
    'SHAHDARA ISP - SOLAR INVERTER & GRID RESILIENCE AUDIT',
    '================================================================',
    `Date: ${dateStr} PKT | Station: ${hub.name}`,
    `Inverter: ${hub.inverterModel} (${(hub.inverterCapacityW / 1000).toFixed(0)} kW)`,
    `Solar PV Array: ${hub.solarArrayKwp} kWp | Battery: ${hub.batteryType}`,
    '----------------------------------------------------------------',
    `INVERTER MODE: ${hub.inverterOperationMode}`,
    `GRID STATUS: ${hub.gridStatusLabel}`,
    '----------------------------------------------------------------',
    `☀️ Current Solar PV Generation: ${hub.currentPvW} W (${hub.currentPvKw} kW)`,
    `⚡ POP Equipment AC Load: ${hub.currentLoadW} W (~${hub.activeSubscribers} active subs)`,
    `🔋 Battery Bank State: ${hub.batteryState} at ${hub.batterySoC}% SoC (${hub.batteryAmps} A)`,
    `⏱ Battery Autonomy Runtime: ~${hub.autonomyHours} hours remaining`,
    `🌱 Daily Solar Energy Harvest: ${hub.dailySolarKwh} kWh / day`,
    `💰 LESCO Grid Cost Avoided: ${formatPKR(hub.dailySavedPkr)} / day (~${formatPKR(hub.monthlySavedPkr)} / month)`,
    '----------------------------------------------------------------',
    'HOURLY SOLAR GENERATION CURVE:',
    '----------------------------------------------------------------'
  ];

  hub.hourlyData.forEach(h => {
    const barLen = Math.round(h.solarKw * 3);
    const bar = '■'.repeat(barLen) + ' '.repeat(Math.max(0, 15 - barLen));
    lines.push(`${h.hourLabel} | PV: ${h.solarKw.toFixed(2)} kW [${bar}] Load: ${h.loadKw.toFixed(2)} kW`);
  });

  lines.push('');
  lines.push('----------------------------------------------------------------');
  lines.push('LOAD SHEDDING OPERATING PROTOCOL:');
  lines.push('----------------------------------------------------------------');
  lines.push('1. Peak Solar Window (10:00 - 15:00): Run SBU mode; batteries float at 100%.');
  lines.push('2. If LESCO grid drops, inverter switches to Island mode in < 15 milliseconds.');
  lines.push('3. If Battery SoC drops below 25%, automatic ATS starts backup diesel generator.');
  lines.push('================================================================');

  return lines.join('\n');
}

/**
 * Renders pure SVG visualization for the solar generation curve vs load and battery status.
 */
export function renderSolarInverterSvg(solarData, options = {}) {
  const width = options.width || 640;
  const height = options.height || 260;

  if (!solarData || !solarData.selectedHub) {
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="Solar Hybrid Inverter Monitor Chart">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="13" fill="var(--muted, #71817c)">
        No solar inverter telemetry available
      </text>
    </svg>`;
  }

  const hub = solarData.selectedHub;
  const hourly = hub.hourlyData || [];

  const leftPad = 48;
  const rightPad = 24;
  const topPad = 40;
  const bottomPad = 48;

  const plotWidth = width - leftPad - rightPad;
  const plotHeight = height - topPad - bottomPad;

  // Max kW scale: round up to nearest whole kW
  const maxKw = Math.max(hub.solarArrayWp / 1000 * 1.05, 6.0);

  function toX(index) {
    return leftPad + (index / (hourly.length - 1)) * plotWidth;
  }

  function toY(kw) {
    const clamped = Math.max(0, Math.min(maxKw, kw));
    return topPad + plotHeight - (clamped / maxKw) * plotHeight;
  }

  // Construct solar curve path and load line path
  const solarPoints = hourly.map((h, i) => ({ x: toX(i), y: toY(h.solarKw) }));
  const loadPoints = hourly.map((h, i) => ({ x: toX(i), y: toY(h.loadKw) }));

  const solarPathD = solarPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const solarAreaD = `${solarPathD} L ${solarPoints[solarPoints.length - 1].x.toFixed(1)} ${toY(0).toFixed(1)} L ${solarPoints[0].x.toFixed(1)} ${toY(0).toFixed(1)} Z`;
  const loadPathD = loadPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  // Y-axis grid marks
  const yTicks = [0, maxKw * 0.25, maxKw * 0.5, maxKw * 0.75, maxKw];
  const yGridSvg = yTicks.map(val => {
    const y = toY(val);
    return `
      <line x1="${leftPad}" y1="${y}" x2="${width - rightPad}" y2="${y}" stroke="var(--line, #e2ece7)" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${leftPad - 6}" y="${y + 4}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">
        ${val.toFixed(1)} kW
      </text>
    `;
  }).join('');

  // X-axis hours
  const xLabelsSvg = hourly.filter((_, i) => i % 2 === 0).map((h, idx) => {
    const origIndex = idx * 2;
    const x = toX(origIndex);
    return `
      <line x1="${x}" y1="${topPad}" x2="${x}" y2="${height - bottomPad}" stroke="var(--line, #e2ece7)" stroke-width="1" stroke-dasharray="2,3" />
      <text x="${x}" y="${height - bottomPad + 14}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">
        ${h.hourLabel}
      </text>
    `;
  }).join('');

  // Status pill
  let statusColor = '#10b981';
  if (hub.isGridDown) statusColor = '#ef4444';
  else if (hub.inverterOperationMode === 'SUB') statusColor = '#3b82f6';

  const gradientId = `solarGrad-${hub.id}`;

  return `
    <svg class="chart-svg solar-inverter-svg" viewBox="0 0 ${width} ${height}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="Solar Hybrid Inverter Monitor Chart">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.45" />
          <stop offset="60%" stop-color="#10b981" stop-opacity="0.20" />
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
        </linearGradient>
      </defs>

      <!-- Background Card Canvas -->
      <rect width="${width}" height="${height}" rx="12" fill="var(--surface, #ffffff)" stroke="var(--line, #e2ece7)" stroke-width="1" />

      <!-- Header Info -->
      <text x="${leftPad}" y="22" font-family="'Manrope', system-ui, sans-serif" font-size="12" font-weight="800" fill="var(--ink, #182e2a)">
        ${escapeXml(hub.name)}
      </text>
      <text x="${leftPad + 220}" y="22" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">
        PV: ${hub.currentPvKw} kW | Load: ${hub.currentLoadKw} kW | SoC: ${hub.batterySoC}% (${hub.batteryState})
      </text>

      <!-- Status Pill -->
      <g transform="translate(${width - rightPad - 135}, 10)">
        <rect width="135" height="18" rx="9" fill="${statusColor}" opacity="0.15" />
        <rect width="135" height="18" rx="9" fill="none" stroke="${statusColor}" stroke-width="1" />
        <circle cx="10" cy="9" r="4" fill="${statusColor}" />
        <text x="20" y="13" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="800" fill="${statusColor}">
          ${hub.isGridDown ? 'LOAD SHEDDING' : 'GRID SYNCHRONIZED'}
        </text>
      </g>

      <!-- Grids -->
      ${yGridSvg}
      ${xLabelsSvg}

      <!-- Solar Generation Area Fill -->
      <path d="${solarAreaD}" fill="url(#${gradientId})" />

      <!-- Solar Generation Curve Line -->
      <path d="${solarPathD}" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" />

      <!-- Equipment Load Constant Line -->
      <path d="${loadPathD}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4,4" />

      <!-- Legend -->
      <g transform="translate(${leftPad}, ${height - 14})">
        <rect width="12" height="3" fill="#f59e0b" />
        <text x="18" y="4" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">
          Solar Generation Curve (kW)
        </text>

        <line x1="165" y1="2" x2="180" y2="2" stroke="#3b82f6" stroke-width="2" stroke-dasharray="3,3" />
        <text x="186" y="4" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">
          Equipment AC Load (kW)
        </text>

        <circle cx="320" cy="2" r="4" fill="${statusColor}" />
        <text x="330" y="4" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">
          Battery Autonomy: ~${hub.autonomyHours}h
        </text>
      </g>
    </svg>
  `;
}

/**
 * Sets up and wires the Solar Hybrid Inverter modal dialog.
 */
export function setupSolarModal(state, { referenceDate = new Date(), onFilterArea, onFilterCustomer, onToast, clipboard } = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

  const modal = document.getElementById('dashboardSolarModal');
  const openBtn = document.getElementById('dashboardOpenSolarModalBtn');
  const closeBtn = document.getElementById('dashboardSolarModalCloseBtn');
  const hubSelect = document.getElementById('solarHubSelect');
  const modeSelect = document.getElementById('solarModeSelect');
  const irradianceSlider = document.getElementById('solarIrradianceSlider');
  const irradianceVal = document.getElementById('solarIrradianceVal');
  const resetSliderBtn = document.getElementById('solarResetSimBtn');

  const chartContainer = document.getElementById('solarModalChartWrap');
  const tableBody = document.getElementById('solarHubsTableBody');
  const copyBtn = document.getElementById('dashboardCopySolarReportBtn');
  const filterAreaBtn = document.getElementById('solarFilterAreaBtn');

  const hubNameEl = document.getElementById('solarKpiHubName');
  const pvOutputEl = document.getElementById('solarKpiPvOutput');
  const batterySocEl = document.getElementById('solarKpiBatterySoc');
  const gridStatusEl = document.getElementById('solarKpiGridStatus');
  const monthlySavingsEl = document.getElementById('solarKpiSavings');
  const statusBadgeEl = document.getElementById('solarStatusBadge');

  if (!modal) return;

  function renderView() {
    const solarData = calculateSolarInverterMetrics(state, {
      referenceDate,
      hubId: selectedSolarHubId,
      mode: selectedSolarMode,
      simulatedIrradiance: simulatedSolarIrradiance
    });

    const hub = solarData.selectedHub;

    if (hubNameEl) hubNameEl.textContent = `${hub.name} (${hub.solarArrayKwp} kWp)`;
    if (pvOutputEl) pvOutputEl.textContent = `${hub.currentPvW} W (${hub.currentPvKw} kW)`;
    if (batterySocEl) batterySocEl.textContent = `${hub.batterySoC}% (${hub.batteryState} ~${hub.autonomyHours}h)`;
    if (gridStatusEl) gridStatusEl.textContent = hub.gridStatusLabel;
    if (monthlySavingsEl) monthlySavingsEl.textContent = `${formatPKR(hub.monthlySavedPkr)} / mo (${hub.dailySolarKwh} kWh/d)`;

    if (statusBadgeEl) {
      statusBadgeEl.textContent = hub.gridStatusLabel;
      statusBadgeEl.className = `sim-delta-badge ${hub.gridBadgeClass}`;
    }

    if (irradianceSlider) {
      if (simulatedSolarIrradiance !== null) {
        irradianceSlider.value = String(simulatedSolarIrradiance);
        if (irradianceVal) irradianceVal.textContent = `${simulatedSolarIrradiance}%`;
      } else {
        irradianceSlider.value = String(solarData.irradiancePercent);
        if (irradianceVal) irradianceVal.textContent = `Auto (${solarData.irradiancePercent}%)`;
      }
    }

    if (chartContainer) {
      chartContainer.innerHTML = renderSolarInverterSvg(solarData, { width: 680, height: 250 });
    }

    if (tableBody) {
      tableBody.innerHTML = solarData.hubs.map((h, idx) => `
        <tr>
          <td><strong>${escapeXml(h.name)}</strong></td>
          <td>${escapeXml(h.inverterModel)}</td>
          <td><strong>${h.solarArrayKwp} kWp</strong></td>
          <td>${h.currentPvKw} kW</td>
          <td>${h.currentLoadKw} kW</td>
          <td><strong>${h.batterySoC}%</strong> (${h.batteryState})</td>
          <td>
            <span class="sim-delta-badge ${h.gridBadgeClass}" style="font-size:10.5px;">
              ${escapeXml(h.gridStatusLabel)}
            </span>
          </td>
          <td><strong>${formatPKR(h.dailySavedPkr)}</strong></td>
        </tr>
      `).join('');
    }

    if (filterAreaBtn) {
      filterAreaBtn.textContent = `Inspect ${hub.primaryArea} Accounts`;
      filterAreaBtn.setAttribute('data-solar-area', hub.primaryArea);
    }
  }

  function populateAndOpen() {
    if (hubSelect && hubSelect.children.length === 0) {
      hubSelect.innerHTML = SHAHDARA_SOLAR_HUBS.map(h => `
        <option value="${h.id}" ${h.id === selectedSolarHubId ? 'selected' : ''}>
          ${h.name} (${(h.solarArrayWp / 1000).toFixed(1)} kWp)
        </option>
      `).join('');
    }

    renderView();

    if (modal.showModal) modal.showModal();
    else modal.setAttribute('open', '');
  }

  if (hubSelect && !hubSelect.dataset?.wired) {
    if (hubSelect.dataset) hubSelect.dataset.wired = 'true';
    else if (hubSelect.setAttribute) hubSelect.setAttribute('data-wired', 'true');
    hubSelect.addEventListener('change', () => {
      setSolarSelectedHub(hubSelect.value);
      renderView();
    });
  }

  if (modeSelect && !modeSelect.dataset?.wired) {
    if (modeSelect.dataset) modeSelect.dataset.wired = 'true';
    else if (modeSelect.setAttribute) modeSelect.setAttribute('data-wired', 'true');
    modeSelect.addEventListener('change', () => {
      setSolarMode(modeSelect.value);
      renderView();
    });
  }

  if (irradianceSlider && !irradianceSlider.dataset?.wired) {
    if (irradianceSlider.dataset) irradianceSlider.dataset.wired = 'true';
    else if (irradianceSlider.setAttribute) irradianceSlider.setAttribute('data-wired', 'true');
    irradianceSlider.addEventListener('input', () => {
      const val = Number(irradianceSlider.value);
      setSolarIrradiance(val);
      if (irradianceVal) irradianceVal.textContent = `${val}%`;
      renderView();
    });
  }

  if (resetSliderBtn && !resetSliderBtn.dataset?.wired) {
    if (resetSliderBtn.dataset) resetSliderBtn.dataset.wired = 'true';
    else if (resetSliderBtn.setAttribute) resetSliderBtn.setAttribute('data-wired', 'true');
    resetSliderBtn.addEventListener('click', () => {
      setSolarIrradiance(null);
      renderView();
    });
  }

  if (filterAreaBtn && !filterAreaBtn.dataset?.wired) {
    if (filterAreaBtn.dataset) filterAreaBtn.dataset.wired = 'true';
    else if (filterAreaBtn.setAttribute) filterAreaBtn.setAttribute('data-wired', 'true');
    filterAreaBtn.addEventListener('click', () => {
      const area = filterAreaBtn.getAttribute('data-solar-area');
      if (typeof onFilterArea === 'function' && area) {
        onFilterArea(area);
        if (modal.close) modal.close();
        else modal.removeAttribute('open');
      } else if (typeof onFilterCustomer === 'function' && area) {
        onFilterCustomer(area);
        if (modal.close) modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  if (copyBtn && !copyBtn.dataset?.wired) {
    if (copyBtn.dataset) copyBtn.dataset.wired = 'true';
    else if (copyBtn.setAttribute) copyBtn.setAttribute('data-wired', 'true');
    copyBtn.addEventListener('click', async () => {
      const solarData = calculateSolarInverterMetrics(state, {
        referenceDate,
        hubId: selectedSolarHubId,
        mode: selectedSolarMode,
        simulatedIrradiance: simulatedSolarIrradiance
      });
      const text = generateSolarReport(solarData, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Solar power audit briefing copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy to clipboard.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard not supported in this browser.');
      }
    });
  }

  if (openBtn && !openBtn.dataset?.wired) {
    if (openBtn.dataset) openBtn.dataset.wired = 'true';
    else if (openBtn.setAttribute) openBtn.setAttribute('data-wired', 'true');
    openBtn.addEventListener('click', populateAndOpen);
  }

  if (closeBtn && !closeBtn.dataset?.wired) {
    if (closeBtn.dataset) closeBtn.dataset.wired = 'true';
    else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired', 'true');
    closeBtn.addEventListener('click', () => {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    }
  });
}
