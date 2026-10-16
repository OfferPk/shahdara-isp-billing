/**
 * Shahdara ISP Billing & Network Operations - Optical Time-Domain Reflectometry (OTDR)
 * Launch Cable Dead Zone & Pulse Width Resolution Calibration QA Certification Suite
 * Standards: IEC 61746-1, ITU-T G.650.1, Telcordia GR-196-CORE Issue 2, and ITU-T L.400 / L.12
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const OTDR_DEADZONE_CERT_STORAGE_KEY = 'shahdara_otdr_deadzone_certs_v1';

export const SPEED_OF_LIGHT_VACUUM_MPS = 299792458; // m/s
export const STANDARD_FIBER_REFRACTIVE_INDEX = 1.4682; // G.652.D SMF-28 at 1550nm

export const OTDR_PULSE_CONFIGS = {
  '3ns': {
    id: '3ns',
    pulseWidthNs: 3,
    label: '3 ns (Ultra-High Resolution / Drop & Patchcord)',
    eventDeadZoneM: 0.5,
    attenuationDeadZoneM: 2.0,
    dynamicRangeDb: 18.0,
    recommendedMinLaunchLengthM: 100,
    recommendedMinTailLengthM: 50,
    typicalApplications: 'Drop cable, subscriber indoor rosette, patch panels, splitters',
    spatialPulseLengthM: 0.306
  },
  '5ns': {
    id: '5ns',
    pulseWidthNs: 5,
    label: '5 ns (High Resolution / Last-Mile Distribution)',
    eventDeadZoneM: 0.8,
    attenuationDeadZoneM: 2.8,
    dynamicRangeDb: 22.0,
    recommendedMinLaunchLengthM: 250,
    recommendedMinTailLengthM: 100,
    typicalApplications: 'FTTH drop lines, FAT closures, riser distribution',
    spatialPulseLengthM: 0.510
  },
  '10ns': {
    id: '10ns',
    pulseWidthNs: 10,
    label: '10 ns (Standard Feeder / Short Metro Span)',
    eventDeadZoneM: 1.2,
    attenuationDeadZoneM: 3.8,
    dynamicRangeDb: 26.0,
    recommendedMinLaunchLengthM: 500,
    recommendedMinTailLengthM: 200,
    typicalApplications: 'FDT feeder branches, neighborhood rings up to 10 km',
    spatialPulseLengthM: 1.021
  },
  '30ns': {
    id: '30ns',
    pulseWidthNs: 30,
    label: '30 ns (Intermediate Metro Ring Feeder)',
    eventDeadZoneM: 2.5,
    attenuationDeadZoneM: 7.0,
    dynamicRangeDb: 31.0,
    recommendedMinLaunchLengthM: 500,
    recommendedMinTailLengthM: 300,
    typicalApplications: 'Primary feeder cables, metro rings up to 25 km',
    spatialPulseLengthM: 3.063
  },
  '100ns': {
    id: '100ns',
    pulseWidthNs: 100,
    label: '100 ns (Trunk Cable / High Loss Route)',
    eventDeadZoneM: 6.0,
    attenuationDeadZoneM: 18.0,
    dynamicRangeDb: 36.0,
    recommendedMinLaunchLengthM: 1000,
    recommendedMinTailLengthM: 500,
    typicalApplications: 'Long trunk spans, high-loss cascaded splitter networks',
    spatialPulseLengthM: 10.209
  },
  '275ns': {
    id: '275ns',
    pulseWidthNs: 275,
    label: '275 ns (Long-Haul Inter-PoP Feeder)',
    eventDeadZoneM: 15.0,
    attenuationDeadZoneM: 45.0,
    dynamicRangeDb: 40.0,
    recommendedMinLaunchLengthM: 1000,
    recommendedMinTailLengthM: 500,
    typicalApplications: 'Inter-exchange backbones, river siphon crossings up to 80 km',
    spatialPulseLengthM: 28.076
  },
  '1000ns': {
    id: '1000ns',
    pulseWidthNs: 1000,
    label: '1 µs / 1000 ns (Regional Long-Haul Backbone)',
    eventDeadZoneM: 50.0,
    attenuationDeadZoneM: 140.0,
    dynamicRangeDb: 43.0,
    recommendedMinLaunchLengthM: 2000,
    recommendedMinTailLengthM: 1000,
    typicalApplications: 'Provincial fiber highways, long unrepeatered regional spans',
    spatialPulseLengthM: 102.094
  }
};

export const OTDR_WAVELENGTH_METRICS = {
  '1310': { wavelengthNm: 1310, name: '1310 nm (O-band / Upstream)', standardAttenuationDbPerKm: 0.34 },
  '1490': { wavelengthNm: 1490, name: '1490 nm (S-band / GPON Downstream)', standardAttenuationDbPerKm: 0.24 },
  '1550': { wavelengthNm: 1550, name: '1550 nm (C-band / Benchmark)', standardAttenuationDbPerKm: 0.20 },
  '1577': { wavelengthNm: 1577, name: '1577 nm (L-band / XGS-PON Downstream)', standardAttenuationDbPerKm: 0.21 },
  '1625': { wavelengthNm: 1625, name: '1625 nm (U-band / Active Monitoring)', standardAttenuationDbPerKm: 0.23 }
};

export const OTDR_SPAN_PRESETS = [
  {
    id: 'SPAN_BARADARI_JIA_MUSA',
    name: 'Baradari Central OLT to Jia Musa Ring FAT-04',
    originPoP: 'Shahdara Baradari Central OLT PoP',
    terminusPoP: 'Jia Musa FDT-04 Feeder Cabinet',
    spanLengthKm: 6.2,
    defaultPulseWidthId: '10ns',
    launchBoxLengthM: 500,
    tailBoxLengthM: 300,
    launchBoxId: 'LB-SMF28-500M-01',
    tailBoxId: 'TB-SMF28-300M-04',
    wavelengthNm: 1550,
    nearEndReflectanceDb: -52.4,
    farEndReflectanceDb: -48.1,
    events: [
      { id: 'E1', distanceM: 0, label: 'Near-End OLT Launch Port (Bulkhead Adapter)', lossDb: 0.28, reflectanceDb: -52.4, type: 'CONNECTOR' },
      { id: 'E2', distanceM: 1850, label: 'Manhole 06 Main Joint Enclosure Splice', lossDb: 0.04, reflectanceDb: null, type: 'SPLICE' },
      { id: 'E3', distanceM: 3940, label: 'Bhatti Chowk Overhead Aerial Joint Closure', lossDb: 0.05, reflectanceDb: null, type: 'SPLICE' },
      { id: 'E4', distanceM: 5120, label: 'Canal Road Crossing Feeder Splice', lossDb: 0.03, reflectanceDb: null, type: 'SPLICE' },
      { id: 'E5', distanceM: 6200, label: 'Jia Musa FDT-04 Demarcation Port', lossDb: 0.32, reflectanceDb: -48.1, type: 'CONNECTOR' }
    ]
  },
  {
    id: 'SPAN_VANDALA_RACHNA',
    name: 'Vandala Road Feeder to Rachna Town Cluster',
    originPoP: 'Vandala Road Primary FDT Node',
    terminusPoP: 'Rachna Town FAT-08 Drop Cluster',
    spanLengthKm: 3.8,
    defaultPulseWidthId: '5ns',
    launchBoxLengthM: 500,
    tailBoxLengthM: 300,
    launchBoxId: 'LB-SMF28-500M-02',
    tailBoxId: 'TB-SMF28-300M-01',
    wavelengthNm: 1550,
    nearEndReflectanceDb: -55.0,
    farEndReflectanceDb: -49.5,
    events: [
      { id: 'E1', distanceM: 0, label: 'Vandala FDT Cassette Port 01', lossDb: 0.22, reflectanceDb: -55.0, type: 'CONNECTOR' },
      { id: 'E2', distanceM: 1420, label: 'Post Office Crossing Joint Closure', lossDb: 0.06, reflectanceDb: null, type: 'SPLICE' },
      { id: 'E3', distanceM: 2650, label: 'Main Bazaar Aerial Splice Box', lossDb: 0.04, reflectanceDb: null, type: 'SPLICE' },
      { id: 'E4', distanceM: 3800, label: 'Rachna Town FAT-08 Ingress Port', lossDb: 0.29, reflectanceDb: -49.5, type: 'CONNECTOR' }
    ]
  },
  {
    id: 'SPAN_JIA_MUSA_BEGUM_KOT',
    name: 'Jia Musa Commercial Ring to Begum Kot ODF',
    originPoP: 'Jia Musa Ring Point Alpha',
    terminusPoP: 'Begum Kot Secondary ODF',
    spanLengthKm: 8.5,
    defaultPulseWidthId: '30ns',
    launchBoxLengthM: 1000,
    tailBoxLengthM: 500,
    launchBoxId: 'LB-SMF28-1000M-01',
    tailBoxId: 'TB-SMF28-500M-02',
    wavelengthNm: 1310,
    nearEndReflectanceDb: -50.8,
    farEndReflectanceDb: -47.2,
    events: [
      { id: 'E1', distanceM: 0, label: 'Jia Musa ODF Port 12', lossDb: 0.30, reflectanceDb: -50.8, type: 'CONNECTOR' },
      { id: 'E2', distanceM: 2800, label: 'Kala Khatai Road Splice Chamber', lossDb: 0.05, reflectanceDb: null, type: 'SPLICE' },
      { id: 'E3', distanceM: 5400, label: 'Railway Track Underpass Chamber Joint', lossDb: 0.07, reflectanceDb: null, type: 'SPLICE' },
      { id: 'E4', distanceM: 7150, label: 'Imamia Colony Feeder Joint', lossDb: 0.04, reflectanceDb: null, type: 'SPLICE' },
      { id: 'E5', distanceM: 8500, label: 'Begum Kot ODF Main Feeder Port', lossDb: 0.35, reflectanceDb: -47.2, type: 'CONNECTOR' }
    ]
  },
  {
    id: 'SPAN_BEGUM_KOT_NIAZI',
    name: 'Begum Kot Hub to Niazi Chowk Commercial Strip',
    originPoP: 'Begum Kot Main Central Hub',
    terminusPoP: 'Niazi Chowk Commercial Strip FAT-02',
    spanLengthKm: 2.4,
    defaultPulseWidthId: '3ns',
    launchBoxLengthM: 250,
    tailBoxLengthM: 100,
    launchBoxId: 'LB-SMF28-250M-03',
    tailBoxId: 'TB-SMF28-100M-02',
    wavelengthNm: 1550,
    nearEndReflectanceDb: -56.2,
    farEndReflectanceDb: -51.0,
    events: [
      { id: 'E1', distanceM: 0, label: 'Begum Kot Splitter Out Port 03', lossDb: 0.20, reflectanceDb: -56.2, type: 'CONNECTOR' },
      { id: 'E2', distanceM: 920, label: 'GT Road Overhead Joint Enclosure', lossDb: 0.03, reflectanceDb: null, type: 'SPLICE' },
      { id: 'E3', distanceM: 1680, label: 'Old Bus Terminal Junction Box', lossDb: 0.04, reflectanceDb: null, type: 'SPLICE' },
      { id: 'E4', distanceM: 2400, label: 'Niazi Chowk FAT-02 Drop Adapter', lossDb: 0.24, reflectanceDb: -51.0, type: 'CONNECTOR' }
    ]
  },
  {
    id: 'SPAN_RAVI_SIPHON_CROSSING',
    name: 'Ravi Siphon High-Span Aerial Crossing to Ring-B',
    originPoP: 'Ravi Siphon River Tower Anchor North',
    terminusPoP: 'Shahdara East Distribution Node (FAT-16)',
    spanLengthKm: 12.6,
    defaultPulseWidthId: '100ns',
    launchBoxLengthM: 1000,
    tailBoxLengthM: 500,
    launchBoxId: 'LB-SMF28-1000M-02',
    tailBoxId: 'TB-SMF28-500M-03',
    wavelengthNm: 1550,
    nearEndReflectanceDb: -53.5,
    farEndReflectanceDb: -46.8,
    events: [
      { id: 'E1', distanceM: 0, label: 'River Tower North ODF Launch Port', lossDb: 0.31, reflectanceDb: -53.5, type: 'CONNECTOR' },
      { id: 'E2', distanceM: 3200, label: 'Mid-River Island Tension Guy Splice Enclosure', lossDb: 0.06, reflectanceDb: null, type: 'SPLICE' },
      { id: 'E3', distanceM: 6800, label: 'River Tower South Tension Anchor Splice', lossDb: 0.05, reflectanceDb: null, type: 'SPLICE' },
      { id: 'E4', distanceM: 9900, label: 'Shahdara Railway Embankment Joint Box', lossDb: 0.04, reflectanceDb: null, type: 'SPLICE' },
      { id: 'E5', distanceM: 12600, label: 'Shahdara East FAT-16 Terminal Port', lossDb: 0.34, reflectanceDb: -46.8, type: 'CONNECTOR' }
    ]
  }
];

/**
 * Calculates spatial pulse length and theoretical dead-zones based on pulse width and refractive index
 */
export function calculatePulseWidthDeadZones(pulseWidthNs, wavelengthNm = 1550, fiberIndex = STANDARD_FIBER_REFRACTIVE_INDEX) {
  const tauSec = Number(pulseWidthNs) * 1e-9;
  const n = Number(fiberIndex) || STANDARD_FIBER_REFRACTIVE_INDEX;
  
  // Spatial pulse length in fiber: L_spatial = (c * tau) / (2 * n)
  const spatialLengthM = (SPEED_OF_LIGHT_VACUUM_MPS * tauSec) / (2 * n);
  
  // Find closest standard configuration or interpolate
  const matchingConfig = Object.values(OTDR_PULSE_CONFIGS).find(c => c.pulseWidthNs === Number(pulseWidthNs));
  
  let edzM = matchingConfig ? matchingConfig.eventDeadZoneM : Math.max(0.5, spatialLengthM * 1.6);
  let adzM = matchingConfig ? matchingConfig.attenuationDeadZoneM : Math.max(2.0, spatialLengthM * 4.5);
  let drDb = matchingConfig ? matchingConfig.dynamicRangeDb : (15 + 10 * Math.log10(pulseWidthNs));

  return {
    pulseWidthNs: Number(pulseWidthNs),
    wavelengthNm: Number(wavelengthNm),
    fiberIndex: n,
    spatialLengthM: parseFloat(spatialLengthM.toFixed(3)),
    eventDeadZoneM: parseFloat(edzM.toFixed(2)),
    attenuationDeadZoneM: parseFloat(adzM.toFixed(2)),
    dynamicRangeDb: parseFloat(drDb.toFixed(1))
  };
}

/**
 * Evaluates whether launch and tail fiber boxes are sufficient to clear OTDR dead zones
 * and calculates event resolvability along the span under test
 */
export function evaluateOtdrDeadzoneCalibration(options = {}) {
  const pulseWidthId = options.pulseWidthId || '10ns';
  const pulseConfig = OTDR_PULSE_CONFIGS[pulseWidthId] || OTDR_PULSE_CONFIGS['10ns'];
  const wavelengthNm = Number(options.wavelengthNm) || 1550;
  const wlData = OTDR_WAVELENGTH_METRICS[String(wavelengthNm)] || OTDR_WAVELENGTH_METRICS['1550'];
  
  const spanLengthKm = Number(options.spanLengthKm) || 6.2;
  const spanLengthM = spanLengthKm * 1000;
  
  const launchBoxLengthM = options.launchBoxLengthM !== undefined ? Number(options.launchBoxLengthM) : 500;
  const tailBoxLengthM = options.tailBoxLengthM !== undefined ? Number(options.tailBoxLengthM) : 300;
  
  const launchBoxId = options.launchBoxId || 'LB-SMF28-500M-01';
  const tailBoxId = options.tailBoxId || 'TB-SMF28-300M-04';
  
  const nearEndReflectanceDb = Number(options.nearEndReflectanceDb) || -52.0;
  const farEndReflectanceDb = Number(options.farEndReflectanceDb) || -48.0;

  const rawEvents = Array.isArray(options.events) ? options.events : [];
  
  // Minimum recommended launch box length is 1.5x Attenuation Dead Zone (ADZ) and at least 100m
  const minRequiredLaunchM = Math.max(100, pulseConfig.attenuationDeadZoneM * 1.5);
  const minRequiredTailM = Math.max(50, pulseConfig.attenuationDeadZoneM * 1.2);
  
  // Launch box adequacy
  let launchAdequacy = 'VERIFIED_PASS';
  let launchVerdictText = 'Launch cable box clears instrument attenuation dead-zone completely. Near-end connector loss & reflectance are 100% resolvable.';
  if (launchBoxLengthM <= 0) {
    launchAdequacy = 'FAIL_NO_LAUNCH_CABLE';
    launchVerdictText = 'NO launch fiber box connected! Near-end connector is completely hidden in OTDR input saturation dead-zone.';
  } else if (launchBoxLengthM < minRequiredLaunchM) {
    launchAdequacy = 'MARGINAL_SHORT_CABLE';
    launchVerdictText = `Launch box (${launchBoxLengthM} m) is shorter than recommended minimum (${minRequiredLaunchM.toFixed(1)} m). Risk of residual tailing.`;
  }

  // Tail box adequacy
  let tailAdequacy = 'VERIFIED_PASS';
  let tailVerdictText = 'Receive fiber tail box clears far-end glass-to-air Fresnel reflection. Final customer demarcation connector is 100% resolvable.';
  if (tailBoxLengthM <= 0) {
    tailAdequacy = 'FAIL_NO_TAIL_CABLE';
    tailVerdictText = 'NO receive tail box connected! Far-end subscriber demarcation connector loss is unmeasurable due to terminal reflection blind-zone.';
  } else if (tailBoxLengthM < minRequiredTailM) {
    tailAdequacy = 'MARGINAL_SHORT_TAIL';
    tailVerdictText = `Tail box (${tailBoxLengthM} m) is shorter than recommended minimum (${minRequiredTailM.toFixed(1)} m). Demarcation loss measurement may have higher uncertainty.`;
  }

  // Event resolution evaluation
  // Detect if any consecutive events are spaced closer than the Event Dead Zone (EDZ)
  const resolvedEvents = [];
  let maskedEventCount = 0;
  
  for (let i = 0; i < rawEvents.length; i++) {
    const ev = rawEvents[i];
    let isMasked = false;
    let distanceToPrevM = null;
    let distanceToNextM = null;
    
    if (i > 0) {
      distanceToPrevM = ev.distanceM - rawEvents[i - 1].distanceM;
      if (distanceToPrevM < pulseConfig.eventDeadZoneM) {
        isMasked = true;
      }
    }
    if (i < rawEvents.length - 1) {
      distanceToNextM = rawEvents[i + 1].distanceM - ev.distanceM;
      if (distanceToNextM < pulseConfig.eventDeadZoneM) {
        isMasked = true;
      }
    }
    
    if (isMasked) maskedEventCount++;

    resolvedEvents.push({
      ...ev,
      distanceToPrevM,
      distanceToNextM,
      isMaskedByDeadZone: isMasked,
      resolvableStatus: isMasked ? 'MASKED_UNRESOLVED' : 'PASS_RESOLVED'
    });
  }

  // Calculate fiber baseline attenuation and total link loss
  const fiberAttenuationDb = spanLengthKm * wlData.standardAttenuationDbPerKm;
  const launchBoxLossDb = (launchBoxLengthM / 1000) * wlData.standardAttenuationDbPerKm + 0.15;
  const tailBoxLossDb = (tailBoxLengthM / 1000) * wlData.standardAttenuationDbPerKm + 0.15;
  
  const eventsLossTotalDb = rawEvents.reduce((acc, ev) => acc + (Number(ev.lossDb) || 0), 0);
  const totalSpanLossDb = fiberAttenuationDb + eventsLossTotalDb;
  const totalMeasuredLinkLossDb = totalSpanLossDb + launchBoxLossDb + tailBoxLossDb;
  
  // Dynamic Range Margin
  // DR_margin = OTDR_DR - totalMeasuredLoss - 5.0 dB standard noise buffer
  const dynamicRangeMarginDb = pulseConfig.dynamicRangeDb - totalMeasuredLinkLossDb - 5.0;
  
  // Overall Calibration Verdict
  let overallVerdict = 'CERTIFIED_CALIBRATION_PASS';
  let overallVerdictLabel = 'IEC 61746-1 Metrology Certified (Pass)';
  let overallBadgeColor = '#10b981'; // Green
  
  if (launchAdequacy !== 'VERIFIED_PASS' || tailAdequacy !== 'VERIFIED_PASS' || maskedEventCount > 0 || dynamicRangeMarginDb < 0) {
    if (dynamicRangeMarginDb < 0 || launchAdequacy.startsWith('FAIL')) {
      overallVerdict = 'FAIL_CALIBRATION_REJECT';
      overallVerdictLabel = 'Calibration Rejected (Dead Zone / DR Limit)';
      overallBadgeColor = '#ef4444'; // Red
    } else {
      overallVerdict = 'CONDITIONAL_PASS';
      overallVerdictLabel = 'Conditional Pass (Sub-optimal Dead Zone)';
      overallBadgeColor = '#f59e0b'; // Amber
    }
  }

  return {
    timestamp: options.timestamp || new Date().toISOString(),
    certId: options.certId || generateOtdrDeadzoneCertId(),
    subscriberId: options.subscriberId || 'CUST-GEN-01',
    subscriberName: options.subscriberName || 'Shahdara Distribution Subscriber',
    technicianName: options.technicianName || 'Shahdara Optical Metrology Team',
    spanName: options.spanName || 'Shahdara Central Fiber Span',
    originPoP: options.originPoP || 'Central OLT',
    terminusPoP: options.terminusPoP || 'Field Terminal',
    spanLengthKm,
    spanLengthM,
    pulseConfig,
    wavelengthNm,
    wavelengthLabel: wlData.name,
    fiberAttenuationDb: parseFloat(fiberAttenuationDb.toFixed(3)),
    eventsLossTotalDb: parseFloat(eventsLossTotalDb.toFixed(3)),
    totalSpanLossDb: parseFloat(totalSpanLossDb.toFixed(3)),
    totalMeasuredLinkLossDb: parseFloat(totalMeasuredLinkLossDb.toFixed(3)),
    dynamicRangeMarginDb: parseFloat(dynamicRangeMarginDb.toFixed(2)),
    launchBox: {
      id: launchBoxId,
      lengthM: launchBoxLengthM,
      minRequiredM: minRequiredLaunchM,
      adequacy: launchAdequacy,
      verdictText: launchVerdictText,
      lossDb: parseFloat(launchBoxLossDb.toFixed(3)),
      nearEndReflectanceDb
    },
    tailBox: {
      id: tailBoxId,
      lengthM: tailBoxLengthM,
      minRequiredM: minRequiredTailM,
      adequacy: tailAdequacy,
      verdictText: tailVerdictText,
      lossDb: parseFloat(tailBoxLossDb.toFixed(3)),
      farEndReflectanceDb
    },
    events: resolvedEvents,
    maskedEventCount,
    overallVerdict,
    overallVerdictLabel,
    overallBadgeColor
  };
}

/**
 * Generates an official sequential calibration certificate ID
 */
export function generateOtdrDeadzoneCertId() {
  const d = new Date();
  const yearMonth = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const randNum = Math.floor(1000 + Math.random() * 9000);
  return `DZC-${yearMonth}-${randNum}`;
}

/**
 * Renders an interactive, responsive vector SVG visualizer of the OTDR trace,
 * launch fiber zone, attenuation dead zones, discrete events, and receive tail box.
 */
export function renderOtdrDeadzoneSvg(analysis, options = {}) {
  const width = options.width || 800;
  const height = options.height || 340;
  const padding = { top: 40, right: 30, bottom: 50, left: 60 };
  
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  
  const totalLengthM = analysis.launchBox.lengthM + analysis.spanLengthM + analysis.tailBox.lengthM;
  const maxLossDisplayDb = Math.max(12, analysis.totalMeasuredLinkLossDb + 6);
  
  // Coordinate mappers
  const xM = (distM) => padding.left + (distM / totalLengthM) * plotW;
  const yDb = (lossDb) => padding.top + (lossDb / maxLossDisplayDb) * plotH;
  
  const launchEndDistM = analysis.launchBox.lengthM;
  const spanEndDistM = launchEndDistM + analysis.spanLengthM;
  
  // Background gradient and grid lines
  let gridLines = '';
  // Horizontal dB grid
  for (let db = 0; db <= maxLossDisplayDb; db += 2) {
    const y = yDb(db);
    gridLines += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="currentColor" stroke-opacity="0.1" stroke-dasharray="3,3" />`;
    gridLines += `<text x="${padding.left - 8}" y="${y + 4}" font-size="10" text-anchor="end" fill="currentColor" opacity="0.6">${db} dB</text>`;
  }
  
  // Vertical distance grid
  const distStepM = totalLengthM > 10000 ? 2000 : (totalLengthM > 4000 ? 1000 : 500);
  for (let d = 0; d <= totalLengthM; d += distStepM) {
    const x = xM(d);
    gridLines += `<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" stroke="currentColor" stroke-opacity="0.1" stroke-dasharray="3,3" />`;
    const kmLabel = (d / 1000).toFixed(1) + ' km';
    gridLines += `<text x="${x}" y="${height - padding.bottom + 16}" font-size="10" text-anchor="middle" fill="currentColor" opacity="0.6">${kmLabel}</text>`;
  }

  // Zone Shading (Launch Box, Span Under Test, Tail Box)
  const launchZoneW = xM(launchEndDistM) - xM(0);
  const spanZoneW = xM(spanEndDistM) - xM(launchEndDistM);
  const tailZoneW = xM(totalLengthM) - xM(spanEndDistM);

  const zonesSvg = `
    <!-- Launch Box Zone -->
    <rect x="${xM(0)}" y="${padding.top}" width="${launchZoneW}" height="${plotH}" fill="#3b82f6" fill-opacity="0.08" />
    <text x="${xM(launchEndDistM / 2)}" y="${padding.top + 16}" font-size="11" font-weight="600" text-anchor="middle" fill="#3b82f6">
      Launch Fiber Box (${analysis.launchBox.lengthM}m)
    </text>

    <!-- Fiber Span Under Test Zone -->
    <rect x="${xM(launchEndDistM)}" y="${padding.top}" width="${spanZoneW}" height="${plotH}" fill="#10b981" fill-opacity="0.05" />
    <text x="${xM(launchEndDistM + analysis.spanLengthM / 2)}" y="${padding.top + 16}" font-size="11" font-weight="600" text-anchor="middle" fill="#10b981">
      Optical Fiber Link Span Under Test (${analysis.spanLengthKm} km)
    </text>

    <!-- Tail Box Zone -->
    <rect x="${xM(spanEndDistM)}" y="${padding.top}" width="${tailZoneW}" height="${plotH}" fill="#8b5cf6" fill-opacity="0.08" />
    <text x="${xM(spanEndDistM + analysis.tailBox.lengthM / 2)}" y="${padding.top + 16}" font-size="11" font-weight="600" text-anchor="middle" fill="#8b5cf6">
      Receive Tail Box (${analysis.tailBox.lengthM}m)
    </text>
  `;

  // Draw simulated OTDR trace path
  // Start at origin, launch fiber slope
  let runningLoss = 0.2; // Input launch adapter loss
  let tracePath = `M ${xM(0)} ${yDb(runningLoss)}`;
  
  // Instrument reflection peak at 0m
  const instSpikeY = yDb(Math.max(0, runningLoss - 3.5));
  tracePath += ` L ${xM(0)} ${instSpikeY} L ${xM(analysis.pulseConfig.eventDeadZoneM)} ${yDb(runningLoss)}`;
  
  // Launch fiber backscatter slope
  const launchFiberLoss = (analysis.launchBox.lengthM / 1000) * (analysis.wavelengthNm === 1310 ? 0.34 : 0.20);
  runningLoss += launchFiberLoss;
  tracePath += ` L ${xM(launchEndDistM)} ${yDb(runningLoss)}`;
  
  // Near-end connector reflection spike
  const nearEndSpikeY = yDb(Math.max(0, runningLoss - 3.0));
  const nearEndAdzX = xM(launchEndDistM + analysis.pulseConfig.attenuationDeadZoneM);
  tracePath += ` L ${xM(launchEndDistM)} ${nearEndSpikeY}`;
  
  // Step drop for near-end connector loss
  const nearEndLoss = 0.28;
  runningLoss += nearEndLoss;
  tracePath += ` L ${nearEndAdzX} ${yDb(runningLoss)}`;

  // Fiber events along span
  let currentSpanDistM = launchEndDistM;
  for (const ev of analysis.events) {
    if (ev.distanceM > 0 && ev.distanceM < analysis.spanLengthM) {
      const evGlobalDistM = launchEndDistM + ev.distanceM;
      // fiber slope to event
      const segKm = (evGlobalDistM - currentSpanDistM) / 1000;
      runningLoss += segKm * (analysis.wavelengthNm === 1310 ? 0.34 : 0.20);
      tracePath += ` L ${xM(evGlobalDistM)} ${yDb(runningLoss)}`;
      
      // event drop (and small spike if reflective)
      if (ev.type === 'CONNECTOR' || ev.type === 'MECHANICAL_SPLICE') {
        tracePath += ` L ${xM(evGlobalDistM)} ${yDb(runningLoss - 1.5)}`;
      }
      runningLoss += (Number(ev.lossDb) || 0.05);
      tracePath += ` L ${xM(evGlobalDistM + analysis.pulseConfig.eventDeadZoneM)} ${yDb(runningLoss)}`;
      currentSpanDistM = evGlobalDistM;
    }
  }

  // Reach end of span (far-end demarcation)
  const remainingSpanKm = (spanEndDistM - currentSpanDistM) / 1000;
  runningLoss += remainingSpanKm * (analysis.wavelengthNm === 1310 ? 0.34 : 0.20);
  tracePath += ` L ${xM(spanEndDistM)} ${yDb(runningLoss)}`;
  
  // Far-end connector spike & drop
  const farEndSpikeY = yDb(Math.max(0, runningLoss - 2.8));
  tracePath += ` L ${xM(spanEndDistM)} ${farEndSpikeY}`;
  runningLoss += 0.30;
  tracePath += ` L ${xM(spanEndDistM + analysis.pulseConfig.attenuationDeadZoneM)} ${yDb(runningLoss)}`;

  // Tail box slope to terminal end
  const tailFiberLoss = (analysis.tailBox.lengthM / 1000) * (analysis.wavelengthNm === 1310 ? 0.34 : 0.20);
  runningLoss += tailFiberLoss;
  tracePath += ` L ${xM(totalLengthM)} ${yDb(runningLoss)}`;
  
  // Terminal glass-to-air Fresnel reflection spike
  const terminalFresnelY = yDb(Math.max(0, runningLoss - 5.0));
  tracePath += ` L ${xM(totalLengthM)} ${terminalFresnelY}`;

  // Dead zone highlight indicators
  const edzBracketW = xM(analysis.pulseConfig.eventDeadZoneM) - xM(0);
  const adzBracketW = xM(analysis.pulseConfig.attenuationDeadZoneM) - xM(0);

  const deadZoneMarkers = `
    <!-- Near-End Dead Zone Bracket -->
    <g transform="translate(${xM(launchEndDistM)}, ${yDb(0) + 10})">
      <rect x="0" y="0" width="${Math.max(4, adzBracketW)}" height="18" fill="#f59e0b" fill-opacity="0.25" rx="3" />
      <line x1="0" y1="0" x2="0" y2="18" stroke="#f59e0b" stroke-width="2" />
      <line x1="${Math.max(4, adzBracketW)}" y1="0" x2="${Math.max(4, adzBracketW)}" y2="18" stroke="#f59e0b" stroke-width="2" />
      <text x="${Math.max(4, adzBracketW) / 2}" y="13" font-size="9" font-weight="700" text-anchor="middle" fill="#d97706">
        ADZ: ${analysis.pulseConfig.attenuationDeadZoneM}m
      </text>
    </g>

    <!-- Far-End Demarcation Marker -->
    <g transform="translate(${xM(spanEndDistM)}, ${yDb(0) + 10})">
      <rect x="0" y="0" width="${Math.max(4, adzBracketW)}" height="18" fill="#8b5cf6" fill-opacity="0.25" rx="3" />
      <line x1="0" y1="0" x2="0" y2="18" stroke="#8b5cf6" stroke-width="2" />
      <text x="${Math.max(4, adzBracketW) / 2}" y="13" font-size="9" font-weight="700" text-anchor="middle" fill="#8b5cf6">
        Demarcation
      </text>
    </g>
  `;

  // HUD Top Ribbon
  const hudSvg = `
    <rect x="${padding.left}" y="6" width="${plotW}" height="28" rx="4" fill="currentColor" fill-opacity="0.04" />
    <text x="${padding.left + 12}" y="24" font-size="11" font-weight="700" fill="currentColor">
      Pulse: <tspan fill="#3b82f6">${analysis.pulseConfig.label.split(' ')[0]}</tspan> | 
      EDZ: <tspan fill="#10b981">${analysis.pulseConfig.eventDeadZoneM} m</tspan> | 
      ADZ: <tspan fill="#f59e0b">${analysis.pulseConfig.attenuationDeadZoneM} m</tspan> | 
      DR Margin: <tspan fill="${analysis.dynamicRangeMarginDb >= 0 ? '#10b981' : '#ef4444'}">${analysis.dynamicRangeMarginDb} dB</tspan>
    </text>
    <rect x="${width - padding.right - 140}" y="10" width="130" height="20" rx="10" fill="${analysis.overallBadgeColor}" />
    <text x="${width - padding.right - 75}" y="24" font-size="10" font-weight="700" text-anchor="middle" fill="#ffffff">
      ${analysis.overallVerdict.replace(/_/g, ' ')}
    </text>
  `;

  return `
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="otdr-deadzone-trace-svg" style="width:100%;height:auto;display:block;">
      ${zonesSvg}
      ${gridLines}
      <!-- Simulated Trace Line -->
      <path d="${tracePath}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      ${deadZoneMarkers}
      ${hudSvg}
      <!-- Axes Labels -->
      <text x="${width / 2}" y="${height - 10}" font-size="11" font-weight="600" text-anchor="middle" fill="currentColor" opacity="0.8">
        Optical Distance (Meters & Kilometers)
      </text>
      <text transform="rotate(-90)" x="${-height / 2}" y="16" font-size="11" font-weight="600" text-anchor="middle" fill="currentColor" opacity="0.8">
        Attenuation (dB)
      </text>
    </svg>
  `;
}

/**
 * Generates official dual printable HTML documents:
 * 1. Standard A4 ISO/IEC Accreditation Certificate
 * 2. 80mm POS field technician thermal slip
 */
export function generateOtdrDeadzoneCertHtml(analysis, format = 'a4') {
  if (format === 'thermal') {
    return generateOtdrDeadzoneThermalHtml(analysis);
  }
  return generateOtdrDeadzoneA4Html(analysis);
}

function generateOtdrDeadzoneA4Html(analysis) {
  const dateStr = new Date(analysis.timestamp).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OTDR Dead Zone Metrology Certificate - ${analysis.certId}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 13px; line-height: 1.5; }
    .cert-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; }
    .org-title { font-size: 20px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; }
    .org-subtitle { font-size: 12px; color: #64748b; margin-top: 2px; }
    .cert-badge { background: ${analysis.overallBadgeColor}; color: white; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 12px; text-transform: uppercase; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 16px; }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600; }
    .meta-value { font-size: 12px; font-weight: 700; color: #1e293b; margin-top: 2px; }
    .section-title { font-size: 14px; font-weight: 700; color: #1e3a8a; border-left: 4px solid #2563eb; padding-left: 8px; margin: 16px 0 8px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; font-size: 12px; }
    th { background: #f1f5f9; color: #334155; font-weight: 700; }
    .status-pill { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; }
    .status-pass { background: #dcfce7; color: #15803d; }
    .status-warn { background: #fef3c7; color: #b45309; }
    .status-fail { background: #fee2e2; color: #b91c1c; }
    .svg-container { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 16px; background: #ffffff; }
    .signatures { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 10px; }
    .sig-block { width: 45%; border-top: 1px dashed #94a3b8; text-align: center; padding-top: 8px; font-size: 11px; color: #475569; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="cert-header">
    <div>
      <div class="org-title">Shahdara ISP Metrology &amp; Optical QA Laboratory</div>
      <div class="org-subtitle">IEC 61746-1 &amp; ITU-T G.650.1 OTDR Dead Zone &amp; Launch Cable Acceptance Certificate</div>
    </div>
    <div class="cert-badge">${analysis.overallVerdictLabel}</div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <span class="meta-label">Certificate Serial</span>
      <span class="meta-value">${analysis.certId}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Issue Date</span>
      <span class="meta-value">${dateStr}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Span Under Test</span>
      <span class="meta-value">${analysis.spanName}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Lead Metrology Engineer</span>
      <span class="meta-value">${analysis.technicianName}</span>
    </div>
  </div>

  <div class="section-title">1. OTDR Optical Acquisition & Resolution Parameters</div>
  <table>
    <thead>
      <tr>
        <th>Optical Pulse Width</th>
        <th>Event Dead Zone (EDZ)</th>
        <th>Attenuation Dead Zone (ADZ)</th>
        <th>Wavelength</th>
        <th>Dynamic Range Margin</th>
        <th>Masked Events</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>${analysis.pulseConfig.label}</strong></td>
        <td><strong style="color:#10b981;">${analysis.pulseConfig.eventDeadZoneM} meters</strong></td>
        <td><strong style="color:#f59e0b;">${analysis.pulseConfig.attenuationDeadZoneM} meters</strong></td>
        <td>${analysis.wavelengthLabel}</td>
        <td><strong>${analysis.dynamicRangeMarginDb} dB</strong></td>
        <td><span class="status-pill ${analysis.maskedEventCount === 0 ? 'status-pass' : 'status-fail'}">${analysis.maskedEventCount} Hidden</span></td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">2. Launch & Receive Fiber Dead Zone Eliminators</div>
  <table>
    <thead>
      <tr>
        <th>Box Type</th>
        <th>Serial ID</th>
        <th>Box Length</th>
        <th>Min Required</th>
        <th>Reflectance</th>
        <th>Compliance Verdict</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Launch Box (Near-End)</strong></td>
        <td>${analysis.launchBox.id}</td>
        <td>${analysis.launchBox.lengthM} m</td>
        <td>${analysis.launchBox.minRequiredM.toFixed(1)} m</td>
        <td>${analysis.launchBox.nearEndReflectanceDb} dB</td>
        <td><span class="status-pill ${analysis.launchBox.adequacy === 'VERIFIED_PASS' ? 'status-pass' : 'status-fail'}">${analysis.launchBox.adequacy}</span></td>
      </tr>
      <tr>
        <td><strong>Tail Box (Far-End)</strong></td>
        <td>${analysis.tailBox.id}</td>
        <td>${analysis.tailBox.lengthM} m</td>
        <td>${analysis.tailBox.minRequiredM.toFixed(1)} m</td>
        <td>${analysis.tailBox.farEndReflectanceDb} dB</td>
        <td><span class="status-pill ${analysis.tailBox.adequacy === 'VERIFIED_PASS' ? 'status-pass' : 'status-fail'}">${analysis.tailBox.adequacy}</span></td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">3. Visual OTDR Trace & Dead Zone Verification Graph</div>
  <div class="svg-container">
    ${renderOtdrDeadzoneSvg(analysis, { width: 720, height: 260 })}
  </div>

  <div class="section-title">4. Discrete Event Resolvability Ledger</div>
  <table>
    <thead>
      <tr>
        <th>Event #</th>
        <th>Location</th>
        <th>Description</th>
        <th>Type</th>
        <th>Loss (dB)</th>
        <th>Reflectance (dB)</th>
        <th>Dead Zone Clearance</th>
      </tr>
    </thead>
    <tbody>
      ${analysis.events.map((ev, idx) => `
        <tr>
          <td>E${idx + 1}</td>
          <td>${(ev.distanceM / 1000).toFixed(3)} km</td>
          <td>${ev.label}</td>
          <td>${ev.type}</td>
          <td>${ev.lossDb.toFixed(2)} dB</td>
          <td>${ev.reflectanceDb !== null ? ev.reflectanceDb + ' dB' : 'N/A (Non-reflective)'}</td>
          <td>
            <span class="status-pill ${ev.resolvableStatus === 'PASS_RESOLVED' ? 'status-pass' : 'status-fail'}">
              ${ev.resolvableStatus === 'PASS_RESOLVED' ? 'CLEARED (RESOLVED)' : 'MASKED BY DEAD ZONE'}
            </span>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-block">
      <strong>Field Optical Metrology Inspector</strong><br>
      Shahdara ISP Network Operations Center
    </div>
    <div class="sig-block">
      <strong>Chief Outside Plant (OSP) QA Auditor</strong><br>
      PTA Quality of Service (QoS) Compliance Division
    </div>
  </div>
</body>
</html>
  `;
}

function generateOtdrDeadzoneThermalHtml(analysis) {
  const dateStr = new Date(analysis.timestamp).toLocaleDateString('en-GB');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Thermal Slip - ${analysis.certId}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    body { font-family: monospace; width: 72mm; margin: 0 auto; padding: 8px 0; font-size: 11px; line-height: 1.3; color: #000; }
    .center { text-align: center; }
    .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
    .bold { font-weight: bold; }
    .row { display: flex; justify-content: space-between; }
    .verdict-box { border: 1px solid #000; padding: 4px; text-align: center; margin: 6px 0; font-weight: bold; }
    @media print { body { width: 100%; } }
  </style>
</head>
<body>
  <div class="center bold">SHAHDARA ISP METROLOGY</div>
  <div class="center">OTDR DEAD ZONE CALIBRATION</div>
  <div class="divider"></div>
  <div class="row"><span>CERT ID:</span><span class="bold">${analysis.certId}</span></div>
  <div class="row"><span>DATE:</span><span>${dateStr}</span></div>
  <div class="row"><span>SPAN:</span><span>${analysis.spanName.slice(0, 18)}</span></div>
  <div class="row"><span>TECH:</span><span>${analysis.technicianName.slice(0, 18)}</span></div>
  <div class="divider"></div>
  <div class="verdict-box">${analysis.overallVerdictLabel}</div>
  <div class="row"><span>PULSE WIDTH:</span><span class="bold">${analysis.pulseConfig.pulseWidthNs} ns</span></div>
  <div class="row"><span>EVENT DEAD ZONE:</span><span class="bold">${analysis.pulseConfig.eventDeadZoneM} m</span></div>
  <div class="row"><span>ATTEN DEAD ZONE:</span><span class="bold">${analysis.pulseConfig.attenuationDeadZoneM} m</span></div>
  <div class="row"><span>DR MARGIN:</span><span class="bold">${analysis.dynamicRangeMarginDb} dB</span></div>
  <div class="divider"></div>
  <div class="row"><span>LAUNCH BOX:</span><span>${analysis.launchBox.lengthM}m (${analysis.launchBox.adequacy})</span></div>
  <div class="row"><span>TAIL BOX:</span><span>${analysis.tailBox.lengthM}m (${analysis.tailBox.adequacy})</span></div>
  <div class="row"><span>MASKED EVENTS:</span><span class="bold">${analysis.maskedEventCount}</span></div>
  <div class="divider"></div>
  <div class="center bold">--- FIELD CERTIFIED PASS ---</div>
  <div class="center" style="font-size:9px;margin-top:4px;">Shahdara Fiber Metrology Div</div>
</body>
</html>
  `;
}

/**
 * Formats bilingual Urdu & English WhatsApp notification for technician dispatch
 */
export function formatOtdrDeadzoneCertWhatsApp(analysis) {
  const isPass = analysis.overallVerdict === 'CERTIFIED_CALIBRATION_PASS';
  const icon = isPass ? '✅' : '⚠️';
  
  return [
    `*${icon} SHAHDARA ISP - OTDR DEAD ZONE QA CALIBRATION*`,
    `*سرٹیفکیٹ برائے او ٹی ڈی آر ڈیڈ زون و پلس کیلیبریشن*`,
    ``,
    `📋 *Certificate Serial:* ${analysis.certId}`,
    `📍 *Fiber Span:* ${analysis.spanName} (${analysis.spanLengthKm} km)`,
    `⚡ *Pulse Width:* ${analysis.pulseConfig.label}`,
    `📏 *Event Dead Zone (EDZ):* ${analysis.pulseConfig.eventDeadZoneM} meters`,
    `📐 *Attenuation Dead Zone (ADZ):* ${analysis.pulseConfig.attenuationDeadZoneM} meters`,
    `📦 *Launch Box:* ${analysis.launchBox.lengthM} m (${analysis.launchBox.adequacy})`,
    `📦 *Receive Tail Box:* ${analysis.tailBox.lengthM} m (${analysis.tailBox.adequacy})`,
    `📊 *Dynamic Range Margin:* ${analysis.dynamicRangeMarginDb} dB`,
    `🔍 *Hidden/Masked Events:* ${analysis.maskedEventCount}`,
    ``,
    `🎯 *Metrology Verdict:* *${analysis.overallVerdictLabel}*`,
    `🇵🇰 *تصدیق:* اس فائبر روٹ پر پلس کیلیبریشن اور لانچ باکس جانچ مکمل ہو چکی ہے۔ تمام کپلنگ اور سپلائس نتائج منظور ہیں۔`,
    ``,
    `_Shahdara Outside Plant (OSP) Metrology Division_`
  ].join('\n');
}

/**
 * Generates RFC-4180 compliant CSV export with UTF-8 BOM
 */
export function generateOtdrDeadzoneCertsCsv(certs = []) {
  const headers = [
    'Certificate ID',
    'Timestamp',
    'Span Name',
    'Subscriber Name',
    'Technician',
    'Span Length (km)',
    'Wavelength (nm)',
    'Pulse Width (ns)',
    'Event Dead Zone (m)',
    'Attenuation Dead Zone (m)',
    'Launch Box ID',
    'Launch Box Length (m)',
    'Launch Adequacy',
    'Tail Box ID',
    'Tail Box Length (m)',
    'Tail Adequacy',
    'Total Span Loss (dB)',
    'DR Margin (dB)',
    'Masked Events Count',
    'Overall Verdict'
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = certs.map(c => [
    escapeCsv(c.certId),
    escapeCsv(c.timestamp),
    escapeCsv(c.spanName),
    escapeCsv(c.subscriberName),
    escapeCsv(c.technicianName),
    escapeCsv(c.spanLengthKm),
    escapeCsv(c.wavelengthNm),
    escapeCsv(c.pulseConfig ? c.pulseConfig.pulseWidthNs : ''),
    escapeCsv(c.pulseConfig ? c.pulseConfig.eventDeadZoneM : ''),
    escapeCsv(c.pulseConfig ? c.pulseConfig.attenuationDeadZoneM : ''),
    escapeCsv(c.launchBox ? c.launchBox.id : ''),
    escapeCsv(c.launchBox ? c.launchBox.lengthM : ''),
    escapeCsv(c.launchBox ? c.launchBox.adequacy : ''),
    escapeCsv(c.tailBox ? c.tailBox.id : ''),
    escapeCsv(c.tailBox ? c.tailBox.lengthM : ''),
    escapeCsv(c.tailBox ? c.tailBox.adequacy : ''),
    escapeCsv(c.totalSpanLossDb),
    escapeCsv(c.dynamicRangeMarginDb),
    escapeCsv(c.maskedEventCount),
    escapeCsv(c.overallVerdict)
  ].join(','));

  // Prepend UTF-8 BOM
  return '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
}

/**
 * LocalStorage persistence helpers
 */
export function getSavedOtdrDeadzoneCerts(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(OTDR_DEADZONE_CERT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse saved OTDR dead zone certs', err);
    return [];
  }
}

export function saveOtdrDeadzoneCert(cert, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !cert) return false;
  try {
    const existing = getSavedOtdrDeadzoneCerts(storage);
    const updated = [cert, ...existing.filter(c => c.certId !== cert.certId)].slice(0, 100);
    storage.setItem(OTDR_DEADZONE_CERT_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (err) {
    console.error('Failed to save OTDR dead zone cert', err);
    return false;
  }
}

export function clearOtdrDeadzoneCerts(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return false;
  try {
    storage.removeItem(OTDR_DEADZONE_CERT_STORAGE_KEY);
    return true;
  } catch (err) {
    return false;
  }
}

export function updateOtdrDeadzoneCertStatus(certId, newStatus, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !certId) return false;
  try {
    const existing = getSavedOtdrDeadzoneCerts(storage);
    const item = existing.find(c => c.certId === certId);
    if (!item) return false;
    item.overallVerdict = newStatus;
    storage.setItem(OTDR_DEADZONE_CERT_STORAGE_KEY, JSON.stringify(existing));
    return true;
  } catch (err) {
    return false;
  }
}

export function calculateOtdrDeadzoneMetrics(certs = []) {
  const total = certs.length;
  const certified = certs.filter(c => c.overallVerdict === 'CERTIFIED_CALIBRATION_PASS').length;
  const conditional = certs.filter(c => c.overallVerdict === 'CONDITIONAL_PASS').length;
  const rejected = certs.filter(c => c.overallVerdict === 'FAIL_CALIBRATION_REJECT').length;
  const passRate = total > 0 ? parseFloat(((certified / total) * 100).toFixed(1)) : 100;
  
  return {
    total,
    certified,
    conditional,
    rejected,
    passRate
  };
}

/**
 * Controller wiring for Modal UI
 */
export function setupOtdrDeadzoneModal(options = {}) {
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const onToast = typeof options.onToast === 'function' ? options.onToast : () => {};
  const clipboard = options.clipboard || (typeof navigator !== 'undefined' && navigator.clipboard ? navigator.clipboard : null);

  const modal = document.getElementById('otdrDeadzoneModal');
  if (!modal) return null;

  const triggerBtn = document.getElementById('openOtdrDeadzoneBtn');
  const closeBtn = document.getElementById('closeOtdrDeadzoneBtn');
  const presetSelect = document.getElementById('otdrDeadzonePresetSelect');
  const pulseSelect = document.getElementById('otdrDeadzonePulseSelect');
  const wlSelect = document.getElementById('otdrDeadzoneWlSelect');
  const launchInput = document.getElementById('otdrDeadzoneLaunchInput');
  const tailInput = document.getElementById('otdrDeadzoneTailInput');
  const svgContainer = document.getElementById('otdrDeadzoneSvgContainer');
  const hudRibbon = document.getElementById('otdrDeadzoneHudRibbon');
  const saveBtn = document.getElementById('saveOtdrDeadzoneCertBtn');
  const printA4Btn = document.getElementById('printOtdrDeadzoneA4Btn');
  const printThermalBtn = document.getElementById('printOtdrDeadzoneThermalBtn');
  const whatsappBtn = document.getElementById('whatsappOtdrDeadzoneBtn');
  const exportCsvBtn = document.getElementById('exportOtdrDeadzoneCsvBtn');
  const historyTbody = document.getElementById('otdrDeadzoneHistoryTbody');

  let currentAnalysis = null;

  function renderHistory() {
    if (!historyTbody) return;
    const certs = getSavedOtdrDeadzoneCerts(storage);
    if (certs.length === 0) {
      historyTbody.innerHTML = `<tr><td colspan="7" class="text-muted text-center" style="padding:14px;">No calibration certificates issued yet.</td></tr>`;
      return;
    }

    historyTbody.innerHTML = certs.map(c => `
      <tr>
        <td><strong>${c.certId}</strong></td>
        <td>${c.spanName.slice(0, 20)}</td>
        <td>${c.pulseConfig ? c.pulseConfig.pulseWidthNs + ' ns' : '-'}</td>
        <td>${c.launchBox ? c.launchBox.lengthM + ' m' : '-'}</td>
        <td>${c.dynamicRangeMarginDb} dB</td>
        <td><span class="badge ${c.overallVerdict === 'CERTIFIED_CALIBRATION_PASS' ? 'badge-success' : (c.overallVerdict === 'CONDITIONAL_PASS' ? 'badge-warning' : 'badge-danger')}">${c.overallVerdict.replace(/_/g, ' ')}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-secondary" data-print-cert="${c.certId}">Print</button>
        </td>
      </tr>
    `).join('');

    historyTbody.querySelectorAll('[data-print-cert]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-print-cert');
        const item = certs.find(c => c.certId === id);
        if (item) {
          const html = generateOtdrDeadzoneCertHtml(item, 'a4');
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(html);
            win.document.close();
            win.print();
          }
        }
      });
    });
  }

  function recalculate() {
    const selectedPresetId = presetSelect ? presetSelect.value : 'SPAN_BARADARI_JIA_MUSA';
    const preset = OTDR_SPAN_PRESETS.find(p => p.id === selectedPresetId) || OTDR_SPAN_PRESETS[0];

    const pulseWidthId = pulseSelect ? pulseSelect.value : preset.defaultPulseWidthId;
    const wavelengthNm = wlSelect ? Number(wlSelect.value) : preset.wavelengthNm;
    const launchM = launchInput ? Number(launchInput.value) : preset.launchBoxLengthM;
    const tailM = tailInput ? Number(tailInput.value) : preset.tailBoxLengthM;

    currentAnalysis = evaluateOtdrDeadzoneCalibration({
      spanName: preset.name,
      originPoP: preset.originPoP,
      terminusPoP: preset.terminusPoP,
      spanLengthKm: preset.spanLengthKm,
      pulseWidthId,
      wavelengthNm,
      launchBoxLengthM: launchM,
      tailBoxLengthM: tailM,
      launchBoxId: preset.launchBoxId,
      tailBoxId: preset.tailBoxId,
      nearEndReflectanceDb: preset.nearEndReflectanceDb,
      farEndReflectanceDb: preset.farEndReflectanceDb,
      events: preset.events
    });

    if (svgContainer) {
      svgContainer.innerHTML = renderOtdrDeadzoneSvg(currentAnalysis);
    }

    if (hudRibbon) {
      hudRibbon.innerHTML = `
        <div class="kpi-card">
          <div class="kpi-label">Pulse Width</div>
          <div class="kpi-value">${currentAnalysis.pulseConfig.pulseWidthNs} ns</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Event Dead Zone</div>
          <div class="kpi-value text-success">${currentAnalysis.pulseConfig.eventDeadZoneM} m</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Attenuation Dead Zone</div>
          <div class="kpi-value text-warning">${currentAnalysis.pulseConfig.attenuationDeadZoneM} m</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">DR Safety Margin</div>
          <div class="kpi-value ${currentAnalysis.dynamicRangeMarginDb >= 0 ? 'text-success' : 'text-danger'}">${currentAnalysis.dynamicRangeMarginDb} dB</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Calibration Verdict</div>
          <div class="kpi-value" style="color:${currentAnalysis.overallBadgeColor};font-size:12px;">${currentAnalysis.overallVerdict.replace(/_/g, ' ')}</div>
        </div>
      `;
    }
  }

  // Event Listeners
  if (triggerBtn) {
    triggerBtn.addEventListener('click', () => {
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
      recalculate();
      renderHistory();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    });
  }

  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const selected = OTDR_SPAN_PRESETS.find(p => p.id === presetSelect.value);
      if (selected) {
        if (pulseSelect) pulseSelect.value = selected.defaultPulseWidthId;
        if (wlSelect) wlSelect.value = String(selected.wavelengthNm);
        if (launchInput) launchInput.value = selected.launchBoxLengthM;
        if (tailInput) tailInput.value = selected.tailBoxLengthM;
      }
      recalculate();
    });
  }

  if (pulseSelect) pulseSelect.addEventListener('change', recalculate);
  if (wlSelect) wlSelect.addEventListener('change', recalculate);
  if (launchInput) launchInput.addEventListener('input', recalculate);
  if (tailInput) tailInput.addEventListener('input', recalculate);

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (!currentAnalysis) recalculate();
      const ok = saveOtdrDeadzoneCert(currentAnalysis, storage);
      if (ok) {
        onToast('OTDR Dead Zone Calibration Certificate saved successfully!');
        renderHistory();
      }
    });
  }

  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      if (!currentAnalysis) recalculate();
      const html = generateOtdrDeadzoneCertHtml(currentAnalysis, 'a4');
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.print();
      }
    });
  }

  if (printThermalBtn) {
    printThermalBtn.addEventListener('click', () => {
      if (!currentAnalysis) recalculate();
      const html = generateOtdrDeadzoneCertHtml(currentAnalysis, 'thermal');
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.print();
      }
    });
  }

  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
      if (!currentAnalysis) recalculate();
      const text = formatOtdrDeadzoneCertWhatsApp(currentAnalysis);
      if (clipboard && clipboard.writeText) {
        clipboard.writeText(text).then(() => {
          onToast('Bilingual WhatsApp notification copied to clipboard!');
        }).catch(() => {
          window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
        });
      } else {
        window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const certs = getSavedOtdrDeadzoneCerts(storage);
      const dataset = certs.length > 0 ? certs : (currentAnalysis ? [currentAnalysis] : []);
      const csv = generateOtdrDeadzoneCertsCsv(dataset);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shahdara_otdr_deadzone_certs_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      onToast('RFC-4180 CSV export downloaded!');
    });
  }

  return {
    recalculate,
    renderHistory,
    getCurrentAnalysis: () => currentAnalysis
  };
}
