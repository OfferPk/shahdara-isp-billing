import { formatPKR } from './core.js';
import { triggerHaptic } from './nav.js';

/**
 * Technician Aerial Fiber Pole Catenary Sag & Weather Hazard Mobile Field Inspection Dispatcher
 * Monitors aerial optical fiber infrastructure across Shahdara utility poles and rooftop spans,
 * calculating temperature-induced thermal expansion elongation, monsoon windstorm transverse drag,
 * road traffic vehicle snag clearance margins, and dead-end pole anchor tension.
 */

export const AERIAL_ALERTS_STORAGE_KEY = 'shahdara_aerial_inspections_v1';

export const SHAHDARA_AERIAL_SECTORS = [
  {
    id: 'aer-gt-01',
    code: 'AER-GT01',
    name: 'GT Road Highway Crossing & Railway Span',
    area: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    polesCount: 14,
    spanLengthMeters: 68,
    cableType: 'Figure-8 Steel Messenger 24C',
    baseGroundClearance: 6.2, // meters
    minRoadClearanceRequired: 5.5, // 5.5m highway truck standard
    normalSag: 0.85, // meters at 20°C
    criticalSagThreshold: 1.35,
    thermalExpansionAlpha: 1.2e-5, // 1/°C for steel messenger
    linemanTeam: 'Usman & Bilal Team'
  },
  {
    id: 'aer-br-02',
    code: 'AER-BR02',
    name: 'Old Ravi Bridge Riverbank Pier Run',
    area: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    polesCount: 22,
    spanLengthMeters: 85,
    cableType: 'All-Dielectric Self-Supporting (ADSS) 48C',
    baseGroundClearance: 7.5,
    minRoadClearanceRequired: 5.0,
    normalSag: 1.10,
    criticalSagThreshold: 1.85,
    thermalExpansionAlpha: 0.5e-5, // aramid core
    linemanTeam: 'Hamza Tariq & Naveed'
  },
  {
    id: 'aer-vr-03',
    code: 'AER-VR03',
    name: 'Vandala Road Industrial Feeder Trunk',
    area: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    polesCount: 18,
    spanLengthMeters: 55,
    cableType: 'Figure-8 Steel Messenger 24C',
    baseGroundClearance: 5.8,
    minRoadClearanceRequired: 5.2,
    normalSag: 0.70,
    criticalSagThreshold: 1.15,
    thermalExpansionAlpha: 1.2e-5,
    linemanTeam: 'Imran Sadiq Team'
  },
  {
    id: 'aer-jm-04',
    code: 'AER-JM04',
    name: 'Jia Musa Narrow Alleyway Distribution',
    area: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    polesCount: 26,
    spanLengthMeters: 42,
    cableType: '2-Core FTTH Drop Cable Double Wire',
    baseGroundClearance: 5.0,
    minRoadClearanceRequired: 4.2, // tractor/rickshaw limit
    normalSag: 0.55,
    criticalSagThreshold: 0.95,
    thermalExpansionAlpha: 1.4e-5,
    linemanTeam: 'Kashif Ali & Asad'
  },
  {
    id: 'aer-sp-05',
    code: 'AER-SP05',
    name: 'Saeed Park Highway Overpass Flyover',
    area: 'Saeed Park',
    aliasAreas: ['Saeed Park', 'Rehman Park'],
    polesCount: 16,
    spanLengthMeters: 75,
    cableType: 'ADSS Heavy Duty Span',
    baseGroundClearance: 6.8,
    minRoadClearanceRequired: 5.5,
    normalSag: 0.95,
    criticalSagThreshold: 1.55,
    thermalExpansionAlpha: 0.5e-5,
    linemanTeam: 'Zubair Ahmad Team'
  },
  {
    id: 'aer-ot-06',
    code: 'AER-OT06',
    name: 'Main Bazaar Commercial Overhead Web',
    area: 'Main Bazaar',
    aliasAreas: ['Main Bazaar', 'Commercial Market'],
    polesCount: 32,
    spanLengthMeters: 38,
    cableType: 'Figure-8 Steel 12C',
    baseGroundClearance: 4.8,
    minRoadClearanceRequired: 4.0,
    normalSag: 0.45,
    criticalSagThreshold: 0.85,
    thermalExpansionAlpha: 1.2e-5,
    linemanTeam: 'Faisal Abbasi & Team'
  }
];

/**
 * Retrieves the persistent inspection and hazard resolution store from localStorage.
 */
export function getAerialInspectionsStore(storage) {
  const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!s) return { inspections: {}, lastUpdated: null };
  try {
    const raw = s.getItem(AERIAL_ALERTS_STORAGE_KEY);
    if (!raw) return { inspections: {}, lastUpdated: null };
    const parsed = JSON.parse(raw);
    return {
      inspections: parsed.inspections || {},
      lastUpdated: parsed.lastUpdated || null
    };
  } catch {
    return { inspections: {}, lastUpdated: null };
  }
}

/**
 * Saves the persistent inspection store to localStorage.
 */
export function saveAerialInspectionsStore(store, storage) {
  const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!s) return false;
  try {
    const payload = {
      inspections: store.inspections || {},
      lastUpdated: new Date().toISOString()
    };
    s.setItem(AERIAL_ALERTS_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Records a resolution or inspection action for an aerial sector.
 */
export function recordAerialInspection(sectorId, details = {}, storage) {
  const store = getAerialInspectionsStore(storage);
  const now = new Date().toISOString();
  store.inspections[sectorId] = {
    resolvedAt: now,
    inspector: details.inspector || 'Lineman On Duty',
    actionTaken: details.actionTaken || 'Cable re-tensioned and dead-end clamp secured',
    notes: details.notes || 'Routine clearance restored.'
  };
  saveAerialInspectionsStore(store, storage);
  return store.inspections[sectorId];
}

/**
 * Clears aerial inspections store.
 */
export function clearAerialInspectionsStore(storage) {
  const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!s) return false;
  try {
    s.removeItem(AERIAL_ALERTS_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculates catenary sag, thermal expansion elongation, and net road clearance.
 */
export function calculateCatenarySag(sector, options = {}) {
  const sec = sector || SHAHDARA_AERIAL_SECTORS[0];
  const tempC = Number(options.temperatureC ?? 28);
  const windKmh = Number(options.windSpeedKmh ?? 15);

  // Temperature expansion calculation:
  // Base calibration reference temperature is 20°C
  const deltaT = tempC - 20;
  const thermalExpansion = 1 + (sec.thermalExpansionAlpha * deltaT * 40); // amplified elongation under span self-weight

  // Wind load transverse deflection ratio
  const windDeflectionRatio = windKmh > 25
    ? 1 + ((windKmh - 25) * 0.012)
    : 1.0;

  // Vertical thermal sag
  const verticalSagM = Math.round((sec.normalSag * Math.sqrt(Math.max(0.7, thermalExpansion))) * 100) / 100;
  // Effective sag under wind transverse deflection
  const effectiveSagM = Math.round((verticalSagM * windDeflectionRatio) * 100) / 100;

  // Net clearance above road surface (meters)
  const netClearanceM = Math.round((sec.baseGroundClearance - effectiveSagM) * 100) / 100;

  // Clearance margin above statutory required minimum
  const clearanceMarginM = Math.round((netClearanceM - sec.minRoadClearanceRequired) * 100) / 100;

  // Pole mechanical dead-end anchor tension load (Newtons)
  // Gravity tension T_g = (w * L^2) / (8 * verticalSag)
  const baseTensionN = 750 * (sec.spanLengthMeters / 50);
  const gravityTension = baseTensionN / Math.max(0.4, verticalSagM);
  const windTensionMultiplier = 1 + (Math.pow(windKmh / 50, 1.6) * 0.45);
  const tensionN = Math.round(gravityTension * windTensionMultiplier);

  // Status classification
  let status = 'OPTIMAL';
  let statusLabel = 'Safe Road Clearance';
  let badgeClass = 'badge-success';

  if (clearanceMarginM <= 0.08 || effectiveSagM >= sec.criticalSagThreshold) {
    status = 'CRITICAL';
    statusLabel = 'Snag Hazard · Urgent Re-tension';
    badgeClass = 'badge-danger';
  } else if (clearanceMarginM <= 0.35 || effectiveSagM >= sec.normalSag * 1.25) {
    status = 'ELEVATED';
    statusLabel = 'Thermal Sag Advisory';
    badgeClass = 'badge-warning';
  }

  return {
    sector: sec,
    temperatureC: tempC,
    windSpeedKmh: windKmh,
    effectiveSagM,
    netClearanceM,
    clearanceMarginM,
    tensionN,
    status,
    statusLabel,
    badgeClass
  };
}

/**
 * Calculates aggregate aerial alerts metrics across all Shahdara sectors.
 */
export function calculateAerialAlertsSummary(state, options = {}) {
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const store = getAerialInspectionsStore(storage);
  const tempC = options.temperatureC ?? 28;
  const windKmh = options.windSpeedKmh ?? 15;

  const evaluations = SHAHDARA_AERIAL_SECTORS.map((sec) => {
    const evalData = calculateCatenarySag(sec, { temperatureC: tempC, windSpeedKmh: windKmh });
    const inspection = store.inspections[sec.id] || null;
    return {
      ...evalData,
      inspection
    };
  });

  const criticalCount = evaluations.filter((e) => e.status === 'CRITICAL' && !e.inspection).length;
  const elevatedCount = evaluations.filter((e) => e.status === 'ELEVATED' && !e.inspection).length;
  const optimalCount = evaluations.filter((e) => e.status === 'OPTIMAL' || e.inspection).length;

  return {
    evaluations,
    criticalCount,
    elevatedCount,
    optimalCount,
    totalSectors: evaluations.length,
    activeHazardBadgeCount: criticalCount + elevatedCount
  };
}

/**
 * Pure SVG visualizer for Aerial Cable Catenary Sag & Vehicle Clearance Profile.
 */
export function renderAerialCatenarySvg(evaluation) {
  if (!evaluation || !evaluation.sector) {
    return `<div class="chart-empty-state"><p>No aerial span data available.</p></div>`;
  }

  const { sector, effectiveSagM, netClearanceM, clearanceMarginM, temperatureC, windSpeedKmh, status } = evaluation;

  const width = 720;
  const height = 260;

  const statusColor = status === 'CRITICAL' ? '#ef4444' : status === 'ELEVATED' ? '#f59e0b' : '#10b981';
  const statusBg = status === 'CRITICAL' ? 'rgba(239, 68, 68, 0.15)' : status === 'ELEVATED' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)';

  // Scale: 1m = ~24px vertically. Base pole height = 6.2m -> ~150px.
  const groundY = 220;
  const poleTopY = Math.max(30, groundY - (sector.baseGroundClearance * 24));
  const sagApexY = groundY - (netClearanceM * 24);
  const requiredClearanceY = groundY - (sector.minRoadClearanceRequired * 24);

  // Parabolic path for catenary curve between poles at X: 110 and X: 610
  const poleLeftX = 110;
  const poleRightX = 610;
  const midX = (poleLeftX + poleRightX) / 2;

  return `
    <svg class="aerial-catenary-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Aerial Cable Catenary Sag and Road Clearance Profile">
      <defs>
        <linearGradient id="catenarySky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--bg-soft, #f8fafc)" stop-opacity="0.8" />
          <stop offset="100%" stop-color="var(--surface, #ffffff)" />
        </linearGradient>
      </defs>

      <rect width="${width}" height="${height}" rx="8" fill="url(#catenarySky)" stroke="var(--border, #e2e8f0)" />

      <!-- Sector Header -->
      <text x="20" y="24" font-size="13" font-weight="800" fill="var(--ink, #182e2a)">${sector.name} (${sector.spanLengthMeters}m Span)</text>
      <text x="20" y="38" font-size="10.5" fill="var(--muted, #64748b)">Cable: ${sector.cableType} | Conditions: ${temperatureC}°C, ${windSpeedKmh} km/h wind</text>

      <rect x="${width - 140}" y="12" width="124" height="22" rx="4" fill="${statusBg}" />
      <text x="${width - 78}" y="27" font-size="10" font-weight="800" fill="${statusColor}" text-anchor="middle">${status}</text>

      <!-- Road Surface Ground Level -->
      <line x1="40" y1="${groundY}" x2="680" y2="${groundY}" stroke="#475569" stroke-width="3" stroke-linecap="round" />
      <text x="40" y="${groundY + 16}" font-size="9" fill="var(--muted, #64748b)" font-weight="600">Road Surface (0.0m)</text>

      <!-- Left Utility Pole -->
      <rect x="${poleLeftX - 5}" y="${poleTopY}" width="10" height="${groundY - poleTopY}" fill="#94a3b8" rx="2" />
      <line x1="${poleLeftX - 18}" y1="${poleTopY + 8}" x2="${poleLeftX + 18}" y2="${poleTopY + 8}" stroke="#64748b" stroke-width="3" stroke-linecap="round" />
      <text x="${poleLeftX}" y="${groundY + 16}" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">Pole #1</text>
      <text x="${poleLeftX - 10}" y="${poleTopY - 6}" font-size="9" font-weight="700" fill="var(--ink, #182e2a)" text-anchor="end">${sector.baseGroundClearance}m</text>

      <!-- Right Utility Pole -->
      <rect x="${poleRightX - 5}" y="${poleTopY}" width="10" height="${groundY - poleTopY}" fill="#94a3b8" rx="2" />
      <line x1="${poleRightX - 18}" y1="${poleTopY + 8}" x2="${poleRightX + 18}" y2="${poleTopY + 8}" stroke="#64748b" stroke-width="3" stroke-linecap="round" />
      <text x="${poleRightX}" y="${groundY + 16}" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">Pole #2</text>
      <text x="${poleRightX + 10}" y="${poleTopY - 6}" font-size="9" font-weight="700" fill="var(--ink, #182e2a)" text-anchor="start">${sector.baseGroundClearance}m</text>

      <!-- Min Road Clearance Boundary Line (Dashed) -->
      <line x1="${poleLeftX}" y1="${requiredClearanceY}" x2="${poleRightX}" y2="${requiredClearanceY}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,4" />
      <text x="${poleRightX - 6}" y="${requiredClearanceY - 5}" font-size="8.5" font-weight="700" fill="#ef4444" text-anchor="end">Min Clearance Limit (${sector.minRoadClearanceRequired}m)</text>

      <!-- Commercial Vehicle Clearance Silhouette (Truck/Bus Height ~4.2m -> ~100px) -->
      <g transform="translate(${midX - 35}, ${groundY - 100})">
        <rect x="0" y="20" width="70" height="80" rx="3" fill="#64748b" opacity="0.25" />
        <rect x="5" y="0" width="45" height="40" rx="3" fill="#64748b" opacity="0.35" />
        <text x="35" y="55" font-size="8" fill="var(--ink, #182e2a)" text-anchor="middle" font-weight="600">Truck (4.2m)</text>
      </g>

      <!-- Catenary Parabola Cable Curve -->
      <path d="M ${poleLeftX} ${poleTopY + 8} Q ${midX} ${sagApexY * 2 - (poleTopY + 8)} ${poleRightX} ${poleTopY + 8}" fill="none" stroke="${statusColor}" stroke-width="3" />

      <!-- Sag Measurement Marker (Apex of sag) -->
      <circle cx="${midX}" cy="${sagApexY}" r="4" fill="${statusColor}" stroke="#ffffff" stroke-width="1.5" />
      <line x1="${midX}" y1="${poleTopY + 8}" x2="${midX}" y2="${sagApexY}" stroke="var(--ink, #182e2a)" stroke-width="1" stroke-dasharray="2,2" />
      
      <!-- Sag and Clearance Callout Badge -->
      <rect x="${midX + 10}" y="${sagApexY - 26}" width="140" height="32" rx="4" fill="var(--ink, #182e2a)" opacity="0.9" />
      <text x="${midX + 18}" y="${sagApexY - 13}" font-size="9.5" font-weight="700" fill="#ffffff">Sag: ${effectiveSagM}m | Clr: ${netClearanceM}m</text>
      <text x="${midX + 18}" y="${sagApexY - 1}" font-size="8.5" fill="${clearanceMarginM < 0.2 ? '#fca5a5' : '#86efac'}">Margin: ${clearanceMarginM >= 0 ? '+' : ''}${clearanceMarginM}m</text>

      <!-- Wind vectors if active -->
      ${windSpeedKmh > 25 ? `
        <g transform="translate(60, 90)">
          <line x1="0" y1="0" x2="30" y2="0" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" />
          <polygon points="30,0 22,-4 22,4" fill="#38bdf8" />
          <text x="35" y="4" font-size="8.5" font-weight="700" fill="#0284c7">Wind: ${windSpeedKmh} km/h</text>
        </g>
      ` : ''}
    </svg>
  `;
}

/**
 * Generates plain-text dispatch slip for field linemen.
 */
export function generateAerialHazardWorkOrder(sector, evaluation, date = '2026-10-16') {
  if (!sector || !evaluation) return 'No aerial dispatch data available.';

  let out = '';
  out += '========================================================================\n';
  out += '   SHAHDARA FTTH AERIAL FIBER POLE SAG & WEATHER HAZARD WORK ORDER\n';
  out += `   Date: ${date} PKT | Sector Code: ${sector.code}\n`;
  out += '========================================================================\n\n';

  out += '1. SECTOR INFRASTRUCTURE DETAILS:\n';
  out += `   - Location Name: ${sector.name}\n`;
  out += `   - Geographic Area: ${sector.area}\n`;
  out += `   - Assigned Lineman Team: ${sector.linemanTeam}\n`;
  out += `   - Optical Cable Type: ${sector.cableType}\n`;
  out += `   - Pole Span Length: ${sector.spanLengthMeters} meters (${sector.polesCount} poles)\n`;
  out += `   - Base Pole Clearance: ${sector.baseGroundClearance} meters\n`;
  out += `   - Mandatory Road Clearance: ${sector.minRoadClearanceRequired} meters\n\n`;

  out += '2. LIVE FIELD WEATHER & CATENARY TELEMETRY:\n';
  out += `   - Ambient Temperature: ${evaluation.temperatureC}°C\n`;
  out += `   - Wind Velocity: ${evaluation.windSpeedKmh} km/h\n`;
  out += `   - Mid-Span Catenary Sag: ${evaluation.effectiveSagM} meters (Critical Limit: ${sector.criticalSagThreshold}m)\n`;
  out += `   - Net Road Clearance: ${evaluation.netClearanceM} meters\n`;
  out += `   - Clearance Headroom Margin: ${evaluation.clearanceMarginM} meters\n`;
  out += `   - Pole Dead-End Anchor Tension: ${evaluation.tensionN} Newtons\n`;
  out += `   - Hazard Status: [ ${evaluation.status} ] - ${evaluation.statusLabel}\n\n`;

  out += '3. REQUIRED LINEMAN FIELD ACTIONS:\n';
  if (evaluation.status === 'CRITICAL') {
    out += '   [URGENT SNAG HAZARD DETECTED]\n';
    out += '   - Immediate field dispatch required: Deploy boom truck or extension ladder.\n';
    out += '   - Tighten turnbuckle / dead-end anchor clamp to restore sag < ' + sector.normalSag + 'm.\n';
    out += '   - Verify vehicle clearance exceeds ' + sector.minRoadClearanceRequired + 'm over highway roadway.\n';
  } else if (evaluation.status === 'ELEVATED') {
    out += '   [THERMAL EXPANSION ADVISORY]\n';
    out += '   - Monitor span during peak afternoon heat (13:00 - 16:00 PKT).\n';
    out += '   - Inspect pole suspension brackets for slippage or loose J-hooks.\n';
  } else {
    out += '   [CLEARANCE WITHIN SAFETY MARGINS]\n';
    out += '   - Routine quarterly inspection completed.\n';
  }

  out += '\nLineman Signature: _______________________   Lead Supervisor: _______________________\n';
  return out;
}

/**
 * Initializes and wires the mobile aerial alerts modal controller.
 */
export function setupAerialAlertsModal(options = {}) {
  const {
    getState = () => ({}),
    storage = typeof localStorage !== 'undefined' ? localStorage : null,
    onFilterArea,
    onToast
  } = options;

  if (typeof document === 'undefined') return { refresh: () => {} };

  const modal = document.getElementById('aerialAlertsModal');
  const closeBtn = document.getElementById('aerialAlertsModalClose');
  const sectorSelect = document.getElementById('aerialSectorSelect');
  const weatherPresetStandard = document.getElementById('aerialPresetStandard');
  const weatherPresetHeat = document.getElementById('aerialPresetHeat');
  const weatherPresetStorm = document.getElementById('aerialPresetStorm');
  const tempSlider = document.getElementById('aerialTempSlider');
  const tempVal = document.getElementById('aerialTempVal');
  const windSlider = document.getElementById('aerialWindSlider');
  const windVal = document.getElementById('aerialWindVal');

  const kpiStatusBadge = document.getElementById('aerialKpiStatusBadge');
  const kpiNetClearance = document.getElementById('aerialKpiNetClearance');
  const kpiCatenarySag = document.getElementById('aerialKpiCatenarySag');
  const kpiPoleTension = document.getElementById('aerialKpiPoleTension');
  const chartWrap = document.getElementById('aerialCatenaryChartWrap');
  const tableBody = document.getElementById('aerialSectorsTableBody');

  const copyDispatchBtn = document.getElementById('aerialCopyDispatchBtn');
  const resolveBtn = document.getElementById('aerialResolveHazardBtn');
  const filterAreaBtn = document.getElementById('aerialFilterAreaBtn');

  let selectedSectorId = 'aer-gt-01';
  let simTempC = 28;
  let simWindKmh = 15;

  function refreshModal() {
    const sector = SHAHDARA_AERIAL_SECTORS.find((s) => s.id === selectedSectorId) || SHAHDARA_AERIAL_SECTORS[0];
    const evaluation = calculateCatenarySag(sector, { temperatureC: simTempC, windSpeedKmh: simWindKmh });
    const summary = calculateAerialAlertsSummary(getState(), { storage, temperatureC: simTempC, windSpeedKmh: simWindKmh });

    if (tempVal) tempVal.textContent = `${simTempC}°C`;
    if (windVal) windVal.textContent = `${simWindKmh} km/h`;

    if (kpiStatusBadge) {
      kpiStatusBadge.textContent = evaluation.status;
      kpiStatusBadge.className = `sim-delta-badge ${evaluation.badgeClass}`;
    }
    if (kpiNetClearance) {
      kpiNetClearance.textContent = `${evaluation.netClearanceM} m (${evaluation.clearanceMarginM >= 0 ? '+' : ''}${evaluation.clearanceMarginM}m)`;
    }
    if (kpiCatenarySag) {
      kpiCatenarySag.textContent = `${evaluation.effectiveSagM} m (Max: ${sector.criticalSagThreshold}m)`;
    }
    if (kpiPoleTension) {
      kpiPoleTension.textContent = `${evaluation.tensionN} N`;
    }

    if (chartWrap) {
      chartWrap.innerHTML = renderAerialCatenarySvg(evaluation);
    }

    if (tableBody) {
      tableBody.innerHTML = summary.evaluations.map((e) => {
        const isSelected = e.sector.id === selectedSectorId;
        const rowClass = isSelected ? 'table-row-selected' : '';
        const insBadge = e.inspection ? `<span class="signal-tag" style="background:#10b981; color:#fff;">Resolved</span>` : '';
        return `
          <tr class="${rowClass}">
            <td><strong>${e.sector.name}</strong><br><span style="font-size:10px; color:var(--muted, #64748b);">${e.sector.linemanTeam}</span></td>
            <td>${e.sector.area}</td>
            <td><strong>${e.effectiveSagM} m</strong></td>
            <td><strong>${e.netClearanceM} m</strong><br><span style="font-size:10px; color:var(--muted, #64748b);">Min: ${e.sector.minRoadClearanceRequired}m</span></td>
            <td>${e.tensionN} N</td>
            <td><span class="sim-delta-badge ${e.badgeClass}">${e.status}</span> ${insBadge}</td>
          </tr>
        `;
      }).join('');
    }

    // Update navigation badge counts across DOM
    document.querySelectorAll('[data-nav-badge="aerial-alerts"]').forEach((badge) => {
      badge.textContent = summary.activeHazardBadgeCount;
      badge.hidden = summary.activeHazardBadgeCount === 0;
    });
  }

  // Populate sector select
  if (sectorSelect && sectorSelect.options && sectorSelect.options.length === 0) {
    SHAHDARA_AERIAL_SECTORS.forEach((sec) => {
      const opt = document.createElement('option');
      opt.value = sec.id;
      opt.textContent = `${sec.code} - ${sec.name}`;
      if (sec.id === selectedSectorId) opt.selected = true;
      sectorSelect.appendChild(opt);
    });
  }

  // Sector select change
  if (sectorSelect && !sectorSelect.dataset.wired) {
    sectorSelect.dataset.wired = 'true';
    sectorSelect.addEventListener('change', () => {
      selectedSectorId = sectorSelect.value;
      refreshModal();
    });
  }

  // Weather presets
  if (weatherPresetStandard && !weatherPresetStandard.dataset.wired) {
    weatherPresetStandard.dataset.wired = 'true';
    weatherPresetStandard.addEventListener('click', () => {
      simTempC = 25;
      simWindKmh = 15;
      if (tempSlider) tempSlider.value = simTempC;
      if (windSlider) windSlider.value = simWindKmh;
      refreshModal();
    });
  }

  if (weatherPresetHeat && !weatherPresetHeat.dataset.wired) {
    weatherPresetHeat.dataset.wired = 'true';
    weatherPresetHeat.addEventListener('click', () => {
      simTempC = 46; // Lahore extreme summer heat
      simWindKmh = 10;
      if (tempSlider) tempSlider.value = simTempC;
      if (windSlider) windSlider.value = simWindKmh;
      refreshModal();
    });
  }

  if (weatherPresetStorm && !weatherPresetStorm.dataset.wired) {
    weatherPresetStorm.dataset.wired = 'true';
    weatherPresetStorm.addEventListener('click', () => {
      simTempC = 32;
      simWindKmh = 75; // Severe dust storm / Andhi
      if (tempSlider) tempSlider.value = simTempC;
      if (windSlider) windSlider.value = simWindKmh;
      refreshModal();
    });
  }

  // Sliders
  if (tempSlider && !tempSlider.dataset.wired) {
    tempSlider.dataset.wired = 'true';
    tempSlider.addEventListener('input', () => {
      simTempC = Number(tempSlider.value);
      refreshModal();
    });
  }

  if (windSlider && !windSlider.dataset.wired) {
    windSlider.dataset.wired = 'true';
    windSlider.addEventListener('input', () => {
      simWindKmh = Number(windSlider.value);
      refreshModal();
    });
  }

  // Wire open triggers across the page
  const openTriggers = document.querySelectorAll('[data-open-aerial-alerts], [data-mobile-more="aerial-alerts"], [data-sheet-action="aerial-alerts"], [data-speed-action="aerial-alerts"]');
  openTriggers.forEach((trigger) => {
    if (!trigger.dataset.wired) {
      trigger.dataset.wired = 'true';
      trigger.addEventListener('click', () => {
        triggerHaptic('light');
        refreshModal();
        if (typeof modal.showModal === 'function') {
          try { modal.showModal(); } catch { modal.setAttribute('open', ''); }
        } else {
          modal.setAttribute('open', '');
        }
      });
    }
  });

  // Close button
  if (closeBtn && !closeBtn.dataset.wired) {
    closeBtn.dataset.wired = 'true';
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') {
        try { modal.close(); } catch { modal.removeAttribute('open'); }
      } else {
        modal.removeAttribute('open');
      }
    });
  }

  if (modal && !modal.dataset.backdropWired) {
    modal.dataset.backdropWired = 'true';
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (typeof modal.close === 'function') {
          try { modal.close(); } catch { modal.removeAttribute('open'); }
        } else {
          modal.removeAttribute('open');
        }
      }
    });
  }

  // Filter area
  if (filterAreaBtn && !filterAreaBtn.dataset.wired) {
    filterAreaBtn.dataset.wired = 'true';
    filterAreaBtn.addEventListener('click', () => {
      const sec = SHAHDARA_AERIAL_SECTORS.find((s) => s.id === selectedSectorId);
      if (sec && typeof onFilterArea === 'function') {
        onFilterArea(sec.area);
        if (typeof modal.close === 'function') {
          try { modal.close(); } catch { modal.removeAttribute('open'); }
        } else {
          modal.removeAttribute('open');
        }
      }
    });
  }

  // Mark hazard resolved
  if (resolveBtn && !resolveBtn.dataset.wired) {
    resolveBtn.dataset.wired = 'true';
    resolveBtn.addEventListener('click', () => {
      recordAerialInspection(selectedSectorId, {
        inspector: 'Field Crew On Duty',
        actionTaken: 'Cable re-tensioned and turnbuckle tightened'
      }, storage);
      triggerHaptic('medium');
      if (typeof onToast === 'function') onToast(`Sector ${selectedSectorId} marked inspected & secured!`);
      refreshModal();
    });
  }

  // Copy dispatch order
  if (copyDispatchBtn && !copyDispatchBtn.dataset.wired) {
    copyDispatchBtn.dataset.wired = 'true';
    copyDispatchBtn.addEventListener('click', async () => {
      const sec = SHAHDARA_AERIAL_SECTORS.find((s) => s.id === selectedSectorId);
      const evalData = calculateCatenarySag(sec, { temperatureC: simTempC, windSpeedKmh: simWindKmh });
      const text = generateAerialHazardWorkOrder(sec, evalData);
      const clip = typeof navigator !== 'undefined' ? navigator.clipboard : null;
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          triggerHaptic('success');
          if (typeof onToast === 'function') onToast('Aerial hazard work order copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy dispatch order.');
        }
      }
    });
  }

  // Initial calculation to set badges
  refreshModal();

  return {
    refresh: refreshModal,
    open: () => {
      refreshModal();
      if (typeof modal.showModal === 'function') {
        try { modal.showModal(); } catch { modal.setAttribute('open', ''); }
      } else {
        modal.setAttribute('open', '');
      }
    }
  };
}
