/**
 * QA Certification Suite: Optical Network Unit (ONU) Digital Diagnostic Monitoring Interface (DDMI)
 * Standards: SFF-8472 Rev 12.4 & ITU-T G.984.2 GPON PMD Class B+/C+ Telemetry Compliance
 * Area: Shahdara ISP Subscriber Optical Demarcation & CPE Health Engineering
 */

export const DDMI_CERT_STORAGE_KEY = 'shahdara_ddmi_certs_v1';

export const DDMI_TRANSCEIVER_TYPES = {
  GPON_CLASS_B_PLUS: {
    id: 'GPON_CLASS_B_PLUS',
    name: 'ITU-T G.984.2 GPON Class B+ BiDi (1310/1490nm)',
    standard: 'ITU-T G.984.2',
    technology: 'GPON 2.488G / 1.244G',
    txWavelengthNm: 1310,
    rxWavelengthNm: 1490,
    nominalVoltageV: 3.30,
    voltageRange: { minAlarm: 3.00, minWarn: 3.13, maxWarn: 3.47, maxAlarm: 3.60 },
    tempRangeC: { minAlarm: -10, minWarn: 0, maxWarn: 65, maxAlarm: 75 },
    txBiasRangeMa: { minAlarm: 4.0, minWarn: 8.0, maxWarn: 35.0, maxAlarm: 45.0, nominal: 15.0, eol: 50.0 },
    txPowerRangeDbm: { minAlarm: -0.5, minWarn: 0.5, maxWarn: 5.0, maxAlarm: 6.0, nominal: 2.5 },
    rxPowerRangeDbm: { minAlarm: -28.0, minWarn: -25.0, maxWarn: -8.0, maxAlarm: -6.0, nominal: -18.0 }
  },
  GPON_CLASS_C_PLUS: {
    id: 'GPON_CLASS_C_PLUS',
    name: 'ITU-T G.984.2 GPON Class C+ High-Budget BiDi',
    technology: 'GPON Extended Reach 32dB',
    nominalVoltageV: 3.30,
    voltageRange: { minAlarm: 3.00, minWarn: 3.13, maxWarn: 3.47, maxAlarm: 3.60 },
    tempRangeC: { minAlarm: -10, minWarn: 0, maxWarn: 70, maxAlarm: 80 },
    txBiasRangeMa: { minAlarm: 5.0, minWarn: 10.0, maxWarn: 40.0, maxAlarm: 50.0, nominal: 18.0, eol: 55.0 },
    txPowerRangeDbm: { minAlarm: 2.0, minWarn: 3.0, maxWarn: 7.0, maxAlarm: 8.0, nominal: 4.5 },
    rxPowerRangeDbm: { minAlarm: -32.0, minWarn: -30.0, maxWarn: -12.0, maxAlarm: -9.0, nominal: -21.0 }
  },
  XGSPON_N1: {
    id: 'XGSPON_N1',
    name: 'ITU-T G.9807.1 XGS-PON Symmetrical 10G/10G',
    technology: '10G XGS-PON (1270/1577nm)',
    nominalVoltageV: 3.30,
    voltageRange: { minAlarm: 3.00, minWarn: 3.13, maxWarn: 3.47, maxAlarm: 3.60 },
    tempRangeC: { minAlarm: -10, minWarn: 0, maxWarn: 70, maxAlarm: 85 },
    txBiasRangeMa: { minAlarm: 8.0, minWarn: 15.0, maxWarn: 55.0, maxAlarm: 65.0, nominal: 25.0, eol: 75.0 },
    txPowerRangeDbm: { minAlarm: 1.0, minWarn: 2.0, maxWarn: 7.0, maxAlarm: 8.5, nominal: 4.0 },
    rxPowerRangeDbm: { minAlarm: -29.0, minWarn: -26.0, maxWarn: -9.0, maxAlarm: -7.0, nominal: -18.0 }
  },
  P2P_GIGABIT_BX10: {
    id: 'P2P_GIGABIT_BX10',
    name: 'IEEE 802.3ah 1000BASE-BX10 BiDi SFP (1310/1490nm)',
    technology: 'Dedicated Fiber Gigabit Ethernet',
    nominalVoltageV: 3.30,
    voltageRange: { minAlarm: 3.00, minWarn: 3.13, maxWarn: 3.47, maxAlarm: 3.60 },
    tempRangeC: { minAlarm: -20, minWarn: -5, maxWarn: 65, maxAlarm: 75 },
    txBiasRangeMa: { minAlarm: 3.0, minWarn: 6.0, maxWarn: 25.0, maxAlarm: 35.0, nominal: 12.0, eol: 40.0 },
    txPowerRangeDbm: { minAlarm: -10.0, minWarn: -9.0, maxWarn: -3.0, maxAlarm: -2.0, nominal: -6.0 },
    rxPowerRangeDbm: { minAlarm: -21.0, minWarn: -19.5, maxWarn: -3.0, maxAlarm: -1.0, nominal: -12.0 }
  },
  XGSPON_N1_N2: {
    id: 'XGSPON_N1_N2',
    name: 'ITU-T G.9807.1 XGS-PON Symmetrical 10G/10G',
    technology: '10G XGS-PON (1270/1577nm)',
    nominalVoltageV: 3.30,
    voltageRange: { minAlarm: 3.00, minWarn: 3.13, maxWarn: 3.47, maxAlarm: 3.60 },
    tempRangeC: { minAlarm: -10, minWarn: 0, maxWarn: 70, maxAlarm: 85 },
    txBiasRangeMa: { minAlarm: 8.0, minWarn: 15.0, maxWarn: 55.0, maxAlarm: 65.0, nominal: 25.0, eol: 75.0 },
    txPowerRangeDbm: { minAlarm: 1.0, minWarn: 2.0, maxWarn: 7.0, maxAlarm: 8.5, nominal: 4.0 },
    rxPowerRangeDbm: { minAlarm: -29.0, minWarn: -26.0, maxWarn: -9.0, maxAlarm: -7.0, nominal: -18.0 }
  },
  EPON_1000BASE_PX20: {
    id: 'EPON_1000BASE_PX20',
    name: 'IEEE 802.3ah EPON 1000BASE-PX20+ (1310/1490nm)',
    technology: '1G EPON Symmetrical',
    nominalVoltageV: 3.30,
    voltageRange: { minAlarm: 3.00, minWarn: 3.13, maxWarn: 3.47, maxAlarm: 3.60 },
    tempRangeC: { minAlarm: -20, minWarn: -5, maxWarn: 65, maxAlarm: 75 },
    txBiasRangeMa: { minAlarm: 3.0, minWarn: 6.0, maxWarn: 30.0, maxAlarm: 40.0, nominal: 14.0, eol: 45.0 },
    txPowerRangeDbm: { minAlarm: 1.0, minWarn: 2.0, maxWarn: 7.0, maxAlarm: 8.0, nominal: 3.5 },
    rxPowerRangeDbm: { minAlarm: -28.0, minWarn: -26.0, maxWarn: -3.0, maxAlarm: -1.0, nominal: -16.0 }
  },
  BIDI_SFP_GE: {
    id: 'BIDI_SFP_GE',
    name: 'BiDi 1.25G WDM SFP (1310/1550nm PtP)',
    technology: 'Dedicated Fiber Gigabit Ethernet',
    nominalVoltageV: 3.30,
    voltageRange: { minAlarm: 3.00, minWarn: 3.13, maxWarn: 3.47, maxAlarm: 3.60 },
    tempRangeC: { minAlarm: -20, minWarn: -5, maxWarn: 65, maxAlarm: 75 },
    txBiasRangeMa: { minAlarm: 3.0, minWarn: 6.0, maxWarn: 25.0, maxAlarm: 35.0, nominal: 12.0, eol: 40.0 },
    txPowerRangeDbm: { minAlarm: -10.0, minWarn: -9.0, maxWarn: -3.0, maxAlarm: -2.0, nominal: -6.0 },
    rxPowerRangeDbm: { minAlarm: -21.0, minWarn: -19.5, maxWarn: -3.0, maxAlarm: -1.0, nominal: -12.0 }
  }
};

export const DDMI_SEVERITY_LEVELS = {
  OPTIMAL: { id: 'OPTIMAL', label: 'OPTIMAL', color: '#10b981' },
  WARNING: { id: 'WARNING', label: 'WARNING', color: '#f59e0b' },
  ALARM: { id: 'ALARM', label: 'ALARM', color: '#ef4444' },
  CRITICAL: { id: 'CRITICAL', label: 'CRITICAL', color: '#dc2626' }
};

/**
 * Calculates laser diode remaining useful life (RUL) in months
 * based on Arrhenius thermal acceleration model and laser bias degradation.
 */
export function estimateLaserRulMonths(temperatureC = 25, txBiasCurrentMa = 15, spec = DDMI_TRANSCEIVER_TYPES.GPON_CLASS_B_PLUS) {
  const temp = Number(temperatureC) || 25;
  const bias = Number(txBiasCurrentMa) || 15;
  const baselineLifeMonths = 60;
  const nominalBias = spec?.txBiasRangeMa?.nominal ?? 15.0;
  const eolBias = spec?.txBiasRangeMa?.eol ?? 50.0;
  const biasDegradationRatio = Math.max(0, Math.min(1.0, (bias - nominalBias) / (eolBias - nominalBias)));
  let thermalDegradationFactor = 1.0;
  if (temp > 25) {
    thermalDegradationFactor = Math.max(0.02, 1.0 - (((temp - 25) / 50) * 0.7));
  }
  return Math.max(1, Math.round(baselineLifeMonths * (1.0 - (biasDegradationRatio * 0.8)) * thermalDegradationFactor));
}

export const DDMI_STATUS_VERDICTS = {
  CERTIFIED_HEALTHY: {
    id: 'CERTIFIED_HEALTHY',
    label: 'CERTIFIED HEALTHY (Optimal Telemetry)',
    urduLabel: 'مکمل تصدیق شدہ - معیاری کارکردگی',
    badgeClass: 'badge-success',
    colorHex: '#10b981',
    pass: true
  },
  ACCEPTABLE_MONITOR: {
    id: 'ACCEPTABLE_MONITOR',
    label: 'ACCEPTABLE (Marginal / Telemetry Warning)',
    urduLabel: 'قابل قبول - مسلسل نگرانی درکار',
    badgeClass: 'badge-warning',
    colorHex: '#f59e0b',
    pass: true
  },
  CRITICAL_HARDWARE_DEFECT: {
    id: 'CRITICAL_HARDWARE_DEFECT',
    label: 'CRITICAL ALARM (Hardware Replacement Required)',
    urduLabel: 'خطرناک خرابی - فوراً تبدیلی درکار',
    badgeClass: 'badge-danger',
    colorHex: '#ef4444',
    pass: false
  }
};

/**
 * Checks a scalar value against standard 4-threshold SFF-8472 DDMI window.
 */
export function checkThreshold(value, { minAlarm, minWarn, maxWarn, maxAlarm }) {
  const v = Number(value);
  if (v <= minAlarm) return 'ALARM_LOW';
  if (v <= minWarn) return 'WARN_LOW';
  if (v >= maxAlarm) return 'ALARM_HIGH';
  if (v >= maxWarn) return 'WARN_HIGH';
  return 'NORMAL';
}

/**
 * Calculates channel score (0-100%) based on deviation from nominal center.
 */
function scoreChannel(val, minWarn, maxWarn, minAlarm, maxAlarm) {
  const v = Number(val);
  if (v < minAlarm || v > maxAlarm) return 0;
  if (v >= minWarn && v <= maxWarn) return 100;
  if (v < minWarn) {
    const range = minWarn - minAlarm;
    return Math.max(10, Math.round(((v - minAlarm) / (range || 1)) * 90));
  }
  const range = maxAlarm - maxWarn;
  return Math.max(10, Math.round(((maxAlarm - v) / (range || 1)) * 90));
}

/**
 * Evaluates full DDMI 5-channel analog telemetry:
 * Temperature, DC Voltage, Laser Tx Bias, Tx Launch Power, and Rx Optical Power.
 */
export function evaluateDdmiTelemetry({
  temperatureC = 42.0,
  voltageV = 3.31,
  txBiasCurrentMa = 16.5,
  txPowerDbm = 2.4,
  rxPowerDbm = -18.2,
  transceiverTypeId = 'GPON_CLASS_B_PLUS'
} = {}) {
  const spec = DDMI_TRANSCEIVER_TYPES[transceiverTypeId] || DDMI_TRANSCEIVER_TYPES.GPON_CLASS_B_PLUS;

  const temp = Math.round(Number(temperatureC) * 10) / 10;
  const volt = Math.round(Number(voltageV) * 100) / 100;
  const bias = Math.round(Number(txBiasCurrentMa) * 10) / 10;
  const tx = Math.round(Number(txPowerDbm) * 10) / 10;
  const rx = Math.round(Number(rxPowerDbm) * 10) / 10;

  // Threshold evaluations
  const tempStatus = checkThreshold(temp, spec.tempRangeC);
  const voltStatus = checkThreshold(volt, spec.voltageRange);
  const biasStatus = checkThreshold(bias, spec.txBiasRangeMa);
  const txStatus = checkThreshold(tx, spec.txPowerRangeDbm);
  const rxStatus = checkThreshold(rx, spec.rxPowerRangeDbm);

  const statuses = [tempStatus, voltStatus, biasStatus, txStatus, rxStatus];
  const hasAlarm = statuses.some(s => s.startsWith('ALARM'));
  const hasWarn = statuses.some(s => s.startsWith('WARN'));

  // Channel Sub-Scores
  const tempScore = scoreChannel(temp, spec.tempRangeC.minWarn, spec.tempRangeC.maxWarn, spec.tempRangeC.minAlarm, spec.tempRangeC.maxAlarm);
  const voltScore = scoreChannel(volt, spec.voltageRange.minWarn, spec.voltageRange.maxWarn, spec.voltageRange.minAlarm, spec.voltageRange.maxAlarm);
  const biasScore = scoreChannel(bias, spec.txBiasRangeMa.minWarn, spec.txBiasRangeMa.maxWarn, spec.txBiasRangeMa.minAlarm, spec.txBiasRangeMa.maxAlarm);
  const txScore = scoreChannel(tx, spec.txPowerRangeDbm.minWarn, spec.txPowerRangeDbm.maxWarn, spec.txPowerRangeDbm.minAlarm, spec.txPowerRangeDbm.maxAlarm);
  const rxScore = scoreChannel(rx, spec.rxPowerRangeDbm.minWarn, spec.rxPowerRangeDbm.maxWarn, spec.rxPowerRangeDbm.minAlarm, spec.rxPowerRangeDbm.maxAlarm);

  // Weighted overall health index
  // Tx Bias and Rx Power have highest weighting in optical transponders
  const compositeScore = Math.round(
    (tempScore * 0.15) +
    (voltScore * 0.15) +
    (biasScore * 0.30) +
    (txScore * 0.15) +
    (rxScore * 0.25)
  );

  let verdict = DDMI_STATUS_VERDICTS.CERTIFIED_HEALTHY;
  if (hasAlarm || compositeScore < 60) {
    verdict = DDMI_STATUS_VERDICTS.CRITICAL_HARDWARE_DEFECT;
  } else if (hasWarn || compositeScore < 85) {
    verdict = DDMI_STATUS_VERDICTS.ACCEPTABLE_MONITOR;
  }

  const estimatedRulMonths = estimateLaserRulMonths(temp, bias, spec);

  // Diagnostic warnings and recommendations
  const warnings = [];
  const recommendations = [];

  if (tempStatus === 'ALARM_HIGH' || tempStatus === 'WARN_HIGH') {
    warnings.push(`High transceiver internal temperature (${temp}°C). Thermal dissipation constrained.`);
    recommendations.push('Inspect ONU mounting location; relocate away from direct heat or enclosed cabinets to ensure adequate air circulation.');
  }

  if (voltStatus.startsWith('ALARM') || voltStatus.startsWith('WARN')) {
    warnings.push(`DC supply voltage deviation (${volt}V, nominal ${spec.nominalVoltageV}V).`);
    recommendations.push('Replace 12V/1A AC-DC wall power adapter; verify household power stabilization via surge protector.');
  }

  if (biasStatus.startsWith('ALARM') || biasStatus.startsWith('WARN')) {
    warnings.push(`Elevated laser diode transmitter bias current (${bias} mA, nominal ${spec.txBiasRangeMa.nominal} mA).`);
    recommendations.push('Laser diode approaching end-of-life (EOL); schedule proactive ONU replacement to prevent abrupt disconnection.');
  }

  if (rxStatus === 'ALARM_LOW' || rxStatus === 'WARN_LOW') {
    warnings.push(`Optical receiver power is low (${rx} dBm, sensitivity limit ${spec.rxPowerRangeDbm.minAlarm} dBm).`);
    recommendations.push('Inspect incoming optical drop fiber; clean SC/APC connector ferrule and verify splitter attenuation.');
  } else if (rxStatus === 'ALARM_HIGH' || rxStatus === 'WARN_HIGH') {
    warnings.push(`Optical receiver saturation / overload (${rx} dBm, overload limit ${spec.rxPowerRangeDbm.maxWarn} dBm).`);
    recommendations.push('Install an in-line optical attenuator (3 dB or 5 dB) to prevent photodiode saturation damage.');
  }

  return {
    pass: verdict.pass,
    transceiverType: spec,
    temperatureC: temp,
    voltageV: volt,
    txBiasCurrentMa: bias,
    txPowerDbm: tx,
    rxPowerDbm: rx,
    thresholds: {
      temperature: tempStatus,
      voltage: voltStatus,
      txBias: biasStatus,
      txPower: txStatus,
      rxPower: rxStatus
    },
    scores: {
      temperature: tempScore,
      voltage: voltScore,
      txBias: biasScore,
      txPower: txScore,
      rxPower: rxScore,
      overall: compositeScore
    },
    estimatedRulMonths,
    verdict,
    warnings,
    recommendations
  };
}

/**
 * Builds a validated, sequential DDMI inspection certificate record.
 */
export function buildDdmiCertRecord({
  customerName = '',
  customerId = '',
  area = 'Shahdara Town',
  onuModel = 'Huawei EchoLife HG8546M',
  onuSerialNumber = 'HWTC-4829104A',
  temperatureC = 42.0,
  voltageV = 3.31,
  txBiasCurrentMa = 16.5,
  txPowerDbm = 2.4,
  rxPowerDbm = -18.2,
  transceiverTypeId = 'GPON_CLASS_B_PLUS',
  inspectedBy = 'Shahdara ISP Field QA Engineer',
  linemanNotes = ''
} = {}) {
  const evalResult = evaluateDdmiTelemetry({
    temperatureC,
    voltageV,
    txBiasCurrentMa,
    txPowerDbm,
    rxPowerDbm,
    transceiverTypeId
  });

  const now = new Date();
  const yearMonth = now.toISOString().slice(0, 7).replace('-', '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const certId = `DDMI-${yearMonth}-${randomSuffix}`;

  return {
    id: certId,
    timestamp: now.toISOString(),
    customerName: String(customerName || 'Shahdara Subscriber').trim(),
    customerId: String(customerId || '').trim(),
    area: String(area || 'Shahdara Town').trim(),
    onuModel: String(onuModel || 'Huawei EchoLife HG8546M').trim(),
    onuSerialNumber: String(onuSerialNumber || 'HWTC-4829104A').trim(),
    transceiverTypeId,
    transceiverName: evalResult.transceiverType.name,
    temperatureC: evalResult.temperatureC,
    voltageV: evalResult.voltageV,
    txBiasCurrentMa: evalResult.txBiasCurrentMa,
    txPowerDbm: evalResult.txPowerDbm,
    rxPowerDbm: evalResult.rxPowerDbm,
    healthScore: evalResult.scores.overall,
    estimatedRulMonths: evalResult.estimatedRulMonths,
    verdictId: evalResult.verdict.id,
    verdictLabel: evalResult.verdict.label,
    pass: evalResult.verdict.pass,
    inspectedBy: String(inspectedBy || 'Shahdara ISP Field QA Engineer').trim(),
    linemanNotes: String(linemanNotes || '').trim(),
    status: 'ACTIVE'
  };
}

/**
 * Reads saved DDMI certificate records from localStorage.
 */
export function getSavedDdmiCerts(storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return [];
  try {
    const raw = store.getItem(DDMI_CERT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Saves a new DDMI inspection record to localStorage.
 */
export function saveDdmiCert(certRecord, storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || !certRecord) return false;
  try {
    const current = getSavedDdmiCerts(store);
    const updated = [certRecord, ...current.filter(c => c.id !== certRecord.id)].slice(0, 50);
    store.setItem(DDMI_CERT_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Updates status or notes on an existing DDMI inspection record.
 */
export function updateDdmiCertStatus(certId, newStatus, resolutionNotes = '', storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || !certId) return false;
  try {
    const current = getSavedDdmiCerts(store);
    const idx = current.findIndex(c => c.id === certId);
    if (idx === -1) return false;
    current[idx].status = newStatus;
    if (resolutionNotes) {
      current[idx].resolutionNotes = String(resolutionNotes).trim();
    }
    store.setItem(DDMI_CERT_STORAGE_KEY, JSON.stringify(current));
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Clears the persistent DDMI certificate store.
 */
export function clearDdmiCerts(storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  try {
    store.removeItem(DDMI_CERT_STORAGE_KEY);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Computes summary KPI metrics across saved DDMI inspection records.
 */
export function calculateDdmiCertMetrics(certs = []) {
  const list = Array.isArray(certs) ? certs : [];
  const total = list.length;
  if (total === 0) {
    return {
      totalInspections: 0,
      certifiedCount: 0,
      marginalCount: 0,
      criticalCount: 0,
      passRatePercent: 0,
      averageHealthScore: 0,
      averageTxBiasMa: 0,
      laserEolWarnings: 0
    };
  }

  let certified = 0;
  let marginal = 0;
  let critical = 0;
  let scoreSum = 0;
  let biasSum = 0;
  let eolWarnings = 0;

  list.forEach(c => {
    scoreSum += Number(c.healthScore) || 0;
    biasSum += Number(c.txBiasCurrentMa) || 0;
    if (c.verdictId === 'CERTIFIED_HEALTHY') certified++;
    else if (c.verdictId === 'ACCEPTABLE_MONITOR') marginal++;
    else critical++;

    if (Number(c.txBiasCurrentMa) >= 35 || Number(c.estimatedRulMonths) <= 12) {
      eolWarnings++;
    }
  });

  return {
    totalInspections: total,
    certifiedCount: certified,
    marginalCount: marginal,
    criticalCount: critical,
    passRatePercent: Math.round(((certified + marginal) / total) * 100),
    averageHealthScore: Math.round(scoreSum / total),
    averageTxBiasMa: Math.round((biasSum / total) * 10) / 10,
    laserEolWarnings: eolWarnings
  };
}

/**
 * Formats a bilingual WhatsApp dispatch message for NOC and customer records.
 */
export function formatDdmiCertWhatsApp(certRecord) {
  const cert = certRecord || {};
  const evalResult = evaluateDdmiTelemetry({
    temperatureC: cert.temperatureC,
    voltageV: cert.voltageV,
    txBiasCurrentMa: cert.txBiasCurrentMa,
    txPowerDbm: cert.txPowerDbm,
    rxPowerDbm: cert.rxPowerDbm,
    transceiverTypeId: cert.transceiverTypeId
  });

  const dateStr = cert.timestamp ? new Date(cert.timestamp).toISOString().replace('T', ' ').slice(0, 19) + ' PKT' : 'N/A';

  return [
    `🔬 *SHAHDARA ISP - ONU OPTICAL TELEMETRY & DDMI CERTIFICATE* 🔬`,
    `📋 آپٹیکل ٹرانسیور تشخیصی رپورٹ (SFF-8472 Compliance)`,
    `📜 Cert ID: ${cert.id || 'DDMI-PENDING'}`,
    `📅 Date/Time: ${dateStr}`,
    `👤 Customer: ${cert.customerName || 'Shahdara Subscriber'} (${cert.area || 'Shahdara Town'})`,
    `📟 Equipment: ${cert.onuModel || 'GPON ONT'} (S/N: ${cert.onuSerialNumber || 'N/A'})`,
    `📡 Transceiver: ${cert.transceiverName || 'GPON Class B+'}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📊 *SFF-8472 CALIBRATED TELEMETRY*`,
    `• Internal Temperature: ${cert.temperatureC}°C [${evalResult.thresholds.temperature}]`,
    `• DC Supply Voltage: ${cert.voltageV} V [${evalResult.thresholds.voltage}]`,
    `• Laser Diode Tx Bias: ${cert.txBiasCurrentMa} mA [${evalResult.thresholds.txBias}]`,
    `• Tx Optical Launch Power: ${cert.txPowerDbm} dBm [${evalResult.thresholds.txPower}]`,
    `• Rx Optical Received Power: ${cert.rxPowerDbm} dBm [${evalResult.thresholds.rxPower}]`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🩺 *HARDWARE HEALTH & LASER LIFESPAN*`,
    `• Overall Health Score: ${cert.healthScore || evalResult.scores.overall}% / 100%`,
    `• Laser Expected Life: ~${cert.estimatedRulMonths || evalResult.estimatedRulMonths} Months`,
    `• Quality Verdict: ${evalResult.verdict.label}`,
    `• اردو نتیجہ: ${evalResult.verdict.urduLabel}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👨‍🔧 Inspected By: ${cert.inspectedBy || 'Shahdara ISP Field QA Engineer'}`,
    `📝 Notes: ${cert.linemanNotes || 'Telemetry calibrated within carrier thresholds.'}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Shahdara Fiber Network - Quality Assurance & Telemetry Lab`
  ].join('\n');
}

/**
 * Generates printable HTML documents:
 * Formal A4 Optical Laboratory Accreditation Certificate and 80mm POS Thermal Field Slip.
 */
export function generateDdmiCertHtml(certRecord, format = 'standard') {
  const cert = certRecord || {};
  const evalResult = evaluateDdmiTelemetry({
    temperatureC: cert.temperatureC,
    voltageV: cert.voltageV,
    txBiasCurrentMa: cert.txBiasCurrentMa,
    txPowerDbm: cert.txPowerDbm,
    rxPowerDbm: cert.rxPowerDbm,
    transceiverTypeId: cert.transceiverTypeId
  });

  const dateStr = cert.timestamp ? new Date(cert.timestamp).toISOString().replace('T', ' ').slice(0, 19) : new Date().toISOString().slice(0, 19);

  if (format === 'thermal') {
    return `
      <div class="ddmi-thermal-slip" style="width: 280px; font-family: monospace; font-size: 11px; line-height: 1.4; color: #000; padding: 10px; background: #fff;">
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
          <h3 style="margin: 0; font-size: 14px;">SHAHDARA ISP NETWORK</h3>
          <p style="margin: 2px 0;">ONU DDMI TELEMETRY SLIP</p>
          <p style="margin: 2px 0; font-size: 9px;">${dateStr} PKT</p>
        </div>
        <div style="margin-bottom: 6px;">
          <div><strong>CERT:</strong> ${cert.id}</div>
          <div><strong>CLIENT:</strong> ${cert.customerName}</div>
          <div><strong>AREA:</strong> ${cert.area}</div>
          <div><strong>ONU:</strong> ${cert.onuModel}</div>
          <div><strong>S/N:</strong> ${cert.onuSerialNumber}</div>
        </div>
        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between;"><span>TEMP:</span><span>${cert.temperatureC}°C</span></div>
          <div style="display: flex; justify-content: space-between;"><span>VOLT:</span><span>${cert.voltageV} V</span></div>
          <div style="display: flex; justify-content: space-between;"><span>TX BIAS:</span><span>${cert.txBiasCurrentMa} mA</span></div>
          <div style="display: flex; justify-content: space-between;"><span>TX PWR:</span><span>${cert.txPowerDbm} dBm</span></div>
          <div style="display: flex; justify-content: space-between;"><span>RX PWR:</span><span>${cert.rxPowerDbm} dBm</span></div>
        </div>
        <div style="text-align: center; margin-bottom: 6px;">
          <div style="font-size: 13px; font-weight: bold;">HEALTH: ${cert.healthScore}%</div>
          <div style="font-size: 11px;">RUL: ~${cert.estimatedRulMonths} MONTHS</div>
          <div style="margin-top: 4px; font-weight: bold;">[${cert.pass ? 'CERTIFIED PASS' : 'CRITICAL DEFECT'}]</div>
        </div>
        <div style="font-size: 9px; text-align: center; border-top: 1px dashed #000; padding-top: 4px;">
          Audited by: ${cert.inspectedBy}
        </div>
      </div>
    `;
  }

  // Formal A4 Certificate
  return `
    <div class="ddmi-a4-certificate" style="max-width: 800px; margin: 0 auto; padding: 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; color: #1e293b; border: 2px solid #cbd5e1; border-radius: 8px;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 20px;">
        <div>
          <h1 style="margin: 0; font-size: 22px; color: #0f172a; letter-spacing: -0.5px;">SHAHDARA FIBER BROADBAND SERVICES</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #64748b; font-weight: 600;">CPE HARDWARE QUALITY ASSURANCE &amp; SFF-8472 DDMI CALIBRATION</p>
        </div>
        <div style="text-align: right;">
          <span style="display: inline-block; padding: 6px 12px; background: #f0fdf4; border: 1px solid #86efac; color: #166534; font-weight: 800; font-size: 13px; border-radius: 6px;">
            ${evalResult.verdict.label}
          </span>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px; font-family: monospace;">CERT: ${cert.id}</div>
        </div>
      </div>

      <!-- Subscriber & Device Meta -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; padding: 16px; border-radius: 6px; margin-bottom: 20px; font-size: 13px;">
        <div>
          <div style="margin-bottom: 4px;"><strong>Customer Name:</strong> ${cert.customerName}</div>
          <div style="margin-bottom: 4px;"><strong>Customer ID:</strong> ${cert.customerId || 'N/A'}</div>
          <div><strong>Area:</strong> ${cert.area}</div>
        </div>
        <div>
          <div style="margin-bottom: 4px;"><strong>ONU Model:</strong> ${cert.onuModel}</div>
          <div style="margin-bottom: 4px;"><strong>Serial Number:</strong> <span style="font-family: monospace;">${cert.onuSerialNumber}</span></div>
          <div><strong>Transceiver Standard:</strong> ${cert.transceiverName}</div>
        </div>
      </div>

      <!-- Telemetry Matrix Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; text-align: left;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
            <th style="padding: 8px 12px;">Diagnostic Telemetry Channel</th>
            <th style="padding: 8px 12px;">Measured Value</th>
            <th style="padding: 8px 12px;">Nominal Standard</th>
            <th style="padding: 8px 12px;">Tolerance Window</th>
            <th style="padding: 8px 12px;">Verdict</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px;"><strong>Transceiver Temperature</strong></td>
            <td style="padding: 8px 12px; font-weight: bold; font-family: monospace;">${cert.temperatureC} °C</td>
            <td style="padding: 8px 12px;">25.0 °C to 45.0 °C</td>
            <td style="padding: 8px 12px;">${evalResult.transceiverType.tempRangeC.minWarn}°C to ${evalResult.transceiverType.tempRangeC.maxWarn}°C</td>
            <td style="padding: 8px 12px;"><span style="color: ${evalResult.thresholds.temperature === 'NORMAL' ? '#16a34a' : '#dc2626'}; font-weight: bold;">${evalResult.thresholds.temperature}</span></td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px;"><strong>Internal DC Supply Voltage</strong></td>
            <td style="padding: 8px 12px; font-weight: bold; font-family: monospace;">${cert.voltageV} V</td>
            <td style="padding: 8px 12px;">3.30 V</td>
            <td style="padding: 8px 12px;">${evalResult.transceiverType.voltageRange.minWarn}V to ${evalResult.transceiverType.voltageRange.maxWarn}V</td>
            <td style="padding: 8px 12px;"><span style="color: ${evalResult.thresholds.voltage === 'NORMAL' ? '#16a34a' : '#dc2626'}; font-weight: bold;">${evalResult.thresholds.voltage}</span></td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px;"><strong>Laser Diode Tx Bias Current</strong></td>
            <td style="padding: 8px 12px; font-weight: bold; font-family: monospace;">${cert.txBiasCurrentMa} mA</td>
            <td style="padding: 8px 12px;">${evalResult.transceiverType.txBiasRangeMa.nominal} mA</td>
            <td style="padding: 8px 12px;">&lt; ${evalResult.transceiverType.txBiasRangeMa.maxWarn} mA</td>
            <td style="padding: 8px 12px;"><span style="color: ${evalResult.thresholds.txBias === 'NORMAL' ? '#16a34a' : '#dc2626'}; font-weight: bold;">${evalResult.thresholds.txBias}</span></td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px;"><strong>Transmitter Optical Launch Power</strong></td>
            <td style="padding: 8px 12px; font-weight: bold; font-family: monospace;">${cert.txPowerDbm} dBm</td>
            <td style="padding: 8px 12px;">${evalResult.transceiverType.txPowerRangeDbm.nominal} dBm</td>
            <td style="padding: 8px 12px;">${evalResult.transceiverType.txPowerRangeDbm.minWarn} to ${evalResult.transceiverType.txPowerRangeDbm.maxWarn} dBm</td>
            <td style="padding: 8px 12px;"><span style="color: ${evalResult.thresholds.txPower === 'NORMAL' ? '#16a34a' : '#dc2626'}; font-weight: bold;">${evalResult.thresholds.txPower}</span></td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px;"><strong>Receiver Optical Input Power</strong></td>
            <td style="padding: 8px 12px; font-weight: bold; font-family: monospace;">${cert.rxPowerDbm} dBm</td>
            <td style="padding: 8px 12px;">${evalResult.transceiverType.rxPowerRangeDbm.nominal} dBm</td>
            <td style="padding: 8px 12px;">${evalResult.transceiverType.rxPowerRangeDbm.minWarn} to ${evalResult.transceiverType.rxPowerRangeDbm.maxWarn} dBm</td>
            <td style="padding: 8px 12px;"><span style="color: ${evalResult.thresholds.rxPower === 'NORMAL' ? '#16a34a' : '#dc2626'}; font-weight: bold;">${evalResult.thresholds.rxPower}</span></td>
          </tr>
        </tbody>
      </table>

      <!-- Health & RUL Summary Cards -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; text-align: center;">
          <div style="font-size: 11px; color: #64748b; font-weight: 700;">OVERALL HEALTH INDEX</div>
          <div style="font-size: 24px; font-weight: 800; color: #0284c7; margin-top: 4px;">${cert.healthScore}%</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; text-align: center;">
          <div style="font-size: 11px; color: #64748b; font-weight: 700;">ESTIMATED REMAINING LIFE</div>
          <div style="font-size: 24px; font-weight: 800; color: #16a34a; margin-top: 4px;">~${cert.estimatedRulMonths} Mos</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; text-align: center;">
          <div style="font-size: 11px; color: #64748b; font-weight: 700;">AUDIT COMPLIANCE</div>
          <div style="font-size: 18px; font-weight: 800; color: ${cert.pass ? '#16a34a' : '#dc2626'}; margin-top: 8px;">
            ${cert.pass ? 'PASS ✓' : 'REJECT ✗'}
          </div>
        </div>
      </div>

      <!-- Recommendations / Notes -->
      <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 6px; font-size: 12px; margin-bottom: 20px;">
        <strong>Field Technician Notes &amp; Actions:</strong> ${cert.linemanNotes || 'All analog telemetry parameters verified within Telcordia and SFF-8472 carrier operating standards.'}
      </div>

      <!-- Sign-off Footer -->
      <div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #64748b;">
        <div>
          Certified By: <strong>${cert.inspectedBy}</strong><br>
          Inspection Timestamp: ${dateStr} PKT
        </div>
        <div style="text-align: right;">
          Shahdara ISP Network Operations Center<br>
          Accreditation ID: SHA-QA-DDMI-2026
        </div>
      </div>
    </div>
  `;
}

/**
 * Generates an RFC-4180 compliant CSV export with UTF-8 BOM.
 */
export function generateDdmiCertsCsv(certs = []) {
  const list = Array.isArray(certs) ? certs : [];
  const headers = [
    'Certificate ID',
    'Date / Time (ISO)',
    'Customer Name',
    'Customer ID',
    'Area',
    'ONU Model',
    'Serial Number',
    'Transceiver Standard',
    'Temperature (C)',
    'Voltage (V)',
    'Tx Bias (mA)',
    'Tx Power (dBm)',
    'Rx Power (dBm)',
    'Health Score (%)',
    'Estimated RUL (Months)',
    'Verdict',
    'Pass / Fail',
    'Inspected By',
    'Notes'
  ];

  function escapeCsv(str) {
    const s = String(str ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  const rows = list.map(c => [
    escapeCsv(c.id),
    escapeCsv(c.timestamp),
    escapeCsv(c.customerName),
    escapeCsv(c.customerId),
    escapeCsv(c.area),
    escapeCsv(c.onuModel),
    escapeCsv(c.onuSerialNumber),
    escapeCsv(c.transceiverName),
    c.temperatureC,
    c.voltageV,
    c.txBiasCurrentMa,
    c.txPowerDbm,
    c.rxPowerDbm,
    c.healthScore,
    c.estimatedRulMonths,
    escapeCsv(c.verdictLabel),
    c.pass ? 'PASS' : 'FAIL',
    escapeCsv(c.inspectedBy),
    escapeCsv(c.linemanNotes)
  ].join(','));

  const BOM = '\uFEFF';
  return BOM + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Renders an accessible, pure vector SVG telemetry dashboard with 5 analog gauges
 * and real-time health readout.
 */
export function renderDdmiTelemetrySvg(certRecord) {
  const cert = certRecord || {};
  const evalResult = evaluateDdmiTelemetry({
    temperatureC: cert.temperatureC,
    voltageV: cert.voltageV,
    txBiasCurrentMa: cert.txBiasCurrentMa,
    txPowerDbm: cert.txPowerDbm,
    rxPowerDbm: cert.rxPowerDbm,
    transceiverTypeId: cert.transceiverTypeId
  });

  const width = 640;
  const height = 240;

  // Helper to calculate gauge needle angle
  function getGaugeNeedle(val, minVal, maxVal, cx, cy, radius = 28) {
    const clamped = Math.max(minVal, Math.min(maxVal, Number(val)));
    const ratio = (clamped - minVal) / (maxVal - minVal);
    const angleDeg = -135 + (ratio * 270);
    const rad = (angleDeg * Math.PI) / 180;
    const nx = cx + radius * Math.cos(rad);
    const ny = cy + radius * Math.sin(rad);
    return { nx, ny, ratio, angleDeg };
  }

  const tempNeedle = getGaugeNeedle(evalResult.temperatureC, 0, 80, 70, 75);
  const voltNeedle = getGaugeNeedle(evalResult.voltageV, 2.9, 3.7, 195, 75);
  const biasNeedle = getGaugeNeedle(evalResult.txBiasCurrentMa, 0, 50, 320, 75);
  const txNeedle = getGaugeNeedle(evalResult.txPowerDbm, -2, 8, 445, 75);
  const rxNeedle = getGaugeNeedle(evalResult.rxPowerDbm, -32, -6, 570, 75);

  const healthColor = evalResult.verdict.colorHex;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="ddmi-telemetry-svg" role="img" aria-label="ONU SFF-8472 DDMI Telemetry Dashboard">
      <defs>
        <linearGradient id="ddmiBgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#080d1a"/>
        </linearGradient>
      </defs>

      <!-- Main Frame -->
      <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="url(#ddmiBgGrad)" stroke="#334155" stroke-width="1.5"/>

      <!-- Title & Equipment Tag -->
      <text x="20" y="24" fill="#94a3b8" font-size="10" font-weight="700" letter-spacing="0.5">SFF-8472 DDMI ANALOG TELEMETRY DASHBOARD</text>
      <text x="620" y="24" fill="#38bdf8" font-size="10" font-weight="600" text-anchor="end">${evalResult.transceiverType.technology}</text>

      <!-- GAUGE 1: TEMPERATURE -->
      <g transform="translate(0, 0)">
        <circle cx="70" cy="75" r="38" fill="#141e2e" stroke="#1e293b" stroke-width="1.2"/>
        <path d="M 45 95 A 32 32 0 1 1 95 95" fill="none" stroke="#334155" stroke-width="5" stroke-linecap="round"/>
        <line x1="70" y1="75" x2="${tempNeedle.nx}" y2="${tempNeedle.ny}" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="70" cy="75" r="4" fill="#f8fafc"/>
        <text x="70" y="125" fill="#f8fafc" font-size="12" font-weight="800" font-family="monospace" text-anchor="middle">${evalResult.temperatureC}°C</text>
        <text x="70" y="138" fill="#64748b" font-size="9" font-weight="600" text-anchor="middle">TEMP</text>
      </g>

      <!-- GAUGE 2: VOLTAGE -->
      <g transform="translate(0, 0)">
        <circle cx="195" cy="75" r="38" fill="#141e2e" stroke="#1e293b" stroke-width="1.2"/>
        <path d="M 170 95 A 32 32 0 1 1 220 95" fill="none" stroke="#334155" stroke-width="5" stroke-linecap="round"/>
        <line x1="195" y1="75" x2="${voltNeedle.nx}" y2="${voltNeedle.ny}" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="195" cy="75" r="4" fill="#f8fafc"/>
        <text x="195" y="125" fill="#f8fafc" font-size="12" font-weight="800" font-family="monospace" text-anchor="middle">${evalResult.voltageV} V</text>
        <text x="195" y="138" fill="#64748b" font-size="9" font-weight="600" text-anchor="middle">VOLTAGE</text>
      </g>

      <!-- GAUGE 3: TX BIAS -->
      <g transform="translate(0, 0)">
        <circle cx="320" cy="75" r="38" fill="#141e2e" stroke="#1e293b" stroke-width="1.2"/>
        <path d="M 295 95 A 32 32 0 1 1 345 95" fill="none" stroke="#334155" stroke-width="5" stroke-linecap="round"/>
        <line x1="320" y1="75" x2="${biasNeedle.nx}" y2="${biasNeedle.ny}" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="320" cy="75" r="4" fill="#f8fafc"/>
        <text x="320" y="125" fill="#f59e0b" font-size="12" font-weight="800" font-family="monospace" text-anchor="middle">${evalResult.txBiasCurrentMa} mA</text>
        <text x="320" y="138" fill="#64748b" font-size="9" font-weight="600" text-anchor="middle">TX BIAS</text>
      </g>

      <!-- GAUGE 4: TX POWER -->
      <g transform="translate(0, 0)">
        <circle cx="445" cy="75" r="38" fill="#141e2e" stroke="#1e293b" stroke-width="1.2"/>
        <path d="M 420 95 A 32 32 0 1 1 470 95" fill="none" stroke="#334155" stroke-width="5" stroke-linecap="round"/>
        <line x1="445" y1="75" x2="${txNeedle.nx}" y2="${txNeedle.ny}" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="445" cy="75" r="4" fill="#f8fafc"/>
        <text x="445" y="125" fill="#10b981" font-size="12" font-weight="800" font-family="monospace" text-anchor="middle">${evalResult.txPowerDbm} dBm</text>
        <text x="445" y="138" fill="#64748b" font-size="9" font-weight="600" text-anchor="middle">TX POWER</text>
      </g>

      <!-- GAUGE 5: RX POWER -->
      <g transform="translate(0, 0)">
        <circle cx="570" cy="75" r="38" fill="#141e2e" stroke="#1e293b" stroke-width="1.2"/>
        <path d="M 545 95 A 32 32 0 1 1 595 95" fill="none" stroke="#334155" stroke-width="5" stroke-linecap="round"/>
        <line x1="570" y1="75" x2="${rxNeedle.nx}" y2="${rxNeedle.ny}" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="570" cy="75" r="4" fill="#f8fafc"/>
        <text x="570" y="125" fill="#10b981" font-size="12" font-weight="800" font-family="monospace" text-anchor="middle">${evalResult.rxPowerDbm} dBm</text>
        <text x="570" y="138" fill="#64748b" font-size="9" font-weight="600" text-anchor="middle">RX POWER</text>
      </g>

      <!-- BOTTOM BANNER: HEALTH SCORE & RUL LIFESPAN -->
      <g transform="translate(20, 160)">
        <rect x="0" y="0" width="600" height="65" rx="6" fill="#141e2e" stroke="#1e293b" stroke-width="1.2"/>
        
        <!-- Score Box -->
        <rect x="15" y="12" width="130" height="40" rx="4" fill="#0b0f19" stroke="#334155" stroke-width="1"/>
        <text x="25" y="27" fill="#94a3b8" font-size="9" font-weight="700">HEALTH INDEX</text>
        <text x="25" y="46" fill="${healthColor}" font-size="18" font-weight="800" font-family="monospace">${evalResult.scores.overall}%</text>

        <!-- Laser RUL Box -->
        <rect x="160" y="12" width="140" height="40" rx="4" fill="#0b0f19" stroke="#334155" stroke-width="1"/>
        <text x="170" y="27" fill="#94a3b8" font-size="9" font-weight="700">EXPECTED LIFE</text>
        <text x="170" y="46" fill="#38bdf8" font-size="16" font-weight="800" font-family="monospace">~${evalResult.estimatedRulMonths} Mos</text>

        <!-- Quality Verdict Badge -->
        <rect x="315" y="18" width="270" height="28" rx="4" fill="${healthColor}"/>
        <text x="450" y="36" fill="#ffffff" font-size="11" font-weight="800" text-anchor="middle">${evalResult.verdict.label}</text>
      </g>
    </svg>
  `;
}

/**
 * Initializes and wires the DDMI Optical Transceiver Inspection Modal Dialog.
 */
export function setupDdmiCertModal(options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

  if (!doc) {
    return {
      open: () => {},
      close: () => {},
      getCurrentReading: () => ({}),
      setReading: () => {}
    };
  }

  const modal = doc.getElementById('ddmiCertModal');
  const closeBtn = doc.getElementById('ddmiCertModalCloseBtn');
  const openButtons = doc.querySelectorAll('[data-open-ddmi-cert]');

  // Inputs
  const customerInput = doc.getElementById('ddmiCustomerNameInput');
  const areaSelect = doc.getElementById('ddmiAreaSelect');
  const onuModelInput = doc.getElementById('ddmiOnuModelInput');
  const onuSerialInput = doc.getElementById('ddmiOnuSerialInput');
  const transTypeSelect = doc.getElementById('ddmiTransceiverTypeSelect');
  const tempSlider = doc.getElementById('ddmiTempSlider');
  const tempVal = doc.getElementById('ddmiTempVal');
  const voltSlider = doc.getElementById('ddmiVoltSlider');
  const voltVal = doc.getElementById('ddmiVoltVal');
  const biasSlider = doc.getElementById('ddmiBiasSlider');
  const biasVal = doc.getElementById('ddmiBiasVal');
  const txSlider = doc.getElementById('ddmiTxSlider');
  const txVal = doc.getElementById('ddmiTxVal');
  const rxSlider = doc.getElementById('ddmiRxSlider');
  const rxVal = doc.getElementById('ddmiRxVal');
  const notesInput = doc.getElementById('ddmiNotesInput');

  // Outputs & Display
  const svgContainer = doc.getElementById('ddmiSvgContainer');
  const healthDisplay = doc.getElementById('ddmiHealthDisplay');
  const verdictBadge = doc.getElementById('ddmiVerdictBadge');
  const warningsContainer = doc.getElementById('ddmiWarningsContainer');
  const historyTableBody = doc.getElementById('ddmiHistoryTableBody');

  // Action Buttons
  const recordCertBtn = doc.getElementById('ddmiRecordCertBtn');
  const copyReportBtn = doc.getElementById('ddmiCopyReportBtn');
  const printA4Btn = doc.getElementById('ddmiPrintA4Btn');
  const printThermalBtn = doc.getElementById('ddmiPrintThermalBtn');
  const exportCsvBtn = doc.getElementById('ddmiExportCsvBtn');
  const clearHistoryBtn = doc.getElementById('ddmiClearHistoryBtn');

  // State
  const currentReading = {
    customerName: 'Muhammad Aslam',
    customerId: 'CUST-001',
    area: 'Shahdara Town',
    onuModel: 'Huawei EchoLife HG8546M',
    onuSerialNumber: 'HWTC-4829104A',
    transceiverTypeId: 'GPON_CLASS_B_PLUS',
    temperatureC: 42.0,
    voltageV: 3.31,
    txBiasCurrentMa: 16.5,
    txPowerDbm: 2.4,
    rxPowerDbm: -18.2,
    inspectedBy: 'Shahdara ISP Field QA Engineer',
    linemanNotes: ''
  };

  function renderView() {
    const evalResult = evaluateDdmiTelemetry({
      temperatureC: currentReading.temperatureC,
      voltageV: currentReading.voltageV,
      txBiasCurrentMa: currentReading.txBiasCurrentMa,
      txPowerDbm: currentReading.txPowerDbm,
      rxPowerDbm: currentReading.rxPowerDbm,
      transceiverTypeId: currentReading.transceiverTypeId
    });

    currentReading.healthScore = evalResult.scores.overall;
    currentReading.estimatedRulMonths = evalResult.estimatedRulMonths;
    currentReading.verdict = evalResult.verdict;

    // SVG
    if (svgContainer) {
      svgContainer.innerHTML = renderDdmiTelemetrySvg(currentReading);
    }

    // Display
    if (healthDisplay) {
      healthDisplay.textContent = `${evalResult.scores.overall}% Health`;
    }

    if (verdictBadge) {
      verdictBadge.className = `badge ${evalResult.verdict.badgeClass}`;
      verdictBadge.textContent = evalResult.verdict.label;
    }

    // Warnings
    if (warningsContainer) {
      if (evalResult.warnings.length === 0) {
        warningsContainer.innerHTML = `
          <div class="alert alert-success" style="font-size: 12px; padding: 6px 10px; margin: 0;">
            ✓ SFF-8472 DDMI Telemetry nominal. Laser diode operating under optimal thermal and electrical parameters.
          </div>
        `;
      } else {
        warningsContainer.innerHTML = evalResult.warnings.map(w => `
          <div class="alert alert-warning" style="font-size: 12px; padding: 6px 10px; margin-bottom: 4px;">
            ⚠ ${w}
          </div>
        `).join('');
      }
    }

    // History Table
    if (historyTableBody) {
      const records = getSavedDdmiCerts(storage);
      if (records.length === 0) {
        historyTableBody.innerHTML = `
          <tr><td colspan="6" style="text-align: center; color: var(--muted, #94a3b8); padding: 12px;">No DDMI certifications logged yet.</td></tr>
        `;
      } else {
        historyTableBody.innerHTML = records.slice(0, 8).map(r => `
          <tr style="border-bottom: 1px solid var(--border, #334155); font-size: 12px;">
            <td style="padding: 6px 8px; font-family: monospace;">${r.id}</td>
            <td style="padding: 6px 8px;">${r.customerName}</td>
            <td style="padding: 6px 8px; font-family: monospace;">${r.temperatureC}°C / ${r.voltageV}V</td>
            <td style="padding: 6px 8px; font-family: monospace;">${r.txBiasCurrentMa}mA / ${r.rxPowerDbm}dBm</td>
            <td style="padding: 6px 8px; font-weight: bold; color: #38bdf8;">${r.healthScore}%</td>
            <td style="padding: 6px 8px;"><span class="badge ${r.pass ? 'badge-success' : 'badge-danger'}">${r.pass ? 'PASS' : 'FAIL'}</span></td>
          </tr>
        `).join('');
      }
    }
  }

  function openModal() {
    if (!modal) return;
    renderView();
    if (typeof modal.showModal === 'function') {
      try {
        modal.showModal();
      } catch (_) {
        modal.setAttribute('open', 'true');
      }
    } else {
      modal.setAttribute('open', 'true');
    }
  }

  function closeModal() {
    if (!modal) return;
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  }

  // Bind Triggers
  openButtons.forEach(btn => {
    btn.onclick = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      openModal();
    };
  });

  if (closeBtn) {
    closeBtn.onclick = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      closeModal();
    };
  }

  // Inputs
  if (customerInput) {
    customerInput.oninput = (e) => { currentReading.customerName = e.target.value; };
  }

  if (areaSelect) {
    areaSelect.onchange = (e) => { currentReading.area = e.target.value; };
  }

  if (onuModelInput) {
    onuModelInput.oninput = (e) => { currentReading.onuModel = e.target.value; };
  }

  if (onuSerialInput) {
    onuSerialInput.oninput = (e) => { currentReading.onuSerialNumber = e.target.value; };
  }

  if (transTypeSelect) {
    transTypeSelect.onchange = (e) => {
      currentReading.transceiverTypeId = e.target.value;
      renderView();
    };
  }

  if (tempSlider) {
    tempSlider.oninput = (e) => {
      const v = Number(e.target.value) || 42.0;
      currentReading.temperatureC = v;
      if (tempVal) tempVal.textContent = `${v.toFixed(1)}°C`;
      renderView();
    };
  }

  if (voltSlider) {
    voltSlider.oninput = (e) => {
      const v = Number(e.target.value) || 3.30;
      currentReading.voltageV = v;
      if (voltVal) voltVal.textContent = `${v.toFixed(2)}V`;
      renderView();
    };
  }

  if (biasSlider) {
    biasSlider.oninput = (e) => {
      const v = Number(e.target.value) || 16.5;
      currentReading.txBiasCurrentMa = v;
      if (biasVal) biasVal.textContent = `${v.toFixed(1)} mA`;
      renderView();
    };
  }

  if (txSlider) {
    txSlider.oninput = (e) => {
      const v = Number(e.target.value) || 2.4;
      currentReading.txPowerDbm = v;
      if (txVal) txVal.textContent = `${v.toFixed(1)} dBm`;
      renderView();
    };
  }

  if (rxSlider) {
    rxSlider.oninput = (e) => {
      const v = Number(e.target.value) || -18.2;
      currentReading.rxPowerDbm = v;
      if (rxVal) rxVal.textContent = `${v.toFixed(1)} dBm`;
      renderView();
    };
  }

  // Buttons
  if (recordCertBtn) {
    recordCertBtn.onclick = () => {
      if (notesInput) currentReading.linemanNotes = notesInput.value;
      const record = buildDdmiCertRecord(currentReading);
      saveDdmiCert(record, storage);
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast(`✓ Logged DDMI Certificate ${record.id} (${record.healthScore}%)`);
      }
    };
  }

  if (copyReportBtn) {
    copyReportBtn.onclick = async () => {
      if (notesInput) currentReading.linemanNotes = notesInput.value;
      const record = buildDdmiCertRecord(currentReading);
      const text = formatDdmiCertWhatsApp(record);
      const clipboard = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      let success = false;
      if (clipboard && typeof clipboard.writeText === 'function') {
        try {
          await clipboard.writeText(text);
          success = true;
        } catch (_) {}
      }
      if (typeof options.onToast === 'function') {
        options.onToast(success ? '✓ WhatsApp DDMI Report copied to clipboard' : 'Report generated in console');
      }
    };
  }

  if (printA4Btn) {
    printA4Btn.onclick = () => {
      const record = buildDdmiCertRecord(currentReading);
      const html = generateDdmiCertHtml(record, 'standard');
      if (typeof options.onPrint === 'function') {
        options.onPrint(html);
      } else if (typeof window !== 'undefined') {
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(html);
          w.document.close();
          w.print();
        }
      }
    };
  }

  if (printThermalBtn) {
    printThermalBtn.onclick = () => {
      const record = buildDdmiCertRecord(currentReading);
      const html = generateDdmiCertHtml(record, 'thermal');
      if (typeof options.onPrint === 'function') {
        options.onPrint(html);
      } else if (typeof window !== 'undefined') {
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(html);
          w.document.close();
          w.print();
        }
      }
    };
  }

  if (exportCsvBtn) {
    exportCsvBtn.onclick = () => {
      const records = getSavedDdmiCerts(storage);
      const csv = generateDdmiCertsCsv(records);
      if (typeof options.onExportCsv === 'function') {
        options.onExportCsv(csv, 'shahdara_ddmi_certificates.csv');
      }
      if (typeof options.onToast === 'function') {
        options.onToast(`Exported ${records.length} DDMI certificates to CSV`);
      }
    };
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.onclick = () => {
      clearDdmiCerts(storage);
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast('Cleared DDMI certification log');
      }
    };
  }

  return {
    open: openModal,
    close: closeModal,
    getCurrentReading: () => ({ ...currentReading }),
    setReading: (newReading) => {
      Object.assign(currentReading, newReading);
      renderView();
    }
  };
}
