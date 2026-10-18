/**
 * Shahdara ISP - Field Optical Continuous Power Logging & Fiber Flap / Intermittent Drop-Out Detector Assistant
 *
 * Provides FTTH field technicians, NOC monitors, and fiber maintenance teams with:
 * - Continuous optical power telemetry logging over time (sampling interval 0.5s - 10s)
 * - Average optical power, peak-to-peak flutter/ripple (dB), and standard deviation (sigma stability index)
 * - Automated fiber flapping detection: flags rapid transients (>= 1.5 dB delta) and receiver sensitivity dropouts (e.g. < -27 dBm)
 * - Diagnostic categorization: STABLE (solid core), MARGINAL (wind/catenary flutter or micro-bend), CRITICAL (flapping/loose bulkhead)
 * - Pure-vector SVG rolling strip-chart oscillogram with sensitivity threshold lines and flapping event markers
 * - LocalStorage persistence (shahdara_power_logger_audits_v1), bilingual WhatsApp dispatch, and RFC-4180 CSV export
 */

export const POWER_LOGGER_STORAGE_KEY = 'shahdara_power_logger_audits_v1';

export const POWER_LOGGER_PRESETS = [
  {
    id: 'shahdara-town-stable-gpon',
    name: 'Shahdara Town Class B+ Stable FTTH Link (-19.2 dBm, 0.15 dB Ripple)',
    area: 'Shahdara Town',
    wavelengthNm: 1490,
    samplingIntervalSec: 1.0,
    receiverSensitivityDbm: -27.0,
    samplesDbm: [
      -19.2, -19.1, -19.3, -19.2, -19.2, -19.1, -19.3, -19.2,
      -19.2, -19.1, -19.2, -19.3, -19.2, -19.2, -19.1, -19.2
    ],
    technician: 'Noman Tariq (NOC Monitor)',
    notes: 'Stable Class B+ downstream 1490nm signal at customer ONT in Shahdara Town.'
  },
  {
    id: 'ravi-road-wind-catenary-flutter',
    name: 'Ravi Road Aerial Pole Catenary Wind Flutter (-20.5 dBm avg, 0.85 dB Ripple)',
    area: 'Ravi Road',
    wavelengthNm: 1310,
    samplingIntervalSec: 0.5,
    receiverSensitivityDbm: -27.0,
    samplesDbm: [
      -20.1, -20.3, -20.8, -20.9, -20.4, -20.2, -20.7, -20.9,
      -20.5, -20.2, -20.6, -20.9, -20.3, -20.1, -20.7, -20.4
    ],
    technician: 'Sajjad Malik',
    notes: 'Wind storm causing overhead aerial drop cable to sway and produce micro-bending ripple.'
  },
  {
    id: 'begum-kot-loose-bulkhead-flapping',
    name: 'Begum Kot Loose Mechanical Bulkhead Flapping (-18.0 to -28.5 dBm Spikes)',
    area: 'Begum Kot',
    wavelengthNm: 1490,
    samplingIntervalSec: 1.0,
    receiverSensitivityDbm: -27.0,
    samplesDbm: [
      -18.2, -18.4, -28.2, -28.5, -18.5, -18.3, -27.8, -18.2,
      -18.4, -29.0, -18.6, -18.3, -28.1, -18.2, -18.5, -18.4
    ],
    technician: 'Arshad Ali (Field Lead)',
    notes: 'Severe optical flapping. Vibrations from adjacent industrial compressor dislodge loose LC ferrule.'
  },
  {
    id: 'wandala-road-truck-vibration-drift',
    name: 'Wandala Road Heavy Truck Vibration Mechanical Drift (-22.4 dBm avg, 1.6 dB Jitter)',
    area: 'Wandala Road',
    wavelengthNm: 1550,
    samplingIntervalSec: 1.0,
    receiverSensitivityDbm: -28.0,
    samplesDbm: [
      -22.1, -22.3, -22.9, -23.5, -23.7, -22.8, -22.2, -22.0,
      -22.5, -23.4, -23.6, -22.9, -22.3, -22.1, -22.6, -22.4
    ],
    technician: 'Rashid Mahmood',
    notes: 'Heavy traffic on GT Road shaking distribution box and causing optical attenuation ripple.'
  },
  {
    id: 'saeed-park-catastrophic-dropouts',
    name: 'Saeed Park Severe Drop Cable Pinch Flapping (Constant Dropouts < -30 dBm)',
    area: 'Saeed Park',
    wavelengthNm: 1490,
    samplingIntervalSec: 1.0,
    receiverSensitivityDbm: -27.0,
    samplesDbm: [
      -19.5, -20.2, -32.5, -34.0, -35.2, -21.0, -33.8, -35.0,
      -20.1, -33.5, -34.8, -35.0, -20.4, -33.1, -34.5, -35.2
    ],
    technician: 'Imran Ashraf',
    notes: 'Drop cable pinched in window frame. Signal drops out completely with customer movement.'
  }
];

/**
 * Calculates continuous optical power stability metrics, ripple, sigma, and flapping events.
 */
export function calculatePowerLoggerMetrics({
  samplesDbm = [],
  samplingIntervalSec = 1.0,
  receiverSensitivityDbm = -27.0
} = {}) {
  const interval = Math.max(0.1, Number(samplingIntervalSec) || 1.0);
  const sensitivity = Number.isFinite(Number(receiverSensitivityDbm)) ? Number(receiverSensitivityDbm) : -27.0;

  if (!Array.isArray(samplesDbm) || samplesDbm.length === 0) {
    return {
      sampleCount: 0,
      durationSec: 0,
      samplingIntervalSec: interval,
      receiverSensitivityDbm: sensitivity,
      avgPowerDbm: -99,
      minPowerDbm: -99,
      maxPowerDbm: -99,
      powerRippleDb: 0,
      stdDevDb: 0,
      flappingEventsCount: 0,
      dropoutsCount: 0,
      status: 'FAIL',
      statusClass: 'status-fail',
      statusLabel: 'No Telemetry Data',
      flappingIndices: [],
      dropoutIndices: [],
      processedSamples: []
    };
  }

  const validSamples = samplesDbm.map(s => Number(s)).filter(s => Number.isFinite(s));
  const sampleCount = validSamples.length;
  const durationSec = Math.round((sampleCount - 1) * interval * 10) / 10;

  let sum = 0;
  let minP = 999;
  let maxP = -999;
  validSamples.forEach(p => {
    sum += p;
    if (p < minP) minP = p;
    if (p > maxP) maxP = p;
  });

  const avgPowerDbm = Math.round((sum / sampleCount) * 100) / 100;
  const minPowerDbm = Math.round(minP * 100) / 100;
  const maxPowerDbm = Math.round(maxP * 100) / 100;
  const powerRippleDb = Math.round((maxPowerDbm - minPowerDbm) * 100) / 100;

  // Standard deviation (sigma)
  let varSum = 0;
  validSamples.forEach(p => {
    varSum += Math.pow(p - avgPowerDbm, 2);
  });
  const stdDevDb = Math.round(Math.sqrt(varSum / sampleCount) * 100) / 100;

  // Flapping detection: delta >= 1.5 dB between adjacent points
  const flappingIndices = [];
  const dropoutIndices = [];
  const processedSamples = [];

  for (let i = 0; i < sampleCount; i++) {
    const cur = validSamples[i];
    let isFlap = false;
    let isDropout = cur < sensitivity;

    if (isDropout) {
      dropoutIndices.push(i);
    }

    if (i > 0) {
      const prev = validSamples[i - 1];
      const delta = Math.abs(cur - prev);
      if (delta >= 1.5) {
        isFlap = true;
        flappingIndices.push(i);
      }
    }

    processedSamples.push({
      index: i,
      timeSec: Math.round(i * interval * 10) / 10,
      powerDbm: cur,
      isFlap,
      isDropout
    });
  }

  const flappingEventsCount = flappingIndices.length;
  const dropoutsCount = dropoutIndices.length;

  let status = 'PASS';
  let statusClass = 'status-pass';
  let statusLabel = 'STABLE: High Quality Optical Core';

  if (flappingEventsCount > 2 || dropoutsCount > 0 || powerRippleDb >= 2.0) {
    status = 'FAIL';
    statusClass = 'status-fail';
    statusLabel = 'CRITICAL: Severe Optical Flapping / Dropouts';
  } else if (flappingEventsCount > 0 || powerRippleDb > 0.40 || stdDevDb > 0.15) {
    status = 'WARNING';
    statusClass = 'status-warning';
    statusLabel = 'MARGINAL: Optical Flutter / Micro-Bending';
  }

  return {
    sampleCount,
    durationSec,
    samplingIntervalSec: interval,
    receiverSensitivityDbm: sensitivity,
    avgPowerDbm,
    minPowerDbm,
    maxPowerDbm,
    powerRippleDb,
    stdDevDb,
    flappingEventsCount,
    dropoutsCount,
    flappingIndices,
    dropoutIndices,
    status,
    statusClass,
    statusLabel,
    processedSamples
  };
}

/**
 * Generates pure-vector SVG oscilloscope strip-chart of optical power over time.
 */
export function renderPowerLoggerSvg(metrics, { width = 720, height = 280 } = {}) {
  if (!metrics || !Array.isArray(metrics.processedSamples) || metrics.processedSamples.length === 0) {
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="No Power Logger Data">
      <rect width="${width}" height="${height}" fill="#0f172a" rx="8"/>
      <text x="${width / 2}" y="${height / 2}" fill="#94a3b8" text-anchor="middle" font-size="14" font-family="sans-serif">No Telemetry Samples Available</text>
    </svg>`;
  }

  const samples = metrics.processedSamples;
  const margin = { top: 40, right: 30, bottom: 45, left: 60 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;

  // Power scale: Y-axis bounded around min/max power with padding
  const pMin = Math.min(metrics.receiverSensitivityDbm - 3, Math.floor(metrics.minPowerDbm - 2));
  const pMax = Math.max(0, Math.ceil(metrics.maxPowerDbm + 2));
  const yScale = p => margin.top + chartH - ((p - pMin) / (pMax - pMin)) * chartH;

  // Time scale
  const totalDuration = Math.max(1, metrics.durationSec);
  const xScale = t => margin.left + (t / totalDuration) * chartW;

  // Horizontal grid lines
  let gridLines = '';
  const step = Math.ceil((pMax - pMin) / 6);
  for (let p = Math.floor(pMin / 5) * 5; p <= pMax; p += (step > 5 ? 5 : 2)) {
    const y = yScale(p);
    if (y >= margin.top && y <= margin.top + chartH) {
      gridLines += `
        <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#334155" stroke-dasharray="2,3" stroke-width="1"/>
        <text x="${margin.left - 8}" y="${y + 4}" fill="#94a3b8" font-size="10" text-anchor="end" font-family="monospace">${p} dBm</text>
      `;
    }
  }

  // Receiver Sensitivity Limit Line
  const sensY = yScale(metrics.receiverSensitivityDbm);
  const sensLine = `
    <line x1="${margin.left}" y1="${sensY}" x2="${width - margin.right}" y2="${sensY}" stroke="#ef4444" stroke-dasharray="4,4" stroke-width="1.5"/>
    <text x="${width - margin.right - 5}" y="${sensY - 4}" fill="#ef4444" font-size="9" text-anchor="end" font-family="monospace">ONT Sensitivity Limit: ${metrics.receiverSensitivityDbm} dBm</text>
  `;

  // Average power line
  const avgY = yScale(metrics.avgPowerDbm);
  const avgLine = `
    <line x1="${margin.left}" y1="${avgY}" x2="${width - margin.right}" y2="${avgY}" stroke="#38bdf8" stroke-dasharray="3,3" stroke-width="1.5"/>
    <text x="${margin.left + 5}" y="${avgY - 4}" fill="#38bdf8" font-size="9" font-family="monospace">Avg: ${metrics.avgPowerDbm} dBm (σ = ${metrics.stdDevDb} dB)</text>
  `;

  // Plot polyline
  const points = samples.map(s => `${xScale(s.timeSec)},${yScale(s.powerDbm)}`).join(' ');
  const traceLine = `<polyline points="${points}" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linejoin="round"/>`;

  // Plot points & markers
  let dots = '';
  samples.forEach(s => {
    const x = xScale(s.timeSec);
    const y = yScale(s.powerDbm);
    let dotFill = '#22c55e';
    let r = 3.5;

    if (s.isDropout) {
      dotFill = '#ef4444';
      r = 5;
      dots += `
        <circle cx="${x}" cy="${y}" r="8" fill="#ef4444" opacity="0.3"/>
        <text x="${x}" y="${y + 16}" fill="#ef4444" font-size="8" font-weight="700" text-anchor="middle" font-family="sans-serif">DROP</text>
      `;
    } else if (s.isFlap) {
      dotFill = '#f59e0b';
      r = 5;
      dots += `
        <circle cx="${x}" cy="${y}" r="8" fill="#f59e0b" opacity="0.3"/>
        <text x="${x}" y="${y - 8}" fill="#f59e0b" font-size="8" font-weight="700" text-anchor="middle" font-family="sans-serif">FLAP</text>
      `;
    }

    dots += `<circle cx="${x}" cy="${y}" r="${r}" fill="${dotFill}" stroke="#0f172a" stroke-width="1.5"/>`;
  });

  const isCritical = metrics.status === 'FAIL';
  const isWarning = metrics.status === 'WARNING';
  const statusColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Optical Power Continuous Telemetry Oscillogram">
    <rect width="${width}" height="${height}" fill="#0f172a" rx="8"/>
    
    <!-- Title & Top Metrics -->
    <text x="${margin.left}" y="22" fill="#38bdf8" font-size="13" font-weight="700" font-family="sans-serif">Optical Power Meter Telemetry Oscillogram</text>
    <text x="${width - margin.right}" y="22" fill="${statusColor}" font-size="12" font-weight="700" text-anchor="end" font-family="sans-serif">Ripple: ${metrics.powerRippleDb} dB · ${metrics.flappingEventsCount} Flaps [${metrics.status}]</text>

    <!-- Chart Grid & Elements -->
    ${gridLines}
    ${sensLine}
    ${avgLine}
    ${traceLine}
    ${dots}

    <!-- Axis Baseline -->
    <line x1="${margin.left}" y1="${margin.top + chartH}" x2="${width - margin.right}" y2="${margin.top + chartH}" stroke="#64748b" stroke-width="1.5"/>
    <text x="${margin.left}" y="${height - 12}" fill="#94a3b8" font-size="10" font-family="sans-serif">0.0 s</text>
    <text x="${width - margin.right}" y="${height - 12}" fill="#94a3b8" font-size="10" text-anchor="end" font-family="sans-serif">${metrics.durationSec} s (${metrics.sampleCount} samples)</text>
  </svg>`;
}

/**
 * Formats bilingual WhatsApp field dispatch message (English / Urdu).
 */
export function formatPowerLoggerWhatsApp(record) {
  const m = record.metrics || {};
  const statusEmoji = m.status === 'PASS' ? '✅' : m.status === 'WARNING' ? '⚠️' : '🚨';

  return `📊 *SHAHDARA ISP - OPTICAL POWER LOG & FLAPPING REPORT* 📊
${statusEmoji} *Status / کیفیت:* ${m.statusLabel || m.status}
📍 *Area / علاقہ:* ${record.area || 'Shahdara Network'}
🎯 *Wavelength / ویولینتھ:* ${record.wavelengthNm || 1490} nm
⏱️ *Duration / وقت:* ${m.durationSec || 0}s (${m.sampleCount || 0} samples @ ${m.samplingIntervalSec || 1}s)
⚡ *Avg Power / اوسط پاور:* ${m.avgPowerDbm || 0} dBm (Min: ${m.minPowerDbm || 0} dBm, Max: ${m.maxPowerDbm || 0} dBm)
⚖️ *Peak-to-Peak Ripple:* ${m.powerRippleDb || 0} dB
📈 *Stability Sigma (σ):* ${m.stdDevDb || 0} dB
⚡ *Flapping Transients (>=1.5dB):* ${m.flappingEventsCount || 0} events
🚨 *Rx Sensitivity Dropouts (<${m.receiverSensitivityDbm}dBm):* ${m.dropoutsCount || 0} dropouts
👤 *Inspector / ٹیکنیشن:* ${record.technician || 'Shahdara Field Tech'}
📝 *Notes / تفصیالت:* ${record.notes || 'Routine continuous optical power stability inspection.'}
⏰ *Timestamp:* ${record.timestamp || new Date().toISOString()}`;
}

/**
 * Generates RFC-4180 CSV export with UTF-8 BOM.
 */
export function generatePowerLoggerCsv(records = []) {
  const headers = [
    'Audit ID',
    'Timestamp',
    'Area',
    'Wavelength (nm)',
    'Technician',
    'Sample Count',
    'Duration (s)',
    'Avg Power (dBm)',
    'Min Power (dBm)',
    'Max Power (dBm)',
    'Ripple (dB)',
    'Std Dev (dB)',
    'Flapping Events',
    'Dropouts',
    'Status',
    'Notes'
  ];

  const escapeField = str => {
    const val = str === null || str === undefined ? '' : String(str);
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const rows = records.map(r => {
    const m = r.metrics || {};
    return [
      r.id || '',
      r.timestamp || '',
      r.area || '',
      r.wavelengthNm || 1490,
      r.technician || '',
      m.sampleCount || 0,
      m.durationSec || 0,
      m.avgPowerDbm || '',
      m.minPowerDbm || '',
      m.maxPowerDbm || '',
      m.powerRippleDb || '',
      m.stdDevDb || '',
      m.flappingEventsCount || 0,
      m.dropoutsCount || 0,
      m.status || '',
      r.notes || ''
    ].map(escapeField).join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

export function loadPowerLoggerAuditLog(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(POWER_LOGGER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function savePowerLoggerAuditLog(records, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return;
  try {
    storage.setItem(POWER_LOGGER_STORAGE_KEY, JSON.stringify(records));
  } catch {}
}

export function clearPowerLoggerAuditLog(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return;
  try {
    storage.removeItem(POWER_LOGGER_STORAGE_KEY);
  } catch {}
}

/**
 * Controller to wire and manage Mobile Power Logger Assistant Modal dialog.
 */
export function setupMobilePowerLoggerModal(state, { storage = typeof localStorage !== 'undefined' ? localStorage : null, onToast = () => {} } = {}) {
  if (typeof document === 'undefined') return { open: () => {}, close: () => {} };

  const modal = document.getElementById('mobilePowerLoggerModal');
  const openBtn = document.getElementById('mobileMorePowerLoggerBtn');
  const closeBtn = document.getElementById('mobilePowerLoggerCloseBtn');
  const presetSelect = document.getElementById('powerLoggerPresetSelect');
  const wavelengthSelect = document.getElementById('powerLoggerWavelengthSelect');
  const intervalSelect = document.getElementById('powerLoggerIntervalSelect');
  const sensitivityInput = document.getElementById('powerLoggerSensitivityInput');
  const samplesInput = document.getElementById('powerLoggerSamplesInput');
  const areaSelect = document.getElementById('powerLoggerAreaSelect');
  const technicianInput = document.getElementById('powerLoggerTechnicianInput');
  const notesInput = document.getElementById('powerLoggerNotesInput');
  const svgContainer = document.getElementById('powerLoggerSvgContainer');
  const saveBtn = document.getElementById('powerLoggerSaveAuditBtn');
  const shareBtn = document.getElementById('powerLoggerShareWhatsAppBtn');
  const exportCsvBtn = document.getElementById('powerLoggerExportCsvBtn');
  const clearHistoryBtn = document.getElementById('powerLoggerClearHistoryBtn');
  const historyTbody = document.getElementById('powerLoggerHistoryTbody');

  // KPI elements
  const kpiStatus = document.getElementById('powerLoggerKpiStatus');
  const kpiAvgPower = document.getElementById('powerLoggerKpiAvgPower');
  const kpiRipple = document.getElementById('powerLoggerKpiRipple');
  const kpiStdDev = document.getElementById('powerLoggerKpiStdDev');
  const kpiFlaps = document.getElementById('powerLoggerKpiFlaps');

  function open() {
    if (modal) {
      if (modal.showModal) modal.showModal();
      else modal.setAttribute('open', '');
      renderHistory();
      if (presetSelect && presetSelect.value) {
        const p = POWER_LOGGER_PRESETS.find(x => x.id === presetSelect.value);
        if (p) applyPreset(p);
      } else {
        applyPreset(POWER_LOGGER_PRESETS[0]);
      }
    }
  }

  function close() {
    if (modal) {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    }
  }

  function applyPreset(preset) {
    if (!preset) return;
    if (wavelengthSelect) wavelengthSelect.value = preset.wavelengthNm;
    if (intervalSelect) intervalSelect.value = preset.samplingIntervalSec;
    if (sensitivityInput) sensitivityInput.value = preset.receiverSensitivityDbm;
    if (samplesInput) samplesInput.value = (preset.samplesDbm || []).join(', ');
    if (areaSelect) areaSelect.value = preset.area;
    if (technicianInput) technicianInput.value = preset.technician;
    if (notesInput) notesInput.value = preset.notes;

    recalculateAndRender();
  }

  function recalculateAndRender() {
    const samplingIntervalSec = parseFloat(intervalSelect?.value) || 1.0;
    const receiverSensitivityDbm = parseFloat(sensitivityInput?.value) || -27.0;
    const rawSamples = samplesInput?.value || '';
    const samplesDbm = rawSamples
      .split(/[\s,]+/)
      .map(s => parseFloat(s))
      .filter(n => Number.isFinite(n));

    const metrics = calculatePowerLoggerMetrics({
      samplesDbm,
      samplingIntervalSec,
      receiverSensitivityDbm
    });

    if (kpiStatus) {
      kpiStatus.textContent = metrics.statusLabel;
      kpiStatus.className = `audit-status-badge ${metrics.status === 'PASS' ? 'audit-pill-clean' : metrics.status === 'WARNING' ? 'audit-pill-review' : 'audit-pill-error'}`;
    }
    if (kpiAvgPower) kpiAvgPower.textContent = `${metrics.avgPowerDbm} dBm (Min: ${metrics.minPowerDbm} / Max: ${metrics.maxPowerDbm})`;
    if (kpiRipple) kpiRipple.textContent = `${metrics.powerRippleDb} dB (${metrics.sampleCount} pts)`;
    if (kpiStdDev) kpiStdDev.textContent = `${metrics.stdDevDb} dB`;
    if (kpiFlaps) {
      kpiFlaps.textContent = `${metrics.flappingEventsCount} Flaps / ${metrics.dropoutsCount} Drops`;
      kpiFlaps.style.color = (metrics.flappingEventsCount > 0 || metrics.dropoutsCount > 0) ? 'var(--red, #ef4444)' : 'inherit';
    }

    if (svgContainer) {
      svgContainer.innerHTML = renderPowerLoggerSvg(metrics, { width: 720, height: 280 });
    }

    return metrics;
  }

  function renderHistory() {
    if (!historyTbody) return;
    const history = loadPowerLoggerAuditLog(storage);
    historyTbody.innerHTML = '';
    if (!history.length) {
      historyTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:12px">No power telemetry audit records yet.</td></tr>';
      return;
    }
    history.slice(-10).reverse().forEach(rec => {
      const m = rec.metrics || {};
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family:monospace;font-size:11px">${(rec.timestamp || '').slice(0, 16).replace('T', ' ')}</td>
        <td>${rec.area || '-'}</td>
        <td>${rec.wavelengthNm || 1490} nm</td>
        <td><strong>${m.powerRippleDb || 0} dB</strong> (σ ${m.stdDevDb || 0})</td>
        <td>${m.flappingEventsCount || 0} flaps / ${m.dropoutsCount || 0} drops</td>
        <td><span class="audit-status-badge ${m.status === 'PASS' ? 'audit-pill-clean' : m.status === 'WARNING' ? 'audit-pill-review' : 'audit-pill-error'}">${m.status}</span></td>
      `;
      historyTbody.appendChild(tr);
    });
  }

  // Event handlers
  if (openBtn && !openBtn.dataset.wiredPowerLogger) {
    openBtn.dataset.wiredPowerLogger = 'true';
    openBtn.addEventListener('click', open);
  }
  if (closeBtn && !closeBtn.dataset.wiredPowerLogger) {
    closeBtn.dataset.wiredPowerLogger = 'true';
    closeBtn.addEventListener('click', close);
  }

  if (presetSelect && !presetSelect.dataset.wiredPowerLogger) {
    presetSelect.dataset.wiredPowerLogger = 'true';
    presetSelect.addEventListener('change', () => {
      const p = POWER_LOGGER_PRESETS.find(x => x.id === presetSelect.value);
      if (p) applyPreset(p);
    });
  }

  [wavelengthSelect, intervalSelect, sensitivityInput, samplesInput].forEach(el => {
    if (el && !el.dataset.wiredPowerLogger) {
      el.dataset.wiredPowerLogger = 'true';
      el.addEventListener('input', recalculateAndRender);
    }
  });

  if (saveBtn && !saveBtn.dataset.wiredPowerLogger) {
    saveBtn.dataset.wiredPowerLogger = 'true';
    saveBtn.addEventListener('click', () => {
      const metrics = recalculateAndRender();
      const record = {
        id: `PWR-${Date.now()}`,
        timestamp: new Date().toISOString(),
        area: areaSelect?.value || 'Shahdara Town',
        wavelengthNm: parseInt(wavelengthSelect?.value, 10) || 1490,
        technician: technicianInput?.value || 'Technician',
        notes: notesInput?.value || '',
        metrics
      };
      const history = loadPowerLoggerAuditLog(storage);
      history.push(record);
      savePowerLoggerAuditLog(history, storage);
      renderHistory();
      onToast('Power Telemetry audit saved successfully!');
    });
  }

  if (shareBtn && !shareBtn.dataset.wiredPowerLogger) {
    shareBtn.dataset.wiredPowerLogger = 'true';
    shareBtn.addEventListener('click', () => {
      const metrics = recalculateAndRender();
      const record = {
        area: areaSelect?.value || 'Shahdara Town',
        wavelengthNm: parseInt(wavelengthSelect?.value, 10) || 1490,
        technician: technicianInput?.value || 'Technician',
        notes: notesInput?.value || '',
        timestamp: new Date().toISOString(),
        metrics
      };
      const text = formatPowerLoggerWhatsApp(record);
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    });
  }

  if (exportCsvBtn && !exportCsvBtn.dataset.wiredPowerLogger) {
    exportCsvBtn.dataset.wiredPowerLogger = 'true';
    exportCsvBtn.addEventListener('click', () => {
      const history = loadPowerLoggerAuditLog(storage);
      if (!history.length) {
        onToast('No telemetry records to export.');
        return;
      }
      const csv = generatePowerLoggerCsv(history);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shahdara_power_logger_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast('Power telemetry CSV exported!');
    });
  }

  if (clearHistoryBtn && !clearHistoryBtn.dataset.wiredPowerLogger) {
    clearHistoryBtn.dataset.wiredPowerLogger = 'true';
    clearHistoryBtn.addEventListener('click', () => {
      clearPowerLoggerAuditLog(storage);
      renderHistory();
      onToast('Power telemetry history cleared.');
    });
  }

  return {
    open,
    close,
    applyPreset,
    recalculateAndRender
  };
}
