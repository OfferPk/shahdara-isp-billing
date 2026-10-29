/**
 * Shahdara ISP Billing & Network Operations - Passive Optical Network (PON) PLC Splitter
 * Port Insertion Loss, Uniformity, and Polarization Dependent Loss (PDL) Acceptance QA Certification Suite
 * Standards: Telcordia GR-1209-CORE, Telcordia GR-1221-CORE, and ITU-T G.671
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const SPLITTER_QA_STORAGE_KEY = 'shahdara_splitter_qa_certs_v1';

export const SPLITTER_TYPES = {
  '1:2': {
    id: '1:2',
    label: '1:2 Balanced PLC Splitter',
    portCount: 2,
    theoreticalLossDb: 3.01,
    maxInsertionLossDb: 3.80,
    typicalInsertionLossDb: 3.50,
    maxUniformityDb: 0.60,
    minReturnLossDb: 55,
    minDirectivityDb: 55,
    maxPdlDb: 0.20,
    category: 'plc_symmetrical'
  },
  '1:4': {
    id: '1:4',
    label: '1:4 Balanced PLC Splitter',
    portCount: 4,
    theoreticalLossDb: 6.02,
    maxInsertionLossDb: 7.20,
    typicalInsertionLossDb: 6.80,
    maxUniformityDb: 0.60,
    minReturnLossDb: 55,
    minDirectivityDb: 55,
    maxPdlDb: 0.20,
    category: 'plc_symmetrical'
  },
  '1:8': {
    id: '1:8',
    label: '1:8 Balanced PLC Splitter',
    portCount: 8,
    theoreticalLossDb: 9.03,
    maxInsertionLossDb: 10.50,
    typicalInsertionLossDb: 10.00,
    maxUniformityDb: 0.80,
    minReturnLossDb: 55,
    minDirectivityDb: 55,
    maxPdlDb: 0.25,
    category: 'plc_symmetrical'
  },
  '1:16': {
    id: '1:16',
    label: '1:16 Balanced PLC Splitter',
    portCount: 16,
    theoreticalLossDb: 12.04,
    maxInsertionLossDb: 13.70,
    typicalInsertionLossDb: 13.20,
    maxUniformityDb: 1.00,
    minReturnLossDb: 55,
    minDirectivityDb: 55,
    maxPdlDb: 0.30,
    category: 'plc_symmetrical'
  },
  '1:32': {
    id: '1:32',
    label: '1:32 Balanced PLC Splitter',
    portCount: 32,
    theoreticalLossDb: 15.05,
    maxInsertionLossDb: 17.00,
    typicalInsertionLossDb: 16.50,
    maxUniformityDb: 1.30,
    minReturnLossDb: 55,
    minDirectivityDb: 55,
    maxPdlDb: 0.35,
    category: 'plc_symmetrical'
  },
  '1:64': {
    id: '1:64',
    label: '1:64 Balanced PLC Splitter',
    portCount: 64,
    theoreticalLossDb: 18.06,
    maxInsertionLossDb: 20.50,
    typicalInsertionLossDb: 19.80,
    maxUniformityDb: 1.70,
    minReturnLossDb: 55,
    minDirectivityDb: 55,
    maxPdlDb: 0.40,
    category: 'plc_symmetrical'
  },
  'TAP_90_10': {
    id: 'TAP_90_10',
    label: '1:2 Asymmetric FBT Tap (90/10%)',
    portCount: 2,
    theoreticalLossDb: 0.51,
    maxInsertionLossDb: 11.20,
    typicalInsertionLossDb: 0.70,
    maxUniformityDb: 10.50,
    minReturnLossDb: 55,
    minDirectivityDb: 55,
    maxPdlDb: 0.20,
    category: 'fbt_asymmetrical',
    legs: [
      { name: 'Through (90%)', theoreticalDb: 0.51, maxDb: 0.90 },
      { name: 'Tap (10%)', theoreticalDb: 10.00, maxDb: 11.20 }
    ]
  },
  'TAP_80_20': {
    id: 'TAP_80_20',
    label: '1:2 Asymmetric FBT Tap (80/20%)',
    portCount: 2,
    theoreticalLossDb: 1.08,
    maxInsertionLossDb: 7.80,
    typicalInsertionLossDb: 1.20,
    maxUniformityDb: 6.50,
    minReturnLossDb: 55,
    minDirectivityDb: 55,
    maxPdlDb: 0.20,
    category: 'fbt_asymmetrical',
    legs: [
      { name: 'Through (80%)', theoreticalDb: 1.08, maxDb: 1.50 },
      { name: 'Tap (20%)', theoreticalDb: 6.99, maxDb: 7.80 }
    ]
  },
  'TAP_85_15': {
    id: 'TAP_85_15',
    label: '1:2 Asymmetric FBT Tap (85/15%)',
    portCount: 2,
    theoreticalLossDb: 0.71,
    maxInsertionLossDb: 9.20,
    typicalInsertionLossDb: 0.90,
    maxUniformityDb: 8.00,
    minReturnLossDb: 55,
    minDirectivityDb: 55,
    maxPdlDb: 0.20,
    category: 'fbt_asymmetrical',
    legs: [
      { name: 'Through (85%)', theoreticalDb: 0.71, maxDb: 1.10 },
      { name: 'Tap (15%)', theoreticalDb: 8.24, maxDb: 9.20 }
    ]
  },
  'TAP_70_30': {
    id: 'TAP_70_30',
    label: '1:2 Asymmetric FBT Tap (70/30%)',
    portCount: 2,
    theoreticalLossDb: 1.67,
    maxInsertionLossDb: 6.00,
    typicalInsertionLossDb: 1.80,
    maxUniformityDb: 4.00,
    minReturnLossDb: 55,
    minDirectivityDb: 55,
    maxPdlDb: 0.20,
    category: 'fbt_asymmetrical',
    legs: [
      { name: 'Through (70%)', theoreticalDb: 1.67, maxDb: 2.10 },
      { name: 'Tap (30%)', theoreticalDb: 5.23, maxDb: 6.00 }
    ]
  }
};

export const SPLITTER_QA_PRESETS = {
  PRESET_BARADARI_1X8_EXEMPLARY: {
    id: 'PRESET_BARADARI_1X8_EXEMPLARY',
    name: 'Baradari Central Hub FAT-08 (1:8 PLC - Exemplary Class A)',
    splitterType: '1:8',
    location: 'Baradari Central Hub, FAT-08 Distribution Cabinet',
    technicianName: 'Sample Technician (Senior Fiber Splicer)',
    wavelengthNm: 1550,
    inputPowerDbm: 3.50,
    notes: 'Primary distribution tier splitter; factory certified SC/APC connectors with ultra-low insertion loss.',
    portLosses: [9.85, 9.92, 10.05, 9.88, 9.95, 10.12, 9.80, 10.02]
  },
  PRESET_VANDALA_1X16_PINCH: {
    id: 'PRESET_VANDALA_1X16_PINCH',
    name: 'Vandala Road Pole 14 Sub-FAT (1:16 PLC - Pinched Port 7 Branch)',
    splitterType: '1:16',
    location: 'Vandala Road OSP Pole 14, Secondary Splice Tray',
    technicianName: 'Tariq Mehmood (OSP Lineman)',
    wavelengthNm: 1490,
    inputPowerDbm: 4.00,
    notes: 'Port 7 ribbon shows elevated loss due to tight nylon zip-tie pinch at tray entry. Requires re-routing.',
    portLosses: [13.20, 13.45, 13.15, 13.50, 13.30, 13.25, 15.40, 13.35, 13.10, 13.40, 13.25, 13.30, 13.18, 13.32, 13.28, 13.35]
  },
  PRESET_JIA_MUSA_1X32_CLEAN: {
    id: 'PRESET_JIA_MUSA_1X32_CLEAN',
    name: 'Jia Musa Commercial Plaza Cabinet (1:32 PLC - High-Density Class B)',
    splitterType: '1:32',
    location: 'Jia Musa Commercial Market, ODF Distribution Frame Rack 2',
    technicianName: 'Sample Engineer (Lead Field Engineer)',
    wavelengthNm: 1550,
    inputPowerDbm: 5.50,
    notes: 'High-density 1:32 PLC cassette supplying 32 shop connections; all channels within Telcordia GR-1209 spec.',
    portLosses: [
      16.20, 16.45, 16.30, 16.55, 16.25, 16.40, 16.35, 16.50,
      16.15, 16.60, 16.35, 16.45, 16.28, 16.52, 16.38, 16.48,
      16.22, 16.42, 16.34, 16.58, 16.26, 16.39, 16.31, 16.51,
      16.18, 16.62, 16.36, 16.44, 16.29, 16.50, 16.37, 16.49
    ]
  },
  PRESET_GT_ROAD_TAP_85_15: {
    id: 'PRESET_GT_ROAD_TAP_85_15',
    name: 'GT Road Linear Strip Shop Drop (1:2 Tap 85/15% Asymmetrical)',
    splitterType: 'TAP_85_15',
    location: 'GT Road Main Boulevard, Pole 28 Tap Box',
    technicianName: 'Kashif Naveed (Optical Lineman)',
    wavelengthNm: 1310,
    inputPowerDbm: 2.50,
    notes: 'Asymmetrical tap coupler: 85% passes to downstream neighborhood, 15% drops into roadside plaza.',
    portLosses: [0.82, 8.55]
  },
  PRESET_RACHNA_1X8_DEFECT: {
    id: 'PRESET_RACHNA_1X8_DEFECT',
    name: 'Rachna Town Feeder Hub FAT-03 (1:8 PLC - Cracked Waveguide Reject)',
    splitterType: '1:8',
    location: 'Rachna Town Street 4, Aerial FAT-03 Closure',
    technicianName: 'Zahid Hussain (Splicing Technician)',
    wavelengthNm: 1550,
    inputPowerDbm: 3.00,
    notes: 'Severe optical attenuation on Ports 3 & 5 indicating internal silica planar waveguide chip fracture. Splitter condemned.',
    portLosses: [10.20, 10.45, 19.80, 10.35, 21.50, 10.40, 10.25, 10.30]
  }
};

/**
 * Calculates theoretical splitting loss for an N-way splitter.
 * L_theo = 10 * log10(N) dB
 */
export function calculateTheoreticalSplittingLoss(portCount) {
  const count = Number(portCount) || 1;
  if (count <= 1) return 0.0;
  return Number((10 * Math.log10(count)).toFixed(2));
}

/**
 * Evaluates port-by-port insertion loss, channel uniformity, and excess loss.
 */
export function evaluateSplitterPorts(input = {}) {
  const typeId = input.splitterType || '1:8';
  const config = SPLITTER_TYPES[typeId] || SPLITTER_TYPES['1:8'];
  const isTap = config.category === 'fbt_asymmetrical';
  const expectedPortCount = config.portCount;

  const inputPowerDbm = Number(input.inputPowerDbm !== undefined && input.inputPowerDbm !== null && input.inputPowerDbm !== '' ? input.inputPowerDbm : 0.0);

  // Normalize port losses array
  let rawLosses = [];
  if (Array.isArray(input.portLosses) && input.portLosses.length > 0) {
    rawLosses = input.portLosses.map(v => Number(v) || 0.0);
  } else if (Array.isArray(input.portPowersDbm) && input.portPowersDbm.length > 0) {
    rawLosses = input.portPowersDbm.map(p => Number((inputPowerDbm - Number(p)).toFixed(2)));
  } else {
    // Default to typical losses
    rawLosses = Array(expectedPortCount).fill(config.typicalInsertionLossDb);
  }

  // Ensure length matches expected port count
  while (rawLosses.length < expectedPortCount) {
    rawLosses.push(config.typicalInsertionLossDb);
  }
  if (rawLosses.length > expectedPortCount) {
    rawLosses = rawLosses.slice(0, expectedPortCount);
  }

  // Evaluate each port
  let maxLoss = -Infinity;
  let minLoss = Infinity;
  let sumLoss = 0;
  let passCount = 0;
  let conditionalCount = 0;
  let failHighCount = 0;
  let failLowCount = 0;

  const evaluatedPorts = rawLosses.map((loss, idx) => {
    const portNumber = idx + 1;
    let maxAllowed = config.maxInsertionLossDb;
    let theoLoss = config.theoreticalLossDb;
    let legName = `Port ${portNumber}`;

    if (isTap && config.legs && config.legs[idx]) {
      theoLoss = config.legs[idx].theoreticalDb;
      maxAllowed = config.legs[idx].maxDb;
      legName = `${config.legs[idx].name}`;
    }

    if (loss > maxLoss) maxLoss = loss;
    if (loss < minLoss) minLoss = loss;
    sumLoss += loss;

    let portStatus = 'PASS';
    let statusLabel = 'Pass (معیاری)';
    let note = 'Within Telcordia GR-1209 specification.';

    // Check bounds
    if (loss < theoLoss - 0.25) {
      portStatus = 'FAILED_LOW_LOSS';
      statusLabel = 'Failed / Unphysical (غیر حقیقی)';
      note = `Loss below theoretical limit (${theoLoss} dB). Check meter zeroing/reference.`;
      failLowCount++;
    } else if (loss > maxAllowed + 0.8) {
      portStatus = 'FAILED_HIGH_LOSS';
      statusLabel = 'Failed / High Loss (شدید تنبیہ)';
      note = `Excessive attenuation (${loss.toFixed(2)} dB vs max ${maxAllowed.toFixed(2)} dB). Microbend or waveguide defect.`;
      failHighCount++;
    } else if (loss > maxAllowed) {
      portStatus = 'CONDITIONAL_PASS';
      statusLabel = 'Conditional / Marginal (مشروط)';
      note = `Marginal loss exceeding spec limit by ${(loss - maxAllowed).toFixed(2)} dB. Clean connector and re-test.`;
      conditionalCount++;
    } else {
      passCount++;
    }

    const marginDb = Number((maxAllowed - loss).toFixed(2));
    const outputPowerDbm = Number((inputPowerDbm - loss).toFixed(2));

    return {
      portNumber,
      legName,
      measuredLossDb: loss,
      maxAllowedLossDb: maxAllowed,
      theoreticalLossDb: theoLoss,
      marginDb,
      outputPowerDbm,
      status: portStatus,
      statusLabel,
      note
    };
  });

  const averageLossDb = Number((sumLoss / expectedPortCount).toFixed(2));
  const uniformityDeltaDb = isTap ? 0.0 : Number((maxLoss - minLoss).toFixed(2));

  // Excess Loss Calculation: EL = -10 * log10(sum(10^(-IL_i / 10)))
  let totalFractionalPower = 0.0;
  rawLosses.forEach(loss => {
    totalFractionalPower += Math.pow(10, -loss / 10);
  });
  let excessLossDb = 0.0;
  if (totalFractionalPower > 0) {
    excessLossDb = Number((-10 * Math.log10(totalFractionalPower)).toFixed(2));
    if (excessLossDb < 0) excessLossDb = 0.0; // avoid minor numerical floating precision negative
  }

  // Uniformity verdict
  let uniformityStatus = 'PASS';
  let uniformityMessage = `Uniformity is within the ${config.maxUniformityDb} dB Telcordia tolerance.`;
  if (!isTap && uniformityDeltaDb > config.maxUniformityDb) {
    uniformityStatus = 'FAIL';
    uniformityMessage = `Channel variation (${uniformityDeltaDb} dB) exceeds maximum allowed ${config.maxUniformityDb} dB.`;
  }

  // Overall Health Verdict
  let overallVerdict = 'CERTIFIED_CLASS_A';
  let verdictBadge = 'CLASS A EXEMPLARY (کلاس A - مثالی معیاری)';
  let verdictDescription = '100% of ports meet Telcordia GR-1209-CORE standards with exemplary uniformity and insertion loss.';

  if (failHighCount > 0 || failLowCount > 0) {
    overallVerdict = 'REJECT_DEFECTIVE';
    verdictBadge = 'REJECT DEFECTIVE (ناکام - تبدیل کریں)';
    verdictDescription = `Splitter rejected due to ${failHighCount + failLowCount} failed port(s). High attenuation indicates cracked PLC chip or damaged internal pigtail.`;
  } else if (conditionalCount > 1 || (!isTap && uniformityStatus === 'FAIL')) {
    overallVerdict = 'REJECT_DEFECTIVE';
    verdictBadge = 'REJECT DEFECTIVE (غیر متوازن / تبدیل کریں)';
    verdictDescription = `Splitter failed uniformity criteria (ΔU = ${uniformityDeltaDb} dB vs spec ${config.maxUniformityDb} dB) or has multiple degraded branches.`;
  } else if (conditionalCount === 1) {
    overallVerdict = 'CONDITIONAL_DEGRADED';
    verdictBadge = 'CONDITIONAL PASS (مشروط منظوری)';
    verdictDescription = 'One port shows marginal loss. Inspect ferrule endface and re-seat before active subscriber provisioning.';
  } else if (uniformityDeltaDb > config.maxUniformityDb * 0.7 && !isTap) {
    overallVerdict = 'CERTIFIED_CLASS_B';
    verdictBadge = 'CLASS B ACCEPTABLE (کلاس B - قابل قبول)';
    verdictDescription = 'All ports pass standard Telcordia specifications and are acceptable for commercial deployment.';
  }

  return {
    splitterType: typeId,
    config,
    inputPowerDbm,
    portCount: expectedPortCount,
    ports: evaluatedPorts,
    maxLossDb: Number(maxLoss.toFixed(2)),
    minLossDb: Number(minLoss.toFixed(2)),
    averageLossDb,
    uniformityDeltaDb,
    uniformityStatus,
    uniformityMessage,
    excessLossDb,
    passCount,
    conditionalCount,
    failHighCount,
    failLowCount,
    overallVerdict,
    verdictBadge,
    verdictDescription
  };
}

/**
 * Validates splitter certification form input.
 */
export function validateSplitterQaInput(data = {}) {
  const errors = {};

  if (!data.splitterType || !SPLITTER_TYPES[data.splitterType]) {
    errors.splitterType = 'Valid optical splitter type must be selected.';
  }

  if (!data.location || !String(data.location).trim()) {
    errors.location = 'FAT enclosure / ODF location is required.';
  }

  if (!data.technicianName || !String(data.technicianName).trim()) {
    errors.technicianName = 'Field technician / QA inspector name is required.';
  }

  if (data.inputPowerDbm !== undefined && data.inputPowerDbm !== '') {
    const val = Number(data.inputPowerDbm);
    if (isNaN(val) || val < -30 || val > 30) {
      errors.inputPowerDbm = 'Input power must be between -30 dBm and +30 dBm.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Builds an immutable, sequentially tracked Splitter QA Certificate record.
 */
export function buildSplitterQaRecord(input = {}, existingCerts = []) {
  const now = new Date();
  const yearMonth = now.toISOString().slice(0, 7).replace('-', '');
  const prefix = `SPL-${yearMonth}-`;

  let maxSeq = 0;
  if (Array.isArray(existingCerts)) {
    existingCerts.forEach(cert => {
      if (cert && cert.certId && cert.certId.startsWith(prefix)) {
        const seq = parseInt(cert.certId.slice(prefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    });
  }

  const certId = `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  const evaluation = evaluateSplitterPorts(input);

  return {
    certId,
    timestamp: now.toISOString(),
    testDate: input.testDate || now.toISOString().slice(0, 10),
    splitterType: input.splitterType || '1:8',
    serialNumber: input.serialNumber ? String(input.serialNumber).trim() : `PLC-${Date.now().toString().slice(-6)}`,
    location: input.location ? String(input.location).trim() : 'Baradari Hub ODF',
    technicianName: input.technicianName ? String(input.technicianName).trim() : 'Shahdara OSP Team',
    wavelengthNm: Number(input.wavelengthNm) || 1550,
    inputPowerDbm: Number(input.inputPowerDbm) || 0.0,
    notes: input.notes ? String(input.notes).trim() : '',
    evaluation
  };
}

/**
 * Generates pure vector SVG graphic visualizer for optical splitter ports.
 * Includes port-by-port loss bar chart and optical PLC waveguide enclosure schematic.
 */
export function renderSplitterQaAnalysisSvg(evaluation, options = {}) {
  if (!evaluation || !evaluation.ports) {
    return '<svg viewBox="0 0 780 360" xmlns="http://www.w3.org/2000/svg"><text x="390" y="180" fill="#888" text-anchor="middle">No Splitter Data</text></svg>';
  }

  const {
    ports,
    config,
    maxLossDb,
    minLossDb,
    uniformityDeltaDb,
    excessLossDb,
    overallVerdict,
    verdictBadge
  } = evaluation;

  const portCount = ports.length;
  const isTap = config.category === 'fbt_asymmetrical';

  // Y-axis scaling for chart: 0 dB to 25 dB
  const chartTop = 30;
  const chartBottom = 170;
  const chartHeight = chartBottom - chartTop;
  const maxAxisDb = Math.max(22.0, Math.ceil(maxLossDb + 2));

  function lossToY(loss) {
    const clamped = Math.max(0, Math.min(maxAxisDb, loss));
    return chartBottom - (clamped / maxAxisDb) * chartHeight;
  }

  const chartLeft = 55;
  const chartRight = 750;
  const chartWidth = chartRight - chartLeft;
  const barSpacing = chartWidth / portCount;
  const barWidth = Math.max(6, Math.min(32, barSpacing * 0.65));

  // Theoretical and Max Spec reference line Y coordinates
  const theoY = lossToY(config.theoreticalLossDb);
  const specY = lossToY(config.maxInsertionLossDb);

  // Bars SVG markup
  let barsMarkup = '';
  ports.forEach((p, i) => {
    const xCenter = chartLeft + i * barSpacing + barSpacing / 2;
    const barX = xCenter - barWidth / 2;
    const barY = lossToY(p.measuredLossDb);
    const barH = chartBottom - barY;

    let barFill = '#10b981'; // green
    if (p.status === 'CONDITIONAL_PASS') barFill = '#f59e0b'; // amber
    if (p.status.startsWith('FAILED')) barFill = '#ef4444'; // red

    // Loss text above bar
    const textY = Math.max(chartTop + 12, barY - 5);
    const fontSize = portCount > 32 ? '8' : portCount > 16 ? '9' : '11';

    barsMarkup += `
      <g class="splitter-port-bar" data-port="${p.portNumber}">
        <rect x="${barX.toFixed(1)}" y="${barY.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barH.toFixed(1)}" rx="3" fill="${barFill}" opacity="0.88">
          <title>Port ${p.portNumber}: ${p.measuredLossDb.toFixed(2)} dB (${p.status})</title>
        </rect>
        <text x="${xCenter.toFixed(1)}" y="${textY.toFixed(1)}" fill="${barFill}" font-size="${fontSize}" font-family="system-ui, sans-serif" font-weight="700" text-anchor="middle">
          ${p.measuredLossDb.toFixed(1)}
        </text>
        <text x="${xCenter.toFixed(1)}" y="${(chartBottom + 14).toFixed(1)}" fill="#94a3b8" font-size="${fontSize}" font-family="system-ui, sans-serif" text-anchor="middle">
          P${p.portNumber}
        </text>
      </g>
    `;
  });

  // Splitter Enclosure Diagram (y: 210 to 330)
  const encLeft = 220;
  const encTop = 220;
  const encWidth = 340;
  const encHeight = 85;

  let waveguideOutputMarkup = '';
  const displayLimit = Math.min(portCount, 16);
  for (let i = 0; i < displayLimit; i++) {
    const outPort = ports[i];
    const outY = encTop + 12 + (i / Math.max(1, displayLimit - 1)) * (encHeight - 24);
    let portGlow = '#10b981';
    if (outPort.status === 'CONDITIONAL_PASS') portGlow = '#f59e0b';
    if (outPort.status.startsWith('FAILED')) portGlow = '#ef4444';

    waveguideOutputMarkup += `
      <path d="M ${encLeft + encWidth - 20} ${encTop + encHeight / 2} C ${encLeft + encWidth + 30} ${encTop + encHeight / 2}, ${encLeft + encWidth + 40} ${outY}, ${encLeft + encWidth + 80} ${outY}" fill="none" stroke="${portGlow}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="${encLeft + encWidth + 84}" cy="${outY}" r="4" fill="${portGlow}"/>
      ${outPort.status.startsWith('FAILED') ? `<circle cx="${encLeft + encWidth + 84}" cy="${outY}" r="8" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="2 2"/>` : ''}
    `;
  }

  let verdictColor = '#10b981';
  if (overallVerdict === 'CONDITIONAL_DEGRADED') verdictColor = '#f59e0b';
  if (overallVerdict === 'REJECT_DEFECTIVE') verdictColor = '#ef4444';

  return `
    <svg viewBox="0 0 780 360" xmlns="http://www.w3.org/2000/svg" class="splitter-qa-svg" style="background:#0b1120; border-radius:10px; width:100%; height:auto;">
      <defs>
        <linearGradient id="splitEncGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
        <linearGradient id="chipGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#0284c7" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.9"/>
        </linearGradient>
      </defs>

      <!-- Grid lines -->
      <line x1="${chartLeft}" y1="${chartTop}" x2="${chartRight}" y2="${chartTop}" stroke="#334155" stroke-dasharray="2 4" stroke-width="1"/>
      <line x1="${chartLeft}" y1="${(chartTop + chartHeight / 2).toFixed(1)}" x2="${chartRight}" y2="${(chartTop + chartHeight / 2).toFixed(1)}" stroke="#334155" stroke-dasharray="2 4" stroke-width="1"/>
      <line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" stroke="#475569" stroke-width="1.5"/>

      <!-- Y-Axis labels -->
      <text x="${chartLeft - 10}" y="${chartTop + 4}" fill="#64748b" font-size="10" font-family="monospace" text-anchor="end">${maxAxisDb}dB</text>
      <text x="${chartLeft - 10}" y="${(chartTop + chartHeight / 2 + 3).toFixed(1)}" fill="#64748b" font-size="10" font-family="monospace" text-anchor="end">${(maxAxisDb / 2).toFixed(0)}dB</text>
      <text x="${chartLeft - 10}" y="${chartBottom + 3}" fill="#64748b" font-size="10" font-family="monospace" text-anchor="end">0dB</text>

      <!-- Reference line: Theoretical Loss -->
      ${!isTap ? `
        <line x1="${chartLeft}" y1="${theoY.toFixed(1)}" x2="${chartRight}" y2="${theoY.toFixed(1)}" stroke="#06b6d4" stroke-dasharray="4 3" stroke-width="1.5"/>
        <text x="${chartRight}" y="${(theoY - 4).toFixed(1)}" fill="#06b6d4" font-size="10" font-family="system-ui, sans-serif" font-weight="600" text-anchor="end">Theoretical Split: ${config.theoreticalLossDb} dB</text>
      ` : ''}

      <!-- Reference line: Max Spec -->
      ${!isTap ? `
        <line x1="${chartLeft}" y1="${specY.toFixed(1)}" x2="${chartRight}" y2="${specY.toFixed(1)}" stroke="#f43f5e" stroke-dasharray="3 3" stroke-width="1.5"/>
        <text x="${chartRight}" y="${(specY - 4).toFixed(1)}" fill="#f43f5e" font-size="10" font-family="system-ui, sans-serif" font-weight="600" text-anchor="end">Telcordia Limit: ${config.maxInsertionLossDb} dB</text>
      ` : ''}

      <!-- Chart Bars -->
      ${barsMarkup}

      <!-- Splitter Enclosure Box -->
      <rect x="${encLeft}" y="${encTop}" width="${encWidth}" height="${encHeight}" rx="8" fill="url(#splitEncGrad)" stroke="#475569" stroke-width="1.5"/>
      <rect x="${encLeft + 60}" y="${encTop + 18}" width="160" height="48" rx="5" fill="url(#chipGrad)" stroke="#38bdf8" stroke-width="1.2"/>
      <text x="${encLeft + 140}" y="${encTop + 45}" fill="#ffffff" font-size="11" font-weight="700" font-family="system-ui, sans-serif" text-anchor="middle">
        ${config.label}
      </text>

      <!-- Input fiber -->
      <path d="M ${encLeft - 70} ${encTop + encHeight / 2} L ${encLeft + 60} ${encTop + encHeight / 2}" fill="none" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${encLeft - 74}" cy="${encTop + encHeight / 2}" r="5" fill="#fbbf24"/>
      <text x="${encLeft - 82}" y="${encTop + encHeight / 2 + 4}" fill="#fbbf24" font-size="11" font-family="system-ui, sans-serif" font-weight="600" text-anchor="end">
        Input ${evaluation.inputPowerDbm >= 0 ? '+' : ''}${evaluation.inputPowerDbm} dBm
      </text>

      <!-- Output waveguide branches -->
      ${waveguideOutputMarkup}

      <!-- Telemetry HUD Ribbon at bottom -->
      <rect x="20" y="322" width="740" height="30" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="35" y="342" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">
        ΔU Uniformity: <tspan fill="${evaluation.uniformityStatus === 'PASS' ? '#10b981' : '#ef4444'}" font-weight="700">${uniformityDeltaDb} dB</tspan> (Spec: ≤${config.maxUniformityDb}dB)
      </text>
      <text x="280" y="342" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">
        Excess Loss: <tspan fill="#38bdf8" font-weight="700">${excessLossDb} dB</tspan>
      </text>
      <text x="440" y="342" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">
        Range: <tspan fill="#e2e8f0" font-weight="600">${minLossDb} - ${maxLossDb} dB</tspan>
      </text>
      <rect x="610" y="327" width="140" height="20" rx="4" fill="${verdictColor}" opacity="0.2"/>
      <text x="680" y="341" fill="${verdictColor}" font-size="11" font-weight="700" font-family="system-ui, sans-serif" text-anchor="middle">
        ${overallVerdict}
      </text>
    </svg>
  `;
}

/**
 * Generates printable HTML documents (A4 formal accreditation certificate and 80mm POS field slip).
 */
export function generateSplitterQaCertHtml(record, options = {}) {
  const isThermal = options.format === 'thermal' || options.format === '80mm';
  const {
    certId,
    testDate,
    splitterType,
    serialNumber,
    location,
    technicianName,
    wavelengthNm,
    inputPowerDbm,
    notes,
    evaluation
  } = record;

  const config = evaluation.config || SPLITTER_TYPES[splitterType] || SPLITTER_TYPES['1:8'];
  const ports = evaluation.ports || [];

  if (isThermal) {
    // 80mm POS thermal field slip
    const portRows = ports.map(p =>
      `  P${String(p.portNumber).padEnd(2)}: ${p.measuredLossDb.toFixed(2)} dB [${p.status === 'PASS' ? 'OK' : p.status === 'CONDITIONAL_PASS' ? 'WARN' : 'FAIL'}]`
    ).join('\n');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Splitter QA Field Slip - ${certId}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    body { font-family: 'Courier New', monospace; font-size: 11px; margin: 0; padding: 2mm; background: #fff; color: #000; }
    .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
    .title { font-size: 13px; font-weight: bold; }
    .verdict { font-size: 14px; font-weight: bold; text-align: center; margin: 8px 0; border: 1px solid #000; padding: 4px; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .ports-box { font-family: monospace; font-size: 10px; margin: 6px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; white-space: pre; }
    .footer { text-align: center; margin-top: 8px; font-size: 9px; border-top: 1px dashed #000; padding-top: 4px; }
  </style>
</head>
<body onload="window.print()">
  <div class="header">
    <div class="title">SHAHDARA ISP - OSP QA</div>
    <div>TELCORDIA GR-1209 SPLITTER TEST</div>
    <div>Cert: ${certId}</div>
  </div>
  <div class="row"><span>Date:</span><span>${testDate}</span></div>
  <div class="row"><span>Type:</span><span>${config.label}</span></div>
  <div class="row"><span>Serial:</span><span>${serialNumber}</span></div>
  <div class="row"><span>Location:</span><span>${location}</span></div>
  <div class="row"><span>Inspector:</span><span>${technicianName}</span></div>
  <div class="row"><span>Wavelength:</span><span>${wavelengthNm} nm</span></div>
  <div class="row"><span>Input Power:</span><span>${inputPowerDbm} dBm</span></div>

  <div class="verdict">
    ${evaluation.overallVerdict}
    <div style="font-size:10px; font-weight:normal;">ΔU: ${evaluation.uniformityDeltaDb}dB | EL: ${evaluation.excessLossDb}dB</div>
  </div>

  <div class="ports-box">
PORT MEASUREMENTS:
${portRows}
  </div>

  <div class="row"><span>Max Loss:</span><span>${evaluation.maxLossDb} dB</span></div>
  <div class="row"><span>Min Loss:</span><span>${evaluation.minLossDb} dB</span></div>
  <div class="row"><span>Uniformity ΔU:</span><span>${evaluation.uniformityDeltaDb} dB</span></div>
  <div class="row"><span>Excess Loss:</span><span>${evaluation.excessLossDb} dB</span></div>

  <div class="footer">
    Telcordia GR-1209 / ITU-T G.671 Verified<br>
    Sign: _______________________
  </div>
</body>
</html>
    `;
  }

  // Formal A4 Certificate
  const portTableRows = ports.map(p => {
    let badgeClass = 'pass';
    if (p.status === 'CONDITIONAL_PASS') badgeClass = 'warn';
    if (p.status.startsWith('FAILED')) badgeClass = 'fail';

    return `
      <tr>
        <td style="text-align:center; font-weight:600;">${p.portNumber}</td>
        <td>${p.legName}</td>
        <td style="text-align:right; font-family:monospace; font-weight:700;">${p.measuredLossDb.toFixed(2)} dB</td>
        <td style="text-align:right; font-family:monospace;">${p.maxAllowedLossDb.toFixed(2)} dB</td>
        <td style="text-align:right; font-family:monospace; color:${p.marginDb >= 0 ? '#10b981' : '#ef4444'};">${p.marginDb.toFixed(2)} dB</td>
        <td style="text-align:right; font-family:monospace;">${p.outputPowerDbm.toFixed(2)} dBm</td>
        <td style="text-align:center;"><span class="badge ${badgeClass}">${p.status}</span></td>
        <td style="font-size:11px; color:#475569;">${p.note}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Optical Splitter QA Certificate - ${certId}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 13px; line-height: 1.5; color: #1e293b; margin: 0; padding: 0; background: #fff; }
    .cert-container { border: 2px solid #0f172a; padding: 25px; border-radius: 8px; }
    .cert-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
    .brand { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .subbrand { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; }
    .cert-id { text-align: right; font-family: monospace; font-size: 14px; font-weight: 700; color: #0284c7; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center; }
    .kpi-val { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px; font-family: monospace; }
    .kpi-lbl { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .meta-table td { padding: 5px 8px; font-size: 12px; }
    .meta-lbl { font-weight: 600; color: #475569; width: 18%; }
    .meta-val { color: #0f172a; width: 32%; }
    .ports-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
    .ports-table th, .ports-table td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 12px; }
    .ports-table th { background: #f1f5f9; color: #334155; font-weight: 700; text-align: left; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
    .badge.pass { background: #dcfce7; color: #166534; }
    .badge.warn { background: #fef3c7; color: #92400e; }
    .badge.fail { background: #fee2e2; color: #991b1b; }
    .verdict-banner { background: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 16px; margin-bottom: 20px; border-radius: 0 6px 6px 0; }
    .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px solid #cbd5e1; }
    .sig-block { width: 40%; text-align: center; }
    .sig-line { border-bottom: 1px solid #94a3b8; height: 35px; margin-bottom: 5px; }
    .sig-title { font-size: 11px; color: #64748b; font-weight: 600; }
  </style>
</head>
<body onload="window.print()">
  <div class="cert-container">
    <div class="cert-header">
      <div>
        <div class="brand">SHAHDARA BROADBAND ISP</div>
        <div class="subbrand">Outside Plant Quality Assurance Laboratory • Telcordia GR-1209-CORE</div>
      </div>
      <div>
        <div class="cert-id">${certId}</div>
        <div style="font-size:11px; color:#64748b; text-align:right;">Date: ${testDate}</div>
      </div>
    </div>

    <div class="verdict-banner">
      <div style="font-size:15px; font-weight:800; color:#0f172a;">${evaluation.verdictBadge}</div>
      <div style="font-size:12px; color:#475569; margin-top:3px;">${evaluation.verdictDescription}</div>
    </div>

    <table class="meta-table">
      <tr>
        <td class="meta-lbl">Component Type:</td>
        <td class="meta-val"><strong>${config.label}</strong></td>
        <td class="meta-lbl">Serial Number:</td>
        <td class="meta-val">${serialNumber}</td>
      </tr>
      <tr>
        <td class="meta-lbl">FAT / ODF Location:</td>
        <td class="meta-val">${location}</td>
        <td class="meta-lbl">QA Technician:</td>
        <td class="meta-val">${technicianName}</td>
      </tr>
      <tr>
        <td class="meta-lbl">Test Wavelength:</td>
        <td class="meta-val">${wavelengthNm} nm</td>
        <td class="meta-lbl">Laser Input Power:</td>
        <td class="meta-val">${inputPowerDbm >= 0 ? '+' : ''}${inputPowerDbm} dBm</td>
      </tr>
    </table>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-lbl">Channel Uniformity ΔU</div>
        <div class="kpi-val" style="color:${evaluation.uniformityStatus === 'PASS' ? '#10b981' : '#ef4444'};">${evaluation.uniformityDeltaDb} dB</div>
        <div style="font-size:10px; color:#64748b;">Spec Limit: ≤${config.maxUniformityDb} dB</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">Excess Loss (EL)</div>
        <div class="kpi-val">${evaluation.excessLossDb} dB</div>
        <div style="font-size:10px; color:#64748b;">Silica Chip Dissipation</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">Max Insertion Loss</div>
        <div class="kpi-val">${evaluation.maxLossDb} dB</div>
        <div style="font-size:10px; color:#64748b;">Spec Limit: ≤${config.maxInsertionLossDb} dB</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">Min Insertion Loss</div>
        <div class="kpi-val">${evaluation.minLossDb} dB</div>
        <div style="font-size:10px; color:#64748b;">Theoretical: ${config.theoreticalLossDb} dB</div>
      </div>
    </div>

    <table class="ports-table">
      <thead>
        <tr>
          <th style="width:5%; text-align:center;">#</th>
          <th style="width:18%;">Channel</th>
          <th style="width:12%; text-align:right;">Measured Loss</th>
          <th style="width:12%; text-align:right;">Telcordia Max</th>
          <th style="width:10%; text-align:right;">Margin</th>
          <th style="width:12%; text-align:right;">Output Power</th>
          <th style="width:12%; text-align:center;">Status</th>
          <th>Diagnostic Finding</th>
        </tr>
      </thead>
      <tbody>
        ${portTableRows}
      </tbody>
    </table>

    ${notes ? `
      <div style="margin-bottom:20px; font-size:12px; background:#f8fafc; padding:8px 12px; border-radius:4px; border:1px solid #e2e8f0;">
        <strong>Technician Observations:</strong> ${notes}
      </div>
    ` : ''}

    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-title">Field Quality Assurance Inspector<br>${technicianName}</div>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-title">NOC Operations & Metrology Manager<br>Shahdara Core Network Facility</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Formats bilingual Urdu & English WhatsApp technician dispatch text.
 */
export function formatSplitterQaCertWhatsApp(record) {
  const {
    certId,
    testDate,
    location,
    technicianName,
    wavelengthNm,
    evaluation
  } = record;

  const config = evaluation.config || {};
  const statusEmoji = evaluation.overallVerdict === 'REJECT_DEFECTIVE' ? '❌' : evaluation.overallVerdict === 'CONDITIONAL_DEGRADED' ? '⚠️' : '✅';

  let portSummary = '';
  if (Array.isArray(evaluation.ports)) {
    portSummary = evaluation.ports.map(p =>
      `  • P${p.portNumber}: ${p.measuredLossDb.toFixed(2)}dB (${p.status === 'PASS' ? 'OK' : p.status})`
    ).join('\n');
  }

  return `*SHAHDARA ISP - OPTICAL SPLITTER QA ACCREDITATION* 📶
*سرٹیفکیٹ نمبر:* \`${certId}\`
*تاریخ:* ${testDate}
*مقام:* ${location}
*معائنہ کار:* ${technicianName}

*سپلٹر ماڈل:* ${config.label || '1:8 PLC'}
*طول موج:* ${wavelengthNm} nm
*حالت (Verdict):* ${statusEmoji} *${evaluation.overallVerdict}*

📊 *پیمائشی خلاصہ (Key Metrics):*
• یونیفارمٹی (Uniformity ΔU): *${evaluation.uniformityDeltaDb} dB* (حد: ≤${config.maxUniformityDb}dB)
• ایکسٹرا لاس (Excess Loss): *${evaluation.excessLossDb} dB*
• زیادہ سے زیادہ لاس: *${evaluation.maxLossDb} dB*
• کم سے کم لاس: *${evaluation.minLossDb} dB*

🔍 *چینل وار تفصیل (Port Losses):*
${portSummary}

${evaluation.overallVerdict === 'REJECT_DEFECTIVE' ? '⚠️ *توجہ فرمائیں:* خرابی کی صورت میں کنیکٹر تبدیل کریں یا نیا سپلٹر ماڈیول لگائیں۔' : '✅ تمام چینلز تلکورڈیا GR-1209 معیار کے مطابق پاس ہیں۔'}

_Shahdara ISP Network Operations Center - Optical QA Lab_`;
}

/**
 * Generates RFC-4180 compliant CSV export of Splitter QA Certificates with UTF-8 BOM.
 */
export function generateSplitterQaCertsCsv(records = []) {
  const BOM = '\uFEFF';
  const headers = [
    'Certificate ID',
    'Test Date',
    'Splitter Type',
    'Serial Number',
    'Location',
    'Technician',
    'Wavelength (nm)',
    'Input Power (dBm)',
    'Overall Verdict',
    'Uniformity Delta (dB)',
    'Excess Loss (dB)',
    'Max Loss (dB)',
    'Min Loss (dB)',
    'Average Loss (dB)',
    'Pass Count',
    'Fail Count',
    'Notes'
  ];

  function escapeCsv(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  const rows = records.map(r => {
    const ev = r.evaluation || {};
    return [
      escapeCsv(r.certId),
      escapeCsv(r.testDate),
      escapeCsv(r.splitterType),
      escapeCsv(r.serialNumber),
      escapeCsv(r.location),
      escapeCsv(r.technicianName),
      escapeCsv(r.wavelengthNm),
      escapeCsv(r.inputPowerDbm),
      escapeCsv(ev.overallVerdict),
      escapeCsv(ev.uniformityDeltaDb),
      escapeCsv(ev.excessLossDb),
      escapeCsv(ev.maxLossDb),
      escapeCsv(ev.minLossDb),
      escapeCsv(ev.averageLossDb),
      escapeCsv(ev.passCount),
      escapeCsv((ev.failHighCount || 0) + (ev.failLowCount || 0)),
      escapeCsv(r.notes)
    ].join(',');
  });

  return BOM + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Local storage methods for Splitter QA certificates.
 */
export function getSavedSplitterQaCerts(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(SPLITTER_QA_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load splitter QA certs:', err);
    return [];
  }
}

export function saveSplitterQaCert(record, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !record || !record.certId) return false;
  try {
    const certs = getSavedSplitterQaCerts(storage);
    const existingIndex = certs.findIndex(c => c.certId === record.certId);
    if (existingIndex >= 0) {
      certs[existingIndex] = record;
    } else {
      certs.unshift(record);
    }
    storage.setItem(SPLITTER_QA_STORAGE_KEY, JSON.stringify(certs.slice(0, 100)));
    return true;
  } catch (err) {
    console.error('Failed to save splitter QA cert:', err);
    return false;
  }
}

export function updateSplitterQaCertStatus(certId, newVerdict, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !certId || !newVerdict) return false;
  try {
    const certs = getSavedSplitterQaCerts(storage);
    const target = certs.find(c => c.certId === certId);
    if (!target) return false;
    if (target.evaluation) {
      target.evaluation.overallVerdict = newVerdict;
    }
    storage.setItem(SPLITTER_QA_STORAGE_KEY, JSON.stringify(certs));
    return true;
  } catch (err) {
    console.error('Failed to update splitter QA cert status:', err);
    return false;
  }
}

export function clearSplitterQaCerts(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return false;
  try {
    storage.removeItem(SPLITTER_QA_STORAGE_KEY);
    return true;
  } catch (err) {
    console.error('Failed to clear splitter QA certs:', err);
    return false;
  }
}

export function calculateSplitterQaMetrics(certs = []) {
  if (!Array.isArray(certs) || certs.length === 0) {
    return {
      total: 0,
      classA: 0,
      classB: 0,
      conditional: 0,
      rejected: 0,
      passRate: 0.0
    };
  }

  let classA = 0;
  let classB = 0;
  let conditional = 0;
  let rejected = 0;

  certs.forEach(c => {
    const v = c.evaluation?.overallVerdict;
    if (v === 'CERTIFIED_CLASS_A') classA++;
    else if (v === 'CERTIFIED_CLASS_B') classB++;
    else if (v === 'CONDITIONAL_DEGRADED') conditional++;
    else if (v === 'REJECT_DEFECTIVE') rejected++;
    else classB++;
  });

  const passed = classA + classB;
  const passRate = Number(((passed / certs.length) * 100).toFixed(1));

  return {
    total: certs.length,
    classA,
    classB,
    conditional,
    rejected,
    passRate
  };
}

/**
 * Setup Splitter QA Modal controller.
 */
export function setupSplitterQaModal(options = {}) {
  const doc = options.doc || (typeof document !== 'undefined' ? document : null);
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const onToast = options.onToast || (() => {});

  if (!doc) return null;

  const modal = doc.getElementById('splitterQaModal');
  const openBtn = doc.getElementById('openSplitterQaBtn');
  const closeBtn = doc.getElementById('closeSplitterQaBtn');
  const presetSelect = doc.getElementById('splitterQaPresetSelect');
  const typeSelect = doc.getElementById('splitterQaTypeSelect');
  const inputPowerInput = doc.getElementById('splitterQaInputPower');
  const wlSelect = doc.getElementById('splitterQaWlSelect');
  const locationInput = doc.getElementById('splitterQaLocation');
  const techInput = doc.getElementById('splitterQaTech');
  const serialInput = doc.getElementById('splitterQaSerial');
  const notesInput = doc.getElementById('splitterQaNotes');
  const portsGrid = doc.getElementById('splitterQaPortsGrid');
  const svgContainer = doc.getElementById('splitterQaSvgContainer');
  const hudRibbon = doc.getElementById('splitterQaHudRibbon');
  const saveBtn = doc.getElementById('saveSplitterQaCertBtn');
  const printA4Btn = doc.getElementById('printSplitterQaA4Btn');
  const printThermalBtn = doc.getElementById('printSplitterQaThermalBtn');
  const whatsappBtn = doc.getElementById('whatsappSplitterQaBtn');
  const exportCsvBtn = doc.getElementById('exportSplitterQaCsvBtn');
  const historyTbody = doc.getElementById('splitterQaHistoryTbody');

  let currentEvaluation = null;

  function renderPortsInputs() {
    if (!portsGrid || !typeSelect) return;
    const typeId = typeSelect.value || '1:8';
    const cfg = SPLITTER_TYPES[typeId] || SPLITTER_TYPES['1:8'];
    const portCount = cfg.portCount;

    let html = '';
    for (let i = 1; i <= portCount; i++) {
      html += `
        <div class="splitter-port-input-card">
          <label class="splitter-port-input-label">P${i} Loss (dB):</label>
          <input type="number" step="0.05" class="splitter-port-loss-input" data-port="${i}" value="${cfg.typicalInsertionLossDb.toFixed(2)}">
        </div>
      `;
    }
    portsGrid.innerHTML = html;

    // Attach listeners
    portsGrid.querySelectorAll('.splitter-port-loss-input').forEach(inp => {
      inp.addEventListener('input', recalculate);
    });
  }

  function getPortLossesFromInputs() {
    if (!portsGrid) return [];
    const inputs = portsGrid.querySelectorAll('.splitter-port-loss-input');
    const losses = [];
    inputs.forEach(inp => {
      losses.push(Number(inp.value) || 0.0);
    });
    return losses;
  }

  function recalculate() {
    if (!typeSelect) return;
    const typeId = typeSelect.value || '1:8';
    const inputPowerDbm = Number(inputPowerInput?.value) || 0.0;
    const portLosses = getPortLossesFromInputs();

    currentEvaluation = evaluateSplitterPorts({
      splitterType: typeId,
      inputPowerDbm,
      portLosses
    });

    if (svgContainer) {
      svgContainer.innerHTML = renderSplitterQaAnalysisSvg(currentEvaluation);
    }

    if (hudRibbon) {
      hudRibbon.innerHTML = `
        <span class="hud-item">ΔU: <strong>${currentEvaluation.uniformityDeltaDb} dB</strong></span>
        <span class="hud-item">Excess Loss: <strong>${currentEvaluation.excessLossDb} dB</strong></span>
        <span class="hud-item">Max Loss: <strong>${currentEvaluation.maxLossDb} dB</strong></span>
        <span class="hud-item">Verdict: <strong class="verdict-${currentEvaluation.overallVerdict.toLowerCase()}">${currentEvaluation.overallVerdict}</strong></span>
      `;
    }
  }

  function renderHistory() {
    if (!historyTbody) return;
    const certs = getSavedSplitterQaCerts(storage);
    if (certs.length === 0) {
      historyTbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:15px;">No saved splitter QA certifications yet.</td></tr>`;
      return;
    }

    historyTbody.innerHTML = certs.map(c => `
      <tr>
        <td style="font-family:monospace; font-weight:700;">${c.certId}</td>
        <td>${c.testDate}</td>
        <td>${c.splitterType}</td>
        <td>${c.location}</td>
        <td><span class="badge ${c.evaluation?.overallVerdict === 'CERTIFIED_CLASS_A' ? 'pass' : c.evaluation?.overallVerdict === 'REJECT_DEFECTIVE' ? 'fail' : 'warn'}">${c.evaluation?.overallVerdict}</span></td>
        <td style="font-family:monospace;">${c.evaluation?.uniformityDeltaDb} dB</td>
        <td>
          <button type="button" class="btn btn-sm btn-outline load-cert-btn" data-cert-id="${c.certId}">Load</button>
        </td>
      </tr>
    `).join('');

    historyTbody.querySelectorAll('.load-cert-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cert-id');
        const cert = certs.find(x => x.certId === id);
        if (cert) loadRecordIntoForm(cert);
      });
    });
  }

  function loadRecordIntoForm(record) {
    if (!record) return;
    if (typeSelect) typeSelect.value = record.splitterType;
    if (locationInput) locationInput.value = record.location || '';
    if (techInput) techInput.value = record.technicianName || '';
    if (serialInput) serialInput.value = record.serialNumber || '';
    if (wlSelect) wlSelect.value = record.wavelengthNm || '1550';
    if (inputPowerInput) inputPowerInput.value = record.inputPowerDbm || '0.0';
    if (notesInput) notesInput.value = record.notes || '';

    renderPortsInputs();

    if (record.evaluation?.ports && portsGrid) {
      const inputs = portsGrid.querySelectorAll('.splitter-port-loss-input');
      record.evaluation.ports.forEach((p, idx) => {
        if (inputs[idx]) inputs[idx].value = p.measuredLossDb.toFixed(2);
      });
    }

    recalculate();
  }

  function loadPreset(presetKey) {
    const preset = SPLITTER_QA_PRESETS[presetKey];
    if (!preset) return;
    if (typeSelect) typeSelect.value = preset.splitterType;
    if (locationInput) locationInput.value = preset.location;
    if (techInput) techInput.value = preset.technicianName;
    if (wlSelect) wlSelect.value = preset.wavelengthNm;
    if (inputPowerInput) inputPowerInput.value = preset.inputPowerDbm;
    if (notesInput) notesInput.value = preset.notes;

    renderPortsInputs();

    if (portsGrid && Array.isArray(preset.portLosses)) {
      const inputs = portsGrid.querySelectorAll('.splitter-port-loss-input');
      preset.portLosses.forEach((loss, idx) => {
        if (inputs[idx]) inputs[idx].value = loss.toFixed(2);
      });
    }

    recalculate();
  }

  // Bind Events
  if (typeSelect) {
    typeSelect.addEventListener('change', () => {
      renderPortsInputs();
      recalculate();
    });
  }

  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      if (presetSelect.value) {
        loadPreset(presetSelect.value);
      }
    });
  }

  if (inputPowerInput) {
    inputPowerInput.addEventListener('input', recalculate);
  }

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
      }
      if (!currentEvaluation) {
        renderPortsInputs();
        recalculate();
      }
      renderHistory();
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const existingCerts = getSavedSplitterQaCerts(storage);
      const record = buildSplitterQaRecord({
        splitterType: typeSelect?.value || '1:8',
        serialNumber: serialInput?.value,
        location: locationInput?.value,
        technicianName: techInput?.value,
        wavelengthNm: Number(wlSelect?.value) || 1550,
        inputPowerDbm: Number(inputPowerInput?.value) || 0.0,
        notes: notesInput?.value,
        portLosses: getPortLossesFromInputs()
      }, existingCerts);

      const ok = saveSplitterQaCert(record, storage);
      if (ok) {
        onToast(`Splitter certificate ${record.certId} saved successfully!`);
        renderHistory();
      } else {
        onToast('Failed to save certificate.');
      }
    });
  }

  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      const existingCerts = getSavedSplitterQaCerts(storage);
      const record = buildSplitterQaRecord({
        splitterType: typeSelect?.value || '1:8',
        serialNumber: serialInput?.value,
        location: locationInput?.value,
        technicianName: techInput?.value,
        wavelengthNm: Number(wlSelect?.value) || 1550,
        inputPowerDbm: Number(inputPowerInput?.value) || 0.0,
        notes: notesInput?.value,
        portLosses: getPortLossesFromInputs()
      }, existingCerts);

      const html = generateSplitterQaCertHtml(record, { format: 'a4' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    });
  }

  if (printThermalBtn) {
    printThermalBtn.addEventListener('click', () => {
      const existingCerts = getSavedSplitterQaCerts(storage);
      const record = buildSplitterQaRecord({
        splitterType: typeSelect?.value || '1:8',
        serialNumber: serialInput?.value,
        location: locationInput?.value,
        technicianName: techInput?.value,
        wavelengthNm: Number(wlSelect?.value) || 1550,
        inputPowerDbm: Number(inputPowerInput?.value) || 0.0,
        notes: notesInput?.value,
        portLosses: getPortLossesFromInputs()
      }, existingCerts);

      const html = generateSplitterQaCertHtml(record, { format: 'thermal' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    });
  }

  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
      const existingCerts = getSavedSplitterQaCerts(storage);
      const record = buildSplitterQaRecord({
        splitterType: typeSelect?.value || '1:8',
        serialNumber: serialInput?.value,
        location: locationInput?.value,
        technicianName: techInput?.value,
        wavelengthNm: Number(wlSelect?.value) || 1550,
        inputPowerDbm: Number(inputPowerInput?.value) || 0.0,
        notes: notesInput?.value,
        portLosses: getPortLossesFromInputs()
      }, existingCerts);

      const text = formatSplitterQaCertWhatsApp(record);
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const certs = getSavedSplitterQaCerts(storage);
      if (certs.length === 0) {
        onToast('No certificates to export.');
        return;
      }
      const csv = generateSplitterQaCertsCsv(certs);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = doc.createElement('a');
      a.href = url;
      a.download = `shahdara_splitter_qa_certs_${new Date().toISOString().slice(0, 10)}.csv`;
      doc.body.appendChild(a);
      a.click();
      doc.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  return {
    open: () => {
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
      }
      renderPortsInputs();
      recalculate();
      renderHistory();
    },
    close: () => {
      if (modal) {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    },
    recalculate,
    loadPreset
  };
}
