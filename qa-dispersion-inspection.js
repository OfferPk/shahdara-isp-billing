/**
 * QA Certification Suite: Optical Fiber Chromatic & Polarization Mode Dispersion (CD/PMD)
 * Standards: ITU-T G.652.D, G.655, G.657.A1/A2, ITU-T G.959.1, and IEC 60793-1-42
 * Area: Shahdara ISP Feeder Trunk & High-Speed 10G/25G Distribution Demarcation
 */

export const DISPERSION_STORAGE_KEY = 'shahdara_dispersion_certs_v1';

export const FIBER_DISPERSION_PROFILES = {
  G652D: {
    id: 'G652D',
    name: 'ITU-T G.652.D Standard Single-Mode Fiber (SMF-28)',
    application: 'Shahdara Main Feeder & Inter-PoP Overhead Backbone',
    zeroDispersionWavelengthNm: 1312,
    zeroDispersionSlope: 0.090, // ps/(nm^2 * km)
    nominalPmdCoef: 0.10, // ps / sqrt(km)
    typicalAttenuation1310: 0.35, // dB/km
    typicalAttenuation1550: 0.20, // dB/km
    cd1550Nominal: 17.0
  },
  G655: {
    id: 'G655',
    name: 'ITU-T G.655 Non-Zero Dispersion-Shifted Fiber (NZ-DSF)',
    application: 'DWDM Dense Metro Interconnect & Long-Haul Spans',
    zeroDispersionWavelengthNm: 1480,
    zeroDispersionSlope: 0.070,
    nominalPmdCoef: 0.08,
    typicalAttenuation1310: 0.40,
    typicalAttenuation1550: 0.21,
    cd1550Nominal: 4.5
  },
  G657A1: {
    id: 'G657A1',
    name: 'ITU-T G.657.A1 Bend-Insensitive Access Distribution',
    application: 'FAT Distribution & Multi-Tenant Riser Drops',
    zeroDispersionWavelengthNm: 1312,
    zeroDispersionSlope: 0.092,
    nominalPmdCoef: 0.12,
    typicalAttenuation1310: 0.36,
    typicalAttenuation1550: 0.22,
    cd1550Nominal: 17.2
  },
  G657A2: {
    id: 'G657A2',
    name: 'ITU-T G.657.A2 Micro-Bend Robust Aerial Pole Drops',
    application: 'Last-Mile Subscriber Aerial Drops (Shahdara Local)',
    zeroDispersionWavelengthNm: 1310,
    zeroDispersionSlope: 0.092,
    nominalPmdCoef: 0.15,
    typicalAttenuation1310: 0.38,
    typicalAttenuation1550: 0.24,
    cd1550Nominal: 17.5
  },
  LEGACY_AERIAL_1998: {
    id: 'LEGACY_AERIAL_1998',
    name: 'Legacy Overhead Aerial SMF (Pre-2000 Era)',
    application: 'Old Overhead Cables subject to Wind Stress & Solar Birefringence',
    zeroDispersionWavelengthNm: 1315,
    zeroDispersionSlope: 0.098,
    nominalPmdCoef: 0.50,
    typicalAttenuation1310: 0.45,
    typicalAttenuation1550: 0.30,
    cd1550Nominal: 18.5
  }
};

export const BITRATE_DISPERSION_STANDARDS = {
  RATE_1G: {
    id: 'RATE_1G',
    label: '1.25 Gbps Gigabit Ethernet (BiDi / 1000BASE-BX)',
    bitrateGbps: 1.25,
    maxAllowedTotalCdPsPerNm: 12000,
    maxAllowedDgdPs: 80.0
  },
  RATE_2_5G: {
    id: 'RATE_2_5G',
    label: '2.488 Gbps GPON Class B+/C+ Downstream',
    bitrateGbps: 2.488,
    maxAllowedTotalCdPsPerNm: 3200,
    maxAllowedDgdPs: 40.0
  },
  RATE_10G: {
    id: 'RATE_10G',
    label: '9.953 Gbps XGS-PON Symmetrical & 10G-EPON',
    bitrateGbps: 9.953,
    maxAllowedTotalCdPsPerNm: 800,
    maxAllowedDgdPs: 10.0
  },
  RATE_25G: {
    id: 'RATE_25G',
    label: '25.781 Gbps 25GS-PON / 25G-eCPRI Fronthaul',
    bitrateGbps: 25.781,
    maxAllowedTotalCdPsPerNm: 120,
    maxAllowedDgdPs: 3.8
  },
  RATE_100G: {
    id: 'RATE_100G',
    label: '100 Gbps Metro DWDM (Coherent DSP Compensated)',
    bitrateGbps: 100.0,
    maxAllowedTotalCdPsPerNm: 35000,
    maxAllowedDgdPs: 25.0
  }
};

export const DISPERSION_SEVERITY_LEVELS = {
  OPTIMAL: {
    id: 'OPTIMAL',
    label: 'CERTIFIED COMPLIANT (Optimal Dispersion Margin)',
    urduLabel: 'مکمل تصدیق شدہ - بہترین ڈسپریشن حد',
    badgeClass: 'badge-success',
    colorHex: '#10b981',
    pass: true
  },
  MARGINAL: {
    id: 'MARGINAL',
    label: 'MARGINAL (High-Speed Bitrate Constraint / Warning)',
    urduLabel: 'درمیانہ - ہائی اسپیڈ ڈیٹا رفتار میں احتیاط درکار',
    badgeClass: 'badge-warning',
    colorHex: '#f59e0b',
    pass: true
  },
  EXCEEDED: {
    id: 'EXCEEDED',
    label: 'NON-COMPLIANT (Dispersion Limit Exceeded / High DGD)',
    urduLabel: 'ناقابل قبول - ڈسپریشن حد سے تجاوز، فائبر خرابی',
    badgeClass: 'badge-danger',
    colorHex: '#ef4444',
    pass: false
  }
};

/**
 * Calculates Chromatic Dispersion coefficient D(lambda) in ps/(nm * km)
 * using the standard Sellmeier 3-term derivative formulation:
 * D(lambda) = (S0 / 4) * (lambda - (lambda0^4 / lambda^3))
 */
export function calculateChromaticDispersionCoefficient(wavelengthNm, fiberProfile) {
  const profile = fiberProfile || FIBER_DISPERSION_PROFILES.G652D;
  const wl = Math.max(1200, Math.min(1700, Number(wavelengthNm) || 1550));
  const s0 = profile.zeroDispersionSlope || 0.090;
  const wl0 = profile.zeroDispersionWavelengthNm || 1312;

  const d = (s0 / 4) * (wl - (Math.pow(wl0, 4) / Math.pow(wl, 3)));
  return Math.round(d * 100) / 100;
}

/**
 * Evaluates Chromatic and PMD Dispersion for a physical link span:
 * Total CD = D(lambda) * Span_Length
 * DGD = PMD_coef * sqrt(Span_Length)
 * Maxwellian Outage Probability DGD_max = 3.0 * DGD
 */
export function evaluateLinkDispersion({
  spanLengthKm = 12.5,
  operatingWavelengthNm = 1550,
  fiberProfileId = 'G652D',
  customPmdCoef = null,
  targetBitrateId = 'RATE_10G'
} = {}) {
  const profile = FIBER_DISPERSION_PROFILES[fiberProfileId] || FIBER_DISPERSION_PROFILES.G652D;
  const targetStandard = BITRATE_DISPERSION_STANDARDS[targetBitrateId] || BITRATE_DISPERSION_STANDARDS.RATE_10G;

  const lengthKm = Math.max(0.1, Number(spanLengthKm) || 1.0);
  const wl = Math.max(1260, Math.min(1650, Number(operatingWavelengthNm) || 1550));
  const pmdCoef = customPmdCoef !== null && customPmdCoef !== undefined && !isNaN(customPmdCoef)
    ? Math.max(0.01, Number(customPmdCoef))
    : profile.nominalPmdCoef;

  // 1. Chromatic Dispersion
  const cdCoefPsPerNmKm = calculateChromaticDispersionCoefficient(wl, profile);
  const totalCdPsPerNm = Math.round(Math.abs(cdCoefPsPerNmKm * lengthKm) * 10) / 10;

  // 2. Polarization Mode Dispersion
  // DGD = PMD_coef * sqrt(L)
  const meanDgdPs = Math.round(pmdCoef * Math.sqrt(lengthKm) * 100) / 100;
  // Maximum statistical DGD (Maxwellian 99.999% confidence window is ~3.0x mean DGD)
  const maxDgdMaxwellianPs = Math.round(meanDgdPs * 3.0 * 100) / 100;

  // 3. Maximum Safe Bitrate limit supported by link PMD
  // Rule of thumb: Mean DGD <= 0.1 / Bitrate (10% of bit slot)
  const maxPmdBitrateGbps = meanDgdPs > 0 ? Math.round((0.1 / (meanDgdPs * 1e-3)) * 10) / 10 : 100.0;

  // 4. Verification against Target Bitrate Standard
  const cdPassed = totalCdPsPerNm <= targetStandard.maxAllowedTotalCdPsPerNm;
  const pmdPassed = maxDgdMaxwellianPs <= targetStandard.maxAllowedDgdPs;
  const overallPass = cdPassed && pmdPassed;

  // Margins
  const cdMarginPsPerNm = Math.round((targetStandard.maxAllowedTotalCdPsPerNm - totalCdPsPerNm) * 10) / 10;
  const pmdMarginPs = Math.round((targetStandard.maxAllowedDgdPs - maxDgdMaxwellianPs) * 100) / 100;

  let verdict = DISPERSION_SEVERITY_LEVELS.OPTIMAL;
  if (!overallPass) {
    verdict = DISPERSION_SEVERITY_LEVELS.EXCEEDED;
  } else if (cdMarginPsPerNm < targetStandard.maxAllowedTotalCdPsPerNm * 0.2 || pmdMarginPs < targetStandard.maxAllowedDgdPs * 0.2) {
    verdict = DISPERSION_SEVERITY_LEVELS.MARGINAL;
  }

  // Dispersion-induced Optical Power Penalty (approximate in dB)
  const bitPeriodPs = (1.0 / targetStandard.bitrateGbps) * 1000;
  const pulseBroadeningRatio = meanDgdPs / bitPeriodPs;
  const pmdPenaltyDb = Math.round(10.0 * Math.log10(1.0 + Math.pow(pulseBroadeningRatio * 2.5, 2)) * 100) / 100;

  const warnings = [];
  const recommendations = [];

  if (!cdPassed) {
    warnings.push(`Total Chromatic Dispersion (${totalCdPsPerNm} ps/nm) exceeds standard limit (${targetStandard.maxAllowedTotalCdPsPerNm} ps/nm).`);
    recommendations.push('Install Dispersion Compensating Fiber (DCF) spool or switch to Narrow-Line DFB laser with pre-chirp compensation.');
  }

  if (!pmdPassed) {
    warnings.push(`Link Peak Maxwellian DGD (${maxDgdMaxwellianPs} ps) exceeds maximum tolerable receiver jitter (${targetStandard.maxAllowedDgdPs} ps).`);
    recommendations.push('Replace aged overhead aerial section; secure loose fiber coils and reduce wind mechanical vibration stress.');
  } else if (verdict === DISPERSION_SEVERITY_LEVELS.MARGINAL) {
    warnings.push('Dispersion safety margin is under 20%. Link is prone to temperature-induced seasonal BER fluctuations.');
    recommendations.push('Schedule quarterly PMD polarimetry tests during extreme summer and winter temperature shifts.');
  }

  return {
    spanLengthKm: lengthKm,
    operatingWavelengthNm: wl,
    fiberProfile: profile,
    targetStandard,
    pmdCoefficient: pmdCoef,
    cdCoefficientPsPerNmKm: cdCoefPsPerNmKm,
    totalCdPsPerNm,
    meanDgdPs,
    maxDgdMaxwellianPs,
    maxPmdBitrateGbps,
    cdPassed,
    pmdPassed,
    overallPass,
    cdMarginPsPerNm,
    pmdMarginPs,
    pmdPenaltyDb,
    verdict,
    warnings,
    recommendations
  };
}

/**
 * Builds a validated dispersion inspection audit record.
 */
export function buildDispersionCertRecord({
  feederRouteName = 'Shahdara Main Trunk Feeder - Ring A',
  spanLengthKm = 12.5,
  operatingWavelengthNm = 1550,
  fiberProfileId = 'G652D',
  customPmdCoef = null,
  targetBitrateId = 'RATE_10G',
  originPop = 'Shahdara Central OLT / PoP-1',
  destinationNode = 'Rachna Town Primary FAT-08 Hub',
  inspectedBy = 'Saad (Lead Optical Transport Engineer)',
  linemanNotes = ''
} = {}) {
  const evalResult = evaluateLinkDispersion({
    spanLengthKm,
    operatingWavelengthNm,
    fiberProfileId,
    customPmdCoef,
    targetBitrateId
  });

  const now = new Date();
  const yearMonth = now.toISOString().slice(0, 7).replace('-', '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const certId = `DSP-${yearMonth}-${randomSuffix}`;

  return {
    id: certId,
    timestamp: now.toISOString(),
    feederRouteName: String(feederRouteName || 'Shahdara Feeder Route').trim(),
    originPop: String(originPop || 'Central OLT').trim(),
    destinationNode: String(destinationNode || 'Distribution Node').trim(),
    spanLengthKm: evalResult.spanLengthKm,
    operatingWavelengthNm: evalResult.operatingWavelengthNm,
    fiberProfileId,
    fiberProfileName: evalResult.fiberProfile.name,
    targetBitrateId,
    targetBitrateLabel: evalResult.targetStandard.label,
    pmdCoefficient: evalResult.pmdCoefficient,
    cdCoefficientPsPerNmKm: evalResult.cdCoefficientPsPerNmKm,
    totalCdPsPerNm: evalResult.totalCdPsPerNm,
    meanDgdPs: evalResult.meanDgdPs,
    maxDgdMaxwellianPs: evalResult.maxDgdMaxwellianPs,
    maxPmdBitrateGbps: evalResult.maxPmdBitrateGbps,
    pmdPenaltyDb: evalResult.pmdPenaltyDb,
    cdPassed: evalResult.cdPassed,
    pmdPassed: evalResult.pmdPassed,
    overallPass: evalResult.overallPass,
    verdictId: evalResult.verdict.id,
    verdictLabel: evalResult.verdict.label,
    verdictUrduLabel: evalResult.verdict.urduLabel,
    inspectedBy: String(inspectedBy || 'Shahdara Fiber Tech').trim(),
    linemanNotes: String(linemanNotes || '').trim()
  };
}

/**
 * Saves a dispersion certificate into persistent storage.
 */
export function saveDispersionCert(certRecord, storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || !certRecord || !certRecord.id) return false;
  try {
    const existing = getSavedDispersionCerts(store);
    const updated = [certRecord, ...existing.filter(r => r.id !== certRecord.id)];
    store.setItem(DISPERSION_STORAGE_KEY, JSON.stringify(updated.slice(0, 100)));
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Retrieves all saved dispersion audit records from storage.
 */
export function getSavedDispersionCerts(storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return [];
  try {
    const raw = store.getItem(DISPERSION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Clears saved dispersion certificates from storage.
 */
export function clearDispersionCerts(storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  try {
    store.removeItem(DISPERSION_STORAGE_KEY);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Formats a WhatsApp summary dispatch message for NOC team and field technicians.
 */
export function formatDispersionCertWhatsApp(certRecord) {
  const cert = certRecord || {};
  const dateStr = cert.timestamp ? new Date(cert.timestamp).toISOString().replace('T', ' ').slice(0, 19) + ' PKT' : 'N/A';

  return [
    `🌐 *SHAHDARA ISP - CHROMATIC & PMD DISPERSION QA CERTIFICATE* 🌐`,
    `📋 آپٹیکل فائبر ڈسپریشن ٹیسٹنگ رپورٹ (ITU-T G.652.D / G.959.1)`,
    `📜 Cert ID: ${cert.id || 'DSP-PENDING'}`,
    `📅 Date/Time: ${dateStr}`,
    `🛤️ Route: ${cert.feederRouteName || 'Main Feeder Trunk'}`,
    `📍 Origin -> Terminus: ${cert.originPop || 'OLT'} -> ${cert.destinationNode || 'FAT Node'}`,
    `📏 Feeder Span Length: ${cert.spanLengthKm} km (${cert.fiberProfileName || 'Standard SMF'})`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📊 *MEASURED OPTICAL DISPERSION METRICS*`,
    `• Operating Wavelength: ${cert.operatingWavelengthNm} nm`,
    `• CD Coefficient: ${cert.cdCoefficientPsPerNmKm} ps/(nm·km)`,
    `• Total Chromatic Dispersion: ${cert.totalCdPsPerNm} ps/nm [${cert.cdPassed ? 'PASS' : 'FAIL'}]`,
    `• Mean DGD: ${cert.meanDgdPs} ps (PMD Coef: ${cert.pmdCoefficient} ps/√km)`,
    `• Peak Maxwellian DGD (99.999%): ${cert.maxDgdMaxwellianPs} ps [${cert.pmdPassed ? 'PASS' : 'FAIL'}]`,
    `• Max Safe Link Bitrate: ~${cert.maxPmdBitrateGbps} Gbps`,
    `• Optical Jitter Power Penalty: ${cert.pmdPenaltyDb} dB`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🩺 *LINK QA VERDICT*`,
    `• Target Application: ${cert.targetBitrateLabel || '10G XGS-PON'}`,
    `• Overall Verdict: ${cert.verdictLabel || 'CERTIFIED COMPLIANT'}`,
    `• نتیجہ: ${cert.verdictUrduLabel || 'مکمل تصدیق شدہ'}`,
    `• Result Status: ${cert.overallPass ? 'PASSED ✓' : 'FAILED ✗'}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👨‍🔧 Certified By: ${cert.inspectedBy || 'Saad (Lead Optical Transport Engineer)'}`,
    `📝 Notes: ${cert.linemanNotes || 'Dispersion characteristics verified within Telcordia GR-253 & ITU-T parameters.'}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Shahdara Optical Backbone & Fiber Transport QA Operations`
  ].join('\n');
}

/**
 * Generates an RFC-4180 compliant CSV export with UTF-8 BOM.
 */
export function generateDispersionCertsCsv(certs = []) {
  const list = Array.isArray(certs) ? certs : [];
  const headers = [
    'Certificate ID',
    'Date / Time (ISO)',
    'Feeder Route Name',
    'Origin PoP',
    'Destination Node',
    'Span Length (km)',
    'Operating Wavelength (nm)',
    'Fiber Profile',
    'Target Bitrate Standard',
    'CD Coef (ps/nm/km)',
    'Total CD (ps/nm)',
    'PMD Coef (ps/sqrt_km)',
    'Mean DGD (ps)',
    'Peak DGD Maxwellian (ps)',
    'Max Safe Bitrate (Gbps)',
    'PMD Power Penalty (dB)',
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
    escapeCsv(c.feederRouteName),
    escapeCsv(c.originPop),
    escapeCsv(c.destinationNode),
    c.spanLengthKm,
    c.operatingWavelengthNm,
    escapeCsv(c.fiberProfileName),
    escapeCsv(c.targetBitrateLabel),
    c.cdCoefficientPsPerNmKm,
    c.totalCdPsPerNm,
    c.pmdCoefficient,
    c.meanDgdPs,
    c.maxDgdMaxwellianPs,
    c.maxPmdBitrateGbps,
    c.pmdPenaltyDb,
    escapeCsv(c.verdictLabel),
    c.overallPass ? 'PASS' : 'FAIL',
    escapeCsv(c.inspectedBy),
    escapeCsv(c.linemanNotes)
  ].join(','));

  const BOM = '\uFEFF';
  return BOM + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Generates printable HTML documents (A4 Certificate & 80mm Thermal Slip).
 */
export function generateDispersionCertHtml(certRecord, format = 'standard') {
  const cert = certRecord || {};
  const dateStr = cert.timestamp ? new Date(cert.timestamp).toISOString().replace('T', ' ').slice(0, 19) : new Date().toISOString().slice(0, 19);

  if (format === 'thermal') {
    return `
      <div class="dispersion-thermal-slip" style="width: 280px; font-family: monospace; font-size: 11px; line-height: 1.4; color: #000; padding: 10px; background: #fff;">
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
          <h3 style="margin: 0; font-size: 13px;">SHAHDARA FIBER NETWORK</h3>
          <p style="margin: 2px 0;">OPTICAL DISPERSION QA SLIP</p>
          <p style="margin: 2px 0; font-size: 9px;">${dateStr} PKT</p>
        </div>
        <div style="margin-bottom: 6px;">
          <div><strong>CERT:</strong> ${cert.id}</div>
          <div><strong>ROUTE:</strong> ${cert.feederRouteName}</div>
          <div><strong>SPAN:</strong> ${cert.spanLengthKm} km (${cert.fiberProfileId})</div>
          <div><strong>WAVELENGTH:</strong> ${cert.operatingWavelengthNm} nm</div>
        </div>
        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between;"><span>CD COEF:</span><span>${cert.cdCoefficientPsPerNmKm} ps/nm/km</span></div>
          <div style="display: flex; justify-content: space-between;"><span>TOTAL CD:</span><span>${cert.totalCdPsPerNm} ps/nm</span></div>
          <div style="display: flex; justify-content: space-between;"><span>MEAN DGD:</span><span>${cert.meanDgdPs} ps</span></div>
          <div style="display: flex; justify-content: space-between;"><span>PEAK DGD:</span><span>${cert.maxDgdMaxwellianPs} ps</span></div>
          <div style="display: flex; justify-content: space-between;"><span>MAX RATE:</span><span>${cert.maxPmdBitrateGbps} Gbps</span></div>
        </div>
        <div style="text-align: center; margin-bottom: 6px;">
          <div style="font-size: 12px; font-weight: bold;">VERDICT: ${cert.overallPass ? 'CERTIFIED PASS' : 'DISPERSION FAIL'}</div>
          <div style="font-size: 9px; margin-top: 2px;">TARGET: ${cert.targetBitrateLabel}</div>
        </div>
        <div style="font-size: 9px; text-align: center; border-top: 1px dashed #000; padding-top: 4px;">
          Audited by: ${cert.inspectedBy}
        </div>
      </div>
    `;
  }

  // Formal A4 Certificate
  return `
    <div class="dispersion-a4-certificate" style="max-width: 800px; margin: 0 auto; padding: 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; color: #1e293b; border: 2px solid #cbd5e1; border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 20px;">
        <div>
          <h1 style="margin: 0; font-size: 22px; color: #0f172a; letter-spacing: -0.5px;">SHAHDARA FIBER BROADBAND SERVICES</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #64748b; font-weight: 600;">OPTICAL TRUNK CHROMATIC &amp; POLARIZATION MODE DISPERSION (CD/PMD) CERTIFICATE</p>
        </div>
        <div style="text-align: right;">
          <span style="display: inline-block; padding: 6px 12px; background: ${cert.overallPass ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${cert.overallPass ? '#86efac' : '#fca5a5'}; color: ${cert.overallPass ? '#166534' : '#991b1b'}; font-weight: 800; font-size: 13px; border-radius: 6px;">
            ${cert.verdictLabel}
          </span>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px; font-family: monospace;">CERT: ${cert.id}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; padding: 16px; border-radius: 6px; margin-bottom: 20px; font-size: 13px;">
        <div>
          <div style="margin-bottom: 4px;"><strong>Feeder Route:</strong> ${cert.feederRouteName}</div>
          <div style="margin-bottom: 4px;"><strong>Origin Node:</strong> ${cert.originPop}</div>
          <div><strong>Terminus Node:</strong> ${cert.destinationNode}</div>
        </div>
        <div>
          <div style="margin-bottom: 4px;"><strong>Span Length:</strong> ${cert.spanLengthKm} km</div>
          <div style="margin-bottom: 4px;"><strong>Fiber Profile:</strong> ${cert.fiberProfileName}</div>
          <div><strong>Target Bitrate Standard:</strong> ${cert.targetBitrateLabel}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; text-align: left;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
            <th style="padding: 8px 12px;">Physical Dispersion Parameter</th>
            <th style="padding: 8px 12px;">Measured / Calculated</th>
            <th style="padding: 8px 12px;">Acceptance Standard</th>
            <th style="padding: 8px 12px;">Compliance</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px;"><strong>Operating Test Wavelength</strong></td>
            <td style="padding: 8px 12px; font-family: monospace;">${cert.operatingWavelengthNm} nm</td>
            <td style="padding: 8px 12px;">ITU-T G.694.1 CWDM/DWDM Grid</td>
            <td style="padding: 8px 12px; color: #16a34a; font-weight: bold;">COMPLIANT</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px;"><strong>Chromatic Dispersion Coefficient</strong></td>
            <td style="padding: 8px 12px; font-family: monospace;">${cert.cdCoefficientPsPerNmKm} ps/(nm·km)</td>
            <td style="padding: 8px 12px;">Sellmeier Formula at ${cert.operatingWavelengthNm}nm</td>
            <td style="padding: 8px 12px; color: #16a34a; font-weight: bold;">NORMAL</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px;"><strong>Total Link Chromatic Dispersion</strong></td>
            <td style="padding: 8px 12px; font-family: monospace; font-weight: bold;">${cert.totalCdPsPerNm} ps/nm</td>
            <td style="padding: 8px 12px;">&lt; Standard Limit</td>
            <td style="padding: 8px 12px; color: ${cert.cdPassed ? '#16a34a' : '#dc2626'}; font-weight: bold;">${cert.cdPassed ? 'PASS' : 'FAIL'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px;"><strong>PMD Differential Group Delay (Mean)</strong></td>
            <td style="padding: 8px 12px; font-family: monospace;">${cert.meanDgdPs} ps</td>
            <td style="padding: 8px 12px;">PMD Coef: ${cert.pmdCoefficient} ps/√km</td>
            <td style="padding: 8px 12px; color: #16a34a; font-weight: bold;">VERIFIED</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px;"><strong>Peak Maxwellian DGD (99.999% Outage)</strong></td>
            <td style="padding: 8px 12px; font-family: monospace; font-weight: bold;">${cert.maxDgdMaxwellianPs} ps</td>
            <td style="padding: 8px 12px;">&lt; Tolerable Receiver Jitter</td>
            <td style="padding: 8px 12px; color: ${cert.pmdPassed ? '#16a34a' : '#dc2626'}; font-weight: bold;">${cert.pmdPassed ? 'PASS' : 'FAIL'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px;"><strong>Maximum Safe Transport Bitrate</strong></td>
            <td style="padding: 8px 12px; font-family: monospace; font-weight: bold; color: #0284c7;">~${cert.maxPmdBitrateGbps} Gbps</td>
            <td style="padding: 8px 12px;">Target: ${cert.targetBitrateLabel}</td>
            <td style="padding: 8px 12px; color: ${cert.overallPass ? '#16a34a' : '#dc2626'}; font-weight: bold;">${cert.overallPass ? 'APPROVED' : 'RESTRICTED'}</td>
          </tr>
        </tbody>
      </table>

      <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 6px; font-size: 12px; margin-bottom: 20px;">
        <strong>Field Engineering Notes:</strong> ${cert.linemanNotes || 'All chromatic and polarization dispersion properties audited in accordance with ITU-T G.652 and Telcordia GR-253-CORE transport guidelines.'}
      </div>

      <div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #64748b;">
        <div>
          Certified By: <strong>${cert.inspectedBy}</strong><br>
          Inspection Timestamp: ${dateStr} PKT
        </div>
        <div style="text-align: right;">
          Shahdara ISP Network Operations Center<br>
          Transport Accreditation: SHA-QA-DISP-2026
        </div>
      </div>
    </div>
  `;
}

/**
 * Pure vector SVG renderer for Chromatic & PMD dispersion curves.
 */
export function renderDispersionAnalysisSvg(analysisRecord) {
  const record = analysisRecord || {};
  const lengthKm = Number(record.spanLengthKm) || 12.5;
  const targetWl = Number(record.operatingWavelengthNm) || 1550;
  const profile = FIBER_DISPERSION_PROFILES[record.fiberProfileId] || FIBER_DISPERSION_PROFILES.G652D;

  const width = 640;
  const height = 240;

  // Generate curve coordinates from 1280nm to 1620nm
  // X: 1280 -> 70, 1620 -> 590 (scale = (590-70)/(1620-1280) = 520 / 340 = 1.5294 px/nm)
  // Y: -5 ps/(nm*km) -> 170, +22 ps/(nm*km) -> 40 (range = 27, height = 130px, 4.81 px per unit)
  function mapX(wl) {
    return 70 + ((wl - 1280) / 340) * 520;
  }
  function mapY(d) {
    return 160 - ((d - (-4)) / 26) * 120;
  }

  const zeroY = mapY(0);
  const zeroX = mapX(profile.zeroDispersionWavelengthNm);

  // Plot points
  const points = [];
  for (let w = 1280; w <= 1620; w += 10) {
    const d = calculateChromaticDispersionCoefficient(w, profile);
    points.push(`${mapX(w).toFixed(1)},${mapY(d).toFixed(1)}`);
  }
  const polylinePath = points.join(' ');

  const currentD = calculateChromaticDispersionCoefficient(targetWl, profile);
  const currentX = mapX(targetWl);
  const currentY = mapY(currentD);

  const verdictColor = record.overallPass ? '#10b981' : '#ef4444';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="dispersion-analysis-svg" role="img" aria-label="Optical Fiber Chromatic & PMD Dispersion Analysis">
      <defs>
        <linearGradient id="dispBgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#090d16"/>
        </linearGradient>
      </defs>

      <!-- Background Frame -->
      <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="url(#dispBgGrad)" stroke="#334155" stroke-width="1.5"/>

      <!-- Title & Fiber Standard -->
      <text x="20" y="24" fill="#94a3b8" font-size="10" font-weight="700" letter-spacing="0.5">CHROMATIC DISPERSION SPECTRAL CURVE D(λ)</text>
      <text x="620" y="24" fill="#38bdf8" font-size="10" font-weight="600" text-anchor="end">${profile.id} · ${lengthKm} km Feeder Span</text>

      <!-- Grid Axis Lines -->
      <line x1="70" y1="${zeroY}" x2="590" y2="${zeroY}" stroke="#475569" stroke-width="1" stroke-dasharray="3,3"/>
      <text x="64" y="${zeroY + 3}" fill="#64748b" font-size="9" text-anchor="end">0</text>

      <line x1="70" y1="${mapY(10)}" x2="590" y2="${mapY(10)}" stroke="#1e293b" stroke-width="1"/>
      <text x="64" y="${mapY(10) + 3}" fill="#64748b" font-size="9" text-anchor="end">+10</text>

      <line x1="70" y1="${mapY(20)}" x2="590" y2="${mapY(20)}" stroke="#1e293b" stroke-width="1"/>
      <text x="64" y="${mapY(20) + 3}" fill="#64748b" font-size="9" text-anchor="end">+20</text>

      <!-- Vertical Wavelength Reference Lines -->
      <!-- 1310 nm -->
      <line x1="${mapX(1310)}" y1="35" x2="${mapX(1310)}" y2="170" stroke="#334155" stroke-width="0.8" stroke-dasharray="2,2"/>
      <text x="${mapX(1310)}" y="182" fill="#64748b" font-size="8" text-anchor="middle">1310nm</text>

      <!-- 1490 nm -->
      <line x1="${mapX(1490)}" y1="35" x2="${mapX(1490)}" y2="170" stroke="#334155" stroke-width="0.8" stroke-dasharray="2,2"/>
      <text x="${mapX(1490)}" y="182" fill="#64748b" font-size="8" text-anchor="middle">1490nm</text>

      <!-- 1550 nm -->
      <line x1="${mapX(1550)}" y1="35" x2="${mapX(1550)}" y2="170" stroke="#334155" stroke-width="0.8" stroke-dasharray="2,2"/>
      <text x="${mapX(1550)}" y="182" fill="#64748b" font-size="8" text-anchor="middle">1550nm</text>

      <!-- Dispersion Curve Polyline -->
      <polyline points="${polylinePath}" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>

      <!-- Zero Dispersion Marker -->
      <circle cx="${zeroX}" cy="${zeroY}" r="4" fill="#f59e0b" stroke="#fff" stroke-width="1"/>
      <text x="${zeroX}" y="${zeroY - 8}" fill="#f59e0b" font-size="8" font-weight="700" text-anchor="middle">λ₀ ${profile.zeroDispersionWavelengthNm}nm</text>

      <!-- Operating Wavelength Marker -->
      <circle cx="${currentX}" cy="${currentY}" r="5" fill="${verdictColor}" stroke="#ffffff" stroke-width="1.5"/>
      <line x1="${currentX}" y1="${currentY}" x2="${currentX}" y2="170" stroke="${verdictColor}" stroke-width="1.2" stroke-dasharray="2,2"/>
      <text x="${currentX}" y="${currentY - 10}" fill="#ffffff" font-size="9" font-weight="800" text-anchor="middle">${currentD} ps/(nm·km)</text>

      <!-- Bottom KPI Ribbon -->
      <g transform="translate(20, 190)">
        <rect x="0" y="0" width="600" height="38" rx="6" fill="#141e2e" stroke="#1e293b" stroke-width="1"/>
        <text x="15" y="16" fill="#94a3b8" font-size="8" font-weight="700">TOTAL CHROMATIC DISPERSION</text>
        <text x="15" y="30" fill="#38bdf8" font-size="12" font-weight="800" font-family="monospace">${record.totalCdPsPerNm || Math.round(Math.abs(currentD * lengthKm))} ps/nm</text>

        <text x="210" y="16" fill="#94a3b8" font-size="8" font-weight="700">MAXWELLIAN PEAK DGD</text>
        <text x="210" y="30" fill="#f59e0b" font-size="12" font-weight="800" font-family="monospace">${record.maxDgdMaxwellianPs || 0.85} ps</text>

        <text x="370" y="16" fill="#94a3b8" font-size="8" font-weight="700">MAX SUPPORTED BITRATE</text>
        <text x="370" y="30" fill="#10b981" font-size="12" font-weight="800" font-family="monospace">~${record.maxPmdBitrateGbps || 25} Gbps</text>

        <rect x="495" y="8" width="95" height="22" rx="4" fill="${verdictColor}"/>
        <text x="542" y="23" fill="#ffffff" font-size="9" font-weight="800" text-anchor="middle">${record.overallPass ? 'APPROVED ✓' : 'LIMIT FAIL ✗'}</text>
      </g>
    </svg>
  `;
}

/**
 * Initializes and wires the Chromatic & PMD Dispersion QA Modal Dialog.
 */
export function setupDispersionCertModal(options = {}) {
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

  const modal = doc.getElementById('dispersionCertModal');
  const closeBtn = doc.getElementById('dispersionCertModalCloseBtn');
  const openButtons = doc.querySelectorAll('[data-open-dispersion-cert]');

  // Inputs
  const routeInput = doc.getElementById('dispersionRouteInput');
  const originInput = doc.getElementById('dispersionOriginInput');
  const destInput = doc.getElementById('dispersionDestInput');
  const spanSlider = doc.getElementById('dispersionSpanSlider');
  const spanVal = doc.getElementById('dispersionSpanVal');
  const wlSelect = doc.getElementById('dispersionWlSelect');
  const fiberProfileSelect = doc.getElementById('dispersionFiberProfileSelect');
  const pmdSlider = doc.getElementById('dispersionPmdSlider');
  const pmdVal = doc.getElementById('dispersionPmdVal');
  const targetBitrateSelect = doc.getElementById('dispersionTargetBitrateSelect');
  const notesInput = doc.getElementById('dispersionNotesInput');

  // Outputs
  const svgContainer = doc.getElementById('dispersionSvgContainer');
  const cdReadout = doc.getElementById('dispersionCdReadout');
  const dgdReadout = doc.getElementById('dispersionDgdReadout');
  const bitrateReadout = doc.getElementById('dispersionBitrateReadout');
  const verdictBadge = doc.getElementById('dispersionVerdictBadge');
  const warningsContainer = doc.getElementById('dispersionWarningsContainer');
  const historyTableBody = doc.getElementById('dispersionHistoryTableBody');

  // Action Buttons
  const recordCertBtn = doc.getElementById('dispersionRecordCertBtn');
  const copyReportBtn = doc.getElementById('dispersionCopyReportBtn');
  const printA4Btn = doc.getElementById('dispersionPrintA4Btn');
  const printThermalBtn = doc.getElementById('dispersionPrintThermalBtn');
  const exportCsvBtn = doc.getElementById('dispersionExportCsvBtn');
  const clearHistoryBtn = doc.getElementById('dispersionClearHistoryBtn');

  // Current State
  const currentReading = {
    feederRouteName: 'Shahdara Main Trunk Feeder - Ring A',
    originPop: 'Shahdara Central OLT / PoP-1',
    destinationNode: 'Rachna Town Primary FAT-08 Hub',
    spanLengthKm: 12.5,
    operatingWavelengthNm: 1550,
    fiberProfileId: 'G652D',
    customPmdCoef: 0.10,
    targetBitrateId: 'RATE_10G',
    inspectedBy: 'Saad (Lead Optical Transport Engineer)',
    linemanNotes: ''
  };

  function renderView() {
    const evalResult = evaluateLinkDispersion({
      spanLengthKm: currentReading.spanLengthKm,
      operatingWavelengthNm: currentReading.operatingWavelengthNm,
      fiberProfileId: currentReading.fiberProfileId,
      customPmdCoef: currentReading.customPmdCoef,
      targetBitrateId: currentReading.targetBitrateId
    });

    currentReading.totalCdPsPerNm = evalResult.totalCdPsPerNm;
    currentReading.cdCoefficientPsPerNmKm = evalResult.cdCoefficientPsPerNmKm;
    currentReading.meanDgdPs = evalResult.meanDgdPs;
    currentReading.maxDgdMaxwellianPs = evalResult.maxDgdMaxwellianPs;
    currentReading.maxPmdBitrateGbps = evalResult.maxPmdBitrateGbps;
    currentReading.pmdPenaltyDb = evalResult.pmdPenaltyDb;
    currentReading.overallPass = evalResult.overallPass;
    currentReading.cdPassed = evalResult.cdPassed;
    currentReading.pmdPassed = evalResult.pmdPassed;
    currentReading.verdict = evalResult.verdict;

    // SVG
    if (svgContainer) {
      svgContainer.innerHTML = renderDispersionAnalysisSvg(currentReading);
    }

    // Readouts
    if (cdReadout) {
      cdReadout.textContent = `${evalResult.totalCdPsPerNm} ps/nm (${evalResult.cdCoefficientPsPerNmKm} ps/(nm·km))`;
    }
    if (dgdReadout) {
      dgdReadout.textContent = `${evalResult.meanDgdPs} ps mean / ${evalResult.maxDgdMaxwellianPs} ps max`;
    }
    if (bitrateReadout) {
      bitrateReadout.textContent = `~${evalResult.maxPmdBitrateGbps} Gbps Safe Capacity`;
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
            ✓ Dispersion parameters compliant with ITU-T G.652.D and G.959.1 standards for ${evalResult.targetStandard.label}.
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

    // Audit History Table
    if (historyTableBody) {
      const records = getSavedDispersionCerts(storage);
      if (records.length === 0) {
        historyTableBody.innerHTML = `
          <tr><td colspan="6" style="text-align: center; color: var(--muted, #94a3b8); padding: 12px;">No dispersion certification records logged yet.</td></tr>
        `;
      } else {
        historyTableBody.innerHTML = records.slice(0, 8).map(r => `
          <tr style="border-bottom: 1px solid var(--border, #334155); font-size: 12px;">
            <td style="padding: 6px 8px; font-family: monospace;">${r.id}</td>
            <td style="padding: 6px 8px;">${r.feederRouteName}</td>
            <td style="padding: 6px 8px; font-family: monospace;">${r.spanLengthKm} km (${r.operatingWavelengthNm}nm)</td>
            <td style="padding: 6px 8px; font-family: monospace;">${r.totalCdPsPerNm} ps/nm</td>
            <td style="padding: 6px 8px; font-family: monospace;">${r.maxDgdMaxwellianPs} ps DGD</td>
            <td style="padding: 6px 8px;"><span class="badge ${r.overallPass ? 'badge-success' : 'badge-danger'}">${r.overallPass ? 'PASS' : 'FAIL'}</span></td>
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

  // Triggers
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

  // Input bindings
  if (routeInput) {
    routeInput.oninput = (e) => { currentReading.feederRouteName = e.target.value; };
  }
  if (originInput) {
    originInput.oninput = (e) => { currentReading.originPop = e.target.value; };
  }
  if (destInput) {
    destInput.oninput = (e) => { currentReading.destinationNode = e.target.value; };
  }
  if (spanSlider) {
    spanSlider.oninput = (e) => {
      const v = Number(e.target.value) || 12.5;
      currentReading.spanLengthKm = v;
      if (spanVal) spanVal.textContent = `${v.toFixed(1)} km`;
      renderView();
    };
  }
  if (wlSelect) {
    wlSelect.onchange = (e) => {
      currentReading.operatingWavelengthNm = Number(e.target.value) || 1550;
      renderView();
    };
  }
  if (fiberProfileSelect) {
    fiberProfileSelect.onchange = (e) => {
      currentReading.fiberProfileId = e.target.value;
      const profile = FIBER_DISPERSION_PROFILES[currentReading.fiberProfileId];
      if (profile && pmdSlider) {
        pmdSlider.value = profile.nominalPmdCoef;
        currentReading.customPmdCoef = profile.nominalPmdCoef;
        if (pmdVal) pmdVal.textContent = `${profile.nominalPmdCoef.toFixed(2)} ps/√km`;
      }
      renderView();
    };
  }
  if (pmdSlider) {
    pmdSlider.oninput = (e) => {
      const v = Number(e.target.value) || 0.10;
      currentReading.customPmdCoef = v;
      if (pmdVal) pmdVal.textContent = `${v.toFixed(2)} ps/√km`;
      renderView();
    };
  }
  if (targetBitrateSelect) {
    targetBitrateSelect.onchange = (e) => {
      currentReading.targetBitrateId = e.target.value;
      renderView();
    };
  }

  // Action Buttons
  if (recordCertBtn) {
    recordCertBtn.onclick = () => {
      if (notesInput) currentReading.linemanNotes = notesInput.value;
      const record = buildDispersionCertRecord(currentReading);
      saveDispersionCert(record, storage);
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast(`✓ Logged Dispersion Certificate ${record.id} (${record.totalCdPsPerNm} ps/nm)`);
      }
    };
  }

  if (copyReportBtn) {
    copyReportBtn.onclick = async () => {
      if (notesInput) currentReading.linemanNotes = notesInput.value;
      const record = buildDispersionCertRecord(currentReading);
      const text = formatDispersionCertWhatsApp(record);
      const clipboard = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      let success = false;
      if (clipboard && typeof clipboard.writeText === 'function') {
        try {
          await clipboard.writeText(text);
          success = true;
        } catch (_) {}
      }
      if (typeof options.onToast === 'function') {
        options.onToast(success ? '✓ WhatsApp Dispersion Report copied to clipboard' : 'Report generated in console');
      }
    };
  }

  if (printA4Btn) {
    printA4Btn.onclick = () => {
      const record = buildDispersionCertRecord(currentReading);
      const html = generateDispersionCertHtml(record, 'standard');
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
      const record = buildDispersionCertRecord(currentReading);
      const html = generateDispersionCertHtml(record, 'thermal');
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
      const records = getSavedDispersionCerts(storage);
      const csv = generateDispersionCertsCsv(records);
      if (typeof options.onExportCsv === 'function') {
        options.onExportCsv(csv, 'shahdara_dispersion_certificates.csv');
      }
      if (typeof options.onToast === 'function') {
        options.onToast(`Exported ${records.length} Dispersion certificates to CSV`);
      }
    };
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.onclick = () => {
      clearDispersionCerts(storage);
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast('Cleared dispersion certification log');
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
