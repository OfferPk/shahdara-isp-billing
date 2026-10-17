import { formatPKR } from './core.js';

/**
 * Optical Fiber Brillouin Optical Time Domain Analysis (BOTDA / ITU-T G.650.2)
 * Distributed Temperature and Strain Sensing (DTSS) Matrix & Fiber Fatigue Telemetry
 * Standards: ITU-T G.650.2, IEC 60794-1-21, IEC 61757-1-1
 * Area: agent1 (shahdara-dashboard) - KPIs, Charts, SVG Profile & Structural Telemetry
 */

export const BOTDA_CONSTANTS = {
  DEFAULT_ROUTE_ID: 'ravi-siphon-aerial',
  BASELINE_BFS_GHZ: 10.850, // 10,850 MHz at 20°C and 0 microstrain in standard silica G.652.D at 1550 nm
  BASELINE_TEMP_C: 20.0,
  TEMP_COEFF_MHZ_PER_C: 1.070, // C_T: 1.07 MHz / °C
  STRAIN_COEFF_MHZ_PER_USTRAIN: 0.048, // C_e: 0.048 MHz / u-strain (48 kHz / u-strain)
  NATURAL_FWHM_MHZ: 32.0, // Natural Brillouin linewidth in silica
  SPEED_OF_LIGHT_MS: 299792458,
  GROUP_INDEX_NG: 1.4682,
  FIBBER_ATTENUATION_DB_PER_KM: 0.20, // 1550 nm attenuation
  DEFAULT_PUMP_PULSE_NS: 30, // 30 ns gives ~3.06m spatial resolution
  SAFE_STRAIN_THRESHOLD_USTRAIN: 1200, // Long-term safe mechanical tension
  CRITICAL_STRAIN_THRESHOLD_USTRAIN: 2000, // IEC 60794-1-21 max allowable operational strain (0.2%)
  PROOF_TEST_STRAIN_USTRAIN: 10000, // 1.0% factory proof test strain

  STATUS: {
    OPTIMAL: 'Optimal Integrity',
    ELEVATED_STRAIN: 'Elevated Strain Caution',
    THERMAL_ANOMALY: 'Thermal Hotspot Hazard',
    CRITICAL: 'Critical Fatigue Risk'
  }
};

export const SHAHDARA_BOTDA_ROUTES = [
  {
    id: 'ravi-siphon-aerial',
    name: 'Ravi Siphon River Crossing & ADSS Aerial Feeder',
    routeCode: 'BOTDA-RTE-01',
    primaryArea: 'Ravi Siphon',
    secondaryAreas: ['Baradari', 'Shahdara Town'],
    cableType: '96-Core G.652.D Figure-8 Self-Supporting ADSS',
    lengthKm: 14.8,
    connectedNodes: ['OLT-RaviSiphon', 'FDT-04-BridgeHead', 'FDT-09-PylonNorth', 'POP-Baradari'],
    subscribersCount: 420,
    monthlyRevenuePkr: 1450000,
    baselineTempC: 24.5,
    baselineStrainUstrain: 650,
    hotspots: [
      {
        distanceKm: 4.82,
        name: 'Ravi River Mid-Channel Pylon Long-Span Sag',
        type: 'mechanical',
        nominalStrainUstrain: 880,
        nominalTempC: 25.0,
        description: 'Wind vortex shedding and heavy thermal expansion tension on river span'
      },
      {
        distanceKm: 9.15,
        name: 'GT Road Heavy Freight Flyover Vibration Bracket',
        type: 'mechanical',
        nominalStrainUstrain: 740,
        nominalTempC: 26.2,
        description: 'Continuous vehicular vibration shock and pole sway'
      }
    ]
  },
  {
    id: 'begum-kot-underground',
    name: 'Begum Kot Industrial Trunk & Power Duct Trench Route',
    routeCode: 'BOTDA-RTE-02',
    primaryArea: 'Begum Kot',
    secondaryAreas: ['Shahdara Town', 'Vandala Road'],
    cableType: '144-Core G.652.D Double-Armored Direct Buried Conduit',
    lengthKm: 18.2,
    connectedNodes: ['OLT-BegumKot', 'FDT-Ind-Cluster', 'MH-12-Substation', 'POP-TownHall'],
    subscribersCount: 680,
    monthlyRevenuePkr: 2100000,
    baselineTempC: 21.0,
    baselineStrainUstrain: 320,
    hotspots: [
      {
        distanceKm: 6.40,
        name: '132kV WAPDA Grid Substation Proximity Duct',
        type: 'thermal',
        nominalStrainUstrain: 350,
        nominalTempC: 38.5,
        description: 'Underground high-voltage power transmission thermal emission heating duct'
      },
      {
        distanceKm: 12.30,
        name: 'Industrial Effluent Drain Soil Subsidence Zone',
        type: 'mechanical',
        nominalStrainUstrain: 1120,
        nominalTempC: 22.0,
        description: 'Seasonal soil leaching and subsoil displacement tension on armored armor'
      }
    ]
  },
  {
    id: 'vandala-railway-aerial',
    name: 'Vandala Road - Railway Right-of-Way ADSS Feeder',
    routeCode: 'BOTDA-RTE-03',
    primaryArea: 'Vandala Road',
    secondaryAreas: ['Begum Kot'],
    cableType: '72-Core G.657.A1 Bend-Insensitive ADSS',
    lengthKm: 11.5,
    connectedNodes: ['OLT-Vandala', 'FDT-RailCrossing', 'FAT-22-Junction', 'POP-BegumKot'],
    subscribersCount: 390,
    monthlyRevenuePkr: 980000,
    baselineTempC: 23.0,
    baselineStrainUstrain: 580,
    hotspots: [
      {
        distanceKm: 3.20,
        name: 'Railway Track Overhead 25kV Catenary Crossing',
        type: 'compound',
        nominalStrainUstrain: 820,
        nominalTempC: 24.5,
        description: 'Dynamic electromagnetic induction and wind buffeting from locomotive transit'
      },
      {
        distanceKm: 8.60,
        name: 'Agricultural Canal Irrigation Seepage Leaning Poles',
        type: 'mechanical',
        nominalStrainUstrain: 960,
        nominalTempC: 23.2,
        description: 'Waterlogged ditch embankment pole tilt inducing lateral span pull'
      }
    ]
  },
  {
    id: 'kala-khatai-express',
    name: 'Kala Khatai Highway High-Tension Transmission Span',
    routeCode: 'BOTDA-RTE-04',
    primaryArea: 'Kala Khatai Road',
    secondaryAreas: ['Shahdara Town'],
    cableType: '96-Core G.655 Non-Zero Dispersion Shifted Fiber (NZDSF)',
    lengthKm: 22.4,
    connectedNodes: ['OLT-KalaKhatai', 'FDT-Mill-Express', 'POP-ShahdaraMain'],
    subscribersCount: 510,
    monthlyRevenuePkr: 1720000,
    baselineTempC: 25.0,
    baselineStrainUstrain: 480,
    hotspots: [
      {
        distanceKm: 14.10,
        name: 'Rice Mill Biomass Boiler Exhaust Proximity Span',
        type: 'thermal',
        nominalStrainUstrain: 520,
        nominalTempC: 43.5,
        description: 'Direct boiler convective exhaust plume heating aerial fiber bundle'
      }
    ]
  },
  {
    id: 'shahdara-town-metro',
    name: 'Shahdara Town Dense Commercial Metro Loop',
    routeCode: 'BOTDA-RTE-05',
    primaryArea: 'Shahdara Town',
    secondaryAreas: ['Baradari', 'Begum Kot'],
    cableType: '288-Core High-Density Microduct Blown Fiber',
    lengthKm: 9.6,
    connectedNodes: ['OLT-TownHall', 'FDT-MainBazaar', 'FDT-CommercialSquare', 'POP-Baradari'],
    subscribersCount: 860,
    monthlyRevenuePkr: 2850000,
    baselineTempC: 22.0,
    baselineStrainUstrain: 410,
    hotspots: [
      {
        distanceKm: 2.10,
        name: 'Main Bazaar Congested Utility Pole Clutter',
        type: 'mechanical',
        nominalStrainUstrain: 690,
        nominalTempC: 24.0,
        description: 'Multiple third-party drop cables and power lines resting on ISP fiber span'
      }
    ]
  }
];

/**
 * Calculates spatial resolution in meters from pump pulse width
 * Delta_z = (c * tau) / (2 * n_g)
 * @param {number} pulseWidthNs - Laser pump pulse width in nanoseconds
 * @returns {number} Spatial resolution in meters
 */
export function calculateSpatialResolutionMeters(pulseWidthNs) {
  const tauSeconds = (pulseWidthNs || BOTDA_CONSTANTS.DEFAULT_PUMP_PULSE_NS) * 1e-9;
  const resolution = (BOTDA_CONSTANTS.SPEED_OF_LIGHT_MS * tauSeconds) / (2 * BOTDA_CONSTANTS.GROUP_INDEX_NG);
  return Math.round(resolution * 100) / 100;
}

/**
 * Calculates Brillouin Frequency Shift (BFS) in MHz from temperature and strain
 * Delta_nu_B = C_T * (T - T_0) + C_e * epsilon
 * @param {number} tempC - Temperature in Celsius
 * @param {number} strainUstrain - Mechanical strain in microstrain (ue)
 * @returns {Object} Frequency components
 */
export function calculateBfsShiftMhz(tempC, strainUstrain) {
  const deltaT = (Number(tempC) || BOTDA_CONSTANTS.BASELINE_TEMP_C) - BOTDA_CONSTANTS.BASELINE_TEMP_C;
  const strain = Math.max(0, Number(strainUstrain) || 0);

  const thermalShiftMhz = deltaT * BOTDA_CONSTANTS.TEMP_COEFF_MHZ_PER_C;
  const strainShiftMhz = strain * BOTDA_CONSTANTS.STRAIN_COEFF_MHZ_PER_USTRAIN;
  const totalShiftMhz = thermalShiftMhz + strainShiftMhz;
  const absoluteBfsGhz = BOTDA_CONSTANTS.BASELINE_BFS_GHZ + (totalShiftMhz / 1000);

  return {
    thermalShiftMhz: Math.round(thermalShiftMhz * 100) / 100,
    strainShiftMhz: Math.round(strainShiftMhz * 100) / 100,
    totalShiftMhz: Math.round(totalShiftMhz * 100) / 100,
    absoluteBfsGhz: Math.round(absoluteBfsGhz * 10000) / 10000
  };
}

/**
 * Evaluates convolved Brillouin Gain Spectrum (BGS) linewidth (FWHM)
 * Broadens as pump pulse width narrows below acoustic phonon lifetime (~10ns)
 * @param {number} pulseWidthNs - Laser pump pulse duration in ns
 * @returns {number} Effective convolved FWHM in MHz
 */
export function calculateBgsLinewidthMhz(pulseWidthNs) {
  const tau = Math.max(5, Number(pulseWidthNs) || BOTDA_CONSTANTS.DEFAULT_PUMP_PULSE_NS);
  // Convolution approximation: Delta_nu_eff = sqrt(Delta_nu_0^2 + (1.2 / tau)^2)
  const pulseBroadeningMhz = 1200 / tau;
  const convolvedFwhmMhz = Math.sqrt(Math.pow(BOTDA_CONSTANTS.NATURAL_FWHM_MHZ, 2) + Math.pow(pulseBroadeningMhz, 2));
  return Math.round(convolvedFwhmMhz * 10) / 10;
}

/**
 * Calculates BOTDA sensing dynamics, hotspot detection, and structural integrity
 * @param {Object} route - Shahdara route definition
 * @param {Object} overrides - Interactive simulation parameters
 * @returns {Object} Calculated sensing dynamics and telemetry
 */
export function calculateBotdaDynamics(route, overrides = {}) {
  const r = route || SHAHDARA_BOTDA_ROUTES[0];

  const pumpPulseNs = overrides.pumpPulseNs !== undefined
    ? Number(overrides.pumpPulseNs)
    : BOTDA_CONSTANTS.DEFAULT_PUMP_PULSE_NS;

  const tempOffsetC = overrides.tempOffsetC !== undefined
    ? Number(overrides.tempOffsetC)
    : 0;

  const strainOffsetUstrain = overrides.strainOffsetUstrain !== undefined
    ? Number(overrides.strainOffsetUstrain)
    : 0;

  const spatialResolutionM = calculateSpatialResolutionMeters(pumpPulseNs);
  const convolvedLinewidthMhz = calculateBgsLinewidthMhz(pumpPulseNs);

  const effectiveRouteTempC = Math.round((r.baselineTempC + tempOffsetC) * 10) / 10;
  const effectiveRouteStrainUstrain = Math.max(0, Math.round(r.baselineStrainUstrain + strainOffsetUstrain));

  const baselineBfs = calculateBfsShiftMhz(effectiveRouteTempC, effectiveRouteStrainUstrain);

  // Evaluate Hotspots along the fiber path
  let maxStrainObserved = effectiveRouteStrainUstrain;
  let maxTempObserved = effectiveRouteTempC;
  let worstHotspot = null;

  const evaluatedHotspots = (r.hotspots || []).map(hs => {
    const hsTempC = Math.round((hs.nominalTempC + tempOffsetC) * 10) / 10;
    const hsStrainUstrain = Math.max(0, Math.round(hs.nominalStrainUstrain + strainOffsetUstrain));
    const hsBfs = calculateBfsShiftMhz(hsTempC, hsStrainUstrain);

    if (hsStrainUstrain > maxStrainObserved) {
      maxStrainObserved = hsStrainUstrain;
      worstHotspot = hs.name;
    }
    if (hsTempC > maxTempObserved) {
      maxTempObserved = hsTempC;
    }

    const isStrainCritical = hsStrainUstrain >= BOTDA_CONSTANTS.CRITICAL_STRAIN_THRESHOLD_USTRAIN;
    const isStrainCaution = !isStrainCritical && hsStrainUstrain >= BOTDA_CONSTANTS.SAFE_STRAIN_THRESHOLD_USTRAIN;
    const isThermalWarning = hsTempC >= 40.0;

    return {
      distanceKm: hs.distanceKm,
      name: hs.name,
      type: hs.type,
      tempC: hsTempC,
      strainUstrain: hsStrainUstrain,
      bfsShiftMhz: hsBfs.totalShiftMhz,
      absoluteBfsGhz: hsBfs.absoluteBfsGhz,
      isStrainCritical,
      isStrainCaution,
      isThermalWarning,
      description: hs.description
    };
  });

  // Calculate Cumulative Round-Trip Optical Loss & SNR
  const totalOpticalLossDb = Math.round(r.lengthKm * BOTDA_CONSTANTS.FIBBER_ATTENUATION_DB_PER_KM * 100) / 100;
  const endOfFiberSnrDb = Math.max(12.0, Math.round((35.0 - (2 * totalOpticalLossDb)) * 10) / 10);

  // Structural Safety Ratio & Weibull Mechanical Fatigue Lifespan
  // Safe limit: 2000 ue (0.2%). Microcrack growth accelerates exponentially above 0.2%
  const strainUtilizationPct = Math.round((maxStrainObserved / BOTDA_CONSTANTS.CRITICAL_STRAIN_THRESHOLD_USTRAIN) * 1000) / 10;
  const proofTestRatioPct = Math.round((maxStrainObserved / BOTDA_CONSTANTS.PROOF_TEST_STRAIN_USTRAIN) * 1000) / 10;

  let estimatedLifespanYears = 30.0;
  let status = BOTDA_CONSTANTS.STATUS.OPTIMAL;
  let statusColor = '#10b981';
  let penaltyRebatePct = 0;

  if (maxStrainObserved >= BOTDA_CONSTANTS.CRITICAL_STRAIN_THRESHOLD_USTRAIN) {
    status = BOTDA_CONSTANTS.STATUS.CRITICAL;
    statusColor = '#ef4444';
    estimatedLifespanYears = Math.max(0.5, Math.round((2.0 * Math.pow(BOTDA_CONSTANTS.CRITICAL_STRAIN_THRESHOLD_USTRAIN / maxStrainObserved, 18)) * 10) / 10);
    penaltyRebatePct = 25;
  } else if (maxStrainObserved >= BOTDA_CONSTANTS.SAFE_STRAIN_THRESHOLD_USTRAIN) {
    status = BOTDA_CONSTANTS.STATUS.ELEVATED_STRAIN;
    statusColor = '#f59e0b';
    estimatedLifespanYears = Math.round((12.0 * Math.pow(BOTDA_CONSTANTS.SAFE_STRAIN_THRESHOLD_USTRAIN / maxStrainObserved, 10)) * 10) / 10;
    penaltyRebatePct = 10;
  } else if (maxTempObserved >= 40.0) {
    status = BOTDA_CONSTANTS.STATUS.THERMAL_ANOMALY;
    statusColor = '#f97316';
    estimatedLifespanYears = 20.0;
    penaltyRebatePct = 5;
  }

  const penaltyPkr = Math.round((r.monthlyRevenuePkr * penaltyRebatePct) / 100);
  const dailyRevenueAtRiskPkr = Math.round(r.monthlyRevenuePkr / 30);

  return {
    routeId: r.id,
    routeName: r.name,
    routeCode: r.routeCode,
    primaryArea: r.primaryArea,
    secondaryAreas: r.secondaryAreas || [],
    cableType: r.cableType,
    lengthKm: r.lengthKm,
    connectedNodes: r.connectedNodes || [],
    subscribersCount: r.subscribersCount,
    monthlyRevenuePkr: r.monthlyRevenuePkr,

    // Controls & Settings
    pumpPulseNs,
    spatialResolutionM,
    convolvedLinewidthMhz,
    tempOffsetC,
    strainOffsetUstrain,

    // Fiber State
    effectiveRouteTempC,
    effectiveRouteStrainUstrain,
    baselineBfs,
    maxStrainObserved,
    maxTempObserved,
    worstHotspot,
    evaluatedHotspots,

    // Optical Quality
    totalOpticalLossDb,
    endOfFiberSnrDb,

    // Structural Health & SLA
    strainUtilizationPct,
    proofTestRatioPct,
    estimatedLifespanYears,
    status,
    statusColor,
    penaltyRebatePct,
    penaltyPkr,
    dailyRevenueAtRiskPkr
  };
}

/**
 * Aggregates BOTDA telemetry across all Shahdara fiber routes
 * @param {Array} routes - List of routes
 * @param {Object} state - Application state
 * @returns {Object} Fleet metrics
 */
export function calculateBotdaMetrics(routes = SHAHDARA_BOTDA_ROUTES, state = {}) {
  const routeList = Array.isArray(routes) && routes.length > 0 ? routes : SHAHDARA_BOTDA_ROUTES;

  let totalLengthKm = 0;
  let totalSubscribers = 0;
  let totalRevenuePkr = 0;
  let totalHotspotsCount = 0;
  let criticalCount = 0;
  let elevatedCount = 0;
  let optimalCount = 0;
  let totalPenaltiesPkr = 0;
  let sumMaxStrain = 0;

  const evaluatedRoutes = routeList.map(r => {
    const d = calculateBotdaDynamics(r);
    totalLengthKm += d.lengthKm;
    totalSubscribers += d.subscribersCount;
    totalRevenuePkr += d.monthlyRevenuePkr;
    totalHotspotsCount += (d.evaluatedHotspots || []).length;
    sumMaxStrain += d.maxStrainObserved;
    totalPenaltiesPkr += d.penaltyPkr;

    if (d.status === BOTDA_CONSTANTS.STATUS.CRITICAL) criticalCount++;
    else if (d.status === BOTDA_CONSTANTS.STATUS.ELEVATED_STRAIN || d.status === BOTDA_CONSTANTS.STATUS.THERMAL_ANOMALY) elevatedCount++;
    else optimalCount++;

    return d;
  });

  const meanMaxStrain = routeList.length > 0 ? Math.round(sumMaxStrain / routeList.length) : 0;
  const overallIntegrityPct = routeList.length > 0 ? Math.round((optimalCount / routeList.length) * 100) : 100;

  return {
    totalRoutes: routeList.length,
    totalLengthKm: Math.round(totalLengthKm * 10) / 10,
    totalSubscribers,
    totalRevenuePkr,
    totalHotspotsCount,
    optimalCount,
    elevatedCount,
    criticalCount,
    overallIntegrityPct,
    meanMaxStrain,
    totalPenaltiesPkr,
    evaluatedRoutes
  };
}

/**
 * Renders pure vector SVG diagram of Brillouin Gain Spectrum & Distributed Strain Profile
 * @param {Object} dynamics - Route dynamics from calculateBotdaDynamics
 * @param {Object} options - Rendering options (isCompact: boolean)
 * @returns {string} SVG markup string
 */
export function renderBotdaDiagramSvg(dynamics, options = {}) {
  const d = dynamics || calculateBotdaDynamics(SHAHDARA_BOTDA_ROUTES[0]);
  const isCompact = Boolean(options.isCompact);

  if (isCompact) {
    // Compact card SVG: Mini BGS curve + Strain Meter
    const width = 360;
    const height = 150;

    // Lorentzian curve points centered at BFS
    const points = [];
    const peakX = 180;
    const peakY = 30;
    const baseY = 110;
    const gamma = 25; // graphical half-width

    for (let x = 30; x <= 330; x += 10) {
      const dx = x - peakX;
      const lorentzian = 1 / (1 + Math.pow(dx / gamma, 2));
      const y = Math.round(baseY - (baseY - peakY) * lorentzian);
      points.push(`${x},${y}`);
    }

    const statusBadgeColor = d.statusColor || '#10b981';

    return `<svg class="botda-svg botda-compact-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="BOTDA Distributed Sensing Profile">
      <defs>
        <linearGradient id="bgsCompactGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="8" fill="var(--bg-card, #1e293b)" stroke="var(--border, #334155)"/>

      <!-- Grid lines -->
      <line x1="30" y1="40" x2="330" y2="40" stroke="var(--border, #334155)" stroke-dasharray="3,3" opacity="0.6"/>
      <line x1="30" y1="75" x2="330" y2="75" stroke="var(--border, #334155)" stroke-dasharray="3,3" opacity="0.6"/>
      <line x1="30" y1="110" x2="330" y2="110" stroke="var(--border, #475569)"/>

      <!-- BGS Lorentzian Curve Fill & Stroke -->
      <polygon points="30,110 ${points.join(' ')} 330,110" fill="url(#bgsCompactGrad)"/>
      <polyline points="${points.join(' ')}" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>

      <!-- Peak marker -->
      <circle cx="${peakX}" cy="${peakY}" r="4.5" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5"/>
      <line x1="${peakX}" y1="${peakY}" x2="${peakX}" y2="110" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="2,2"/>

      <!-- Center text labels -->
      <text x="${peakX}" y="20" fill="#f59e0b" font-size="10" font-weight="700" text-anchor="middle">BFS Peak: ${d.baselineBfs.absoluteBfsGhz.toFixed(3)} GHz</text>
      <text x="35" y="24" fill="var(--text-muted, #94a3b8)" font-size="9" font-weight="600">ITU-T G.650.2 DTSS</text>
      <text x="325" y="24" fill="${statusBadgeColor}" font-size="9" font-weight="700" text-anchor="end">${d.status}</text>

      <!-- Bottom telemetry metrics row -->
      <rect x="20" y="118" width="95" height="24" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <text x="67" y="128" fill="var(--text-muted, #94a3b8)" font-size="7.5" text-anchor="middle">MAX STRAIN</text>
      <text x="67" y="138" fill="#38bdf8" font-size="9" font-weight="700" text-anchor="middle">${d.maxStrainObserved} µε</text>

      <rect x="125" y="118" width="105" height="24" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <text x="177" y="128" fill="var(--text-muted, #94a3b8)" font-size="7.5" text-anchor="middle">SPATIAL RESOLUTION</text>
      <text x="177" y="138" fill="#a78bfa" font-size="9" font-weight="700" text-anchor="middle">Δz: ${d.spatialResolutionM} m</text>

      <rect x="240" y="118" width="100" height="24" rx="4" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
      <text x="290" y="128" fill="var(--text-muted, #94a3b8)" font-size="7.5" text-anchor="middle">EST. FATIGUE LIFE</text>
      <text x="290" y="138" fill="${d.estimatedLifespanYears > 10 ? '#10b981' : '#f59e0b'}" font-size="9" font-weight="700" text-anchor="middle">${d.estimatedLifespanYears} Yrs</text>
    </svg>`;
  }

  // Expanded detailed SVG diagram for Modal
  const width = 800;
  const height = 440;

  // 1. Top Panel: Lorentzian Brillouin Gain Spectrum (x: 50 to 750, y: 50 to 200)
  const topPoints = [];
  const bgsPeakX = 400 + Math.min(180, Math.max(-180, (d.baselineBfs.totalShiftMhz / 100) * 80));
  const bgsPeakY = 65;
  const bgsBaseY = 180;
  const bgsGamma = Math.max(15, (d.convolvedLinewidthMhz / BOTDA_CONSTANTS.NATURAL_FWHM_MHZ) * 25);

  for (let x = 60; x <= 740; x += 8) {
    const dx = x - bgsPeakX;
    const lorentzian = 1 / (1 + Math.pow(dx / bgsGamma, 2));
    const y = Math.round(bgsBaseY - (bgsBaseY - bgsPeakY) * lorentzian);
    topPoints.push(`${x},${y}`);
  }

  // 2. Bottom Panel: Longitudinal Distributed Strain Profile (x: 60 to 740, y: 250 to 390)
  // Distance scale: 0 to route.lengthKm mapped to 60..740
  const profileBaseY = 380;
  const profilePoints = [];
  const stepCount = 50;
  const routeLen = Math.max(1, d.lengthKm);

  for (let i = 0; i <= stepCount; i++) {
    const fraction = i / stepCount;
    const distKm = fraction * routeLen;
    const x = Math.round(60 + fraction * (740 - 60));

    // Calculate simulated strain along route with local noise and baseline
    let localStrain = d.effectiveRouteStrainUstrain + Math.sin(fraction * Math.PI * 4) * 35;

    // Check proximity to hotspots
    (d.evaluatedHotspots || []).forEach(hs => {
      const distDiff = Math.abs(distKm - hs.distanceKm);
      if (distDiff < 1.2) {
        const peakAdd = (hs.strainUstrain - d.effectiveRouteStrainUstrain);
        localStrain += peakAdd * Math.exp(-Math.pow(distDiff / 0.45, 2));
      }
    });

    // Map strain (0 to 2500 ue) to Y coordinate (380 to 250)
    const strainClamped = Math.max(0, Math.min(2500, localStrain));
    const y = Math.round(profileBaseY - (strainClamped / 2500) * (380 - 250));
    profilePoints.push(`${x},${y}`);
  }

  // Caution threshold line at 1200 ue
  const cautionLineY = Math.round(profileBaseY - (BOTDA_CONSTANTS.SAFE_STRAIN_THRESHOLD_USTRAIN / 2500) * (380 - 250));
  // Critical threshold line at 2000 ue
  const criticalLineY = Math.round(profileBaseY - (BOTDA_CONSTANTS.CRITICAL_STRAIN_THRESHOLD_USTRAIN / 2500) * (380 - 250));

  return `<svg class="botda-svg botda-expanded-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Brillouin Optical Time Domain Distributed Analysis Full Profile">
    <defs>
      <linearGradient id="bgsExpGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.0"/>
      </linearGradient>
      <linearGradient id="strainExpGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#a78bfa" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#a78bfa" stop-opacity="0.0"/>
      </linearGradient>
    </defs>

    <rect width="${width}" height="${height}" rx="10" fill="var(--bg-card, #1e293b)" stroke="var(--border, #334155)"/>

    <!-- TOP PANEL: BRILLOUIN GAIN SPECTRUM (BGS) -->
    <rect x="25" y="20" width="750" height="185" rx="6" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="40" y="42" fill="#38bdf8" font-size="12" font-weight="700">PANEL 1: BRILLOUIN GAIN SPECTRUM (BGS) &amp; FREQUENCY SHIFT</text>
    <text x="755" y="42" fill="var(--text-muted, #94a3b8)" font-size="10" text-anchor="end">Linewidth Δν: ${d.convolvedLinewidthMhz} MHz | Pulse: ${d.pumpPulseNs} ns</text>

    <!-- BGS Grid lines -->
    <line x1="60" y1="90" x2="740" y2="90" stroke="var(--border, #334155)" stroke-dasharray="3,3" opacity="0.6"/>
    <line x1="60" y1="135" x2="740" y2="135" stroke="var(--border, #334155)" stroke-dasharray="3,3" opacity="0.6"/>
    <line x1="60" y1="180" x2="740" y2="180" stroke="var(--border, #475569)"/>

    <!-- BGS Lorentzian Curve -->
    <polygon points="60,180 ${topPoints.join(' ')} 740,180" fill="url(#bgsExpGrad)"/>
    <polyline points="${topPoints.join(' ')}" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>

    <!-- Peak Pointer -->
    <circle cx="${bgsPeakX}" cy="${bgsPeakY}" r="5" fill="#f59e0b" stroke="#ffffff" stroke-width="2"/>
    <line x1="${bgsPeakX}" y1="${bgsPeakY}" x2="${bgsPeakX}" y2="180" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="3,3"/>
    <text x="${bgsPeakX}" y="${bgsPeakY - 8}" fill="#f59e0b" font-size="11" font-weight="700" text-anchor="middle">BFS: ${d.baselineBfs.absoluteBfsGhz.toFixed(4)} GHz (+${d.baselineBfs.totalShiftMhz} MHz)</text>

    <!-- Shift components callout -->
    <rect x="${Math.max(70, Math.min(540, bgsPeakX - 100))}" y="105" width="200" height="36" rx="4" fill="rgba(15, 23, 42, 0.85)" stroke="var(--border, #334155)"/>
    <text x="${Math.max(70, Math.min(540, bgsPeakX - 100)) + 10}" y="120" fill="#38bdf8" font-size="9">Thermal Δν_T: +${d.baselineBfs.thermalShiftMhz} MHz (C_T = 1.07)</text>
    <text x="${Math.max(70, Math.min(540, bgsPeakX - 100)) + 10}" y="133" fill="#a78bfa" font-size="9">Strain Δν_ε: +${d.baselineBfs.strainShiftMhz} MHz (C_ε = 0.048)</text>

    <!-- BOTTOM PANEL: DISTRIBUTED STRAIN PROFILE ALONG FIBER -->
    <rect x="25" y="220" width="750" height="195" rx="6" fill="var(--bg-surface, #0f172a)" stroke="var(--border, #334155)"/>
    <text x="40" y="242" fill="#a78bfa" font-size="12" font-weight="700">PANEL 2: DISTRIBUTED STRAIN &amp; HOTSPOT PROFILE (0 to ${d.lengthKm} km)</text>
    <text x="755" y="242" fill="${d.statusColor}" font-size="10" font-weight="700" text-anchor="end">Status: ${d.status}</text>

    <!-- Threshold Guide Lines -->
    <line x1="60" y1="${criticalLineY}" x2="740" y2="${criticalLineY}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,4"/>
    <text x="742" y="${criticalLineY - 3}" fill="#ef4444" font-size="8.5" font-weight="700" text-anchor="end">CRITICAL 2000 µε (IEC 60794 Limit)</text>

    <line x1="60" y1="${cautionLineY}" x2="740" y2="${cautionLineY}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4,4"/>
    <text x="742" y="${cautionLineY - 3}" fill="#f59e0b" font-size="8.5" font-weight="700" text-anchor="end">CAUTION 1200 µε</text>

    <line x1="60" y1="${profileBaseY}" x2="740" y2="${profileBaseY}" stroke="var(--border, #475569)"/>

    <!-- Strain Profile Area & Curve -->
    <polygon points="60,${profileBaseY} ${profilePoints.join(' ')} 740,${profileBaseY}" fill="url(#strainExpGrad)"/>
    <polyline points="${profilePoints.join(' ')}" fill="none" stroke="#a78bfa" stroke-width="2.5" stroke-linecap="round"/>

    <!-- Hotspot Markers on the bottom profile -->
    ${(d.evaluatedHotspots || []).map(hs => {
      const hsX = Math.round(60 + (hs.distanceKm / routeLen) * (740 - 60));
      const hsY = Math.round(profileBaseY - (Math.min(2500, hs.strainUstrain) / 2500) * (380 - 250));
      const markerColor = hs.isStrainCritical ? '#ef4444' : hs.isStrainCaution ? '#f59e0b' : '#38bdf8';

      return `
        <circle cx="${hsX}" cy="${hsY}" r="5.5" fill="${markerColor}" stroke="#ffffff" stroke-width="1.5"/>
        <line x1="${hsX}" y1="${hsY}" x2="${hsX}" y2="${profileBaseY}" stroke="${markerColor}" stroke-width="1" stroke-dasharray="2,2"/>
        <text x="${hsX}" y="${hsY - 7}" fill="${markerColor}" font-size="8.5" font-weight="700" text-anchor="middle">${hs.distanceKm} km</text>
      `;
    }).join('')}

    <!-- Axis labels -->
    <text x="60" y="398" fill="var(--text-muted, #94a3b8)" font-size="9">0.0 km (${d.connectedNodes[0] || 'Start OLT'})</text>
    <text x="400" y="398" fill="var(--text-muted, #94a3b8)" font-size="9" text-anchor="middle">Longitudinal Optical Distance (km)</text>
    <text x="740" y="398" fill="var(--text-muted, #94a3b8)" font-size="9" text-anchor="end">${d.lengthKm} km (${d.connectedNodes[d.connectedNodes.length - 1] || 'End POP'})</text>

    <!-- Bottom summary row -->
    <text x="40" y="425" fill="var(--text-muted, #94a3b8)" font-size="9.5">Cable: <tspan fill="#e2e8f0" font-weight="600">${d.cableType}</tspan> | Spatial Res Δz: <tspan fill="#38bdf8" font-weight="600">${d.spatialResolutionM} m</tspan> | Max Strain: <tspan fill="${d.maxStrainObserved > 1200 ? '#f59e0b' : '#10b981'}" font-weight="700">${d.maxStrainObserved} µε</tspan> | Max Temp: <tspan fill="#f97316" font-weight="600">${d.maxTempObserved} °C</tspan></text>
  </svg>`;
}

/**
 * Generates plain-text BOTDA optical engineering audit report
 * @param {Object} dynamics - Current route dynamics
 * @param {Object} metrics - Fleet metrics
 * @returns {string} Formatted report text
 */
export function generateBotdaReport(dynamics, metrics) {
  const d = dynamics || calculateBotdaDynamics(SHAHDARA_BOTDA_ROUTES[0]);
  const m = metrics || calculateBotdaMetrics();

  const timestamp = new Date().toISOString();

  const hotspotLines = (d.evaluatedHotspots || []).map((hs, idx) => {
    return `  [${idx + 1}] Distance: ${hs.distanceKm} km | Location: ${hs.name}
      Type: ${hs.type.toUpperCase()} | Temp: ${hs.tempC} °C | Strain: ${hs.strainUstrain} µε
      Brillouin Shift: +${hs.bfsShiftMhz} MHz (Absolute: ${hs.absoluteBfsGhz.toFixed(4)} GHz)
      Status: ${hs.isStrainCritical ? 'CRITICAL EXCURSION' : hs.isStrainCaution ? 'ELEVATED TENSION' : 'COMPLIANT'}
      Details: ${hs.description}`;
  }).join('\n');

  return `================================================================================
SHAHDARA ISP OPTICAL NETWORK OPERATIONS CENTER
BRILLOUIN DISTRIBUTED TEMPERATURE & STRAIN (BOTDA) AUDIT REPORT
Standard Compliance: ITU-T G.650.2 / IEC 60794-1-21 / IEC 61757-1-1
Generated At: ${timestamp}
================================================================================

1. ROUTE OVERVIEW & SPECIFICATIONS:
--------------------------------------------------------------------------------
Route Identifier:        ${d.routeCode} (${d.routeId})
Route Description:       ${d.routeName}
Primary Operational Area:${d.primaryArea}
Secondary Coverage:      ${d.secondaryAreas.join(', ')}
Optical Cable Spec:      ${d.cableType}
Total Route Length:      ${d.lengthKm} km
Connected Optical Nodes: ${d.connectedNodes.join(' -> ')}
Connected Subscribers:   ${d.subscribersCount}
Monthly Revenue:         ${formatPKR(d.monthlyRevenuePkr)}

2. BOTDA SENSING ENGINE PARAMETERS:
--------------------------------------------------------------------------------
Pump Laser Pulse Width:  ${d.pumpPulseNs} ns
Spatial Resolution (Δz): ${d.spatialResolutionM} m ((c * τ) / (2 * n_g))
Convolved BGS Linewidth: ${d.convolvedLinewidthMhz} MHz
Baseline BFS (20°C, 0µε):${BOTDA_CONSTANTS.BASELINE_BFS_GHZ.toFixed(3)} GHz (10,850 MHz)
Temperature Coeff (C_T): ${BOTDA_CONSTANTS.TEMP_COEFF_MHZ_PER_C} MHz / °C
Strain Coeff (C_ε):      ${BOTDA_CONSTANTS.STRAIN_COEFF_MHZ_PER_USTRAIN} MHz / µε
One-Way Optical Loss:    ${d.totalOpticalLossDb} dB (@ 0.20 dB/km)
Far-End SNR Margin:      ${d.endOfFiberSnrDb} dB

3. DISTRIBUTED STRUCTURAL & THERMAL MEASUREMENTS:
--------------------------------------------------------------------------------
Effective Fiber Temp:    ${d.effectiveRouteTempC} °C (Baseline: ${d.baselineBfs.thermalShiftMhz} MHz shift)
Effective Route Strain:  ${d.effectiveRouteStrainUstrain} µε (Baseline: ${d.baselineBfs.strainShiftMhz} MHz shift)
Absolute Baseline BFS:   ${d.baselineBfs.absoluteBfsGhz.toFixed(4)} GHz
Peak Strain Observed:    ${d.maxStrainObserved} µε
Peak Temp Observed:      ${d.maxTempObserved} °C
Strain Utilization:      ${d.strainUtilizationPct}% of IEC 60794-1-21 2000 µε allowable limit
Proof Test Ratio:        ${d.proofTestRatioPct}% of 10,000 µε factory proof stress
Estimated Fatigue Life:  ${d.estimatedLifespanYears} Years
Worst Hotspot Anchor:    ${d.worstHotspot || 'None (Uniform Tension)'}

4. IDENTIFIED LOCALIZED HOTSPOTS & SUSPENSION SPANS:
--------------------------------------------------------------------------------
${hotspotLines || '  No localized strain or thermal anomalies detected along this span.'}

5. RISK EVALUATION, REVENUE IMPACT & SLA PENALTIES:
--------------------------------------------------------------------------------
Operational Status:      ${d.status}
Daily Revenue At Risk:   ${formatPKR(d.dailyRevenueAtRiskPkr)}
SLA Penalty / Rebate:    ${d.penaltyRebatePct}% (${formatPKR(d.penaltyPkr)})

6. NETWORK-WIDE BOTDA FLEET SUMMARY:
--------------------------------------------------------------------------------
Total Routes Monitored:  ${m.totalRoutes}
Total Monitored Length:  ${m.totalLengthKm} km
Total Subscribers:       ${m.totalSubscribers}
Total Monthly Revenue:   ${formatPKR(m.totalRevenuePkr)}
Identified Hotspots:     ${m.totalHotspotsCount}
Optimal Routes:          ${m.optimalCount}
Elevated/Caution Routes: ${m.elevatedCount}
Critical Fatigue Routes: ${m.criticalCount}
Network Mean Max Strain: ${m.meanMaxStrain} µε
Fleet Integrity Score:   ${m.overallIntegrityPct}%
Total Monthly Penalties: ${formatPKR(m.totalPenaltiesPkr)}
================================================================================
END OF BOTDA TELEMETRY AUDIT REPORT`;
}

/**
 * Exports current BOTDA telemetry in structured JSON format
 * @param {Object} dynamics - Current route dynamics
 * @param {Object} metrics - Fleet metrics
 * @returns {string} JSON string
 */
export function exportBotdaJson(dynamics, metrics) {
  const d = dynamics || calculateBotdaDynamics(SHAHDARA_BOTDA_ROUTES[0]);
  const m = metrics || calculateBotdaMetrics();

  return JSON.stringify({
    metadata: {
      generator: 'Shahdara ISP BOTDA DTSS Telemetry Engine',
      standards: ['ITU-T G.650.2', 'IEC 60794-1-21', 'IEC 61757-1-1'],
      exportedAt: new Date().toISOString()
    },
    currentRoute: d,
    fleetSummary: m
  }, null, 2);
}

/**
 * Exports BOTDA route telemetry as RFC 4180 compliant CSV
 * @param {Object} dynamics - Current route dynamics
 * @param {Object} metrics - Fleet metrics
 * @returns {string} CSV text
 */
export function exportBotdaCsv(dynamics, metrics) {
  const routes = SHAHDARA_BOTDA_ROUTES;

  const headers = [
    'Route_Code',
    'Route_Name',
    'Cable_Type',
    'Length_Km',
    'Primary_Area',
    'Subscribers',
    'Monthly_Revenue_PKR',
    'Pulse_Width_ns',
    'Spatial_Res_m',
    'Max_Strain_uE',
    'Max_Temp_C',
    'Strain_Util_Pct',
    'Fatigue_Life_Years',
    'Status',
    'Penalty_PKR'
  ];

  const rows = routes.map(r => {
    const d = calculateBotdaDynamics(r);
    return [
      `"${d.routeCode}"`,
      `"${d.routeName.replace(/"/g, '""')}"`,
      `"${d.cableType.replace(/"/g, '""')}"`,
      d.lengthKm,
      `"${d.primaryArea}"`,
      d.subscribersCount,
      d.monthlyRevenuePkr,
      d.pumpPulseNs,
      d.spatialResolutionM,
      d.maxStrainObserved,
      d.maxTempObserved,
      d.strainUtilizationPct,
      d.estimatedLifespanYears,
      `"${d.status}"`,
      d.penaltyPkr
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Modal and Dashboard Card Controller for BOTDA DTSS Telemetry
 * @param {Object} state - Application state
 * @param {Object} options - Controller options (document, onFilterArea, onToast)
 * @returns {Object} Controller interface
 */
export function setupBotdaModal(state, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const modal = doc.getElementById('dashboardBotdaModal');
  const closeBtn = doc.getElementById('dashboardBotdaModalCloseBtn');
  const openBtn = doc.getElementById('dashboardOpenBotdaModalBtn');

  const cardChartContainer = doc.getElementById('dashboardBotdaChart');
  const modalDiagramContainer = doc.getElementById('botdaModalDiagramContainer');

  // Input Controls
  const routeSelect = doc.getElementById('botdaRouteSelect');
  const pulseSlider = doc.getElementById('botdaPulseSlider');
  const pulseLabel = doc.getElementById('botdaPulseLabel');
  const strainSlider = doc.getElementById('botdaStrainSlider');
  const strainLabel = doc.getElementById('botdaStrainLabel');
  const tempSlider = doc.getElementById('botdaTempSlider');
  const tempLabel = doc.getElementById('botdaTempLabel');
  const resetBtn = doc.getElementById('botdaResetBtn');

  // Stat Labels
  const statStatus = doc.getElementById('botdaStatStatus');
  const statBfs = doc.getElementById('botdaStatBfs');
  const statMaxStrain = doc.getElementById('botdaStatMaxStrain');
  const statSpatialRes = doc.getElementById('botdaStatSpatialRes');
  const statFatigueLife = doc.getElementById('botdaStatFatigueLife');
  const statPenalty = doc.getElementById('botdaStatPenalty');

  // Action Buttons
  const filterAreaBtn = doc.getElementById('botdaFilterAreaBtn');
  const exportJsonBtn = doc.getElementById('botdaExportJsonBtn');
  const exportCsvBtn = doc.getElementById('botdaExportCsvBtn');
  const copyReportBtn = doc.getElementById('botdaCopyReportBtn');

  let currentRouteId = BOTDA_CONSTANTS.DEFAULT_ROUTE_ID;
  let customPulse = null;
  let customStrain = null;
  let customTemp = null;

  function getCurrentRoute() {
    return SHAHDARA_BOTDA_ROUTES.find(r => r.id === currentRouteId) || SHAHDARA_BOTDA_ROUTES[0];
  }

  function getCalculatedDynamics() {
    const r = getCurrentRoute();
    return calculateBotdaDynamics(r, {
      pumpPulseNs: customPulse !== null ? customPulse : BOTDA_CONSTANTS.DEFAULT_PUMP_PULSE_NS,
      strainOffsetUstrain: customStrain !== null ? customStrain : 0,
      tempOffsetC: customTemp !== null ? customTemp : 0
    });
  }

  function updateUi() {
    const dynamics = getCalculatedDynamics();
    const allMetrics = calculateBotdaMetrics(SHAHDARA_BOTDA_ROUTES, state);

    // Update Card Chart if present
    if (cardChartContainer) {
      cardChartContainer.innerHTML = renderBotdaDiagramSvg(dynamics, { isCompact: true });
    }

    // Update Modal Diagram if present
    if (modalDiagramContainer) {
      modalDiagramContainer.innerHTML = renderBotdaDiagramSvg(dynamics, { isCompact: false });
    }

    // Update KPI Stat Elements
    if (statStatus) {
      statStatus.textContent = dynamics.status;
      statStatus.style.color = dynamics.statusColor;
    }
    if (statBfs) {
      statBfs.textContent = `${dynamics.baselineBfs.absoluteBfsGhz.toFixed(3)} GHz`;
      statBfs.style.color = '#38bdf8';
    }
    if (statMaxStrain) {
      statMaxStrain.textContent = `${dynamics.maxStrainObserved} µε (${dynamics.strainUtilizationPct}%)`;
      statMaxStrain.style.color = dynamics.maxStrainObserved > 1200 ? '#f59e0b' : '#10b981';
    }
    if (statSpatialRes) {
      statSpatialRes.textContent = `${dynamics.spatialResolutionM} m (Δz)`;
      statSpatialRes.style.color = '#a78bfa';
    }
    if (statFatigueLife) {
      statFatigueLife.textContent = `${dynamics.estimatedLifespanYears} Years`;
      statFatigueLife.style.color = dynamics.estimatedLifespanYears > 10 ? '#10b981' : '#ef4444';
    }
    if (statPenalty) {
      statPenalty.textContent = `${dynamics.penaltyRebatePct}% (${formatPKR(dynamics.penaltyPkr)})`;
      statPenalty.style.color = dynamics.penaltyPkr > 0 ? '#ef4444' : '#10b981';
    }

    // Update Slider Labels
    if (pulseLabel) pulseLabel.textContent = `${dynamics.pumpPulseNs} ns (${dynamics.spatialResolutionM} m)`;
    if (strainLabel) strainLabel.textContent = `${dynamics.strainOffsetUstrain >= 0 ? '+' : ''}${dynamics.strainOffsetUstrain} µε`;
    if (tempLabel) tempLabel.textContent = `${dynamics.tempOffsetC >= 0 ? '+' : ''}${dynamics.tempOffsetC} °C`;
  }

  function syncControls() {
    const r = getCurrentRoute();
    if (routeSelect) routeSelect.value = r.id;
    if (pulseSlider) pulseSlider.value = String(customPulse !== null ? customPulse : BOTDA_CONSTANTS.DEFAULT_PUMP_PULSE_NS);
    if (strainSlider) strainSlider.value = String(customStrain !== null ? customStrain : 0);
    if (tempSlider) tempSlider.value = String(customTemp !== null ? customTemp : 0);
    updateUi();
  }

  // Event Listeners
  if (routeSelect) {
    routeSelect.addEventListener('change', () => {
      currentRouteId = routeSelect.value;
      customPulse = null;
      customStrain = null;
      customTemp = null;
      syncControls();
    });
  }

  if (pulseSlider) {
    pulseSlider.addEventListener('input', () => {
      customPulse = Number(pulseSlider.value);
      updateUi();
    });
  }

  if (strainSlider) {
    strainSlider.addEventListener('input', () => {
      customStrain = Number(strainSlider.value);
      updateUi();
    });
  }

  if (tempSlider) {
    tempSlider.addEventListener('input', () => {
      customTemp = Number(tempSlider.value);
      updateUi();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      customPulse = null;
      customStrain = null;
      customTemp = null;
      syncControls();
      if (typeof options.onToast === 'function') {
        options.onToast('BOTDA sensing parameters reset to baseline.');
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
      const r = getCurrentRoute();
      if (modal && typeof modal.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(r.primaryArea);
      }
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const dynamics = getCalculatedDynamics();
      const allMetrics = calculateBotdaMetrics(SHAHDARA_BOTDA_ROUTES, state);
      const json = exportBotdaJson(dynamics, allMetrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(json).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('BOTDA JSON telemetry copied to clipboard.');
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const dynamics = getCalculatedDynamics();
      const allMetrics = calculateBotdaMetrics(SHAHDARA_BOTDA_ROUTES, state);
      const csv = exportBotdaCsv(dynamics, allMetrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(csv).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('BOTDA CSV telemetry copied to clipboard.');
      }
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const dynamics = getCalculatedDynamics();
      const allMetrics = calculateBotdaMetrics(SHAHDARA_BOTDA_ROUTES, state);
      const report = generateBotdaReport(dynamics, allMetrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(report).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('BOTDA audit report copied to clipboard.');
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
    getMetrics: () => calculateBotdaMetrics(SHAHDARA_BOTDA_ROUTES, state)
  };
}
