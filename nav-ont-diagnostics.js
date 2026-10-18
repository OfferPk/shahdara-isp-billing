/**
 * Shahdara ISP - Field Technician GPON ONU / ONT Optical BOSA Diagnostics Assistant
 * Part of mobile navigation and field crew tools (agent2 - shahdara-mobile-nav).
 *
 * Implements GPON ONU/ONT transceiver BOSA diagnostics (SFF-8472 DDM/DOM):
 * - Rx Optical Power (dBm) at 1490nm downstream
 * - Tx Optical Power (dBm) at 1310nm upstream burst
 * - Laser Diode Bias Current (I_bias in mA)
 * - Transceiver Internal Operating Temperature (°C)
 * - Power Supply Voltage (V_cc in Volts)
 * - Root-cause fault diagnosis, composite health score, pure client-side SVG ONT monitor,
 *   device localStorage persistence, and lineman WhatsApp dispatch reports.
 */

export const ONT_DIAGNOSTICS_STORAGE_KEY = 'shahdara_ont_diagnostics_logs_v1';

export const ONT_MODELS = [
  { id: 'HUAWEI_HG8245H', name: 'Huawei EchoLife HG8245H (GPON 4GE+2POTS+Wi-Fi)', vendor: 'Huawei' },
  { id: 'ZTE_F660', name: 'ZTE ZXHN F660 (GPON 4FE+2POTS+Wi-Fi)', vendor: 'ZTE' },
  { id: 'FIBERHOME_AN5506', name: 'FiberHome AN5506-04-B (GPON 4GE+2POTS)', vendor: 'FiberHome' },
  { id: 'VSOL_V2801SG', name: 'V-SOL V2801SG (1GE XPON Bridge ONT)', vendor: 'V-SOL' },
  { id: 'GENERIC_GPON', name: 'Generic SFP/BOSA GPON Terminal', vendor: 'Generic' }
];

export const ONT_PRESETS = [
  {
    id: 'PRESET_HEALTHY',
    name: 'Optimal Link (Standard Home Active)',
    rxPowerDbm: -18.5,
    txPowerDbm: 2.4,
    laserBiasMa: 14.5,
    temperatureC: 38.0,
    supplyVoltageV: 3.31,
    desc: 'Perfect optical margin and laser telemetry'
  },
  {
    id: 'PRESET_WEAK_RX',
    name: 'Weak Optical Rx (Drop Cable Macrobend)',
    rxPowerDbm: -28.2,
    txPowerDbm: 2.2,
    laserBiasMa: 15.0,
    temperatureC: 41.5,
    supplyVoltageV: 3.28,
    desc: 'High attenuation or tight drop wire bend'
  },
  {
    id: 'PRESET_AGING_LASER',
    name: 'Laser Diode Aging (High Bias Current)',
    rxPowerDbm: -19.2,
    txPowerDbm: 1.1,
    laserBiasMa: 39.8,
    temperatureC: 47.0,
    supplyVoltageV: 3.29,
    desc: 'Laser diode wearing out; imminent transmit failure'
  },
  {
    id: 'PRESET_OVERHEATING',
    name: 'Thermal Throttling (Shahdara Summer Attic)',
    rxPowerDbm: -20.5,
    txPowerDbm: 2.1,
    laserBiasMa: 22.0,
    temperatureC: 68.5,
    supplyVoltageV: 3.25,
    desc: 'High ambient temperature causing packet flaps'
  },
  {
    id: 'PRESET_BAD_ADAPTER',
    name: 'Faulty DC Power Adapter (Undervoltage)',
    rxPowerDbm: -18.9,
    txPowerDbm: 1.8,
    laserBiasMa: 16.0,
    temperatureC: 35.0,
    supplyVoltageV: 2.92,
    desc: 'DC 12V adapter ripple causing low 3.3V internal rail'
  }
];

/**
 * Evaluates Rx optical power reading.
 * @param {number} rxDbm
 * @returns {Object} Quality status.
 */
export function evaluateOntRxPower(rxDbm) {
  const val = Number(rxDbm);
  if (isNaN(val) || val === 0 || val <= -35.0) {
    return { id: 'LOS', label: 'Loss of Signal (LOS)', color: '#ef4444', score: 0, pass: false };
  }
  if (val > -8.0) {
    return { id: 'OVERLOAD', label: 'Photodiode Overload (> -8.0 dBm)', color: '#dc2626', score: 20, pass: false };
  }
  if (val >= -24.0 && val <= -14.0) {
    return { id: 'OPTIMAL', label: 'Optimal Rx (-14 to -24 dBm)', color: '#10b981', score: 100, pass: true };
  }
  if ((val > -14.0 && val <= -8.0) || (val < -24.0 && val >= -27.0)) {
    return { id: 'ACCEPTABLE', label: 'Acceptable Margin (-8 to -14 / -24 to -27 dBm)', color: '#3b82f6', score: 80, pass: true };
  }
  if (val < -27.0 && val >= -28.5) {
    return { id: 'MARGINAL', label: 'Marginal Flapping Risk (-27 to -28.5 dBm)', color: '#f59e0b', score: 50, pass: false };
  }
  return { id: 'CRITICAL_LOW', label: 'Critical Low Rx (< -28.5 dBm)', color: '#ef4444', score: 20, pass: false };
}

/**
 * Evaluates upstream Tx optical power reading.
 * @param {number} txDbm
 * @returns {Object} Quality status.
 */
export function evaluateOntTxPower(txDbm) {
  const val = Number(txDbm);
  if (isNaN(val)) return { id: 'UNKNOWN', label: 'Unknown Tx', color: '#94a3b8', score: 50, pass: false };
  if (val >= 1.5 && val <= 3.5) {
    return { id: 'OPTIMAL', label: 'Optimal Tx (+1.5 to +3.5 dBm)', color: '#10b981', score: 100, pass: true };
  }
  if (val >= 0.5 && val <= 5.0) {
    return { id: 'ACCEPTABLE', label: 'Acceptable Tx (+0.5 to +5.0 dBm)', color: '#3b82f6', score: 85, pass: true };
  }
  if (val < 0.5) {
    return { id: 'WEAK_TX', label: 'Weak Tx (< +0.5 dBm)', color: '#f59e0b', score: 40, pass: false };
  }
  return { id: 'HIGH_TX', label: 'High Tx (> +5.0 dBm)', color: '#ef4444', score: 40, pass: false };
}

/**
 * Evaluates laser bias current (mA).
 * @param {number} biasMa
 * @returns {Object} Quality status.
 */
export function evaluateOntLaserBias(biasMa) {
  const val = Number(biasMa);
  if (isNaN(val)) return { id: 'UNKNOWN', label: 'Unknown Bias', color: '#94a3b8', score: 50, pass: false };
  if (val >= 10.0 && val <= 25.0) {
    return { id: 'OPTIMAL', label: 'Normal DFB Bias (10 - 25 mA)', color: '#10b981', score: 100, pass: true };
  }
  if (val >= 8.0 && val <= 32.0) {
    return { id: 'ACCEPTABLE', label: 'Acceptable Bias (8 - 32 mA)', color: '#3b82f6', score: 85, pass: true };
  }
  if (val > 32.0 && val <= 45.0) {
    return { id: 'AGING_WARNING', label: 'Laser Aging Warning (32 - 45 mA)', color: '#f59e0b', score: 45, pass: false };
  }
  return { id: 'CRITICAL_BURNOUT', label: 'Critical Laser Burnout (> 45 mA)', color: '#ef4444', score: 10, pass: false };
}

/**
 * Evaluates transceiver internal temperature (°C).
 * @param {number} tempC
 * @returns {Object} Quality status.
 */
export function evaluateOntTemperature(tempC) {
  const val = Number(tempC);
  if (isNaN(val)) return { id: 'UNKNOWN', label: 'Unknown Temp', color: '#94a3b8', score: 50, pass: false };
  if (val >= 20.0 && val <= 50.0) {
    return { id: 'OPTIMAL', label: 'Cool / Normal Temp (20 - 50 °C)', color: '#10b981', score: 100, pass: true };
  }
  if (val >= 10.0 && val <= 60.0) {
    return { id: 'ACCEPTABLE', label: 'Acceptable Temp (10 - 60 °C)', color: '#3b82f6', score: 85, pass: true };
  }
  if (val > 60.0 && val <= 70.0) {
    return { id: 'WARM_WARNING', label: 'High Heat Warning (60 - 70 °C)', color: '#f59e0b', score: 50, pass: false };
  }
  return { id: 'THERMAL_SHUTDOWN', label: 'Thermal Overheat Risk (> 70 °C)', color: '#ef4444', score: 15, pass: false };
}

/**
 * Evaluates power supply voltage (V).
 * @param {number} volts
 * @returns {Object} Quality status.
 */
export function evaluateOntVoltage(volts) {
  const val = Number(volts);
  if (isNaN(val)) return { id: 'UNKNOWN', label: 'Unknown Voltage', color: '#94a3b8', score: 50, pass: false };
  if (val >= 3.20 && val <= 3.40) {
    return { id: 'OPTIMAL', label: 'Stable 3.3V Rail (3.20 - 3.40 V)', color: '#10b981', score: 100, pass: true };
  }
  if (val >= 3.10 && val <= 3.50) {
    return { id: 'ACCEPTABLE', label: 'Acceptable Rail (3.10 - 3.50 V)', color: '#3b82f6', score: 85, pass: true };
  }
  if (val < 3.10) {
    return { id: 'UNDERVOLTAGE', label: 'Undervoltage (< 3.10 V - Check Adapter)', color: '#ef4444', score: 30, pass: false };
  }
  return { id: 'OVERVOLTAGE', label: 'Overvoltage (> 3.50 V)', color: '#dc2626', score: 30, pass: false };
}

/**
 * Performs holistic composite health diagnosis across all 5 telemetry metrics.
 * @param {Object} metrics - { rxPowerDbm, txPowerDbm, laserBiasMa, temperatureC, supplyVoltageV }
 * @returns {Object} Complete diagnosis, health score, root cause, and recommendations.
 */
export function diagnoseOntHealth(metrics = {}) {
  const rx = evaluateOntRxPower(metrics.rxPowerDbm);
  const tx = evaluateOntTxPower(metrics.txPowerDbm);
  const bias = evaluateOntLaserBias(metrics.laserBiasMa);
  const temp = evaluateOntTemperature(metrics.temperatureC);
  const volt = evaluateOntVoltage(metrics.supplyVoltageV);

  // Weighted health score calculation
  const compositeScore = Math.round(
    rx.score * 0.35 +
    bias.score * 0.25 +
    tx.score * 0.15 +
    temp.score * 0.15 +
    volt.score * 0.10
  );

  const faults = [];
  if (!rx.pass) faults.push(rx.label);
  if (!bias.pass) faults.push(bias.label);
  if (!tx.pass) faults.push(tx.label);
  if (!temp.pass) faults.push(temp.label);
  if (!volt.pass) faults.push(volt.label);

  let diagnosisCategory = 'HEALTHY_NORMAL';
  let primaryFault = 'None (All Parameters Within Normal Specification)';
  let recommendation = 'No action needed. Optical transceiver and power regulation are functioning in prime condition.';

  if (faults.length >= 2) {
    diagnosisCategory = 'MULTIPLE_FAULTS';
    primaryFault = `Multiple Active Telemetry Faults (${faults.length} issues)`;
    recommendation = 'Check power adapter stability first, clean fiber patch cord connector, and verify outdoor drop cable strain.';
  } else if (!rx.pass) {
    diagnosisCategory = 'WEAK_RX_SIGNAL';
    primaryFault = rx.label;
    recommendation = 'Inspect drop cable for macrobends or tight ties; clean optical connector ferrule with alcohol wipe; check FAT port.';
  } else if (!bias.pass) {
    diagnosisCategory = 'LASER_AGING_BURNOUT';
    primaryFault = bias.label;
    recommendation = 'ONU laser diode is aging and consuming high current. Plan proactive ONT replacement before complete link shutdown.';
  } else if (!temp.pass) {
    diagnosisCategory = 'THERMAL_THROTTLING';
    primaryFault = temp.label;
    recommendation = 'Relocate ONT away from direct sunlight/enclosed cabinets. Ensure clear airflow around device vents.';
  } else if (!volt.pass) {
    diagnosisCategory = 'POWER_SUPPLY_FAULT';
    primaryFault = volt.label;
    recommendation = 'Replace the 12V 1.0A DC power adapter. Low voltage causes frequent reboots and packet loss during traffic bursts.';
  }

  let statusBadgeClass = 'badge-success';
  let statusGrade = 'EXCELLENT';
  if (compositeScore < 50) {
    statusBadgeClass = 'badge-danger';
    statusGrade = 'CRITICAL FAULT';
  } else if (compositeScore < 75) {
    statusBadgeClass = 'badge-warning';
    statusGrade = 'ATTENTION REQUIRED';
  } else if (compositeScore < 90) {
    statusBadgeClass = 'badge-acceptable';
    statusGrade = 'GOOD / NOMINAL';
  }

  return {
    compositeScore,
    statusGrade,
    statusBadgeClass,
    diagnosisCategory,
    primaryFault,
    recommendation,
    faultCount: faults.length,
    faults,
    details: { rx, tx, bias, temp, volt }
  };
}

/**
 * Retrieves the ONT diagnostics logs store from device localStorage.
 * @param {Storage} [storage=localStorage]
 * @returns {Array} Array of diagnostic log entries.
 */
export function getOntDiagnosticsStore(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(ONT_DIAGNOSTICS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

/**
 * Saves ONT diagnostics logs array to device localStorage.
 * @param {Array} logs
 * @param {Storage} [storage=localStorage]
 * @returns {boolean}
 */
export function saveOntDiagnosticsStore(logs, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !Array.isArray(logs)) return false;
  try {
    storage.setItem(ONT_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(logs));
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Records a new diagnostic entry to device localStorage.
 * @param {Object} logData
 * @param {Storage} [storage=localStorage]
 * @returns {Object} Saved log entry.
 */
export function recordOntDiagnosticLog(logData, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const logs = getOntDiagnosticsStore(storage);
  const entry = {
    id: `ONT-DIAG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    customerName: String(logData.customerName || 'Shahdara Subscriber').trim(),
    ontModel: String(logData.ontModel || 'Huawei EchoLife HG8245H'),
    serialNumber: String(logData.serialNumber || 'HWTC-12345678').trim(),
    rxPowerDbm: Number(logData.rxPowerDbm) || 0,
    txPowerDbm: Number(logData.txPowerDbm) || 0,
    laserBiasMa: Number(logData.laserBiasMa) || 0,
    temperatureC: Number(logData.temperatureC) || 0,
    supplyVoltageV: Number(logData.supplyVoltageV) || 0,
    compositeScore: Number(logData.compositeScore) || 0,
    statusGrade: String(logData.statusGrade || 'GOOD'),
    diagnosisCategory: String(logData.diagnosisCategory || 'HEALTHY_NORMAL'),
    primaryFault: String(logData.primaryFault || 'None')
  };

  logs.unshift(entry);
  if (logs.length > 50) logs.pop();
  saveOntDiagnosticsStore(logs, storage);
  return entry;
}

/**
 * Clears all ONT diagnostic logs from storage.
 * @param {Storage} [storage=localStorage]
 * @returns {boolean}
 */
export function clearOntDiagnosticsStore(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return false;
  try {
    storage.removeItem(ONT_DIAGNOSTICS_STORAGE_KEY);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Generates an interactive SVG visualizer of a GPON ONU / ONT terminal with glowing LEDs and gauge HUD.
 * @param {Object} metrics - Telemetry data and evaluation
 * @returns {string} SVG markup string.
 */
export function renderMobileOntDiagnosticsSvg(metrics = {}) {
  const diag = diagnoseOntHealth(metrics);
  const rxVal = Number(metrics.rxPowerDbm) || -18.5;
  const txVal = Number(metrics.txPowerDbm) || 2.4;
  const biasVal = Number(metrics.laserBiasMa) || 14.5;
  const tempVal = Number(metrics.temperatureC) || 38.0;
  const voltVal = Number(metrics.supplyVoltageV) || 3.3;

  // Gauge computations: angles from -120 to +120 deg
  function computeGaugeAngle(val, min, max) {
    const clamped = Math.max(min, Math.min(max, val));
    const ratio = (clamped - min) / (max - min);
    return -120 + ratio * 240;
  }

  const rxAngle = computeGaugeAngle(rxVal, -35, -5);
  const txAngle = computeGaugeAngle(txVal, 0, 6);
  const biasAngle = computeGaugeAngle(biasVal, 5, 55);
  const tempAngle = computeGaugeAngle(tempVal, 10, 80);

  // LED states
  const hasLos = rxVal <= -28.5;
  const ponColor = hasLos ? '#ef4444' : '#10b981';
  const losColor = hasLos ? '#ef4444' : '#334155';
  const scoreColor = diag.compositeScore >= 80 ? '#10b981' : (diag.compositeScore >= 60 ? '#f59e0b' : '#ef4444');

  return `
    <svg viewBox="0 0 720 360" class="ont-diag-svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GPON ONT Optical Diagnostics HUD">
      <defs>
        <linearGradient id="ontCaseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#1e293b" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
        <linearGradient id="lcdGlassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#090d16" />
          <stop offset="100%" stop-color="#111827" />
        </linearGradient>
      </defs>

      <!-- ONT Hardware Casing Shell -->
      <rect x="20" y="15" width="680" height="330" rx="18" fill="url(#ontCaseGrad)" stroke="#334155" stroke-width="2.5" />
      
      <!-- Top Bevel & Vent Slots -->
      <line x1="40" y1="28" x2="680" y2="28" stroke="#475569" stroke-width="1.5" />
      <line x1="280" y1="38" x2="330" y2="38" stroke="#334155" stroke-width="2" stroke-linecap="round" />
      <line x1="340" y1="38" x2="390" y2="38" stroke="#334155" stroke-width="2" stroke-linecap="round" />
      <line x1="400" y1="38" x2="450" y2="38" stroke="#334155" stroke-width="2" stroke-linecap="round" />

      <!-- Top LED Status Bar -->
      <g class="ont-led-group">
        <!-- Power LED -->
        <circle cx="55" cy="50" r="4.5" fill="#10b981" />
        <text x="55" y="66" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">POWER</text>

        <!-- PON LED -->
        <circle cx="95" cy="50" r="4.5" fill="${ponColor}" />
        <text x="95" y="66" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">PON</text>

        <!-- LOS LED -->
        <circle cx="135" cy="50" r="4.5" fill="${losColor}" />
        <text x="135" y="66" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">LOS</text>

        <!-- LAN1-4 LEDs -->
        <circle cx="175" cy="50" r="4" fill="#10b981" />
        <text x="175" y="66" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">LAN</text>

        <!-- Wi-Fi LED -->
        <circle cx="215" cy="50" r="4" fill="#10b981" />
        <text x="215" y="66" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">WLAN</text>
      </g>

      <!-- Model & Health Ribbon (Top Right) -->
      <g class="ont-header-meta">
        <text x="670" y="48" fill="#f8fafc" font-size="11" font-weight="700" text-anchor="end" font-family="system-ui, sans-serif">GPON OPTICAL BOSA MONITOR</text>
        <rect x="540" y="58" width="130" height="20" rx="4" fill="#1e293b" stroke="${scoreColor}" stroke-width="1" />
        <text x="605" y="72" fill="${scoreColor}" font-size="9.5" font-weight="700" text-anchor="middle" font-family="monospace">SCORE: ${diag.compositeScore}% (${diag.statusGrade})</text>
      </g>

      <!-- Digital Diagnostic LCD Panel Screen -->
      <rect x="40" y="86" width="640" height="236" rx="12" fill="url(#lcdGlassGrad)" stroke="#1e293b" stroke-width="2" />
      
      <!-- Diagnostic Heading HUD -->
      <rect x="52" y="96" width="616" height="30" rx="6" fill="#0f172a" />
      <text x="64" y="115" fill="#38bdf8" font-size="10.5" font-weight="700" font-family="monospace">STATUS: ${diag.diagnosisCategory}</text>
      <text x="656" y="115" fill="#94a3b8" font-size="10" text-anchor="end" font-family="monospace">Vcc: ${voltVal.toFixed(2)}V (${diag.details.volt.id})</text>

      <!-- 4 Circular Telemetry Dial Gauges -->
      <!-- Gauge 1: Rx Optical Power (dBm) -->
      <g transform="translate(120, 195)">
        <circle cx="0" cy="0" r="48" fill="#0b1322" stroke="#1e293b" stroke-width="2" />
        <path d="M -34,20 A 40 40 0 1 1 34,20" fill="none" stroke="#334155" stroke-width="6" stroke-linecap="round" />
        <!-- Pointer Needle -->
        <g transform="rotate(${rxAngle})">
          <line x1="0" y1="0" x2="0" y2="-36" stroke="${diag.details.rx.color}" stroke-width="3" stroke-linecap="round" />
          <circle cx="0" cy="0" r="4" fill="${diag.details.rx.color}" />
        </g>
        <text x="0" y="24" fill="#f8fafc" font-size="11.5" font-weight="700" text-anchor="middle" font-family="monospace">${rxVal.toFixed(1)} dBm</text>
        <text x="0" y="38" fill="#94a3b8" font-size="8.5" font-weight="600" text-anchor="middle" font-family="system-ui, sans-serif">Rx 1490nm</text>
      </g>

      <!-- Gauge 2: Tx Optical Power (dBm) -->
      <g transform="translate(265, 195)">
        <circle cx="0" cy="0" r="48" fill="#0b1322" stroke="#1e293b" stroke-width="2" />
        <path d="M -34,20 A 40 40 0 1 1 34,20" fill="none" stroke="#334155" stroke-width="6" stroke-linecap="round" />
        <!-- Pointer Needle -->
        <g transform="rotate(${txAngle})">
          <line x1="0" y1="0" x2="0" y2="-36" stroke="${diag.details.tx.color}" stroke-width="3" stroke-linecap="round" />
          <circle cx="0" cy="0" r="4" fill="${diag.details.tx.color}" />
        </g>
        <text x="0" y="24" fill="#f8fafc" font-size="11.5" font-weight="700" text-anchor="middle" font-family="monospace">${txVal.toFixed(1)} dBm</text>
        <text x="0" y="38" fill="#94a3b8" font-size="8.5" font-weight="600" text-anchor="middle" font-family="system-ui, sans-serif">Tx 1310nm</text>
      </g>

      <!-- Gauge 3: Laser Bias Current (mA) -->
      <g transform="translate(410, 195)">
        <circle cx="0" cy="0" r="48" fill="#0b1322" stroke="#1e293b" stroke-width="2" />
        <path d="M -34,20 A 40 40 0 1 1 34,20" fill="none" stroke="#334155" stroke-width="6" stroke-linecap="round" />
        <!-- Pointer Needle -->
        <g transform="rotate(${biasAngle})">
          <line x1="0" y1="0" x2="0" y2="-36" stroke="${diag.details.bias.color}" stroke-width="3" stroke-linecap="round" />
          <circle cx="0" cy="0" r="4" fill="${diag.details.bias.color}" />
        </g>
        <text x="0" y="24" fill="#f8fafc" font-size="11.5" font-weight="700" text-anchor="middle" font-family="monospace">${biasVal.toFixed(1)} mA</text>
        <text x="0" y="38" fill="#94a3b8" font-size="8.5" font-weight="600" text-anchor="middle" font-family="system-ui, sans-serif">Laser Bias</text>
      </g>

      <!-- Gauge 4: Transceiver Temperature (°C) -->
      <g transform="translate(555, 195)">
        <circle cx="0" cy="0" r="48" fill="#0b1322" stroke="#1e293b" stroke-width="2" />
        <path d="M -34,20 A 40 40 0 1 1 34,20" fill="none" stroke="#334155" stroke-width="6" stroke-linecap="round" />
        <!-- Pointer Needle -->
        <g transform="rotate(${tempAngle})">
          <line x1="0" y1="0" x2="0" y2="-36" stroke="${diag.details.temp.color}" stroke-width="3" stroke-linecap="round" />
          <circle cx="0" cy="0" r="4" fill="${diag.details.temp.color}" />
        </g>
        <text x="0" y="24" fill="#f8fafc" font-size="11.5" font-weight="700" text-anchor="middle" font-family="monospace">${tempVal.toFixed(1)} °C</text>
        <text x="0" y="38" fill="#94a3b8" font-size="8.5" font-weight="600" text-anchor="middle" font-family="system-ui, sans-serif">Temp</text>
      </g>

      <!-- Bottom Diagnosis Banner -->
      <rect x="52" y="260" width="616" height="50" rx="6" fill="#0f172a" stroke="#1e293b" stroke-width="1" />
      <text x="64" y="278" fill="#f8fafc" font-size="9.5" font-weight="700" font-family="system-ui, sans-serif">ROOT CAUSE: <tspan fill="#cbd5e1" font-weight="500">${diag.primaryFault}</tspan></text>
      <text x="64" y="296" fill="#38bdf8" font-size="9" font-family="system-ui, sans-serif">FIELD ACTION: <tspan fill="#94a3b8">${diag.recommendation}</tspan></text>
    </svg>
  `;
}

/**
 * Generates formatted WhatsApp lineman dispatch report for ONT diagnostics.
 * @param {Object} metrics - Diagnostic metrics.
 * @param {Object} [meta={}] - Optional metadata (customerName, serialNumber).
 * @returns {string} Text dispatch report.
 */
export function generateOntDiagnosticsWhatsAppReport(metrics, meta = {}) {
  const diag = diagnoseOntHealth(metrics);
  const custName = meta.customerName || 'Shahdara Subscriber';
  const ontModel = meta.ontModel || 'Huawei HG8245H';
  const serial = meta.serialNumber || 'HWTC-12345678';

  const lines = [
    `*⚡ SHAHDARA FIBER NET - ONT BOSA DIAGNOSTICS REPORT*`,
    `----------------------------------------`,
    `*Customer:* ${custName}`,
    `*ONT Device:* ${ontModel} (S/N: ${serial})`,
    `*Diagnostic Health Score:* ${diag.compositeScore}% [${diag.statusGrade}]`,
    `*Status Diagnosis:* ${diag.diagnosisCategory}`,
    `----------------------------------------`,
    `*TELEMETRY METRICS (SFF-8472 DOM):*`,
    `*Rx Optical Power (1490nm):* ${Number(metrics.rxPowerDbm).toFixed(1)} dBm [${diag.details.rx.label}]`,
    `*Tx Optical Power (1310nm):* ${Number(metrics.txPowerDbm).toFixed(1)} dBm [${diag.details.tx.label}]`,
    `*Laser Bias Current:* ${Number(metrics.laserBiasMa).toFixed(1)} mA [${diag.details.bias.label}]`,
    `*Transceiver Temperature:* ${Number(metrics.temperatureC).toFixed(1)} °C [${diag.details.temp.label}]`,
    `*Operating Voltage:* ${Number(metrics.supplyVoltageV).toFixed(2)} V [${diag.details.volt.label}]`,
    `----------------------------------------`,
    `*PRIMARY FAULT IDENTIFIED:*`,
    `*${diag.primaryFault}*`,
    `----------------------------------------`,
    `*LINEMAN FIELD ACTION:*`,
    `👉 ${diag.recommendation}`,
    `_Generated by Shahdara Mobile Tech Assistant • ${new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}_`
  ];

  return lines.join('\n');
}

/**
 * Sets up the mobile ONT Diagnostics modal dialog, preset buttons, controls, and event listeners.
 * @param {Object} options
 * @param {Storage} [options.storage] - LocalStorage instance
 * @param {Function} [options.onToast] - Toast notification callback
 * @returns {Object} Controller with updateView, applyPreset, and getHistory methods.
 */
export function setupMobileOntDiagnosticsModal({ storage = (typeof localStorage !== 'undefined' ? localStorage : null), onToast } = {}) {
  if (typeof document === 'undefined') return { updateView: () => {}, applyPreset: () => {} };

  const modal = document.getElementById('mobileOntDiagnosticsModal');
  const closeBtn = document.getElementById('mobileOntDiagnosticsCloseBtn');
  const presetSelect = document.getElementById('ontDiagPresetSelect');
  const svgContainer = document.getElementById('ontDiagSvgContainer');
  const historyList = document.getElementById('ontDiagHistoryList');

  // Input Fields
  const custNameInput = document.getElementById('ontDiagCustName');
  const ontModelSelect = document.getElementById('ontDiagModelSelect');
  const ontSerialInput = document.getElementById('ontDiagSerialInput');
  const rxPowerInput = document.getElementById('ontDiagRxPower');
  const txPowerInput = document.getElementById('ontDiagTxPower');
  const laserBiasInput = document.getElementById('ontDiagLaserBias');
  const tempInput = document.getElementById('ontDiagTemp');
  const voltInput = document.getElementById('ontDiagVoltage');

  // Action Buttons
  const saveRecordBtn = document.getElementById('ontDiagSaveBtn');
  const whatsappBtn = document.getElementById('ontDiagWhatsappBtn');
  const clearHistoryBtn = document.getElementById('ontDiagClearHistoryBtn');

  // Multi-surface modal open triggers
  const triggers = document.querySelectorAll('[data-open-ont-diagnostics]');

  function getFormValues() {
    return {
      customerName: custNameInput ? custNameInput.value : '',
      ontModel: ontModelSelect ? ontModelSelect.value : '',
      serialNumber: ontSerialInput ? ontSerialInput.value : '',
      rxPowerDbm: rxPowerInput ? Number(rxPowerInput.value) : -18.5,
      txPowerDbm: txPowerInput ? Number(txPowerInput.value) : 2.4,
      laserBiasMa: laserBiasInput ? Number(laserBiasInput.value) : 14.5,
      temperatureC: tempInput ? Number(tempInput.value) : 38.0,
      supplyVoltageV: voltInput ? Number(voltInput.value) : 3.31
    };
  }

  function applyPreset(presetId) {
    const preset = ONT_PRESETS.find(p => p.id === presetId) || ONT_PRESETS[0];
    if (rxPowerInput) rxPowerInput.value = preset.rxPowerDbm;
    if (txPowerInput) txPowerInput.value = preset.txPowerDbm;
    if (laserBiasInput) laserBiasInput.value = preset.laserBiasMa;
    if (tempInput) tempInput.value = preset.temperatureC;
    if (voltInput) voltInput.value = preset.supplyVoltageV;
    updateView();
  }

  function renderHistory() {
    if (!historyList) return;
    const logs = getOntDiagnosticsStore(storage);
    historyList.innerHTML = '';
    if (logs.length === 0) {
      historyList.innerHTML = '<li class="ont-history-empty" style="padding:10px;color:var(--text-muted,#64748b);font-size:12px">No recent ONT diagnostics logs saved.</li>';
      return;
    }
    logs.slice(0, 10).forEach(log => {
      const li = document.createElement('li');
      li.className = 'ont-history-card';
      const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      li.innerHTML = `
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
          <div>
            <strong>${log.customerName}</strong> (${log.ontModel})
            <div style="font-size:11px;color:var(--text-muted,#64748b)">${log.serialNumber} • ${timeStr}</div>
          </div>
          <div style="text-align:right">
            <span class="count-badge" style="background:#1e293b;color:#38bdf8">${log.compositeScore}%</span>
            <div style="font-size:11px;font-weight:600">${log.rxPowerDbm} dBm / ${log.laserBiasMa} mA</div>
          </div>
        </div>
      `;
      historyList.appendChild(li);
    });
  }

  function updateView() {
    if (!svgContainer) return;
    const vals = getFormValues();
    svgContainer.innerHTML = renderMobileOntDiagnosticsSvg(vals);
  }

  // Bind input change events for live SVG update
  [rxPowerInput, txPowerInput, laserBiasInput, tempInput, voltInput].forEach(inp => {
    if (inp) inp.addEventListener('input', updateView);
  });

  if (presetSelect) {
    presetSelect.addEventListener('change', (e) => {
      applyPreset(e.target.value);
      if (typeof onToast === 'function') onToast('Telemetry preset loaded.');
    });
  }

  if (saveRecordBtn) {
    saveRecordBtn.addEventListener('click', () => {
      const vals = getFormValues();
      const diag = diagnoseOntHealth(vals);
      recordOntDiagnosticLog({
        ...vals,
        compositeScore: diag.compositeScore,
        statusGrade: diag.statusGrade,
        diagnosisCategory: diag.diagnosisCategory,
        primaryFault: diag.primaryFault
      }, storage);
      renderHistory();
      if (typeof onToast === 'function') onToast('ONT diagnostic log saved to device.');
    });
  }

  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
      const vals = getFormValues();
      const text = generateOntDiagnosticsWhatsAppReport(vals, {
        customerName: vals.customerName,
        ontModel: vals.ontModel,
        serialNumber: vals.serialNumber
      });
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
      if (typeof onToast === 'function') onToast('WhatsApp ONT report opened.');
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      clearOntDiagnosticsStore(storage);
      renderHistory();
      if (typeof onToast === 'function') onToast('Saved ONT diagnostic logs cleared.');
    });
  }

  // Multi-surface modal open triggers
  triggers.forEach(btn => {
    btn.addEventListener('click', () => {
      updateView();
      renderHistory();
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
      }
    });
  });

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    });
  }

  // Initial render
  updateView();
  renderHistory();

  return {
    updateView,
    applyPreset,
    getHistory: () => getOntDiagnosticsStore(storage)
  };
}
