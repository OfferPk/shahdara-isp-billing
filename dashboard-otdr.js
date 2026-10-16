import { formatPKR } from './core.js';

/**
 * Optical Time Domain Reflectometer (OTDR) Fiber Fault Locator & Break Distance Estimator
 * Models optical backscattering, Fresnel reflections, and attenuation profiles across
 * Shahdara ISP distribution feeder lines. Correlates localized subscriber drops with
 * estimated physical break coordinates, geographic landmarks, and splicing crew dispatch.
 */

export const SHAHDARA_FIBER_ROUTES = [
  {
    id: 'saeed-park-feeder',
    name: 'Saeed Park Feeder (Trunk Alpha)',
    primaryArea: 'Saeed Park',
    aliasAreas: ['Saeed Park', 'Tariq Road', 'Gali 5'],
    totalDistanceMeters: 2400,
    coreCount: 96,
    fiberType: 'G.652D Single-Mode',
    launchPowerDbm: 2.5,
    rxSensitivityDbm: -28.0,
    defaultFaultMeters: 1420,
    defaultFaultLandmark: 'Pole #SP-28, Opposite Jamia Masjid, Saeed Park',
    opticalEvents: [
      { id: 'ev-1', distanceMeters: 0, type: 'Launch Connector', lossDb: 0.35, reflectanceDb: -48.2, landmark: 'OLT Port 01/04, Central Station Hub' },
      { id: 'ev-2', distanceMeters: 620, type: 'Fusion Splice', lossDb: 0.08, reflectanceDb: -62.0, landmark: 'Manhole #SP-04, Circular Road Jn' },
      { id: 'ev-3', distanceMeters: 1100, type: 'Optical Splitter (1:8 FDT)', lossDb: 10.45, reflectanceDb: -55.0, landmark: 'FDT Cabinet #01, Near Jamia Masjid Saeed Park' },
      { id: 'ev-4', distanceMeters: 1750, type: 'Fusion Splice Enclosure', lossDb: 0.12, reflectanceDb: -60.0, landmark: 'Pole #SP-26, Tariq Road Crossing' },
      { id: 'ev-5', distanceMeters: 2050, type: 'Optical Splitter (1:16 FAT)', lossDb: 13.80, reflectanceDb: -54.0, landmark: 'FAT Box #SP-08, Gali #05 Corner' }
    ]
  },
  {
    id: 'wandala-trunk',
    name: 'Wandala Road Main Trunk',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Wandala Road', 'Vandala Road', 'Zia Town'],
    totalDistanceMeters: 3800,
    coreCount: 48,
    fiberType: 'G.652D Single-Mode',
    launchPowerDbm: 3.0,
    rxSensitivityDbm: -28.0,
    defaultFaultMeters: 2150,
    defaultFaultLandmark: 'Pole #WND-18, Phatak Rd near Railway Mast #14',
    opticalEvents: [
      { id: 'ev-1', distanceMeters: 0, type: 'Launch Connector', lossDb: 0.30, reflectanceDb: -50.0, landmark: 'OLT Port 02/01, Main Exchange ODF' },
      { id: 'ev-2', distanceMeters: 950, type: 'Fusion Splice', lossDb: 0.09, reflectanceDb: -63.5, landmark: 'Railway Track Crossing Mast #14' },
      { id: 'ev-3', distanceMeters: 1820, type: 'Splice Joint Closure', lossDb: 0.15, reflectanceDb: -58.0, landmark: 'Underground Chamber #WND-02, Phatak Rd' },
      { id: 'ev-4', distanceMeters: 2900, type: 'Optical Splitter (1:8 FDT)', lossDb: 10.50, reflectanceDb: -56.0, landmark: 'FDT #03, Wandala Chowk High School' },
      { id: 'ev-5', distanceMeters: 3600, type: 'Optical Splitter (1:16 FAT)', lossDb: 13.90, reflectanceDb: -53.5, landmark: 'FAT #WND-12, Near Water Filtration Plant' }
    ]
  },
  {
    id: 'jia-musa-ring',
    name: 'Jia Musa Distribution Ring',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Ghazi Park'],
    totalDistanceMeters: 3100,
    coreCount: 48,
    fiberType: 'G.652D Single-Mode',
    launchPowerDbm: 2.8,
    rxSensitivityDbm: -28.0,
    defaultFaultMeters: 1680,
    defaultFaultLandmark: 'Chamber #JM-07, Ghazi Park Turn near Old Bazaar',
    opticalEvents: [
      { id: 'ev-1', distanceMeters: 0, type: 'Launch Connector', lossDb: 0.32, reflectanceDb: -49.0, landmark: 'OLT Port 01/02, Central Station Hub' },
      { id: 'ev-2', distanceMeters: 800, type: 'Fusion Splice', lossDb: 0.07, reflectanceDb: -64.0, landmark: 'Pole #JM-12, Main Bazaar Entry' },
      { id: 'ev-3', distanceMeters: 1450, type: 'Splice Enclosure', lossDb: 0.11, reflectanceDb: -61.0, landmark: 'Chamber #JM-05, Ghazi Park Turn' },
      { id: 'ev-4', distanceMeters: 2300, type: 'Optical Splitter (1:8 FDT)', lossDb: 10.60, reflectanceDb: -55.5, landmark: 'FDT #JM-02, Near Commercial Market' }
    ]
  },
  {
    id: 'baradari-branch',
    name: 'Baradari Road / Riverfront Feeder',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Ravi Riverfront'],
    totalDistanceMeters: 2100,
    coreCount: 24,
    fiberType: 'G.652D Single-Mode',
    launchPowerDbm: 2.0,
    rxSensitivityDbm: -28.0,
    defaultFaultMeters: 1120,
    defaultFaultLandmark: 'Pole #BR-14, Old Toll Plaza Rd near Riverfront',
    opticalEvents: [
      { id: 'ev-1', distanceMeters: 0, type: 'Launch Connector', lossDb: 0.28, reflectanceDb: -51.0, landmark: 'OLT Port 03/01, Main Exchange ODF' },
      { id: 'ev-2', distanceMeters: 750, type: 'Fusion Splice', lossDb: 0.06, reflectanceDb: -65.0, landmark: 'Pole #BR-09, Old Toll Plaza Rd' },
      { id: 'ev-3', distanceMeters: 1400, type: 'Optical Splitter (1:8 FDT)', lossDb: 10.40, reflectanceDb: -56.0, landmark: 'FDT #BR-01, Baradari Monument Gate' }
    ]
  },
  {
    id: 'shahdara-town-feeder',
    name: 'Shahdara Town High Density Feeder',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Shahdara Chowk', 'Begum Kot'],
    totalDistanceMeters: 3500,
    coreCount: 96,
    fiberType: 'G.652D Single-Mode',
    launchPowerDbm: 3.2,
    rxSensitivityDbm: -28.0,
    defaultFaultMeters: 2450,
    defaultFaultLandmark: 'FDT Enclosure #ST-05, Government College Road',
    opticalEvents: [
      { id: 'ev-1', distanceMeters: 0, type: 'Launch Connector', lossDb: 0.34, reflectanceDb: -48.0, landmark: 'OLT Port 02/03, Central Station Hub' },
      { id: 'ev-2', distanceMeters: 1150, type: 'Fusion Splice Enclosure', lossDb: 0.10, reflectanceDb: -62.0, landmark: 'Chamber #ST-01, Post Office Chowk' },
      { id: 'ev-3', distanceMeters: 2100, type: 'Optical Splitter (1:8 FDT)', lossDb: 10.55, reflectanceDb: -55.0, landmark: 'FDT #ST-04, Government College Road' },
      { id: 'ev-4', distanceMeters: 2950, type: 'Optical Splitter (1:16 FAT)', lossDb: 13.85, reflectanceDb: -54.0, landmark: 'FAT #ST-11, Begum Kot Boundary' }
    ]
  }
];

let selectedOtdrRouteId = 'saeed-park-feeder';
let selectedOtdrWavelength = 1310;
let simulatedOtdrDistance = null;

export function getOtdrSelectedRoute() {
  return selectedOtdrRouteId;
}

export function setOtdrSelectedRoute(routeId) {
  if (SHAHDARA_FIBER_ROUTES.some(r => r.id === routeId)) {
    selectedOtdrRouteId = routeId;
  }
}

export function getOtdrWavelength() {
  return selectedOtdrWavelength;
}

export function setOtdrWavelength(wavelength) {
  const wl = Number(wavelength);
  if (wl === 1310 || wl === 1550) {
    selectedOtdrWavelength = wl;
  }
}

export function getOtdrSimulatedDistance() {
  return simulatedOtdrDistance;
}

export function setOtdrSimulatedDistance(dist) {
  if (dist === null || dist === undefined) {
    simulatedOtdrDistance = null;
  } else {
    const num = Number(dist);
    simulatedOtdrDistance = isNaN(num) ? null : Math.max(0, num);
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
 * Calculates OTDR fiber fault metrics, optical loss profiles, and affected customer impact.
 */
export function calculateOtdrFaultMetrics(state, options = {}) {
  const wavelength = Number(options.wavelength || selectedOtdrWavelength || 1310);
  const routeId = options.routeId || selectedOtdrRouteId || 'saeed-park-feeder';
  const customDistance = options.simulatedDistance !== undefined ? options.simulatedDistance : simulatedOtdrDistance;

  // Fiber attenuation rate in dB/meter
  // 1310nm = 0.35 dB/km = 0.00035 dB/m
  // 1550nm = 0.20 dB/km = 0.00020 dB/m
  const attenuationRateDbPerM = wavelength === 1550 ? 0.00020 : 0.00035;

  const customers = Array.isArray(state?.customers) ? state.customers.filter(c => !c.archived) : [];

  let totalRoutesMonitored = SHAHDARA_FIBER_ROUTES.length;
  let totalFiberMeters = 0;
  let routesWithBreaks = 0;
  let totalAffectedSubscribers = 0;
  let totalAtRiskRevenue = 0;

  const routes = SHAHDARA_FIBER_ROUTES.map(def => {
    totalFiberMeters += def.totalDistanceMeters;

    // Match customers belonging to this route
    const normPrimary = (def.primaryArea || '').toLowerCase().trim();
    const aliasSet = new Set((def.aliasAreas || []).map(a => a.toLowerCase().trim()));
    aliasSet.add(normPrimary);

    const matchedSubs = customers.filter(c => {
      const area = (c.area || '').toLowerCase().trim();
      return aliasSet.has(area) || area.includes(normPrimary);
    });

    const totalSubs = matchedSubs.length;
    const offlineSubs = matchedSubs.filter(c => {
      const s = String(c.manualStatus || c.status || '').toLowerCase();
      return s === 'offline';
    });

    const offlineCount = offlineSubs.length;
    const activeCount = totalSubs - offlineCount;
    const offlineRate = totalSubs > 0 ? Math.round((offlineCount / totalSubs) * 100) : 0;

    let routeAtRiskPkr = 0;
    for (const sub of offlineSubs) {
      const billDue = sub.bills?.length ? Number(sub.bills[sub.bills.length - 1].dueAmount || sub.bills[sub.bills.length - 1].amount || 0) : 0;
      const nominalPrice = Number(sub.packagePrice || sub.price || 1500);
      routeAtRiskPkr += (billDue > 0 ? billDue : nominalPrice);
    }

    // Determine if this route has a break or fault
    let hasFault = false;
    let faultType = 'None';
    let faultDistanceMeters = null;
    let faultLandmark = '';
    let faultStatusLabel = 'NORMAL LINK CONTINUITY';
    let faultBadgeClass = 'badge-success';
    let faultSeverity = 'optimal';

    const isCurrentSelected = def.id === routeId;

    if (isCurrentSelected && customDistance !== null && customDistance > 0 && customDistance < def.totalDistanceMeters) {
      // Manual slider simulation active
      hasFault = true;
      faultType = 'Simulated Fiber Cut';
      faultDistanceMeters = Math.round(customDistance);
      faultLandmark = `Simulated Optical Break Point (~${faultDistanceMeters}m from OLT Hub)`;
      faultStatusLabel = 'CRITICAL BREAK (Simulated Cut)';
      faultBadgeClass = 'badge-danger';
      faultSeverity = 'critical';
    } else if (offlineCount >= 2 && (offlineRate >= 15 || offlineCount >= 3)) {
      // Automatic detection: concentrated offline cluster indicates trunk/distribution cut
      hasFault = true;
      faultType = 'Critical Fiber Cut';
      faultDistanceMeters = def.defaultFaultMeters;
      faultLandmark = def.defaultFaultLandmark;
      faultStatusLabel = 'CRITICAL FIBER BREAK (Signal Cut)';
      faultBadgeClass = 'badge-danger';
      faultSeverity = 'critical';
    } else if (offlineCount === 1) {
      // Single subscriber issue: high loss macrobend / drop pinch
      hasFault = true;
      faultType = 'Macrobend / Local Drop Pinch';
      faultDistanceMeters = Math.min(def.totalDistanceMeters - 150, Math.round(def.defaultFaultMeters * 1.15));
      faultLandmark = `Secondary Drop Span near ${def.primaryArea} FAT Terminal`;
      faultStatusLabel = 'WARNING: High Attenuation / Macrobend';
      faultBadgeClass = 'badge-warning';
      faultSeverity = 'warning';
    }

    if (hasFault && faultSeverity === 'critical') {
      routesWithBreaks++;
      totalAffectedSubscribers += offlineCount;
      totalAtRiskRevenue += routeAtRiskPkr;
    }

    // Construct events array including fault event if present
    const events = [];
    let cumulativeLossDb = 0;
    let isSignalCut = false;

    // Baseline launch event
    events.push({
      ...def.opticalEvents[0],
      cumulativeLossDb: Number(def.opticalEvents[0].lossDb.toFixed(2)),
      powerLevelDbm: Number((def.launchPowerDbm - def.opticalEvents[0].lossDb).toFixed(2))
    });
    cumulativeLossDb += def.opticalEvents[0].lossDb;

    // Intermediate events
    const baseEvents = def.opticalEvents.slice(1);
    let faultInserted = false;

    for (const ev of baseEvents) {
      if (hasFault && !faultInserted && faultDistanceMeters <= ev.distanceMeters) {
        // Insert fault event before this event
        const distFromPrev = faultDistanceMeters - (events[events.length - 1].distanceMeters || 0);
        const spanFiberLoss = distFromPrev * attenuationRateDbPerM;
        cumulativeLossDb += spanFiberLoss;

        if (faultSeverity === 'critical') {
          // Fresnel reflection peak & catastrophic signal loss to noise floor
          const breakLossDb = 35.0;
          cumulativeLossDb += breakLossDb;
          isSignalCut = true;

          events.push({
            id: 'ev-fault-cut',
            distanceMeters: faultDistanceMeters,
            type: '⚡ Critical Fiber Break (Severed Core)',
            lossDb: breakLossDb,
            reflectanceDb: -14.2,
            landmark: faultLandmark,
            cumulativeLossDb: Number(cumulativeLossDb.toFixed(2)),
            powerLevelDbm: -38.0,
            isFault: true,
            severity: 'critical'
          });
        } else {
          // Macrobend: wavelength sensitive loss (much higher at 1550nm)
          const bendLossDb = wavelength === 1550 ? 4.8 : 1.4;
          cumulativeLossDb += bendLossDb;

          events.push({
            id: 'ev-fault-bend',
            distanceMeters: faultDistanceMeters,
            type: '⚠️ High Tension Macrobend / Optical Pinch',
            lossDb: bendLossDb,
            reflectanceDb: -42.0,
            landmark: faultLandmark,
            cumulativeLossDb: Number(cumulativeLossDb.toFixed(2)),
            powerLevelDbm: Number((def.launchPowerDbm - cumulativeLossDb).toFixed(2)),
            isFault: true,
            severity: 'warning'
          });
        }
        faultInserted = true;
      }

      if (isSignalCut) {
        // Subsequent events are unreached by light
        events.push({
          ...ev,
          unreachable: true,
          cumulativeLossDb: 40.0,
          powerLevelDbm: -38.0
        });
      } else {
        const distFromPrev = ev.distanceMeters - events[events.length - 1].distanceMeters;
        const spanFiberLoss = distFromPrev * attenuationRateDbPerM;
        cumulativeLossDb += (spanFiberLoss + ev.lossDb);

        events.push({
          ...ev,
          cumulativeLossDb: Number(cumulativeLossDb.toFixed(2)),
          powerLevelDbm: Number((def.launchPowerDbm - cumulativeLossDb).toFixed(2))
        });
      }
    }

    if (hasFault && !faultInserted) {
      // Fault is beyond the last event
      const distFromPrev = faultDistanceMeters - events[events.length - 1].distanceMeters;
      const spanFiberLoss = distFromPrev * attenuationRateDbPerM;
      cumulativeLossDb += spanFiberLoss;

      if (faultSeverity === 'critical') {
        events.push({
          id: 'ev-fault-cut',
          distanceMeters: faultDistanceMeters,
          type: '⚡ Critical Fiber Break (Severed Core)',
          lossDb: 35.0,
          reflectanceDb: -14.2,
          landmark: faultLandmark,
          cumulativeLossDb: Number((cumulativeLossDb + 35.0).toFixed(2)),
          powerLevelDbm: -38.0,
          isFault: true,
          severity: 'critical'
        });
      } else {
        const bendLossDb = wavelength === 1550 ? 4.8 : 1.4;
        cumulativeLossDb += bendLossDb;
        events.push({
          id: 'ev-fault-bend',
          distanceMeters: faultDistanceMeters,
          type: '⚠️ High Tension Macrobend / Optical Pinch',
          lossDb: bendLossDb,
          reflectanceDb: -42.0,
          landmark: faultLandmark,
          cumulativeLossDb: Number(cumulativeLossDb.toFixed(2)),
          powerLevelDbm: Number((def.launchPowerDbm - cumulativeLossDb).toFixed(2)),
          isFault: true,
          severity: 'warning'
        });
      }
    }

    // Optical Link Budget
    const endFiberLoss = isSignalCut ? 38.0 : cumulativeLossDb;
    const endRxPowerDbm = def.launchPowerDbm - endFiberLoss;
    const opticalMarginDb = Number((endRxPowerDbm - def.rxSensitivityDbm).toFixed(2));

    return {
      id: def.id,
      name: def.name,
      primaryArea: def.primaryArea,
      totalDistanceMeters: def.totalDistanceMeters,
      totalDistanceKm: (def.totalDistanceMeters / 1000).toFixed(2),
      coreCount: def.coreCount,
      fiberType: def.fiberType,
      launchPowerDbm: def.launchPowerDbm,
      rxSensitivityDbm: def.rxSensitivityDbm,
      wavelengthNm: wavelength,
      attenuationRateDbPerKm: (attenuationRateDbPerM * 1000).toFixed(2),
      totalSubscribers: totalSubs,
      activeSubscribers: activeCount,
      offlineSubscribers: offlineCount,
      offlinePercent: offlineRate,
      atRiskRevenuePkr: routeAtRiskPkr,
      hasFault,
      faultType,
      faultDistanceMeters,
      faultDistanceKm: faultDistanceMeters ? (faultDistanceMeters / 1000).toFixed(2) : null,
      faultLandmark,
      faultStatusLabel,
      faultBadgeClass,
      faultSeverity,
      events,
      totalLossDb: Number(endFiberLoss.toFixed(2)),
      rxPowerDbm: Number(endRxPowerDbm.toFixed(2)),
      opticalMarginDb,
      recommendedCrew: 'Shahdara Splicing Crew 1 (Farhan & Tariq - Mobile Splicer Van 4)',
      estimatedRepairMins: faultSeverity === 'critical' ? 55 : (faultSeverity === 'warning' ? 25 : 0)
    };
  });

  const selectedRoute = routes.find(r => r.id === routeId) || routes[0];

  let fleetStatus = 'ALL FIBER ROUTES NORMAL';
  let fleetStatusBadge = 'badge-success';
  if (routesWithBreaks > 0) {
    fleetStatus = `${routesWithBreaks} CRITICAL FIBER CUT${routesWithBreaks > 1 ? 'S' : ''} DETECTED`;
    fleetStatusBadge = 'badge-danger';
  } else if (routes.some(r => r.faultSeverity === 'warning')) {
    fleetStatus = 'OPTICAL ATTENUATION WARNING';
    fleetStatusBadge = 'badge-warning';
  }

  return {
    referenceDate: options.referenceDate || new Date(),
    wavelength,
    selectedRouteId: selectedRoute.id,
    selectedRoute,
    routes,
    totalRoutesMonitored,
    totalFiberDistanceKm: (totalFiberMeters / 1000).toFixed(1),
    routesWithBreaks,
    totalAffectedSubscribers,
    totalAtRiskRevenue,
    fleetStatus,
    fleetStatusBadge
  };
}

/**
 * Generates an operational WhatsApp / clipboard dispatch report for field technicians.
 */
export function generateOtdrReport(otdrData, referenceDate = new Date()) {
  const data = otdrData || calculateOtdrFaultMetrics();
  const route = data.selectedRoute;
  const dateStr = referenceDate.toISOString().slice(0, 10);

  const lines = [
    '================================================================',
    'SHAHDARA ISP - OTDR FIBER FAULT DISPATCH ADVISORY',
    '================================================================',
    `Date: ${dateStr} PKT | Optical Wavelength: ${data.wavelength} nm`,
    `Monitored Route: ${route.name}`,
    `Span Length: ${route.totalDistanceKm} km (${route.totalDistanceMeters}m) | Core: ${route.coreCount}-Core ${route.fiberType}`,
    `OLT Launch Power: +${route.launchPowerDbm} dBm | RX Sensitivity: ${route.rxSensitivityDbm} dBm`,
    '----------------------------------------------------------------',
    `OPTICAL HEALTH STATUS: ${route.faultStatusLabel}`,
    '----------------------------------------------------------------'
  ];

  if (route.hasFault && route.faultDistanceMeters) {
    lines.push(
      `⚡ FAULT DISTANCE FROM OLT: ${route.faultDistanceMeters} meters (~${route.faultDistanceKm} km)`,
      `📍 PHYSICAL LANDMARK: ${route.faultLandmark}`,
      `🛠 EVENT CLASSIFICATION: ${route.faultType}`,
      `👥 OFFLINE SUBSCRIBERS AT RISK: ${route.offlineSubscribers} accounts`,
      `💰 REVENUE AT RISK: ${formatPKR(route.atRiskRevenuePkr)} / month`,
      `⏱ ESTIMATED REPAIR DURATION: ~${route.estimatedRepairMins} minutes`,
      `🚐 ASSIGNED SPLICING CREW: ${route.recommendedCrew}`,
      '',
      '----------------------------------------------------------------',
      'EVENT TRACE LOG (OTDR REFLECTOMETRY):',
      '----------------------------------------------------------------'
    );
  } else {
    lines.push(
      '✅ All optical reflection markers within normal ITU-T G.652 standards.',
      `Active Subscribers on Route: ${route.activeSubscribers} / ${route.totalSubscribers}`,
      `Measured Optical Margin: ${route.opticalMarginDb} dB`,
      '',
      '----------------------------------------------------------------',
      'BASELINE OPTICAL EVENTS:',
      '----------------------------------------------------------------'
    );
  }

  route.events.forEach((ev, idx) => {
    if (ev.unreachable) {
      lines.push(`• Ev #${idx + 1} [${ev.distanceMeters}m]: ${ev.type} (Signal Cut Off - Unreachable)`);
    } else {
      lines.push(
        `• Ev #${idx + 1} [${ev.distanceMeters}m]: ${ev.type} | Step Loss: ${ev.lossDb} dB | ` +
        `Refl: ${ev.reflectanceDb} dB | Power: ${ev.powerLevelDbm} dBm | ${ev.landmark}`
      );
    }
  });

  lines.push('');
  lines.push('----------------------------------------------------------------');
  lines.push('FIELD SPLICING ACTION PROTOCOL:');
  lines.push('----------------------------------------------------------------');
  lines.push('1. Proceed directly to landmark pole/chamber with Fujikura fusion splicer.');
  lines.push('2. Verify aerial span tension and inspect for mechanical cuts/falling branches.');
  lines.push('3. Strip 250um coating, clean core with 99.9% isopropyl alcohol.');
  lines.push('4. Precision cleave at 90-deg angle and perform core-alignment arc fusion.');
  lines.push('5. Target splice loss < 0.03 dB; apply 60mm heat-shrink protection sleeve.');
  lines.push('================================================================');

  return lines.join('\n');
}

/**
 * Renders pure SVG technical OTDR trace graph with Rayleigh slope, event reflections,
 * and fiber break locator.
 */
export function renderOtdrTraceSvg(otdrData, options = {}) {
  const width = options.width || 640;
  const height = options.height || 260;

  if (!otdrData || !otdrData.selectedRoute) {
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="OTDR Fiber Fault Locator Trace">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="13" fill="var(--muted, #71817c)">
        No OTDR fiber telemetry available
      </text>
    </svg>`;
  }

  const route = otdrData.selectedRoute;
  const events = route.events || [];
  const maxMeters = Math.max(route.totalDistanceMeters, 2500);

  const leftPad = 48;
  const rightPad = 24;
  const topPad = 42;
  const bottomPad = 48;

  const plotWidth = width - leftPad - rightPad;
  const plotHeight = height - topPad - bottomPad;

  // Power scale: +5 dBm (top) down to -40 dBm (bottom)
  const maxPowerDbm = 5.0;
  const minPowerDbm = -40.0;
  const powerRange = maxPowerDbm - minPowerDbm;

  function toX(meters) {
    return leftPad + (Math.min(meters, maxMeters) / maxMeters) * plotWidth;
  }

  function toY(powerDbm) {
    const clamped = Math.max(minPowerDbm, Math.min(maxPowerDbm, powerDbm));
    return topPad + ((maxPowerDbm - clamped) / powerRange) * plotHeight;
  }

  // Construct SVG trace points
  const points = [];

  // Start with launch power at 0m
  const startPower = route.launchPowerDbm;
  points.push({ x: toX(0), y: toY(startPower), label: '0m Launch' });

  // Add reflection peak at 0m
  points.push({ x: toX(15), y: toY(startPower + 1.5), label: 'Launch Connector' });

  let curPower = startPower - (events[0]?.lossDb || 0.35);
  points.push({ x: toX(30), y: toY(curPower), label: 'Post-Launch' });

  let lastMeters = 30;
  const attenuationM = otdrData.wavelength === 1550 ? 0.00020 : 0.00035;

  let breakX = null;
  let breakY = null;

  for (const ev of events.slice(1)) {
    if (ev.unreachable) continue;

    const spanM = Math.max(0, ev.distanceMeters - lastMeters);
    curPower -= (spanM * attenuationM);

    // Point before event
    points.push({ x: toX(ev.distanceMeters - 10), y: toY(curPower) });

    if (ev.isFault && ev.severity === 'critical') {
      // Fresnel reflection spike at cut
      points.push({ x: toX(ev.distanceMeters), y: toY(Math.min(maxPowerDbm - 1, curPower + 4.5)) });
      // Total catastrophic drop into noise floor
      curPower = -38.0;
      points.push({ x: toX(ev.distanceMeters + 15), y: toY(curPower) });
      breakX = toX(ev.distanceMeters);
      breakY = toY(curPower);
      break;
    } else if (ev.lossDb > 8.0) {
      // Splitter step down
      points.push({ x: toX(ev.distanceMeters), y: toY(curPower + 1.2) });
      curPower -= ev.lossDb;
      points.push({ x: toX(ev.distanceMeters + 15), y: toY(curPower) });
    } else {
      // Fusion splice or small macrobend step
      curPower -= ev.lossDb;
      points.push({ x: toX(ev.distanceMeters), y: toY(curPower) });
    }

    lastMeters = ev.distanceMeters + 15;
  }

  // Extend to end of route
  if (breakX === null) {
    const remainingM = Math.max(0, route.totalDistanceMeters - lastMeters);
    curPower -= (remainingM * attenuationM);
    points.push({ x: toX(route.totalDistanceMeters), y: toY(curPower) });
    // End reflection
    points.push({ x: toX(route.totalDistanceMeters + 10), y: toY(curPower + 2.0) });
    points.push({ x: toX(route.totalDistanceMeters + 20), y: toY(-38.0) });
  } else {
    // Continue noise floor to end
    points.push({ x: toX(maxMeters), y: toY(-38.0) });
  }

  const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  // Create area fill path down to noise floor
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${toY(minPowerDbm).toFixed(1)} L ${leftPad} ${toY(minPowerDbm).toFixed(1)} Z`;

  // Trace color
  const traceColor = route.faultSeverity === 'critical' ? '#ef4444' : (route.faultSeverity === 'warning' ? '#d97706' : '#10b981');
  const gradientId = `otdrGrad-${route.id}-${route.faultSeverity}`;

  // Y-axis grid marks (+0, -10, -20, -30, -40 dBm)
  const yGrids = [0, -10, -20, -30, -40];
  const yGridSvg = yGrids.map(val => {
    const y = toY(val);
    return `
      <line x1="${leftPad}" y1="${y}" x2="${width - rightPad}" y2="${y}" stroke="var(--line, #e2ece7)" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${leftPad - 6}" y="${y + 4}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">
        ${val > 0 ? `+${val}` : val} dBm
      </text>
    `;
  }).join('');

  // X-axis distance markers (every 500m or 1km)
  const xStep = maxMeters > 3000 ? 1000 : 500;
  const xGrids = [];
  for (let m = 0; m <= maxMeters; m += xStep) {
    const x = toX(m);
    xGrids.push(`
      <line x1="${x}" y1="${topPad}" x2="${x}" y2="${height - bottomPad}" stroke="var(--line, #e2ece7)" stroke-width="1" stroke-dasharray="2,3" />
      <text x="${x}" y="${height - bottomPad + 14}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">
        ${(m / 1000).toFixed(1)} km
      </text>
    `);
  }

  // Fault marker overlay
  let faultMarkerSvg = '';
  if (breakX !== null && route.faultDistanceMeters) {
    faultMarkerSvg = `
      <g class="otdr-fault-marker">
        <line x1="${breakX}" y1="${topPad}" x2="${breakX}" y2="${height - bottomPad}" stroke="#ef4444" stroke-width="2" stroke-dasharray="4,4" />
        <circle cx="${breakX}" cy="${toY(-10)}" r="7" fill="#ef4444" stroke="#ffffff" stroke-width="2" />
        <text x="${breakX}" y="${toY(-10) + 4}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" font-weight="900" fill="#ffffff">!</text>
        <rect x="${Math.max(leftPad, breakX - 110)}" y="${topPad - 18}" width="220" height="20" rx="4" fill="#ef4444" />
        <text x="${Math.max(leftPad + 110, breakX)}" y="${topPad - 4}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="700" fill="#ffffff">
          ⚡ FIBER BREAK AT ${route.faultDistanceMeters}m (~${route.faultDistanceKm} km)
        </text>
      </g>
    `;
  }

  // Header status badge
  let statusBadgeColor = '#10b981';
  let statusBadgeText = 'CONTINUITY OK';
  if (route.faultSeverity === 'critical') {
    statusBadgeColor = '#ef4444';
    statusBadgeText = 'FIBER CUT DETECTED';
  } else if (route.faultSeverity === 'warning') {
    statusBadgeColor = '#d97706';
    statusBadgeText = 'HIGH MACROBEND LOSS';
  }

  return `
    <svg class="chart-svg otdr-trace-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="OTDR Fiber Fault Locator Trace">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${traceColor}" stop-opacity="0.35" />
          <stop offset="85%" stop-color="${traceColor}" stop-opacity="0.05" />
          <stop offset="100%" stop-color="${traceColor}" stop-opacity="0.0" />
        </linearGradient>
      </defs>

      <!-- Background Chart Canvas -->
      <rect width="${width}" height="${height}" rx="12" fill="var(--surface, #ffffff)" stroke="var(--line, #e2ece7)" stroke-width="1" />

      <!-- Chart Header -->
      <text x="${leftPad}" y="22" font-family="'Manrope', system-ui, sans-serif" font-size="12" font-weight="800" fill="var(--ink, #182e2a)">
        ${escapeXml(route.name)}
      </text>
      <text x="${leftPad + 270}" y="22" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">
        ${otdrData.wavelength} nm | Rate: ${route.attenuationRateDbPerKm} dB/km | Loss: ${route.totalLossDb} dB
      </text>

      <!-- Status Pill -->
      <g transform="translate(${width - rightPad - 130}, 10)">
        <rect width="130" height="18" rx="9" fill="${statusBadgeColor}" opacity="0.15" />
        <rect width="130" height="18" rx="9" fill="none" stroke="${statusBadgeColor}" stroke-width="1" />
        <circle cx="10" cy="9" r="4" fill="${statusBadgeColor}" />
        <text x="20" y="13" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="800" fill="${statusBadgeColor}">
          ${statusBadgeText}
        </text>
      </g>

      <!-- Grid Lines -->
      ${yGridSvg}
      ${xGrids.join('')}

      <!-- Noise Floor Area Boundary (-38 dBm) -->
      <rect x="${leftPad}" y="${toY(-38)}" width="${plotWidth}" height="${toY(-40) - toY(-38)}" fill="var(--bg-soft, #f4f8f6)" opacity="0.6" />
      <text x="${width - rightPad - 4}" y="${toY(-38) - 4}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">
        Rayleigh Noise Floor (-38 dBm)
      </text>

      <!-- Shaded Trace Area -->
      <path d="${areaD}" fill="url(#${gradientId})" />

      <!-- Trace Line -->
      <path d="${pathD}" fill="none" stroke="${traceColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Fault Marker Overlay -->
      ${faultMarkerSvg}

      <!-- X-Axis Base Title -->
      <text x="${width / 2}" y="${height - 8}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="600" fill="var(--muted, #71817c)">
        Optical Route Distance (Kilometers from Shahdara Central OLT)
      </text>
    </svg>
  `;
}

/**
 * Sets up and wires the interactive OTDR Fiber Fault Locator modal dialog.
 */
export function setupOtdrModal(state, { referenceDate = new Date(), onFilterArea, onFilterCustomer, onToast, clipboard } = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

  const modal = document.getElementById('dashboardOtdrModal');
  const openBtn = document.getElementById('dashboardOpenOtdrModalBtn');
  const closeBtn = document.getElementById('dashboardOtdrModalCloseBtn');
  const routeSelect = document.getElementById('otdrRouteSelect');
  const wavelengthSelect = document.getElementById('otdrWavelengthSelect');
  const distanceSlider = document.getElementById('otdrDistanceSlider');
  const distanceSliderVal = document.getElementById('otdrDistanceSliderVal');
  const resetSliderBtn = document.getElementById('otdrResetSimBtn');

  const chartContainer = document.getElementById('otdrModalTraceChart');
  const tableBody = document.getElementById('otdrEventsTableBody');
  const copyBtn = document.getElementById('dashboardCopyOtdrReportBtn');
  const filterAreaBtn = document.getElementById('otdrFilterAreaBtn');

  const routeNameEl = document.getElementById('otdrKpiRouteName');
  const breakDistEl = document.getElementById('otdrKpiBreakDist');
  const affectedSubsEl = document.getElementById('otdrKpiAffectedSubs');
  const atRiskRevEl = document.getElementById('otdrKpiAtRiskRev');
  const opticalMarginEl = document.getElementById('otdrKpiOpticalMargin');
  const statusBadgeEl = document.getElementById('otdrStatusBadge');

  if (!modal) return;

  function renderView() {
    const otdrData = calculateOtdrFaultMetrics(state, {
      referenceDate,
      routeId: selectedOtdrRouteId,
      wavelength: selectedOtdrWavelength,
      simulatedDistance: simulatedOtdrDistance
    });

    const route = otdrData.selectedRoute;

    // Populate KPI Cards
    if (routeNameEl) routeNameEl.textContent = `${route.name} (${route.totalDistanceKm} km)`;
    if (breakDistEl) {
      breakDistEl.textContent = route.hasFault && route.faultDistanceMeters
        ? `${route.faultDistanceMeters} m (~${route.faultDistanceKm} km)`
        : 'None (Link OK)';
    }
    if (affectedSubsEl) affectedSubsEl.textContent = `${route.offlineSubscribers} Offline (${route.offlinePercent}%)`;
    if (atRiskRevEl) atRiskRevEl.textContent = formatPKR(route.atRiskRevenuePkr);
    if (opticalMarginEl) opticalMarginEl.textContent = `${route.opticalMarginDb} dB Margin`;

    if (statusBadgeEl) {
      statusBadgeEl.textContent = route.faultStatusLabel;
      statusBadgeEl.className = `sim-delta-badge ${route.faultBadgeClass}`;
    }

    if (distanceSlider) {
      distanceSlider.max = String(route.totalDistanceMeters);
      if (simulatedOtdrDistance !== null) {
        distanceSlider.value = String(simulatedOtdrDistance);
        if (distanceSliderVal) distanceSliderVal.textContent = `${simulatedOtdrDistance} m`;
      } else {
        distanceSlider.value = route.faultDistanceMeters ? String(route.faultDistanceMeters) : '0';
        if (distanceSliderVal) distanceSliderVal.textContent = route.faultDistanceMeters ? `${route.faultDistanceMeters} m` : 'Auto (Live State)';
      }
    }

    // Render SVG trace chart inside modal
    if (chartContainer) {
      chartContainer.innerHTML = renderOtdrTraceSvg(otdrData, { width: 680, height: 250 });
    }

    // Populate events table
    if (tableBody) {
      tableBody.innerHTML = route.events.map((ev, idx) => {
        const rowClass = ev.isFault ? (ev.severity === 'critical' ? 'table-row-danger' : 'table-row-warning') : '';
        return `
          <tr class="${rowClass}">
            <td><strong>#${idx + 1}</strong></td>
            <td><strong>${ev.distanceMeters} m</strong> <span class="text-muted">(${(ev.distanceMeters / 1000).toFixed(2)} km)</span></td>
            <td>
              <strong>${escapeXml(ev.type)}</strong>
              ${ev.isFault ? `<div class="badge-${ev.severity}" style="font-size:10px;display:inline-block;padding:1px 4px;border-radius:3px;">ACTIVE FAULT</div>` : ''}
            </td>
            <td>${ev.unreachable ? '—' : `${ev.lossDb} dB`}</td>
            <td>${ev.unreachable ? '—' : `${ev.reflectanceDb} dB`}</td>
            <td>${ev.unreachable ? '—' : `${ev.powerLevelDbm} dBm`}</td>
            <td><small>${escapeXml(ev.landmark)}</small></td>
          </tr>
        `;
      }).join('');
    }

    // Update filter area button text & dataset
    if (filterAreaBtn) {
      filterAreaBtn.textContent = `Inspect ${route.primaryArea} Subscribers`;
      filterAreaBtn.setAttribute('data-otdr-area', route.primaryArea);
    }
  }

  function populateAndOpen() {
    // Populate route selector if empty
    if (routeSelect && routeSelect.children.length === 0) {
      routeSelect.innerHTML = SHAHDARA_FIBER_ROUTES.map(r => `
        <option value="${r.id}" ${r.id === selectedOtdrRouteId ? 'selected' : ''}>
          ${r.name} (${(r.totalDistanceMeters / 1000).toFixed(1)} km)
        </option>
      `).join('');
    }

    renderView();

    if (modal.showModal) modal.showModal();
    else modal.setAttribute('open', '');
  }

  // Wire Route Select
  if (routeSelect && !routeSelect.dataset?.wired) {
    if (routeSelect.dataset) routeSelect.dataset.wired = 'true';
    else if (routeSelect.setAttribute) routeSelect.setAttribute('data-wired', 'true');
    routeSelect.addEventListener('change', () => {
      setOtdrSelectedRoute(routeSelect.value);
      setOtdrSimulatedDistance(null); // Reset manual distance on route change
      renderView();
    });
  }

  // Wire Wavelength Select
  if (wavelengthSelect && !wavelengthSelect.dataset?.wired) {
    if (wavelengthSelect.dataset) wavelengthSelect.dataset.wired = 'true';
    else if (wavelengthSelect.setAttribute) wavelengthSelect.setAttribute('data-wired', 'true');
    wavelengthSelect.addEventListener('change', () => {
      setOtdrWavelength(wavelengthSelect.value);
      renderView();
    });
  }

  // Wire Distance Slider
  if (distanceSlider && !distanceSlider.dataset?.wired) {
    if (distanceSlider.dataset) distanceSlider.dataset.wired = 'true';
    else if (distanceSlider.setAttribute) distanceSlider.setAttribute('data-wired', 'true');
    distanceSlider.addEventListener('input', () => {
      const val = Number(distanceSlider.value);
      setOtdrSimulatedDistance(val);
      if (distanceSliderVal) distanceSliderVal.textContent = `${val} m`;
      renderView();
    });
  }

  // Wire Reset Slider Button
  if (resetSliderBtn && !resetSliderBtn.dataset?.wired) {
    if (resetSliderBtn.dataset) resetSliderBtn.dataset.wired = 'true';
    else if (resetSliderBtn.setAttribute) resetSliderBtn.setAttribute('data-wired', 'true');
    resetSliderBtn.addEventListener('click', () => {
      setOtdrSimulatedDistance(null);
      renderView();
    });
  }

  // Wire Filter Area Button
  if (filterAreaBtn && !filterAreaBtn.dataset?.wired) {
    if (filterAreaBtn.dataset) filterAreaBtn.dataset.wired = 'true';
    else if (filterAreaBtn.setAttribute) filterAreaBtn.setAttribute('data-wired', 'true');
    filterAreaBtn.addEventListener('click', () => {
      const area = filterAreaBtn.getAttribute('data-otdr-area');
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

  // Wire Copy Report Button
  if (copyBtn && !copyBtn.dataset?.wired) {
    if (copyBtn.dataset) copyBtn.dataset.wired = 'true';
    else if (copyBtn.setAttribute) copyBtn.setAttribute('data-wired', 'true');
    copyBtn.addEventListener('click', async () => {
      const otdrData = calculateOtdrFaultMetrics(state, {
        referenceDate,
        routeId: selectedOtdrRouteId,
        wavelength: selectedOtdrWavelength,
        simulatedDistance: simulatedOtdrDistance
      });
      const text = generateOtdrReport(otdrData, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('OTDR dispatch briefing copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy to clipboard.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard not supported in this browser.');
      }
    });
  }

  // Wire Open Modal Button
  if (openBtn && !openBtn.dataset?.wired) {
    if (openBtn.dataset) openBtn.dataset.wired = 'true';
    else if (openBtn.setAttribute) openBtn.setAttribute('data-wired', 'true');
    openBtn.addEventListener('click', populateAndOpen);
  }

  // Wire Close Modal Button
  if (closeBtn && !closeBtn.dataset?.wired) {
    if (closeBtn.dataset) closeBtn.dataset.wired = 'true';
    else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired', 'true');
    closeBtn.addEventListener('click', () => {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    });
  }

  // Wire backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    }
  });
}
