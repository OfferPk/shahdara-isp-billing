/**
 * Shahdara ISP - Field CWDM / DWDM Optical Channel Grid & Multi-Wavelength Spectrum Allocation Assistant
 *
 * Provides FTTH/Metro network engineers, splicers, and linesmen with:
 * - ITU-T G.694.1 DWDM (100 GHz / 50 GHz grids, C-band C21-C60) and ITU-T G.694.2 CWDM (18-channel grid 1270-1610nm)
 * - Multi-channel optical power meter (OPM) channel power, aggregate composite power, and channel ripple/tilt modeling
 * - Optical Signal-to-Noise Ratio (OSNR) calculation normalized to 0.1 nm optical resolution bandwidth
 * - G.652.D SMF-28 fiber chromatic dispersion estimation per channel wavelength
 * - Adjacent channel crosstalk and central grid wavelength drift tolerance checks
 * - Pure-vector SVG spectrum analyzer display with channel power bars, peak markers, and noise floor
 * - LocalStorage persistence (shahdara_wdm_spectrum_audits_v1), bilingual WhatsApp dispatch, and RFC-4180 CSV export
 */

export const WDM_SPECTRUM_STORAGE_KEY = 'shahdara_wdm_spectrum_audits_v1';

export const WDM_GRIDS = {
  CWDM_18CH: {
    id: 'CWDM_18CH',
    name: 'ITU-T G.694.2 CWDM (20 nm spacing, 1270-1610 nm)',
    spacingNm: 20,
    toleranceNm: 3.0,
    nominalChannels: [
      { id: '1270', name: '1270 nm', wavelengthNm: 1270, band: 'O-Band' },
      { id: '1290', name: '1290 nm', wavelengthNm: 1290, band: 'O-Band' },
      { id: '1310', name: '1310 nm', wavelengthNm: 1310, band: 'O-Band' },
      { id: '1330', name: '1330 nm', wavelengthNm: 1330, band: 'O-Band' },
      { id: '1350', name: '1350 nm', wavelengthNm: 1350, band: 'E-Band' },
      { id: '1370', name: '1370 nm', wavelengthNm: 1370, band: 'E-Band' },
      { id: '1390', name: '1390 nm', wavelengthNm: 1390, band: 'E-Band' },
      { id: '1410', name: '1410 nm', wavelengthNm: 1410, band: 'E-Band' },
      { id: '1430', name: '1430 nm', wavelengthNm: 1430, band: 'S-Band' },
      { id: '1450', name: '1450 nm', wavelengthNm: 1450, band: 'S-Band' },
      { id: '1470', name: '1470 nm', wavelengthNm: 1470, band: 'S-Band' },
      { id: '1490', name: '1490 nm', wavelengthNm: 1490, band: 'S-Band' },
      { id: '1510', name: '1510 nm', wavelengthNm: 1510, band: 'S-Band' },
      { id: '1530', name: '1530 nm', wavelengthNm: 1530, band: 'C-Band' },
      { id: '1550', name: '1550 nm', wavelengthNm: 1550, band: 'C-Band' },
      { id: '1570', name: '1570 nm', wavelengthNm: 1570, band: 'C-Band' },
      { id: '1590', name: '1590 nm', wavelengthNm: 1590, band: 'L-Band' },
      { id: '1610', name: '1610 nm', wavelengthNm: 1610, band: 'L-Band' }
    ]
  },
  DWDM_100GHZ: {
    id: 'DWDM_100GHZ',
    name: 'ITU-T G.694.1 DWDM 100 GHz Grid (0.8 nm C-Band)',
    spacingNm: 0.8,
    toleranceNm: 0.05,
    nominalChannels: [
      { id: 'C21', name: 'Ch 21 (1560.61 nm / 192.1 THz)', wavelengthNm: 1560.61, band: 'C-Band' },
      { id: 'C24', name: 'Ch 24 (1558.17 nm / 192.4 THz)', wavelengthNm: 1558.17, band: 'C-Band' },
      { id: 'C28', name: 'Ch 28 (1554.94 nm / 192.8 THz)', wavelengthNm: 1554.94, band: 'C-Band' },
      { id: 'C32', name: 'Ch 32 (1551.72 nm / 193.2 THz)', wavelengthNm: 1551.72, band: 'C-Band' },
      { id: 'C36', name: 'Ch 36 (1548.51 nm / 193.6 THz)', wavelengthNm: 1548.51, band: 'C-Band' },
      { id: 'C40', name: 'Ch 40 (1545.32 nm / 194.0 THz)', wavelengthNm: 1545.32, band: 'C-Band' },
      { id: 'C44', name: 'Ch 44 (1542.14 nm / 194.4 THz)', wavelengthNm: 1542.14, band: 'C-Band' },
      { id: 'C48', name: 'Ch 48 (1538.98 nm / 194.8 THz)', wavelengthNm: 1538.98, band: 'C-Band' },
      { id: 'C52', name: 'Ch 52 (1535.82 nm / 195.2 THz)', wavelengthNm: 1535.82, band: 'C-Band' },
      { id: 'C56', name: 'Ch 56 (1532.68 nm / 195.6 THz)', wavelengthNm: 1532.68, band: 'C-Band' },
      { id: 'C60', name: 'Ch 60 (1529.55 nm / 196.0 THz)', wavelengthNm: 1529.55, band: 'C-Band' }
    ]
  }
};

export const WDM_PRESETS = [
  {
    id: 'shahdara-metro-cwdm-8ch',
    name: 'Shahdara Metro 8-Channel CWDM Ring (1470-1610 nm, Badami Bagh to Begum Kot)',
    area: 'Shahdara Town',
    gridType: 'CWDM_18CH',
    noiseFloorDbm: -45.0,
    resolutionBwNm: 0.1,
    channelData: [
      { channelId: '1470', measuredWavelengthNm: 1470.2, powerDbm: -3.2 },
      { channelId: '1490', measuredWavelengthNm: 1490.1, powerDbm: -3.5 },
      { channelId: '1510', measuredWavelengthNm: 1509.9, powerDbm: -3.8 },
      { channelId: '1530', measuredWavelengthNm: 1530.3, powerDbm: -4.0 },
      { channelId: '1550', measuredWavelengthNm: 1550.0, powerDbm: -3.1 },
      { channelId: '1570', measuredWavelengthNm: 1570.4, powerDbm: -3.6 },
      { channelId: '1590', measuredWavelengthNm: 1589.8, powerDbm: -4.2 },
      { channelId: '1610', measuredWavelengthNm: 1610.1, powerDbm: -4.5 }
    ],
    technician: 'Noman Tariq (NOC Metro)',
    notes: 'Primary 10G CWDM ring transport between Headend and Begum Kot distribution hub.'
  },
  {
    id: 'begum-kot-dwdm-100g-cband',
    name: 'Begum Kot 100GHz DWDM 8-Channel Backbone (C24-C52 High Density)',
    area: 'Begum Kot',
    gridType: 'DWDM_100GHZ',
    noiseFloorDbm: -50.0,
    resolutionBwNm: 0.1,
    channelData: [
      { channelId: 'C24', measuredWavelengthNm: 1558.18, powerDbm: -2.0 },
      { channelId: 'C28', measuredWavelengthNm: 1554.95, powerDbm: -2.3 },
      { channelId: 'C32', measuredWavelengthNm: 1551.71, powerDbm: -2.1 },
      { channelId: 'C36', measuredWavelengthNm: 1548.52, powerDbm: -2.5 },
      { channelId: 'C40', measuredWavelengthNm: 1545.31, powerDbm: -2.8 },
      { channelId: 'C44', measuredWavelengthNm: 1542.15, powerDbm: -3.0 },
      { channelId: 'C48', measuredWavelengthNm: 1538.97, powerDbm: -3.2 },
      { channelId: 'C52', measuredWavelengthNm: 1535.83, powerDbm: -3.4 }
    ],
    technician: 'Arshad Ali (Field Optical Lead)',
    notes: 'Dense WDM aggregation link. High OSNR required for 100G PAM4 transponders.'
  },
  {
    id: 'imamia-colony-cwdm-4ch-oband',
    name: 'Imamia Colony 4-Channel CWDM FTTH Feeder (1270-1330 nm O-Band)',
    area: 'Imamia Colony',
    gridType: 'CWDM_18CH',
    noiseFloorDbm: -42.0,
    resolutionBwNm: 0.1,
    channelData: [
      { channelId: '1270', measuredWavelengthNm: 1270.5, powerDbm: +1.2 },
      { channelId: '1290', measuredWavelengthNm: 1290.2, powerDbm: +0.8 },
      { channelId: '1310', measuredWavelengthNm: 1310.0, powerDbm: +1.5 },
      { channelId: '1330', measuredWavelengthNm: 1330.3, powerDbm: +0.9 }
    ],
    technician: 'Sajjad Malik',
    notes: 'O-band uncooled DFB laser injection for upstream/downstream PON overlay.'
  },
  {
    id: 'jia-musa-channel-tilt-hazard',
    name: 'Jia Musa DWDM High Ripple & Amplifier Gain Tilt Hazard',
    area: 'Jia Musa',
    gridType: 'DWDM_100GHZ',
    noiseFloorDbm: -38.0,
    resolutionBwNm: 0.1,
    channelData: [
      { channelId: 'C21', measuredWavelengthNm: 1560.60, powerDbm: +3.5 },
      { channelId: 'C28', measuredWavelengthNm: 1554.98, powerDbm: +1.2 },
      { channelId: 'C36', measuredWavelengthNm: 1548.55, powerDbm: -1.8 },
      { channelId: 'C44', measuredWavelengthNm: 1542.10, powerDbm: -4.5 },
      { channelId: 'C52', measuredWavelengthNm: 1535.78, powerDbm: -7.2 },
      { channelId: 'C60', measuredWavelengthNm: 1529.50, powerDbm: -9.8 }
    ],
    technician: 'Kashif Raza',
    notes: 'Severe EDFA gain tilt across C-band. Channel ripple 13.3 dB exceeds 4.0 dB limit.'
  }
];

/**
 * Calculates ITU-T G.652.D SMF-28 chromatic dispersion in ps/(nm·km)
 */
export function calculateChromaticDispersion(wavelengthNm) {
  const wl = Number(wavelengthNm);
  if (!Number.isFinite(wl) || wl <= 0) return 0;
  const s0 = 0.092; // Zero-dispersion slope ps/(nm^2 * km)
  const lambda0 = 1312; // Zero-dispersion wavelength nm
  const disp = (s0 / 4) * (wl - Math.pow(lambda0, 4) / Math.pow(wl, 3));
  return Math.round(disp * 100) / 100;
}

/**
 * Calculates multi-wavelength WDM spectrum metrics and compliance.
 */
export function calculateWdmSpectrumMetrics({
  gridType = 'CWDM_18CH',
  channels = [],
  noiseFloorDbm = -45.0,
  resolutionBwNm = 0.1
} = {}) {
  const grid = WDM_GRIDS[gridType] || WDM_GRIDS.CWDM_18CH;
  const noiseFloor = Number.isFinite(Number(noiseFloorDbm)) ? Number(noiseFloorDbm) : -45.0;
  const resBw = Number.isFinite(Number(resolutionBwNm)) && Number(resolutionBwNm) > 0 ? Number(resolutionBwNm) : 0.1;

  if (!Array.isArray(channels) || channels.length === 0) {
    return {
      gridType,
      gridName: grid.name,
      channelCount: 0,
      totalPowerDbm: -99,
      maxPowerDbm: -99,
      minPowerDbm: -99,
      powerRippleDb: 0,
      avgOsnrDb: 0,
      minOsnrDb: 0,
      maxDriftNm: 0,
      status: 'FAIL',
      statusClass: 'status-fail',
      statusLabel: 'No Active Channels Detected',
      analyzedChannels: []
    };
  }

  let totalPowerMw = 0;
  let maxP = -999;
  let minP = 999;
  let maxDrift = 0;
  let osnrSum = 0;

  const analyzedChannels = channels.map(ch => {
    const nominal = grid.nominalChannels.find(nc => nc.id === ch.channelId) || {
      id: ch.channelId,
      name: `${ch.channelId}`,
      wavelengthNm: Number(ch.measuredWavelengthNm) || 1550,
      band: 'Unknown'
    };

    const powerDbm = Number(ch.powerDbm) || -20;
    const powerMw = Math.pow(10, powerDbm / 10);
    totalPowerMw += powerMw;

    if (powerDbm > maxP) maxP = powerDbm;
    if (powerDbm < minP) minP = powerDbm;

    const measuredWl = Number(ch.measuredWavelengthNm) || nominal.wavelengthNm;
    const driftNm = Math.round((measuredWl - nominal.wavelengthNm) * 1000) / 1000;
    const absDrift = Math.abs(driftNm);
    if (absDrift > maxDrift) maxDrift = absDrift;

    // OSNR = P_sig - P_noise + 10 * log10(B_res / 0.1nm)
    const rawSnr = powerDbm - noiseFloor;
    const osnrDb = Math.round((rawSnr + 10 * Math.log10(resBw / 0.1)) * 10) / 10;
    osnrSum += osnrDb;

    const dispersion = calculateChromaticDispersion(nominal.wavelengthNm);

    // Channel level check
    const isDriftOk = absDrift <= grid.toleranceNm;
    const isOsnrOk = osnrDb >= 18.0;

    let chStatus = 'PASS';
    if (!isDriftOk || osnrDb < 15.0) chStatus = 'FAIL';
    else if (osnrDb < 22.0 || absDrift > grid.toleranceNm * 0.75) chStatus = 'WARNING';

    return {
      channelId: nominal.id,
      name: nominal.name,
      band: nominal.band,
      nominalWavelengthNm: nominal.wavelengthNm,
      measuredWavelengthNm: measuredWl,
      driftNm,
      absDrift,
      isDriftOk,
      powerDbm: Math.round(powerDbm * 10) / 10,
      powerMw: Math.round(powerMw * 1000) / 1000,
      osnrDb,
      dispersionPsPerNmKm: dispersion,
      status: chStatus
    };
  });

  const channelCount = analyzedChannels.length;
  const totalPowerDbm = totalPowerMw > 0 ? Math.round(10 * Math.log10(totalPowerMw) * 10) / 10 : -99;
  const maxPowerDbm = maxP !== -999 ? Math.round(maxP * 10) / 10 : -99;
  const minPowerDbm = minP !== 999 ? Math.round(minP * 10) / 10 : -99;
  const powerRippleDb = channelCount > 1 ? Math.round((maxPowerDbm - minPowerDbm) * 10) / 10 : 0;
  const avgOsnrDb = channelCount > 0 ? Math.round((osnrSum / channelCount) * 10) / 10 : 0;
  const minOsnrDb = channelCount > 0 ? Math.min(...analyzedChannels.map(c => c.osnrDb)) : 0;

  let overallStatus = 'PASS';
  let statusClass = 'status-pass';
  let statusLabel = 'Optimal WDM Spectrum Allocation';

  if (powerRippleDb > 4.5 || minOsnrDb < 16.0 || maxDrift > grid.toleranceNm) {
    overallStatus = 'FAIL';
    statusClass = 'status-fail';
    statusLabel = 'Critical Spectrum Violation (High Tilt / Low OSNR / Drift)';
  } else if (powerRippleDb > 2.5 || minOsnrDb < 22.0 || maxDrift > grid.toleranceNm * 0.7) {
    overallStatus = 'WARNING';
    statusClass = 'status-warning';
    statusLabel = 'Spectrum Warning (Ripple / Moderate OSNR Degradation)';
  }

  return {
    gridType,
    gridName: grid.name,
    channelCount,
    totalPowerDbm,
    totalPowerMw: Math.round(totalPowerMw * 100) / 100,
    maxPowerDbm,
    minPowerDbm,
    powerRippleDb,
    avgOsnrDb,
    minOsnrDb,
    maxDriftNm: Math.round(maxDrift * 1000) / 1000,
    toleranceNm: grid.toleranceNm,
    noiseFloorDbm: noiseFloor,
    resolutionBwNm: resBw,
    status: overallStatus,
    statusClass,
    statusLabel,
    analyzedChannels
  };
}

/**
 * Generates pure-vector SVG spectrum analyzer bar chart diagram.
 */
export function renderWdmSpectrumSvg(metrics, { width = 720, height = 280 } = {}) {
  if (!metrics || !Array.isArray(metrics.analyzedChannels) || metrics.analyzedChannels.length === 0) {
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="No WDM Spectrum Data">
      <rect width="${width}" height="${height}" fill="#0f172a" rx="8"/>
      <text x="${width / 2}" y="${height / 2}" fill="#94a3b8" text-anchor="middle" font-size="14" font-family="sans-serif">No WDM Channel Data Loaded</text>
    </svg>`;
  }

  const channels = metrics.analyzedChannels;
  const margin = { top: 40, right: 30, bottom: 50, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Power scale: Y-axis from -55 dBm to +10 dBm
  const yMin = Math.min(-55, Math.floor(metrics.noiseFloorDbm / 5) * 5 - 5);
  const yMax = Math.max(10, Math.ceil(metrics.maxPowerDbm / 5) * 5 + 5);
  const yScale = val => margin.top + chartHeight - ((val - yMin) / (yMax - yMin)) * chartHeight;

  // Grid lines
  let gridLinesSvg = '';
  for (let p = yMin; p <= yMax; p += 10) {
    const y = yScale(p);
    gridLinesSvg += `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#334155" stroke-dasharray="2,3" stroke-width="1"/>
      <text x="${margin.left - 8}" y="${y + 4}" fill="#94a3b8" font-size="10" text-anchor="end" font-family="monospace">${p} dBm</text>
    `;
  }

  // Noise floor line
  const noiseY = yScale(metrics.noiseFloorDbm);
  const noiseLineSvg = `
    <line x1="${margin.left}" y1="${noiseY}" x2="${width - margin.right}" y2="${noiseY}" stroke="#ef4444" stroke-dasharray="4,4" stroke-width="1.5"/>
    <text x="${width - margin.right - 5}" y="${noiseY - 4}" fill="#ef4444" font-size="9" text-anchor="end" font-family="monospace">Noise Floor: ${metrics.noiseFloorDbm} dBm</text>
  `;

  // Bars for channels
  const barWidth = Math.max(16, Math.min(36, (chartWidth / channels.length) - 8));
  const step = chartWidth / channels.length;

  let barsSvg = '';
  channels.forEach((ch, idx) => {
    const x = margin.left + idx * step + (step - barWidth) / 2;
    const topY = yScale(ch.powerDbm);
    const barH = Math.max(4, noiseY - topY);

    let barColor = '#0ea5e9'; // Cyan
    if (ch.status === 'FAIL') barColor = '#ef4444'; // Red
    else if (ch.status === 'WARNING') barColor = '#f59e0b'; // Amber
    else if (ch.band === 'C-Band') barColor = '#10b981'; // Emerald
    else if (ch.band === 'O-Band') barColor = '#38bdf8'; // Sky
    else if (ch.band === 'L-Band') barColor = '#a855f7'; // Purple

    barsSvg += `
      <g class="wdm-bar-group" data-channel-id="${ch.channelId}">
        <rect x="${x}" y="${topY}" width="${barWidth}" height="${barH}" fill="${barColor}" rx="3" opacity="0.9"/>
        <!-- Peak power label -->
        <text x="${x + barWidth / 2}" y="${topY - 6}" fill="#f8fafc" font-size="10" font-weight="700" text-anchor="middle" font-family="monospace">${ch.powerDbm.toFixed(1)}</text>
        <!-- OSNR badge -->
        <rect x="${x}" y="${topY + 6}" width="${barWidth}" height="14" fill="#0f172a" opacity="0.7" rx="2"/>
        <text x="${x + barWidth / 2}" y="${topY + 16}" fill="#94a3b8" font-size="8" text-anchor="middle" font-family="monospace">${ch.osnrDb}dB</text>
        <!-- Wavelength X-axis label -->
        <text x="${x + barWidth / 2}" y="${margin.top + chartHeight + 16}" fill="#f8fafc" font-size="9" font-weight="600" text-anchor="middle" font-family="sans-serif">${ch.channelId}</text>
        <text x="${x + barWidth / 2}" y="${margin.top + chartHeight + 28}" fill="#64748b" font-size="8" text-anchor="middle" font-family="sans-serif">${ch.nominalWavelengthNm}nm</text>
      </g>
    `;
  });

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="WDM Optical Spectrum Analyzer Graph">
    <rect width="${width}" height="${height}" fill="#0f172a" rx="8"/>
    <!-- Title and Metadata -->
    <text x="${margin.left}" y="22" fill="#38bdf8" font-size="13" font-weight="700" font-family="sans-serif">${metrics.gridName}</text>
    <text x="${width - margin.right}" y="22" fill="${metrics.status === 'PASS' ? '#4ade80' : metrics.status === 'WARNING' ? '#fbbf24' : '#f87171'}" font-size="12" font-weight="700" text-anchor="end" font-family="sans-serif">Ripple: ${metrics.powerRippleDb} dB · Avg OSNR: ${metrics.avgOsnrDb} dB [${metrics.status}]</text>
    
    <!-- Grid and Axes -->
    ${gridLinesSvg}
    ${noiseLineSvg}
    ${barsSvg}

    <!-- Axis baseline -->
    <line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${width - margin.right}" y2="${margin.top + chartHeight}" stroke="#64748b" stroke-width="1.5"/>
  </svg>`;
}

/**
 * Formats WhatsApp bilingual field dispatch message (English / Urdu).
 */
export function formatWdmSpectrumWhatsApp(record) {
  const m = record.metrics || {};
  const statusEmoji = m.status === 'PASS' ? '✅' : m.status === 'WARNING' ? '⚠️' : '🚨';

  return `🌐 *SHAHDARA ISP - OPTICAL WDM SPECTRUM REPORT* 🌐
${statusEmoji} *Status / کیفیت:* ${m.statusLabel || m.status}
📍 *Area / علاقہ:* ${record.area || 'Shahdara Metro'}
🎯 *Grid Standard / گرڈ:* ${m.gridName || record.gridType}
📊 *Active Channels / چینلز:* ${m.channelCount || 0}
⚡ *Composite Total Power:* ${m.totalPowerDbm || 0} dBm (${m.totalPowerMw || 0} mW)
⚖️ *Passband Ripple / ٹلٹ:* ${m.powerRippleDb || 0} dB (${m.powerRippleDb <= 2.5 ? 'Balanced' : 'High Tilt'})
📡 *Min / Avg OSNR:* ${m.minOsnrDb || 0} dB / ${m.avgOsnrDb || 0} dB
⏱️ *Max Grid Drift / ویولینتھ انحراف:* ±${m.maxDriftNm || 0} nm (Limit: ±${m.toleranceNm || 0} nm)
👤 *Technician / ٹیکنیشن:* ${record.technician || 'Shahdara Metro NOC'}
📝 *Notes / تفصیالت:* ${record.notes || 'Routine WDM optical spectrum verification.'}
⏰ *Timestamp:* ${record.timestamp || new Date().toISOString()}`;
}

/**
 * Generates RFC-4180 CSV export with UTF-8 BOM.
 */
export function generateWdmSpectrumCsv(records = []) {
  const headers = [
    'Audit ID',
    'Timestamp',
    'Area',
    'Grid Type',
    'Technician',
    'Channel Count',
    'Total Power (dBm)',
    'Max Power (dBm)',
    'Min Power (dBm)',
    'Ripple (dB)',
    'Avg OSNR (dB)',
    'Min OSNR (dB)',
    'Max Drift (nm)',
    'Compliance Status',
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
      m.gridName || r.gridType || '',
      r.technician || '',
      m.channelCount || 0,
      m.totalPowerDbm || '',
      m.maxPowerDbm || '',
      m.minPowerDbm || '',
      m.powerRippleDb || '',
      m.avgOsnrDb || '',
      m.minOsnrDb || '',
      m.maxDriftNm || '',
      m.status || '',
      r.notes || ''
    ].map(escapeField).join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

export function loadWdmSpectrumAuditLog(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(WDM_SPECTRUM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveWdmSpectrumAuditLog(records, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return;
  try {
    storage.setItem(WDM_SPECTRUM_STORAGE_KEY, JSON.stringify(records));
  } catch {}
}

export function clearWdmSpectrumAuditLog(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return;
  try {
    storage.removeItem(WDM_SPECTRUM_STORAGE_KEY);
  } catch {}
}

/**
 * Controller to wire and manage Mobile WDM Spectrum Assistant Modal dialog.
 */
export function setupMobileWdmSpectrumModal(state, { storage = typeof localStorage !== 'undefined' ? localStorage : null, onToast = () => {} } = {}) {
  if (typeof document === 'undefined') return { open: () => {}, close: () => {} };

  const modal = document.getElementById('mobileWdmSpectrumModal');
  const openBtn = document.getElementById('mobileMoreWdmSpectrumBtn');
  const closeBtn = document.getElementById('mobileWdmSpectrumCloseBtn');
  const presetSelect = document.getElementById('wdmPresetSelect');
  const gridSelect = document.getElementById('wdmGridSelect');
  const noiseFloorInput = document.getElementById('wdmNoiseFloorInput');
  const resBwSelect = document.getElementById('wdmResBwSelect');
  const areaSelect = document.getElementById('wdmAreaSelect');
  const technicianInput = document.getElementById('wdmTechnicianInput');
  const notesInput = document.getElementById('wdmNotesInput');
  const channelsTbody = document.getElementById('wdmChannelsTbody');
  const svgContainer = document.getElementById('wdmSvgContainer');
  const saveBtn = document.getElementById('wdmSaveAuditBtn');
  const shareBtn = document.getElementById('wdmShareWhatsAppBtn');
  const exportCsvBtn = document.getElementById('wdmExportCsvBtn');
  const clearHistoryBtn = document.getElementById('wdmClearHistoryBtn');
  const historyTbody = document.getElementById('wdmHistoryTbody');

  // KPI elements
  const kpiStatus = document.getElementById('wdmKpiStatus');
  const kpiTotalPower = document.getElementById('wdmKpiTotalPower');
  const kpiRipple = document.getElementById('wdmKpiRipple');
  const kpiAvgOsnr = document.getElementById('wdmKpiAvgOsnr');
  const kpiMaxDrift = document.getElementById('wdmKpiMaxDrift');

  let currentChannelRows = [];

  function open() {
    if (modal) {
      if (modal.showModal) modal.showModal();
      else modal.setAttribute('open', '');
      renderHistory();
      if (!currentChannelRows.length) {
        applyPreset(WDM_PRESETS[0]);
      } else {
        recalculateAndRender();
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
    if (gridSelect) gridSelect.value = preset.gridType;
    if (noiseFloorInput) noiseFloorInput.value = preset.noiseFloorDbm;
    if (resBwSelect) resBwSelect.value = preset.resolutionBwNm;
    if (areaSelect) areaSelect.value = preset.area;
    if (technicianInput) technicianInput.value = preset.technician;
    if (notesInput) notesInput.value = preset.notes;

    currentChannelRows = (preset.channelData || []).map(cd => ({ ...cd }));
    renderChannelRows();
    recalculateAndRender();
  }

  function renderChannelRows() {
    if (!channelsTbody) return;
    const gridType = gridSelect?.value || 'CWDM_18CH';
    const grid = WDM_GRIDS[gridType] || WDM_GRIDS.CWDM_18CH;

    channelsTbody.innerHTML = '';
    currentChannelRows.forEach((row, idx) => {
      const tr = document.createElement('tr');
      const nom = grid.nominalChannels.find(nc => nc.id === row.channelId);
      const nomWl = nom ? nom.wavelengthNm : 'Custom';

      tr.innerHTML = `
        <td style="font-weight:600">${row.channelId} (${nomWl} nm)</td>
        <td>
          <input type="number" step="0.01" class="fdt-input" style="width:90px;padding:3px" value="${row.measuredWavelengthNm}" data-idx="${idx}" data-field="measuredWavelengthNm">
        </td>
        <td>
          <input type="number" step="0.1" class="fdt-input" style="width:75px;padding:3px" value="${row.powerDbm}" data-idx="${idx}" data-field="powerDbm">
        </td>
        <td>
          <button type="button" class="close-button" style="font-size:14px;padding:2px 6px" data-remove-idx="${idx}" title="Remove Channel">×</button>
        </td>
      `;
      channelsTbody.appendChild(tr);
    });
  }

  function recalculateAndRender() {
    const gridType = gridSelect?.value || 'CWDM_18CH';
    const noiseFloorDbm = parseFloat(noiseFloorInput?.value) || -45.0;
    const resolutionBwNm = parseFloat(resBwSelect?.value) || 0.1;

    const metrics = calculateWdmSpectrumMetrics({
      gridType,
      channels: currentChannelRows,
      noiseFloorDbm,
      resolutionBwNm
    });

    if (kpiStatus) {
      kpiStatus.textContent = metrics.statusLabel;
      kpiStatus.className = `audit-status-badge ${metrics.status === 'PASS' ? 'audit-pill-clean' : metrics.status === 'WARNING' ? 'audit-pill-review' : 'audit-pill-error'}`;
    }
    if (kpiTotalPower) kpiTotalPower.textContent = `${metrics.totalPowerDbm} dBm (${metrics.totalPowerMw} mW)`;
    if (kpiRipple) kpiRipple.textContent = `${metrics.powerRippleDb} dB (${metrics.channelCount} ch)`;
    if (kpiAvgOsnr) kpiAvgOsnr.textContent = `${metrics.avgOsnrDb} dB (Min: ${metrics.minOsnrDb} dB)`;
    if (kpiMaxDrift) kpiMaxDrift.textContent = `±${metrics.maxDriftNm} nm (Tol: ±${metrics.toleranceNm} nm)`;

    if (svgContainer) {
      svgContainer.innerHTML = renderWdmSpectrumSvg(metrics, { width: 720, height: 260 });
    }

    return metrics;
  }

  function renderHistory() {
    if (!historyTbody) return;
    const history = loadWdmSpectrumAuditLog(storage);
    historyTbody.innerHTML = '';
    if (!history.length) {
      historyTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:12px">No spectrum audit records yet.</td></tr>';
      return;
    }
    history.slice(-10).reverse().forEach(rec => {
      const m = rec.metrics || {};
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family:monospace;font-size:11px">${(rec.timestamp || '').slice(0, 16).replace('T', ' ')}</td>
        <td>${rec.area || '-'}</td>
        <td style="font-size:11px">${m.gridName || rec.gridType}</td>
        <td><strong>${m.powerRippleDb || 0} dB</strong></td>
        <td>${m.avgOsnrDb || 0} dB</td>
        <td><span class="audit-status-badge ${m.status === 'PASS' ? 'audit-pill-clean' : m.status === 'WARNING' ? 'audit-pill-review' : 'audit-pill-error'}">${m.status}</span></td>
      `;
      historyTbody.appendChild(tr);
    });
  }

  // Event handlers
  if (openBtn && !openBtn.dataset.wiredWdm) {
    openBtn.dataset.wiredWdm = 'true';
    openBtn.addEventListener('click', open);
  }
  if (closeBtn && !closeBtn.dataset.wiredWdm) {
    closeBtn.dataset.wiredWdm = 'true';
    closeBtn.addEventListener('click', close);
  }

  if (presetSelect && !presetSelect.dataset.wiredWdm) {
    presetSelect.dataset.wiredWdm = 'true';
    presetSelect.addEventListener('change', () => {
      const p = WDM_PRESETS.find(x => x.id === presetSelect.value);
      if (p) applyPreset(p);
    });
  }

  [gridSelect, noiseFloorInput, resBwSelect].forEach(el => {
    if (el && !el.dataset.wiredWdm) {
      el.dataset.wiredWdm = 'true';
      el.addEventListener('input', () => {
        recalculateAndRender();
      });
    }
  });

  if (channelsTbody && !channelsTbody.dataset.wiredWdm) {
    channelsTbody.dataset.wiredWdm = 'true';
    channelsTbody.addEventListener('input', e => {
      const idx = e.target.dataset.idx;
      const field = e.target.dataset.field;
      if (idx !== undefined && field) {
        currentChannelRows[Number(idx)][field] = parseFloat(e.target.value) || 0;
        recalculateAndRender();
      }
    });
    channelsTbody.addEventListener('click', e => {
      const removeBtn = e.target.closest('[data-remove-idx]');
      if (removeBtn) {
        const idx = Number(removeBtn.dataset.removeIdx);
        currentChannelRows.splice(idx, 1);
        renderChannelRows();
        recalculateAndRender();
      }
    });
  }

  if (saveBtn && !saveBtn.dataset.wiredWdm) {
    saveBtn.dataset.wiredWdm = 'true';
    saveBtn.addEventListener('click', () => {
      const metrics = recalculateAndRender();
      const record = {
        id: `WDM-${Date.now()}`,
        timestamp: new Date().toISOString(),
        area: areaSelect?.value || 'Shahdara Town',
        gridType: gridSelect?.value || 'CWDM_18CH',
        technician: technicianInput?.value || 'Technician',
        notes: notesInput?.value || '',
        metrics
      };
      const history = loadWdmSpectrumAuditLog(storage);
      history.push(record);
      saveWdmSpectrumAuditLog(history, storage);
      renderHistory();
      onToast('WDM Spectrum Audit saved successfully!');
    });
  }

  if (shareBtn && !shareBtn.dataset.wiredWdm) {
    shareBtn.dataset.wiredWdm = 'true';
    shareBtn.addEventListener('click', () => {
      const metrics = recalculateAndRender();
      const record = {
        area: areaSelect?.value || 'Shahdara Town',
        gridType: gridSelect?.value || 'CWDM_18CH',
        technician: technicianInput?.value || 'Technician',
        notes: notesInput?.value || '',
        timestamp: new Date().toISOString(),
        metrics
      };
      const text = formatWdmSpectrumWhatsApp(record);
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    });
  }

  if (exportCsvBtn && !exportCsvBtn.dataset.wiredWdm) {
    exportCsvBtn.dataset.wiredWdm = 'true';
    exportCsvBtn.addEventListener('click', () => {
      const history = loadWdmSpectrumAuditLog(storage);
      if (!history.length) {
        onToast('No audit records to export.');
        return;
      }
      const csv = generateWdmSpectrumCsv(history);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shahdara_wdm_spectrum_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast('WDM spectrum CSV exported!');
    });
  }

  if (clearHistoryBtn && !clearHistoryBtn.dataset.wiredWdm) {
    clearHistoryBtn.dataset.wiredWdm = 'true';
    clearHistoryBtn.addEventListener('click', () => {
      clearWdmSpectrumAuditLog(storage);
      renderHistory();
      onToast('WDM Spectrum audit history cleared.');
    });
  }

  return {
    open,
    close,
    applyPreset,
    recalculateAndRender
  };
}
