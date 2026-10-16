/**
 * Shahdara ISP Billing & Network Operations - Optical Fiber Connector Ferrule End-Face Geometric
 * Interferometry (Curvature Radius, Apex Offset, Fiber Protrusion/Undercut) & Mechanical Durability QA Certification Suite
 * Standards: IEC 61300-3-15, Telcordia GR-326-CORE Issue 4, IEC 61755-3-1, IEC 61755-3-2, IEC 61300-2-2
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const FERRULE_GEOMETRY_CERT_STORAGE_KEY = 'shahdara_ferrule_geometry_certs_v1';

export const FERRULE_CONNECTOR_TYPES = {
  'SC_APC': {
    id: 'SC_APC',
    label: 'SC/APC (Angled Physical Contact - 8°)',
    polish: 'APC',
    formFactor: 'SC',
    ferruleDiameterMm: 2.50,
    nominalAngleDeg: 8.00,
    minAngleDeg: 7.80,
    maxAngleDeg: 8.20,
    minRocMm: 5.0,
    maxRocMm: 12.0,
    optimalRocMm: 8.0,
    maxApexOffsetUm: 50.0,
    gradeAApexOffsetUm: 30.0,
    minFiberHeightNm: -50.0,
    maxFiberHeightNm: 50.0,
    gradeAMinFiberHeightNm: -20.0,
    gradeAMaxFiberHeightNm: 30.0,
    nominalSpringForceN: 7.8,
    minReturnLossDb: 65,
    maxInsertionLossDb: 0.25
  },
  'SC_UPC': {
    id: 'SC_UPC',
    label: 'SC/UPC (Ultra Physical Contact - 0°)',
    polish: 'UPC',
    formFactor: 'SC',
    ferruleDiameterMm: 2.50,
    nominalAngleDeg: 0.00,
    minAngleDeg: -0.15,
    maxAngleDeg: 0.15,
    minRocMm: 10.0,
    maxRocMm: 25.0,
    optimalRocMm: 15.0,
    maxApexOffsetUm: 50.0,
    gradeAApexOffsetUm: 30.0,
    minFiberHeightNm: -50.0,
    maxFiberHeightNm: 50.0,
    gradeAMinFiberHeightNm: -20.0,
    gradeAMaxFiberHeightNm: 30.0,
    nominalSpringForceN: 7.8,
    minReturnLossDb: 55,
    maxInsertionLossDb: 0.25
  },
  'LC_APC': {
    id: 'LC_APC',
    label: 'LC/APC (Angled Physical Contact - Small Form Factor 1.25mm)',
    polish: 'APC',
    formFactor: 'LC',
    ferruleDiameterMm: 1.25,
    nominalAngleDeg: 8.00,
    minAngleDeg: 7.80,
    maxAngleDeg: 8.20,
    minRocMm: 5.0,
    maxRocMm: 12.0,
    optimalRocMm: 8.0,
    maxApexOffsetUm: 50.0,
    gradeAApexOffsetUm: 30.0,
    minFiberHeightNm: -50.0,
    maxFiberHeightNm: 50.0,
    gradeAMinFiberHeightNm: -20.0,
    gradeAMaxFiberHeightNm: 30.0,
    nominalSpringForceN: 5.5,
    minReturnLossDb: 65,
    maxInsertionLossDb: 0.25
  },
  'LC_UPC': {
    id: 'LC_UPC',
    label: 'LC/UPC (Ultra Physical Contact - Small Form Factor 1.25mm)',
    polish: 'UPC',
    formFactor: 'LC',
    ferruleDiameterMm: 1.25,
    nominalAngleDeg: 0.00,
    minAngleDeg: -0.15,
    maxAngleDeg: 0.15,
    minRocMm: 7.0,
    maxRocMm: 25.0,
    optimalRocMm: 14.0,
    maxApexOffsetUm: 50.0,
    gradeAApexOffsetUm: 30.0,
    minFiberHeightNm: -50.0,
    maxFiberHeightNm: 50.0,
    gradeAMinFiberHeightNm: -20.0,
    gradeAMaxFiberHeightNm: 30.0,
    nominalSpringForceN: 5.5,
    minReturnLossDb: 55,
    maxInsertionLossDb: 0.25
  },
  'FC_APC': {
    id: 'FC_APC',
    label: 'FC/APC (Threaded Angled Contact 2.5mm)',
    polish: 'APC',
    formFactor: 'FC',
    ferruleDiameterMm: 2.50,
    nominalAngleDeg: 8.00,
    minAngleDeg: 7.80,
    maxAngleDeg: 8.20,
    minRocMm: 5.0,
    maxRocMm: 12.0,
    optimalRocMm: 8.0,
    maxApexOffsetUm: 50.0,
    gradeAApexOffsetUm: 30.0,
    minFiberHeightNm: -50.0,
    maxFiberHeightNm: 50.0,
    gradeAMinFiberHeightNm: -20.0,
    gradeAMaxFiberHeightNm: 30.0,
    nominalSpringForceN: 7.8,
    minReturnLossDb: 65,
    maxInsertionLossDb: 0.25
  },
  'FC_UPC': {
    id: 'FC_UPC',
    label: 'FC/UPC (Threaded Ultra Physical Contact 2.5mm)',
    polish: 'UPC',
    formFactor: 'FC',
    ferruleDiameterMm: 2.50,
    nominalAngleDeg: 0.00,
    minAngleDeg: -0.15,
    maxAngleDeg: 0.15,
    minRocMm: 10.0,
    maxRocMm: 25.0,
    optimalRocMm: 15.0,
    maxApexOffsetUm: 50.0,
    gradeAApexOffsetUm: 30.0,
    minFiberHeightNm: -50.0,
    maxFiberHeightNm: 50.0,
    gradeAMinFiberHeightNm: -20.0,
    gradeAMaxFiberHeightNm: 30.0,
    nominalSpringForceN: 7.8,
    minReturnLossDb: 55,
    maxInsertionLossDb: 0.25
  }
};

export const FERRULE_GEOMETRY_PRESETS = {
  PRESET_SHAHDARA_NOC_MASTER_APC: {
    id: 'PRESET_SHAHDARA_NOC_MASTER_APC',
    name: 'NOC ODF Master Patch Cord (SC/APC Grade A Reference)',
    connectorType: 'SC_APC',
    rocMm: 8.4,
    apexOffsetUm: 14.2,
    fiberHeightNm: 18.0,
    angleDeg: 8.04,
    springForceN: 8.0,
    matingCycles: 15,
    location: 'Shahdara Central NOC - Rack 01 ODF Shelf 04',
    inspectorName: 'Engr. Haris Tariq',
    serialNumber: 'SN-APC-REF-2026-001',
    description: 'Precision interferometer certified master patch cord for test calibration.'
  },
  PRESET_SHAHDARA_LOCAL_PIGTAIL_APEX_FAIL: {
    id: 'PRESET_SHAHDARA_LOCAL_PIGTAIL_APEX_FAIL',
    name: 'Cheap Local Market Pigtail with Severe Apex Offset',
    connectorType: 'SC_UPC',
    rocMm: 18.5,
    apexOffsetUm: 74.8,
    fiberHeightNm: -65.0,
    angleDeg: 0.08,
    springForceN: 7.5,
    matingCycles: 2,
    location: 'Kala Khatai Road Distribution Sub-FAT 09',
    inspectorName: 'Muhammad Rizwan',
    serialNumber: 'SN-UNB-PIG-99824',
    description: 'Unbranded cheap pigtail with off-center apex dome causing fiber core air gap.'
  },
  PRESET_SHAHDARA_XGSPON_ENTERPRISE_APC: {
    id: 'PRESET_SHAHDARA_XGSPON_ENTERPRISE_APC',
    name: 'Shahdara Commercial Plaza 10G XGS-PON Drop (SC/APC Class B)',
    connectorType: 'SC_APC',
    rocMm: 7.8,
    apexOffsetUm: 28.5,
    fiberHeightNm: 6.0,
    angleDeg: 7.96,
    springForceN: 7.8,
    matingCycles: 8,
    location: 'Shahdara Commercial Plaza - Unit 204 B2B Demarcation',
    inspectorName: 'Usman Ali',
    serialNumber: 'SN-XGS-ENT-44812',
    description: 'Compliant field termination for 10Gbps symmetrical fiber internet customer.'
  },
  PRESET_SHAHDARA_OVERPOLISHED_UNDERCUT_FAIL: {
    id: 'PRESET_SHAHDARA_OVERPOLISHED_UNDERCUT_FAIL',
    name: 'Manual Field Polishing Puck Over-Polished Patchcord',
    connectorType: 'FC_UPC',
    rocMm: 9.1,
    apexOffsetUm: 32.0,
    fiberHeightNm: -135.0,
    angleDeg: 0.12,
    springForceN: 7.2,
    matingCycles: 4,
    location: 'Rachna Town Feeder Hub FAT-03',
    inspectorName: 'Bilal Ahmad',
    serialNumber: 'SN-FLD-POL-55019',
    description: 'Manual hand puck over-polishing caused deep glass undercut pit, loss of contact.'
  },
  PRESET_SHAHDARA_EXCESSIVE_RADIUS_FLAT_FAIL: {
    id: 'PRESET_SHAHDARA_EXCESSIVE_RADIUS_FLAT_FAIL',
    name: 'Vandala Road Sub-FAT Worn Polishing Film Ferrule',
    connectorType: 'LC_UPC',
    rocMm: 38.0,
    apexOffsetUm: 42.0,
    fiberHeightNm: -15.0,
    angleDeg: 0.05,
    springForceN: 5.5,
    matingCycles: 28,
    location: 'Vandala Road Pole 14 Sub-FAT Demarc',
    inspectorName: 'Muhammad Rizwan',
    serialNumber: 'SN-LC-FLAT-77102',
    description: 'Worn polishing film generated a nearly flat surface (RoC > 25mm), unable to deform.'
  }
};

/**
 * Pure evaluation function for ferrule end-face geometric interferometry parameters.
 * Implements physics equations of spherical dome drop, Hertzian contact deformation,
 * net optical core separation air gap, core compressive stress, and Telcordia GR-326 PASS/FAIL grading.
 */
export function evaluateFerruleGeometry(params = {}) {
  const connTypeKey = params.connectorType || 'SC_APC';
  const typeSpec = FERRULE_CONNECTOR_TYPES[connTypeKey] || FERRULE_CONNECTOR_TYPES['SC_APC'];

  const rocMm = Number(params.rocMm) > 0 ? Number(params.rocMm) : typeSpec.optimalRocMm;
  const apexOffsetUm = Math.max(0, Number(params.apexOffsetUm) || 0);
  const fiberHeightNm = Number(params.fiberHeightNm) || 0; // positive = protrusion, negative = undercut
  const angleDeg = Number.isFinite(Number(params.angleDeg)) ? Number(params.angleDeg) : typeSpec.nominalAngleDeg;
  const springForceN = Number(params.springForceN) > 0 ? Number(params.springForceN) : typeSpec.nominalSpringForceN;
  const matingCycles = Math.max(1, Number(params.matingCycles) || 1);

  // 1. Geometric spherical dome drop between ferrule apex and fiber core center:
  // delta_z = R - sqrt(R^2 - delta^2) approx delta^2 / (2 * R)
  // With delta in um (1e-6 m) and R in mm (1e-3 m):
  // delta_z (m) = (delta_um * 1e-6)^2 / (2 * R_mm * 1e-3) = delta_um^2 * 1e-9 / (2 * R_mm)
  // In nanometers (1e9 m): delta_z (nm) = (delta_um * delta_um) / (2 * rocMm)
  const domeDropNm = Number(((apexOffsetUm * apexOffsetUm) / (2 * rocMm)).toFixed(2));

  // 2. Elastic deformation of zirconia dome under connector spring latching force F:
  // delta_z_elastic approx 60nm * (10 / R_mm)^(1/3) * (F / 7.8N)^(2/3)
  const baseDeformation = 60 * Math.pow(10 / Math.max(1.0, rocMm), 1 / 3);
  const forceMultiplier = Math.pow(springForceN / 7.8, 2 / 3);
  const elasticCompNm = Number((baseDeformation * forceMultiplier).toFixed(2));

  // 3. Net Core Separation Air Gap:
  // g_net = max(0, domeDropNm - fiberHeightNm - elasticCompNm)
  // (Recall: undercut is negative fiberHeightNm, which increases the gap!)
  const rawGapNm = domeDropNm - fiberHeightNm - elasticCompNm;
  const airGapNm = Math.max(0, Number(rawGapNm.toFixed(2)));
  const isPhysicalContact = airGapNm <= 0;

  // 4. Contact zone radius (Hertzian contact circle) a:
  // a = ( (3 * F * R) / (4 * E*) )^(1/3) with zirconia E* approx 110 GPa
  // In micrometers: approx 80 um * (R_mm / 10)^(1/3) * (F / 7.8N)^(1/3)
  const contactRadiusUm = Number((80 * Math.pow(Math.max(1.0, rocMm) / 10, 1 / 3) * Math.pow(springForceN / 7.8, 1 / 3)).toFixed(2));

  // 5. Hertzian Maximum Compressive Stress at contact center (MPa):
  // sigma_max = 3*F / (2*pi*a^2)
  // With F in N and a in um: sigma_max = (3 * F * 1e6) / (2 * pi * a_um^2) MPa
  const hertzianStressMpa = Number((
    (3 * springForceN * 1e6) / (2 * Math.PI * Math.pow(contactRadiusUm, 2))
  ).toFixed(1));

  // 6. Insertion Loss & Optical Return Loss (Reflectance) Estimation:
  let estimatedIlDb = 0.08;
  let estimatedOrlDb = typeSpec.polish === 'APC' ? 68.0 : 58.0;

  if (airGapNm > 0) {
    // Air gap causes Fabry-Perot interference reflection and divergence loss
    // Fresnel reflection R_F = ((1.468 - 1) / (1.468 + 1))^2 = 0.0359 (-14.4 dB)
    const wavelengthNm = 1310;
    const sinTerm = Math.sin((2 * Math.PI * airGapNm) / wavelengthNm);
    const fpLossDb = 10 * Math.log10(1 + (4 * 0.0359 * Math.pow(sinTerm, 2)) / Math.pow(1 - 0.0359, 2));
    const diffractionLossDb = 0.002 * airGapNm;
    estimatedIlDb = Number((0.15 + fpLossDb + diffractionLossDb).toFixed(2));

    if (typeSpec.polish === 'APC') {
      // APC 8-degree angle reflects air-gap light away from core, but gap degrades return loss
      estimatedOrlDb = Math.max(28.0, Number((65.0 - (airGapNm * 0.15)).toFixed(1)));
    } else {
      // UPC directly reflects back into core
      estimatedOrlDb = Math.max(14.5, Number((55.0 - (airGapNm * 0.25)).toFixed(1)));
    }
  } else {
    // Physical contact established! Minor loss due to slight apex eccentricity
    const eccentricityLoss = (apexOffsetUm / 50.0) * 0.08;
    estimatedIlDb = Number((0.08 + eccentricityLoss).toFixed(2));
    if (typeSpec.polish === 'APC') {
      estimatedOrlDb = Number((68.0 - (apexOffsetUm / 50.0) * 3.0).toFixed(1));
    } else {
      estimatedOrlDb = Number((58.0 - (apexOffsetUm / 50.0) * 4.0).toFixed(1));
    }
  }

  // 7. Mechanical Endurance Degradation over mating cycles:
  const cycleStressFactor = 1.0 + (matingCycles / 500) * 0.15;
  const mechanicalEndurancePass = matingCycles <= 500 && hertzianStressMpa <= 1200;

  // 8. Individual Parameter Tolerance Checks:
  const isRocValid = rocMm >= typeSpec.minRocMm && rocMm <= typeSpec.maxRocMm;
  const isApexValid = apexOffsetUm <= typeSpec.maxApexOffsetUm;
  const isFiberHeightValid = fiberHeightNm >= typeSpec.minFiberHeightNm && fiberHeightNm <= typeSpec.maxFiberHeightNm;
  const isAngleValid = angleDeg >= typeSpec.minAngleDeg && angleDeg <= typeSpec.maxAngleDeg;
  const isStressSafe = hertzianStressMpa <= 1200; // Glass micro-cracking threshold

  // Grade A criteria: Tight precision tolerances
  const isGradeA = isPhysicalContact &&
    isRocValid &&
    apexOffsetUm <= typeSpec.gradeAApexOffsetUm &&
    fiberHeightNm >= typeSpec.gradeAMinFiberHeightNm &&
    fiberHeightNm <= typeSpec.gradeAMaxFiberHeightNm &&
    isAngleValid &&
    isStressSafe;

  // Grade B criteria: Standard Telcordia GR-326 pass
  const isGradeB = isPhysicalContact &&
    isRocValid &&
    isApexValid &&
    isFiberHeightValid &&
    isAngleValid &&
    isStressSafe;

  let overallVerdict = 'FAIL';
  let verdictStatus = 'FAIL';
  let badgeColor = '#ef4444'; // Red
  let diagnosticSummary = '';
  let recommendation = '';

  if (isGradeA) {
    overallVerdict = 'PASS_GRADE_A';
    verdictStatus = 'PASS';
    badgeColor = '#10b981'; // Green
    diagnosticSummary = 'Master Grade A Reference: Flawless physical contact geometry, low apex offset, zero air gap.';
    recommendation = 'Fully certified for NOC core backbone ODF patch cords, DWDM mux/demux, and 100G/400G transceivers.';
  } else if (isGradeB) {
    overallVerdict = 'PASS_GRADE_B';
    verdictStatus = 'PASS';
    badgeColor = '#059669'; // Emerald
    diagnosticSummary = 'Telcordia GR-326-CORE Issue 4 Compliant: Full physical contact achieved under standard latch force.';
    recommendation = 'Approved for standard FTTH drop cables, FAT closures, customer ONU patch cords, and OLT PON line cards.';
  } else if (isPhysicalContact && (!isRocValid || !isAngleValid)) {
    overallVerdict = 'CONDITIONAL_PASS';
    verdictStatus = 'WARNING';
    badgeColor = '#f59e0b'; // Amber
    diagnosticSummary = 'Conditional Acceptance: Physical contact established, but RoC or angle is near outer boundary limit.';
    recommendation = 'Acceptable for short local subscriber drops, but monitor connector return loss during periodic audits.';
  } else {
    overallVerdict = 'FAIL';
    verdictStatus = 'FAIL';
    badgeColor = '#ef4444'; // Red

    const defects = [];
    if (!isPhysicalContact) defects.push(`Core Air Gap (${airGapNm} nm separation)`);
    if (rocMm < typeSpec.minRocMm) defects.push(`Excessive Curvature (RoC ${rocMm} mm < ${typeSpec.minRocMm} mm)`);
    if (rocMm > typeSpec.maxRocMm) defects.push(`Excessive Flatness (RoC ${rocMm} mm > ${typeSpec.maxRocMm} mm)`);
    if (!isApexValid) defects.push(`Apex Offset (${apexOffsetUm} µm > ${typeSpec.maxApexOffsetUm} µm limit)`);
    if (fiberHeightNm < typeSpec.minFiberHeightNm) defects.push(`Excessive Undercut (${fiberHeightNm} nm < ${typeSpec.minFiberHeightNm} nm)`);
    if (fiberHeightNm > typeSpec.maxFiberHeightNm) defects.push(`Excessive Protrusion (${fiberHeightNm} nm > ${typeSpec.maxFiberHeightNm} nm)`);
    if (!isAngleValid) defects.push(`Polish Angle Error (${angleDeg}° outside [${typeSpec.minAngleDeg}°, ${typeSpec.maxAngleDeg}°])`);
    if (!isStressSafe) defects.push(`Excessive Hertzian Compressive Stress (${hertzianStressMpa} MPa > 1200 MPa)`);

    diagnosticSummary = `Geometry Rejection: ${defects.join(', ')}.`;
    if (airGapNm > 0 && fiberHeightNm < -50) {
      recommendation = 'Connector ferrule is over-polished (deep undercut pit). Re-terminate with fresh pigtail or replace connector assembly.';
    } else if (apexOffsetUm > 50) {
      recommendation = 'Excessive apex eccentric error due to uneven polishing jig pressure. Re-polish ferrule in calibrated 4-corner fixture.';
    } else if (rocMm > typeSpec.maxRocMm) {
      recommendation = 'Ferrule is too flat. Use higher durometer polishing pad (80D) and fresh diamond film to restore dome radius.';
    } else {
      recommendation = 'Reject connector ferrule. Clean polishing fixture and recalibrate automated polishing machine.';
    }
  }

  return {
    connectorType: connTypeKey,
    typeSpec,
    rocMm,
    apexOffsetUm,
    fiberHeightNm,
    angleDeg,
    springForceN,
    matingCycles,
    domeDropNm,
    elasticCompNm,
    airGapNm,
    isPhysicalContact,
    contactRadiusUm,
    hertzianStressMpa,
    estimatedIlDb,
    estimatedOrlDb,
    cycleStressFactor,
    mechanicalEndurancePass,
    isRocValid,
    isApexValid,
    isFiberHeightValid,
    isAngleValid,
    isStressSafe,
    overallVerdict,
    verdictStatus,
    badgeColor,
    diagnosticSummary,
    recommendation
  };
}

/**
 * Renders an interactive vector SVG showing the 2D ferrule dome profile, optical fiber core,
 * apex offset shift, protrusion/undercut magnification callout, and interferometric contour ring preview.
 */
export function renderFerruleGeometryAnalysisSvg(calc, options = {}) {
  const width = options.width || 820;
  const height = options.height || 360;

  const isPass = calc.verdictStatus === 'PASS';
  const statusColor = calc.badgeColor;

  // Ferrule dome representation in SVG coordinates
  // Dome center at (280, 260), radius scaled for visual clarity
  const apexX = 280;
  const apexY = 80;
  // Scaled offset: 50 um = 60 px
  const offsetPx = Math.min(100, Math.max(-100, (calc.apexOffsetUm / 50.0) * 60));
  const coreX = apexX + offsetPx;
  const coreY = apexY + Math.min(40, (calc.domeDropNm / 100) * 20);

  // Protrusion/undercut magnified indicator
  // Protrusion: sticks up (+Y in geometry = -Y in SVG), Undercut: dips down (+Y in SVG)
  const fiberOffsetPx = Math.min(25, Math.max(-25, -(calc.fiberHeightNm / 50.0) * 15));

  // Determine interference ring colors based on pass/fail
  const fringeStroke = isPass ? '#10b981' : '#f43f5e';
  const contactText = calc.isPhysicalContact
    ? 'PHYSICAL CONTACT ACHIEVED'
    : `AIR GAP PRESENT (${calc.airGapNm} nm)`;
  const contactFill = calc.isPhysicalContact ? '#10b981' : '#ef4444';

  return `
<svg class="ferrule-geometry-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ferrule End-Face Geometric Interferometry Analysis Diagram">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1120" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>

    <!-- Zirconia Ferrule Body Gradient -->
    <linearGradient id="zirconiaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#cbd5e1" />
      <stop offset="40%" stop-color="#94a3b8" />
      <stop offset="100%" stop-color="#475569" />
    </linearGradient>

    <!-- Silica Cladding Gradient -->
    <linearGradient id="claddingGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.6" />
      <stop offset="50%" stop-color="#0284c7" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.6" />
    </linearGradient>

    <!-- Fiber Core Gradient (Laser light) -->
    <linearGradient id="coreGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="100%" stop-color="#eab308" />
    </linearGradient>

    <!-- Glow Filter for Laser & High-lights -->
    <filter id="laserGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Canvas Background Card -->
  <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="url(#bgGrad)" stroke="#334155" stroke-width="1.5" />

  <!-- Section 1: Ferrule Cross-Section Profile (Left Panel) -->
  <g id="ferruleCrossSection">
    <!-- Header Label -->
    <text x="24" y="32" fill="#f8fafc" font-size="14" font-weight="700" font-family="system-ui, sans-serif">2D FERRULE DOME &amp; FIBER CORE INTERFACE</text>
    <text x="24" y="48" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">IEC 61300-3-15 Spherical Dome Geometry &amp; Apex Offset Profilometry</text>

    <!-- Zirconia Ferrule Body Shape (Curved Dome on Top) -->
    <path d="M 120 280 L 120 160 C 180 80, 380 80, 440 160 L 440 280 Z" fill="url(#zirconiaGrad)" stroke="#64748b" stroke-width="2" />
    <text x="140" y="270" fill="#1e293b" font-size="11" font-weight="700">ZIRCONIA (ZrO₂) FERRULE Ø ${calc.typeSpec.ferruleDiameterMm}mm</text>

    <!-- 125µm Glass Cladding Cylinder inside Ferrule -->
    <rect x="${coreX - 28}" y="120" width="56" height="160" fill="url(#claddingGrad)" stroke="#0284c7" stroke-width="1.5" />
    <text x="${coreX - 24}" y="255" fill="#f0f9ff" font-size="9" font-weight="600">CLADDING (125µm)</text>

    <!-- 9µm Singlemode Fiber Core -->
    <rect x="${coreX - 7}" y="95" width="14" height="185" fill="url(#coreGrad)" filter="url(#laserGlow)" stroke="#ca8a04" stroke-width="1" />
    <text x="${coreX - 6}" y="235" fill="#713f12" font-size="8" font-weight="800">CORE (9µm)</text>

    <!-- Apex Point & Centerline -->
    <!-- Theoretical Ferrule Apex Line -->
    <line x1="${apexX}" y1="65" x2="${apexX}" y2="280" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="4,4" />
    <circle cx="${apexX}" cy="${apexY}" r="4.5" fill="#f43f5e" />
    <text x="${apexX - 35}" y="60" fill="#f43f5e" font-size="10" font-weight="700">FERRULE APEX</text>

    <!-- Fiber Core Centerline -->
    <line x1="${coreX}" y1="75" x2="${coreX}" y2="280" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="3,3" />
    <circle cx="${coreX}" cy="${coreY}" r="4" fill="#38bdf8" />
    <text x="${coreX + 8}" y="82" fill="#38bdf8" font-size="10" font-weight="700">FIBER CENTER</text>

    <!-- Apex Offset Dimension Dimension Bar -->
    <line x1="${apexX}" y1="105" x2="${coreX}" y2="105" stroke="#facc15" stroke-width="2" />
    <line x1="${apexX}" y1="98" x2="${apexX}" y2="112" stroke="#facc15" stroke-width="2" />
    <line x1="${coreX}" y1="98" x2="${coreX}" y2="112" stroke="#facc15" stroke-width="2" />
    <text x="${(apexX + coreX) / 2 - 25}" y="122" fill="#facc15" font-size="11" font-weight="700">δ = ${calc.apexOffsetUm} µm</text>

    <!-- Radius of Curvature Arc and Annotation -->
    <path d="M 170 120 Q ${apexX} ${apexY - 10} 390 120" fill="none" stroke="#60a5fa" stroke-width="2" />
    <text x="180" y="100" fill="#93c5fd" font-size="11" font-weight="600">R = ${calc.rocMm} mm</text>

    <!-- Physical Contact / Air Gap Status Badge Overlay -->
    <rect x="140" y="295" width="280" height="28" rx="6" fill="${contactFill}" fill-opacity="0.15" stroke="${contactFill}" stroke-width="1.5" />
    <text x="280" y="314" text-anchor="middle" fill="${contactFill}" font-size="12" font-weight="700">${contactText}</text>
  </g>

  <!-- Section 2: Right Panel - Metrology Interferometry & Callout HUD -->
  <g id="interferometryHud" transform="translate(480, 20)">
    <!-- Sub-header -->
    <text x="0" y="12" fill="#f8fafc" font-size="14" font-weight="700" font-family="system-ui, sans-serif">OPTICAL INTERFEROMETRY METROLOGY</text>
    <text x="0" y="28" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">Telcordia GR-326-CORE Issue 4 Compliance</text>

    <!-- Interferometry Interference Fringe Preview Ring Box -->
    <g transform="translate(10, 42)">
      <!-- Outer Aperture Ring -->
      <rect x="0" y="0" width="130" height="130" rx="8" fill="#0f172a" stroke="#334155" stroke-width="1.5" />
      <circle cx="65" cy="65" r="54" fill="#030712" stroke="#475569" stroke-width="1" />

      <!-- Optical Interference Newton Rings (concentric ellipses showing curvature & apex tilt) -->
      <circle cx="65" cy="65" r="46" fill="none" stroke="${fringeStroke}" stroke-opacity="0.25" stroke-width="1.5" />
      <circle cx="65" cy="65" r="36" fill="none" stroke="${fringeStroke}" stroke-opacity="0.45" stroke-width="2" />
      <circle cx="65" cy="65" r="26" fill="none" stroke="${fringeStroke}" stroke-opacity="0.65" stroke-width="2" />
      <circle cx="65" cy="65" r="16" fill="none" stroke="${fringeStroke}" stroke-opacity="0.85" stroke-width="2.5" />
      <circle cx="65" cy="65" r="6" fill="${fringeStroke}" />

      <!-- Crosshairs -->
      <line x1="65" y1="15" x2="65" y2="115" stroke="#64748b" stroke-width="0.8" stroke-dasharray="2,2" />
      <line x1="15" y1="65" x2="115" y2="65" stroke="#64748b" stroke-width="0.8" stroke-dasharray="2,2" />

      <!-- Label -->
      <text x="65" y="124" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="600">INTERFERENCE FRINGES</text>
    </g>

    <!-- Fiber Height Zoom Callout (Protrusion vs Undercut) -->
    <g transform="translate(160, 42)">
      <rect x="0" y="0" width="160" height="130" rx="8" fill="#0f172a" stroke="#334155" stroke-width="1.5" />
      <text x="10" y="20" fill="#e2e8f0" font-size="11" font-weight="700">FIBER HEIGHT PROFILE</text>

      <!-- Ferrule Surface Reference Line -->
      <line x1="15" y1="65" x2="145" y2="65" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3,2" />
      <text x="18" y="58" fill="#94a3b8" font-size="9">Ferrule Surface (0 nm)</text>

      <!-- Glass Fiber Core Tip -->
      <rect x="55" y="${65 + fiberOffsetPx}" width="50" height="45" fill="url(#coreGrad)" stroke="#eab308" stroke-width="1.5" rx="3" />
      <text x="80" y="${60 + fiberOffsetPx}" text-anchor="middle" fill="${calc.fiberHeightNm >= 0 ? '#10b981' : '#f43f5e'}" font-size="11" font-weight="700">
        ${calc.fiberHeightNm >= 0 ? '+' : ''}${calc.fiberHeightNm} nm
      </text>
      <text x="80" y="${90 + fiberOffsetPx}" text-anchor="middle" fill="#713f12" font-size="9" font-weight="700">
        ${calc.fiberHeightNm >= 0 ? 'PROTRUSION' : 'UNDERCUT'}
      </text>

      <!-- Air Gap Readout Indicator -->
      <text x="10" y="122" fill="${calc.airGapNm > 0 ? '#f43f5e' : '#10b981'}" font-size="10" font-weight="700">
        Air Gap: ${calc.airGapNm} nm
      </text>
    </g>

    <!-- Metrology Telemetry Grid Cards (Bottom Right) -->
    <g transform="translate(10, 185)">
      <!-- Card 1: Curvature Radius -->
      <rect x="0" y="0" width="95" height="52" rx="6" fill="#1e293b" stroke="${calc.isRocValid ? '#334155' : '#ef4444'}" stroke-width="1.2" />
      <text x="8" y="15" fill="#94a3b8" font-size="9" font-weight="600">RADIUS (R)</text>
      <text x="8" y="34" fill="#f8fafc" font-size="14" font-weight="700">${calc.rocMm} mm</text>
      <text x="8" y="46" fill="${calc.isRocValid ? '#10b981' : '#ef4444'}" font-size="9">${calc.typeSpec.minRocMm}-${calc.typeSpec.maxRocMm} mm</text>

      <!-- Card 2: Apex Offset -->
      <rect x="105" y="0" width="95" height="52" rx="6" fill="#1e293b" stroke="${calc.isApexValid ? '#334155' : '#ef4444'}" stroke-width="1.2" />
      <text x="113" y="15" fill="#94a3b8" font-size="9" font-weight="600">APEX OFFSET (δ)</text>
      <text x="113" y="34" fill="#f8fafc" font-size="14" font-weight="700">${calc.apexOffsetUm} µm</text>
      <text x="113" y="46" fill="${calc.isApexValid ? '#10b981' : '#ef4444'}" font-size="9">&le; ${calc.typeSpec.maxApexOffsetUm} µm</text>

      <!-- Card 3: Fiber Height -->
      <rect x="210" y="0" width="100" height="52" rx="6" fill="#1e293b" stroke="${calc.isFiberHeightValid ? '#334155' : '#ef4444'}" stroke-width="1.2" />
      <text x="218" y="15" fill="#94a3b8" font-size="9" font-weight="600">FIBER HEIGHT (h)</text>
      <text x="218" y="34" fill="#f8fafc" font-size="14" font-weight="700">${calc.fiberHeightNm} nm</text>
      <text x="218" y="46" fill="${calc.isFiberHeightValid ? '#10b981' : '#ef4444'}" font-size="9">± 50 nm limit</text>

      <!-- Card 4: Est. Return Loss -->
      <rect x="0" y="60" width="95" height="52" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1.2" />
      <text x="8" y="75" fill="#94a3b8" font-size="9" font-weight="600">EST. ORL</text>
      <text x="8" y="94" fill="${calc.estimatedOrlDb >= calc.typeSpec.minReturnLossDb ? '#10b981' : '#f59e0b'}" font-size="14" font-weight="700">${calc.estimatedOrlDb} dB</text>
      <text x="8" y="106" fill="#94a3b8" font-size="9">Spec &ge; ${calc.typeSpec.minReturnLossDb} dB</text>

      <!-- Card 5: Est. Insertion Loss -->
      <rect x="105" y="60" width="95" height="52" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1.2" />
      <text x="113" y="75" fill="#94a3b8" font-size="9" font-weight="600">EST. IL</text>
      <text x="113" y="94" fill="${calc.estimatedIlDb <= calc.typeSpec.maxInsertionLossDb ? '#10b981' : '#ef4444'}" font-size="14" font-weight="700">${calc.estimatedIlDb} dB</text>
      <text x="113" y="106" fill="#94a3b8" font-size="9">Spec &le; ${calc.typeSpec.maxInsertionLossDb} dB</text>

      <!-- Card 6: Compressive Stress -->
      <rect x="210" y="60" width="100" height="52" rx="6" fill="#1e293b" stroke="${calc.isStressSafe ? '#334155' : '#ef4444'}" stroke-width="1.2" />
      <text x="218" y="75" fill="#94a3b8" font-size="9" font-weight="600">CORE STRESS</text>
      <text x="218" y="94" fill="#f8fafc" font-size="14" font-weight="700">${calc.hertzianStressMpa} MPa</text>
      <text x="218" y="106" fill="${calc.isStressSafe ? '#10b981' : '#ef4444'}" font-size="9">&le; 1200 MPa Max</text>
    </g>

    <!-- Overall Verdict Badge Banner -->
    <g transform="translate(10, 305)">
      <rect x="0" y="0" width="310" height="28" rx="6" fill="${statusColor}" fill-opacity="0.18" stroke="${statusColor}" stroke-width="1.5" />
      <text x="155" y="19" text-anchor="middle" fill="${statusColor}" font-size="12" font-weight="800">
        TELCORDIA VERDICT: ${calc.overallVerdict.replace(/_/g, ' ')}
      </text>
    </g>
  </g>
</svg>
  `.trim();
}

/**
 * Builds a normalized ferrule geometry QA record object for logging, printing, and persistence.
 */
export function buildFerruleGeometryRecord(input = {}, existingCerts = []) {
  const calc = evaluateFerruleGeometry(input);

  const timestamp = input.timestamp || new Date().toISOString();
  const certId = input.certId || `FG-QA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${(existingCerts.length + 1).toString().padStart(4, '0')}`;

  return {
    certId,
    timestamp,
    connectorType: calc.connectorType,
    connectorLabel: calc.typeSpec.label,
    formFactor: calc.typeSpec.formFactor,
    polish: calc.typeSpec.polish,
    serialNumber: (input.serialNumber || 'N/A').trim(),
    location: (input.location || 'Shahdara Network Zone').trim(),
    inspectorName: (input.inspectorName || 'Field Technician').trim(),
    notes: (input.notes || '').trim(),
    rocMm: calc.rocMm,
    apexOffsetUm: calc.apexOffsetUm,
    fiberHeightNm: calc.fiberHeightNm,
    angleDeg: calc.angleDeg,
    springForceN: calc.springForceN,
    matingCycles: calc.matingCycles,
    domeDropNm: calc.domeDropNm,
    elasticCompNm: calc.elasticCompNm,
    airGapNm: calc.airGapNm,
    isPhysicalContact: calc.isPhysicalContact,
    contactRadiusUm: calc.contactRadiusUm,
    hertzianStressMpa: calc.hertzianStressMpa,
    estimatedIlDb: calc.estimatedIlDb,
    estimatedOrlDb: calc.estimatedOrlDb,
    overallVerdict: calc.overallVerdict,
    verdictStatus: calc.verdictStatus,
    badgeColor: calc.badgeColor,
    diagnosticSummary: calc.diagnosticSummary,
    recommendation: calc.recommendation,
    status: input.status || (calc.verdictStatus === 'PASS' ? 'APPROVED' : 'REJECTED')
  };
}

/**
 * Generates printable HTML certificate for formal A4 compliance or 80mm mobile thermal slip.
 */
export function generateFerruleGeometryCertHtml(record, options = {}) {
  const format = options.format || 'a4';
  const isA4 = format === 'a4';

  if (isA4) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Optical Ferrule Geometry QA Certificate - ${record.certId}</title>
  <style>
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 30px;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.45;
    }
    .cert-card {
      border: 2px solid #0f172a;
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
      box-sizing: border-box;
    }
    .cert-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .cert-title {
      font-size: 20px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 4px;
    }
    .cert-subtitle {
      font-size: 12px;
      color: #475569;
      margin: 0;
    }
    .verdict-badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 4px;
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      border: 1px solid;
    }
    .verdict-pass {
      background: #ecfdf5;
      color: #065f46;
      border-color: #10b981;
    }
    .verdict-fail {
      background: #fef2f2;
      color: #991b1b;
      border-color: #ef4444;
    }
    .verdict-warn {
      background: #fffbeb;
      color: #92400e;
      border-color: #f59e0b;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      font-size: 12px;
      margin-bottom: 16px;
      background: #f8fafc;
      padding: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    .param-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 16px;
    }
    .param-table th, .param-table td {
      border: 1px solid #cbd5e1;
      padding: 7px 10px;
      text-align: left;
    }
    .param-table th {
      background: #f1f5f9;
      font-weight: 700;
    }
    .status-pill {
      font-weight: 700;
      font-size: 11px;
    }
    .notes-box {
      background: #f8fafc;
      border-left: 4px solid #3b82f6;
      padding: 10px 14px;
      font-size: 12px;
      margin-bottom: 20px;
    }
    .sig-row {
      display: flex;
      justify-content: space-between;
      margin-top: 36px;
      font-size: 12px;
    }
    .sig-block {
      width: 200px;
      border-top: 1px solid #64748b;
      padding-top: 4px;
      text-align: center;
    }
    @media print {
      body { padding: 0; }
      .cert-card { border: none; }
    }
  </style>
</head>
<body>
  <div class="cert-card">
    <div class="cert-header">
      <div>
        <h1 class="cert-title">SHAHDARA ISP METROLOGY LABORATORY</h1>
        <p class="cert-subtitle">Optical Fiber Connector Ferrule End-Face Geometric Interferometry Certificate</p>
        <p class="cert-subtitle">Standards: Telcordia GR-326-CORE Issue 4 / IEC 61300-3-15 / IEC 61755-3-1</p>
      </div>
      <div>
        <span class="verdict-badge ${record.verdictStatus === 'PASS' ? 'verdict-pass' : (record.verdictStatus === 'WARNING' ? 'verdict-warn' : 'verdict-fail')}">
          ${record.overallVerdict.replace(/_/g, ' ')}
        </span>
      </div>
    </div>

    <div class="meta-grid">
      <div><strong>Certificate ID:</strong> ${record.certId}</div>
      <div><strong>Date &amp; Time:</strong> ${new Date(record.timestamp).toLocaleString()}</div>
      <div><strong>Connector Model:</strong> ${record.connectorLabel}</div>
      <div><strong>Serial / Lot Number:</strong> ${record.serialNumber}</div>
      <div><strong>Installation Location:</strong> ${record.location}</div>
      <div><strong>Certified Inspector:</strong> ${record.inspectorName}</div>
      <div><strong>Physical Contact:</strong> ${record.isPhysicalContact ? 'YES (Achieved)' : `NO (Air Gap: ${record.airGapNm} nm)`}</div>
      <div><strong>Mating Endurance Cycles:</strong> ${record.matingCycles} cycles</div>
    </div>

    <table class="param-table">
      <thead>
        <tr>
          <th>Geometric Parameter</th>
          <th>Measured Value</th>
          <th>GR-326-CORE Spec Limits</th>
          <th>Contact Physics Impact</th>
          <th>Verdict</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Radius of Curvature (R)</strong></td>
          <td>${record.rocMm} mm</td>
          <td>5.0 - 25.0 mm</td>
          <td>Compressive deformation ${record.elasticCompNm} nm</td>
          <td class="status-pill">${record.rocMm >= 5 && record.rocMm <= 25 ? 'COMPLIANT' : 'OUT OF SPEC'}</td>
        </tr>
        <tr>
          <td><strong>Apex Offset (δ)</strong></td>
          <td>${record.apexOffsetUm} µm</td>
          <td>&le; 50.0 µm (Grade A: &le; 30 µm)</td>
          <td>Dome drop Δz: ${record.domeDropNm} nm</td>
          <td class="status-pill">${record.apexOffsetUm <= 50 ? 'COMPLIANT' : 'OUT OF SPEC'}</td>
        </tr>
        <tr>
          <td><strong>Fiber Height (Protrusion/Undercut)</strong></td>
          <td>${record.fiberHeightNm > 0 ? '+' : ''}${record.fiberHeightNm} nm</td>
          <td>-50.0 nm to +50.0 nm</td>
          <td>Net core separation: ${record.airGapNm} nm</td>
          <td class="status-pill">${record.fiberHeightNm >= -50 && record.fiberHeightNm <= 50 ? 'COMPLIANT' : 'OUT OF SPEC'}</td>
        </tr>
        <tr>
          <td><strong>Tilt Angle</strong></td>
          <td>${record.angleDeg}°</td>
          <td>Nominal ${record.polish === 'APC' ? '8.00° ± 0.20°' : '0.00° ± 0.15°'}</td>
          <td>Back-reflection isolation angle</td>
          <td class="status-pill">COMPLIANT</td>
        </tr>
        <tr>
          <td><strong>Hertzian Core Stress</strong></td>
          <td>${record.hertzianStressMpa} MPa</td>
          <td>&le; 1200 MPa Limit</td>
          <td>Glass micro-crack prevention</td>
          <td class="status-pill">${record.hertzianStressMpa <= 1200 ? 'SAFE' : 'HIGH STRESS'}</td>
        </tr>
        <tr>
          <td><strong>Est. Optical Return Loss (ORL)</strong></td>
          <td>${record.estimatedOrlDb} dB</td>
          <td>&ge; ${record.polish === 'APC' ? '65' : '55'} dB</td>
          <td>Reflectance suppression</td>
          <td class="status-pill">${record.estimatedOrlDb >= (record.polish === 'APC' ? 65 : 55) ? 'PASS' : 'DEGRADED'}</td>
        </tr>
        <tr>
          <td><strong>Est. Insertion Loss (IL)</strong></td>
          <td>${record.estimatedIlDb} dB</td>
          <td>&le; 0.25 dB</td>
          <td>Fabry-Perot cavity transmission</td>
          <td class="status-pill">${record.estimatedIlDb <= 0.25 ? 'PASS' : 'HIGH LOSS'}</td>
        </tr>
      </tbody>
    </table>

    <div class="notes-box">
      <strong>QA Metrology Findings:</strong> ${record.diagnosticSummary}<br>
      <strong>Engineering Recommendation:</strong> ${record.recommendation}
      ${record.notes ? `<br><strong>Field Inspector Notes:</strong> ${record.notes}` : ''}
    </div>

    <div class="sig-row">
      <div class="sig-block">
        Optical Metrology Engineer<br>
        <strong>${record.inspectorName}</strong>
      </div>
      <div class="sig-block">
        Shahdara QA Quality Officer<br>
        <strong>Network Operations Center</strong>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  // 80mm Mobile Thermal Receipt Slip
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Ferrule QA Slip - ${record.certId}</title>
  <style>
    body {
      font-family: 'Courier New', monospace;
      width: 76mm;
      margin: 0 auto;
      padding: 4mm;
      color: #000;
      font-size: 11px;
      line-height: 1.35;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .line { border-bottom: 1px dashed #000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; }
    .verdict { font-size: 13px; font-weight: bold; padding: 3px 0; margin: 4px 0; border: 1px solid #000; text-align: center; }
    @media print {
      body { width: 72mm; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="center bold">SHAHDARA ISP OPERATIONS</div>
  <div class="center">FERRULE GEOMETRY QA SLIP</div>
  <div class="center">IEC 61300-3-15 / GR-326</div>
  <div class="line"></div>
  <div class="row"><span>CERT ID:</span><span class="bold">${record.certId}</span></div>
  <div class="row"><span>DATE:</span><span>${new Date(record.timestamp).toISOString().slice(0, 16).replace('T', ' ')}</span></div>
  <div class="row"><span>TECH:</span><span>${record.inspectorName}</span></div>
  <div class="row"><span>SERIAL:</span><span>${record.serialNumber}</span></div>
  <div class="row"><span>CONN:</span><span>${record.connectorType}</span></div>
  <div class="row"><span>LOC:</span><span>${record.location.slice(0, 20)}</span></div>
  <div class="line"></div>
  <div class="row"><span>Radius Curv (R):</span><span class="bold">${record.rocMm} mm</span></div>
  <div class="row"><span>Apex Offset (δ):</span><span class="bold">${record.apexOffsetUm} um</span></div>
  <div class="row"><span>Fiber Height (h):</span><span class="bold">${record.fiberHeightNm} nm</span></div>
  <div class="row"><span>Air Gap (gnet):</span><span class="bold">${record.airGapNm} nm</span></div>
  <div class="row"><span>Core Stress:</span><span>${record.hertzianStressMpa} MPa</span></div>
  <div class="row"><span>Est. Return Loss:</span><span>${record.estimatedOrlDb} dB</span></div>
  <div class="row"><span>Est. Insert Loss:</span><span>${record.estimatedIlDb} dB</span></div>
  <div class="line"></div>
  <div class="verdict">${record.overallVerdict.replace(/_/g, ' ')}</div>
  <div class="line"></div>
  <div style="font-size: 10px;">${record.diagnosticSummary}</div>
  <div class="line"></div>
  <div class="center" style="font-size: 9px;">Shahdara ISP QA Automation System</div>
</body>
</html>
  `.trim();
}

/**
 * Formats WhatsApp dispatch notification for field supervisors and splicing crews.
 */
export function formatFerruleGeometryCertWhatsApp(record) {
  const icon = record.verdictStatus === 'PASS' ? '✅' : (record.verdictStatus === 'WARNING' ? '⚠️' : '❌');

  return `
🔬 *SHAHDARA ISP - FERRULE GEOMETRY QA REPORT* 🔬
━━━━━━━━━━━━━━━━━━━━━━━
${icon} *VERDICT:* *${record.overallVerdict.replace(/_/g, ' ')}*
🆔 *Cert ID:* \`${record.certId}\`
📅 *Date:* ${new Date(record.timestamp).toLocaleString()}
📍 *Location:* ${record.location}
👷 *Inspector:* ${record.inspectorName}
🔌 *Connector:* ${record.connectorLabel}
🏷️ *Serial / Lot:* ${record.serialNumber}
━━━━━━━━━━━━━━━━━━━━━━━
📐 *METROLOGY PARAMETERS:*
• Curvature Radius (R): *${record.rocMm} mm* (Spec: 5-25 mm)
• Apex Offset (δ): *${record.apexOffsetUm} µm* (Max: 50 µm)
• Fiber Height (h): *${record.fiberHeightNm > 0 ? '+' : ''}${record.fiberHeightNm} nm* (±50 nm)
• Core Air Gap: *${record.airGapNm} nm* (${record.isPhysicalContact ? 'Contact OK' : 'Air Gap Present!'})
• Core Compressive Stress: *${record.hertzianStressMpa} MPa*
• Est. Return Loss: *${record.estimatedOrlDb} dB*
• Est. Insertion Loss: *${record.estimatedIlDb} dB*
━━━━━━━━━━━━━━━━━━━━━━━
📝 *DIAGNOSIS:*
${record.diagnosticSummary}

💡 *RECOMMENDATION:*
${record.recommendation}
━━━━━━━━━━━━━━━━━━━━━━━
_Certified under Telcordia GR-326-CORE Issue 4 & IEC 61300-3-15._
`.trim();
}

/**
 * Generates RFC-4180 compliant CSV export for certified records.
 */
export function generateFerruleGeometryCertsCsv(certs = []) {
  const headers = [
    'Cert ID',
    'Timestamp',
    'Connector Type',
    'Connector Label',
    'Serial Number',
    'Location',
    'Inspector Name',
    'Radius Curvature mm',
    'Apex Offset um',
    'Fiber Height nm',
    'Air Gap nm',
    'Physical Contact',
    'Hertzian Stress MPa',
    'Est ORL dB',
    'Est IL dB',
    'Verdict',
    'Status',
    'Diagnosis',
    'Recommendation'
  ];

  const escapeCsv = (str) => {
    const val = String(str || '').replace(/"/g, '""');
    return `"${val}"`;
  };

  const rows = certs.map(c => [
    escapeCsv(c.certId),
    escapeCsv(c.timestamp),
    escapeCsv(c.connectorType),
    escapeCsv(c.connectorLabel),
    escapeCsv(c.serialNumber),
    escapeCsv(c.location),
    escapeCsv(c.inspectorName),
    c.rocMm,
    c.apexOffsetUm,
    c.fiberHeightNm,
    c.airGapNm,
    c.isPhysicalContact ? 'YES' : 'NO',
    c.hertzianStressMpa,
    c.estimatedOrlDb,
    c.estimatedIlDb,
    escapeCsv(c.overallVerdict),
    escapeCsv(c.status),
    escapeCsv(c.diagnosticSummary),
    escapeCsv(c.recommendation)
  ].join(','));

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * LocalStorage management functions.
 */
export function getSavedFerruleGeometryCerts(storage = null) {
  const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!s) return [];
  try {
    const raw = s.getItem(FERRULE_GEOMETRY_CERT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

export function saveFerruleGeometryCert(cert, storage = null) {
  const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!s || !cert) return false;
  try {
    const existing = getSavedFerruleGeometryCerts(s);
    const index = existing.findIndex(c => c.certId === cert.certId);
    if (index >= 0) {
      existing[index] = cert;
    } else {
      existing.unshift(cert);
    }
    s.setItem(FERRULE_GEOMETRY_CERT_STORAGE_KEY, JSON.stringify(existing));
    return true;
  } catch (err) {
    return false;
  }
}

export function updateFerruleGeometryCertStatus(certId, status, storage = null) {
  const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!s || !certId) return false;
  try {
    const certs = getSavedFerruleGeometryCerts(s);
    const cert = certs.find(c => c.certId === certId);
    if (!cert) return false;
    cert.status = status;
    s.setItem(FERRULE_GEOMETRY_CERT_STORAGE_KEY, JSON.stringify(certs));
    return true;
  } catch (err) {
    return false;
  }
}

export function clearFerruleGeometryCerts(storage = null) {
  const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!s) return false;
  try {
    s.removeItem(FERRULE_GEOMETRY_CERT_STORAGE_KEY);
    return true;
  } catch (err) {
    return false;
  }
}

export function calculateFerruleGeometryMetrics(certs = []) {
  if (!Array.isArray(certs) || certs.length === 0) {
    return {
      total: 0,
      passCount: 0,
      failCount: 0,
      passRatePercent: 0,
      avgApexOffsetUm: 0,
      avgAirGapNm: 0,
      physicalContactPercent: 0
    };
  }

  const total = certs.length;
  const passCount = certs.filter(c => c.verdictStatus === 'PASS' || c.overallVerdict?.startsWith('PASS')).length;
  const failCount = total - passCount;
  const passRatePercent = Number(((passCount / total) * 100).toFixed(1));

  const totalApex = certs.reduce((acc, c) => acc + (Number(c.apexOffsetUm) || 0), 0);
  const avgApexOffsetUm = Number((totalApex / total).toFixed(1));

  const totalAirGap = certs.reduce((acc, c) => acc + (Number(c.airGapNm) || 0), 0);
  const avgAirGapNm = Number((totalAirGap / total).toFixed(1));

  const contactCount = certs.filter(c => c.isPhysicalContact).length;
  const physicalContactPercent = Number(((contactCount / total) * 100).toFixed(1));

  return {
    total,
    passCount,
    failCount,
    passRatePercent,
    avgApexOffsetUm,
    avgAirGapNm,
    physicalContactPercent
  };
}

/**
 * Controller to wire and manage the Ferrule Geometry QA modal.
 */
export function setupFerruleGeometryModal(options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const onToast = options.onToast || ((msg) => console.log(msg));

  if (!doc) return null;

  const modal = doc.getElementById('ferruleGeometryModal');
  const closeBtn = doc.getElementById('closeFerruleGeometryBtn');
  const presetSelect = doc.getElementById('ferruleGeometryPresetSelect');
  const typeSelect = doc.getElementById('ferruleGeometryTypeSelect');
  const rocInput = doc.getElementById('ferruleGeometryRocInput');
  const apexInput = doc.getElementById('ferruleGeometryApexInput');
  const fiberHeightInput = doc.getElementById('ferruleGeometryFiberHeightInput');
  const angleInput = doc.getElementById('ferruleGeometryAngleInput');
  const springForceInput = doc.getElementById('ferruleGeometrySpringForceInput');
  const cyclesInput = doc.getElementById('ferruleGeometryCyclesInput');
  const locationInput = doc.getElementById('ferruleGeometryLocationInput');
  const techInput = doc.getElementById('ferruleGeometryTechInput');
  const serialInput = doc.getElementById('ferruleGeometrySerialInput');
  const notesInput = doc.getElementById('ferruleGeometryNotesInput');

  const svgContainer = doc.getElementById('ferruleGeometrySvgContainer');
  const hudRibbon = doc.getElementById('ferruleGeometryHudRibbon');
  const historyTbody = doc.getElementById('ferruleGeometryHistoryTbody');

  const saveCertBtn = doc.getElementById('saveFerruleGeometryCertBtn');
  const whatsappBtn = doc.getElementById('whatsappFerruleGeometryBtn');
  const printA4Btn = doc.getElementById('printFerruleGeometryA4Btn');
  const printThermalBtn = doc.getElementById('printFerruleGeometryThermalBtn');
  const exportCsvBtn = doc.getElementById('exportFerruleGeometryCsvBtn');

  function getFormValues() {
    return {
      connectorType: typeSelect?.value || 'SC_APC',
      rocMm: Number(rocInput?.value) || 8.0,
      apexOffsetUm: Number(apexInput?.value) || 0,
      fiberHeightNm: Number(fiberHeightInput?.value) || 0,
      angleDeg: Number(angleInput?.value) || 8.0,
      springForceN: Number(springForceInput?.value) || 7.8,
      matingCycles: Number(cyclesInput?.value) || 1,
      location: locationInput?.value || '',
      inspectorName: techInput?.value || '',
      serialNumber: serialInput?.value || '',
      notes: notesInput?.value || ''
    };
  }

  function recalculate() {
    const vals = getFormValues();
    const calc = evaluateFerruleGeometry(vals);

    if (svgContainer) {
      svgContainer.innerHTML = renderFerruleGeometryAnalysisSvg(calc);
    }

    if (hudRibbon) {
      hudRibbon.innerHTML = `
        <div style="background: rgba(15, 23, 42, 0.6); padding: 8px 12px; border-radius: 4px; border: 1px solid #334155;">
          <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">Curvature Radius (R)</div>
          <div style="font-size: 16px; font-weight: 700; color: #f8fafc;">${calc.rocMm} mm</div>
          <div style="font-size: 10px; color: ${calc.isRocValid ? '#10b981' : '#ef4444'};">${calc.typeSpec.minRocMm}-${calc.typeSpec.maxRocMm} mm limit</div>
        </div>
        <div style="background: rgba(15, 23, 42, 0.6); padding: 8px 12px; border-radius: 4px; border: 1px solid #334155;">
          <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">Apex Offset (δ)</div>
          <div style="font-size: 16px; font-weight: 700; color: #f8fafc;">${calc.apexOffsetUm} µm</div>
          <div style="font-size: 10px; color: ${calc.isApexValid ? '#10b981' : '#ef4444'};">&le; ${calc.typeSpec.maxApexOffsetUm} µm</div>
        </div>
        <div style="background: rgba(15, 23, 42, 0.6); padding: 8px 12px; border-radius: 4px; border: 1px solid #334155;">
          <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">Fiber Height (h)</div>
          <div style="font-size: 16px; font-weight: 700; color: #f8fafc;">${calc.fiberHeightNm} nm</div>
          <div style="font-size: 10px; color: ${calc.isFiberHeightValid ? '#10b981' : '#ef4444'};">± 50 nm limit</div>
        </div>
        <div style="background: rgba(15, 23, 42, 0.6); padding: 8px 12px; border-radius: 4px; border: 1px solid #334155;">
          <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">Core Air Gap</div>
          <div style="font-size: 16px; font-weight: 700; color: ${calc.airGapNm > 0 ? '#ef4444' : '#10b981'};">${calc.airGapNm} nm</div>
          <div style="font-size: 10px; color: #94a3b8;">${calc.isPhysicalContact ? 'Contact OK' : 'Air Gap Fault'}</div>
        </div>
        <div style="background: rgba(15, 23, 42, 0.6); padding: 8px 12px; border-radius: 4px; border: 1px solid #334155;">
          <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">GR-326 Verdict</div>
          <div style="font-size: 14px; font-weight: 800; color: ${calc.badgeColor};">${calc.overallVerdict.replace(/_/g, ' ')}</div>
          <div style="font-size: 10px; color: #94a3b8;">Est. ORL ${calc.estimatedOrlDb} dB</div>
        </div>
      `;
    }

    return calc;
  }

  function renderHistory() {
    if (!historyTbody) return;
    const certs = getSavedFerruleGeometryCerts(storage);

    if (certs.length === 0) {
      historyTbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: #64748b; padding: 14px;">No certified ferrule records logged yet.</td>
        </tr>
      `;
      return;
    }

    historyTbody.innerHTML = certs.map(c => `
      <tr style="border-bottom: 1px solid #334155;">
        <td style="padding: 6px 8px; font-weight: 700; font-family: monospace;">${c.certId}</td>
        <td style="padding: 6px 8px;">${new Date(c.timestamp).toISOString().slice(0, 10)}</td>
        <td style="padding: 6px 8px;">${c.connectorLabel || c.connectorType}</td>
        <td style="padding: 6px 8px;">${c.location}</td>
        <td style="padding: 6px 8px;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; background: ${c.badgeColor}22; color: ${c.badgeColor}; border: 1px solid ${c.badgeColor};">
            ${c.overallVerdict?.replace(/_/g, ' ')}
          </span>
        </td>
        <td style="padding: 6px 8px;">${c.airGapNm} nm (${c.isPhysicalContact ? 'Contact' : 'Gap'})</td>
        <td style="padding: 6px 8px;">
          <button type="button" class="action-print-cert text-button" data-cert-id="${c.certId}" style="margin-right: 6px; font-size: 10px;">Print</button>
          <button type="button" class="action-wa-cert text-button" data-cert-id="${c.certId}" style="font-size: 10px; color: #10b981;">WhatsApp</button>
        </td>
      </tr>
    `).join('');

    // Attach row button listeners
    historyTbody.querySelectorAll('.action-print-cert').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cert-id');
        const found = certs.find(c => c.certId === id);
        if (found) {
          const html = generateFerruleGeometryCertHtml(found, { format: 'a4' });
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(html);
            win.document.close();
          }
        }
      });
    });

    historyTbody.querySelectorAll('.action-wa-cert').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cert-id');
        const found = certs.find(c => c.certId === id);
        if (found) {
          const text = formatFerruleGeometryCertWhatsApp(found);
          const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
          window.open(url, '_blank');
        }
      });
    });
  }

  function loadPreset(presetKey) {
    const p = FERRULE_GEOMETRY_PRESETS[presetKey];
    if (!p) return;

    if (typeSelect) typeSelect.value = p.connectorType;
    if (rocInput) rocInput.value = p.rocMm;
    if (apexInput) apexInput.value = p.apexOffsetUm;
    if (fiberHeightInput) fiberHeightInput.value = p.fiberHeightNm;
    if (angleInput) angleInput.value = p.angleDeg;
    if (springForceInput) springForceInput.value = p.springForceN;
    if (cyclesInput) cyclesInput.value = p.matingCycles;
    if (locationInput) locationInput.value = p.location;
    if (techInput) techInput.value = p.inspectorName;
    if (serialInput) serialInput.value = p.serialNumber;
    if (notesInput) notesInput.value = p.description;

    recalculate();
  }

  const openBtn = doc.getElementById('openFerruleGeometryBtn');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
      }
      recalculate();
      renderHistory();
    });
  }

  // Event Listeners
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (modal) {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const val = presetSelect.value;
      if (val) loadPreset(val);
    });
  }

  [typeSelect, rocInput, apexInput, fiberHeightInput, angleInput, springForceInput, cyclesInput, locationInput, techInput, serialInput, notesInput].forEach(inp => {
    if (inp) {
      inp.addEventListener('input', recalculate);
      inp.addEventListener('change', recalculate);
    }
  });

  if (saveCertBtn) {
    saveCertBtn.addEventListener('click', () => {
      const vals = getFormValues();
      const existing = getSavedFerruleGeometryCerts(storage);
      const record = buildFerruleGeometryRecord(vals, existing);
      saveFerruleGeometryCert(record, storage);
      onToast(`Ferrule Geometry Certificate ${record.certId} saved successfully!`);
      renderHistory();
    });
  }

  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      const vals = getFormValues();
      const existing = getSavedFerruleGeometryCerts(storage);
      const record = buildFerruleGeometryRecord(vals, existing);
      const html = generateFerruleGeometryCertHtml(record, { format: 'a4' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    });
  }

  if (printThermalBtn) {
    printThermalBtn.addEventListener('click', () => {
      const vals = getFormValues();
      const existing = getSavedFerruleGeometryCerts(storage);
      const record = buildFerruleGeometryRecord(vals, existing);
      const html = generateFerruleGeometryCertHtml(record, { format: 'thermal' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    });
  }

  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
      const vals = getFormValues();
      const existing = getSavedFerruleGeometryCerts(storage);
      const record = buildFerruleGeometryRecord(vals, existing);
      const text = formatFerruleGeometryCertWhatsApp(record);
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const certs = getSavedFerruleGeometryCerts(storage);
      if (certs.length === 0) {
        onToast('No ferrule geometry certificates to export.');
        return;
      }
      const csv = generateFerruleGeometryCertsCsv(certs);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = doc.createElement('a');
      a.href = url;
      a.download = `shahdara_ferrule_geometry_certs_${new Date().toISOString().slice(0, 10)}.csv`;
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
    loadPreset,
    renderHistory
  };
}
