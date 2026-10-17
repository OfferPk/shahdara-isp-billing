/**
 * Shahdara ISP - Field Technician Tier-1 Optical Loss Test Set (OLTS) Bi-directional Insertion Loss & Certification Suite
 * 
 * Provides FTTH linemen, fiber engineers, and field supervisors with:
 * - TIA-568.3-D / ISO/IEC 14763-3 / ITU-T G.652.D Tier-1 optical insertion loss certification
 * - Bi-directional loss measurement and true averaging (IL_avg = (IL_AtoB + IL_BtoA) / 2)
 * - MFD (Mode Field Diameter) mismatch and false-gainer directional bias compensation
 * - 1-Cord (Method B), 2-Cord (Method A.1), and 3-Cord (Method C) reference calibration wizard
 * - Dual-wavelength testing (1310nm, 1490nm, 1550nm, 1577nm, 1625nm)
 * - Vector SVG bi-directional lightwave ray schematic and compliance margin speedometer
 * - LocalStorage audit trail (shahdara_olts_cert_audits_v1), WhatsApp dispatch tickets, and CSV export
 */

export const OLTS_CERT_STORAGE_KEY = 'shahdara_olts_cert_audits_v1';

export const OLTS_WAVELENGTHS = {
  SM_1310: {
    id: 'SM_1310',
    name: '1310 nm (O-Band Primary)',
    wavelengthNm: 1310,
    defaultLossPerKm: 0.35,
    standardMaxLossPerKm: 0.40,
    band: 'O-Band',
    description: 'Standard single-mode upstream/feeder transmission window; optimal chromatic dispersion.'
  },
  SM_1490: {
    id: 'SM_1490',
    name: '1490 nm (GPON Downstream)',
    wavelengthNm: 1490,
    defaultLossPerKm: 0.25,
    standardMaxLossPerKm: 0.35,
    band: 'S-Band',
    description: 'ITU-T G.984 GPON continuous downstream voice and high-speed broadband data.'
  },
  SM_1550: {
    id: 'SM_1550',
    name: '1550 nm (C-Band Low Attenuation)',
    wavelengthNm: 1550,
    defaultLossPerKm: 0.20,
    standardMaxLossPerKm: 0.30,
    band: 'C-Band',
    description: 'Minimum Rayleigh attenuation window; highly sensitive to macro-bend and enclosure pinch defects.'
  },
  SM_1577: {
    id: 'SM_1577',
    name: '1577 nm (XGS-PON 10G Downstream)',
    wavelengthNm: 1577,
    defaultLossPerKm: 0.21,
    standardMaxLossPerKm: 0.30,
    band: 'L-Band',
    description: 'ITU-T G.9807.1 symmetrical 10 Gigabit downstream wavelength.'
  },
  SM_1625: {
    id: 'SM_1625',
    name: '1625 nm (U-Band Maintenance / Live OTDR)',
    wavelengthNm: 1625,
    defaultLossPerKm: 0.24,
    standardMaxLossPerKm: 0.35,
    band: 'U-Band',
    description: 'Out-of-band active maintenance monitoring and macro-bend diagnostic detection.'
  }
};

export const REFERENCE_METHODS = {
  METHOD_1_CORD: {
    id: 'METHOD_1_CORD',
    name: '1-Cord Reference (Method B - TIA-568 Recommended)',
    cords: 1,
    connectorsIncluded: 2,
    accuracyRating: 'Highest (Standard Compliant)',
    description: 'Zeroed with launch jumper only. Accurately tests the fiber link PLUS both end connectors.'
  },
  METHOD_2_CORD: {
    id: 'METHOD_2_CORD',
    name: '2-Cord Reference (Method A.1 - Jumper & Receive Cord)',
    cords: 2,
    connectorsIncluded: 1,
    accuracyRating: 'Moderate',
    description: 'Zeroed with launch cord, mating adapter, and receive cord. Measures fiber plus 1 end connector.'
  },
  METHOD_3_CORD: {
    id: 'METHOD_3_CORD',
    name: '3-Cord Reference (Method C - Link Only)',
    cords: 3,
    connectorsIncluded: 0,
    accuracyRating: 'Cable Plant Only',
    description: 'Zeroed with 3 test cords and 2 adapters. Measures bare cable plant attenuation excluding end connectors.'
  }
};

export const CONNECTOR_TYPES = {
  SC_APC: {
    id: 'SC_APC',
    name: 'SC/APC (Green Angled Polish)',
    typicalLossDb: 0.25,
    standardLimitDb: 0.75,
    returnLossDb: 65,
    color: '#10b981',
    description: '8° angled physical contact; standard for Shahdara FTTH drop and splitter terminations.'
  },
  SC_UPC: {
    id: 'SC_UPC',
    name: 'SC/UPC (Blue Ultra Polish)',
    typicalLossDb: 0.30,
    standardLimitDb: 0.75,
    returnLossDb: 55,
    color: '#0284c7',
    description: 'Flat ultra-polish connector; common on legacy media converters and Ethernet transceivers.'
  },
  LC_APC: {
    id: 'LC_APC',
    name: 'LC/APC (Small Form-Factor Green)',
    typicalLossDb: 0.25,
    standardLimitDb: 0.75,
    returnLossDb: 65,
    color: '#059669',
    description: 'High-density angled connector used in OLT SFP+ PON optical transceivers and high-density ODFs.'
  },
  LC_UPC: {
    id: 'LC_UPC',
    name: 'LC/UPC (Small Form-Factor Blue)',
    typicalLossDb: 0.30,
    standardLimitDb: 0.75,
    returnLossDb: 55,
    color: '#3b82f6',
    description: 'High-density flat ultra-polish used in switch SFP uplinks and metro router interfaces.'
  }
};

export const OLTS_CONNECTOR_TYPES = CONNECTOR_TYPES;

export const SPLICE_TYPES = {
  FUSION: {
    id: 'FUSION',
    name: 'Core-Alignment Fusion Splice',
    typicalLossDb: 0.05,
    standardLimitDb: 0.30,
    description: 'Electric arc fusion with PAS automated core alignment; standard for Shahdara trunk and branch joints.'
  },
  MECHANICAL: {
    id: 'MECHANICAL',
    name: 'Mechanical Field Splice',
    typicalLossDb: 0.15,
    standardLimitDb: 0.30,
    description: 'V-groove optical index-matching gel splice; used in emergency field drop restores.'
  }
};

export const OLTS_SPLICE_TYPES = SPLICE_TYPES;


export const OLTS_PRESETS = {
  SHAHDARA_FEEDER: {
    id: 'SHAHDARA_FEEDER',
    name: 'Shahdara Central OLT -> Ravi Road FDT Feeder',
    lengthKm: 3.8,
    splicesCount: 4,
    spliceType: 'FUSION',
    connectorsCount: 2,
    connectorType: 'SC_APC',
    wavelengthId: 'SM_1310',
    referenceMethod: 'METHOD_1_CORD',
    lossAtoB: 1.85,
    lossBtoA: 1.91,
    description: 'Primary feeder link running from central OLT rack to roadside primary distribution cabinet.'
  },
  FDT_DISTRIBUTION: {
    id: 'FDT_DISTRIBUTION',
    name: 'FDT-04 -> Saeed Park FAT-12 Distribution',
    lengthKm: 1.25,
    splicesCount: 2,
    spliceType: 'FUSION',
    connectorsCount: 2,
    connectorType: 'SC_APC',
    wavelengthId: 'SM_1490',
    referenceMethod: 'METHOD_1_CORD',
    lossAtoB: 0.92,
    lossBtoA: 0.88,
    description: 'Aerial branch cable supplying 16-port customer drop fiber access terminal.'
  },
  FAT_DROP_SUBSCRIBER: {
    id: 'FAT_DROP_SUBSCRIBER',
    name: 'FAT-12 -> Subscriber Home Drop Cable',
    lengthKm: 0.18,
    splicesCount: 1,
    spliceType: 'FUSION',
    connectorsCount: 2,
    connectorType: 'SC_APC',
    wavelengthId: 'SM_1490',
    referenceMethod: 'METHOD_1_CORD',
    lossAtoB: 0.58,
    lossBtoA: 0.62,
    description: 'Flat drop span from pole terminal to residential optical network unit (ONU).'
  },
  METRO_INTER_POP: {
    id: 'METRO_INTER_POP',
    name: 'Metro Core Inter-POP Optical Tie Trunk',
    lengthKm: 8.6,
    splicesCount: 10,
    spliceType: 'FUSION',
    connectorsCount: 2,
    connectorType: 'LC_APC',
    wavelengthId: 'SM_1550',
    referenceMethod: 'METHOD_1_CORD',
    lossAtoB: 2.75,
    lossBtoA: 2.82,
    description: 'High-capacity inter-POP backbone tie spanning Shahdara to Lahore Ring Metro POP.'
  },
  DC_CROSS_CONNECT: {
    id: 'DC_CROSS_CONNECT',
    name: 'POP Server Rack ODF Patch Cross-Connect',
    lengthKm: 0.04,
    splicesCount: 0,
    spliceType: 'FUSION',
    connectorsCount: 2,
    connectorType: 'LC_UPC',
    wavelengthId: 'SM_1310',
    referenceMethod: 'METHOD_1_CORD',
    lossAtoB: 0.42,
    lossBtoA: 0.40,
    description: 'Intra-datacenter patch jumper between core switch and optical distribution frame.'
  }
};

/**
 * Calculate Tier-1 Optical Insertion Loss Budget according to TIA-568.3-D & ISO/IEC 14763-3
 */
export function calculateTier1LossBudget({
  lengthKm = 1.0,
  wavelengthId = 'SM_1310',
  splicesCount = 2,
  spliceType = 'FUSION',
  connectorsCount = 2,
  connectorType = 'SC_APC',
  customFiberLossPerKm = null,
  customSpliceLoss = null,
  customConnectorLoss = null
} = {}) {
  const wlConfig = OLTS_WAVELENGTHS[wavelengthId] || OLTS_WAVELENGTHS.SM_1310;
  const connConfig = CONNECTOR_TYPES[connectorType] || CONNECTOR_TYPES.SC_APC;
  const spliceConfig = SPLICE_TYPES[spliceType] || SPLICE_TYPES.FUSION;

  const validLength = Math.max(0, Number(lengthKm) || 0);
  const validSplices = Math.max(0, parseInt(splicesCount, 10) || 0);
  const validConnectors = Math.max(0, parseInt(connectorsCount, 10) || 0);

  const fiberLossPerKm = customFiberLossPerKm != null ? Number(customFiberLossPerKm) : wlConfig.defaultLossPerKm;
  const spliceLoss = customSpliceLoss != null ? Number(customSpliceLoss) : spliceConfig.typicalLossDb;
  const connectorLoss = customConnectorLoss != null ? Number(customConnectorLoss) : connConfig.typicalLossDb;

  const fiberLossDb = validLength * fiberLossPerKm;
  const spliceLossDb = validSplices * spliceLoss;
  const connectorLossDb = validConnectors * connectorLoss;

  const totalBudgetDb = fiberLossDb + spliceLossDb + connectorLossDb;

  // Maximum allowable limits per TIA-568.3-D standard ceiling
  const standardFiberLossDb = validLength * wlConfig.standardMaxLossPerKm;
  const standardSpliceLossDb = validSplices * spliceConfig.standardLimitDb;
  const standardConnectorLossDb = validConnectors * connConfig.standardLimitDb;
  const standardCeilingBudgetDb = standardFiberLossDb + standardSpliceLossDb + standardConnectorLossDb;

  return {
    lengthKm: validLength,
    wavelength: wlConfig,
    splicesCount: validSplices,
    spliceLossDb: Number(spliceLossDb.toFixed(3)),
    connectorsCount: validConnectors,
    connectorLossDb: Number(connectorLossDb.toFixed(3)),
    fiberLossDb: Number(fiberLossDb.toFixed(3)),
    totalBudgetDb: Number(totalBudgetDb.toFixed(2)),
    standardCeilingBudgetDb: Number(standardCeilingBudgetDb.toFixed(2)),
    fiberLossPerKm,
    spliceLoss,
    connectorLoss
  };
}

/**
 * Calculate bi-directional loss averaging, margin headroom, and Pass/Marginal/Fail status
 */
export function calculateBidirectionalCertification({
  lossAtoB = 1.0,
  lossBtoA = 1.0,
  budgetDb = 2.0,
  lengthKm = 1.0
} = {}) {
  const aToB = Number(lossAtoB) || 0;
  const bToA = Number(lossBtoA) || 0;
  const budget = Number(budgetDb) || 1.0;

  // True bi-directional average
  const avgLossDb = Number(((aToB + bToA) / 2).toFixed(2));
  const deltaDb = Number(Math.abs(aToB - bToA).toFixed(2));
  const marginDb = Number((budget - avgLossDb).toFixed(2));

  // Gainer / MFD mismatch detection
  const hasGainer = aToB < 0 || bToA < 0;
  const hasDirectionalBias = deltaDb > 0.25;

  let status = 'PASS';
  let badgeClass = 'badge-pass';
  let statusText = 'CERTIFIED PASS';
  let statusColor = '#10b981';
  let advisoryUrdu = 'مبارک! آپٹیکل فائبر لنک ٹیسٹ کامیابی سے پاس ہو گیا ہے۔ ہائیڈ روم تسلی بخش ہے۔';

  if (avgLossDb > budget) {
    status = 'FAIL';
    badgeClass = 'badge-fail';
    statusText = 'CERTIFICATION FAILED';
    statusColor = '#ef4444';
    advisoryUrdu = 'خطرہ: آپٹیکل نقصان منظور شدہ حد سے زیادہ ہے۔ جوڑ، کنیکٹر اور بینڈ چیک کریں۔';
  } else if (marginDb < 1.0) {
    status = 'MARGINAL';
    badgeClass = 'badge-warning';
    statusText = 'MARGINAL PASS (LOW HEADROOM)';
    statusColor = '#f59e0b';
    advisoryUrdu = 'انتباہ: پاس ہے لیکن ہیڈ روم 1.0 dB سے کم ہے۔ موسمی تبدیلی پر سگنل ڈراپ ہو سکتا ہے۔';
  }

  let diagnostics = [];
  if (hasGainer) {
    diagnostics.push('Apparent gainer detected (negative loss in one direction). Compensated by bidirectional averaging per TIA-568.3-D.');
  }
  if (hasDirectionalBias) {
    diagnostics.push(`Significant directional asymmetry (${deltaDb} dB delta). Inspect connector end-faces for dust or mode-field mismatch.`);
  }
  if (status === 'PASS') {
    diagnostics.push(`Excellent link quality with ${marginDb} dB optical power headroom above standard budget.`);
  } else if (status === 'MARGINAL') {
    diagnostics.push(`Link meets minimum criteria but possesses narrow headroom (${marginDb} dB). Recommend re-polishing end-faces.`);
  } else {
    diagnostics.push(`Link exceeds allocated budget by ${Math.abs(marginDb)} dB. High insertion loss requires field troubleshooting.`);
  }

  const attenuationPerKm = lengthKm > 0 ? Number((avgLossDb / lengthKm).toFixed(3)) : 0;

  return {
    lossAtoB: aToB,
    lossBtoA: bToA,
    avgLossDb,
    deltaDb,
    marginDb,
    budgetDb: budget,
    status,
    badgeClass,
    statusText,
    statusColor,
    hasGainer,
    hasDirectionalBias,
    diagnostics,
    advisoryUrdu,
    attenuationPerKm
  };
}

/**
 * Render Vector SVG Bi-Directional Lightwave & Compliance Speedometer Gauge
 */
export function renderOltsCertificationSvg({
  lossAtoB = 1.85,
  lossBtoA = 1.91,
  avgLossDb = 1.88,
  budgetDb = 2.45,
  marginDb = 0.57,
  status = 'PASS',
  wavelengthNm = 1310,
  linkName = 'Shahdara Optical Link'
} = {}) {
  const safeAvg = Math.max(0, Number(avgLossDb) || 0);
  const safeBudget = Math.max(0.1, Number(budgetDb) || 1.0);
  const maxScale = Math.max(safeBudget * 1.5, safeAvg * 1.25, 4.0);

  // Calculate needle angle for semi-circle speedometer (from -90deg to +90deg)
  // 0 dB loss -> -90 deg; maxScale -> +90 deg
  const ratio = Math.min(1.0, safeAvg / maxScale);
  const needleAngle = -90 + (ratio * 180);

  const budgetRatio = Math.min(1.0, safeBudget / maxScale);
  const budgetAngle = -90 + (budgetRatio * 180);

  const statusColor = status === 'PASS' ? '#10b981' : (status === 'MARGINAL' ? '#f59e0b' : '#ef4444');

  return `
    <svg viewBox="0 0 760 320" class="olts-cert-svg" role="img" aria-label="OLTS Bi-directional Certification Schematic and Gauge" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="oltsBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#090d16" />
          <stop offset="100%" stop-color="#111827" />
        </linearGradient>
        <linearGradient id="rayForwardGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#0284c7" stop-opacity="0.3" />
        </linearGradient>
        <linearGradient id="rayReverseGrad" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#d97706" stop-opacity="0.3" />
        </linearGradient>
        <filter id="oltsGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Background -->
      <rect width="760" height="320" rx="14" fill="url(#oltsBgGrad)" stroke="#1e293b" stroke-width="1.5" />

      <!-- Top Header Badge -->
      <g transform="translate(24, 28)">
        <text x="0" y="0" fill="#94a3b8" font-size="11" font-weight="700" letter-spacing="1">TIA-568.3-D / ISO 14763-3 TIER-1 BI-DIRECTIONAL CERTIFICATION</text>
        <text x="0" y="20" fill="#f8fafc" font-size="16" font-weight="700">${escapeXml(linkName)}</text>
        <rect x="580" y="-12" width="130" height="28" rx="6" fill="${statusColor}22" stroke="${statusColor}" stroke-width="1.5" />
        <text x="645" y="6" fill="${statusColor}" font-size="12" font-weight="700" text-anchor="middle">${status} (${marginDb >= 0 ? '+' : ''}${marginDb} dB)</text>
      </g>

      <!-- Left Column: Bi-directional Optical Route Schematic -->
      <g transform="translate(24, 85)">
        <rect width="360" height="210" rx="10" fill="#0f172a" stroke="#334155" stroke-width="1" />
        
        <!-- Node A: OLS / OPM Unit A -->
        <g transform="translate(20, 30)">
          <rect width="64" height="60" rx="8" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" />
          <text x="32" y="24" fill="#38bdf8" font-size="12" font-weight="700" text-anchor="middle">END A</text>
          <text x="32" y="44" fill="#94a3b8" font-size="9" text-anchor="middle">OLS/OPM</text>
        </g>

        <!-- Node B: OLS / OPM Unit B -->
        <g transform="translate(276, 30)">
          <rect width="64" height="60" rx="8" fill="#1e293b" stroke="#fbbf24" stroke-width="1.5" />
          <text x="32" y="24" fill="#fbbf24" font-size="12" font-weight="700" text-anchor="middle">END B</text>
          <text x="32" y="44" fill="#94a3b8" font-size="9" text-anchor="middle">OPM/OLS</text>
        </g>

        <!-- Fiber Span Core Wire -->
        <line x1="84" y1="60" x2="276" y2="60" stroke="#475569" stroke-width="4" stroke-linecap="round" />
        
        <!-- Forward Ray (A -> B) -->
        <line x1="90" y1="52" x2="270" y2="52" stroke="url(#rayForwardGrad)" stroke-width="3" filter="url(#oltsGlow)" />
        <polygon points="268,52 258,47 258,57" fill="#38bdf8" />
        <text x="180" y="42" fill="#38bdf8" font-size="10" font-weight="700" text-anchor="middle">A &rarr; B: ${lossAtoB.toFixed(2)} dB</text>

        <!-- Reverse Ray (B -> A) -->
        <line x1="270" y1="68" x2="90" y2="68" stroke="url(#rayReverseGrad)" stroke-width="3" filter="url(#oltsGlow)" />
        <polygon points="92,68 102,63 102,73" fill="#fbbf24" />
        <text x="180" y="85" fill="#fbbf24" font-size="10" font-weight="700" text-anchor="middle">B &rarr; A: ${lossBtoA.toFixed(2)} dB</text>

        <!-- Splice joint indicators on the span -->
        <circle cx="140" cy="60" r="4" fill="#64748b" stroke="#f8fafc" stroke-width="1" />
        <circle cx="220" cy="60" r="4" fill="#64748b" stroke="#f8fafc" stroke-width="1" />

        <!-- Averaging Summary Box inside schematic -->
        <g transform="translate(20, 115)">
          <rect width="320" height="75" rx="8" fill="#1e293b88" stroke="#334155" stroke-dasharray="4 2" />
          <text x="15" y="24" fill="#94a3b8" font-size="11">Bidirectional Average:</text>
          <text x="150" y="24" fill="#f8fafc" font-size="13" font-weight="700">${avgLossDb.toFixed(2)} dB</text>
          
          <text x="15" y="44" fill="#94a3b8" font-size="11">Directional Delta (&Delta;):</text>
          <text x="150" y="44" fill="${Math.abs(lossAtoB - lossBtoA) > 0.25 ? '#f59e0b' : '#38bdf8'}" font-size="12" font-weight="700">${Math.abs(lossAtoB - lossBtoA).toFixed(2)} dB</text>
          
          <text x="15" y="64" fill="#94a3b8" font-size="11">Wavelength / Band:</text>
          <text x="150" y="64" fill="#cbd5e1" font-size="11">${wavelengthNm} nm Single-Mode</text>
        </g>
      </g>

      <!-- Right Column: Compliance Margin Speedometer & Budget Dial -->
      <g transform="translate(415, 85)">
        <rect width="320" height="210" rx="10" fill="#0f172a" stroke="#334155" stroke-width="1" />
        <text x="160" y="24" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle">BUDGET MARGIN GAUGE</text>

        <!-- Semicircular Speedometer Arc -->
        <g transform="translate(160, 130)">
          <!-- Background Arc -->
          <path d="M -90 0 A 90 90 0 0 1 90 0" fill="none" stroke="#1e293b" stroke-width="16" stroke-linecap="round" />
          
          <!-- Colored Segments: Pass (Green), Marginal (Amber), Fail (Red) -->
          <!-- We draw approximate path arcs -->
          <path d="M -90 0 A 90 90 0 0 1 -15 -88" fill="none" stroke="#10b981" stroke-width="16" stroke-dasharray="2 1" opacity="0.8" />
          <path d="M -15 -88 A 90 90 0 0 1 35 -83" fill="none" stroke="#f59e0b" stroke-width="16" stroke-dasharray="2 1" opacity="0.8" />
          <path d="M 35 -83 A 90 90 0 0 1 90 0" fill="none" stroke="#ef4444" stroke-width="16" stroke-dasharray="2 1" opacity="0.8" />

          <!-- Target Budget Marker Notch -->
          <g transform="rotate(${budgetAngle})">
            <line x1="0" y1="-80" x2="0" y2="-102" stroke="#f8fafc" stroke-width="3" />
            <circle cx="0" cy="-104" r="3" fill="#f8fafc" />
          </g>

          <!-- Needle -->
          <g transform="rotate(${needleAngle})">
            <line x1="0" y1="10" x2="0" y2="-82" stroke="${statusColor}" stroke-width="3.5" stroke-linecap="round" filter="url(#oltsGlow)" />
            <circle cx="0" cy="0" r="7" fill="${statusColor}" stroke="#f8fafc" stroke-width="1.5" />
          </g>

          <!-- Digital Readout Below Needle -->
          <text x="0" y="28" fill="#f8fafc" font-size="18" font-weight="800" text-anchor="middle">${avgLossDb.toFixed(2)} dB</text>
          <text x="0" y="44" fill="#94a3b8" font-size="10" text-anchor="middle">Allowed Budget: ${budgetDb.toFixed(2)} dB</text>
        </g>

        <!-- Metric badges footer -->
        <g transform="translate(20, 180)">
          <text x="0" y="14" fill="#94a3b8" font-size="10">Margin Headroom:</text>
          <text x="100" y="14" fill="${statusColor}" font-size="12" font-weight="800">${marginDb >= 0 ? '+' : ''}${marginDb.toFixed(2)} dB</text>
          
          <text x="180" y="14" fill="#94a3b8" font-size="10">Result:</text>
          <text x="225" y="14" fill="${statusColor}" font-size="12" font-weight="800">${status}</text>
        </g>
      </g>
    </svg>
  `;
}

/**
 * Render Vector SVG Reference Method Calibration Diagram (1-cord, 2-cord, 3-cord)
 */
export function renderOltsReferenceDiagramSvg({ methodId = 'METHOD_1_CORD' } = {}) {
  const method = REFERENCE_METHODS[methodId] || REFERENCE_METHODS.METHOD_1_CORD;
  const is1Cord = methodId === 'METHOD_1_CORD';
  const is2Cord = methodId === 'METHOD_2_CORD';

  return `
    <svg viewBox="0 0 680 180" class="olts-ref-svg" role="img" aria-label="OLTS Reference Method Calibration Diagram" xmlns="http://www.w3.org/2000/svg">
      <rect width="680" height="180" rx="10" fill="#090d16" stroke="#1e293b" stroke-width="1" />

      <g transform="translate(20, 24)">
        <text x="0" y="0" fill="#38bdf8" font-size="12" font-weight="700">${escapeXml(method.name)}</text>
        <text x="0" y="18" fill="#94a3b8" font-size="10">${escapeXml(method.description)}</text>
      </g>

      <!-- Calibration Step Diagram -->
      <g transform="translate(40, 80)">
        <!-- Light Source OLS -->
        <rect x="0" y="10" width="70" height="45" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" />
        <text x="35" y="32" fill="#38bdf8" font-size="11" font-weight="700" text-anchor="middle">OLS</text>
        <text x="35" y="46" fill="#94a3b8" font-size="8" text-anchor="middle">Source</text>

        <!-- Launch Cord -->
        <path d="M 70 32 L 200 32" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" />
        <text x="135" y="22" fill="#38bdf8" font-size="9" text-anchor="middle">Launch Cord</text>

        ${is1Cord ? `
          <!-- 1-Cord: Direct to OPM -->
          <line x1="200" y1="32" x2="350" y2="32" stroke="#38bdf8" stroke-width="3" />
          <rect x="350" y="10" width="70" height="45" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="1.5" />
          <text x="385" y="32" fill="#10b981" font-size="11" font-weight="700" text-anchor="middle">OPM</text>
          <text x="385" y="46" fill="#94a3b8" font-size="8" text-anchor="middle">Meter</text>
          <text x="460" y="36" fill="#10b981" font-size="11" font-weight="700">&rarr; Press "SET ZERO / REF"</text>
        ` : (is2Cord ? `
          <!-- 2-Cord: Adapter + Receive Cord -->
          <rect x="200" y="24" width="20" height="16" rx="3" fill="#64748b" />
          <path d="M 220 32 L 340 32" stroke="#f59e0b" stroke-width="3" />
          <text x="280" y="22" fill="#f59e0b" font-size="9" text-anchor="middle">Receive Cord</text>
          <rect x="340" y="10" width="70" height="45" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="1.5" />
          <text x="375" y="32" fill="#10b981" font-size="11" font-weight="700" text-anchor="middle">OPM</text>
          <text x="375" y="46" fill="#94a3b8" font-size="8" text-anchor="middle">Meter</text>
          <text x="440" y="36" fill="#f59e0b" font-size="11" font-weight="700">&rarr; Reference through Adapter</text>
        ` : `
          <!-- 3-Cord: 2 Adapters + 3 Cords -->
          <rect x="200" y="24" width="16" height="16" rx="3" fill="#64748b" />
          <path d="M 216 32 L 300 32" stroke="#a855f7" stroke-width="3" />
          <rect x="300" y="24" width="16" height="16" rx="3" fill="#64748b" />
          <path d="M 316 32 L 400 32" stroke="#f59e0b" stroke-width="3" />
          <rect x="400" y="10" width="70" height="45" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="1.5" />
          <text x="435" y="32" fill="#10b981" font-size="11" font-weight="700" text-anchor="middle">OPM</text>
          <text x="510" y="36" fill="#a855f7" font-size="11" font-weight="700">&rarr; 3-Cord Reference</text>
        `)}
      </g>
    </svg>
  `;
}

/**
 * Generate Comprehensive Engineering Audit Report
 */
export function generateOltsAuditReport(data = {}) {
  const dateStr = data.timestamp ? new Date(data.timestamp).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) : new Date().toLocaleString();
  return `
======================================================================
SHAHDARA ISP - TIER-1 OPTICAL LOSS TEST SET (OLTS) CERTIFICATION
Standard: TIA-568.3-D / ISO/IEC 14763-3 / ITU-T G.652.D
======================================================================
Report Generated : ${dateStr} PKT
Link Identifier  : ${data.linkName || 'Shahdara Optical Link'}
Technician Name  : ${data.technician || 'Field Splicer Crew'}
Location / Area  : ${data.location || 'Shahdara, Lahore'}
Reference Method : ${data.referenceMethod || '1-Cord Reference (Method B)'}

LINK SPECIFICATIONS:
- Physical Length      : ${data.lengthKm || 0} km
- Test Wavelength      : ${data.wavelengthNm || 1310} nm (${data.band || 'Single-Mode'})
- Connector Interface  : ${data.connectorType || 'SC/APC'} (${data.connectorsCount || 2} mated pairs)
- Splice Joints        : ${data.spliceType || 'Core Fusion'} (${data.splicesCount || 0} joints)

BUDGET BREAKDOWN (TIA-568.3-D):
- Fiber Cable Loss     : ${data.fiberLossDb || 0} dB (${data.fiberLossPerKm || 0} dB/km)
- Connector Loss       : ${data.connectorLossDb || 0} dB
- Splice Loss          : ${data.spliceLossDb || 0} dB
- Total Allowed Budget : ${data.budgetDb || 0} dB

BI-DIRECTIONAL MEASUREMENTS:
- Forward Loss (A -> B): ${data.lossAtoB || 0} dB
- Reverse Loss (B -> A): ${data.lossBtoA || 0} dB
- Directional Delta    : ${data.deltaDb || 0} dB
- Bi-directional Avg   : ${data.avgLossDb || 0} dB
- Headroom Margin      : ${data.marginDb >= 0 ? '+' : ''}${data.marginDb || 0} dB
- Certification Status : [ ${data.status || 'PASS'} ]

DIAGNOSTIC ADVISORY:
${(data.diagnostics || []).map(d => `* ${d}`).join('\n')}

Urdu Technician Summary:
${data.advisoryUrdu || ''}
======================================================================
`.trim();
}

/**
 * Generate WhatsApp Field Dispatch Message
 */
export function generateOltsWhatsAppDispatch(data = {}) {
  const statusEmoji = data.status === 'PASS' ? '✅' : (data.status === 'MARGINAL' ? '⚠️' : '❌');
  return `*SHAHDARA ISP - OPTICAL LOSS (OLTS) TIER-1 CERTIFICATION* ${statusEmoji}
----------------------------------------
📍 *Link:* ${data.linkName || 'Shahdara Fiber Span'}
👷 *Tech:* ${data.technician || 'Lineman'} (${data.location || 'Shahdara'})
📏 *Span Length:* ${data.lengthKm || 0} km | 🌊 *Wave:* ${data.wavelengthNm || 1310}nm
🔌 *Connectors:* ${data.connectorsCount || 2}x ${data.connectorType || 'SC/APC'}
⚡ *Splices:* ${data.splicesCount || 0}x Fusion Splices

📊 *MEASUREMENTS (Bi-directional):*
• End A ➔ End B: *${data.lossAtoB || 0} dB*
• End B ➔ End A: *${data.lossBtoA || 0} dB*
• Directional &Delta;: *${data.deltaDb || 0} dB*
• *True Bi-dir Avg:* *${data.avgLossDb || 0} dB*
• *Allowed Budget:* *${data.budgetDb || 0} dB*
• *Headroom Margin:* *${data.marginDb >= 0 ? '+' : ''}${data.marginDb || 0} dB*

🎯 *RESULT:* *${data.status || 'PASS'}*
📋 *Advisory:* ${data.advisoryUrdu || ''}
----------------------------------------
_Verified via Shahdara Mobile ISP Field Assistant (TIA-568.3-D)_`.trim();
}

/**
 * LocalStorage Audit Persistence
 */
export function loadOltsAuditLog(storage = null) {
  try {
    const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s) return [];
    const raw = s.getItem(OLTS_CERT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load OLTS audit log:', e);
    return [];
  }
}

export function saveOltsAuditLog(record, storage = null) {
  try {
    const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s) return [];
    const list = loadOltsAuditLog(s);
    const newRecord = {
      id: 'OLTS_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      ...record
    };
    list.unshift(newRecord);
    // Keep max 50 records
    const trimmed = list.slice(0, 50);
    s.setItem(OLTS_CERT_STORAGE_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch (e) {
    console.error('Failed to save OLTS audit record:', e);
    return [];
  }
}

export function clearOltsAuditLog(storage = null) {
  try {
    const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s) return;
    s.removeItem(OLTS_CERT_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear OLTS audit log:', e);
  }
}

/**
 * Export Audit Records as CSV
 */
export function exportOltsAuditsCsv(records = []) {
  const headers = [
    'Record ID', 'Timestamp', 'Link Name', 'Technician', 'Location',
    'Length (km)', 'Wavelength (nm)', 'Connectors', 'Splices',
    'Loss A->B (dB)', 'Loss B->A (dB)', 'Avg Loss (dB)', 'Budget (dB)',
    'Margin (dB)', 'Status'
  ];

  const rows = records.map(r => [
    r.id,
    r.timestamp,
    `"${(r.linkName || '').replace(/"/g, '""')}"`,
    `"${(r.technician || '').replace(/"/g, '""')}"`,
    `"${(r.location || '').replace(/"/g, '""')}"`,
    r.lengthKm,
    r.wavelengthNm,
    r.connectorsCount,
    r.splicesCount,
    r.lossAtoB,
    r.lossBtoA,
    r.avgLossDb,
    r.budgetDb,
    r.marginDb,
    r.status
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
}

/**
 * Helper to escape HTML/XML characters
 */
function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Setup and initialize Mobile OLTS Certification Modal
 */
export function setupMobileOltsModal(state = {}, options = {}) {
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const onToast = options.onToast || ((msg) => console.log(msg));

  // Find DOM elements
  const modal = document.getElementById('mobileOltsModal');
  const openBtn = document.getElementById('mobileMoreOltsBtn');
  const closeBtn = document.getElementById('mobileOltsModalCloseBtn');

  if (!modal) return null;

  // Form input elements
  const presetSelect = document.getElementById('oltsPresetSelect');
  const linkNameInput = document.getElementById('oltsLinkName');
  const techInput = document.getElementById('oltsTechnician');
  const locationInput = document.getElementById('oltsLocation');
  const lengthInput = document.getElementById('oltsLengthKm');
  const wavelengthSelect = document.getElementById('oltsWavelength');
  const refMethodSelect = document.getElementById('oltsRefMethod');
  const connectorsCountInput = document.getElementById('oltsConnectorsCount');
  const connectorTypeSelect = document.getElementById('oltsConnectorType');
  const splicesCountInput = document.getElementById('oltsSplicesCount');
  const spliceTypeSelect = document.getElementById('oltsSpliceType');
  const lossAtoBInput = document.getElementById('oltsLossAtoB');
  const lossBtoAInput = document.getElementById('oltsLossBtoA');

  // Display elements
  const svgContainer = document.getElementById('oltsSvgContainer');
  const refSvgContainer = document.getElementById('oltsRefSvgContainer');
  const avgLossDisplay = document.getElementById('oltsAvgLossDisplay');
  const budgetDisplay = document.getElementById('oltsBudgetDisplay');
  const marginDisplay = document.getElementById('oltsMarginDisplay');
  const deltaDisplay = document.getElementById('oltsDeltaDisplay');
  const statusBadge = document.getElementById('oltsStatusBadge');
  const urduAdvisory = document.getElementById('oltsUrduAdvisory');
  const diagnosticsList = document.getElementById('oltsDiagnosticsList');

  // Action buttons
  const saveBtn = document.getElementById('oltsSaveAuditBtn');
  const whatsappBtn = document.getElementById('oltsWhatsappBtn');
  const copyReportBtn = document.getElementById('oltsCopyReportBtn');
  const exportCsvBtn = document.getElementById('oltsExportCsvBtn');
  const clearHistoryBtn = document.getElementById('oltsClearHistoryBtn');
  const historyTbody = document.getElementById('oltsHistoryTbody');

  function calculateCurrent() {
    const lengthKm = parseFloat(lengthInput?.value) || 1.0;
    const wavelengthId = wavelengthSelect?.value || 'SM_1310';
    const splicesCount = parseInt(splicesCountInput?.value, 10) || 0;
    const spliceType = spliceTypeSelect?.value || 'FUSION';
    const connectorsCount = parseInt(connectorsCountInput?.value, 10) || 2;
    const connectorType = connectorTypeSelect?.value || 'SC_APC';
    const lossAtoB = parseFloat(lossAtoBInput?.value) || 0;
    const lossBtoA = parseFloat(lossBtoAInput?.value) || 0;

    const budgetData = calculateTier1LossBudget({
      lengthKm,
      wavelengthId,
      splicesCount,
      spliceType,
      connectorsCount,
      connectorType
    });

    const certData = calculateBidirectionalCertification({
      lossAtoB,
      lossBtoA,
      budgetDb: budgetData.totalBudgetDb,
      lengthKm
    });

    return {
      ...budgetData,
      ...certData,
      linkName: linkNameInput?.value || 'Shahdara Optical Span',
      technician: techInput?.value || 'Field Splicer Crew',
      location: locationInput?.value || 'Shahdara, Lahore',
      referenceMethod: refMethodSelect?.options[refMethodSelect?.selectedIndex]?.text || '1-Cord Reference',
      referenceMethodId: refMethodSelect?.value || 'METHOD_1_CORD',
      connectorType: connectorTypeSelect?.options[connectorTypeSelect?.selectedIndex]?.text || 'SC/APC',
      spliceType: spliceTypeSelect?.options[spliceTypeSelect?.selectedIndex]?.text || 'Fusion Splice'
    };
  }

  function updateUi() {
    const current = calculateCurrent();

    if (avgLossDisplay) avgLossDisplay.textContent = current.avgLossDb.toFixed(2) + ' dB';
    if (budgetDisplay) budgetDisplay.textContent = current.budgetDb.toFixed(2) + ' dB';
    if (marginDisplay) {
      marginDisplay.textContent = (current.marginDb >= 0 ? '+' : '') + current.marginDb.toFixed(2) + ' dB';
      marginDisplay.style.color = current.statusColor;
    }
    if (deltaDisplay) deltaDisplay.textContent = current.deltaDb.toFixed(2) + ' dB';

    if (statusBadge) {
      statusBadge.textContent = current.statusText;
      statusBadge.className = 'status-badge ' + current.badgeClass;
      statusBadge.style.backgroundColor = current.statusColor + '22';
      statusBadge.style.color = current.statusColor;
      statusBadge.style.borderColor = current.statusColor;
    }

    if (urduAdvisory) urduAdvisory.textContent = current.advisoryUrdu;

    if (diagnosticsList) {
      diagnosticsList.innerHTML = '';
      current.diagnostics.forEach(diag => {
        const li = document.createElement('li');
        li.textContent = diag;
        diagnosticsList.appendChild(li);
      });
    }

    if (svgContainer) {
      svgContainer.innerHTML = renderOltsCertificationSvg({
        lossAtoB: current.lossAtoB,
        lossBtoA: current.lossBtoA,
        avgLossDb: current.avgLossDb,
        budgetDb: current.budgetDb,
        marginDb: current.marginDb,
        status: current.status,
        wavelengthNm: current.wavelength.wavelengthNm,
        linkName: current.linkName
      });
    }

    if (refSvgContainer) {
      refSvgContainer.innerHTML = renderOltsReferenceDiagramSvg({
        methodId: current.referenceMethodId
      });
    }
  }

  function renderHistory() {
    if (!historyTbody) return;
    const history = loadOltsAuditLog(storage);
    historyTbody.innerHTML = '';

    if (history.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="7" class="empty-table-cell">No certification audits recorded yet.</td>';
      historyTbody.appendChild(tr);
      return;
    }

    history.forEach(item => {
      const tr = document.createElement('tr');
      const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const color = item.status === 'PASS' ? '#10b981' : (item.status === 'MARGINAL' ? '#f59e0b' : '#ef4444');

      tr.innerHTML = `
        <td>${escapeXml(item.linkName || '')}</td>
        <td>${escapeXml(timeStr)}</td>
        <td>${item.wavelengthNm || 1310} nm</td>
        <td>${(item.avgLossDb || 0).toFixed(2)} dB</td>
        <td>${(item.budgetDb || 0).toFixed(2)} dB</td>
        <td><span style="color: ${color}; font-weight: bold;">${item.status}</span></td>
        <td>
          <button type="button" class="btn-table-action" data-action="whatsapp" data-id="${item.id}" title="Send WhatsApp">WA</button>
        </td>
      `;
      historyTbody.appendChild(tr);
    });

    // Wire table WhatsApp action buttons
    historyTbody.querySelectorAll('button[data-action="whatsapp"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const found = history.find(r => r.id === id);
        if (found) {
          const text = generateOltsWhatsAppDispatch(found);
          const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text);
          window.open(url, '_blank');
        }
      });
    });
  }

  // Wire Preset Selection
  presetSelect?.addEventListener('change', () => {
    const presetKey = presetSelect.value;
    const p = OLTS_PRESETS[presetKey];
    if (p) {
      if (linkNameInput) linkNameInput.value = p.name;
      if (lengthInput) lengthInput.value = p.lengthKm;
      if (wavelengthSelect) wavelengthSelect.value = p.wavelengthId;
      if (splicesCountInput) splicesCountInput.value = p.splicesCount;
      if (spliceTypeSelect) spliceTypeSelect.value = p.spliceType;
      if (connectorsCountInput) connectorsCountInput.value = p.connectorsCount;
      if (connectorTypeSelect) connectorTypeSelect.value = p.connectorType;
      if (refMethodSelect) refMethodSelect.value = p.referenceMethod;
      if (lossAtoBInput) lossAtoBInput.value = p.lossAtoB;
      if (lossBtoAInput) lossBtoAInput.value = p.lossBtoA;
      updateUi();
      onToast(`Loaded preset: ${p.name}`);
    }
  });

  // Wire input listeners for live updates
  const liveInputs = [
    linkNameInput, techInput, locationInput, lengthInput, wavelengthSelect,
    refMethodSelect, connectorsCountInput, connectorTypeSelect,
    splicesCountInput, spliceTypeSelect, lossAtoBInput, lossBtoAInput
  ];
  liveInputs.forEach(input => {
    input?.addEventListener('input', updateUi);
    input?.addEventListener('change', updateUi);
  });

  // Action: Save Audit
  saveBtn?.addEventListener('click', () => {
    const current = calculateCurrent();
    saveOltsAuditLog(current, storage);
    renderHistory();
    onToast(`OLTS certification record saved: ${current.status}`);
  });

  // Action: WhatsApp Dispatch
  whatsappBtn?.addEventListener('click', () => {
    const current = calculateCurrent();
    const text = generateOltsWhatsAppDispatch(current);
    const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text);
    window.open(url, '_blank');
    onToast('Opening WhatsApp dispatch ticket...');
  });

  // Action: Copy Text Report
  copyReportBtn?.addEventListener('click', () => {
    const current = calculateCurrent();
    const report = generateOltsAuditReport(current);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(report).then(() => {
        onToast('Audit report copied to clipboard');
      }).catch(() => {
        onToast('Failed to copy report to clipboard');
      });
    } else {
      onToast('Clipboard API unavailable in this browser');
    }
  });

  // Action: Export CSV
  exportCsvBtn?.addEventListener('click', () => {
    const history = loadOltsAuditLog(storage);
    if (history.length === 0) {
      onToast('No audit records to export');
      return;
    }
    const csv = exportOltsAuditsCsv(history);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shahdara_olts_cert_audits_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Exported audits to CSV');
  });

  // Action: Clear History
  clearHistoryBtn?.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all OLTS certification audit logs?')) {
      clearOltsAuditLog(storage);
      renderHistory();
      onToast('OLTS audit logs cleared');
    }
  });

  // Modal open / close handlers
  openBtn?.addEventListener('click', () => {
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
    updateUi();
    renderHistory();
  });

  closeBtn?.addEventListener('click', () => {
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    }
  });

  // Initial render
  updateUi();
  renderHistory();

  return {
    modal,
    updateUi,
    renderHistory,
    calculateCurrent
  };
}
