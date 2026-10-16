import { formatPKR } from './core.js';

/**
 * Aerial Fiber Pole Wind Tension & Sag Load Mechanical Failure Risk Estimator
 * Models catenary sag, transverse wind pressure, ambient thermal contraction/expansion,
 * cable ultimate tensile strength (UTS) load ratios, minimum ground road clearance,
 * and pole overturning bending moments across Shahdara ISP distribution sectors.
 */

export const SHAHDARA_CABLE_TYPES = [
  {
    id: 'fig8-2c',
    name: 'Figure-8 2-Core Drop (1.0mm FRP Messenger)',
    diameterMm: 5.2,
    weightKgPerKm: 28, // 0.028 kg/m
    utsNewtons: 1250,
    thermalExpansionCoeff: 1.2e-5,
    recommendedPreTensionN: 220
  },
  {
    id: 'fig8-12c',
    name: 'Figure-8 12-Core Aerial (7x0.5mm Steel Messenger)',
    diameterMm: 8.4,
    weightKgPerKm: 68, // 0.068 kg/m
    utsNewtons: 3400,
    thermalExpansionCoeff: 1.1e-5,
    recommendedPreTensionN: 650
  },
  {
    id: 'adss-24c',
    name: 'ADSS 24-Core Heavy Trunk (All-Dielectric)',
    diameterMm: 10.8,
    weightKgPerKm: 92, // 0.092 kg/m
    utsNewtons: 4800,
    thermalExpansionCoeff: 1.8e-5,
    recommendedPreTensionN: 850
  },
  {
    id: 'adss-48c',
    name: 'ADSS 48-Core Backbone Feeder (Heavy Aramid Yarn)',
    diameterMm: 13.2,
    weightKgPerKm: 135, // 0.135 kg/m
    utsNewtons: 7200,
    thermalExpansionCoeff: 1.9e-5,
    recommendedPreTensionN: 1200
  },
  {
    id: 'armored-48c',
    name: 'Armored Double-Sheath Steel Tape 48-Core',
    diameterMm: 15.0,
    weightKgPerKm: 180, // 0.180 kg/m
    utsNewtons: 9500,
    thermalExpansionCoeff: 1.0e-5,
    recommendedPreTensionN: 1650
  }
];

export const SHAHDARA_AERIAL_SECTORS = [
  {
    id: 'wandala-corridor',
    name: 'Wandala Road Optical Spine',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    spanLengthMeters: 56,
    poleHeightMeters: 8.5,
    attachmentHeightMeters: 7.2,
    minGroundClearanceMeters: 5.5, // High commercial vehicle and freight truck corridor
    poleType: 'Pre-Stressed Concrete (Class 4)',
    ratedPoleBendingMomentNm: 18000,
    defaultCableId: 'adss-24c',
    defaultPreTensionN: 850,
    baselinePolesCount: 38,
    typicalWindExposure: 'Medium urban street corridor'
  },
  {
    id: 'jia-musa-bazaar',
    name: 'Jia Musa Commercial Alley Feeder',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Ghazi Park'],
    spanLengthMeters: 42,
    poleHeightMeters: 7.8,
    attachmentHeightMeters: 6.4,
    minGroundClearanceMeters: 4.8, // Dense rickshaw/mini-truck market lane
    poleType: 'Tubular Steel Utility Pole',
    ratedPoleBendingMomentNm: 13500,
    defaultCableId: 'fig8-12c',
    defaultPreTensionN: 600,
    baselinePolesCount: 26,
    typicalWindExposure: 'Sheltered urban alleyway with high wire clutter'
  },
  {
    id: 'saeed-park-overhead',
    name: 'Saeed Park Open Field Feeder',
    primaryArea: 'Saeed Park',
    aliasAreas: ['Saeed Park', 'Tariq Road'],
    spanLengthMeters: 68,
    poleHeightMeters: 9.2,
    attachmentHeightMeters: 7.8,
    minGroundClearanceMeters: 5.2,
    poleType: 'Spun Concrete Pole with Guy Support',
    ratedPoleBendingMomentNm: 22000,
    defaultCableId: 'adss-48c',
    defaultPreTensionN: 1250,
    baselinePolesCount: 32,
    typicalWindExposure: 'Open agricultural perimeter with severe monsoon gust exposure'
  },
  {
    id: 'chowk-station-crossing',
    name: 'Shahdara Chowk Highway Crossing',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Shahdara Chowk', 'Station'],
    spanLengthMeters: 74,
    poleHeightMeters: 10.8,
    attachmentHeightMeters: 9.2,
    minGroundClearanceMeters: 6.5, // Multi-lane GT Road / rail clearance requirement
    poleType: 'Heavy Lattice Steel Mast',
    ratedPoleBendingMomentNm: 36000,
    defaultCableId: 'armored-48c',
    defaultPreTensionN: 1750,
    baselinePolesCount: 18,
    typicalWindExposure: 'Unobstructed highway wind funnel'
  },
  {
    id: 'baradari-riverfront',
    name: 'Baradari Riverfront Aerial Route',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Ravi Riverfront'],
    spanLengthMeters: 62,
    poleHeightMeters: 8.5,
    attachmentHeightMeters: 7.0,
    minGroundClearanceMeters: 5.0,
    poleType: 'Tubular Steel Pole with Double Strut',
    ratedPoleBendingMomentNm: 16000,
    defaultCableId: 'fig8-12c',
    defaultPreTensionN: 700,
    baselinePolesCount: 24,
    typicalWindExposure: 'Ravi flood basin wind corridor with high humidity'
  }
];

let selectedSectorId = 'wandala-corridor';
let simulatedWindSpeedKmh = 35; // Default moderate breeze (35 km/h)
let simulatedTemperatureC = 25; // Standard 25°C baseline
let simulatedCableTypeId = null; // null = use sector default

export function getAerialSelectedSector() {
  return selectedSectorId;
}

export function setAerialSelectedSector(sectorId) {
  if (SHAHDARA_AERIAL_SECTORS.some(s => s.id === sectorId)) {
    selectedSectorId = sectorId;
  }
}

export function getAerialWindSpeed() {
  return simulatedWindSpeedKmh;
}

export function setAerialWindSpeed(kmh) {
  const num = Number(kmh);
  if (!isNaN(num)) {
    simulatedWindSpeedKmh = Math.max(0, Math.min(130, Math.round(num)));
  }
}

export function getAerialTemperature() {
  return simulatedTemperatureC;
}

export function setAerialTemperature(degC) {
  const num = Number(degC);
  if (!isNaN(num)) {
    simulatedTemperatureC = Math.max(-10, Math.min(55, Math.round(num)));
  }
}

export function getAerialCableType() {
  return simulatedCableTypeId;
}

export function setAerialCableType(cableId) {
  if (cableId === null || cableId === '' || cableId === 'default') {
    simulatedCableTypeId = null;
  } else if (SHAHDARA_CABLE_TYPES.some(c => c.id === cableId)) {
    simulatedCableTypeId = cableId;
  }
}

function escapeXml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

/**
 * Calculates mechanical tension, catenary sag, wind drag load, thermal contraction/expansion,
 * clearance margin, and pole bending moments for Shahdara aerial fiber spans.
 */
export function calculateAerialTensionMetrics(state, options = {}) {
  const activeSectorId = options.sectorId || selectedSectorId;
  const sector = SHAHDARA_AERIAL_SECTORS.find(s => s.id === activeSectorId) || SHAHDARA_AERIAL_SECTORS[0];

  const windSpeedKmh = options.windSpeed !== undefined ? Number(options.windSpeed) : simulatedWindSpeedKmh;
  const tempC = options.temperature !== undefined ? Number(options.temperature) : simulatedTemperatureC;
  const cableId = options.cableId || simulatedCableTypeId || sector.defaultCableId;
  const cable = SHAHDARA_CABLE_TYPES.find(c => c.id === cableId) || SHAHDARA_CABLE_TYPES[1];

  // 1. Environmental aerodynamics & physics constants
  const airDensity = 1.225; // kg/m^3 standard air density
  const cylinderDragCoeff = 1.20; // Aerodynamic drag coefficient for circular cylinder cable
  const windVelocityMs = Math.max(0, windSpeedKmh) / 3.6; // convert km/h to m/s
  const dynamicWindPressurePa = 0.5 * airDensity * (windVelocityMs * windVelocityMs); // q = 0.5 * rho * v^2

  // 2. Linear loads per meter of span (N/m)
  const cableDiameterM = cable.diameterMm / 1000;
  const cableLinearMassKgM = cable.weightKgPerKm / 1000;
  const verticalGravityLoadNm = cableLinearMassKgM * 9.80665; // w_vertical = m * g (N/m)

  // Transverse horizontal wind load per meter: F_wind = q * d * C_d
  const horizontalWindLoadNm = dynamicWindPressurePa * cableDiameterM * cylinderDragCoeff;

  // Total resultant vector load per meter: w_total = sqrt(w_vert^2 + w_wind^2)
  const totalResultantLoadNm = Math.sqrt((verticalGravityLoadNm * verticalGravityLoadNm) + (horizontalWindLoadNm * horizontalWindLoadNm));

  // 3. Thermal contraction/expansion effect on tension
  // Baseline installation reference is 25°C
  const deltaTemp = tempC - 25;
  // Cold temperatures (<25°C) contract fiber and messenger, sharply increasing horizontal tension.
  // Hot temperatures (>25°C) expand cable, slightly reducing pre-tension but drastically increasing sag.
  // We model effective elastic modulus / thermal tension coefficient:
  const thermalTensionMultiplier = 1 - (deltaTemp * cable.thermalExpansionCoeff * 520);
  const baseTension = sector.defaultPreTensionN || cable.recommendedPreTensionN;
  const effectiveHorizontalTensionN = Math.max(120, baseTension * Math.max(0.45, Math.min(2.1, thermalTensionMultiplier)));

  // 4. Parabolic catenary sag calculation: S = (w * L^2) / (8 * H)
  const spanL = sector.spanLengthMeters;
  const resultantMidspanSagM = (totalResultantLoadNm * spanL * spanL) / (8 * effectiveHorizontalTensionN);
  // Vertical sag component (downward deflection towards ground)
  const verticalSagM = totalResultantLoadNm > 0
    ? (resultantMidspanSagM * (verticalGravityLoadNm / totalResultantLoadNm))
    : resultantMidspanSagM;
  // Transverse horizontal sag component (wind blow-out deflection)
  const horizontalSagM = totalResultantLoadNm > 0
    ? (resultantMidspanSagM * (horizontalWindLoadNm / totalResultantLoadNm))
    : 0;

  // 5. Ground Clearance Margin
  const midspanGroundClearanceM = Math.max(0, sector.attachmentHeightMeters - verticalSagM);
  const clearanceMarginM = midspanGroundClearanceM - sector.minGroundClearanceMeters;
  const clearanceViolation = clearanceMarginM < 0;

  // 6. Mechanical Tension Load Ratio vs Cable Ultimate Tensile Strength (UTS)
  // Tension at support clamp: T_support = sqrt(H^2 + (w * L / 2)^2)
  const halfSpanWeight = totalResultantLoadNm * spanL / 2;
  const totalSupportTensionN = Math.sqrt((effectiveHorizontalTensionN * effectiveHorizontalTensionN) + (halfSpanWeight * halfSpanWeight));
  const tensionUtsRatioPercent = Math.round((totalSupportTensionN / cable.utsNewtons) * 100);

  // 7. Pole Bending Moment & Overturning Stress
  // Transverse wind force transferred from span half-length to each pole:
  const windForceOnPoleN = horizontalWindLoadNm * spanL / 2;
  // Imbalance / dead-end angle tensile force component (typically 12% in urban Shahdara street bends)
  const angleTensionPullN = totalSupportTensionN * 0.12;
  const totalTransversePoleForceN = windForceOnPoleN + angleTensionPullN;
  // Bending moment at ground line: M = F * attachmentHeight
  const poleBaseBendingMomentNm = totalTransversePoleForceN * sector.attachmentHeightMeters;
  const poleStressRatioPercent = Math.min(100, Math.round((poleBaseBendingMomentNm / sector.ratedPoleBendingMomentNm) * 100));

  // 8. Mechanical Safety Status Assessment
  let statusTier = 'optimal';
  let statusLabel = 'SAFE (OPTIMAL CLEARANCE)';
  let statusBadgeClass = 'badge-success';
  let primaryRiskFactor = 'Span parameters are within safe operational limits.';

  if (tensionUtsRatioPercent >= 75 || poleStressRatioPercent >= 85) {
    statusTier = 'critical';
    statusLabel = 'CRITICAL TENSION SNAP HAZARD';
    statusBadgeClass = 'badge-danger';
    primaryRiskFactor = tensionUtsRatioPercent >= 75
      ? `Mechanical tension (${Math.round(totalSupportTensionN)} N) exceeds 75% of cable UTS rating (${cable.utsNewtons} N). Imminent tensile failure risk under high wind.`
      : `Pole overturning moment (${Math.round(poleBaseBendingMomentNm)} N·m) exceeds 85% of rated pole bending strength (${sector.ratedPoleBendingMomentNm} N·m).`;
  } else if (clearanceViolation) {
    statusTier = 'warning';
    statusLabel = 'CLEARANCE SAG VIOLATION';
    statusBadgeClass = 'badge-warning';
    primaryRiskFactor = `Mid-span clearance (${midspanGroundClearanceM.toFixed(2)}m) has dipped below municipal road threshold (${sector.minGroundClearanceMeters.toFixed(1)}m) by ${Math.abs(clearanceMarginM).toFixed(2)}m. Severe vehicle snag risk.`;
  } else if (tensionUtsRatioPercent >= 50 || poleStressRatioPercent >= 60 || clearanceMarginM < 0.4) {
    statusTier = 'elevated';
    statusLabel = 'ELEVATED SAG & WIND STRESS';
    statusBadgeClass = 'badge-warning';
    primaryRiskFactor = `Operating near buffer boundary: ${tensionUtsRatioPercent}% UTS tension load with ${clearanceMarginM.toFixed(2)}m clearance headroom under ${windSpeedKmh} km/h wind gusts.`;
  }

  // 9. Ledger Subscriber & Revenue Correlation
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const sectorAreasSet = new Set(sector.aliasAreas.map(a => a.toLowerCase().trim()));

  let totalAreaCustomers = 0;
  let activeSubscribers = 0;
  let offlineSubscribers = 0;
  let totalMonthlyBilledPkr = 0;

  for (const c of customers) {
    if (c.archived) continue;
    const cArea = String(c.area ?? '').toLowerCase().trim();
    if (sectorAreasSet.has(cArea)) {
      totalAreaCustomers++;
      if (c.serviceStatus === 'offline') {
        offlineSubscribers++;
      } else {
        activeSubscribers++;
      }
      const monthlyRate = Number(c.monthlyRate ?? c.packageRate ?? 0) || 0;
      totalMonthlyBilledPkr += monthlyRate;
    }
  }

  // Estimated feeder drop cables and subscribers traversing this primary pole route:
  const estimatedDropsCarried = Math.max(1, Math.round(activeSubscribers * 0.85));
  const monthlyRevenueAtRiskPkr = statusTier === 'critical' || statusTier === 'warning'
    ? totalMonthlyBilledPkr
    : Math.round(totalMonthlyBilledPkr * 0.35);

  // 10. Multi-sector fleet register statistics
  const fleetSummary = SHAHDARA_AERIAL_SECTORS.map(sec => {
    const secCableId = sec.id === sector.id ? cable.id : sec.defaultCableId;
    const secCable = SHAHDARA_CABLE_TYPES.find(c => c.id === secCableId) || SHAHDARA_CABLE_TYPES[1];

    const dM = secCable.diameterMm / 1000;
    const wVert = (secCable.weightKgPerKm / 1000) * 9.80665;
    const wWind = dynamicWindPressurePa * dM * cylinderDragCoeff;
    const wTot = Math.sqrt((wVert * wVert) + (wWind * wWind));

    const tMult = 1 - (deltaTemp * secCable.thermalExpansionCoeff * 520);
    const hTens = Math.max(120, (sec.defaultPreTensionN || secCable.recommendedPreTensionN) * Math.max(0.45, Math.min(2.1, tMult)));

    const sag = (wTot * sec.spanLengthMeters * sec.spanLengthMeters) / (8 * hTens);
    const vertSag = wTot > 0 ? (sag * (wVert / wTot)) : sag;
    const clearM = Math.max(0, sec.attachmentHeightMeters - vertSag);
    const clearViol = clearM < sec.minGroundClearanceMeters;

    const suppTens = Math.sqrt((hTens * hTens) + Math.pow(wTot * sec.spanLengthMeters / 2, 2));
    const utsRatio = Math.round((suppTens / secCable.utsNewtons) * 100);

    let secTier = 'optimal';
    if (utsRatio >= 75) secTier = 'critical';
    else if (clearViol) secTier = 'warning';
    else if (utsRatio >= 50 || (clearM - sec.minGroundClearanceMeters) < 0.4) secTier = 'elevated';

    return {
      sectorId: sec.id,
      name: sec.name,
      primaryArea: sec.primaryArea,
      spanLengthM: sec.spanLengthMeters,
      cableName: secCable.name,
      verticalSagM: Number(vertSag.toFixed(2)),
      groundClearanceM: Number(clearM.toFixed(2)),
      minClearanceM: sec.minGroundClearanceMeters,
      tensionN: Math.round(suppTens),
      utsRatioPercent: utsRatio,
      clearanceViolation: clearViol,
      statusTier: secTier
    };
  });

  return {
    sector,
    cable,
    inputs: {
      windSpeedKmh,
      windVelocityMs: Number(windVelocityMs.toFixed(1)),
      temperatureC: tempC,
      dynamicWindPressurePa: Number(dynamicWindPressurePa.toFixed(1)),
      deltaTempC: deltaTemp
    },
    mechanical: {
      verticalGravityLoadNm: Number(verticalGravityLoadNm.toFixed(3)),
      horizontalWindLoadNm: Number(horizontalWindLoadNm.toFixed(3)),
      totalResultantLoadNm: Number(totalResultantLoadNm.toFixed(3)),
      effectiveHorizontalTensionN: Math.round(effectiveHorizontalTensionN),
      totalSupportTensionN: Math.round(totalSupportTensionN),
      resultantMidspanSagM: Number(resultantMidspanSagM.toFixed(2)),
      verticalSagM: Number(verticalSagM.toFixed(2)),
      horizontalSagM: Number(horizontalSagM.toFixed(2)),
      midspanGroundClearanceM: Number(midspanGroundClearanceM.toFixed(2)),
      clearanceMarginM: Number(clearanceMarginM.toFixed(2)),
      clearanceViolation,
      tensionUtsRatioPercent,
      poleBaseBendingMomentNm: Math.round(poleBaseBendingMomentNm),
      poleStressRatioPercent
    },
    risk: {
      statusTier,
      statusLabel,
      statusBadgeClass,
      primaryRiskFactor
    },
    ledger: {
      totalAreaCustomers,
      activeSubscribers,
      offlineSubscribers,
      totalMonthlyBilledPkr,
      estimatedDropsCarried,
      monthlyRevenueAtRiskPkr
    },
    fleetSummary
  };
}

/**
 * Pure client-side SVG visualization of utility poles, aerial fiber span catenary sag curve,
 * minimum clearance threshold line, tension load vectors, and wind gust particle indicators.
 */
export function renderAerialTensionSvg(data) {
  if (!data || !data.sector || !data.mechanical) {
    return `<div class="chart-empty-state"><p>No aerial mechanical data available.</p></div>`;
  }

  const { sector, cable, inputs, mechanical, risk } = data;
  const width = 680;
  const height = 310;

  // Visual layout bounds
  const groundY = 250;
  const poleLeftX = 110;
  const poleRightX = 570;
  const spanPixelWidth = poleRightX - poleLeftX; // 460px represents sector.spanLengthMeters
  const midX = (poleLeftX + poleRightX) / 2;

  // Vertical scaling: 10 meters maps to 190 pixels (19px/m)
  const pxPerMeter = 19.5;
  const attachY = groundY - (sector.attachmentHeightMeters * pxPerMeter);
  const poleTopY = groundY - (sector.poleHeightMeters * pxPerMeter);
  const minClearanceY = groundY - (sector.minGroundClearanceMeters * pxPerMeter);
  const midSagY = attachY + (mechanical.verticalSagM * pxPerMeter);
  const actualClearancePx = groundY - midSagY;

  // Colors based on risk tier
  let cableColor = '#0284c7'; // normal blue
  let badgeColor = '#059669';
  if (risk.statusTier === 'critical') {
    cableColor = '#dc2626';
    badgeColor = '#dc2626';
  } else if (risk.statusTier === 'warning') {
    cableColor = '#ea580c';
    badgeColor = '#ea580c';
  } else if (risk.statusTier === 'elevated') {
    cableColor = '#d97706';
    badgeColor = '#d97706';
  }

  // Parabolic catenary path generation (21 interpolated points)
  let catenaryPoints = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 to 1
    const x = poleLeftX + (t * spanPixelWidth);
    // Parabolic profile: 4 * sag * t * (1 - t)
    const sagOffset = 4 * (midSagY - attachY) * t * (1 - t);
    const y = attachY + sagOffset;
    catenaryPoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const cablePathD = `M ${catenaryPoints.join(' L ')}`;

  // Wind blow-out displacement indicator
  const windArrowsCount = Math.min(6, Math.max(1, Math.round(inputs.windSpeedKmh / 20)));
  let windMarkersSvg = '';
  for (let i = 0; i < windArrowsCount; i++) {
    const wx = 180 + (i * 65);
    const wy = 75 + (i % 2 === 0 ? 0 : 18);
    windMarkersSvg += `
      <g opacity="0.85">
        <path d="M ${wx} ${wy} L ${wx + 30} ${wy}" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" />
        <path d="M ${wx + 24} ${wy - 4} L ${wx + 30} ${wy} L ${wx + 24} ${wy + 4}" stroke="#38bdf8" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    `;
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" class="aerial-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Aerial Fiber Pole Wind Tension and Sag Diagram">
      <defs>
        <linearGradient id="aerialSkyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--chart-bg, #0f172a)" stop-opacity="0.95" />
          <stop offset="100%" stop-color="var(--chart-bg-subtle, #1e293b)" stop-opacity="0.8" />
        </linearGradient>
        <linearGradient id="poleGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#475569" />
          <stop offset="50%" stop-color="#94a3b8" />
          <stop offset="100%" stop-color="#334155" />
        </linearGradient>
        <pattern id="groundHash" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="#334155" stroke-width="1.5" opacity="0.4" />
        </pattern>
      </defs>

      <!-- Background -->
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#aerialSkyGrad)" rx="8" />

      <!-- Wind flow streams in sky -->
      <g class="wind-streams">
        ${windMarkersSvg}
        <text x="180" y="60" fill="#38bdf8" font-size="11" font-weight="700">WIND: ${inputs.windSpeedKmh} km/h (${inputs.dynamicWindPressurePa} Pa pressure)</text>
      </g>

      <!-- Ground Terrain Line -->
      <rect x="20" y="${groundY}" width="${width - 40}" height="${height - groundY - 10}" fill="#1e293b" rx="2" />
      <rect x="20" y="${groundY}" width="${width - 40}" height="${height - groundY - 10}" fill="url(#groundHash)" rx="2" />
      <line x1="20" y1="${groundY}" x2="${width - 20}" y2="${groundY}" stroke="#64748b" stroke-width="2.5" />
      <text x="32" y="${groundY + 22}" fill="#94a3b8" font-size="11" font-weight="600">Shahdara Road Level (Elevation 0.0m)</text>

      <!-- Municipal Minimum Road Clearance Guideline -->
      <line x1="${poleLeftX - 30}" y1="${minClearanceY}" x2="${poleRightX + 30}" y2="${minClearanceY}" stroke="#f97316" stroke-width="1.8" stroke-dasharray="6,4" opacity="0.85" />
      <rect x="${poleRightX - 165}" y="${minClearanceY - 18}" width="190" height="16" fill="#1e293b" opacity="0.9" rx="3" />
      <text x="${poleRightX - 160}" y="${minClearanceY - 6}" fill="#fb923c" font-size="10.5" font-weight="700">Req. Clearance: ${sector.minGroundClearanceMeters.toFixed(1)}m</text>

      <!-- Left Utility Pole -->
      <g class="pole-left">
        <!-- Guy wire anchor -->
        <line x1="${poleLeftX}" y1="${attachY + 10}" x2="${poleLeftX - 65}" y2="${groundY}" stroke="#64748b" stroke-width="1.8" stroke-dasharray="3,2" />
        <!-- Pole column -->
        <rect x="${poleLeftX - 6}" y="${poleTopY}" width="12" height="${groundY - poleTopY}" fill="url(#poleGrad)" rx="2" stroke="#1e293b" stroke-width="1" />
        <!-- Crossarm / bracket -->
        <rect x="${poleLeftX - 18}" y="${attachY - 4}" width="36" height="8" fill="#334155" rx="1" />
        <!-- Suspension clamp circle -->
        <circle cx="${poleLeftX}" cy="${attachY}" r="4" fill="#f8fafc" stroke="#0284c7" stroke-width="1.5" />
        <!-- Pole label -->
        <text x="${poleLeftX}" y="${groundY + 36}" fill="#cbd5e1" font-size="10" font-weight="600" text-anchor="middle">Pole A (8.5m)</text>
      </g>

      <!-- Right Utility Pole -->
      <g class="pole-right">
        <!-- Guy wire anchor -->
        <line x1="${poleRightX}" y1="${attachY + 10}" x2="${poleRightX + 65}" y2="${groundY}" stroke="#64748b" stroke-width="1.8" stroke-dasharray="3,2" />
        <!-- Pole column -->
        <rect x="${poleRightX - 6}" y="${poleTopY}" width="12" height="${groundY - poleTopY}" fill="url(#poleGrad)" rx="2" stroke="#1e293b" stroke-width="1" />
        <!-- Crossarm / bracket -->
        <rect x="${poleRightX - 18}" y="${attachY - 4}" width="36" height="8" fill="#334155" rx="1" />
        <!-- Suspension clamp circle -->
        <circle cx="${poleRightX}" cy="${attachY}" r="4" fill="#f8fafc" stroke="#0284c7" stroke-width="1.5" />
        <!-- Pole label -->
        <text x="${poleRightX}" y="${groundY + 36}" fill="#cbd5e1" font-size="10" font-weight="600" text-anchor="middle">Pole B (${sector.spanLengthMeters}m Span)</text>
      </g>

      <!-- Aerial Fiber Cable Catenary Sag Curve -->
      <path d="${cablePathD}" fill="none" stroke="${cableColor}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="${cablePathD}" fill="none" stroke="#ffffff" stroke-width="1" stroke-linecap="round" stroke-dasharray="3,5" opacity="0.6" />

      <!-- Mid-span Sag Dimension Lines & Annotation -->
      <g class="midspan-dimension">
        <!-- Attachment level datum line across span -->
        <line x1="${poleLeftX}" y1="${attachY}" x2="${poleRightX}" y2="${attachY}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3,3" opacity="0.6" />

        <!-- Sag vertical dimension arrow -->
        <line x1="${midX}" y1="${attachY}" x2="${midX}" y2="${midSagY}" stroke="#e2e8f0" stroke-width="1.8" />
        <polygon points="${midX - 3},${attachY + 5} ${midX + 3},${attachY + 5} ${midX},${attachY}" fill="#e2e8f0" />
        <polygon points="${midX - 3},${midSagY - 5} ${midX + 3},${midSagY - 5} ${midX},${midSagY}" fill="#e2e8f0" />

        <!-- Sag tag pill -->
        <rect x="${midX + 8}" y="${(attachY + midSagY) / 2 - 10}" width="98" height="20" fill="#0f172a" rx="4" stroke="#475569" stroke-width="1" />
        <text x="${midX + 13}" y="${(attachY + midSagY) / 2 + 4}" fill="#f1f5f9" font-size="10.5" font-weight="700">Sag: ${mechanical.verticalSagM.toFixed(2)}m</text>

        <!-- Clearance dimension line down to road -->
        <line x1="${midX - 35}" y1="${midSagY}" x2="${midX - 35}" y2="${groundY}" stroke="${mechanical.clearanceViolation ? '#ef4444' : '#22c55e'}" stroke-width="2" />
        <polygon points="${midX - 38},${midSagY + 5} ${midX - 32},${midSagY + 5} ${midX - 35},${midSagY}" fill="${mechanical.clearanceViolation ? '#ef4444' : '#22c55e'}" />
        <polygon points="${midX - 38},${groundY - 5} ${midX - 32},${groundY - 5} ${midX - 35},${groundY}" fill="${mechanical.clearanceViolation ? '#ef4444' : '#22c55e'}" />

        <rect x="${midX - 165}" y="${midSagY + (actualClearancePx / 2) - 10}" width="125" height="20" fill="#0f172a" rx="4" stroke="${mechanical.clearanceViolation ? '#ef4444' : '#22c55e'}" stroke-width="1" />
        <text x="${midX - 158}" y="${midSagY + (actualClearancePx / 2) + 4}" fill="${mechanical.clearanceViolation ? '#ef4444' : '#4ade80'}" font-size="10.5" font-weight="700">Clearance: ${mechanical.midspanGroundClearanceM.toFixed(2)}m</text>
      </g>

      <!-- Status & Tension Callout Overlay Pill (Top Left) -->
      <g class="header-callouts" transform="translate(16, 16)">
        <rect x="0" y="0" width="220" height="42" fill="#0f172a" opacity="0.92" rx="6" stroke="#334155" stroke-width="1" />
        <text x="10" y="17" fill="#94a3b8" font-size="9.5" font-weight="700" letter-spacing="0.5">SECTOR MECHANICAL HEALTH</text>
        <circle cx="16" cy="30" r="5" fill="${badgeColor}" />
        <text x="26" y="34" fill="#ffffff" font-size="11" font-weight="700">${escapeXml(risk.statusLabel)}</text>
      </g>

      <!-- Mechanical Tension Pill (Top Right) -->
      <g class="tension-callouts" transform="translate(${width - 200}, 16)">
        <rect x="0" y="0" width="184" height="42" fill="#0f172a" opacity="0.92" rx="6" stroke="#334155" stroke-width="1" />
        <text x="10" y="17" fill="#94a3b8" font-size="9.5" font-weight="700" letter-spacing="0.5">CLAMP TENSION LOAD</text>
        <text x="10" y="34" fill="#f8fafc" font-size="12" font-weight="700">${mechanical.totalSupportTensionN} N <tspan font-size="10.5" font-weight="600" fill="${mechanical.tensionUtsRatioPercent >= 75 ? '#ef4444' : '#94a3b8'}">(${mechanical.tensionUtsRatioPercent}% UTS)</tspan></text>
      </g>
    </svg>
  `;
}

/**
 * Generates an executive OSP field dispatch markdown report for aerial fiber maintenance crews.
 */
export function generateAerialTensionReport(data, referenceDate = new Date()) {
  if (!data) return 'No aerial tension data available.';

  const { sector, cable, inputs, mechanical, risk, ledger, fleetSummary } = data;
  const dateStr = referenceDate instanceof Date ? referenceDate.toISOString().slice(0, 19).replace('T', ' ') : String(referenceDate);

  let out = `# SHAHDARA ISP OSP ENGINEERING BRIEFING: AERIAL POLE TENSION & SAG LOAD AUDIT\n`;
  out += `Generated: ${dateStr} PKT | OSP Engineering Outside-Plant Division\n\n`;

  out += `## 1. PRIMARY MONITORED SECTOR: ${sector.name.toUpperCase()}\n`;
  out += `- Primary Service Area: ${sector.primaryArea} (${sector.aliasAreas.join(', ')})\n`;
  out += `- Span Distance: ${sector.spanLengthMeters} meters | Attachment Height: ${sector.attachmentHeightMeters}m (Pole: ${sector.poleHeightMeters}m)\n`;
  out += `- Pole Construction: ${sector.poleType} (Rated Moment: ${sector.ratedPoleBendingMomentNm.toLocaleString()} N·m)\n`;
  out += `- Installed Fiber Cable: ${cable.name} (Dia: ${cable.diameterMm}mm, Mass: ${cable.weightKgPerKm} kg/km, UTS: ${cable.utsNewtons} N)\n`;
  out += `- Environmental Conditions: Ambient Temp ${inputs.temperatureC}°C (ΔT ${inputs.deltaTempC > 0 ? '+' : ''}${inputs.deltaTempC}°C), Wind Gusts ${inputs.windSpeedKmh} km/h (${inputs.dynamicWindPressurePa} Pa dynamic pressure)\n\n`;

  out += `## 2. MECHANICAL STRESS & CATENARY METRICS\n`;
  out += `- Calculated Mid-Span Sag: ${mechanical.verticalSagM.toFixed(2)} meters downward (${mechanical.horizontalSagM.toFixed(2)}m transverse blow-out)\n`;
  out += `- Mid-Span Ground Road Clearance: ${mechanical.midspanGroundClearanceM.toFixed(2)} meters (Municipal Threshold: ${sector.minGroundClearanceMeters.toFixed(1)}m)\n`;
  out += `- Clearance Margin: ${mechanical.clearanceMarginM >= 0 ? '+' : ''}${mechanical.clearanceMarginM.toFixed(2)} meters (${mechanical.clearanceViolation ? 'CRITICAL VIOLATION - SAG HAZARD' : 'Compliant'})\n`;
  out += `- Support Clamp Mechanical Tension: ${mechanical.totalSupportTensionN.toLocaleString()} Newtons (${mechanical.tensionUtsRatioPercent}% of Rated UTS ${cable.utsNewtons} N)\n`;
  out += `- Pole Base Bending Moment: ${mechanical.poleBaseBendingMomentNm.toLocaleString()} N·m (${mechanical.poleStressRatioPercent}% of Rated ${sector.ratedPoleBendingMomentNm.toLocaleString()} N·m)\n`;
  out += `- Operational Assessment: ${risk.statusLabel}\n`;
  out += `- Risk Notes: ${risk.primaryRiskFactor}\n\n`;

  out += `## 3. SUBSCRIBER & REVENUE IMPACT\n`;
  out += `- Total Customers in Sector: ${ledger.totalAreaCustomers} (${ledger.activeSubscribers} Active, ${ledger.offlineSubscribers} Offline)\n`;
  out += `- Estimated Overhead Drop Cables Supported: ${ledger.estimatedDropsCarried} drops\n`;
  out += `- Sector Recurring Monthly Revenue: ${formatPKR(ledger.totalMonthlyBilledPkr)}\n`;
  out += `- Monthly Revenue at Immediate Risk: ${formatPKR(ledger.monthlyRevenueAtRiskPkr)}\n\n`;

  out += `## 4. SHAHDARA SECTORS MECHANICAL AUDIT REGISTER\n`;
  out += `| Sector Corridor | Span (m) | Cable Spec | Mid Sag (m) | Clearance | Tension (N) | UTS % | Status |\n`;
  out += `|---|---|---|---|---|---|---|---|\n`;
  for (const s of fleetSummary) {
    const stat = s.statusTier === 'critical' ? '🔴 CRITICAL' : s.statusTier === 'warning' ? '🟠 VIOLATION' : s.statusTier === 'elevated' ? '🟡 ELEVATED' : '🟢 SAFE';
    out += `| ${s.name} | ${s.spanLengthM}m | ${s.cableName} | ${s.verticalSagM}m | ${s.groundClearanceM}m / ${s.minClearanceM}m | ${s.tensionN} N | ${s.utsRatioPercent}% | ${stat} |\n`;
  }

  out += `\n## 5. RECOMMENDED FIELD REMEDIATION ACTIONS\n`;
  if (mechanical.clearanceViolation) {
    out += `1. [IMMEDIATE PRIORITY] Re-tension turnbuckles and dead-end clamps to lift mid-span sag above ${sector.minGroundClearanceMeters}m road clearance.\n`;
    out += `2. Install an intermediate mid-span auxiliary wooden/steel utility pole to reduce effective span from ${sector.spanLengthMeters}m to ${(sector.spanLengthMeters / 2).toFixed(0)}m.\n`;
  } else if (mechanical.tensionUtsRatioPercent >= 60) {
    out += `1. Tension load is elevated (${mechanical.tensionUtsRatioPercent}% UTS). Relax dead-end clamps slightly by 5-10cm to prevent tensile snap during extreme cold weather contraction.\n`;
    out += `2. Inspect suspension tangent clamps for micro-fractures and sheath abrasions.\n`;
  } else {
    out += `1. All mechanical tension and ground clearance parameters are compliant with Shahdara municipal standards.\n`;
    out += `2. Routine quarterly inspection of messenger wire grounding and guy wire turnbuckles.\n`;
  }

  return out;
}

/**
 * Initializes interactive controls, event listeners, and modal dialog behavior for the
 * Aerial Pole Tension & Sag Load Estimator card and modal.
 */
export function setupAerialTensionModal(state, { referenceDate = new Date(), onFilterArea, onFilterCustomer, onToast, clipboard } = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

  const openBtn = document.getElementById('dashboardOpenAerialModalBtn');
  const modal = document.getElementById('dashboardAerialModal');
  const closeBtn = document.getElementById('dashboardAerialModalCloseBtn');
  const copyBtn = document.getElementById('dashboardCopyAerialReportBtn');
  const filterAreaBtn = document.getElementById('aerialFilterAreaBtn');

  const sectorSelect = document.getElementById('aerialSectorSelect');
  const cableSelect = document.getElementById('aerialCableSelect');
  const windSlider = document.getElementById('aerialWindSlider');
  const windVal = document.getElementById('aerialWindVal');
  const tempSlider = document.getElementById('aerialTempSlider');
  const tempVal = document.getElementById('aerialTempVal');
  const resetBtn = document.getElementById('aerialResetSimBtn');

  function populateAndOpen() {
    if (!modal) return;

    // Populate sector dropdown
    if (sectorSelect && sectorSelect.children.length === 0) {
      sectorSelect.innerHTML = SHAHDARA_AERIAL_SECTORS.map(sec =>
        `<option value="${escapeXml(sec.id)}" ${sec.id === selectedSectorId ? 'selected' : ''}>${escapeXml(sec.name)} (${sec.spanLengthMeters}m span)</option>`
      ).join('');
    } else if (sectorSelect) {
      sectorSelect.value = selectedSectorId;
    }

    // Populate cable dropdown
    if (cableSelect && cableSelect.children.length === 0) {
      cableSelect.innerHTML = `
        <option value="default" ${simulatedCableTypeId === null ? 'selected' : ''}>Sector Default Cable</option>
        ${SHAHDARA_CABLE_TYPES.map(c => `<option value="${escapeXml(c.id)}" ${c.id === simulatedCableTypeId ? 'selected' : ''}>${escapeXml(c.name)}</option>`).join('')}
      `;
    } else if (cableSelect) {
      cableSelect.value = simulatedCableTypeId || 'default';
    }

    if (windSlider) windSlider.value = simulatedWindSpeedKmh;
    if (windVal) windVal.textContent = `${simulatedWindSpeedKmh} km/h`;
    if (tempSlider) tempSlider.value = simulatedTemperatureC;
    if (tempVal) tempVal.textContent = `${simulatedTemperatureC}°C`;

    refreshModalContent();

    if (typeof modal.showModal === 'function') {
      try { modal.showModal(); } catch { modal.setAttribute('open', ''); }
    } else {
      modal.setAttribute('open', '');
    }
  }

  function refreshModalContent() {
    const data = calculateAerialTensionMetrics(state, {
      sectorId: selectedSectorId,
      windSpeed: simulatedWindSpeedKmh,
      temperature: simulatedTemperatureC,
      cableId: simulatedCableTypeId
    });

    // Update KPI summary cards
    const kpiSectorName = document.getElementById('aerialKpiSectorName');
    const kpiSagClearance = document.getElementById('aerialKpiSagClearance');
    const kpiTensionUts = document.getElementById('aerialKpiTensionUts');
    const kpiStatusBadge = document.getElementById('aerialStatusBadge');
    const kpiRevenueRisk = document.getElementById('aerialKpiRevenueRisk');

    if (kpiSectorName) {
      kpiSectorName.textContent = `${data.sector.name} (${data.sector.spanLengthMeters}m)`;
    }
    if (kpiSagClearance) {
      kpiSagClearance.textContent = `Sag ${data.mechanical.verticalSagM.toFixed(2)}m (Clear ${data.mechanical.midspanGroundClearanceM.toFixed(2)}m)`;
    }
    if (kpiTensionUts) {
      kpiTensionUts.textContent = `${data.mechanical.totalSupportTensionN} N (${data.mechanical.tensionUtsRatioPercent}% UTS)`;
    }
    if (kpiStatusBadge) {
      kpiStatusBadge.textContent = data.risk.statusLabel;
      kpiStatusBadge.className = `sim-delta-badge ${data.risk.statusBadgeClass}`;
    }
    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(data.ledger.monthlyRevenueAtRiskPkr)} at risk (${data.ledger.activeSubscribers} subs)`;
    }

    // Render modal diagram SVG
    const modalChartWrap = document.getElementById('aerialModalChartWrap');
    if (modalChartWrap) {
      modalChartWrap.innerHTML = renderAerialTensionSvg(data);
    }

    // Populate fleet table
    const tableBody = document.getElementById('aerialSectorsTableBody');
    if (tableBody) {
      tableBody.innerHTML = data.fleetSummary.map(s => {
        let badgeHtml = '<span class="status-pill status-pill-active">SAFE</span>';
        if (s.statusTier === 'critical') badgeHtml = '<span class="status-pill status-pill-offline" style="background:#dc2626;color:#fff;">CRITICAL</span>';
        else if (s.statusTier === 'warning') badgeHtml = '<span class="status-pill status-pill-pending" style="background:#ea580c;color:#fff;">VIOLATION</span>';
        else if (s.statusTier === 'elevated') badgeHtml = '<span class="status-pill status-pill-pending">ELEVATED</span>';

        const isCurrent = s.sectorId === selectedSectorId;
        return `
          <tr class="${isCurrent ? 'selected-row' : ''}" style="${isCurrent ? 'font-weight:700;' : ''}">
            <td>${escapeXml(s.name)}</td>
            <td>${escapeXml(s.primaryArea)}</td>
            <td>${s.spanLengthM}m</td>
            <td>${s.verticalSagM}m</td>
            <td style="${s.clearanceViolation ? 'color:#ef4444;font-weight:700;' : ''}">${s.groundClearanceM}m <small>(${s.minClearanceM}m req)</small></td>
            <td>${s.tensionN} N</td>
            <td style="${s.utsRatioPercent >= 75 ? 'color:#ef4444;font-weight:700;' : ''}">${s.utsRatioPercent}%</td>
            <td>${badgeHtml}</td>
          </tr>
        `;
      }).join('');
    }

    // Also update dashboard preview card chart if present
    const dashChartEl = document.getElementById('dashboardAerialChart');
    if (dashChartEl) {
      dashChartEl.innerHTML = renderAerialTensionSvg(data);
    }
  }

  if (openBtn && !openBtn.dataset.wired) {
    openBtn.dataset.wired = 'true';
    openBtn.addEventListener('click', populateAndOpen);
  }

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

  if (modal && !modal.dataset.wired) {
    modal.dataset.wired = 'true';
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

  if (sectorSelect && !sectorSelect.dataset.wired) {
    sectorSelect.dataset.wired = 'true';
    sectorSelect.addEventListener('change', () => {
      setAerialSelectedSector(sectorSelect.value);
      refreshModalContent();
    });
  }

  if (cableSelect && !cableSelect.dataset.wired) {
    cableSelect.dataset.wired = 'true';
    cableSelect.addEventListener('change', () => {
      setAerialCableType(cableSelect.value === 'default' ? null : cableSelect.value);
      refreshModalContent();
    });
  }

  if (windSlider && !windSlider.dataset.wired) {
    windSlider.dataset.wired = 'true';
    windSlider.addEventListener('input', () => {
      setAerialWindSpeed(windSlider.value);
      if (windVal) windVal.textContent = `${windSlider.value} km/h`;
      refreshModalContent();
    });
  }

  if (tempSlider && !tempSlider.dataset.wired) {
    tempSlider.dataset.wired = 'true';
    tempSlider.addEventListener('input', () => {
      setAerialTemperature(tempSlider.value);
      if (tempVal) tempVal.textContent = `${tempSlider.value}°C`;
      refreshModalContent();
    });
  }

  if (resetBtn && !resetBtn.dataset.wired) {
    resetBtn.dataset.wired = 'true';
    resetBtn.addEventListener('click', () => {
      setAerialWindSpeed(35);
      setAerialTemperature(25);
      setAerialCableType(null);
      if (windSlider) windSlider.value = 35;
      if (windVal) windVal.textContent = '35 km/h';
      if (tempSlider) tempSlider.value = 25;
      if (tempVal) tempVal.textContent = '25°C';
      if (cableSelect) cableSelect.value = 'default';
      refreshModalContent();
    });
  }

  if (filterAreaBtn && !filterAreaBtn.dataset.wired) {
    filterAreaBtn.dataset.wired = 'true';
    filterAreaBtn.addEventListener('click', () => {
      const data = calculateAerialTensionMetrics(state);
      if (typeof onFilterArea === 'function') {
        onFilterArea(data.sector.primaryArea);
        if (typeof modal.close === 'function') {
          try { modal.close(); } catch { modal.removeAttribute('open'); }
        } else {
          modal.removeAttribute('open');
        }
      }
    });
  }

  if (copyBtn && !copyBtn.dataset.wired) {
    copyBtn.dataset.wired = 'true';
    copyBtn.addEventListener('click', async () => {
      const data = calculateAerialTensionMetrics(state, {
        sectorId: selectedSectorId,
        windSpeed: simulatedWindSpeedKmh,
        temperature: simulatedTemperatureC,
        cableId: simulatedCableTypeId
      });
      const text = generateAerialTensionReport(data, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Aerial pole tension audit copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy audit report.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard API not available.');
      }
    });
  }
}
