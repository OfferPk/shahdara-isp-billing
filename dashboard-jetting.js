import { formatPKR } from './core.js';

/**
 * Underground Duct Hydraulic Pressure & Cable Jetting Blowing Friction Calculator
 * Models pneumatic/hydraulic fiber optic cable blowing and jetting dynamics inside
 * underground HDPE microducts across Shahdara infrastructure crossings (railway tracks,
 * GT Road, Ravi River culverts, and commercial corridors).
 * Calculates duct fill ratio clearance, aerodynamic viscous drag, Euler-Eytelwein capstan
 * bend friction, Euler column helical buckling thresholds, and blowing distance horizons.
 */

export const SHAHDARA_JETTING_ROUTES = [
  {
    id: 'jet-gt-01',
    name: 'GT Road Railway Underpass Subduct Trench',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    routeLengthMeters: 650,
    ductOuterDiaMm: 14,
    ductInnerDiaMm: 10,
    cableOuterDiaMm: 6.2,
    cableWeightKgPerKm: 34, // 0.034 kg/m
    cableStiffnessNm2: 0.85, // Bending stiffness E*I (N·m²)
    maxTensileLoadN: 1000,
    compressorPressureBar: 12, // 12 bar (174 PSI)
    defaultFrictionCoeff: 0.12, // Polymer lubricant
    bendAnglesDegrees: [45, 45, 45, 45], // 4x 45° bends (total 180°)
    installationType: 'Direct Buried Microduct',
    soilEnvironment: 'Railway Trench Ballast'
  },
  {
    id: 'jet-rr-02',
    name: 'Old Ravi River Bridge Culvert Conduit',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    routeLengthMeters: 850,
    ductOuterDiaMm: 16,
    ductInnerDiaMm: 12,
    cableOuterDiaMm: 8.4,
    cableWeightKgPerKm: 62, // 0.062 kg/m
    cableStiffnessNm2: 1.45,
    maxTensileLoadN: 1800,
    compressorPressureBar: 14, // 14 bar (203 PSI)
    defaultFrictionCoeff: 0.10, // Pre-lubricated low-friction liner
    bendAnglesDegrees: [30, 30], // 2x 30° gradual bends
    installationType: 'Bridge Culvert Conduit',
    soilEnvironment: 'River Pier Suspended'
  },
  {
    id: 'jet-mb-03',
    name: 'Main Bazaar Commercial Underground Crossing',
    primaryArea: 'Main Bazaar',
    aliasAreas: ['Main Bazaar', 'Commercial Market'],
    routeLengthMeters: 420,
    ductOuterDiaMm: 10,
    ductInnerDiaMm: 8,
    cableOuterDiaMm: 5.2,
    cableWeightKgPerKm: 26,
    cableStiffnessNm2: 0.45,
    maxTensileLoadN: 800,
    compressorPressureBar: 10,
    defaultFrictionCoeff: 0.28, // High friction / dirt ingress penalty
    bendAnglesDegrees: [60, 60, 60, 60, 45, 45], // 6 sharp municipal sewer bypass bends
    installationType: 'Pavement Microtrench',
    soilEnvironment: 'Urban Compacted Silt'
  },
  {
    id: 'jet-wr-04',
    name: 'Wandala Road Industrial Feeder Trunk Duct',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    routeLengthMeters: 1100, // Long distance run
    ductOuterDiaMm: 16,
    ductInnerDiaMm: 12,
    cableOuterDiaMm: 7.6,
    cableWeightKgPerKm: 52,
    cableStiffnessNm2: 1.20,
    maxTensileLoadN: 1500,
    compressorPressureBar: 15, // 15 bar high pressure
    defaultFrictionCoeff: 0.11,
    bendAnglesDegrees: [30, 30, 30],
    installationType: 'Horizontal Directional Drilling (HDD)',
    soilEnvironment: 'Agricultural Clay Subsoil'
  },
  {
    id: 'jet-sp-05',
    name: 'Saeed Park Highway Cross-Bore HDPE',
    primaryArea: 'Saeed Park',
    aliasAreas: ['Saeed Park', 'Rehman Park'],
    routeLengthMeters: 520,
    ductOuterDiaMm: 12,
    ductInnerDiaMm: 9,
    cableOuterDiaMm: 4.8,
    cableWeightKgPerKm: 24,
    cableStiffnessNm2: 0.50,
    maxTensileLoadN: 850,
    compressorPressureBar: 11,
    defaultFrictionCoeff: 0.14,
    bendAnglesDegrees: [45, 45],
    installationType: 'Pneumatic Pipe Ramming',
    soilEnvironment: 'Highway Embankment Gravel'
  },
  {
    id: 'jet-jm-06',
    name: 'Jia Musa Drainage Culvert Duct Route',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    routeLengthMeters: 380,
    ductOuterDiaMm: 10,
    ductInnerDiaMm: 8,
    cableOuterDiaMm: 4.2,
    cableWeightKgPerKm: 20,
    cableStiffnessNm2: 0.38,
    maxTensileLoadN: 700,
    compressorPressureBar: 9,
    defaultFrictionCoeff: 0.22, // Moisture/condensation friction
    bendAnglesDegrees: [45, 45, 45, 45, 45],
    installationType: 'Open Trench HDPE Conduit',
    soilEnvironment: 'High Water Table Alluvium'
  }
];

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
 * Calculates duct fill ratio, clearance gap, and checks whether fill ratio
 * complies with standard cable jetting clearance window (50% to 75%).
 */
export function calculateDuctClearance({ ductInnerDiaMm = 10, cableOuterDiaMm = 6 } = {}) {
  const dDuct = Math.max(4, Number(ductInnerDiaMm) || 10);
  const dCable = Math.max(1, Number(cableOuterDiaMm) || 6);

  const fillRatioPct = Math.round((dCable / dDuct) * 1000) / 10;
  const clearanceGapMm = Math.round(Math.max(0, dDuct - dCable) * 10) / 10;
  const areaRatioPct = Math.round((Math.pow(dCable / dDuct, 2)) * 1000) / 10;

  // Compliance: 50% - 75% is optimal for aerodynamic blowing
  let clearanceStatus = 'OPTIMAL';
  let clearanceNote = 'Ideal clearance for laminar/turbulent airflow';
  if (fillRatioPct > 78) {
    clearanceStatus = 'CHOKED';
    clearanceNote = 'High risk of airflow choking and air pressure blowback';
  } else if (fillRatioPct < 45) {
    clearanceStatus = 'LOOSE';
    clearanceNote = 'Excess clearance promotes premature sinusoidal cable buckling';
  }

  return {
    ductInnerDiaMm: dDuct,
    cableOuterDiaMm: dCable,
    fillRatioPct,
    clearanceGapMm,
    areaRatioPct,
    clearanceStatus,
    clearanceNote
  };
}

/**
 * Calculates pneumatic pushing dynamics, capstan bend drag, Euler helical buckling limits,
 * and maximum achievable jetting distance.
 */
export function calculateBlowingDynamics({
  routeLengthM = 500,
  ductInnerDiaMm = 10,
  cableOuterDiaMm = 6,
  cableWeightKgM = 0.035, // kg/m
  cableStiffnessNm2 = 0.8, // N·m²
  compressorPressureBar = 12,
  frictionCoeff = 0.12,
  bendAnglesDegrees = [45, 45],
  pusherThrustN = 25 // Mechanical drive pusher force
} = {}) {
  const g = 9.80665;
  const weightPerMeterN = cableWeightKgM * g; // W in N/m
  const mu = Math.max(0.05, Math.min(0.50, Number(frictionCoeff) || 0.12));
  const pressureBar = Math.max(4, Math.min(20, Number(compressorPressureBar) || 12));
  const thrustN = Math.max(5, Math.min(800, Number(pusherThrustN) || 25));

  // Clearance radius (m) = (D_duct - d_cable) / 2
  const clearanceM = Math.max(0.0005, ((ductInnerDiaMm - cableOuterDiaMm) / 2) / 1000);

  // Critical column buckling load inside duct clearance (Euler-Peyrot formulation)
  // P_crit = 2 * sqrt((E*I * W) / clearanceM)
  const pCritN = Math.round(2 * Math.sqrt((cableStiffnessNm2 * weightPerMeterN) / clearanceM));

  // Capstan bend multiplier: Product of exp(mu * theta_rad)
  let totalBendRad = 0;
  for (const deg of bendAnglesDegrees) {
    totalBendRad += (deg * Math.PI) / 180;
  }
  const capstanMultiplier = Math.round(Math.exp(mu * totalBendRad) * 100) / 100;

  // Aerodynamic drag force generated per meter by compressed air flow
  // F_air ≈ 0.5 * rho * v^2 * C_d * perimeter ≈ proportional to pressure gradient
  // Realistic calibrated empirical model: ~0.08 to 0.25 N/m under 10-15 bar
  const airDragForcePerMeterN = Math.round(((pressureBar / 10) * 0.14) * 1000) / 1000;

  // Net friction along straight route per meter = mu * W - F_air
  // If airDrag >= mu * W, cable is floating (free blowing). If not, pusher supplies the deficit.
  const baseFrictionPerMeterN = mu * weightPerMeterN;
  const netDragPerMeterN = Math.max(0.01, (baseFrictionPerMeterN * capstanMultiplier) - (airDragForcePerMeterN * 0.7));

  // Maximum achievable jetting distance before pusher exceeds P_crit (buckling lockup)
  // L_max = (P_crit * safetyFactor) / netDragPerMeter
  const safetyFactor = 0.85;
  const maxJettingDistanceM = Math.min(2500, Math.round((pCritN * safetyFactor) / netDragPerMeterN));

  // Effective blowing speed (m/min)
  // Higher pressure and lower friction yields higher speed (typically 40 to 90 m/min)
  const jettingSpeedMPerMin = Math.round(Math.max(15, Math.min(100, (pressureBar * 6.5) / (1 + (mu * 3)))));

  // Install duration (minutes) for this route
  const estimatedInstallMinutes = Math.round((routeLengthM / jettingSpeedMPerMin) * 10) / 10;

  // Buckling safety margin: ratio of critical buckling load to applied pusher force
  const bucklingSafetyRatio = Math.round((pCritN / thrustN) * 100) / 100;
  let bucklingStatus = 'SAFE';
  if (thrustN >= pCritN) {
    bucklingStatus = 'HELICAL_LOCKUP';
  } else if (thrustN >= pCritN * 0.8) {
    bucklingStatus = 'WARNING';
  }

  return {
    mu,
    pressureBar,
    thrustN,
    weightPerMeterN: Math.round(weightPerMeterN * 1000) / 1000,
    pCritN,
    totalBendRad: Math.round(totalBendRad * 100) / 100,
    capstanMultiplier,
    airDragForcePerMeterN,
    netDragPerMeterN: Math.round(netDragPerMeterN * 1000) / 1000,
    maxJettingDistanceM,
    jettingSpeedMPerMin,
    estimatedInstallMinutes,
    bucklingSafetyRatio,
    bucklingStatus
  };
}

/**
 * Calculates complete underground duct jetting metrics for a target route or fleet,
 * correlating customer revenue and network expansion readiness.
 */
export function calculateDuctJettingMetrics(state, options = {}) {
  const {
    routeId = null,
    pressureOverride = null,
    frictionOverride = null,
    pusherThrustN = 25,
    referenceDate = new Date()
  } = options;

  const routes = SHAHDARA_JETTING_ROUTES;
  let targetRoute = routes[0];

  if (routeId) {
    const found = routes.find(r => r.id === routeId);
    if (found) targetRoute = found;
  }

  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const currentMonthStr = typeof referenceDate === 'string'
    ? referenceDate.slice(0, 7)
    : (referenceDate instanceof Date ? referenceDate.toISOString().slice(0, 7) : new Date().toISOString().slice(0, 7));

  let fleetTotalMeters = 0;
  let fleetHighFrictionCount = 0;
  let fleetLockupRiskCount = 0;
  let fleetOptimalCount = 0;
  let fleetRevenueAtRisk = 0;

  const evaluatedRoutes = routes.map(route => {
    const isTarget = route.id === targetRoute.id;
    const effectivePressure = (isTarget && pressureOverride !== null && pressureOverride !== undefined)
      ? Number(pressureOverride)
      : route.compressorPressureBar;
    const effectiveFriction = (isTarget && frictionOverride !== null && frictionOverride !== undefined)
      ? Number(frictionOverride)
      : route.defaultFrictionCoeff;

    const clearance = calculateDuctClearance({
      ductInnerDiaMm: route.ductInnerDiaMm,
      cableOuterDiaMm: route.cableOuterDiaMm
    });

    const dynamics = calculateBlowingDynamics({
      routeLengthM: route.routeLengthMeters,
      ductInnerDiaMm: route.ductInnerDiaMm,
      cableOuterDiaMm: route.cableOuterDiaMm,
      cableWeightKgM: route.cableWeightKgPerKm / 1000,
      cableStiffnessNm2: route.cableStiffnessNm2,
      compressorPressureBar: effectivePressure,
      frictionCoeff: effectiveFriction,
      bendAnglesDegrees: route.bendAnglesDegrees,
      pusherThrustN
    });

    // Assessment: can we reach full route length?
    const reachRatio = Math.round((dynamics.maxJettingDistanceM / route.routeLengthMeters) * 100) / 100;
    let statusTier = 'OPTIMAL';
    let statusLabel = 'Full Pneumatic Reach';
    let badgeClass = 'badge-success';

    if (reachRatio < 0.95 || dynamics.bucklingStatus === 'HELICAL_LOCKUP' || effectiveFriction >= 0.25) {
      statusTier = 'CRITICAL';
      statusLabel = 'Helical Buckling Lockup Risk';
      badgeClass = 'badge-danger';
      fleetLockupRiskCount++;
    } else if (reachRatio < 1.15 || dynamics.bucklingStatus === 'WARNING' || effectiveFriction >= 0.18) {
      statusTier = 'CAUTION';
      statusLabel = 'Pusher Force Warning';
      badgeClass = 'badge-warning';
      fleetHighFrictionCount++;
    } else {
      fleetOptimalCount++;
    }

    // Customer correlation
    const areaLower = route.primaryArea.toLowerCase();
    const aliasLowers = route.aliasAreas.map(a => a.toLowerCase());

    let areaCustomersCount = 0;
    let activeSubscribers = 0;
    let offlineSubscribers = 0;
    let monthlyRevenue = 0;

    for (const cust of customers) {
      if (cust.archived) continue;
      const cArea = String(cust.area || '').trim().toLowerCase();
      const match = cArea === areaLower || aliasLowers.includes(cArea);
      if (match) {
        areaCustomersCount++;
        const sStatus = String(cust.serviceStatus || '').toLowerCase();
        if (sStatus === 'active') activeSubscribers++;
        else if (sStatus === 'offline') offlineSubscribers++;

        const bills = Array.isArray(cust.bills) ? cust.bills : [];
        const curBill = bills.find(b => b.month === currentMonthStr) || bills[bills.length - 1];
        if (curBill && typeof curBill.amount === 'number' && !isNaN(curBill.amount)) {
          monthlyRevenue += curBill.amount;
        }
      }
    }

    let revenueAtRisk = 0;
    if (statusTier === 'CRITICAL') {
      revenueAtRisk = monthlyRevenue;
    } else if (statusTier === 'CAUTION') {
      revenueAtRisk = Math.round(monthlyRevenue * 0.25);
    }
    fleetRevenueAtRisk += revenueAtRisk;

    fleetTotalMeters += route.routeLengthMeters;

    return {
      route,
      clearance,
      dynamics,
      effectivePressure,
      effectiveFriction,
      reachRatio,
      statusTier,
      statusLabel,
      badgeClass,
      areaCustomersCount,
      activeSubscribers,
      offlineSubscribers,
      monthlyRevenue,
      revenueAtRisk
    };
  });

  const selectedEvaluation = evaluatedRoutes.find(e => e.route.id === targetRoute.id) || evaluatedRoutes[0];

  return {
    selectedRoute: targetRoute,
    evaluation: selectedEvaluation,
    fleet: {
      routes: evaluatedRoutes,
      totalRoutes: routes.length,
      totalMeters: fleetTotalMeters,
      lockupRiskCount: fleetLockupRiskCount,
      highFrictionCount: fleetHighFrictionCount,
      optimalCount: fleetOptimalCount,
      revenueAtRisk: fleetRevenueAtRisk
    }
  };
}

/**
 * Generates an accessible, theme-aware pure SVG diagram depicting the underground duct,
 * pneumatic airflow pressure vector, cable fill clearance, and jetting reach gauge.
 */
export function renderDuctJettingSvg(metrics) {
  if (!metrics || !metrics.evaluation) {
    return `<div class="chart-empty-state">No underground duct jetting metrics available.</div>`;
  }

  const { evaluation, selectedRoute } = metrics;
  const {
    clearance,
    dynamics,
    effectivePressure,
    effectiveFriction,
    reachRatio,
    statusTier
  } = evaluation;

  const width = 560;
  const height = 300;

  const statusColor = statusTier === 'CRITICAL'
    ? '#ef4444'
    : (statusTier === 'CAUTION' ? '#f59e0b' : '#10b981');

  // Route reach progress bar: routeLength vs maxJettingDistance
  const maxScaleMeters = Math.max(selectedRoute.routeLengthMeters * 1.3, dynamics.maxJettingDistanceM);
  const routeTargetW = Math.min(220, Math.round((selectedRoute.routeLengthMeters / maxScaleMeters) * 220));
  const maxReachW = Math.min(220, Math.round((dynamics.maxJettingDistanceM / maxScaleMeters) * 220));

  return `
    <svg class="chart-svg duct-jetting-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img"
      aria-label="Underground Duct Hydraulic Pressure and Cable Jetting Friction Diagram">
      <defs>
        <linearGradient id="ductWallGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#334155" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
        <linearGradient id="airFlowGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#0284c7" stop-opacity="0.2" />
        </linearGradient>
        <linearGradient id="cableSheathGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f59e0b" />
          <stop offset="100%" stop-color="#b45309" />
        </linearGradient>
      </defs>

      <!-- Outer Card Container -->
      <rect x="10" y="10" width="540" height="280" rx="10" fill="var(--bg-card, #ffffff)" stroke="var(--line, #e2e8f0)" stroke-width="1" />

      <!-- Left Column: Longitudinal Duct Cutaway & High-Velocity Air Flow -->
      <g class="duct-cutaway-group" transform="translate(25, 25)">
        <text x="0" y="16" font-family="'Manrope', system-ui, sans-serif" font-size="12" font-weight="800" fill="var(--ink, #0f172a)">
          Pneumatic Cable Blowing Trajectory
        </text>
        <text x="0" y="28" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
          ${escapeXml(selectedRoute.installationType)} (${escapeXml(selectedRoute.soilEnvironment)})
        </text>

        <!-- Longitudinal HDPE Duct tube cutaway -->
        <g transform="translate(0, 40)">
          <!-- Duct top wall -->
          <rect x="0" y="0" width="245" height="12" rx="2" fill="url(#ductWallGrad)" />
          <!-- Air flow bore -->
          <rect x="0" y="12" width="245" height="56" fill="url(#airFlowGrad)" />
          
          <!-- Moving cable trajectory inside duct -->
          <rect x="0" y="32" width="210" height="24" rx="4" fill="url(#cableSheathGrad)" stroke="#78350f" stroke-width="1" />
          <!-- Fiber core inner line -->
          <line x1="0" y1="44" x2="200" y2="44" stroke="#fef3c7" stroke-width="2" stroke-dasharray="8,4" />

          <!-- Duct bottom wall -->
          <rect x="0" y="68" width="245" height="12" rx="2" fill="url(#ductWallGrad)" />

          <!-- Mechanical Pusher Clamping Drive Wheel -->
          <g transform="translate(10, 4)">
            <circle cx="20" cy="-2" r="14" fill="#0f172a" stroke="#94a3b8" stroke-width="2" />
            <circle cx="20" cy="-2" r="4" fill="#38bdf8" />
            <circle cx="20" cy="82" r="14" fill="#0f172a" stroke="#94a3b8" stroke-width="2" />
            <circle cx="20" cy="82" r="4" fill="#38bdf8" />
          </g>

          <!-- Pressure Flow Vector Arrows -->
          <path d="M 80 20 L 140 20 M 130 16 L 142 20 L 130 24" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M 160 20 L 210 20 M 202 16 L 212 20 L 202 24" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          <text x="145" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="#0369a1" text-anchor="middle">
            ${effectivePressure} BAR AIR
          </text>
        </g>

        <!-- Cross Section Clearance Visualizer -->
        <g transform="translate(0, 140)">
          <rect x="0" y="0" width="245" height="100" rx="6" fill="var(--bg-subtle, #f8fafc)" stroke="var(--line, #e2e8f0)" />
          
          <!-- Concentric circles: Duct bore vs Cable -->
          <circle cx="50" cy="50" r="38" fill="var(--bg-card, #ffffff)" stroke="#1e293b" stroke-width="4" />
          <circle cx="50" cy="50" r="24" fill="url(#cableSheathGrad)" stroke="#78350f" stroke-width="1.5" />
          <circle cx="50" cy="50" r="6" fill="#fef3c7" />

          <!-- Cross-section details -->
          <text x="100" y="32" font-family="'Manrope', system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--ink, #0f172a)">
            Bore Fill &amp; Clearance
          </text>
          <text x="100" y="48" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
            Duct: <tspan font-weight="700" fill="var(--ink, #1e293b)">${selectedRoute.ductInnerDiaMm}mm ID</tspan>
          </text>
          <text x="100" y="62" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
            Cable: <tspan font-weight="700" fill="var(--ink, #1e293b)">${selectedRoute.cableOuterDiaMm}mm OD</tspan>
          </text>
          <text x="100" y="78" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="${clearance.fillRatioPct > 75 ? '#ef4444' : '#10b981'}">
            Fill: ${clearance.fillRatioPct}% (${clearance.clearanceGapMm}mm gap)
          </text>
        </g>
      </g>

      <!-- Right Column: Hydraulic Thrust, Friction & Blowing Reach -->
      <g class="dynamics-group" transform="translate(295, 25)">
        <text x="0" y="16" font-family="'Manrope', system-ui, sans-serif" font-size="12" font-weight="800" fill="var(--ink, #0f172a)">
          Capstan Friction &amp; Buckling Dynamics
        </text>
        <text x="0" y="28" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
          Friction Coeff (?): ${effectiveFriction} | Air Drag: +${dynamics.airDragForcePerMeterN} N/m
        </text>

        <!-- Metric KPI Cards mini-grid -->
        <g transform="translate(0, 38)">
          <!-- Critical Buckling Load -->
          <rect x="0" y="0" width="115" height="58" rx="6" fill="var(--bg-subtle, #f8fafc)" stroke="var(--line, #e2e8f0)" />
          <text x="8" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="var(--muted, #64748b)">CRITICAL BUCKLING</text>
          <text x="8" y="36" font-family="monospace" font-size="14" font-weight="800" fill="var(--ink, #0f172a)">${dynamics.pCritN} N</text>
          <text x="8" y="48" font-family="'DM Sans', system-ui, sans-serif" font-size="8" fill="var(--muted, #64748b)">Pusher Limit</text>

          <!-- Jetting Velocity -->
          <rect x="125" y="0" width="115" height="58" rx="6" fill="var(--bg-subtle, #f8fafc)" stroke="var(--line, #e2e8f0)" />
          <text x="133" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="var(--muted, #64748b)">BLOWING SPEED</text>
          <text x="133" y="36" font-family="monospace" font-size="14" font-weight="800" fill="#0284c7">${dynamics.jettingSpeedMPerMin} m/m</text>
          <text x="133" y="48" font-family="'DM Sans', system-ui, sans-serif" font-size="8" fill="var(--muted, #64748b)">Est: ${dynamics.estimatedInstallMinutes} min</text>
        </g>

        <!-- Blowing Distance Progress Gauge -->
        <g transform="translate(0, 110)">
          <rect x="0" y="0" width="240" height="130" rx="6" fill="var(--bg-subtle, #f8fafc)" stroke="var(--line, #e2e8f0)" />
          
          <text x="10" y="18" font-family="'Manrope', system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--ink, #0f172a)">
            Maximum Blowing Reach Horizon
          </text>

          <!-- Target distance track -->
          <text x="10" y="38" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
            Route Length: <tspan font-weight="700" fill="var(--ink, #0f172a)">${selectedRoute.routeLengthMeters}m</tspan>
          </text>
          <rect x="10" y="44" width="220" height="12" rx="3" fill="var(--line, #e2e8f0)" />
          <rect x="10" y="44" width="${routeTargetW}" height="12" rx="3" fill="#64748b" opacity="0.6" />

          <!-- Max achievable jetting distance bar -->
          <text x="10" y="74" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #64748b)">
            Achievable Reach: <tspan font-weight="700" fill="${statusColor}">${dynamics.maxJettingDistanceM}m</tspan>
          </text>
          <rect x="10" y="80" width="220" height="14" rx="3" fill="var(--line, #e2e8f0)" />
          <rect x="10" y="80" width="${maxReachW}" height="14" rx="3" fill="${statusColor}" />

          <!-- Status indicator badge -->
          <text x="10" y="114" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="${statusColor}">
            ${reachRatio >= 1.0 ? `? Complete Penetration (+${dynamics.maxJettingDistanceM - selectedRoute.routeLengthMeters}m margin)` : `? Undershoot (${selectedRoute.routeLengthMeters - dynamics.maxJettingDistanceM}m short)`}
          </text>
        </g>
      </g>
    </svg>
  `;
}

/**
 * Generates an executive and operational technical briefing report for directional
 * drilling and cable blowing contractor crews.
 */
export function generateDuctJettingReport(metrics, referenceDate = new Date()) {
  if (!metrics || !metrics.evaluation) {
    return 'No underground duct jetting evaluation data available.';
  }

  const { evaluation, selectedRoute, fleet } = metrics;
  const {
    clearance,
    dynamics,
    effectivePressure,
    effectiveFriction,
    reachRatio,
    statusTier,
    statusLabel,
    areaCustomersCount,
    activeSubscribers,
    offlineSubscribers,
    monthlyRevenue,
    revenueAtRisk
  } = evaluation;

  const dateStr = typeof referenceDate === 'string'
    ? referenceDate
    : (referenceDate instanceof Date ? referenceDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

  return [
    `================================================================================`,
    `SHAHDARA FTTH UNDERGROUND DUCT HYDRAULIC PRESSURE & JETTING AUDIT REPORT`,
    `Generated: ${dateStr} PKT | Standards: IEEE 1210 / IEC 60794-1-2 / Telcordia GR-356`,
    `================================================================================`,
    ``,
    `1. ROUTE SPECIFICATION & TRENCH TOPOLOGY:`,
    `   - Route ID & Corridor    : [${selectedRoute.id}] ${selectedRoute.name}`,
    `   - Municipal Sector       : ${selectedRoute.primaryArea}`,
    `   - Trench Length          : ${selectedRoute.routeLengthMeters} meters`,
    `   - Conduit Construction   : ${selectedRoute.installationType}`,
    `   - Soil & Subsurface Env  : ${selectedRoute.soilEnvironment}`,
    `   - Route Bends (Degrees)  : ${selectedRoute.bendAnglesDegrees.join('°, ')}° (${dynamics.totalBendRad} rad)`,
    `   - Capstan Multiplier     : ${dynamics.capstanMultiplier}x friction amplification`,
    ``,
    `2. CONDUIT BORE & CABLE CLEARANCE METRICS:`,
    `   - Microduct Dimensions   : ${selectedRoute.ductOuterDiaMm}mm OD / ${selectedRoute.ductInnerDiaMm}mm ID`,
    `   - Cable Outer Diameter   : ${selectedRoute.cableOuterDiaMm} mm (${selectedRoute.cableWeightKgPerKm} kg/km)`,
    `   - Fill Ratio Percentage  : ${clearance.fillRatioPct}% (Area Ratio: ${clearance.areaRatioPct}%)`,
    `   - Annular Air Clearance  : ${clearance.clearanceGapMm} mm`,
    `   - Clearance Status       : ${clearance.clearanceStatus} (${clearance.clearanceNote})`,
    ``,
    `3. PNEUMATIC BLOWING & BUCKLING DYNAMICS:`,
    `   - Compressor Pressure    : ${effectivePressure} bar (${Math.round(effectivePressure * 14.5038)} PSI)`,
    `   - Sidewall Friction (?)  : ${effectiveFriction}`,
    `   - Aerodynamic Drag Force : +${dynamics.airDragForcePerMeterN} N/meter forward thrust`,
    `   - Net Route Drag Rate    : ${dynamics.netDragPerMeterN} N/meter`,
    `   - Critical Buckling Load : ${dynamics.pCritN} Newtons (P_crit)`,
    `   - Pusher Safety Margin   : ${dynamics.bucklingSafetyRatio}x (${dynamics.bucklingStatus})`,
    `   - Est. Blowing Speed     : ${dynamics.jettingSpeedMPerMin} meters/minute`,
    `   - Blowing Run Duration   : ~${dynamics.estimatedInstallMinutes} minutes`,
    `   - Achievable Reach       : ${dynamics.maxJettingDistanceM} meters (${reachRatio >= 1 ? 'REACHES DESTINATION' : 'UNDERSHOOT DEFICIT'})`,
    `   - Operational Health     : ${statusTier} - ${statusLabel}`,
    ``,
    `4. CUSTOMER ROSTER & BACKBONE REVENUE AT RISK:`,
    `   - Sector Accounts Served : ${areaCustomersCount} subscribers (${activeSubscribers} Active, ${offlineSubscribers} Offline)`,
    `   - Sector Monthly Billing : ${formatPKR(monthlyRevenue)}`,
    `   - Revenue Exposure Risk  : ${formatPKR(revenueAtRisk)}`,
    ``,
    `5. SHAHDARA UNDERGROUND CONDUIT FLEET REGISTER:`,
    `   - Total Underground Runs : ${fleet.totalRoutes} corridors`,
    `   - Total Trench Footprint : ${fleet.totalMeters} meters`,
    `   - Corridor Health Tiers  : ${fleet.optimalCount} Optimal, ${fleet.highFrictionCount} Caution, ${fleet.lockupRiskCount} Critical`,
    `   - Fleet Total At-Risk Rev: ${formatPKR(fleet.revenueAtRisk)}`,
    ``,
    `6. CONTRACTOR & JETTING MACHINE RECOMMENDATIONS:`,
    ...(reachRatio < 1.0
      ? [`   [CRITICAL] Blowing distance undershoot! Inject liquid polymer lubricant emulsion (Prelube 2000) to lower friction below 0.12.`]
      : []),
    ...(dynamics.bucklingStatus !== 'SAFE'
      ? [`   [WARNING] Pusher force near column buckling threshold. Throttle mechanical drive wheels and let air compressor carry forward momentum.`]
      : []),
    ...(clearance.fillRatioPct > 75
      ? [`   [CAUTION] Duct fill ratio exceeds 75%. Use high-output compressor (>14 bar, 3.5 m³/min) to prevent laminar boundary layer stalling.`]
      : []),
    ...(reachRatio >= 1.0 && dynamics.bucklingStatus === 'SAFE'
      ? [`   [VERIFIED] Jetting parameters fully compliant. Approved for continuous pneumatic launch.`]
      : []),
    `================================================================================`
  ].join('\n');
}

// Module State Holders
let selectedRouteId = 'jet-mb-03'; // default to high-friction commercial underground crossing
let simulatedPressureBar = null;
let simulatedFrictionCoeff = null;

export function getJettingSelectedRoute() {
  return selectedRouteId;
}

export function setJettingSelectedRoute(id) {
  if (id && SHAHDARA_JETTING_ROUTES.some(r => r.id === id)) {
    selectedRouteId = id;
    simulatedPressureBar = null;
    simulatedFrictionCoeff = null;
  }
}

export function getJettingPressure() {
  return simulatedPressureBar;
}

export function setJettingPressure(bar) {
  simulatedPressureBar = bar !== null && bar !== undefined ? Number(bar) : null;
}

export function getJettingFriction() {
  return simulatedFrictionCoeff;
}

export function setJettingFriction(friction) {
  simulatedFrictionCoeff = friction !== null && friction !== undefined ? Number(friction) : null;
}

/**
 * Initializes and wires event listeners for the Underground Duct Jetting Modal.
 */
export function setupDuctJettingModal(state, options = {}) {
  const {
    referenceDate = new Date(),
    onFilterArea = null,
    onFilterCustomer = null,
    onToast = null,
    clipboard = null
  } = options;

  if (typeof document === 'undefined') return;

  const modal = document.getElementById('dashboardJettingModal');
  const openBtn = document.getElementById('dashboardOpenJettingModalBtn');
  const closeBtn = document.getElementById('dashboardJettingModalCloseBtn');
  const routeSelect = document.getElementById('jettingRouteSelect');
  const pressureSlider = document.getElementById('jettingPressureSlider');
  const pressureVal = document.getElementById('jettingPressureVal');
  const frictionSlider = document.getElementById('jettingFrictionSlider');
  const frictionVal = document.getElementById('jettingFrictionVal');
  const resetBtn = document.getElementById('jettingResetSimBtn');
  const copyBtn = document.getElementById('dashboardCopyJettingReportBtn');
  const filterAreaBtn = document.getElementById('jettingFilterAreaBtn');

  // KPI elements
  const kpiRouteName = document.getElementById('jettingKpiRouteName');
  const kpiBlowingReach = document.getElementById('jettingKpiBlowingReach');
  const kpiBucklingLoad = document.getElementById('jettingKpiBucklingLoad');
  const kpiStatusBadge = document.getElementById('jettingStatusBadge');
  const kpiRevenueRisk = document.getElementById('jettingKpiRevenueRisk');
  const chartWrap = document.getElementById('jettingModalChartWrap');
  const tableBody = document.getElementById('jettingRoutesTableBody');

  function refreshModalContent() {
    const data = calculateDuctJettingMetrics(state, {
      routeId: selectedRouteId,
      pressureOverride: simulatedPressureBar,
      frictionOverride: simulatedFrictionCoeff,
      referenceDate
    });

    const { evaluation, selectedRoute, fleet } = data;
    const {
      clearance,
      dynamics,
      effectivePressure,
      effectiveFriction,
      statusTier,
      badgeClass,
      revenueAtRisk
    } = evaluation;

    if (kpiRouteName) {
      kpiRouteName.textContent = `${selectedRoute.name} (${selectedRoute.routeLengthMeters}m)`;
    }
    if (kpiBlowingReach) {
      kpiBlowingReach.textContent = `${dynamics.maxJettingDistanceM}m (${dynamics.jettingSpeedMPerMin} m/min)`;
    }
    if (kpiBucklingLoad) {
      kpiBucklingLoad.textContent = `${dynamics.pCritN} N (${dynamics.bucklingStatus})`;
    }
    if (kpiStatusBadge) {
      kpiStatusBadge.textContent = statusTier;
      kpiStatusBadge.className = `sim-delta-badge ${badgeClass}`;
    }
    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(revenueAtRisk)} at risk`;
    }

    if (chartWrap) {
      chartWrap.innerHTML = renderDuctJettingSvg(data);
    }

    if (tableBody) {
      tableBody.innerHTML = fleet.routes.map(item => {
        const r = item.route;
        const isCurrent = r.id === selectedRoute.id;
        return `
          <tr class="${isCurrent ? 'selected-row' : ''}" style="${isCurrent ? 'background: var(--bg-subtle, #f0fdf4); font-weight: 600;' : ''}">
            <td>
              <button type="button" class="table-link-btn" data-route-id="${r.id}" style="border:none; background:none; color:var(--primary, #059669); cursor:pointer; text-decoration:underline; font-weight:600; text-align:left; padding:0;">
                ${escapeXml(r.name)}
              </button>
            </td>
            <td>${escapeXml(r.primaryArea)}</td>
            <td>${r.routeLengthMeters}m</td>
            <td>${item.clearance.fillRatioPct}% (${r.ductInnerDiaMm}mm)</td>
            <td>${item.dynamics.maxJettingDistanceM}m (${item.effectivePressure} bar)</td>
            <td>
              <span class="sim-delta-badge ${item.badgeClass}" style="padding: 2px 6px; font-size: 10px;">
                ${item.statusTier}
              </span>
            </td>
          </tr>
        `;
      }).join('');

      tableBody.querySelectorAll('[data-route-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const rid = btn.getAttribute('data-route-id');
          setJettingSelectedRoute(rid);
          if (routeSelect) routeSelect.value = rid;
          const newEval = calculateDuctJettingMetrics(state, { routeId: rid, referenceDate }).evaluation;
          if (pressureSlider) pressureSlider.value = newEval.effectivePressure;
          if (pressureVal) pressureVal.textContent = `${newEval.effectivePressure} bar`;
          if (frictionSlider) frictionSlider.value = newEval.effectiveFriction;
          if (frictionVal) frictionVal.textContent = `${newEval.effectiveFriction}`;
          refreshModalContent();
        });
      });
    }
  }

  // Populate Route options
  if (routeSelect && routeSelect.children.length === 0) {
    SHAHDARA_JETTING_ROUTES.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${r.name} (${r.routeLengthMeters}m)`;
      if (r.id === selectedRouteId) opt.selected = true;
      routeSelect.appendChild(opt);
    });
  }

  // Open Modal Event
  if (openBtn && !openBtn.dataset.wired) {
    openBtn.dataset.wired = 'true';
    openBtn.addEventListener('click', () => {
      if (routeSelect) routeSelect.value = selectedRouteId;
      const initialEval = calculateDuctJettingMetrics(state, {
        routeId: selectedRouteId,
        referenceDate
      }).evaluation;
      if (pressureSlider) pressureSlider.value = initialEval.effectivePressure;
      if (pressureVal) pressureVal.textContent = `${initialEval.effectivePressure} bar`;
      if (frictionSlider) frictionSlider.value = initialEval.effectiveFriction;
      if (frictionVal) frictionVal.textContent = `${initialEval.effectiveFriction}`;
      refreshModalContent();
      if (typeof modal.showModal === 'function') {
        try { modal.showModal(); } catch { modal.setAttribute('open', ''); }
      } else {
        modal.setAttribute('open', '');
      }
    });
  }

  // Close Modal Event
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

  // Route Select Change
  if (routeSelect && !routeSelect.dataset.wired) {
    routeSelect.dataset.wired = 'true';
    routeSelect.addEventListener('change', () => {
      setJettingSelectedRoute(routeSelect.value);
      const newEval = calculateDuctJettingMetrics(state, { routeId: routeSelect.value, referenceDate }).evaluation;
      if (pressureSlider) pressureSlider.value = newEval.effectivePressure;
      if (pressureVal) pressureVal.textContent = `${newEval.effectivePressure} bar`;
      if (frictionSlider) frictionSlider.value = newEval.effectiveFriction;
      if (frictionVal) frictionVal.textContent = `${newEval.effectiveFriction}`;
      refreshModalContent();
    });
  }

  // Pressure Slider Input
  if (pressureSlider && !pressureSlider.dataset.wired) {
    pressureSlider.dataset.wired = 'true';
    pressureSlider.addEventListener('input', () => {
      setJettingPressure(pressureSlider.value);
      if (pressureVal) pressureVal.textContent = `${pressureSlider.value} bar`;
      refreshModalContent();
    });
  }

  // Friction Slider Input
  if (frictionSlider && !frictionSlider.dataset.wired) {
    frictionSlider.dataset.wired = 'true';
    frictionSlider.addEventListener('input', () => {
      setJettingFriction(frictionSlider.value);
      if (frictionVal) frictionVal.textContent = `${frictionSlider.value}`;
      refreshModalContent();
    });
  }

  // Reset Simulation Button
  if (resetBtn && !resetBtn.dataset.wired) {
    resetBtn.dataset.wired = 'true';
    resetBtn.addEventListener('click', () => {
      setJettingPressure(null);
      setJettingFriction(null);
      const resetEval = calculateDuctJettingMetrics(state, { routeId: selectedRouteId, referenceDate }).evaluation;
      if (pressureSlider) pressureSlider.value = resetEval.effectivePressure;
      if (pressureVal) pressureVal.textContent = `${resetEval.effectivePressure} bar`;
      if (frictionSlider) frictionSlider.value = resetEval.effectiveFriction;
      if (frictionVal) frictionVal.textContent = `${resetEval.effectiveFriction}`;
      refreshModalContent();
    });
  }

  // Filter Area Button
  if (filterAreaBtn && !filterAreaBtn.dataset.wired) {
    filterAreaBtn.dataset.wired = 'true';
    filterAreaBtn.addEventListener('click', () => {
      const data = calculateDuctJettingMetrics(state, { routeId: selectedRouteId, referenceDate });
      if (typeof onFilterArea === 'function') {
        onFilterArea(data.selectedRoute.primaryArea);
        if (typeof modal.close === 'function') {
          try { modal.close(); } catch { modal.removeAttribute('open'); }
        } else {
          modal.removeAttribute('open');
        }
      }
    });
  }

  // Copy Briefing Report Button
  if (copyBtn && !copyBtn.dataset.wired) {
    copyBtn.dataset.wired = 'true';
    copyBtn.addEventListener('click', async () => {
      const data = calculateDuctJettingMetrics(state, {
        routeId: selectedRouteId,
        pressureOverride: simulatedPressureBar,
        frictionOverride: simulatedFrictionCoeff,
        referenceDate
      });
      const text = generateDuctJettingReport(data, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Underground duct jetting audit copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy audit report.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard API not available.');
      }
    });
  }
}
