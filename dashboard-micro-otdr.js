import { formatPKR } from './core.js';

/**
 * Micro-OTDR Built-in SFP Optical Transceiver Reflection Event Signature Analysis
 * ITU-T G.984 / SFF-8472 / SFF-8636 MSA Optical Transceiver Diagnostics with Embedded Reflectometry
 *
 * Models physical-layer Micro-OTDR (uOTDR) optical reflectometry embedded directly inside
 * OLT and core/distribution switch SFP/SFP+ optical transceivers across Shahdara ISP distribution.
 *
 * Automatically tracks Rayleigh backscattering slopes, Fresnel reflection spikes (fiber breaks,
 * dirty patch connectors, mechanical splices), macro-bend non-reflective step attenuations,
 * round-trip optical time of flight (ToF), optical return loss (ORL), and correlates link integrity
 * with real-time Shahdara subscriber revenue exposure.
 */

export const MICRO_OTDR_CONSTANTS = {
  SPEED_OF_LIGHT_KM_S: 299792.458,
  FIBER_REFRACTIVE_INDEX: 1.4682,
  FIBER_ATTENUATION_COEFF_DB_KM: {
    '1310': 0.35,
    '1490': 0.28,
    '1550': 0.21,
    '1577': 0.20
  },
  DEFAULT_WAVELENGTH: '1310',
  PULSE_WIDTHS_NS: [10, 50, 100, 500, 1000],
  DEFAULT_PULSE_WIDTH_NS: 50,
  DEFAULT_THRESHOLD_DBM: -30.0,
  MIN_THRESHOLD_DBM: -45.0,
  MAX_THRESHOLD_DBM: -15.0,
  FAULT_PRESETS: {
    NORMAL: 'Normal Intact Link (Continuous Rayleigh Backscatter)',
    FIBER_CUT_1400M: 'Fiber Cut / Cleaved Break at 1,420m (Fresnel Reflection Spike)',
    DIRTY_CONNECTOR_850M: 'Dirty APC Patch Connector at 850m (-28dB Reflectance & 1.8dB Step Loss)',
    MACRO_BEND_2100M: 'Macro-Bend Cable Pinch at 2,100m (3.4dB Non-Reflective Step Loss)'
  },
  EVENT_TYPES: {
    LAUNCH: 'Initial SFP Launch Connector',
    FRESNEL_REFLECTION: 'Fresnel Reflection (Connector/Break)',
    ATTENUATION_STEP: 'Non-Reflective Step Loss (Macro-Bend/Splice)',
    TERMINATION_BREAK: 'Fiber Break / End of Fiber',
    NORMAL_SPLICE: 'Fusion Splice Joint'
  },
  SEVERITY: {
    OPTIMAL: 'Optimal',
    WARNING: 'Warning',
    CRITICAL: 'Critical'
  }
};

export const SHAHDARA_MICRO_OTDR_PORTS = [
  {
    id: 'sfp-port-01',
    name: 'OLT-01 Port 1 Feeder (Shahdara Town)',
    role: 'XGS-PON Feeder Trunk',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    transceiverType: 'XGS-PON OLT SFP+ (N2 Class)',
    defaultWavelength: '1577',
    txPowerDbm: 4.5,
    rxSensitivityDbm: -28.0,
    targetDistanceM: 4800,
    fiberType: 'ITU-T G.652.D Single-Mode'
  },
  {
    id: 'sfp-port-02',
    name: 'SW-01 Port 24 Distribution (Baradari Road)',
    role: 'Gigabit BiDi Feeder',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    transceiverType: '1000BASE-BX BiDi SFP (10km)',
    defaultWavelength: '1310',
    txPowerDbm: -3.0,
    rxSensitivityDbm: -20.0,
    targetDistanceM: 3200,
    fiberType: 'ITU-T G.657.A1 Bend-Insensitive'
  },
  {
    id: 'sfp-port-03',
    name: 'OLT-02 Port 8 Trunk (Vandala Road)',
    role: '10GBASE-LR Core Trunk',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    transceiverType: '10GBASE-LR SFP+ (10km DFB)',
    defaultWavelength: '1310',
    txPowerDbm: -1.0,
    rxSensitivityDbm: -14.4,
    targetDistanceM: 5400,
    fiberType: 'ITU-T G.652.D Single-Mode'
  },
  {
    id: 'sfp-port-04',
    name: 'SW-02 Port 12 Feeder (Jia Musa)',
    role: 'Gigabit Long-Haul Feeder',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    transceiverType: '1000BASE-LX SFP (10km)',
    defaultWavelength: '1310',
    txPowerDbm: -4.0,
    rxSensitivityDbm: -19.0,
    targetDistanceM: 2750,
    fiberType: 'ITU-T G.652.D Single-Mode'
  },
  {
    id: 'sfp-port-05',
    name: 'CORE-SW Port 48 Outer Ring (Begum Kot)',
    role: '10GBASE-ER Perimeter Link',
    primaryArea: 'Begum Kot',
    aliasAreas: ['Begum Kot', 'Sheikhupura Road', 'Kot Begum'],
    transceiverType: '10GBASE-ER SFP+ (40km EML Cooled)',
    defaultWavelength: '1550',
    txPowerDbm: 1.0,
    rxSensitivityDbm: -15.8,
    targetDistanceM: 8600,
    fiberType: 'ITU-T G.652.D Low Water Peak'
  }
];

// In-memory simulation state
let currentSelectedPortId = 'sfp-port-01';
let currentSelectedWavelength = '1577';
let currentSelectedPulseWidthNs = 50;
let currentSelectedFaultPreset = 'NORMAL';
let currentThresholdDbm = -30.0;

export function getMicroOtdrPortId() {
  return currentSelectedPortId;
}

export function setMicroOtdrPortId(id) {
  const match = SHAHDARA_MICRO_OTDR_PORTS.find(p => p.id === id);
  if (match) {
    currentSelectedPortId = match.id;
    currentSelectedWavelength = match.defaultWavelength;
  }
  return currentSelectedPortId;
}

export function getMicroOtdrWavelength() {
  return currentSelectedWavelength;
}

export function setMicroOtdrWavelength(wl) {
  if (MICRO_OTDR_CONSTANTS.FIBER_ATTENUATION_COEFF_DB_KM[String(wl)]) {
    currentSelectedWavelength = String(wl);
  }
  return currentSelectedWavelength;
}

export function getMicroOtdrPulseWidth() {
  return currentSelectedPulseWidthNs;
}

export function setMicroOtdrPulseWidth(pw) {
  const val = Number(pw);
  if (MICRO_OTDR_CONSTANTS.PULSE_WIDTHS_NS.includes(val)) {
    currentSelectedPulseWidthNs = val;
  }
  return currentSelectedPulseWidthNs;
}

export function getMicroOtdrFaultPreset() {
  return currentSelectedFaultPreset;
}

export function setMicroOtdrFaultPreset(preset) {
  if (MICRO_OTDR_CONSTANTS.FAULT_PRESETS[preset]) {
    currentSelectedFaultPreset = preset;
  }
  return currentSelectedFaultPreset;
}

export function getMicroOtdrThresholdDbm() {
  return currentThresholdDbm;
}

export function setMicroOtdrThresholdDbm(dbm) {
  const num = Number(dbm);
  if (!Number.isNaN(num)) {
    currentThresholdDbm = Math.max(
      MICRO_OTDR_CONSTANTS.MIN_THRESHOLD_DBM,
      Math.min(MICRO_OTDR_CONSTANTS.MAX_THRESHOLD_DBM, num)
    );
  }
  return currentThresholdDbm;
}

export function resetMicroOtdrSimState() {
  currentSelectedPortId = 'sfp-port-01';
  currentSelectedWavelength = '1577';
  currentSelectedPulseWidthNs = 50;
  currentSelectedFaultPreset = 'NORMAL';
  currentThresholdDbm = -30.0;
}

/**
 * Calculates round-trip optical time of flight (ToF) in microseconds.
 * tau = (2 * n * distanceMeters) / (speedOfLight * 1000)
 */
export function calculateFiberPropagationDelay(distanceMeters, refractiveIndex = MICRO_OTDR_CONSTANTS.FIBER_REFRACTIVE_INDEX) {
  const d = Math.max(0, Number(distanceMeters) || 0);
  const n = Number(refractiveIndex) || MICRO_OTDR_CONSTANTS.FIBER_REFRACTIVE_INDEX;
  const cKmS = MICRO_OTDR_CONSTANTS.SPEED_OF_LIGHT_KM_S;
  // c in meters per microsecond: (299792.458 * 1000) / 1e6 = 299.792458 m/us
  const cMPerUs = (cKmS * 1000) / 1000000;
  const roundTripTimeUs = (2 * n * d) / cMPerUs;
  return Number(roundTripTimeUs.toFixed(3));
}

/**
 * Computes event signatures along the fiber link based on selected port, wavelength,
 * pulse width, and fault conditions.
 */
export function calculateEventSignatures(port, {
  wavelength = '1310',
  pulseWidthNs = 50,
  faultPreset = 'NORMAL',
  thresholdDbm = -30.0
} = {}) {
  const p = port || SHAHDARA_MICRO_OTDR_PORTS[0];
  const wl = String(wavelength);
  const alphaDbKm = MICRO_OTDR_CONSTANTS.FIBER_ATTENUATION_COEFF_DB_KM[wl] || 0.35;
  const targetDist = p.targetDistanceM;
  const events = [];

  // Event 0: Launch connector at 0m
  const launchReflectance = -38.5;
  const launchLoss = 0.35;
  events.push({
    index: 1,
    distanceM: 0,
    distanceKm: 0.0,
    type: MICRO_OTDR_CONSTANTS.EVENT_TYPES.LAUNCH,
    reflectanceDb: launchReflectance,
    stepLossDb: launchLoss,
    cumulativeLossDb: launchLoss,
    severity: MICRO_OTDR_CONSTANTS.SEVERITY.OPTIMAL,
    propagationDelayUs: 0.0,
    notes: 'SFP internal optical ferrule interface'
  });

  let runningLoss = launchLoss;
  let activeDistanceLimit = targetDist;
  let faultDetected = false;
  let faultType = null;
  let faultDistanceM = null;

  if (faultPreset === 'FIBER_CUT_1400M') {
    faultDetected = true;
    faultType = 'FIBER_CUT';
    faultDistanceM = 1420;
    activeDistanceLimit = 1420;

    // Normal intermediate splice before cut at 650m
    const spliceDist = 650;
    const fiberLossToSplice = (spliceDist / 1000) * alphaDbKm;
    const spliceStep = 0.08;
    runningLoss += fiberLossToSplice + spliceStep;
    events.push({
      index: 2,
      distanceM: spliceDist,
      distanceKm: Number((spliceDist / 1000).toFixed(2)),
      type: MICRO_OTDR_CONSTANTS.EVENT_TYPES.NORMAL_SPLICE,
      reflectanceDb: -65.0,
      stepLossDb: spliceStep,
      cumulativeLossDb: Number(runningLoss.toFixed(2)),
      severity: MICRO_OTDR_CONSTANTS.SEVERITY.OPTIMAL,
      propagationDelayUs: calculateFiberPropagationDelay(spliceDist),
      notes: 'Fused feeder junction closure'
    });

    // Fiber cut at 1420m (Clean cleave Fresnel spike followed by infinite loss)
    const cutSpanM = 1420 - spliceDist;
    const cutFiberLoss = (cutSpanM / 1000) * alphaDbKm;
    runningLoss += cutFiberLoss + 35.0; // Break causes full link drop
    events.push({
      index: 3,
      distanceM: 1420,
      distanceKm: 1.42,
      type: MICRO_OTDR_CONSTANTS.EVENT_TYPES.TERMINATION_BREAK,
      reflectanceDb: -14.8, // High Fresnel reflection of glass-to-air interface
      stepLossDb: 35.0,
      cumulativeLossDb: Number(runningLoss.toFixed(2)),
      severity: MICRO_OTDR_CONSTANTS.SEVERITY.CRITICAL,
      propagationDelayUs: calculateFiberPropagationDelay(1420),
      notes: 'Catastrophic fiber break / physical shear'
    });
  } else if (faultPreset === 'DIRTY_CONNECTOR_850M') {
    faultDetected = true;
    faultType = 'DIRTY_CONNECTOR';
    faultDistanceM = 850;

    const fiberLossToConn = (850 / 1000) * alphaDbKm;
    const connStepLoss = 1.85;
    runningLoss += fiberLossToConn + connStepLoss;
    events.push({
      index: 2,
      distanceM: 850,
      distanceKm: 0.85,
      type: MICRO_OTDR_CONSTANTS.EVENT_TYPES.FRESNEL_REFLECTION,
      reflectanceDb: -26.2, // Contaminated optical connector reflection
      stepLossDb: connStepLoss,
      cumulativeLossDb: Number(runningLoss.toFixed(2)),
      severity: MICRO_OTDR_CONSTANTS.SEVERITY.WARNING,
      propagationDelayUs: calculateFiberPropagationDelay(850),
      notes: 'Contaminated APC patch adapter ferrule'
    });

    // Splice at 2100m
    if (targetDist > 2100) {
      const dist2 = 2100;
      const spanLoss = ((dist2 - 850) / 1000) * alphaDbKm;
      const spliceStep = 0.07;
      runningLoss += spanLoss + spliceStep;
      events.push({
        index: 3,
        distanceM: dist2,
        distanceKm: 2.1,
        type: MICRO_OTDR_CONSTANTS.EVENT_TYPES.NORMAL_SPLICE,
        reflectanceDb: -63.5,
        stepLossDb: spliceStep,
        cumulativeLossDb: Number(runningLoss.toFixed(2)),
        severity: MICRO_OTDR_CONSTANTS.SEVERITY.OPTIMAL,
        propagationDelayUs: calculateFiberPropagationDelay(dist2),
        notes: 'Mid-span splice enclosure'
      });
    }

    // End of fiber termination
    const endSpanLoss = ((targetDist - (targetDist > 2100 ? 2100 : 850)) / 1000) * alphaDbKm;
    runningLoss += endSpanLoss + 0.45;
    events.push({
      index: events.length + 1,
      distanceM: targetDist,
      distanceKm: Number((targetDist / 1000).toFixed(2)),
      type: MICRO_OTDR_CONSTANTS.EVENT_TYPES.TERMINATION_BREAK,
      reflectanceDb: -42.0,
      stepLossDb: 0.45,
      cumulativeLossDb: Number(runningLoss.toFixed(2)),
      severity: MICRO_OTDR_CONSTANTS.SEVERITY.OPTIMAL,
      propagationDelayUs: calculateFiberPropagationDelay(targetDist),
      notes: 'Remote termination patch / optical splitter inlet'
    });
  } else if (faultPreset === 'MACRO_BEND_2100M') {
    faultDetected = true;
    faultType = 'MACRO_BEND';
    faultDistanceM = 2100;

    // Normal splice at 1100m
    const spliceDist = 1100;
    const fiberLoss1 = (spliceDist / 1000) * alphaDbKm;
    runningLoss += fiberLoss1 + 0.06;
    events.push({
      index: 2,
      distanceM: spliceDist,
      distanceKm: 1.1,
      type: MICRO_OTDR_CONSTANTS.EVENT_TYPES.NORMAL_SPLICE,
      reflectanceDb: -66.0,
      stepLossDb: 0.06,
      cumulativeLossDb: Number(runningLoss.toFixed(2)),
      severity: MICRO_OTDR_CONSTANTS.SEVERITY.OPTIMAL,
      propagationDelayUs: calculateFiberPropagationDelay(spliceDist),
      notes: 'Outdoor distribution hub splice'
    });

    // Macro-bend at 2100m (Severe step attenuation without Fresnel reflection spike)
    // Higher wavelengths (1550/1577nm) suffer more severe macro-bend loss
    const bendWavelengthMultiplier = wl === '1577' ? 1.45 : wl === '1550' ? 1.35 : 1.0;
    const bendStepLoss = Number((3.40 * bendWavelengthMultiplier).toFixed(2));
    const span2Loss = ((2100 - spliceDist) / 1000) * alphaDbKm;
    runningLoss += span2Loss + bendStepLoss;
    events.push({
      index: 3,
      distanceM: 2100,
      distanceKm: 2.1,
      type: MICRO_OTDR_CONSTANTS.EVENT_TYPES.ATTENUATION_STEP,
      reflectanceDb: -62.0, // Non-reflective event
      stepLossDb: bendStepLoss,
      cumulativeLossDb: Number(runningLoss.toFixed(2)),
      severity: MICRO_OTDR_CONSTANTS.SEVERITY.WARNING,
      propagationDelayUs: calculateFiberPropagationDelay(2100),
      notes: 'Pole clamp cable pinch / severe tight bend radius'
    });

    // End of fiber termination
    if (targetDist > 2100) {
      const endSpanLoss = ((targetDist - 2100) / 1000) * alphaDbKm;
      runningLoss += endSpanLoss + 0.50;
      events.push({
        index: 4,
        distanceM: targetDist,
        distanceKm: Number((targetDist / 1000).toFixed(2)),
        type: MICRO_OTDR_CONSTANTS.EVENT_TYPES.TERMINATION_BREAK,
        reflectanceDb: -41.5,
        stepLossDb: 0.50,
        cumulativeLossDb: Number(runningLoss.toFixed(2)),
        severity: MICRO_OTDR_CONSTANTS.SEVERITY.OPTIMAL,
        propagationDelayUs: calculateFiberPropagationDelay(targetDist),
        notes: 'Remote destination ODF termination'
      });
    }
  } else {
    // Normal healthy intact link
    // Intermediate splices
    const spliceDist1 = Math.round(targetDist * 0.35);
    const spliceDist2 = Math.round(targetDist * 0.70);

    const loss1 = (spliceDist1 / 1000) * alphaDbKm + 0.05;
    runningLoss += loss1;
    events.push({
      index: 2,
      distanceM: spliceDist1,
      distanceKm: Number((spliceDist1 / 1000).toFixed(2)),
      type: MICRO_OTDR_CONSTANTS.EVENT_TYPES.NORMAL_SPLICE,
      reflectanceDb: -64.0,
      stepLossDb: 0.05,
      cumulativeLossDb: Number(runningLoss.toFixed(2)),
      severity: MICRO_OTDR_CONSTANTS.SEVERITY.OPTIMAL,
      propagationDelayUs: calculateFiberPropagationDelay(spliceDist1),
      notes: 'Poleside splice enclosure tray'
    });

    const loss2 = ((spliceDist2 - spliceDist1) / 1000) * alphaDbKm + 0.06;
    runningLoss += loss2;
    events.push({
      index: 3,
      distanceM: spliceDist2,
      distanceKm: Number((spliceDist2 / 1000).toFixed(2)),
      type: MICRO_OTDR_CONSTANTS.EVENT_TYPES.NORMAL_SPLICE,
      reflectanceDb: -65.5,
      stepLossDb: 0.06,
      cumulativeLossDb: Number(runningLoss.toFixed(2)),
      severity: MICRO_OTDR_CONSTANTS.SEVERITY.OPTIMAL,
      propagationDelayUs: calculateFiberPropagationDelay(spliceDist2),
      notes: 'Fiber distribution terminal pass-through'
    });

    const lossEnd = ((targetDist - spliceDist2) / 1000) * alphaDbKm + 0.40;
    runningLoss += lossEnd;
    events.push({
      index: 4,
      distanceM: targetDist,
      distanceKm: Number((targetDist / 1000).toFixed(2)),
      type: MICRO_OTDR_CONSTANTS.EVENT_TYPES.TERMINATION_BREAK,
      reflectanceDb: -45.0,
      stepLossDb: 0.40,
      cumulativeLossDb: Number(runningLoss.toFixed(2)),
      severity: MICRO_OTDR_CONSTANTS.SEVERITY.OPTIMAL,
      propagationDelayUs: calculateFiberPropagationDelay(targetDist),
      notes: 'Far-end optical termination / PLC splitter'
    });
  }

  // Optical Return Loss (ORL): Integrated reflectance of all discrete reflections and backscatter
  // ORL = -10 * log10(sum(10^(R_i / 10)))
  let sumPowerLinear = 0;
  for (const ev of events) {
    if (ev.reflectanceDb) {
      sumPowerLinear += Math.pow(10, ev.reflectanceDb / 10);
    }
  }
  const opticalReturnLossDb = sumPowerLinear > 0
    ? Number((-10 * Math.log10(sumPowerLinear)).toFixed(1))
    : 35.0;

  // Optical Power Budget: Tx Power - Total Link Loss
  const rxPowerDbm = Number((p.txPowerDbm - runningLoss).toFixed(2));
  const opticalSafetyMarginDb = Number((rxPowerDbm - p.rxSensitivityDbm).toFixed(2));

  let linkStatus = MICRO_OTDR_CONSTANTS.SEVERITY.OPTIMAL;
  if (faultType === 'FIBER_CUT') {
    linkStatus = MICRO_OTDR_CONSTANTS.SEVERITY.CRITICAL;
  } else if (faultType === 'DIRTY_CONNECTOR' || faultType === 'MACRO_BEND' || opticalSafetyMarginDb < 2.0) {
    linkStatus = MICRO_OTDR_CONSTANTS.SEVERITY.WARNING;
  }

  return {
    port: p,
    wavelength: wl,
    pulseWidthNs: Number(pulseWidthNs),
    faultPreset,
    thresholdDbm: Number(thresholdDbm),
    events,
    activeDistanceLimit,
    faultDetected,
    faultType,
    faultDistanceM,
    totalLinkLossDb: Number(runningLoss.toFixed(2)),
    opticalReturnLossDb,
    rxPowerDbm,
    opticalSafetyMarginDb,
    linkStatus,
    propagationRoundTripUs: calculateFiberPropagationDelay(activeDistanceLimit)
  };
}

/**
 * Calculates comprehensive Micro-OTDR metrics including Shahdara ISP subscriber
 * and revenue correlation.
 */
export function calculateMicroOtdrMetrics(state, options = {}) {
  const selectedPortId = options.selectedPortId || currentSelectedPortId;
  const port = SHAHDARA_MICRO_OTDR_PORTS.find(p => p.id === selectedPortId) || SHAHDARA_MICRO_OTDR_PORTS[0];
  const wavelength = options.wavelength || currentSelectedWavelength || port.defaultWavelength;
  const pulseWidthNs = options.pulseWidthNs !== undefined ? options.pulseWidthNs : currentSelectedPulseWidthNs;
  const faultPreset = options.faultPreset || currentSelectedFaultPreset;
  const thresholdDbm = options.thresholdDbm !== undefined ? options.thresholdDbm : currentThresholdDbm;

  const eventData = calculateEventSignatures(port, {
    wavelength,
    pulseWidthNs,
    faultPreset,
    thresholdDbm
  });

  // Calculate customer impact in the feeder's serving area
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const areaMatches = (c) => {
    if (c.archived) return false;
    const cArea = (c.area || '').trim().toLowerCase();
    if (cArea === port.primaryArea.trim().toLowerCase()) return true;
    return port.aliasAreas.some(alias => alias.trim().toLowerCase() === cArea);
  };

  let totalAreaSubscribers = 0;
  let activeSubscribers = 0;
  let monthlyBilledRevenue = 0;
  let delinquentSubscribers = 0;

  for (const c of customers) {
    if (areaMatches(c)) {
      totalAreaSubscribers++;
      const isOnline = (c.status || '').trim().toLowerCase() !== 'offline';
      if (isOnline) {
        activeSubscribers++;
      }
      // Calculate revenue
      let billVal = 0;
      if (Array.isArray(c.bills) && c.bills.length > 0) {
        const lastBill = c.bills[c.bills.length - 1];
        billVal = Number(lastBill.dueAmount || lastBill.totalAmount || c.packagePrice || 0);
      } else {
        billVal = Number(c.packagePrice || 0);
      }
      monthlyBilledRevenue += billVal;

      if ((c.status || '').trim().toLowerCase() === 'delinquent' || Number(c.balance || 0) > 0) {
        delinquentSubscribers++;
      }
    }
  }

  // Revenue at risk depends on fault severity:
  // - Clean break: 100% active subscribers affected
  // - Macro bend / Dirty connector: high packet loss / degradation (35% risk)
  // - Normal: 0 risk
  let revenueRiskMultiplier = 0;
  let affectedSubscribers = 0;
  if (eventData.faultType === 'FIBER_CUT') {
    revenueRiskMultiplier = 1.0;
    affectedSubscribers = activeSubscribers;
  } else if (eventData.faultType === 'DIRTY_CONNECTOR' || eventData.faultType === 'MACRO_BEND') {
    revenueRiskMultiplier = 0.35;
    affectedSubscribers = Math.round(activeSubscribers * 0.4);
  }

  const monthlyRevenueAtRiskPkr = Math.round(monthlyBilledRevenue * revenueRiskMultiplier);
  const revenueProtectionRate = monthlyBilledRevenue > 0
    ? Number((((monthlyBilledRevenue - monthlyRevenueAtRiskPkr) / monthlyBilledRevenue) * 100).toFixed(1))
    : 100.0;

  // Ports overview
  const portsSummary = SHAHDARA_MICRO_OTDR_PORTS.map(p => {
    const isSelected = p.id === port.id;
    const pFault = isSelected ? faultPreset : 'NORMAL';
    const sig = calculateEventSignatures(p, {
      wavelength: p.defaultWavelength,
      pulseWidthNs: 50,
      faultPreset: pFault,
      thresholdDbm: -30.0
    });
    return {
      id: p.id,
      name: p.name,
      primaryArea: p.primaryArea,
      transceiverType: p.transceiverType,
      targetDistanceM: p.targetDistanceM,
      linkStatus: sig.linkStatus,
      totalLinkLossDb: sig.totalLinkLossDb,
      opticalReturnLossDb: sig.opticalReturnLossDb,
      faultDetected: sig.faultDetected,
      isSelected
    };
  });

  return {
    selectedPort: port,
    selectedWavelength: wavelength,
    selectedPulseWidthNs: Number(pulseWidthNs),
    selectedFaultPreset: faultPreset,
    thresholdDbm: Number(thresholdDbm),
    events: eventData.events,
    activeDistanceLimit: eventData.activeDistanceLimit,
    faultDetected: eventData.faultDetected,
    faultType: eventData.faultType,
    faultDistanceM: eventData.faultDistanceM,
    totalLinkLossDb: eventData.totalLinkLossDb,
    opticalReturnLossDb: eventData.opticalReturnLossDb,
    rxPowerDbm: eventData.rxPowerDbm,
    opticalSafetyMarginDb: eventData.opticalSafetyMarginDb,
    linkStatus: eventData.linkStatus,
    propagationRoundTripUs: eventData.propagationRoundTripUs,
    totalAreaSubscribers,
    activeSubscribers,
    affectedSubscribers,
    monthlyBilledRevenue,
    monthlyRevenueAtRiskPkr,
    revenueProtectionRate,
    delinquentSubscribers,
    portsSummary
  };
}

/**
 * Pure client-side SVG trace generator for Micro-OTDR reflectometry curves.
 * Displays Backscatter Power (dBm) vs Fiber Distance (m/km).
 */
export function renderMicroOtdrTraceSvg(metrics, { compact = false } = {}) {
  const m = metrics || calculateMicroOtdrMetrics({});
  const width = compact ? 560 : 780;
  const height = compact ? 220 : 340;
  const padLeft = compact ? 45 : 65;
  const padRight = compact ? 25 : 35;
  const padTop = compact ? 25 : 35;
  const padBottom = compact ? 35 : 45;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const maxDistM = Math.max(m.selectedPort.targetDistanceM, 3000) * 1.1;
  const minPowerDbm = -55;
  const maxPowerDbm = 10;

  const scaleX = (distM) => padLeft + (Math.max(0, distM) / maxDistM) * chartW;
  const scaleY = (dbm) => {
    const clamped = Math.max(minPowerDbm, Math.min(maxPowerDbm, dbm));
    const ratio = (clamped - minPowerDbm) / (maxPowerDbm - minPowerDbm);
    return padTop + chartH - ratio * chartH;
  };

  // Generate SVG Path data for the OTDR trace
  // Initial launch pulse
  const txP = m.selectedPort.txPowerDbm;
  const alphaDbKm = MICRO_OTDR_CONSTANTS.FIBER_ATTENUATION_COEFF_DB_KM[m.selectedWavelength] || 0.35;

  let pathD = `M ${scaleX(0)} ${scaleY(minPowerDbm)}`;
  // SFP launch peak
  pathD += ` L ${scaleX(0)} ${scaleY(txP)}`;

  // Rayleigh backscatter starts ~40dB below peak pulse
  let currentP = txP - 38.0;
  let currentDist = 0;

  for (const ev of m.events) {
    if (ev.distanceM > currentDist) {
      // Draw Rayleigh downward slope to event distance
      const spanKm = (ev.distanceM - currentDist) / 1000;
      currentP -= spanKm * alphaDbKm;
      pathD += ` L ${scaleX(ev.distanceM)} ${scaleY(currentP)}`;
    }

    if (ev.type === MICRO_OTDR_CONSTANTS.EVENT_TYPES.LAUNCH) {
      // Already handled launch
      currentDist = 0;
      continue;
    }

    if (ev.type === MICRO_OTDR_CONSTANTS.EVENT_TYPES.TERMINATION_BREAK && m.faultType === 'FIBER_CUT') {
      // Sharp Fresnel spike at break
      const spikePower = Math.min(maxPowerDbm - 5, currentP + 22.0);
      pathD += ` L ${scaleX(ev.distanceM)} ${scaleY(spikePower)}`;
      // Plunge straight down to noise floor
      pathD += ` L ${scaleX(ev.distanceM + 15)} ${scaleY(minPowerDbm + 2)}`;
      pathD += ` L ${scaleX(maxDistM)} ${scaleY(minPowerDbm + 2)}`;
      break;
    } else if (ev.type === MICRO_OTDR_CONSTANTS.EVENT_TYPES.FRESNEL_REFLECTION) {
      // Connector spike
      const spikePower = currentP + 14.0;
      pathD += ` L ${scaleX(ev.distanceM)} ${scaleY(spikePower)}`;
      currentP -= ev.stepLossDb;
      pathD += ` L ${scaleX(ev.distanceM + 20)} ${scaleY(currentP)}`;
      currentDist = ev.distanceM + 20;
    } else if (ev.type === MICRO_OTDR_CONSTANTS.EVENT_TYPES.ATTENUATION_STEP) {
      // Step drop without large spike
      currentP -= ev.stepLossDb;
      pathD += ` L ${scaleX(ev.distanceM)} ${scaleY(currentP)}`;
      currentDist = ev.distanceM;
    } else if (ev.type === MICRO_OTDR_CONSTANTS.EVENT_TYPES.NORMAL_SPLICE) {
      currentP -= ev.stepLossDb;
      pathD += ` L ${scaleX(ev.distanceM)} ${scaleY(currentP)}`;
      currentDist = ev.distanceM;
    } else if (ev.type === MICRO_OTDR_CONSTANTS.EVENT_TYPES.TERMINATION_BREAK) {
      // End of link
      const endSpike = currentP + 10.0;
      pathD += ` L ${scaleX(ev.distanceM)} ${scaleY(endSpike)}`;
      pathD += ` L ${scaleX(ev.distanceM + 15)} ${scaleY(minPowerDbm + 2)}`;
      pathD += ` L ${scaleX(maxDistM)} ${scaleY(minPowerDbm + 2)}`;
      break;
    }
  }

  // Gridlines & Axis labels
  let gridXml = '';
  // Horizontal grid (Power dBm)
  for (let pDbm = -50; pDbm <= 0; pDbm += 10) {
    const y = scaleY(pDbm);
    gridXml += `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="currentColor" stroke-opacity="0.12" stroke-dasharray="3,3" />`;
    gridXml += `<text x="${padLeft - 8}" y="${y + 4}" font-size="${compact ? 9 : 11}" fill="currentColor" opacity="0.65" text-anchor="end">${pDbm}</text>`;
  }

  // Vertical grid (Distance km)
  const distStepM = maxDistM > 6000 ? 2000 : 1000;
  for (let dM = 0; dM <= maxDistM; dM += distStepM) {
    const x = scaleX(dM);
    gridXml += `<line x1="${x}" y1="${padTop}" x2="${x}" y2="${height - padBottom}" stroke="currentColor" stroke-opacity="0.12" stroke-dasharray="3,3" />`;
    const label = dM >= 1000 ? `${(dM / 1000).toFixed(0)}k` : `${dM}m`;
    gridXml += `<text x="${x}" y="${height - padBottom + 16}" font-size="${compact ? 9 : 11}" fill="currentColor" opacity="0.65" text-anchor="middle">${label}</text>`;
  }

  // Threshold line
  const threshY = scaleY(m.thresholdDbm);
  const thresholdLineXml = `
    <line x1="${padLeft}" y1="${threshY}" x2="${width - padRight}" y2="${threshY}" stroke="#ef4444" stroke-width="1.2" stroke-dasharray="4,4" />
    <text x="${width - padRight - 6}" y="${threshY - 5}" font-size="${compact ? 8 : 10}" fill="#ef4444" font-weight="600" text-anchor="end">Sens: ${m.thresholdDbm.toFixed(1)} dBm</text>
  `;

  // Event Markers
  let markersXml = '';
  for (const ev of m.events) {
    if (ev.distanceM === 0) continue;
    const evX = scaleX(ev.distanceM);
    let markerColor = '#10b981';
    let label = `${ev.distanceM}m`;

    if (ev.severity === MICRO_OTDR_CONSTANTS.SEVERITY.CRITICAL) {
      markerColor = '#ef4444';
      label = `⚡ BREAK ${ev.distanceM}m`;
    } else if (ev.severity === MICRO_OTDR_CONSTANTS.SEVERITY.WARNING) {
      markerColor = '#f59e0b';
      label = `⚠ ${ev.distanceM}m (-${ev.stepLossDb}dB)`;
    }

    markersXml += `
      <line x1="${evX}" y1="${padTop}" x2="${evX}" y2="${height - padBottom}" stroke="${markerColor}" stroke-width="${ev.severity === 'Critical' ? 2 : 1}" stroke-dasharray="2,2" stroke-opacity="0.8" />
      <circle cx="${evX}" cy="${padTop + 14}" r="${compact ? 3 : 4}" fill="${markerColor}" />
      ${!compact ? `<text x="${evX}" y="${padTop + 28}" font-size="9" fill="${markerColor}" font-weight="600" text-anchor="middle">${label}</text>` : ''}
    `;
  }

  // Status Badge / Header
  const statusColor = m.linkStatus === 'Critical' ? '#ef4444' : m.linkStatus === 'Warning' ? '#f59e0b' : '#10b981';
  const statusLabel = m.linkStatus === 'Critical' ? 'CRITICAL FIBER BREAK' : m.linkStatus === 'Warning' ? 'LINK DEGRADATION' : 'LINK OPTIMAL';

  return `
    <svg class="micro-otdr-svg" viewBox="0 0 ${width} ${height}" width="100%" style="height: auto; max-width: 100%; display: block;" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Micro-OTDR Reflection Event Trace Diagram">
      <defs>
        <linearGradient id="otdrTraceGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0284c7" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#0284c7" stop-opacity="0.02"/>
        </linearGradient>
      </defs>

      <!-- Background card -->
      <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="transparent" />

      <!-- Grids and Reference lines -->
      ${gridXml}
      ${thresholdLineXml}

      <!-- Trace Curve -->
      <path d="${pathD}" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Event Markers -->
      ${markersXml}

      <!-- Axes text labels -->
      <text x="${padLeft + 4}" y="${padTop - 8}" font-size="${compact ? 9 : 11}" fill="currentColor" opacity="0.8" font-weight="600">Backscatter Power (dBm)</text>
      <text x="${width - padRight}" y="${height - 10}" font-size="${compact ? 9 : 11}" fill="currentColor" opacity="0.8" font-weight="600" text-anchor="end">Distance (m)</text>

      <!-- Trace Information pill -->
      <g transform="translate(${padLeft + 10}, ${padTop + (compact ? 8 : 16)})">
        <rect x="0" y="0" width="${compact ? 180 : 260}" height="${compact ? 22 : 28}" rx="4" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.15" />
        <text x="8" y="${compact ? 15 : 18}" font-size="${compact ? 9 : 11}" fill="currentColor" font-weight="600">
          λ: ${m.selectedWavelength}nm | Pulse: ${m.selectedPulseWidthNs}ns | ORL: ${m.opticalReturnLossDb}dB
        </text>
      </g>

      <!-- Status badge on top right -->
      <g transform="translate(${width - padRight - (compact ? 110 : 140)}, ${padTop - (compact ? 12 : 16)})">
        <rect x="0" y="0" width="${compact ? 110 : 140}" height="${compact ? 18 : 22}" rx="4" fill="${statusColor}" fill-opacity="0.18" stroke="${statusColor}" stroke-width="1" />
        <text x="${compact ? 55 : 70}" y="${compact ? 13 : 16}" font-size="${compact ? 8 : 10}" fill="${statusColor}" font-weight="700" text-anchor="middle">${statusLabel}</text>
      </g>
    </svg>
  `.trim();
}

/**
 * Generates formatted plain-text diagnostic audit report for clipboard export.
 */
export function generateMicroOtdrReport(metrics) {
  const m = metrics || calculateMicroOtdrMetrics({});
  const lines = [];

  lines.push('================================================================');
  lines.push('SHAHDARA ISP · SFP MICRO-OTDR REFLECTOMETRY AUDIT BRIEFING');
  lines.push('ITU-T G.984 / SFF-8472 / SFF-8636 EMBEDDED DIAGNOSTICS');
  lines.push('================================================================');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Monitored Port: ${m.selectedPort.name}`);
  lines.push(`Transceiver Model: ${m.selectedPort.transceiverType}`);
  lines.push(`Serving Feeder Area: ${m.selectedPort.primaryArea}`);
  lines.push(`Operating Wavelength: ${m.selectedWavelength} nm`);
  lines.push(`Diagnostic Pulse Width: ${m.selectedPulseWidthNs} ns`);
  lines.push(`Receiver Sensitivity: ${m.selectedPort.rxSensitivityDbm} dBm (Threshold: ${m.thresholdDbm} dBm)`);
  lines.push(`Target Link Length: ${m.selectedPort.targetDistanceM} m`);
  lines.push('');
  lines.push('----------------------------------------------------------------');
  lines.push('OPTICAL LINK PHYSICAL METRICS');
  lines.push('----------------------------------------------------------------');
  lines.push(`Link Integrity Status: ${m.linkStatus.toUpperCase()}`);
  lines.push(`Fault Detected: ${m.faultDetected ? 'YES' : 'NO'}`);
  if (m.faultDetected) {
    lines.push(`Fault Classification: ${m.faultType}`);
    lines.push(`Fault Location Distance: ${m.faultDistanceM} m (${(m.faultDistanceM / 1000).toFixed(3)} km)`);
  }
  lines.push(`Total Link Loss: ${m.totalLinkLossDb.toFixed(2)} dB`);
  lines.push(`Optical Return Loss (ORL): ${m.opticalReturnLossDb.toFixed(1)} dB`);
  lines.push(`Receiver Optical Power: ${m.rxPowerDbm.toFixed(2)} dBm`);
  lines.push(`Optical Safety Margin: ${m.opticalSafetyMarginDb.toFixed(2)} dB`);
  lines.push(`Round-Trip ToF Delay: ${m.propagationRoundTripUs.toFixed(3)} µs`);
  lines.push('');
  lines.push('----------------------------------------------------------------');
  lines.push('DISCRETE REFLECTION & ATTENUATION EVENT REGISTER');
  lines.push('----------------------------------------------------------------');
  lines.push('Index | Distance  | Event Classification             | Loss (dB) | Reflectance');
  lines.push('----------------------------------------------------------------');
  for (const ev of m.events) {
    const idx = String(ev.index).padEnd(5);
    const dist = `${ev.distanceM}m`.padEnd(9);
    const type = ev.type.padEnd(32);
    const loss = `${ev.stepLossDb.toFixed(2)} dB`.padEnd(9);
    const refl = `${ev.reflectanceDb.toFixed(1)} dB`;
    lines.push(`${idx} | ${dist} | ${type} | ${loss} | ${refl}`);
  }
  lines.push('');
  lines.push('----------------------------------------------------------------');
  lines.push('SUBSCRIBER REVENUE AT RISK (SHAHDARA ISP)');
  lines.push('----------------------------------------------------------------');
  lines.push(`Serving Feeder Area: ${m.selectedPort.primaryArea}`);
  lines.push(`Total Area Subscribers: ${m.totalAreaSubscribers}`);
  lines.push(`Active Online Subscribers: ${m.activeSubscribers}`);
  lines.push(`Impacted Subscribers: ${m.affectedSubscribers}`);
  lines.push(`Monthly Area Revenue: ${formatPKR(m.monthlyBilledRevenue)}`);
  lines.push(`Monthly Revenue at Risk: ${formatPKR(m.monthlyRevenueAtRiskPkr)}`);
  lines.push(`Revenue Protection Rate: ${m.revenueProtectionRate}%`);
  lines.push('================================================================');
  lines.push('RECOMMENDED FIELD SPLICING ACTION:');
  if (m.faultType === 'FIBER_CUT') {
    lines.push(`[URGENT] Dispatch OTDR splicing crew to ~${m.faultDistanceM}m along feeder route.`);
    lines.push('Inspect aerial fiber span for physical break, construction dig cut, or vehicle snag.');
  } else if (m.faultType === 'DIRTY_CONNECTOR') {
    lines.push(`Clean and inspect optical patch adapter at ~${m.faultDistanceM}m with fiber microscope.`);
    lines.push('Replace dirty patch cord or clean APC ceramic ferrule.');
  } else if (m.faultType === 'MACRO_BEND') {
    lines.push(`Relieve mechanical cable pinch or pole clamp stress at ~${m.faultDistanceM}m.`);
    lines.push('Restore minimum fiber bend radius (>30mm) along aerial drop.');
  } else {
    lines.push('Link operating well within ITU-T G.984 optical budget specifications.');
    lines.push('No corrective physical splicing intervention required.');
  }
  lines.push('================================================================');

  return lines.join('\n');
}

/**
 * Wires DOM event listeners, modal controls, and table updates.
 */
export function setupMicroOtdrModal(state, {
  referenceDate = new Date(),
  onFilterArea,
  onFilterCustomer,
  onToast,
  clipboard
} = {}) {
  const modal = document.getElementById('dashboardMicroOtdrModal');
  const openBtn = document.getElementById('dashboardOpenMicroOtdrModalBtn');
  const closeBtn = document.getElementById('dashboardMicroOtdrModalCloseBtn');

  const portSelect = document.getElementById('microOtdrPortSelect');
  const wavelengthSelect = document.getElementById('microOtdrWavelengthSelect');
  const pulseWidthSelect = document.getElementById('microOtdrPulseWidthSelect');
  const faultSelect = document.getElementById('microOtdrFaultSelect');
  const threshSlider = document.getElementById('microOtdrThreshSlider');
  const threshValPill = document.getElementById('microOtdrThreshVal');
  const resetBtn = document.getElementById('microOtdrResetBtn');

  const kpiPortName = document.getElementById('microOtdrKpiPortName');
  const kpiFaultDistance = document.getElementById('microOtdrKpiFaultDistance');
  const kpiReturnLoss = document.getElementById('microOtdrKpiReturnLoss');
  const statusBadge = document.getElementById('microOtdrStatusBadge');
  const kpiRevenueRisk = document.getElementById('microOtdrKpiRevenueRisk');

  const modalChartWrap = document.getElementById('microOtdrModalChartWrap');
  const tableBody = document.getElementById('microOtdrEventsTableBody');
  const filterAreaBtn = document.getElementById('microOtdrFilterAreaBtn');
  const copyReportBtn = document.getElementById('dashboardCopyMicroOtdrReportBtn');

  function populateSelectOptions() {
    if (portSelect && portSelect.options.length === 0) {
      portSelect.innerHTML = SHAHDARA_MICRO_OTDR_PORTS.map(p =>
        `<option value="${p.id}" ${p.id === currentSelectedPortId ? 'selected' : ''}>${p.name}</option>`
      ).join('');
    }
    if (wavelengthSelect && wavelengthSelect.options.length === 0) {
      wavelengthSelect.innerHTML = `
        <option value="1310" ${currentSelectedWavelength === '1310' ? 'selected' : ''}>1310 nm (O-Band Single-Mode)</option>
        <option value="1490" ${currentSelectedWavelength === '1490' ? 'selected' : ''}>1490 nm (GPON Downstream)</option>
        <option value="1550" ${currentSelectedWavelength === '1550' ? 'selected' : ''}>1550 nm (C-Band Low-Loss)</option>
        <option value="1577" ${currentSelectedWavelength === '1577' ? 'selected' : ''}>1577 nm (XGS-PON 10G)</option>
      `;
    }
    if (pulseWidthSelect && pulseWidthSelect.options.length === 0) {
      pulseWidthSelect.innerHTML = `
        <option value="10" ${currentSelectedPulseWidthNs === 10 ? 'selected' : ''}>10 ns (Ultra High Resolution, 1m Event Dead Zone)</option>
        <option value="50" ${currentSelectedPulseWidthNs === 50 ? 'selected' : ''}>50 ns (Standard Access Network Resolution)</option>
        <option value="100" ${currentSelectedPulseWidthNs === 100 ? 'selected' : ''}>100 ns (Balanced Feeder Span Resolution)</option>
        <option value="500" ${currentSelectedPulseWidthNs === 500 ? 'selected' : ''}>500 ns (Extended Optical Dynamic Range)</option>
        <option value="1000" ${currentSelectedPulseWidthNs === 1000 ? 'selected' : ''}>1000 ns (Long-Haul Metro Ring Range)</option>
      `;
    }
    if (faultSelect && faultSelect.options.length === 0) {
      faultSelect.innerHTML = Object.entries(MICRO_OTDR_CONSTANTS.FAULT_PRESETS).map(([k, v]) =>
        `<option value="${k}" ${k === currentSelectedFaultPreset ? 'selected' : ''}>${v}</option>`
      ).join('');
    }
  }

  function refreshModalView() {
    const metrics = calculateMicroOtdrMetrics(state, {
      selectedPortId: currentSelectedPortId,
      wavelength: currentSelectedWavelength,
      pulseWidthNs: currentSelectedPulseWidthNs,
      faultPreset: currentSelectedFaultPreset,
      thresholdDbm: currentThresholdDbm
    });

    if (kpiPortName) {
      kpiPortName.textContent = metrics.selectedPort.name;
    }
    if (kpiFaultDistance) {
      if (metrics.faultDetected) {
        kpiFaultDistance.textContent = `${metrics.faultDistanceM} m`;
        kpiFaultDistance.style.color = metrics.linkStatus === 'Critical' ? '#ef4444' : '#f59e0b';
      } else {
        kpiFaultDistance.textContent = 'Intact (0 Break)';
        kpiFaultDistance.style.color = '#10b981';
      }
    }
    if (kpiReturnLoss) {
      kpiReturnLoss.textContent = `${metrics.opticalReturnLossDb} dB`;
    }
    if (statusBadge) {
      statusBadge.textContent = metrics.linkStatus.toUpperCase();
      statusBadge.className = `sim-delta-badge badge-${metrics.linkStatus === 'Critical' ? 'danger' : metrics.linkStatus === 'Warning' ? 'warning' : 'success'}`;
    }
    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(metrics.monthlyRevenueAtRiskPkr)} at risk (${metrics.affectedSubscribers} subs)`;
    }

    if (modalChartWrap) {
      modalChartWrap.innerHTML = renderMicroOtdrTraceSvg(metrics, { compact: false });
    }

    if (tableBody) {
      tableBody.innerHTML = metrics.events.map(ev => {
        const severityClass = ev.severity === 'Critical' ? 'badge-danger' : ev.severity === 'Warning' ? 'badge-warning' : 'badge-success';
        return `
          <tr>
            <td>#${ev.index}</td>
            <td><strong>${ev.distanceM} m</strong> (${ev.distanceKm} km)</td>
            <td>${ev.type}</td>
            <td>${ev.stepLossDb.toFixed(2)} dB</td>
            <td>${ev.reflectanceDb.toFixed(1)} dB</td>
            <td>${ev.cumulativeLossDb.toFixed(2)} dB</td>
            <td><span class="sim-delta-badge ${severityClass}">${ev.severity}</span></td>
            <td><small>${ev.notes}</small></td>
          </tr>
        `;
      }).join('');
    }

    // Also update card chart if present
    const cardChartEl = document.getElementById('dashboardMicroOtdrChart');
    if (cardChartEl) {
      cardChartEl.innerHTML = renderMicroOtdrTraceSvg(metrics, { compact: true });
    }
  }

  populateSelectOptions();

  if (portSelect) {
    portSelect.addEventListener('change', (e) => {
      setMicroOtdrPortId(e.target.value);
      if (wavelengthSelect) {
        wavelengthSelect.value = currentSelectedWavelength;
      }
      refreshModalView();
    });
  }

  if (wavelengthSelect) {
    wavelengthSelect.addEventListener('change', (e) => {
      setMicroOtdrWavelength(e.target.value);
      refreshModalView();
    });
  }

  if (pulseWidthSelect) {
    pulseWidthSelect.addEventListener('change', (e) => {
      setMicroOtdrPulseWidth(e.target.value);
      refreshModalView();
    });
  }

  if (faultSelect) {
    faultSelect.addEventListener('change', (e) => {
      setMicroOtdrFaultPreset(e.target.value);
      refreshModalView();
    });
  }

  if (threshSlider) {
    threshSlider.addEventListener('input', (e) => {
      setMicroOtdrThresholdDbm(e.target.value);
      if (threshValPill) {
        threshValPill.textContent = `${currentThresholdDbm.toFixed(1)} dBm`;
      }
      refreshModalView();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetMicroOtdrSimState();
      if (portSelect) portSelect.value = currentSelectedPortId;
      if (wavelengthSelect) wavelengthSelect.value = currentSelectedWavelength;
      if (pulseWidthSelect) pulseWidthSelect.value = String(currentSelectedPulseWidthNs);
      if (faultSelect) faultSelect.value = currentSelectedFaultPreset;
      if (threshSlider) threshSlider.value = String(currentThresholdDbm);
      if (threshValPill) threshValPill.textContent = `${currentThresholdDbm.toFixed(1)} dBm`;
      refreshModalView();
      if (typeof onToast === 'function') onToast('Micro-OTDR simulation reset to baseline.');
    });
  }

  if (filterAreaBtn) {
    filterAreaBtn.addEventListener('click', () => {
      const metrics = calculateMicroOtdrMetrics(state, { selectedPortId: currentSelectedPortId });
      if (metrics.selectedPort && typeof onFilterArea === 'function') {
        if (modal) {
          if (modal.close) modal.close();
          else modal.removeAttribute('open');
        }
        onFilterArea(metrics.selectedPort.primaryArea);
      }
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', async () => {
      const metrics = calculateMicroOtdrMetrics(state, {
        selectedPortId: currentSelectedPortId,
        wavelength: currentSelectedWavelength,
        pulseWidthNs: currentSelectedPulseWidthNs,
        faultPreset: currentSelectedFaultPreset,
        thresholdDbm: currentThresholdDbm
      });
      const report = generateMicroOtdrReport(metrics);
      let copied = false;
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(report);
          copied = true;
        } catch {
          copied = false;
        }
      }
      if (typeof onToast === 'function') {
        onToast(copied ? 'Micro-OTDR diagnostic briefing copied to clipboard!' : 'Report generated.');
      }
    });
  }

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      refreshModalView();
      if (modal.showModal) modal.showModal();
      else modal.setAttribute('open', '');
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    });
  }

  // Initial render if card chart is present
  const cardChartEl = document.getElementById('dashboardMicroOtdrChart');
  if (cardChartEl) {
    const metrics = calculateMicroOtdrMetrics(state, { referenceDate });
    cardChartEl.innerHTML = renderMicroOtdrTraceSvg(metrics, { compact: true });
  }
}
