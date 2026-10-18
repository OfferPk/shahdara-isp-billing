import { formatPKR } from './core.js';
import { triggerHaptic } from './nav.js';

/**
 * Technician Optical Event OTDR Trace Inspector & Fault Geolocation Mobile Sheet
 * Provides field linesmen and splicing teams with interactive mobile optical time-domain
 * reflectometry (OTDR) trace inspection, Rayleigh backscatter slope degradation, fusion splice loss,
 * optical splitter attenuation, and pinpoint fiber break geolocation across Shahdara FTTH distribution.
 */

export const OTDR_TRACE_STORAGE_KEY = 'shahdara_otdr_mobile_traces_v1';

export const SHAHDARA_OTDR_CORRIDORS = [
  {
    id: 'otdr-cr-01',
    code: 'OTDR-CR01',
    name: 'Shahdara Town Central OLT - Railway Feeder Loop',
    area: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    cableType: '48F Armored Loose-Tube Overhead',
    totalLengthKm: 4.8,
    refractiveIndex: 1.4682,
    baseWavelength: 1310, // nm
    basePulseWidthNs: 30,
    linemanCrew: 'Usman Ghani & Bilal Team',
    events: [
      { id: 'ev-1', type: 'Launch', distanceMeters: 0, lossDb: 0.25, landmark: 'Shahdara Central OLT Patch Panel' },
      { id: 'ev-2', type: 'Splice', distanceMeters: 1420, lossDb: 0.08, landmark: 'Pole #ST-18 near Old Thana Chowk' },
      { id: 'ev-3', type: 'Splitter', distanceMeters: 2850, lossDb: 10.4, landmark: 'FDH Cabinet #02 Railway Road' },
      { id: 'ev-4', type: 'Macro-Bend', distanceMeters: 3620, lossDb: 1.85, landmark: 'Pole #ST-34 near Railway Crossing' },
      { id: 'ev-5', type: 'Break', distanceMeters: 4150, lossDb: 22.0, landmark: 'Pole #ST-42 near Railway Phatak Gate' }
    ]
  },
  {
    id: 'otdr-br-02',
    code: 'OTDR-BR02',
    name: 'Baradari Road High-Density Trunk to Ravi Pier',
    area: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    cableType: '96F Micro-Duct Blown Ribbon',
    totalLengthKm: 6.2,
    refractiveIndex: 1.4682,
    baseWavelength: 1550,
    basePulseWidthNs: 50,
    linemanCrew: 'Hamza Tariq & Naveed',
    events: [
      { id: 'ev-1', type: 'Launch', distanceMeters: 0, lossDb: 0.20, landmark: 'Baradari Primary Node ODF' },
      { id: 'ev-2', type: 'Splice', distanceMeters: 2100, lossDb: 0.05, landmark: 'Closure CL-BR-08 near Jamia Masjid' },
      { id: 'ev-3', type: 'Splice', distanceMeters: 4300, lossDb: 0.42, landmark: 'Pole #BR-55 near Tariq Market' },
      { id: 'ev-4', type: 'Splitter', distanceMeters: 5200, lossDb: 10.2, landmark: 'Closure CL-BR-14 Ravi Riverbank' }
    ]
  },
  {
    id: 'otdr-vr-03',
    code: 'OTDR-VR03',
    name: 'Vandala Road Industrial Feeder Backbone',
    area: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    cableType: '24F ADSS Heavy-Tension Dielectric',
    totalLengthKm: 5.5,
    refractiveIndex: 1.4678,
    baseWavelength: 1310,
    basePulseWidthNs: 30,
    linemanCrew: 'Imran Sadiq Team',
    events: [
      { id: 'ev-1', type: 'Launch', distanceMeters: 0, lossDb: 0.30, landmark: 'Vandala Industrial Gateway' },
      { id: 'ev-2', type: 'Splice', distanceMeters: 1850, lossDb: 0.06, landmark: 'Pole #VR-12 Mills Entrance' },
      { id: 'ev-3', type: 'Macro-Bend', distanceMeters: 3400, lossDb: 2.10, landmark: 'Transformer Pole #VR-24' },
      { id: 'ev-4', type: 'Splitter', distanceMeters: 4600, lossDb: 13.8, landmark: 'Zia Town Distribution Hub' }
    ]
  },
  {
    id: 'otdr-jm-04',
    code: 'OTDR-JM04',
    name: 'Jia Musa Dense Urban Access Spur',
    area: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    cableType: '12F Figure-8 Aerial Drop Feeder',
    totalLengthKm: 3.6,
    refractiveIndex: 1.4682,
    baseWavelength: 1625, // Live maintenance wavelength
    basePulseWidthNs: 10,
    linemanCrew: 'Kashif Ali & Asad',
    events: [
      { id: 'ev-1', type: 'Launch', distanceMeters: 0, lossDb: 0.22, landmark: 'Jia Musa Splitter Enclosure' },
      { id: 'ev-2', type: 'Splice', distanceMeters: 1100, lossDb: 0.12, landmark: 'Alleyway 4 Pole #JM-09' },
      { id: 'ev-3', type: 'Break', distanceMeters: 2280, lossDb: 24.5, landmark: 'Main Bazaar Rooftop J-Hook #16' }
    ]
  },
  {
    id: 'otdr-bk-05',
    code: 'OTDR-BK05',
    name: 'Begum Kot Highway Long-Span Distribution',
    area: 'Saeed Park',
    aliasAreas: ['Saeed Park', 'Begum Kot', 'Rehman Park'],
    cableType: '48F Steel Armored Underground Duct',
    totalLengthKm: 7.8,
    refractiveIndex: 1.4685,
    baseWavelength: 1550,
    basePulseWidthNs: 100,
    linemanCrew: 'Tariq Mehmood & Zahid',
    events: [
      { id: 'ev-1', type: 'Launch', distanceMeters: 0, lossDb: 0.28, landmark: 'Begum Kot Main Point of Presence' },
      { id: 'ev-2', type: 'Splice', distanceMeters: 2900, lossDb: 0.04, landmark: 'Manhole MH-06 GT Road' },
      { id: 'ev-3', type: 'Splice', distanceMeters: 5100, lossDb: 0.09, landmark: 'Manhole MH-12 Saeed Park' },
      { id: 'ev-4', type: 'Splitter', distanceMeters: 6900, lossDb: 10.5, landmark: 'Saeed Park FDH #03' }
    ]
  }
];

export const OTDR_THRESHOLDS = {
  MAX_ACCEPTABLE_SPLICE_LOSS_DB: 0.15,
  MAX_ACCEPTABLE_CONNECTOR_LOSS_DB: 0.50,
  FIBER_BREAK_LOSS_THRESHOLD_DB: 15.0,
  ATTENUATION_COEFF_1310_DB_PER_KM: 0.35,
  ATTENUATION_COEFF_1550_DB_PER_KM: 0.20,
  ATTENUATION_COEFF_1625_DB_PER_KM: 0.24
};

// Simulation state
let selectedCorridorId = null;
let simulatedWavelength = null;
let simulatedPulseWidth = null;

export function getOtdrSelectedCorridor() {
  return selectedCorridorId || SHAHDARA_OTDR_CORRIDORS[0].id;
}

export function setOtdrSelectedCorridor(id) {
  selectedCorridorId = id;
}

export function getOtdrSelectedWavelength() {
  return simulatedWavelength !== null ? simulatedWavelength : SHAHDARA_OTDR_CORRIDORS[0].baseWavelength;
}

export function setOtdrSelectedWavelength(wl) {
  simulatedWavelength = [1310, 1550, 1625].includes(Number(wl)) ? Number(wl) : null;
}

export function getOtdrSelectedPulseWidth() {
  return simulatedPulseWidth !== null ? simulatedPulseWidth : SHAHDARA_OTDR_CORRIDORS[0].basePulseWidthNs;
}

export function setOtdrSelectedPulseWidth(pw) {
  simulatedPulseWidth = [10, 30, 50, 100].includes(Number(pw)) ? Number(pw) : null;
}

export function resetOtdrMobileState() {
  selectedCorridorId = null;
  simulatedWavelength = null;
  simulatedPulseWidth = null;
}

/**
 * Storage helpers for technician resolution signoffs.
 */
export function getOtdrMobileTracesStore(storage = null) {
  const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!s) return {};
  try {
    const raw = s.getItem(OTDR_TRACE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn('Failed to parse OTDR mobile traces store', err);
    return {};
  }
}

export function saveOtdrMobileTracesStore(store, storage = null) {
  const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!s) return false;
  try {
    s.setItem(OTDR_TRACE_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch (err) {
    console.warn('Failed to save OTDR mobile traces store', err);
    return false;
  }
}

export function recordOtdrEventResolution(corridorId, eventId, technicianName, resolvedLossDb = 0.05, notes = '', storage = null) {
  const store = getOtdrMobileTracesStore(storage);
  const key = `${corridorId}_${eventId}`;
  store[key] = {
    corridorId,
    eventId,
    technicianName: (technicianName || 'Lineman On-Duty').trim(),
    resolvedLossDb: Number(resolvedLossDb) || 0.05,
    notes: (notes || 'Re-cleaved and re-spliced on site').trim(),
    resolvedAt: new Date().toISOString()
  };
  saveOtdrMobileTracesStore(store, storage);
  return store[key];
}

export function clearOtdrMobileTracesStore(storage = null) {
  const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!s) return;
  try {
    s.removeItem(OTDR_TRACE_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear OTDR mobile store', err);
  }
}

/**
 * Calculates optical physics and event classification for a given corridor and wavelength.
 */
export function calculateOtdrTracePhysics(corridor, options = {}) {
  const wavelength = options.wavelength || (simulatedWavelength || corridor.baseWavelength);
  const pulseWidth = options.pulseWidth || (simulatedPulseWidth || corridor.basePulseWidthNs);

  // Attenuation coefficient based on Rayleigh scattering
  let alphaDbPerKm = OTDR_THRESHOLDS.ATTENUATION_COEFF_1310_DB_PER_KM;
  if (wavelength === 1550) alphaDbPerKm = OTDR_THRESHOLDS.ATTENUATION_COEFF_1550_DB_PER_KM;
  else if (wavelength === 1625) alphaDbPerKm = OTDR_THRESHOLDS.ATTENUATION_COEFF_1625_DB_PER_KM;

  const resolutionStore = getOtdrMobileTracesStore(options.storage);

  let cumulativeLossDb = 0;
  let hasCriticalBreak = false;
  let criticalBreakDistance = null;
  let criticalBreakLandmark = null;

  const processedEvents = corridor.events.map((ev, index) => {
    const key = `${corridor.id}_${ev.id}`;
    const resolution = resolutionStore[key];
    const isResolved = !!resolution;
    const effectiveLoss = isResolved ? resolution.resolvedLossDb : ev.lossDb;

    // Fiber distance attenuation up to this event
    const segmentKm = index === 0 ? 0 : (ev.distanceMeters - corridor.events[index - 1].distanceMeters) / 1000;
    cumulativeLossDb += segmentKm * alphaDbPerKm;
    cumulativeLossDb += effectiveLoss;

    const isBreak = !isResolved && (ev.type === 'Break' || effectiveLoss >= OTDR_THRESHOLDS.FIBER_BREAK_LOSS_THRESHOLD_DB);
    const isDegradedSplice = !isResolved && (ev.type === 'Splice' && effectiveLoss > OTDR_THRESHOLDS.MAX_ACCEPTABLE_SPLICE_LOSS_DB);
    const isMacroBend = !isResolved && ev.type === 'Macro-Bend';

    if (isBreak && !hasCriticalBreak) {
      hasCriticalBreak = true;
      criticalBreakDistance = ev.distanceMeters;
      criticalBreakLandmark = ev.landmark;
    }

    let status = 'Normal';
    let statusBadge = 'badge-success';
    if (isResolved) {
      status = 'Resolved';
      statusBadge = 'badge-success';
    } else if (isBreak) {
      status = 'Fiber Break';
      statusBadge = 'badge-danger';
    } else if (isMacroBend || isDegradedSplice) {
      status = 'High Loss';
      statusBadge = 'badge-warning';
    }

    return {
      ...ev,
      isResolved,
      resolution,
      effectiveLoss: Number(effectiveLoss.toFixed(2)),
      cumulativeLossDb: Number(cumulativeLossDb.toFixed(2)),
      status,
      statusBadge
    };
  });

  // Calculate fiber health tier
  let corridorHealth = 'Optimal';
  let corridorClass = 'badge-success';
  if (hasCriticalBreak) {
    corridorHealth = 'Critical Break';
    corridorClass = 'badge-danger';
  } else if (processedEvents.some(e => e.status === 'High Loss')) {
    corridorHealth = 'Degraded';
    corridorClass = 'badge-warning';
  }

  return {
    corridor,
    wavelength,
    pulseWidth,
    alphaDbPerKm,
    events: processedEvents,
    cumulativeLossDb: Number(cumulativeLossDb.toFixed(2)),
    hasCriticalBreak,
    criticalBreakDistance,
    criticalBreakLandmark,
    corridorHealth,
    corridorClass
  };
}

/**
 * Calculates aggregate summary KPIs and navigation badge counter.
 */
export function calculateOtdrMobileSummary(state = {}, options = {}) {
  const selectedId = getOtdrSelectedCorridor();
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const bills = Array.isArray(state?.bills) ? state.bills : [];

  const areaRevenueMap = {};
  const areaCustMap = {};

  customers.forEach(cust => {
    if (cust.isArchived) return;
    const area = (cust.area || 'Unknown').trim();
    areaCustMap[area] = (areaCustMap[area] || 0) + 1;
  });

  bills.forEach(bill => {
    const cust = customers.find(c => c.id === bill.customerId);
    if (!cust || cust.isArchived) return;
    const area = (cust.area || 'Unknown').trim();
    const balance = Math.max(0, Number(bill.balance) || 0);
    areaRevenueMap[area] = (areaRevenueMap[area] || 0) + balance;
  });

  let totalCorridors = SHAHDARA_OTDR_CORRIDORS.length;
  let activeBreaksCount = 0;
  let highLossEventsCount = 0;
  let totalDuesAtRisk = 0;
  let totalSubscribersAtRisk = 0;

  const evaluatedCorridors = SHAHDARA_OTDR_CORRIDORS.map(corridor => {
    const isSelected = corridor.id === selectedId;
    const evalData = calculateOtdrTracePhysics(corridor, options);

    let linkedSubscribers = 0;
    let linkedDues = 0;

    const matchedAreas = corridor.aliasAreas || [corridor.area];
    matchedAreas.forEach(areaKey => {
      Object.keys(areaCustMap).forEach(custArea => {
        if (custArea.toLowerCase().includes(areaKey.toLowerCase()) || areaKey.toLowerCase().includes(custArea.toLowerCase())) {
          linkedSubscribers += (areaCustMap[custArea] || 0);
          linkedDues += (areaRevenueMap[custArea] || 0);
        }
      });
    });

    if (evalData.hasCriticalBreak) {
      activeBreaksCount++;
      totalDuesAtRisk += linkedDues;
      totalSubscribersAtRisk += linkedSubscribers;
    }

    evalData.events.forEach(ev => {
      if (ev.status === 'High Loss') highLossEventsCount++;
    });

    return {
      ...corridor,
      isSelected,
      evalData,
      linkedSubscribers,
      linkedDues
    };
  });

  const selectedCorridorData = evaluatedCorridors.find(c => c.id === selectedId) || evaluatedCorridors[0];

  return {
    corridors: evaluatedCorridors,
    selectedCorridor: selectedCorridorData,
    totalCorridors,
    activeBreaksCount,
    highLossEventsCount,
    totalDuesAtRisk,
    totalSubscribersAtRisk,
    badgeCount: activeBreaksCount + highLossEventsCount
  };
}

/**
 * Renders touch-optimized mobile SVG trace for field inspection.
 */
export function renderMobileOtdrTraceSvg(evalData, options = {}) {
  const corridor = evalData.corridor;
  const events = evalData.events;
  const width = options.width || 560;
  const height = options.height || 240;

  const totalMeters = corridor.totalLengthKm * 1000;
  const padLeft = 46;
  const padRight = 30;
  const padTop = 35;
  const padBottom = 40;

  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  // Max cumulative loss + safety margin for Y scale
  const maxLossY = Math.max(30, evalData.cumulativeLossDb + 5);

  const scaleX = (m) => padLeft + Math.round((m / totalMeters) * plotWidth);
  const scaleY = (db) => padTop + Math.round((db / maxLossY) * plotHeight);

  // Generate trace line path
  let pathD = `M ${scaleX(0)},${scaleY(0)}`;
  events.forEach((ev, i) => {
    const x = scaleX(ev.distanceMeters);
    const y = scaleY(ev.cumulativeLossDb);
    pathD += ` L ${x},${y}`;
    if (ev.status === 'Fiber Break') {
      // Abrupt drop cliff to bottom floor
      pathD += ` L ${x},${padTop + plotHeight}`;
    }
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" class="otdr-trace-svg" role="img" aria-label="Mobile OTDR Optical Event Trace Graph" xmlns="http://www.w3.org/2000/svg">
      <style>
        .otdr-t { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .otdr-t-label { font-size: 10px; fill: var(--text-muted, #64748b); }
        .otdr-t-val { font-size: 12px; font-weight: 700; fill: var(--text-color, #1e293b); }
        .otdr-grid-line { stroke: rgba(148, 163, 184, 0.2); stroke-dasharray: 4,4; stroke-width: 1; }
      </style>

      <!-- Frame -->
      <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="var(--surface, #ffffff)" stroke="rgba(148, 163, 184, 0.25)" stroke-width="1" />

      <!-- Title / Header -->
      <text x="${padLeft}" y="20" class="otdr-t" font-size="12px" font-weight="700" fill="var(--text-color, #1e293b)">${corridor.code}: ${corridor.name.length > 38 ? corridor.name.slice(0, 36) + '...' : corridor.name}</text>
      <text x="${width - padRight}" y="20" text-anchor="end" class="otdr-t" font-size="10px" font-weight="700" fill="${evalData.corridorClass === 'badge-danger' ? '#ef4444' : '#10b981'}">${evalData.corridorHealth.toUpperCase()}</text>

      <!-- Grid lines -->
      <line x1="${padLeft}" y1="${padTop + plotHeight * 0.25}" x2="${width - padRight}" y2="${padTop + plotHeight * 0.25}" class="otdr-grid-line" />
      <text x="${padLeft - 6}" y="${padTop + plotHeight * 0.25 + 3}" text-anchor="end" class="otdr-t otdr-t-label">${Math.round(maxLossY * 0.25)}dB</text>

      <line x1="${padLeft}" y1="${padTop + plotHeight * 0.5}" x2="${width - padRight}" y2="${padTop + plotHeight * 0.5}" class="otdr-grid-line" />
      <text x="${padLeft - 6}" y="${padTop + plotHeight * 0.5 + 3}" text-anchor="end" class="otdr-t otdr-t-label">${Math.round(maxLossY * 0.5)}dB</text>

      <line x1="${padLeft}" y1="${padTop + plotHeight * 0.75}" x2="${width - padRight}" y2="${padTop + plotHeight * 0.75}" class="otdr-grid-line" />
      <text x="${padLeft - 6}" y="${padTop + plotHeight * 0.75 + 3}" text-anchor="end" class="otdr-t otdr-t-label">${Math.round(maxLossY * 0.75)}dB</text>

      <!-- Axes -->
      <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + plotHeight}" stroke="rgba(148, 163, 184, 0.4)" stroke-width="1.5" />
      <line x1="${padLeft}" y1="${padTop + plotHeight}" x2="${width - padRight}" y2="${padTop + plotHeight}" stroke="rgba(148, 163, 184, 0.4)" stroke-width="1.5" />

      <!-- Trace Curve -->
      <path d="${pathD}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linejoin="round" />

      <!-- Event Markers -->
      ${events.map((ev, i) => {
        const x = scaleX(ev.distanceMeters);
        const y = scaleY(ev.cumulativeLossDb);
        const isBrk = ev.status === 'Fiber Break';
        const isHigh = ev.status === 'High Loss';
        const markerColor = isBrk ? '#ef4444' : isHigh ? '#f59e0b' : '#10b981';

        return `
          <g transform="translate(${x}, ${y})">
            <circle cx="0" cy="0" r="4.5" fill="${markerColor}" stroke="#ffffff" stroke-width="1.5" />
            <line x1="0" y1="0" x2="0" y2="${padTop + plotHeight - y}" stroke="${markerColor}" stroke-dasharray="2,2" stroke-width="1" />
            <text x="0" y="-8" text-anchor="middle" class="otdr-t" font-size="8.5px" font-weight="700" fill="${markerColor}">E${i + 1}</text>
          </g>
        `;
      }).join('')}

      <!-- X-Axis Distance Ticks -->
      <text x="${padLeft}" y="${height - 12}" class="otdr-t otdr-t-label">0m</text>
      <text x="${scaleX(totalMeters * 0.5)}" y="${height - 12}" text-anchor="middle" class="otdr-t otdr-t-label">${(corridor.totalLengthKm / 2).toFixed(1)}km</text>
      <text x="${width - padRight}" y="${height - 12}" text-anchor="end" class="otdr-t otdr-t-label">${corridor.totalLengthKm}km</text>

      <!-- Fault Callout Badge if Break Exists -->
      ${evalData.hasCriticalBreak ? `
        <g transform="translate(${padLeft + 10}, ${padTop + 10})">
          <rect x="0" y="0" width="220" height="26" rx="4" fill="#fee2e2" stroke="#ef4444" stroke-width="1" />
          <text x="8" y="17" class="otdr-t" font-size="10.5px" font-weight="700" fill="#991b1b">⚠️ BREAK AT ${evalData.criticalBreakDistance}m (${evalData.criticalBreakLandmark.length > 20 ? evalData.criticalBreakLandmark.slice(0, 18) + '...' : evalData.criticalBreakLandmark})</text>
        </g>
      ` : ''}
    </svg>
  `;
}

/**
 * Formats WhatsApp dispatch order for splicing teams.
 */
export function generateOtdrDispatchOrder(corridor, evalData) {
  const timestamp = new Date().toISOString();
  const breakEvent = evalData.events.find(e => e.status === 'Fiber Break');

  const lines = [
    '🚨 *SHAHDARA FTTH OTDR FIELD SPLICING DISPATCH WORK ORDER*',
    `*Generated:* ${timestamp}`,
    `*Corridor:* ${corridor.code} - ${corridor.name}`,
    `*Sector:* ${corridor.area} (${corridor.aliasAreas.join(', ')})`,
    `*Cable Specs:* ${corridor.cableType} (${corridor.totalLengthKm} km total)`,
    `*Test Parameters:* ${evalData.wavelength}nm | Pulse: ${evalData.pulseWidth}ns | IOR: ${corridor.refractiveIndex}`,
    `*Assigned Splicer Crew:* ${corridor.linemanCrew}`,
    '',
    '-------------------------------------------------------',
    '📍 *OPTICAL EVENT DIAGNOSTICS & FAULT LOCATION:*',
    '-------------------------------------------------------'
  ];

  if (breakEvent) {
    lines.push(`⚠️ *CRITICAL BREAK DETECTED:*`);
    lines.push(`• Meter Distance: *${breakEvent.distanceMeters} meters* from OLT`);
    lines.push(`• Landmark Location: *${breakEvent.landmark}*`);
    lines.push(`• Insertion Loss: *${breakEvent.effectiveLoss} dB*`);
  } else {
    lines.push(`✅ No complete fiber breaks detected on this trace.`);
    lines.push(`• Total Optical Link Loss: *${evalData.cumulativeLossDb} dB*`);
  }

  lines.push('');
  lines.push('*TRACE EVENT BREAKDOWN:*');
  evalData.events.forEach((ev, i) => {
    lines.push(`[E${i + 1}] ${ev.type} @ ${ev.distanceMeters}m: ${ev.effectiveLoss} dB (${ev.status}) - ${ev.landmark}`);
  });

  lines.push('');
  lines.push('🛠️ *FIELD ACTION MANDATE:*');
  if (breakEvent) {
    lines.push('1. Proceed immediately with OTDR launch cord and fusion splicer kit.');
    lines.push(`2. Inspect overhead drop cable near ${breakEvent.landmark}.`);
    lines.push('3. Re-cleave fibers, install protective heat-shrink sleeve, and re-test link.');
  } else {
    lines.push('1. Clean optical patch cords and inspect high-loss splice closures.');
    lines.push('2. Confirm receive optical power (Rx dBm) at subscriber ONTs.');
  }

  lines.push('-------------------------------------------------------');
  lines.push('Shahdara ISP Network Operations Center (NOC)');
  return lines.join('\n');
}

/**
 * Initializes and wires the mobile OTDR trace modal sheet.
 */
export function setupMobileOtdrTraceModal(options = {}) {
  const modal = document.getElementById('mobileOtdrTraceModal');
  const openButtons = document.querySelectorAll('[data-open-otdr-trace]');
  const closeBtn = document.getElementById('mobileOtdrTraceModalCloseBtn');
  const corridorSelect = document.getElementById('otdrCorridorSelect');
  const wlSelect = document.getElementById('otdrWlSelect');
  const pulseSelect = document.getElementById('otdrPulseSelect');
  const resetBtn = document.getElementById('otdrResetBtn');
  const chartWrap = document.getElementById('otdrTraceChartWrap');
  const eventsTableBody = document.getElementById('otdrEventsTableBody');
  const dispatchBtn = document.getElementById('otdrDispatchBtn');
  const resolveBtn = document.getElementById('otdrResolveBtn');
  const filterAreaBtn = document.getElementById('otdrFilterAreaBtn');

  // KPI elements
  const kpiCorridorCode = document.getElementById('otdrKpiCorridorCode');
  const kpiTotalLoss = document.getElementById('otdrKpiTotalLoss');
  const kpiBreakDistance = document.getElementById('otdrKpiBreakDistance');
  const kpiStatusBadge = document.getElementById('otdrStatusBadge');

  if (!modal) return;

  function refreshModal() {
    const summary = calculateOtdrMobileSummary(options.state || {}, options);
    const corridor = summary.selectedCorridor;
    const evalData = corridor.evalData;

    if (kpiCorridorCode) {
      kpiCorridorCode.textContent = corridor.code;
    }
    if (kpiTotalLoss) {
      kpiTotalLoss.textContent = `${evalData.cumulativeLossDb} dB`;
    }
    if (kpiBreakDistance) {
      kpiBreakDistance.textContent = evalData.hasCriticalBreak ? `${evalData.criticalBreakDistance}m` : 'None';
    }
    if (kpiStatusBadge) {
      kpiStatusBadge.textContent = evalData.corridorHealth.toUpperCase();
      kpiStatusBadge.className = `sim-delta-badge ${evalData.corridorClass}`;
    }

    if (chartWrap) {
      chartWrap.innerHTML = renderMobileOtdrTraceSvg(evalData);
    }

    if (eventsTableBody) {
      eventsTableBody.innerHTML = evalData.events.map((ev, i) => `
        <tr class="${ev.status === 'Fiber Break' ? 'hazard-row' : ''}">
          <td><strong>E${i + 1}: ${ev.type}</strong><br><small>${ev.landmark}</small></td>
          <td>${ev.distanceMeters}m</td>
          <td>${ev.effectiveLoss} dB</td>
          <td>${ev.cumulativeLossDb} dB</td>
          <td><span class="sim-delta-badge ${ev.statusBadge}">${ev.status}</span></td>
        </tr>
      `).join('');
    }
  }

  // Populate corridor select
  if (corridorSelect && corridorSelect.options.length === 0) {
    SHAHDARA_OTDR_CORRIDORS.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.code}: ${c.name}`;
      corridorSelect.appendChild(opt);
    });
  }

  // Open triggers
  openButtons.forEach(btn => {
    btn.onclick = () => {
      triggerHaptic('medium');
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
      if (corridorSelect) {
        corridorSelect.value = getOtdrSelectedCorridor();
      }
      if (wlSelect) {
        wlSelect.value = String(getOtdrSelectedWavelength());
      }
      if (pulseSelect) {
        pulseSelect.value = String(getOtdrSelectedPulseWidth());
      }
      refreshModal();
    };
  });

  // Close trigger
  if (closeBtn) {
    closeBtn.onclick = () => {
      triggerHaptic('light');
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    };
  }

  // Corridor change
  if (corridorSelect) {
    corridorSelect.onchange = () => {
      setOtdrSelectedCorridor(corridorSelect.value);
      refreshModal();
    };
  }

  // Wavelength change
  if (wlSelect) {
    wlSelect.onchange = () => {
      setOtdrSelectedWavelength(Number(wlSelect.value));
      refreshModal();
    };
  }

  // Pulse width change
  if (pulseSelect) {
    pulseSelect.onchange = () => {
      setOtdrSelectedPulseWidth(Number(pulseSelect.value));
      refreshModal();
    };
  }

  // Reset
  if (resetBtn) {
    resetBtn.onclick = () => {
      resetOtdrMobileState();
      if (corridorSelect) corridorSelect.value = SHAHDARA_OTDR_CORRIDORS[0].id;
      if (wlSelect) wlSelect.value = String(SHAHDARA_OTDR_CORRIDORS[0].baseWavelength);
      if (pulseSelect) pulseSelect.value = String(SHAHDARA_OTDR_CORRIDORS[0].basePulseWidthNs);
      refreshModal();
    };
  }

  // Dispatch Splicer WhatsApp
  if (dispatchBtn) {
    dispatchBtn.onclick = async () => {
      triggerHaptic('success');
      const summary = calculateOtdrMobileSummary(options.state || {}, options);
      const corridor = summary.selectedCorridor;
      const orderText = generateOtdrDispatchOrder(corridor, corridor.evalData);
      const clip = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(orderText);
          if (typeof options.onToast === 'function') {
            options.onToast('Splicer crew dispatch order copied to clipboard!');
          }
        } catch (err) {
          console.error('Failed to copy dispatch order', err);
        }
      }
    };
  }

  // Mark event resolved
  if (resolveBtn) {
    resolveBtn.onclick = () => {
      triggerHaptic('success');
      const summary = calculateOtdrMobileSummary(options.state || {}, options);
      const corridor = summary.selectedCorridor;
      const breakEvent = corridor.evalData.events.find(e => e.status === 'Fiber Break' || e.status === 'High Loss');
      if (breakEvent) {
        recordOtdrEventResolution(corridor.id, breakEvent.id, 'Lineman On-Site Splicer', 0.04, 'Spliced with Fujikura 88S+', options.storage);
        if (typeof options.onToast === 'function') {
          options.onToast(`Event ${breakEvent.id} marked resolved!`);
        }
        refreshModal();
      } else {
        if (typeof options.onToast === 'function') {
          options.onToast('No outstanding fiber break to resolve on this corridor.');
        }
      }
    };
  }

  // Filter area
  if (filterAreaBtn) {
    filterAreaBtn.onclick = () => {
      const summary = calculateOtdrMobileSummary(options.state || {}, options);
      const targetArea = summary.selectedCorridor.area;
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(targetArea);
      }
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    };
  }
}
