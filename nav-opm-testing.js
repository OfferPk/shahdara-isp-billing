/**
 * Shahdara ISP - Field Technician Optical Power Meter (OPM) & Insertion Loss Verifier Suite
 * Part of mobile navigation and field crew tools (agent2 - shahdara-mobile-nav).
 *
 * Implements calibrated laser wavelength testing (1310, 1490, 1550, 1577, 1625nm),
 * logarithmic optical power dBm to milliwatts/microwatts conversions, ITU-T G.984 Class B+/C+
 * optical link budgets, connector polish insertion loss and contamination penalties,
 * persistent offline test logs (localStorage), digital LCD meter SVG gauge rendering,
 * and field WhatsApp dispatch reports.
 */

export const OPM_TEST_LOGS_STORAGE_KEY = 'shahdara_opm_test_logs_v1';

export const OPM_CALIBRATED_WAVELENGTHS = [
  { wavelengthNm: 1310, label: '1310 nm (GPON Upstream Burst)', standardLossDbPerKm: 0.35, application: 'ONU upstream transmission' },
  { wavelengthNm: 1490, label: '1490 nm (GPON Downstream Continuous)', standardLossDbPerKm: 0.22, application: 'OLT continuous downstream data' },
  { wavelengthNm: 1550, label: '1550 nm (CATV Video Overlay)', standardLossDbPerKm: 0.20, application: 'RF video & EDFA overlay' },
  { wavelengthNm: 1577, label: '1577 nm (XGS-PON 10G Downstream)', standardLossDbPerKm: 0.23, application: 'Next-gen 10G symmetric broadband' },
  { wavelengthNm: 1625, label: '1625 nm (OTDR Maintenance Band)', standardLossDbPerKm: 0.25, application: 'Live fiber testing & macrobend detection' }
];

export const OPM_TEST_POINTS = [
  {
    id: 'point-olt-sfp',
    name: 'OLT SFP+ Optical Port',
    location: 'Central ODF / Main Exchange',
    nominalPowerMinDbm: 2.5,
    nominalPowerMaxDbm: 7.0,
    expectedLossBudgetDb: 0.0,
    areaTag: 'Shahdara Town'
  },
  {
    id: 'point-fdh-splitter',
    name: 'Primary FDH Splitter (1:8)',
    location: 'Fiber Distribution Hub Cabinet',
    nominalPowerMinDbm: -11.5,
    nominalPowerMaxDbm: -7.5,
    expectedLossBudgetDb: 10.5,
    areaTag: 'Baradari Road'
  },
  {
    id: 'point-fat-drop',
    name: 'Secondary FAT Splitter (1:16)',
    location: 'Pole Mounted Fiber Access Terminal',
    nominalPowerMinDbm: -23.0,
    nominalPowerMaxDbm: -18.5,
    expectedLossBudgetDb: 14.2,
    areaTag: 'Vandala Road'
  },
  {
    id: 'point-rosette-onu',
    name: 'Subscriber Rosette / ONT Input',
    location: 'Customer Premises Internal Termination',
    nominalPowerMinDbm: -25.5,
    nominalPowerMaxDbm: -15.0,
    expectedLossBudgetDb: 18.5,
    areaTag: 'Jia Musa'
  }
];

export const CONNECTOR_POLISH_TYPES = {
  'sc-apc': { name: 'SC/APC (Green 8° Angle)', baseLossDb: 0.25, returnLossDb: 65 },
  'sc-upc': { name: 'SC/UPC (Blue 0° Flat)', baseLossDb: 0.35, returnLossDb: 52 }
};

export const CONTAMINATION_LEVELS = {
  'clean': { name: 'Clean (Alcohol Wiped)', penaltyDb: 0.0 },
  'dust': { name: 'Light Environmental Dust', penaltyDb: 0.8 },
  'smudge': { name: 'Fingerprint / Oil Smudge', penaltyDb: 2.2 },
  'scratch': { name: 'Severe Ferrule Scratch', penaltyDb: 4.5 }
};

/**
 * Converts dBm optical power to milliwatts (mW).
 */
export function dBmToMilliwatts(dBm) {
  if (typeof dBm !== 'number' || isNaN(dBm)) return 0;
  return Math.pow(10, dBm / 10);
}

/**
 * Converts milliwatts (mW) to dBm optical power.
 */
export function milliwattsToDbm(mW) {
  if (typeof mW !== 'number' || isNaN(mW) || mW <= 0) return -70.0;
  return Math.round(10 * Math.log10(mW) * 100) / 100;
}

/**
 * Calculates optical insertion loss between reference launch power and measured received power.
 */
export function calculateInsertionLoss(referencePowerDbm, measuredPowerDbm) {
  const ref = Number(referencePowerDbm) || 0;
  const meas = Number(measuredPowerDbm) || 0;
  return Math.round((ref - meas) * 100) / 100;
}

/**
 * Evaluates optical signal reception against ITU-T G.984 Class B+/C+ GPON standards.
 */
export function evaluateOpmSignalGrade(measuredPowerDbm, testPointId = 'point-rosette-onu') {
  const p = Number(measuredPowerDbm);
  if (isNaN(p) || p <= -50.0) {
    return {
      grade: 'NO_LIGHT',
      label: 'Dark Fiber / No Light Detected',
      badgeClass: 'badge-danger',
      statusColor: '#ef4444',
      actionAdvice: 'Inspect upstream feeder cable or check OLT SFP transmitter.',
      pass: false
    };
  }

  if (testPointId === 'point-olt-sfp') {
    if (p < 1.0) {
      return {
        grade: 'CRITICAL_LOW',
        label: 'Low Laser Launch Output',
        badgeClass: 'badge-danger',
        statusColor: '#ef4444',
        actionAdvice: 'Degraded SFP module; replace optical transceiver.',
        pass: false
      };
    }
    return {
      grade: 'EXCELLENT',
      label: 'Optimal SFP Laser Launch Power',
      badgeClass: 'badge-success',
      statusColor: '#10b981',
      actionAdvice: 'Transceiver emitting at full optical specification.',
      pass: true
    };
  }

  // Rosette / FAT / FDH subscriber drop thresholds
  if (p > -8.0) {
    return {
      grade: 'OVERLOAD',
      label: 'Optical Receiver Overload (> -8 dBm)',
      badgeClass: 'badge-danger',
      statusColor: '#dc2626',
      actionAdvice: 'High risk of ONU photodiode saturation; insert 5dB/10dB fixed attenuator.',
      pass: false
    };
  }

  if (p >= -21.0) {
    return {
      grade: 'EXCELLENT',
      label: 'Optimal Signal (Class B+/C+ Target)',
      badgeClass: 'badge-success',
      statusColor: '#10b981',
      actionAdvice: 'Pristine optical reception with maximum fade margin.',
      pass: true
    };
  }

  if (p >= -26.0) {
    return {
      grade: 'ACCEPTABLE',
      label: 'Acceptable Working Range (-21 to -26 dBm)',
      badgeClass: 'badge-warning',
      statusColor: '#f59e0b',
      actionAdvice: 'Adequate for operation; check patch cord bend radius if latency fluctuates.',
      pass: true
    };
  }

  if (p >= -28.5) {
    return {
      grade: 'CRITICAL_LOW',
      label: 'Critical Threshold (-26 to -28.5 dBm)',
      badgeClass: 'badge-danger',
      statusColor: '#ef4444',
      actionAdvice: 'Near ONU sensitivity limit; packet drops and flapping likely in rain/wind.',
      pass: false
    };
  }

  return {
    grade: 'NO_LIGHT',
    label: 'Excessive Attenuation (< -28.5 dBm)',
    badgeClass: 'badge-danger',
    statusColor: '#ef4444',
    actionAdvice: 'Unacceptable link loss; locate microbend or dirty connector along the drop.',
    pass: false
  };
}

/**
 * Calculates total end-to-end insertion loss including connector polish and contamination.
 */
export function calculateLinkLossBudget(baseLossDb, connectorType = 'sc-apc', contamination = 'clean') {
  const base = Number(baseLossDb) || 0;
  const connLoss = CONNECTOR_POLISH_TYPES[connectorType]?.baseLossDb || 0.25;
  const contamLoss = CONTAMINATION_LEVELS[contamination]?.penaltyDb || 0.0;
  const total = base + connLoss + contamLoss;
  return {
    baseLossDb: Math.round(base * 100) / 100,
    connectorLossDb: connLoss,
    contaminationPenaltyDb: contamLoss,
    totalLossDb: Math.round(total * 100) / 100
  };
}

/**
 * Calculates theoretical optical fiber attenuation loss based on wavelength and distance.
 */
export function calculateFiberAttenuation(wavelengthNm = 1490, lengthKm = 1.0) {
  const wl = Number(wavelengthNm) || 1490;
  const km = Math.max(0, Number(lengthKm) || 0);
  const entry = OPM_CALIBRATED_WAVELENGTHS.find(w => w.wavelengthNm === wl) || OPM_CALIBRATED_WAVELENGTHS[1];
  const lossDb = Math.round(entry.standardLossDbPerKm * km * 1000) / 1000;
  return {
    wavelengthNm: entry.wavelengthNm,
    standardLossDbPerKm: entry.standardLossDbPerKm,
    lengthKm: km,
    fiberLossDb: lossDb
  };
}

/**
 * Estimates maximum allowable fiber drop distance before signal drops below ONT sensitivity.
 */
export function estimateMaxAllowableDropDistanceKm({
  launchPowerDbm = 3.0,
  minReceiverSensitivityDbm = -27.0,
  splitterLossDb = 24.7,
  connectorLossDb = 2.0,
  wavelengthNm = 1490
} = {}) {
  const launch = Number(launchPowerDbm) || 3.0;
  const sens = Number(minReceiverSensitivityDbm) || -27.0;
  const split = Number(splitterLossDb) || 24.7;
  const conn = Number(connectorLossDb) || 2.0;
  const wl = Number(wavelengthNm) || 1490;

  const totalBudgetDb = Math.round((launch - sens) * 100) / 100;
  const availableFiberLossDb = Math.max(0, Math.round((totalBudgetDb - split - conn) * 100) / 100);

  const entry = OPM_CALIBRATED_WAVELENGTHS.find(w => w.wavelengthNm === wl) || OPM_CALIBRATED_WAVELENGTHS[1];
  const maxDistanceKm = entry.standardLossDbPerKm > 0
    ? Math.round((availableFiberLossDb / entry.standardLossDbPerKm) * 100) / 100
    : 0;

  return {
    totalPowerBudgetDb: totalBudgetDb,
    fixedSplitterLossDb: split,
    totalConnectorLossDb: conn,
    availableFiberLossDb,
    maxDistanceKm,
    maxDistanceMeters: Math.round(maxDistanceKm * 1000)
  };
}

/**
 * Evaluates optical return loss safety and backreflection hazards for OLT laser optics.
 */
export function evaluateReturnLossSafety(connectorType = 'sc-apc', launchPowerDbm = 3.0) {
  const conn = CONNECTOR_POLISH_TYPES[connectorType] || CONNECTOR_POLISH_TYPES['sc-apc'];
  const p = Number(launchPowerDbm) || 0;
  const isHighRisk = conn.returnLossDb < 60 && p >= 3.0;

  return {
    connectorType,
    connectorName: conn.name,
    returnLossDb: conn.returnLossDb,
    isHighRisk,
    statusText: isHighRisk
      ? 'WARNING: Flat polish connector induces severe optical backreflections. Use SC/APC angled polish for GPON OLT laser transceivers.'
      : 'OPTIMAL: Angled polish (SC/APC) minimizes backreflection below -60 dB, protecting OLT laser diode.'
  };
}

/**
 * Retrieves persisted OPM test logs from storage.
 */
export function getOpmTestLogsStore(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return { logs: [] };
  try {
    const raw = storage.getItem(OPM_TEST_LOGS_STORAGE_KEY);
    if (!raw) return { logs: [] };
    const parsed = JSON.parse(raw);
    return {
      logs: Array.isArray(parsed?.logs) ? parsed.logs : []
    };
  } catch (err) {
    return { logs: [] };
  }
}

/**
 * Saves OPM test logs to storage.
 */
export function saveOpmTestLogsStore(store, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return false;
  try {
    storage.setItem(OPM_TEST_LOGS_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Records a new OPM test measurement to storage.
 */
export function recordOpmTestLog(logData, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  const store = getOpmTestLogsStore(storage);
  const entry = {
    id: 'opm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    wavelengthNm: Number(logData.wavelengthNm) || 1490,
    testPointId: logData.testPointId || 'point-rosette-onu',
    measuredPowerDbm: Number(logData.measuredPowerDbm) || -20.0,
    powerMilliwatts: dBmToMilliwatts(Number(logData.measuredPowerDbm) || -20.0),
    connectorType: logData.connectorType || 'sc-apc',
    contamination: logData.contamination || 'clean',
    notes: String(logData.notes || '').trim()
  };

  const evalResult = evaluateOpmSignalGrade(entry.measuredPowerDbm, entry.testPointId);
  entry.signalGrade = evalResult.grade;
  entry.gradeLabel = evalResult.label;
  entry.pass = evalResult.pass;

  store.logs.unshift(entry);
  if (store.logs.length > 50) {
    store.logs = store.logs.slice(0, 50);
  }

  saveOpmTestLogsStore(store, storage);
  return entry;
}

/**
 * Clears all recorded OPM test logs.
 */
export function clearOpmTestLogsStore(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return false;
  try {
    storage.removeItem(OPM_TEST_LOGS_STORAGE_KEY);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Generates an executive WhatsApp dispatch message for field linemen.
 */
export function generateOpmFieldReport(reading, options = {}) {
  const evalResult = evaluateOpmSignalGrade(reading.measuredPowerDbm, reading.testPointId);
  const pMw = dBmToMilliwatts(reading.measuredPowerDbm);
  const pUw = pMw * 1000;
  const point = OPM_TEST_POINTS.find(p => p.id === reading.testPointId) || OPM_TEST_POINTS[3];

  const lines = [
    '========================================',
    ' 📡 SHAHDARA ISP - OPTICAL POWER METER (OPM) REPORT ',
    '========================================',
    `🕒 Time: ${new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })} PKT`,
    `📍 Test Location: ${point.name} (${point.areaTag})`,
    `🔬 Calibrated Laser Wavelength: ${reading.wavelengthNm} nm`,
    `⚡ Measured Power: ${reading.measuredPowerDbm.toFixed(2)} dBm (${pUw < 1 ? (pUw * 1000).toFixed(1) + ' nW' : pUw.toFixed(2) + ' µW'})`,
    `🔌 Connector Polish: ${CONNECTOR_POLISH_TYPES[reading.connectorType]?.name || reading.connectorType}`,
    `🧽 End-face Status: ${CONTAMINATION_LEVELS[reading.contamination]?.name || reading.contamination}`,
    `📊 Signal Health Grade: ${evalResult.label}`,
    `🛠 Action Advice: ${evalResult.actionAdvice}`,
    reading.notes ? `📝 Lineman Notes: ${reading.notes}` : '',
    '========================================',
    '✅ Verified on mobile field diagnostic console'
  ].filter(Boolean);

  return lines.join('\n');
}

/**
 * Renders an accessible, responsive digital LCD optical power meter SVG gauge.
 */
export function renderMobileOpmGaugeSvg(reading, options = {}) {
  const p = Number(reading.measuredPowerDbm) || -20.0;
  const wave = reading.wavelengthNm || 1490;
  const point = OPM_TEST_POINTS.find(tp => tp.id === reading.testPointId) || OPM_TEST_POINTS[3];
  const evalResult = evaluateOpmSignalGrade(p, reading.testPointId);

  // Meter Needle Calculation across -40 dBm to 0 dBm range
  const clampedP = Math.max(-40.0, Math.min(0.0, p));
  const fraction = (clampedP - (-40.0)) / 40.0; // 0 to 1
  const needleAngle = fraction * 180; // 0 (left at -40) to 180 (right at 0)
  const rad = (180 - needleAngle) * (Math.PI / 180);
  const nx = 170 - 110 * Math.cos(rad);
  const ny = 140 - 110 * Math.sin(rad);

  const pMw = dBmToMilliwatts(p);
  const pUw = pMw * 1000;
  const powerUnitText = pUw >= 1 ? `${pUw.toFixed(2)} µW` : `${(pUw * 1000).toFixed(1)} nW`;

  return `
    <svg class="opm-gauge-svg" viewBox="0 0 340 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Optical Power Meter LCD Gauge">
      <defs>
        <!-- LCD Display Gradient -->
        <linearGradient id="opmLcdBg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#cbd5e1" />
          <stop offset="100%" stop-color="#94a3b8" />
        </linearGradient>
        <linearGradient id="opmScaleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ef4444" />
          <stop offset="25%" stop-color="#f59e0b" />
          <stop offset="47%" stop-color="#10b981" />
          <stop offset="75%" stop-color="#10b981" />
          <stop offset="90%" stop-color="#f59e0b" />
          <stop offset="100%" stop-color="#dc2626" />
        </linearGradient>
      </defs>

      <!-- Meter Outer Bezel -->
      <rect x="4" y="4" width="332" height="202" rx="12" fill="var(--surface, #1e293b)" stroke="#475569" stroke-width="2" />

      <!-- Top Status Header -->
      <text x="18" y="24" font-size="9px" font-weight="800" fill="#94a3b8" letter-spacing="0.5">SHD-OPM PRO</text>
      <text x="170" y="24" text-anchor="middle" font-size="9px" font-weight="700" fill="#38bdf8">λ = ${wave} nm</text>
      <text x="322" y="24" text-anchor="end" font-size="9px" font-weight="700" fill="#94a3b8">${point.areaTag}</text>

      <!-- Semicircular Scale Track -->
      <path d="M 50,140 A 120,120 0 0,1 290,140" fill="none" stroke="rgba(255, 255, 255, 0.15)" stroke-width="12" stroke-linecap="round" />
      <path d="M 50,140 A 120,120 0 0,1 290,140" fill="none" stroke="url(#opmScaleGrad)" stroke-width="8" stroke-linecap="round" />

      <!-- Ticks and Labels -->
      <text x="45" y="156" text-anchor="middle" font-size="8px" fill="#94a3b8">-40</text>
      <text x="85" y="78" text-anchor="middle" font-size="8px" fill="#94a3b8">-30</text>
      <text x="170" y="38" text-anchor="middle" font-size="8px" font-weight="700" fill="#10b981">-20</text>
      <text x="255" y="78" text-anchor="middle" font-size="8px" fill="#94a3b8">-10</text>
      <text x="295" y="156" text-anchor="middle" font-size="8px" fill="#ef4444">0 dBm</text>

      <!-- Needle -->
      <circle cx="170" cy="140" r="7" fill="#0f172a" stroke="#cbd5e1" stroke-width="2" />
      <line x1="170" y1="140" x2="${nx}" y2="${ny}" stroke="${evalResult.statusColor}" stroke-width="3.5" stroke-linecap="round" />

      <!-- Digital LCD Readout Box -->
      <rect x="75" y="125" width="190" height="42" rx="5" fill="#0f172a" stroke="#334155" stroke-width="1.5" />
      <text x="170" y="148" text-anchor="middle" font-size="20px" font-family="monospace" font-weight="900" fill="#38bdf8">${p >= 0 ? '+' : ''}${p.toFixed(2)} dBm</text>
      <text x="170" y="162" text-anchor="middle" font-size="9px" font-family="monospace" font-weight="600" fill="#94a3b8">${powerUnitText}</text>

      <!-- Bottom Signal Grade Pill -->
      <g transform="translate(170, 192)">
        <rect x="-120" y="-14" width="240" height="20" rx="4" fill="${evalResult.statusColor}" opacity="0.18" />
        <rect x="-120" y="-14" width="240" height="20" rx="4" fill="none" stroke="${evalResult.statusColor}" stroke-width="1" />
        <text x="0" y="0" text-anchor="middle" font-size="9px" font-weight="800" fill="${evalResult.statusColor}">${evalResult.label.toUpperCase()}</text>
      </g>
    </svg>
  `;
}

/**
 * Initializes and wires events for the mobile OPM Testing modal dialog.
 */
export function setupMobileOpmTestingModal(options = {}) {
  const modal = document.getElementById('mobileOpmTestingModal');
  const closeBtn = document.getElementById('closeMobileOpmTestingModal');

  const waveSelect = document.getElementById('opmWavelengthSelect');
  const pointSelect = document.getElementById('opmTestPointSelect');
  const powerSlider = document.getElementById('opmMeasuredPowerSlider') || document.getElementById('opmPowerSlider');
  const powerInput = document.getElementById('opmMeasuredPowerInput') || document.getElementById('opmPowerInput');
  const connSelect = document.getElementById('opmConnectorSelect');
  const contamSelect = document.getElementById('opmContaminationSelect') || document.getElementById('opmContamSelect');
  const notesInput = document.getElementById('opmTestNotesInput') || document.getElementById('opmNotesInput');

  const gaugeWrap = document.getElementById('opmGaugeSvgContainer') || document.getElementById('opmGaugeWrap');
  const kpiDbm = document.getElementById('opmKpiDbm');
  const kpiPowerMw = document.getElementById('opmKpiLinearMicroWatts') || document.getElementById('opmKpiPowerMw');
  const kpiGrade = document.getElementById('opmKpiSignalGrade') || document.getElementById('opmKpiGrade');
  const kpiAdvice = document.getElementById('opmKpiCompliance') || document.getElementById('opmKpiAdvice');
  const kpiTotalLoss = document.getElementById('opmKpiTotalLoss');

  const logBtn = document.getElementById('opmRecordLogBtn') || document.getElementById('opmLogTestBtn');
  const clearLogsBtn = document.getElementById('opmClearLogsBtn');
  const copyReportBtn = document.getElementById('opmCopyReportBtn');
  const filterAreaBtn = document.getElementById('opmFilterAreaBtn');
  const logsList = document.getElementById('opmLogsList');

  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

  let currentReading = {
    wavelengthNm: 1490,
    testPointId: 'point-rosette-onu',
    measuredPowerDbm: -20.5,
    connectorType: 'sc-apc',
    contamination: 'clean',
    notes: ''
  };

  function renderView() {
    const evalResult = evaluateOpmSignalGrade(currentReading.measuredPowerDbm, currentReading.testPointId);
    const pMw = dBmToMilliwatts(currentReading.measuredPowerDbm);
    const pUw = pMw * 1000;

    if (gaugeWrap) {
      gaugeWrap.innerHTML = renderMobileOpmGaugeSvg(currentReading);
    }

    if (kpiDbm) {
      kpiDbm.textContent = `${currentReading.measuredPowerDbm >= 0 ? '+' : ''}${currentReading.measuredPowerDbm.toFixed(2)} dBm`;
      kpiDbm.style.color = evalResult.statusColor;
    }

    if (kpiPowerMw) {
      kpiPowerMw.textContent = pUw >= 1 ? `${pUw.toFixed(2)} µW` : `${(pUw * 1000).toFixed(1)} nW`;
    }

    if (kpiGrade) {
      kpiGrade.textContent = evalResult.label;
      kpiGrade.className = `badge ${evalResult.badgeClass}`;
      kpiGrade.style.color = evalResult.statusColor;
    }

    if (kpiAdvice) {
      kpiAdvice.textContent = evalResult.pass ? 'PASS' : 'FAIL';
      kpiAdvice.style.color = evalResult.pass ? '#10b981' : '#ef4444';
    }

    if (kpiTotalLoss) {
      const point = OPM_TEST_POINTS.find(p => p.id === currentReading.testPointId) || OPM_TEST_POINTS[3];
      const lossResult = calculateLinkLossBudget(point.expectedLossBudgetDb, currentReading.connectorType, currentReading.contamination);
      kpiTotalLoss.textContent = `${lossResult.totalLossDb.toFixed(2)} dB`;
    }

    renderLogsList();
  }

  function renderLogsList() {
    if (!logsList) return;
    const store = getOpmTestLogsStore(storage);
    if (!store.logs.length) {
      logsList.innerHTML = `<li class="opm-log-empty">No optical power logs recorded yet. Tap "Log OPM Test" to record.</li>`;
      return;
    }

    logsList.innerHTML = store.logs.slice(0, 15).map(log => `
      <li class="opm-log-item ${log.pass ? 'pass' : 'fail'}">
        <div class="opm-log-header">
          <strong>${log.measuredPowerDbm.toFixed(2)} dBm</strong> (${log.wavelengthNm}nm)
          <span class="sim-delta-badge ${log.pass ? 'badge-success' : 'badge-danger'}">${log.signalGrade}</span>
        </div>
        <div class="opm-log-sub">
          <span>${new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> ·
          <span>${OPM_TEST_POINTS.find(p => p.id === log.testPointId)?.name || log.testPointId}</span>
          ${log.notes ? `· <em>${log.notes}</em>` : ''}
        </div>
      </li>
    `).join('');
  }

  function openModal() {
    if (waveSelect) waveSelect.value = currentReading.wavelengthNm;
    if (pointSelect) pointSelect.value = currentReading.testPointId;
    if (powerSlider) powerSlider.value = currentReading.measuredPowerDbm;
    if (powerInput) powerInput.value = currentReading.measuredPowerDbm;
    if (connSelect) connSelect.value = currentReading.connectorType;
    if (contamSelect) contamSelect.value = currentReading.contamination;

    renderView();
    if (modal) {
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
    }
  }

  function closeModal() {
    if (modal) {
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    }
  }

  // Hook trigger buttons across UI
  document.querySelectorAll('[data-open-opm-tester]').forEach(btn => {
    btn.onclick = openModal;
  });

  if (closeBtn) {
    closeBtn.onclick = closeModal;
  }

  if (waveSelect) {
    waveSelect.onchange = (e) => {
      currentReading.wavelengthNm = Number(e.target.value);
      renderView();
    };
  }

  if (pointSelect) {
    pointSelect.onchange = (e) => {
      currentReading.testPointId = e.target.value;
      renderView();
    };
  }

  if (powerSlider) {
    powerSlider.oninput = (e) => {
      currentReading.measuredPowerDbm = Number(e.target.value);
      if (powerInput) powerInput.value = currentReading.measuredPowerDbm;
      renderView();
    };
  }

  if (powerInput) {
    powerInput.oninput = (e) => {
      const val = Number(e.target.value);
      if (!isNaN(val)) {
        currentReading.measuredPowerDbm = Math.max(-50, Math.min(10, val));
        if (powerSlider) powerSlider.value = currentReading.measuredPowerDbm;
        renderView();
      }
    };
  }

  if (connSelect) {
    connSelect.onchange = (e) => {
      currentReading.connectorType = e.target.value;
      renderView();
    };
  }

  if (contamSelect) {
    contamSelect.onchange = (e) => {
      currentReading.contamination = e.target.value;
      renderView();
    };
  }

  if (logBtn) {
    logBtn.onclick = () => {
      if (notesInput) currentReading.notes = notesInput.value;
      const logged = recordOpmTestLog(currentReading, storage);
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast(`✓ Logged ${logged.measuredPowerDbm.toFixed(2)} dBm reading (${logged.signalGrade})`);
      }
    };
  }

  if (clearLogsBtn) {
    clearLogsBtn.onclick = () => {
      clearOpmTestLogsStore(storage);
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast('Cleared optical power test logs');
      }
    };
  }

  if (copyReportBtn) {
    copyReportBtn.onclick = async () => {
      if (notesInput) currentReading.notes = notesInput.value;
      const report = generateOpmFieldReport(currentReading, options);
      const clipboard = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      let success = false;
      if (clipboard && typeof clipboard.writeText === 'function') {
        try {
          await clipboard.writeText(report);
          success = true;
        } catch (_) {}
      }
      if (typeof options.onToast === 'function') {
        options.onToast(success ? '✓ OPM Field Report copied to clipboard' : 'Report generated in console');
      }
    };
  }

  if (filterAreaBtn) {
    filterAreaBtn.onclick = () => {
      const point = OPM_TEST_POINTS.find(p => p.id === currentReading.testPointId) || OPM_TEST_POINTS[3];
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(point.areaTag);
        closeModal();
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
