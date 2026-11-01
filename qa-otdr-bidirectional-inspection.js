/**
 * Shahdara ISP Billing & Network Operations - Subscriber Optical Time-Domain Reflectometry (OTDR)
 * Bidirectional Trace Averaging & Splice Gainer Elimination QA Certification Suite
 * Standards: ITU-T G.650.1, ITU-T G.652.D, ITU-T G.657, IEC 60793-1-40, and ITU-T L.12 / L.400 / L.201
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Certification
 */

export const BIDIRECTIONAL_OTDR_STORAGE_KEY = 'shahdara_otdr_bidirectional_certs_v1';

export const OTDR_WAVELENGTHS = {
  '1310': { wavelengthNm: 1310, name: '1310 nm (O-band / Upstream)', standardFiberAttenuation: 0.34 },
  '1490': { wavelengthNm: 1490, name: '1490 nm (S-band / GPON Downstream)', standardFiberAttenuation: 0.24 },
  '1550': { wavelengthNm: 1550, name: '1550 nm (C-band / Primary Benchmark)', standardFiberAttenuation: 0.20 },
  '1577': { wavelengthNm: 1577, name: '1577 nm (L-band / XGS-PON Downstream)', standardFiberAttenuation: 0.21 },
  '1625': { wavelengthNm: 1625, name: '1625 nm (U-band / In-Service Maintenance)', standardFiberAttenuation: 0.23 }
};

export const OTDR_EVENT_TYPES = {
  LAUNCH_CONNECTOR: {
    id: 'LAUNCH_CONNECTOR',
    name: 'Launch Connector (Origin)',
    isReflective: true,
    maxAllowedLossDb: 0.50,
    typicalLossDb: 0.35,
    icon: '🔌'
  },
  FUSION_SPLICE: {
    id: 'FUSION_SPLICE',
    name: 'Fusion Splice Joint',
    isReflective: false,
    maxAllowedLossDb: 0.10,
    typicalLossDb: 0.04,
    icon: '⚡'
  },
  SPLITTER_PLC: {
    id: 'SPLITTER_PLC',
    name: 'Optical Splitter (PLC)',
    isReflective: false,
    maxAllowedLossDb: 11.50,
    typicalLossDb: 10.40,
    icon: '🔀'
  },
  MACROBEND: {
    id: 'MACROBEND',
    name: 'Macro-Bend Leakage Point',
    isReflective: false,
    maxAllowedLossDb: 0.30,
    typicalLossDb: 0.15,
    icon: '🔄'
  },
  MECHANICAL_SPLICE: {
    id: 'MECHANICAL_SPLICE',
    name: 'Mechanical Splice / Quick Field Joint',
    isReflective: true,
    maxAllowedLossDb: 0.30,
    typicalLossDb: 0.20,
    icon: '🗜️'
  },
  TERMINAL_REFLECTIVE: {
    id: 'TERMINAL_REFLECTIVE',
    name: 'Demarcation Terminal / Drop End',
    isReflective: true,
    maxAllowedLossDb: 0.75,
    typicalLossDb: 0.40,
    icon: '🏁'
  }
};

export const OTDR_ROUTE_PRESETS = [
  {
    id: 'ROUTE_BARADARI_TRUNK',
    name: 'Baradari Trunk Feeder to Ring-A',
    originNode: 'Shahdara Baradari Central OLT PoP',
    terminusNode: 'Jia Musa Secondary Distribution Hub (FDT-04)',
    spanLengthKm: 14.8,
    wavelengthNm: 1550,
    events: [
      { id: 'E1', distanceKm: 0.00, type: 'LAUNCH_CONNECTOR', lossAtoB: 0.32, lossBtoA: 0.28, reflectanceDb: -48.5, description: 'OLT SFP+ SC/APC Launch Pigtail' },
      { id: 'E2', distanceKm: 3.45, type: 'FUSION_SPLICE', lossAtoB: -0.14, lossBtoA: 0.28, reflectanceDb: null, description: 'Manhole 12 Splice Tray (G.652.D to G.657 transition gainer)' },
      { id: 'E3', distanceKm: 7.20, type: 'FUSION_SPLICE', lossAtoB: 0.22, lossBtoA: -0.10, reflectanceDb: null, description: 'Old Ravi Bridge Siphon Splice Enclosure' },
      { id: 'E4', distanceKm: 11.10, type: 'MACROBEND', lossAtoB: 0.18, lossBtoA: 0.16, reflectanceDb: null, description: 'Pole 44 Tight Overhead Turn' },
      { id: 'E5', distanceKm: 14.80, type: 'TERMINAL_REFLECTIVE', lossAtoB: 0.42, lossBtoA: 0.38, reflectanceDb: -42.0, description: 'Jia Musa FDT-04 Feeder Ingress SC/APC Adapter' }
    ]
  },
  {
    id: 'ROUTE_VANDALA_LINK',
    name: 'Vandala Road Feeder to Rachna Town',
    originNode: 'Vandala Road Primary FDT Node',
    terminusNode: 'Rachna Town FAT-08 Drop Cluster',
    spanLengthKm: 8.2,
    wavelengthNm: 1550,
    events: [
      { id: 'E1', distanceKm: 0.00, type: 'LAUNCH_CONNECTOR', lossAtoB: 0.25, lossBtoA: 0.30, reflectanceDb: -52.0, description: 'Vandala FDT Cassette Port 01' },
      { id: 'E2', distanceKm: 2.80, type: 'FUSION_SPLICE', lossAtoB: -0.18, lossBtoA: 0.32, reflectanceDb: null, description: 'Post Office Crossing Joint Closure (MFD Mismatch Gainer)' },
      { id: 'E3', distanceKm: 5.60, type: 'FUSION_SPLICE', lossAtoB: 0.06, lossBtoA: 0.04, reflectanceDb: null, description: 'Bhatti Chowk Overhead Aerial Joint Closure' },
      { id: 'E4', distanceKm: 8.20, type: 'TERMINAL_REFLECTIVE', lossAtoB: 0.36, lossBtoA: 0.34, reflectanceDb: -45.5, description: 'Rachna Town FAT-08 Ingress Port' }
    ]
  },
  {
    id: 'ROUTE_JIA_MUSA_RING',
    name: 'Jia Musa Commercial Ring Backbone',
    originNode: 'Jia Musa Ring Point Alpha',
    terminusNode: 'Begum Kot Secondary ODF',
    spanLengthKm: 11.5,
    wavelengthNm: 1310,
    events: [
      { id: 'E1', distanceKm: 0.00, type: 'LAUNCH_CONNECTOR', lossAtoB: 0.30, lossBtoA: 0.28, reflectanceDb: -50.0, description: 'Jia Musa Patch Panel Port 12' },
      { id: 'E2', distanceKm: 3.10, type: 'FUSION_SPLICE', lossAtoB: 0.08, lossBtoA: 0.06, reflectanceDb: null, description: 'Kala Khatai Road Splice Chamber' },
      { id: 'E3', distanceKm: 6.80, type: 'FUSION_SPLICE', lossAtoB: -0.11, lossBtoA: 0.25, reflectanceDb: null, description: 'Shahdara Railway Track Underpass Splice' },
      { id: 'E4', distanceKm: 9.40, type: 'FUSION_SPLICE', lossAtoB: 0.05, lossBtoA: 0.07, reflectanceDb: null, description: 'Imamia Colony Feeder Joint' },
      { id: 'E5', distanceKm: 11.50, type: 'TERMINAL_REFLECTIVE', lossAtoB: 0.38, lossBtoA: 0.40, reflectanceDb: -46.0, description: 'Begum Kot Main ODF Demarcation' }
    ]
  },
  {
    id: 'ROUTE_BEGUM_KOT_FEEDER',
    name: 'Begum Kot Commercial Feeder Link',
    originNode: 'Begum Kot Main Central Hub',
    terminusNode: 'Niazi Chowk Commercial Strip FAT-02',
    spanLengthKm: 6.4,
    wavelengthNm: 1550,
    events: [
      { id: 'E1', distanceKm: 0.00, type: 'LAUNCH_CONNECTOR', lossAtoB: 0.22, lossBtoA: 0.26, reflectanceDb: -54.0, description: 'Begum Kot Fiber Patch Bay' },
      { id: 'E2', distanceKm: 2.40, type: 'FUSION_SPLICE', lossAtoB: -0.15, lossBtoA: 0.29, reflectanceDb: null, description: 'Sheikhupura Road Aerial Branch Splice' },
      { id: 'E3', distanceKm: 4.80, type: 'FUSION_SPLICE', lossAtoB: 0.07, lossBtoA: 0.05, reflectanceDb: null, description: 'Market Lateral Joint Box' },
      { id: 'E4', distanceKm: 6.40, type: 'TERMINAL_REFLECTIVE', lossAtoB: 0.32, lossBtoA: 0.30, reflectanceDb: -47.0, description: 'Niazi Chowk FAT-02 Terminal Ingress' }
    ]
  },
  {
    id: 'ROUTE_RAVI_SIPHON_CROSS',
    name: 'Ravi Siphon High-Span Aerial Crossing',
    originNode: 'Baradari Riverbank Mast Tower Node',
    terminusNode: 'Shahdara North Distribution Tower Node',
    spanLengthKm: 18.6,
    wavelengthNm: 1625,
    events: [
      { id: 'E1', distanceKm: 0.00, type: 'LAUNCH_CONNECTOR', lossAtoB: 0.35, lossBtoA: 0.32, reflectanceDb: -50.0, description: 'Riverbank Tower Mast ODF Port' },
      { id: 'E2', distanceKm: 4.50, type: 'FUSION_SPLICE', lossAtoB: 0.06, lossBtoA: 0.08, reflectanceDb: null, description: 'Anchor Pole 10 ADSS Splice Enclosure' },
      { id: 'E3', distanceKm: 9.30, type: 'FUSION_SPLICE', lossAtoB: -0.22, lossBtoA: 0.38, reflectanceDb: null, description: 'Mid-River Siphon Suspension Tower Splice (Core Disparity Gainer)' },
      { id: 'E4', distanceKm: 14.10, type: 'MACROBEND', lossAtoB: 0.25, lossBtoA: 0.22, reflectanceDb: null, description: 'North Bank Anchor Sag Tension Point' },
      { id: 'E5', distanceKm: 18.60, type: 'TERMINAL_REFLECTIVE', lossAtoB: 0.45, lossBtoA: 0.40, reflectanceDb: -44.0, description: 'North Distribution ODF Terminal' }
    ]
  }
];

export const BIDIRECTIONAL_QA_VERDICTS = {
  CERTIFIED_PASS: {
    id: 'CERTIFIED_PASS',
    label: 'CERTIFIED PASS (ITU-T G.650.1 COMPLIANT)',
    badgeClass: 'badge-success',
    colorHex: '#10b981',
    description: 'All splice gainers eliminated via bidirectional averaging. Every event loss is strictly within ITU-T G.652 thresholds.'
  },
  ACCEPTABLE_PASS: {
    id: 'ACCEPTABLE_PASS',
    label: 'ACCEPTABLE PASS (WITH MINOR VARIATIONS)',
    badgeClass: 'badge-info',
    colorHex: '#0284c7',
    description: 'Bidirectional true loss verified. Minor non-critical attenuation elevation observed, but suitable for carrier grade service.'
  },
  RESPLICE_ADVISORY: {
    id: 'RESPLICE_ADVISORY',
    label: 'RESPLICE ADVISORY (EXCEEDS SPLICE BUDGET)',
    badgeClass: 'badge-warning',
    colorHex: '#f59e0b',
    description: 'One or more fusion joints exceed 0.10 dB true loss after eliminating false gainers. Maintenance resplicing recommended.'
  },
  CRITICAL_FAULT: {
    id: 'CRITICAL_FAULT',
    label: 'CRITICAL FAULT / UNRESOLVED ANOMALY',
    badgeClass: 'badge-danger',
    colorHex: '#ef4444',
    description: 'True bidirectional loss indicates excessive insertion loss (>0.50 dB splice or severe macrobend). Lineman repair mandatory.'
  }
};

/**
 * Calculates bidirectional OTDR trace averaging and resolves false gainers.
 * Formulates the physical loss according to ITU-T G.650.1 and IEC 60793-1-40.
 *
 * True Loss: alpha_true = (alpha_AtoB + alpha_BtoA) / 2
 * Differential backscatter coefficient: delta_K = (alpha_AtoB - alpha_BtoA) / 2
 *
 * @param {Object} params
 * @param {Array<Object>} params.events
 * @param {number} [params.fiberLengthKm=10.0]
 * @param {number} [params.wavelengthNm=1550]
 * @param {number} [params.customAttenuationDbPerKm]
 * @returns {Object} Calculated link metrics and evaluated events
 */
export function calculateBidirectionalAveraging({
  events = [],
  fiberLengthKm = 10.0,
  wavelengthNm = 1550,
  customAttenuationDbPerKm = null
} = {}) {
  const lengthKm = Math.max(0.1, Number(fiberLengthKm) || 10.0);
  const wlConfig = OTDR_WAVELENGTHS[String(wavelengthNm)] || OTDR_WAVELENGTHS['1550'];
  const fiberAttenuationRate = typeof customAttenuationDbPerKm === 'number' && customAttenuationDbPerKm > 0
    ? customAttenuationDbPerKm
    : wlConfig.standardFiberAttenuation;

  const evaluatedEvents = [];
  let sumEventLossTrueDb = 0;
  let sumEventLossAtoBDb = 0;
  let sumEventLossBtoADb = 0;
  let gainerCount = 0;
  let respliceRequiredCount = 0;
  let criticalCount = 0;

  const list = Array.isArray(events) ? events : [];

  list.forEach((ev, idx) => {
    const distanceKm = Math.max(0, Number(ev.distanceKm) || 0);
    const lossAtoB = Number(ev.lossAtoB) || 0;
    const lossBtoA = Number(ev.lossBtoA) || 0;
    const eventTypeKey = ev.type && OTDR_EVENT_TYPES[ev.type] ? ev.type : 'FUSION_SPLICE';
    const typeMeta = OTDR_EVENT_TYPES[eventTypeKey];

    // Arithmetic bidirectional average eliminates Rayleigh backscatter difference
    const trueLossDb = Number(((lossAtoB + lossBtoA) / 2).toFixed(3));
    const backscatterDeltaDb = Number(((lossAtoB - lossBtoA) / 2).toFixed(3));
    const isGainerAtoB = lossAtoB < 0;
    const isGainerBtoA = lossBtoA < 0;
    const isGainer = isGainerAtoB || isGainerBtoA;

    if (isGainer) {
      gainerCount++;
    }

    sumEventLossTrueDb += trueLossDb;
    sumEventLossAtoBDb += lossAtoB;
    sumEventLossBtoADb += lossBtoA;

    // Quality determination per event
    let eventVerdict = 'PASS';
    let statusNote = 'Compliant';

    if (isGainer && trueLossDb < 0) {
      eventVerdict = 'FAULT';
      statusNote = 'Unphysical persistent negative loss. Check trace normalization / OTDR launch fiber calibration.';
      criticalCount++;
    } else if (eventTypeKey === 'FUSION_SPLICE') {
      if (trueLossDb <= 0.05) {
        eventVerdict = 'EXCELLENT';
        statusNote = isGainer ? 'False gainer eliminated; excellent joint (<0.05 dB).' : 'Excellent fusion joint (<0.05 dB).';
      } else if (trueLossDb <= typeMeta.maxAllowedLossDb) {
        eventVerdict = 'PASS';
        statusNote = isGainer ? 'False gainer eliminated; passes ITU-T G.652 standard (<=0.10 dB).' : 'Passes standard splice budget.';
      } else if (trueLossDb <= 0.25) {
        eventVerdict = 'WARNING';
        statusNote = 'Splice loss elevated (>0.10 dB). Scheduled clean/resplice recommended.';
        respliceRequiredCount++;
      } else {
        eventVerdict = 'FAIL';
        statusNote = 'Severe splice loss (>0.25 dB). Immediate field resplicing required.';
        respliceRequiredCount++;
        criticalCount++;
      }
    } else if (eventTypeKey === 'LAUNCH_CONNECTOR' || eventTypeKey === 'TERMINAL_REFLECTIVE' || eventTypeKey === 'MECHANICAL_SPLICE') {
      if (trueLossDb <= typeMeta.maxAllowedLossDb) {
        eventVerdict = 'PASS';
        statusNote = 'Connection within insertion loss tolerance.';
      } else {
        eventVerdict = 'WARNING';
        statusNote = 'Connector insertion loss exceeds budget. Clean optical ferrule with lint-free cassette.';
        respliceRequiredCount++;
      }
    } else if (eventTypeKey === 'MACROBEND') {
      if (trueLossDb <= 0.20) {
        eventVerdict = 'PASS';
        statusNote = 'Acceptable trajectory curve.';
      } else {
        eventVerdict = 'WARNING';
        statusNote = 'Excessive bend attenuation. Relax slack loop radius.';
        respliceRequiredCount++;
      }
    } else if (eventTypeKey === 'SPLITTER_PLC') {
      if (trueLossDb <= typeMeta.maxAllowedLossDb) {
        eventVerdict = 'PASS';
        statusNote = 'PLC splitter port insertion loss within factory calibration.';
      } else {
        eventVerdict = 'WARNING';
        statusNote = 'Splitter insertion loss above factory budget.';
        respliceRequiredCount++;
      }
    }

    evaluatedEvents.push({
      id: ev.id || `EV-${idx + 1}`,
      distanceKm,
      type: eventTypeKey,
      typeMeta,
      lossAtoB,
      lossBtoA,
      trueLossDb,
      backscatterDeltaDb,
      isGainer,
      isGainerAtoB,
      isGainerBtoA,
      reflectanceDb: ev.reflectanceDb !== null && ev.reflectanceDb !== undefined ? Number(ev.reflectanceDb) : null,
      description: ev.description || `${typeMeta.name} @ ${distanceKm.toFixed(2)} km`,
      verdict: eventVerdict,
      statusNote
    });
  });

  // Calculate total distributed link loss
  const fiberDistributedLossDb = Number((lengthKm * fiberAttenuationRate).toFixed(3));
  const totalTrueLossDb = Number((fiberDistributedLossDb + sumEventLossTrueDb).toFixed(3));
  const apparentLossAtoBDb = Number((fiberDistributedLossDb + sumEventLossAtoBDb).toFixed(3));
  const apparentLossBtoADb = Number((fiberDistributedLossDb + sumEventLossBtoADb).toFixed(3));
  const meanAttenuationDbPerKm = Number((totalTrueLossDb / lengthKm).toFixed(3));

  // Determine Overall Verdict
  let overallVerdict;
  if (criticalCount > 0) {
    overallVerdict = BIDIRECTIONAL_QA_VERDICTS.CRITICAL_FAULT;
  } else if (respliceRequiredCount > 0) {
    overallVerdict = BIDIRECTIONAL_QA_VERDICTS.RESPLICE_ADVISORY;
  } else if (meanAttenuationDbPerKm > fiberAttenuationRate + 0.12) {
    overallVerdict = BIDIRECTIONAL_QA_VERDICTS.ACCEPTABLE_PASS;
  } else {
    overallVerdict = BIDIRECTIONAL_QA_VERDICTS.CERTIFIED_PASS;
  }

  return {
    fiberLengthKm: lengthKm,
    wavelengthNm: wlConfig.wavelengthNm,
    wavelengthConfig: wlConfig,
    fiberAttenuationRate,
    fiberDistributedLossDb,
    sumEventLossTrueDb: Number(sumEventLossTrueDb.toFixed(3)),
    sumEventLossAtoBDb: Number(sumEventLossAtoBDb.toFixed(3)),
    sumEventLossBtoADb: Number(sumEventLossBtoADb.toFixed(3)),
    totalTrueLossDb,
    apparentLossAtoBDb,
    apparentLossBtoADb,
    meanAttenuationDbPerKm,
    gainerCount,
    respliceRequiredCount,
    criticalCount,
    overallVerdict,
    events: evaluatedEvents
  };
}

/**
 * Renders an interactive, SVG visualization of the bidirectional OTDR traces.
 * Highlights Trace A->B, Trace B->A, and the True Averaged Trace with event markers.
 *
 * @param {Object} params
 * @param {Array<Object>} params.events
 * @param {number} [params.fiberLengthKm=10.0]
 * @param {number} [params.wavelengthNm=1550]
 * @param {number} [params.width=720]
 * @param {number} [params.height=280]
 * @returns {string} SVG markup string
 */
export function renderBidirectionalOtdrSvg({
  events = [],
  fiberLengthKm = 10.0,
  wavelengthNm = 1550,
  width = 720,
  height = 280
} = {}) {
  const result = calculateBidirectionalAveraging({ events, fiberLengthKm, wavelengthNm });
  const spanKm = Math.max(0.1, result.fiberLengthKm);

  const padLeft = 60;
  const padRight = 30;
  const padTop = 35;
  const padBottom = 45;

  const chartW = Math.max(100, width - padLeft - padRight);
  const chartH = Math.max(80, height - padTop - padBottom);

  // Maximum cumulative loss to set vertical scale (e.g., from 0 dB to maxLoss + 2 dB)
  const maxLoss = Math.max(3.0, Math.ceil(result.totalTrueLossDb + 2));
  const minLoss = 0.0;

  // Scale helpers
  const scaleX = (km) => padLeft + (km / spanKm) * chartW;
  const scaleY = (db) => padTop + ((db - minLoss) / (maxLoss - minLoss)) * chartH;

  // Build trace points for:
  // 1. Trace A -> B (origin at km=0)
  // 2. Trace B -> A (origin at km=spanKm running backwards)
  // 3. True Averaged Trace

  const sortedEvents = [...result.events].sort((a, b) => a.distanceKm - b.distanceKm);

  // Trace A -> B cumulative curve
  let pointsAtoB = [];
  let curLossA = 0;
  let curKmA = 0;
  pointsAtoB.push(`${scaleX(0)},${scaleY(0)}`);

  sortedEvents.forEach(ev => {
    // Distributed attenuation up to event
    curLossA += (ev.distanceKm - curKmA) * result.fiberAttenuationRate;
    curKmA = ev.distanceKm;
    pointsAtoB.push(`${scaleX(curKmA)},${scaleY(curLossA)}`);
    // Event step (can be negative for gainer)
    curLossA += ev.lossAtoB;
    pointsAtoB.push(`${scaleX(curKmA)},${scaleY(curLossA)}`);
  });
  // End of fiber
  curLossA += (spanKm - curKmA) * result.fiberAttenuationRate;
  pointsAtoB.push(`${scaleX(spanKm)},${scaleY(curLossA)}`);

  // Trace B -> A cumulative curve (graphed from left to right for direct visual comparison)
  // At km=spanKm, loss is 0; as km decreases toward 0, loss accumulates.
  // In our display, we plot loss measured from Terminal B mapped across span distance.
  let pointsBtoA = [];
  let curLossB = 0;
  let curKmB = spanKm;
  const revEvents = [...sortedEvents].reverse();

  // Create lookup for B->A loss at each km
  // To show visually how B->A experiences the link, we plot cumulative loss from B at each distance
  let ptsB = [{ km: spanKm, loss: 0 }];
  revEvents.forEach(ev => {
    curLossB += (curKmB - ev.distanceKm) * result.fiberAttenuationRate;
    curKmB = ev.distanceKm;
    ptsB.push({ km: curKmB, loss: curLossB });
    curLossB += ev.lossBtoA;
    ptsB.push({ km: curKmB, loss: curLossB });
  });
  curLossB += curKmB * result.fiberAttenuationRate;
  ptsB.push({ km: 0, loss: curLossB });

  // Map to points left-to-right
  const sortedPtsB = ptsB.sort((a, b) => a.km - b.km);
  pointsBtoA = sortedPtsB.map(p => `${scaleX(p.km)},${scaleY(p.loss)}`);

  // True Averaged Trace cumulative curve
  let pointsTrue = [];
  let curLossTrue = 0;
  let curKmTrue = 0;
  pointsTrue.push(`${scaleX(0)},${scaleY(0)}`);

  sortedEvents.forEach(ev => {
    curLossTrue += (ev.distanceKm - curKmTrue) * result.fiberAttenuationRate;
    curKmTrue = ev.distanceKm;
    pointsTrue.push(`${scaleX(curKmTrue)},${scaleY(curLossTrue)}`);
    curLossTrue += ev.trueLossDb;
    pointsTrue.push(`${scaleX(curKmTrue)},${scaleY(curLossTrue)}`);
  });
  curLossTrue += (spanKm - curKmTrue) * result.fiberAttenuationRate;
  pointsTrue.push(`${scaleX(spanKm)},${scaleY(curLossTrue)}`);

  // Grid lines
  const gridLinesY = [];
  const yStep = maxLoss <= 5 ? 1 : maxLoss <= 15 ? 2 : 5;
  for (let db = 0; db <= maxLoss; db += yStep) {
    const y = scaleY(db);
    gridLinesY.push(`
      <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#334155" stroke-width="1" stroke-dasharray="3 3"/>
      <text x="${padLeft - 8}" y="${y + 4}" fill="#94a3b8" font-size="10" text-anchor="end" font-family="monospace">${db} dB</text>
    `);
  }

  const gridLinesX = [];
  const xStep = spanKm <= 5 ? 1 : spanKm <= 15 ? 2 : spanKm <= 30 ? 5 : 10;
  for (let km = 0; km <= spanKm; km += xStep) {
    const x = scaleX(km);
    gridLinesX.push(`
      <line x1="${x}" y1="${padTop}" x2="${x}" y2="${height - padBottom}" stroke="#334155" stroke-width="1" stroke-dasharray="3 3"/>
      <text x="${x}" y="${height - padBottom + 16}" fill="#94a3b8" font-size="10" text-anchor="middle" font-family="monospace">${km} km</text>
    `);
  }

  // Event markers
  const eventMarkers = sortedEvents.map(ev => {
    const x = scaleX(ev.distanceKm);
    const markerColor = ev.isGainer ? '#f59e0b' : ev.trueLossDb > 0.10 ? '#ef4444' : '#10b981';
    const markerIcon = ev.isGainer ? '▲ GAIN' : `${ev.trueLossDb}dB`;
    return `
      <g class="otdr-event-marker" transform="translate(${x}, 0)">
        <line x1="0" y1="${padTop}" x2="0" y2="${height - padBottom}" stroke="${markerColor}" stroke-width="1.5" stroke-dasharray="2 2" opacity="0.8"/>
        <circle cx="0" cy="${scaleY(ev.distanceKm * result.fiberAttenuationRate + ev.trueLossDb)}" r="5" fill="${markerColor}" stroke="#ffffff" stroke-width="1.5"/>
        <rect x="-24" y="${padTop - 22}" width="48" height="16" rx="3" fill="#1e293b" stroke="${markerColor}" stroke-width="1"/>
        <text x="0" y="${padTop - 10}" fill="${markerColor}" font-size="8" font-weight="bold" text-anchor="middle" font-family="sans-serif">${markerIcon}</text>
      </g>
    `;
  }).join('');

  return `
    <svg class="bidirectional-otdr-svg" viewBox="0 0 ${width} ${height}" width="100%"  xmlns="http://www.w3.org/2000/svg" style="background:#0b1329; border-radius:8px; border:1px solid #1e293b; user-select:none;">
      <!-- Title & Header HUD -->
      <text x="${padLeft}" y="20" fill="#f8fafc" font-size="12" font-weight="700" font-family="sans-serif">
        BIDIRECTIONAL OTDR TRACE AVERAGING [${result.wavelengthNm}nm]
      </text>
      <text x="${width - padRight}" y="20" fill="#38bdf8" font-size="11" font-weight="600" text-anchor="end" font-family="monospace">
        Span: ${result.fiberLengthKm.toFixed(1)} km | True Loss: ${result.totalTrueLossDb.toFixed(2)} dB | Gainers: ${result.gainerCount}
      </text>

      <!-- Grid -->
      ${gridLinesY.join('')}
      ${gridLinesX.join('')}

      <!-- Traces -->
      <!-- Trace A->B (Cyan) -->
      <polyline points="${pointsAtoB.join(' ')}" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linejoin="round" opacity="0.85"/>

      <!-- Trace B->A (Amber) -->
      <polyline points="${pointsBtoA.join(' ')}" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="4 2" stroke-linejoin="round" opacity="0.75"/>

      <!-- True Averaged Trace (Lime Green Solid) -->
      <polyline points="${pointsTrue.join(' ')}" fill="none" stroke="#10b981" stroke-width="2.6" stroke-linejoin="round"/>

      <!-- Event Markers -->
      ${eventMarkers}

      <!-- Axes Border -->
      <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${height - padBottom}" stroke="#64748b" stroke-width="1.5"/>
      <line x1="${padLeft}" y1="${height - padBottom}" x2="${width - padRight}" y2="${height - padBottom}" stroke="#64748b" stroke-width="1.5"/>

      <!-- Axis Labels -->
      <text x="${padLeft - 35}" y="${padTop + chartH / 2}" fill="#94a3b8" font-size="10" font-weight="bold" font-family="sans-serif" transform="rotate(-90 ${padLeft - 35} ${padTop + chartH / 2})" text-anchor="middle">Attenuation (dB)</text>
      <text x="${padLeft + chartW / 2}" y="${height - 10}" fill="#94a3b8" font-size="10" font-weight="bold" font-family="sans-serif" text-anchor="middle">Distance Along Span (km)</text>

      <!-- Legend -->
      <g transform="translate(${width - padRight - 260}, ${height - padBottom - 24})">
        <rect x="0" y="0" width="250" height="20" rx="3" fill="#0f172a" fill-opacity="0.9" stroke="#334155" stroke-width="1"/>
        <line x1="10" y1="10" x2="25" y2="10" stroke="#38bdf8" stroke-width="2"/>
        <text x="30" y="13" fill="#94a3b8" font-size="9" font-family="sans-serif">A→B</text>

        <line x1="65" y1="10" x2="80" y2="10" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="3 2"/>
        <text x="85" y="13" fill="#94a3b8" font-size="9" font-family="sans-serif">B→A</text>

        <line x1="120" y1="10" x2="140" y2="10" stroke="#10b981" stroke-width="2.5"/>
        <text x="145" y="13" fill="#10b981" font-size="9" font-weight="bold" font-family="sans-serif">True Avg (ITU-T)</text>
      </g>
    </svg>
  `;
}

/**
 * Builds a persistent record for a certified bidirectional OTDR trace inspection.
 *
 * @param {Object} data
 * @param {Array<Object>} [existingRecords=[]]
 * @returns {Object} Complete cert record
 */
export function buildBidirectionalOtdrCertRecord(data = {}, existingRecords = []) {
  const count = Array.isArray(existingRecords) ? existingRecords.length : 0;
  const now = new Date();
  const certId = `OTDR-BI-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;

  const calc = calculateBidirectionalAveraging({
    events: data.events || [],
    fiberLengthKm: data.fiberLengthKm,
    wavelengthNm: data.wavelengthNm,
    customAttenuationDbPerKm: data.customAttenuationDbPerKm
  });

  return {
    id: certId,
    timestamp: now.toISOString(),
    customerNumber: data.customerNumber || '—',
    customerName: data.customerName || 'Shahdara Network Subscriber',
    customerPhone: data.customerPhone || '—',
    area: data.area || 'Shahdara Area',
    routeName: data.routeName || 'Baradari Trunk Feeder to Ring-A',
    originNode: data.originNode || 'Shahdara Baradari Central OLT PoP',
    terminusNode: data.terminusNode || 'Jia Musa Secondary Distribution Hub (FDT-04)',
    fiberLengthKm: calc.fiberLengthKm,
    wavelengthNm: calc.wavelengthNm,
    fiberAttenuationRate: calc.fiberAttenuationRate,
    fiberDistributedLossDb: calc.fiberDistributedLossDb,
    sumEventLossTrueDb: calc.sumEventLossTrueDb,
    totalTrueLossDb: calc.totalTrueLossDb,
    apparentLossAtoBDb: calc.apparentLossAtoBDb,
    apparentLossBtoADb: calc.apparentLossBtoADb,
    meanAttenuationDbPerKm: calc.meanAttenuationDbPerKm,
    gainerCount: calc.gainerCount,
    respliceRequiredCount: calc.respliceRequiredCount,
    verdict: calc.overallVerdict.id,
    verdictLabel: calc.overallVerdict.label,
    verdictBadgeClass: calc.overallVerdict.badgeClass,
    verdictColorHex: calc.overallVerdict.colorHex,
    technicianName: data.technicianName || 'Shahdara Optical QA Field Tech',
    notes: data.notes || '',
    events: calc.events.map(ev => ({
      id: ev.id,
      distanceKm: ev.distanceKm,
      type: ev.type,
      lossAtoB: ev.lossAtoB,
      lossBtoA: ev.lossBtoA,
      trueLossDb: ev.trueLossDb,
      backscatterDeltaDb: ev.backscatterDeltaDb,
      isGainer: ev.isGainer,
      verdict: ev.verdict,
      description: ev.description,
      statusNote: ev.statusNote
    }))
  };
}

/**
 * Retrieves saved certificates from local storage.
 * @param {Storage|Object} [storage=localStorage]
 * @returns {Array<Object>}
 */
export function getSavedBidirectionalOtdrCerts(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(BIDIRECTIONAL_OTDR_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading bidirectional OTDR certificates from storage:', err);
    return [];
  }
}

/**
 * Saves a certificate record to storage.
 * @param {Object} cert
 * @param {Storage|Object} [storage=localStorage]
 * @returns {Array<Object>} Updated list of records
 */
export function saveBidirectionalOtdrCert(cert, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !cert) return [];
  try {
    const existing = getSavedBidirectionalOtdrCerts(storage);
    const updated = [cert, ...existing.filter(item => item.id !== cert.id)];
    storage.setItem(BIDIRECTIONAL_OTDR_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Error saving bidirectional OTDR certificate to storage:', err);
    return [];
  }
}

/**
 * Clears all saved bidirectional OTDR certificates.
 * @param {Storage|Object} [storage=localStorage]
 */
export function clearBidirectionalOtdrCerts(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.removeItem(BIDIRECTIONAL_OTDR_STORAGE_KEY);
  } catch (err) {
    console.error('Error clearing bidirectional OTDR certificates:', err);
  }
}

/**
 * Generates formatted WhatsApp notice for technician and subscriber dispatch.
 * @param {Object} record
 * @returns {string} Plaintext formatted for WhatsApp
 */
export function formatBidirectionalOtdrCertWhatsApp(record) {
  if (!record) return '';
  const dateStr = record.timestamp ? new Date(record.timestamp).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) : 'N/A';
  const gainerText = record.gainerCount > 0
    ? `⚠️ *False Gainers Eliminated:* ${record.gainerCount} joint(s) corrected via bidirectional math`
    : `✅ *Zero Gainers:* Mode field diameter matched along entire link`;

  const eventLines = (record.events || []).map(ev => {
    const tag = ev.isGainer ? ' [GAINER CORRECTED]' : '';
    return ` • ${ev.distanceKm.toFixed(2)}km: ${ev.type} | A→B: ${ev.lossAtoB > 0 ? '+' : ''}${ev.lossAtoB.toFixed(2)}dB | B→A: ${ev.lossBtoA > 0 ? '+' : ''}${ev.lossBtoA.toFixed(2)}dB ➔ *True: ${ev.trueLossDb.toFixed(2)}dB*${tag}`;
  }).join('\n');

  return `*SHAHDARA FIBER NETWORK OPERATIONS*
*OPTICAL OTDR BIDIRECTIONAL QA CERTIFICATE*
📜 *Certificate No:* ${record.id}
📅 *Date & Time:* ${dateStr}
👤 *Subscriber / Route:* ${record.customerName} (${record.customerNumber || 'N/A'})
📍 *Area / Span:* ${record.area} | ${record.routeName || 'Trunk'}
⚡ *Origin PoP:* ${record.originNode || 'Central OLT'}
🏁 *Terminus Node:* ${record.terminusNode || 'FAT/FDT'}
──────────────────────────
🔬 *OPTICAL TELEMETRY:*
 • *Span Distance:* ${Number(record.fiberLengthKm || 0).toFixed(2)} km
 • *Test Wavelength:* ${record.wavelengthNm || 1550} nm
 • *Apparent Loss A→B:* ${Number(record.apparentLossAtoBDb || 0).toFixed(2)} dB
 • *Apparent Loss B→A:* ${Number(record.apparentLossBtoADb || 0).toFixed(2)} dB
 • *TRUE LINK LOSS (ITU-T):* *${Number(record.totalTrueLossDb || 0).toFixed(2)} dB*
 • *Mean Attenuation:* ${Number(record.meanAttenuationDbPerKm || 0).toFixed(3)} dB/km
${gainerText}

📊 *KEY EVENT BREAKDOWN:*
${eventLines || 'No discrete events recorded.'}

🎯 *COMPLIANCE VERDICT:* *${record.verdictLabel || record.verdict}*
👨‍🔧 *QA Certifier:* ${record.technicianName || 'Shahdara QA Lineman'}
📝 *Notes:* ${record.notes || 'Span verified in accordance with ITU-T G.650.1 / G.652 bidirectional averaging standards.'}
──────────────────────────
_Shahdara ISP Network Operations Center - Baradari Road, Shahdara, Islamabad_`;
}

/**
 * Generates printable HTML certificate for formal A4 compliance sheet or 80mm thermal slip.
 * @param {Object} record
 * @param {Object} [options]
 * @param {'sheet'|'slip'} [options.format='sheet']
 * @returns {string}
 */
export function generateBidirectionalOtdrCertHtml(record, options = {}) {
  if (!record) return '<div>No record provided.</div>';
  const format = options.format || 'sheet';
  const dateStr = record.timestamp ? new Date(record.timestamp).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) : 'N/A';
  const svgChart = renderBidirectionalOtdrSvg({
    events: record.events || [],
    fiberLengthKm: record.fiberLengthKm,
    wavelengthNm: record.wavelengthNm,
    width: format === 'slip' ? 320 : 700,
    height: format === 'slip' ? 180 : 260
  });

  if (format === 'slip') {
    // 80mm Field Thermal Slip Format
    return `
      <div class="thermal-otdr-slip" style="width: 290px; font-family: monospace; font-size: 11px; line-height: 1.3; color: #000000; padding: 10px; background: #ffffff;">
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
          <h2 style="margin: 0; font-size: 14px; font-weight: bold; text-transform: uppercase;">SHAHDARA FIBER NET</h2>
          <div style="font-size: 11px; font-weight: bold;">OTDR BIDIRECTIONAL QA SLIP</div>
          <div style="font-size: 10px;">ITU-T G.650.1 / IEC 60793-1-40</div>
        </div>

        <div style="margin-bottom: 8px;">
          <div><strong>CERT ID:</strong> ${record.id}</div>
          <div><strong>DATE:</strong> ${dateStr}</div>
          <div><strong>SUBSCRIBER:</strong> ${record.customerName}</div>
          <div><strong>SPAN:</strong> ${record.routeName || 'Trunk'} (${Number(record.fiberLengthKm || 0).toFixed(2)} km)</div>
          <div><strong>WL:</strong> ${record.wavelengthNm} nm</div>
        </div>

        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin-bottom: 8px;">
          <div><strong>Loss A→B:</strong> ${Number(record.apparentLossAtoBDb || 0).toFixed(2)} dB</div>
          <div><strong>Loss B→A:</strong> ${Number(record.apparentLossBtoADb || 0).toFixed(2)} dB</div>
          <div style="font-size: 12px; font-weight: bold; margin-top: 2px;">
            TRUE LOSS: ${Number(record.totalTrueLossDb || 0).toFixed(2)} dB
          </div>
          <div>Mean Atten: ${Number(record.meanAttenuationDbPerKm || 0).toFixed(3)} dB/km</div>
          <div>Gainers Eliminated: ${record.gainerCount || 0}</div>
        </div>

        <div style="margin-bottom: 8px; text-align: center;">
          <div style="font-size: 10px; font-weight: bold; margin-bottom: 4px;">TRACE PROFILE (A/B/TRUE)</div>
          ${svgChart}
        </div>

        <div style="border-top: 1px dashed #000; padding-top: 6px; margin-bottom: 8px;">
          <div style="font-weight: bold; margin-bottom: 4px;">EVENT AUDIT:</div>
          ${(record.events || []).map(ev => `
            <div style="font-size: 10px; margin-bottom: 2px;">
              ${ev.distanceKm.toFixed(2)}km ${ev.type}: <strong>${ev.trueLossDb.toFixed(2)}dB</strong>
              ${ev.isGainer ? ' [GAIN FIXED]' : ''}
            </div>
          `).join('')}
        </div>

        <div style="text-align: center; border-top: 1px dashed #000; padding-top: 6px; margin-top: 8px;">
          <div style="font-size: 12px; font-weight: bold;">VERDICT: ${record.verdictLabel || record.verdict}</div>
          <div style="font-size: 10px; margin-top: 4px;">TECH: ${record.technicianName}</div>
          <div style="font-size: 9px; margin-top: 6px;">*** CARRIER CERTIFIED FIBER ***</div>
        </div>
      </div>
    `;
  }

  // Formal A4 Compliance Certificate Sheet
  return `
    <div class="a4-otdr-cert" style="max-width: 800px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; background: #ffffff; padding: 30px; border: 1px solid #cbd5e1; box-sizing: border-box;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 20px;">
        <div>
          <h1 style="margin: 0; font-size: 20px; color: #0f172a; letter-spacing: -0.5px;">SHAHDARA ISP &amp; OPTICAL FIBER NETWORK</h1>
          <div style="font-size: 13px; color: #0284c7; font-weight: 700; text-transform: uppercase; margin-top: 4px;">
            Optical Time-Domain Reflectometry (OTDR) Bidirectional Compliance Certificate
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
            Standard Reference: ITU-T G.650.1 / ITU-T G.652.D / IEC 60793-1-40 Splice Gain Elimination
          </div>
        </div>
        <div style="text-align: right;">
          <div style="background: #0f172a; color: #ffffff; padding: 6px 12px; border-radius: 4px; font-family: monospace; font-size: 13px; font-weight: bold;">
            ${record.id}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Issued: ${dateStr}</div>
        </div>
      </div>

      <!-- Scope & Link Specification Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
          <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Customer &amp; Route Demarcation</div>
          <div style="font-size: 12px; line-height: 1.6;">
            <div><strong>Subscriber:</strong> ${record.customerName} (${record.customerNumber})</div>
            <div><strong>Area / District:</strong> ${record.area}</div>
            <div><strong>Route / Feeder:</strong> ${record.routeName || 'Shahdara Feeder'}</div>
            <div><strong>Origin Node (A):</strong> ${record.originNode || 'Central OLT'}</div>
            <div><strong>Terminus Node (B):</strong> ${record.terminusNode || 'FAT Hub'}</div>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
          <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">OTDR Measurement Summary</div>
          <div style="font-size: 12px; line-height: 1.6;">
            <div><strong>Total Span Distance:</strong> ${Number(record.fiberLengthKm || 0).toFixed(2)} km</div>
            <div><strong>Optical Test Wavelength:</strong> ${record.wavelengthNm} nm</div>
            <div><strong>Unidirectional Trace A→B:</strong> ${Number(record.apparentLossAtoBDb || 0).toFixed(2)} dB</div>
            <div><strong>Unidirectional Trace B→A:</strong> ${Number(record.apparentLossBtoADb || 0).toFixed(2)} dB</div>
            <div><strong>TRUE LINK INSERTION LOSS:</strong> <strong style="color: #0284c7; font-size: 13px;">${Number(record.totalTrueLossDb || 0).toFixed(2)} dB</strong></div>
            <div><strong>Mean Link Attenuation:</strong> ${Number(record.meanAttenuationDbPerKm || 0).toFixed(3)} dB/km</div>
          </div>
        </div>
      </div>

      <!-- Graphic Visualizer Trace Overlay -->
      <div style="margin-bottom: 20px;">
        <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">
          Bidirectional Trace Comparison &amp; True Attenuation Profile
        </div>
        ${svgChart}
      </div>

      <!-- Events Breakdown Table -->
      <div style="margin-bottom: 20px;">
        <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">
          Discrete Event Telemetry &amp; Splice Gainer Elimination Ledger
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff;">
              <th style="padding: 6px 8px;">Event</th>
              <th style="padding: 6px 8px;">Distance</th>
              <th style="padding: 6px 8px;">Classification</th>
              <th style="padding: 6px 8px;">Loss A→B</th>
              <th style="padding: 6px 8px;">Loss B→A</th>
              <th style="padding: 6px 8px;">True Loss (Avg)</th>
              <th style="padding: 6px 8px;">Delta K_R</th>
              <th style="padding: 6px 8px;">Verdict</th>
            </tr>
          </thead>
          <tbody>
            ${(record.events || []).map((ev, i) => `
              <tr style="border-bottom: 1px solid #e2e8f0; background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding: 6px 8px; font-weight: bold;">${ev.id}</td>
                <td style="padding: 6px 8px;">${ev.distanceKm.toFixed(2)} km</td>
                <td style="padding: 6px 8px;">${ev.type}</td>
                <td style="padding: 6px 8px; color: ${ev.lossAtoB < 0 ? '#d97706' : 'inherit'}; font-weight: ${ev.lossAtoB < 0 ? 'bold' : 'normal'};">
                  ${ev.lossAtoB > 0 ? '+' : ''}${ev.lossAtoB.toFixed(2)} dB
                </td>
                <td style="padding: 6px 8px; color: ${ev.lossBtoA < 0 ? '#d97706' : 'inherit'}; font-weight: ${ev.lossBtoA < 0 ? 'bold' : 'normal'};">
                  ${ev.lossBtoA > 0 ? '+' : ''}${ev.lossBtoA.toFixed(2)} dB
                </td>
                <td style="padding: 6px 8px; font-weight: bold; color: #0284c7;">${ev.trueLossDb.toFixed(2)} dB</td>
                <td style="padding: 6px 8px; color: #64748b;">${ev.backscatterDeltaDb ? ev.backscatterDeltaDb.toFixed(2) + ' dB' : '0.00 dB'}</td>
                <td style="padding: 6px 8px;">
                  <span style="display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold; background: ${ev.verdict === 'EXCELLENT' || ev.verdict === 'PASS' ? '#dcfce7; color: #15803d;' : '#fee2e2; color: #b91c1c;'}">
                    ${ev.verdict}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Verdict Banner & Sign-Off -->
      <div style="border: 2px solid ${record.verdictColorHex || '#10b981'}; border-radius: 6px; padding: 12px; margin-bottom: 20px; background: #f0fdf4;">
        <div style="font-size: 11px; font-weight: bold; color: ${record.verdictColorHex || '#10b981'}; text-transform: uppercase;">
          QA Operational Certification Verdict
        </div>
        <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 4px 0;">
          ${record.verdictLabel || record.verdict}
        </div>
        <div style="font-size: 11px; color: #334155;">
          ${record.notes || 'Fiber span complies with ITU-T singlemode transmission criteria. Bidirectional mathematical integration verifies splice integrity and eliminates backscatter coefficient discrepancies.'}
        </div>
      </div>

      <!-- Signatures Footer -->
      <div style="display: flex; justify-content: space-between; margin-top: 30px; padding-top: 15px; border-top: 1px solid #cbd5e1; font-size: 11px;">
        <div>
          <div><strong>Certified Field Engineer:</strong> ${record.technicianName}</div>
          <div style="color: #64748b; margin-top: 2px;">Shahdara Fiber Network Operations Center</div>
        </div>
        <div style="text-align: right;">
          <div><strong>NOC Supervisor Sign-off:</strong> _______________________</div>
          <div style="color: #64748b; margin-top: 2px;">Baradari Road, Shahdara Town, Islamabad</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generates CSV export for multiple bidirectional OTDR records.
 * @param {Array<Object>} records
 * @returns {string} CSV text
 */
export function generateBidirectionalOtdrCsv(records = []) {
  const headers = [
    'CertID',
    'Timestamp',
    'CustomerNumber',
    'CustomerName',
    'Area',
    'RouteName',
    'OriginNode',
    'TerminusNode',
    'FiberLengthKm',
    'WavelengthNm',
    'TrueLossDb',
    'ApparentLossAtoBDb',
    'ApparentLossBtoADb',
    'MeanAttenDbPerKm',
    'GainersEliminatedCount',
    'Verdict',
    'Technician',
    'Notes'
  ];

  const rows = (Array.isArray(records) ? records : []).map(r => {
    return [
      `"${r.id || ''}"`,
      `"${r.timestamp || ''}"`,
      `"${r.customerNumber || ''}"`,
      `"${(r.customerName || '').replace(/"/g, '""')}"`,
      `"${(r.area || '').replace(/"/g, '""')}"`,
      `"${(r.routeName || '').replace(/"/g, '""')}"`,
      `"${(r.originNode || '').replace(/"/g, '""')}"`,
      `"${(r.terminusNode || '').replace(/"/g, '""')}"`,
      Number(r.fiberLengthKm || 0).toFixed(2),
      r.wavelengthNm || 1550,
      Number(r.totalTrueLossDb || 0).toFixed(2),
      Number(r.apparentLossAtoBDb || 0).toFixed(2),
      Number(r.apparentLossBtoADb || 0).toFixed(2),
      Number(r.meanAttenuationDbPerKm || 0).toFixed(3),
      r.gainerCount || 0,
      `"${r.verdict || ''}"`,
      `"${(r.technicianName || '').replace(/"/g, '""')}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Initializes and wires the Bidirectional OTDR QA modal controller.
 *
 * @param {Object} options
 * @param {Storage|Object} [options.storage]
 * @param {Function} [options.onToast]
 * @param {Function} [options.getCustomerData]
 * @param {Document} [options.doc=document]
 * @param {Element} [options.root=document]
 * @returns {Object} Modal controller interface
 */
export function setupBidirectionalOtdrModal({
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  onToast = (msg) => console.log(msg),
  getCustomerData = () => null,
  doc = (typeof document !== 'undefined' ? document : null),
  root = (typeof document !== 'undefined' ? document : null)
} = {}) {
  if (!doc || !root) return null;

  const modal = root.querySelector('#bidirectionalOtdrModal');
  if (!modal) return null;

  const closeBtn = root.querySelector('#bidirectionalOtdrModalCloseBtn');
  const svgContainer = root.querySelector('#bidirectionalOtdrSvgContainer');
  const triggers = root.querySelectorAll('[data-open-bidirectional-otdr]');

  // Inputs
  const presetSelect = root.querySelector('#bidirectionalOtdrPresetSelect');
  const wavelengthSelect = root.querySelector('#bidirectionalOtdrWlSelect');
  const spanSlider = root.querySelector('#bidirectionalOtdrSpanSlider');
  const spanVal = root.querySelector('#bidirectionalOtdrSpanVal');
  const routeInput = root.querySelector('#bidirectionalOtdrRouteInput');
  const originInput = root.querySelector('#bidirectionalOtdrOriginInput');
  const destInput = root.querySelector('#bidirectionalOtdrDestInput');
  const notesInput = root.querySelector('#bidirectionalOtdrNotesInput');

  // KPI Readouts
  const trueLossReadout = root.querySelector('#bidirectionalOtdrTrueLossReadout');
  const apparentAtoBReadout = root.querySelector('#bidirectionalOtdrApparentAtoBReadout');
  const apparentBtoAReadout = root.querySelector('#bidirectionalOtdrApparentBtoAReadout');
  const gainersReadout = root.querySelector('#bidirectionalOtdrGainersReadout');
  const verdictBadge = root.querySelector('#bidirectionalOtdrVerdictBadge');

  // Event Table Editor
  const eventsTableBody = root.querySelector('#bidirectionalOtdrEventsTableBody');
  const addEventBtn = root.querySelector('#bidirectionalOtdrAddEventBtn');

  // History Table
  const historyTableBody = root.querySelector('#bidirectionalOtdrHistoryTableBody');

  // Action Buttons
  const recordBtn = root.querySelector('#bidirectionalOtdrRecordCertBtn');
  const copyReportBtn = root.querySelector('#bidirectionalOtdrCopyReportBtn');
  const printA4Btn = root.querySelector('#bidirectionalOtdrPrintA4Btn');
  const printThermalBtn = root.querySelector('#bidirectionalOtdrPrintThermalBtn');
  const exportCsvBtn = root.querySelector('#bidirectionalOtdrExportCsvBtn');
  const clearHistoryBtn = root.querySelector('#bidirectionalOtdrClearHistoryBtn');

  // State
  let activeCustomer = null;
  let currentEvents = JSON.parse(JSON.stringify(OTDR_ROUTE_PRESETS[0].events));

  function getFormValues() {
    return {
      routeName: routeInput ? routeInput.value.trim() : 'Trunk Span',
      originNode: originInput ? originInput.value.trim() : 'Central OLT',
      terminusNode: destInput ? destInput.value.trim() : 'FAT Node',
      fiberLengthKm: spanSlider ? parseFloat(spanSlider.value) : 10.0,
      wavelengthNm: wavelengthSelect ? parseInt(wavelengthSelect.value, 10) : 1550,
      events: currentEvents
    };
  }

  function renderEventsEditor() {
    if (!eventsTableBody) return;
    eventsTableBody.innerHTML = '';

    currentEvents.forEach((ev, idx) => {
      const tr = doc.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border, #334155)';

      const trueLoss = ((Number(ev.lossAtoB || 0) + Number(ev.lossBtoA || 0)) / 2).toFixed(2);
      const isGainer = Number(ev.lossAtoB || 0) < 0 || Number(ev.lossBtoA || 0) < 0;

      tr.innerHTML = `
        <td style="padding: 6px 8px;">
          <input type="number" step="0.05" min="0" value="${ev.distanceKm}" class="event-dist-input" style="width: 70px; padding: 4px; font-size: 11px; background: var(--bg, #0f172a); border: 1px solid var(--border, #334155); color: inherit; border-radius: 4px;">
        </td>
        <td style="padding: 6px 8px;">
          <select class="event-type-select" style="padding: 4px; font-size: 11px; background: var(--bg, #0f172a); border: 1px solid var(--border, #334155); color: inherit; border-radius: 4px;">
            ${Object.keys(OTDR_EVENT_TYPES).map(k => `
              <option value="${k}" ${ev.type === k ? 'selected' : ''}>${OTDR_EVENT_TYPES[k].name}</option>
            `).join('')}
          </select>
        </td>
        <td style="padding: 6px 8px;">
          <input type="number" step="0.01" value="${ev.lossAtoB}" class="event-loss-a-input" style="width: 65px; padding: 4px; font-size: 11px; background: var(--bg, #0f172a); border: 1px solid var(--border, #334155); color: inherit; border-radius: 4px;">
        </td>
        <td style="padding: 6px 8px;">
          <input type="number" step="0.01" value="${ev.lossBtoA}" class="event-loss-b-input" style="width: 65px; padding: 4px; font-size: 11px; background: var(--bg, #0f172a); border: 1px solid var(--border, #334155); color: inherit; border-radius: 4px;">
        </td>
        <td style="padding: 6px 8px; font-weight: bold; color: var(--primary, #38bdf8); font-family: monospace;">
          ${trueLoss} dB ${isGainer ? '<span style="font-size: 9px; color: #f59e0b;">(GAIN)</span>' : ''}
        </td>
        <td style="padding: 6px 8px;">
          <button type="button" class="event-remove-btn text-button danger" style="padding: 2px 6px; font-size: 10px;">✕</button>
        </td>
      `;

      // Bind row inputs
      const distInput = tr.querySelector('.event-dist-input');
      const typeSelect = tr.querySelector('.event-type-select');
      const lossAInput = tr.querySelector('.event-loss-a-input');
      const lossBInput = tr.querySelector('.event-loss-b-input');
      const removeBtn = tr.querySelector('.event-remove-btn');

      if (distInput) {
        distInput.addEventListener('change', () => {
          currentEvents[idx].distanceKm = parseFloat(distInput.value) || 0;
          updateView();
        });
      }
      if (typeSelect) {
        typeSelect.addEventListener('change', () => {
          currentEvents[idx].type = typeSelect.value;
          updateView();
        });
      }
      if (lossAInput) {
        lossAInput.addEventListener('change', () => {
          currentEvents[idx].lossAtoB = parseFloat(lossAInput.value) || 0;
          updateView();
        });
      }
      if (lossBInput) {
        lossBInput.addEventListener('change', () => {
          currentEvents[idx].lossBtoA = parseFloat(lossBInput.value) || 0;
          updateView();
        });
      }
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          currentEvents.splice(idx, 1);
          renderEventsEditor();
          updateView();
        });
      }

      eventsTableBody.appendChild(tr);
    });
  }

  function updateView() {
    const vals = getFormValues();
    if (spanVal && spanSlider) {
      spanVal.textContent = `${parseFloat(spanSlider.value).toFixed(1)} km`;
    }

    const calc = calculateBidirectionalAveraging(vals);

    if (trueLossReadout) {
      trueLossReadout.textContent = `${calc.totalTrueLossDb.toFixed(2)} dB`;
    }
    if (apparentAtoBReadout) {
      apparentAtoBReadout.textContent = `${calc.apparentLossAtoBDb.toFixed(2)} dB`;
    }
    if (apparentBtoAReadout) {
      apparentBtoAReadout.textContent = `${calc.apparentLossBtoADb.toFixed(2)} dB`;
    }
    if (gainersReadout) {
      gainersReadout.textContent = `${calc.gainerCount} joint(s)`;
      gainersReadout.style.color = calc.gainerCount > 0 ? '#f59e0b' : '#10b981';
    }
    if (verdictBadge) {
      verdictBadge.textContent = calc.overallVerdict.label;
      verdictBadge.className = `badge ${calc.overallVerdict.badgeClass}`;
      verdictBadge.style.backgroundColor = calc.overallVerdict.colorHex;
      verdictBadge.style.color = '#ffffff';
    }

    if (svgContainer) {
      svgContainer.innerHTML = renderBidirectionalOtdrSvg({
        events: currentEvents,
        fiberLengthKm: vals.fiberLengthKm,
        wavelengthNm: vals.wavelengthNm,
        width: 720,
        height: 280
      });
    }
  }

  function renderHistory() {
    if (!historyTableBody) return;
    const certs = getSavedBidirectionalOtdrCerts(storage);
    historyTableBody.innerHTML = '';

    if (certs.length === 0) {
      historyTableBody.innerHTML = '<tr><td colspan="6" style="padding: 12px; text-align: center; color: var(--muted, #94a3b8);">No bidirectional OTDR certification records found.</td></tr>';
      return;
    }

    certs.forEach(cert => {
      const tr = doc.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border, #334155)';
      tr.style.fontSize = '12px';

      tr.innerHTML = `
        <td style="padding: 6px 8px; font-weight: bold; font-family: monospace;">${cert.id}</td>
        <td style="padding: 6px 8px;">${cert.customerName || '—'}</td>
        <td style="padding: 6px 8px;">${cert.routeName || 'Trunk'}</td>
        <td style="padding: 6px 8px;">${Number(cert.fiberLengthKm || 0).toFixed(1)} km (${cert.wavelengthNm}nm)</td>
        <td style="padding: 6px 8px; font-weight: bold; color: var(--primary, #38bdf8);">${Number(cert.totalTrueLossDb || 0).toFixed(2)} dB</td>
        <td style="padding: 6px 8px;">
          <span class="badge ${cert.verdictBadgeClass || 'badge-success'}" style="font-size: 10px; padding: 2px 6px;">
            ${cert.verdict || 'PASS'}
          </span>
        </td>
      `;
      historyTableBody.appendChild(tr);
    });
  }

  function openModal(cust = null) {
    activeCustomer = cust || (typeof getCustomerData === 'function' ? getCustomerData() : null);
    if (activeCustomer) {
      if (routeInput && !routeInput.value) {
        routeInput.value = `${activeCustomer.name || 'Subscriber'} Feeder Span`;
      }
      if (destInput) {
        destInput.value = `${activeCustomer.area || 'Shahdara'} Drop Port`;
      }
    }
    renderEventsEditor();
    updateView();
    renderHistory();
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }

  function closeModal() {
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  }

  // Bind Preset Selector
  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const selected = OTDR_ROUTE_PRESETS.find(p => p.id === presetSelect.value);
      if (selected) {
        if (routeInput) routeInput.value = selected.name;
        if (originInput) originInput.value = selected.originNode;
        if (destInput) destInput.value = selected.terminusNode;
        if (spanSlider) spanSlider.value = selected.spanLengthKm;
        if (wavelengthSelect) wavelengthSelect.value = selected.wavelengthNm;
        currentEvents = JSON.parse(JSON.stringify(selected.events));
        renderEventsEditor();
        updateView();
      }
    });
  }

  // Bind sliders & selects
  if (spanSlider) {
    spanSlider.addEventListener('input', updateView);
  }
  if (wavelengthSelect) {
    wavelengthSelect.addEventListener('change', updateView);
  }

  // Add Event Button
  if (addEventBtn) {
    addEventBtn.addEventListener('click', () => {
      const dist = spanSlider ? parseFloat(spanSlider.value) / 2 : 5.0;
      currentEvents.push({
        id: `E${currentEvents.length + 1}`,
        distanceKm: Number(dist.toFixed(2)),
        type: 'FUSION_SPLICE',
        lossAtoB: 0.05,
        lossBtoA: 0.05,
        reflectanceDb: null,
        description: 'New Fusion Splice'
      });
      renderEventsEditor();
      updateView();
    });
  }

  // Action Buttons
  if (recordBtn) {
    recordBtn.addEventListener('click', () => {
      const vals = getFormValues();
      const cust = activeCustomer || (typeof getCustomerData === 'function' ? getCustomerData() : null) || {};
      const record = buildBidirectionalOtdrCertRecord({
        ...vals,
        customerNumber: cust.customerNumber || cust.id || '—',
        customerName: cust.name || 'Shahdara Network Subscriber',
        customerPhone: cust.phone || '—',
        area: cust.area || cust.mohalla || 'Shahdara Area',
        notes: notesInput ? notesInput.value.trim() : ''
      }, getSavedBidirectionalOtdrCerts(storage));

      saveBidirectionalOtdrCert(record, storage);
      renderHistory();
      if (typeof onToast === 'function') onToast(`Recorded OTDR Bidirectional QA Cert: ${record.id}`);
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const vals = getFormValues();
      const cust = activeCustomer || (typeof getCustomerData === 'function' ? getCustomerData() : null) || {};
      const record = buildBidirectionalOtdrCertRecord({
        ...vals,
        customerNumber: cust.customerNumber || cust.id || '—',
        customerName: cust.name || 'Shahdara Network Subscriber',
        customerPhone: cust.phone || '—',
        area: cust.area || cust.mohalla || 'Shahdara Area',
        notes: notesInput ? notesInput.value.trim() : ''
      }, getSavedBidirectionalOtdrCerts(storage));

      const text = formatBidirectionalOtdrCertWhatsApp(record);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          if (typeof onToast === 'function') onToast('Copied WhatsApp Bidirectional OTDR Report!');
        }).catch(() => {
          if (typeof onToast === 'function') onToast('Error copying to clipboard.');
        });
      }
    });
  }

  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      const vals = getFormValues();
      const cust = activeCustomer || (typeof getCustomerData === 'function' ? getCustomerData() : null) || {};
      const record = buildBidirectionalOtdrCertRecord({
        ...vals,
        customerNumber: cust.customerNumber || cust.id || '—',
        customerName: cust.name || 'Shahdara Network Subscriber',
        customerPhone: cust.phone || '—',
        area: cust.area || cust.mohalla || 'Shahdara Area',
        notes: notesInput ? notesInput.value.trim() : ''
      }, getSavedBidirectionalOtdrCerts(storage));

      const html = generateBidirectionalOtdrCertHtml(record, { format: 'sheet' });
      if (typeof window !== 'undefined') {
        const printWin = window.open('', '_blank', 'width=850,height=900');
        if (printWin) {
          printWin.document.write(`<!DOCTYPE html><html><head><title>OTDR Bidirectional Certificate</title></head><body>${html}<script>window.print();</script></body></html>`);
          printWin.document.close();
        }
      }
    });
  }

  if (printThermalBtn) {
    printThermalBtn.addEventListener('click', () => {
      const vals = getFormValues();
      const cust = activeCustomer || (typeof getCustomerData === 'function' ? getCustomerData() : null) || {};
      const record = buildBidirectionalOtdrCertRecord({
        ...vals,
        customerNumber: cust.customerNumber || cust.id || '—',
        customerName: cust.name || 'Shahdara Network Subscriber',
        customerPhone: cust.phone || '—',
        area: cust.area || cust.mohalla || 'Shahdara Area',
        notes: notesInput ? notesInput.value.trim() : ''
      }, getSavedBidirectionalOtdrCerts(storage));

      const html = generateBidirectionalOtdrCertHtml(record, { format: 'slip' });
      if (typeof window !== 'undefined') {
        const printWin = window.open('', '_blank', 'width=380,height=600');
        if (printWin) {
          printWin.document.write(`<!DOCTYPE html><html><head><title>Thermal Field Slip</title></head><body>${html}<script>window.print();</script></body></html>`);
          printWin.document.close();
        }
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const certs = getSavedBidirectionalOtdrCerts(storage);
      const csv = generateBidirectionalOtdrCsv(certs);
      if (typeof window !== 'undefined' && typeof Blob !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = doc.createElement('a');
        a.href = url;
        a.download = `shahdara-otdr-bidirectional-certs-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        if (typeof onToast === 'function') onToast('Exported Bidirectional OTDR CSV log.');
      }
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      clearBidirectionalOtdrCerts(storage);
      renderHistory();
      if (typeof onToast === 'function') onToast('Cleared Bidirectional OTDR certification history.');
    });
  }

  // Trigger bindings
  triggers.forEach(btn => {
    btn.addEventListener('click', () => openModal());
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  return {
    open: openModal,
    close: closeModal,
    getCurrentReading: () => calculateBidirectionalAveraging(getFormValues()),
    setReading: (vals = {}) => {
      if (vals.fiberLengthKm !== undefined && spanSlider) spanSlider.value = vals.fiberLengthKm;
      if (vals.wavelengthNm !== undefined && wavelengthSelect) wavelengthSelect.value = vals.wavelengthNm;
      if (vals.routeName !== undefined && routeInput) routeInput.value = vals.routeName;
      if (vals.originNode !== undefined && originInput) originInput.value = vals.originNode;
      if (vals.terminusNode !== undefined && destInput) destInput.value = vals.terminusNode;
      if (Array.isArray(vals.events)) {
        currentEvents = JSON.parse(JSON.stringify(vals.events));
        renderEventsEditor();
      }
      updateView();
    }
  };
}
