/**
 * Shahdara ISP Billing & Network Operations - Outside Plant Direct-Buried Armored Fiber Cable
 * Compressive Crush Load, Shovel/Tup Impact Energy & Rodent Puncture QA Certification Suite
 * Standards: IEC 60794-1-21 Method E3/E4, Telcordia GR-20-CORE Issue 4, ITU-T L.400 / L.12, WASA / NESPAK Regulations
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const ARMORED_CABLE_CRUSH_STORAGE_KEY = 'shahdara_armored_cable_crush_certs_v1';

export const ARMOR_TYPES = {
  'CST_SINGLE_STEEL': {
    id: 'CST_SINGLE_STEEL',
    name: 'Corrugated Steel Tape Armor (CST 0.15mm Copolymer-Coated)',
    category: 'Metallic Corrugated Tape',
    ratedCrushLoadNPer100mm: 3000.0,
    ratedImpactEnergyJoules: 10.0,
    radialStiffnessFactor: 1.0,
    rodentResistanceRating: 'HIGH',
    punctureResistanceRating: 'HIGH',
    colorCode: '#0ea5e9',
    description: 'Longitudinally applied corrugated electrolytic chrome-coated steel tape providing robust lateral crush and rodent defense.'
  },
  'SWA_DOUBLE_WIRE': {
    id: 'SWA_DOUBLE_WIRE',
    name: 'Steel Wire Armor (SWA 0.9mm Heavy Helical Wires)',
    category: 'Heavy Metallic Wire Armor',
    ratedCrushLoadNPer100mm: 5500.0,
    ratedImpactEnergyJoules: 25.0,
    radialStiffnessFactor: 1.85,
    rodentResistanceRating: 'EXTREME',
    punctureResistanceRating: 'MAXIMUM',
    colorCode: '#6366f1',
    description: 'High-tensile galvanized steel helical wire cage designed for railway track ballast and heavy vehicular highway undercrossings.'
  },
  'DSTA_DOUBLE_TAPE': {
    id: 'DSTA_DOUBLE_TAPE',
    name: 'Double Steel Tape Armor (DSTA 2x0.20mm Helical Tapes)',
    category: 'Double Metallic Tape',
    ratedCrushLoadNPer100mm: 4200.0,
    ratedImpactEnergyJoules: 15.0,
    radialStiffnessFactor: 1.4,
    rodentResistanceRating: 'MAXIMUM',
    punctureResistanceRating: 'VERY_HIGH',
    colorCode: '#10b981',
    description: 'Dual overlapping steel tape layers engineered for deep trenching in rocky soils and canal embankment zones with active rodent burrows.'
  },
  'DIELECTRIC_GLASS_YARN': {
    id: 'DIELECTRIC_GLASS_YARN',
    name: 'Dielectric Water-Swellable Glass Yarn (E-Glass Armor)',
    category: 'Non-Metallic Rodent Resistant',
    ratedCrushLoadNPer100mm: 1800.0,
    ratedImpactEnergyJoules: 5.0,
    radialStiffnessFactor: 0.65,
    rodentResistanceRating: 'MODERATE',
    punctureResistanceRating: 'MODERATE',
    colorCode: '#f59e0b',
    description: 'Non-metallic fiberglass yarn barrier for electrical substation trenches where metallic armor is prohibited due to high induced voltage.'
  },
  'UNARMORED_DUCT_CABLE': {
    id: 'UNARMORED_DUCT_CABLE',
    name: 'Unarmored Non-Metallic Micro-Duct Cable (Direct-Buried Risk)',
    category: 'Unarmored Duct Profile',
    ratedCrushLoadNPer100mm: 800.0,
    ratedImpactEnergyJoules: 2.0,
    radialStiffnessFactor: 0.3,
    rodentResistanceRating: 'VULNERABLE',
    punctureResistanceRating: 'POOR',
    colorCode: '#ef4444',
    description: 'Intended strictly for HDPE conduit sub-ducts; direct burying in soil presents critical risks of vehicle crush collapse and rodent severance.'
  }
};

export const BURIAL_ENVIRONMENTS = {
  'DIRECT_BURIED_HEAVY_TRAFFIC': {
    id: 'DIRECT_BURIED_HEAVY_TRAFFIC',
    name: 'Primary Arterial Road Shoulder (Freight Truck Traffic)',
    minBurialDepthM: 1.2,
    targetCrushLoadNPer100mm: 3000.0,
    trenchWarningTapeRequired: true,
    concreteSlabRequired: true,
    description: 'Under G.T. Road or heavy commercial corridors subject to continuous 20-ton freight axles and road maintenance grading.'
  },
  'URBAN_PAVEMENT_TRENCH': {
    id: 'URBAN_PAVEMENT_TRENCH',
    name: 'Urban Commercial Street / Dense Mohalla Alley',
    minBurialDepthM: 0.9,
    targetCrushLoadNPer100mm: 2000.0,
    trenchWarningTapeRequired: true,
    concreteSlabRequired: false,
    description: 'Under municipal brick pavement or asphalt with pedestrian, car, and light delivery vehicle traffic.'
  },
  'AGRICULTURAL_CANAL_CROSSING': {
    id: 'AGRICULTURAL_CANAL_CROSSING',
    name: 'Ravi Siphon / Irrigation Embankment Soft Soil',
    minBurialDepthM: 1.0,
    targetCrushLoadNPer100mm: 2500.0,
    trenchWarningTapeRequired: true,
    concreteSlabRequired: false,
    description: 'Soft alluvial soil near water channels prone to seasonal soil shifting, water saturation, and high burrowing rodent activity.'
  },
  'RAILWAY_TRACK_BALLAST': {
    id: 'RAILWAY_TRACK_BALLAST',
    name: 'Pakistan Railways Track Undercrossing (Ballast Bed)',
    minBurialDepthM: 1.5,
    targetCrushLoadNPer100mm: 4500.0,
    trenchWarningTapeRequired: true,
    concreteSlabRequired: true,
    description: 'Under railway tracks subjected to intense cyclic shock vibration, dynamic train axle loads, and ballast stones.'
  },
  'CONDUIT_DUCT_PROTECTED': {
    id: 'CONDUIT_DUCT_PROTECTED',
    name: 'Schedule 40 PVC / HDPE Heavy Duct Enclosure',
    minBurialDepthM: 0.8,
    targetCrushLoadNPer100mm: 1000.0,
    trenchWarningTapeRequired: true,
    concreteSlabRequired: false,
    description: 'Cable pulled inside thick-walled underground conduit providing primary structural load dispersion.'
  }
};

export const ARMORED_CABLE_VERDICTS = {
  'CERTIFIED_OPTIMAL': {
    id: 'CERTIFIED_OPTIMAL',
    name: 'Certified Optimal Underground Armor (Pass)',
    badgeClass: 'badge-success',
    color: '#16a34a',
    description: 'Crush load is within rating, induced micro-bending loss ≤ 0.05 dB, and impact energy safely absorbed without armor breach.'
  },
  'CONDITIONAL_PASS': {
    id: 'CONDITIONAL_PASS',
    name: 'Conditional Pass (Warning Slab / Protective Sleeve Advised)',
    badgeClass: 'badge-warning',
    color: '#f59e0b',
    description: 'Cable withstands crush, but marginal depth or impact headroom warrants a concrete protective slab or warning tile.'
  },
  'FAILED_CRUSH_OVERLOAD': {
    id: 'FAILED_CRUSH_OVERLOAD',
    name: 'Critical Reject: Excessive Compressive Crush Load (Fail)',
    badgeClass: 'badge-danger',
    color: '#dc2626',
    description: 'Applied compressive load exceeds armoring rating; permanent buffer tube flattening and excessive micro-bending loss (>0.10 dB).'
  },
  'FAILED_IMPACT_PUNCTURE': {
    id: 'FAILED_IMPACT_PUNCTURE',
    name: 'Critical Hazard: Tup / Shovel Impact Breach Risk (Fail)',
    badgeClass: 'badge-danger',
    color: '#991b1b',
    description: 'Trenching pickaxe or heavy surface impact energy exceeds armoring penetration rating, creating acute risk of severed fibers.'
  }
};

export const SHAH_ARMORED_PRESETS = {
  'PRESET_GT_ROAD_HEAVY_TRUCK': {
    id: 'PRESET_GT_ROAD_HEAVY_TRUCK',
    name: 'G.T. Road Shahdara Chowk Main Feeder (CST Armored, Heavy Traffic)',
    customer: 'Shahdara Central Trunk Feeder Ring-A',
    route: 'G.T. Road Km 12 Trench to Shahdara Chowk ODF',
    armorTypeId: 'CST_SINGLE_STEEL',
    environmentId: 'DIRECT_BURIED_HEAVY_TRAFFIC',
    appliedCrushLoadNPer100mm: 2800.0,
    tupMassKg: 2.0,
    tupDropHeightM: 0.5, // E = 2.0 * 9.8 * 0.5 = 9.8 Joules
    burialDepthM: 1.3,
    cableOuterDiameterMm: 13.5,
    hasConcreteProtectionSlab: true
  },
  'PRESET_RAVI_SIPHON_CANAL_CROSSING': {
    id: 'PRESET_RAVI_SIPHON_CANAL_CROSSING',
    name: 'Ravi Siphon Irrigation Embankment Run (DSTA Double Tape)',
    customer: 'Ravi Siphon Agriculture & River Demarcation',
    route: 'Canal Bank Milepost 03 Trench to FAT-RS-02',
    armorTypeId: 'DSTA_DOUBLE_TAPE',
    environmentId: 'AGRICULTURAL_CANAL_CROSSING',
    appliedCrushLoadNPer100mm: 2400.0,
    tupMassKg: 2.0,
    tupDropHeightM: 0.6, // E = 11.76 Joules
    burialDepthM: 1.1,
    cableOuterDiameterMm: 15.0,
    hasConcreteProtectionSlab: false
  },
  'PRESET_RAILWAY_TRACK_BALLAST': {
    id: 'PRESET_RAILWAY_TRACK_BALLAST',
    name: 'Imamia Colony Railway Crossing (SWA Steel Wire Armor, 4800 N)',
    customer: 'Imamia Colony Inter-City Rail Feeder',
    route: 'Track Bed Crossing #04 to Station Distribution Node',
    armorTypeId: 'SWA_DOUBLE_WIRE',
    environmentId: 'RAILWAY_TRACK_BALLAST',
    appliedCrushLoadNPer100mm: 4800.0,
    tupMassKg: 4.0,
    tupDropHeightM: 0.5, // E = 19.6 Joules
    burialDepthM: 1.6,
    cableOuterDiameterMm: 17.5,
    hasConcreteProtectionSlab: true
  },
  'PRESET_VANDALA_MARKET_TRENCH': {
    id: 'PRESET_VANDALA_MARKET_TRENCH',
    name: 'Vandala Road Retail Strip Trench (CST Armored, 1800 N)',
    customer: 'Vandala Road Commercial Subscribers Group',
    route: 'Vandala Road West Sidewalk Trench to FAT-VR-07',
    armorTypeId: 'CST_SINGLE_STEEL',
    environmentId: 'URBAN_PAVEMENT_TRENCH',
    appliedCrushLoadNPer100mm: 1800.0,
    tupMassKg: 1.0,
    tupDropHeightM: 0.4, // E = 3.92 Joules
    burialDepthM: 0.95,
    cableOuterDiameterMm: 12.0,
    hasConcreteProtectionSlab: false
  },
  'PRESET_BEGUM_KOT_SHALLOW_UNARMORED': {
    id: 'PRESET_BEGUM_KOT_SHALLOW_UNARMORED',
    name: 'Begum Kot Contractor Trench (Unarmored Duct Cable in Direct Bury)',
    customer: 'Begum Kot Residential Expansion Block C',
    route: 'Street 9 Soil Trench to Sub-Distribution Node',
    armorTypeId: 'UNARMORED_DUCT_CABLE',
    environmentId: 'URBAN_PAVEMENT_TRENCH',
    appliedCrushLoadNPer100mm: 1900.0, // Exceeds 800 N rating
    tupMassKg: 2.0,
    tupDropHeightM: 0.5, // 9.8 J exceeds 2.0 J
    burialDepthM: 0.5, // Shallow < 0.9m
    cableOuterDiameterMm: 9.0,
    hasConcreteProtectionSlab: false
  }
};

/**
 * Calculates falling tup impact energy in Joules.
 * Formula: E = m * g * h (IEC 60794-1-21 Method E4)
 * @param {number} tupMassKg
 * @param {number} dropHeightM
 * @param {number} [gravity=9.80665]
 * @returns {number} impact energy in Joules
 */
export function calculateImpactEnergyJoules(tupMassKg, dropHeightM, gravity = 9.80665) {
  const m = Math.max(0.1, Number(tupMassKg) || 1.0);
  const h = Math.max(0.05, Number(dropDropHeightM(dropHeightM)) || 0.5);
  return Number((m * gravity * h).toFixed(2));
}

function dropDropHeightM(val) {
  const n = Number(val);
  return isNaN(n) ? 0.5 : n;
}

/**
 * Calculates radial crush deflection (deformation in mm) under lateral compressive loading.
 * @param {number} appliedCrushLoadNPer100mm
 * @param {number} cableOuterDiameterMm
 * @param {number} radialStiffnessFactor
 * @returns {{ deflectionMm: number, percentDeformation: number, remainingBufferClearanceMm: number }}
 */
export function calculateRadialCrushDeflection(appliedCrushLoadNPer100mm, cableOuterDiameterMm, radialStiffnessFactor) {
  const load = Math.max(0, Number(appliedCrushLoadNPer100mm) || 1000.0);
  const od = Math.max(5.0, Number(cableOuterDiameterMm) || 12.0);
  const stiffness = Math.max(0.2, Number(radialStiffnessFactor) || 1.0);

  // Elastic-plastic compression model
  const baseDeflectionMm = (load / (2000.0 * stiffness)) * (od / 12.0);
  const clampedDeflection = Math.min(od * 0.75, Number(baseDeflectionMm.toFixed(2)));
  const percentDeform = Number(((clampedDeflection / od) * 100.0).toFixed(1));

  // Buffer tube clearance: assuming standard buffer tube OD ~ 3.0mm inside
  const remainingClearanceMm = Number(Math.max(0, (od * 0.4) - clampedDeflection).toFixed(2));

  return {
    deflectionMm: clampedDeflection,
    percentDeformation: percentDeform,
    remainingBufferClearanceMm: remainingClearanceMm
  };
}

/**
 * Calculates induced optical micro-bending loss (dB) under lateral crush plate stress.
 * Standards: IEC 60794-1-21 Method E3 allows Δα ≤ 0.05 dB residual, ≤ 0.10 dB transient.
 * @param {number} appliedCrushLoadNPer100mm
 * @param {number} ratedCrushLoadNPer100mm
 * @returns {number} induced optical attenuation in dB
 */
export function calculateInducedCrushLossDb(appliedCrushLoadNPer100mm, ratedCrushLoadNPer100mm) {
  const load = Math.max(0, Number(appliedCrushLoadNPer100mm) || 1000.0);
  const rated = Math.max(500.0, Number(ratedCrushLoadNPer100mm) || 3000.0);

  const ratio = load / rated;
  if (ratio <= 0.6) {
    return 0.01;
  }
  if (ratio <= 1.0) {
    // Linear elastic region: 0.01 to 0.05 dB
    return Number((0.01 + (ratio - 0.6) * 0.1).toFixed(3));
  }
  // Plastic buckling region: exponential rise
  const excess = ratio - 1.0;
  const loss = 0.05 + Math.pow(excess, 1.8) * 0.45;
  return Number(Math.min(2.5, loss).toFixed(3));
}

/**
 * Evaluates burial depth compliance against municipal/WASA regulations.
 * @param {number} burialDepthM
 * @param {number} requiredMinDepthM
 * @returns {{ isCompliant: boolean, depthMarginM: number, safetyFactor: number }}
 */
export function evaluateBurialDepthCompliance(burialDepthM, requiredMinDepthM) {
  const depth = Math.max(0.1, Number(burialDepthM) || 1.0);
  const req = Math.max(0.5, Number(requiredMinDepthM) || 1.0);

  const margin = Number((depth - req).toFixed(2));
  const sf = Number((depth / req).toFixed(2));

  return {
    isCompliant: depth >= req,
    depthMarginM: margin,
    safetyFactor: sf
  };
}

/**
 * Full structural and optical evaluation of direct-buried armored optical cable span.
 * @param {Object} input
 * @returns {Object} detailed metrology analysis report
 */
export function evaluateArmoredCableCrush(input = {}) {
  const armorType = ARMOR_TYPES[input.armorTypeId] || ARMOR_TYPES['CST_SINGLE_STEEL'];
  const environment = BURIAL_ENVIRONMENTS[input.environmentId] || BURIAL_ENVIRONMENTS['DIRECT_BURIED_HEAVY_TRAFFIC'];

  const appliedCrushLoadNPer100mm = Math.max(100.0, Number(input.appliedCrushLoadNPer100mm) || 2500.0);
  const tupMassKg = Math.max(0.1, Number(input.tupMassKg) || 2.0);
  const tupDropHeightM = Math.max(0.05, Number(input.tupDropHeightM) || 0.5);
  const burialDepthM = Math.max(0.1, Number(input.burialDepthM) || 1.2);
  const cableOuterDiameterMm = Math.max(5.0, Number(input.cableOuterDiameterMm) || 13.5);
  const hasConcreteProtectionSlab = Boolean(input.hasConcreteProtectionSlab);

  // Impact physics
  const impactEnergyJoules = calculateImpactEnergyJoules(tupMassKg, tupDropHeightM);
  const impactRatio = Number((impactEnergyJoules / armorType.ratedImpactEnergyJoules).toFixed(2));
  const impactSafe = impactEnergyJoules <= armorType.ratedImpactEnergyJoules;

  // Crush deflection & optical loss
  const deflectionProfile = calculateRadialCrushDeflection(
    appliedCrushLoadNPer100mm,
    cableOuterDiameterMm,
    armorType.radialStiffnessFactor
  );
  const inducedLossDb = calculateInducedCrushLossDb(
    appliedCrushLoadNPer100mm,
    armorType.ratedCrushLoadNPer100mm
  );
  const crushLoadRatio = Number((appliedCrushLoadNPer100mm / armorType.ratedCrushLoadNPer100mm).toFixed(2));
  const crushSafe = appliedCrushLoadNPer100mm <= armorType.ratedCrushLoadNPer100mm;

  // Burial depth
  const depthCompliance = evaluateBurialDepthCompliance(burialDepthM, environment.minBurialDepthM);

  // Rodent & mechanical risk synthesis
  let verdictKey = 'CERTIFIED_OPTIMAL';
  const deficiencyList = [];

  if (!crushSafe || inducedLossDb > 0.10) {
    verdictKey = 'FAILED_CRUSH_OVERLOAD';
    deficiencyList.push(`Applied crush load (${appliedCrushLoadNPer100mm} N/100mm) exceeds armor rating (${armorType.ratedCrushLoadNPer100mm} N/100mm); induced optical loss ${inducedLossDb} dB exceeds 0.10 dB limit.`);
  }

  if (!impactSafe) {
    if (verdictKey !== 'FAILED_CRUSH_OVERLOAD') {
      verdictKey = 'FAILED_IMPACT_PUNCTURE';
    }
    deficiencyList.push(`Impact energy (${impactEnergyJoules} J) exceeds armor threshold (${armorType.ratedImpactEnergyJoules} J); high risk of shovel puncture or shattered core.`);
  }

  if (verdictKey === 'CERTIFIED_OPTIMAL') {
    if (!depthCompliance.isCompliant || (environment.concreteSlabRequired && !hasConcreteProtectionSlab) || inducedLossDb > 0.05) {
      verdictKey = 'CONDITIONAL_PASS';
      if (!depthCompliance.isCompliant) {
        deficiencyList.push(`Trench depth (${burialDepthM}m) is shallower than required ${environment.minBurialDepthM}m; concrete protection tiles mandated.`);
      }
      if (environment.concreteSlabRequired && !hasConcreteProtectionSlab) {
        deficiencyList.push(`Heavy traffic right-of-way requires reinforced concrete warning slabs above cable bedding.`);
      }
      if (inducedLossDb > 0.05) {
        deficiencyList.push(`Induced micro-bending loss (${inducedLossDb} dB) exceeds standard 0.05 dB residual threshold; monitor under traffic load.`);
      }
    }
  }

  const verdict = ARMORED_CABLE_VERDICTS[verdictKey];

  return {
    armorType,
    environment,
    appliedCrushLoadNPer100mm,
    tupMassKg,
    tupDropHeightM,
    burialDepthM,
    cableOuterDiameterMm,
    hasConcreteProtectionSlab,
    impactEnergyJoules,
    impactRatio,
    impactSafe,
    deflectionProfile,
    inducedLossDb,
    crushLoadRatio,
    crushSafe,
    depthCompliance,
    verdict,
    deficiencyList,
    testedAt: new Date().toISOString()
  };
}

/**
 * Validates form inputs for the Armored Cable Crush & Impact QA Suite.
 * @param {Object} input
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateArmoredCableCrushInput(input = {}) {
  const errors = [];

  if (!input.customer || !String(input.customer).trim()) {
    errors.push('Subscriber name or feeder route owner is required.');
  }

  if (!input.route || !String(input.route).trim()) {
    errors.push('Trench route, KM marker, or ODF location is required.');
  }

  const load = Number(input.appliedCrushLoadNPer100mm);
  if (isNaN(load) || load < 100.0 || load > 15000.0) {
    errors.push('Applied crush load must be between 100 and 15,000 N/100mm.');
  }

  const depth = Number(input.burialDepthM);
  if (isNaN(depth) || depth < 0.1 || depth > 10.0) {
    errors.push('Burial depth must be between 0.1 and 10.0 meters.');
  }

  const tup = Number(input.tupMassKg);
  if (isNaN(tup) || tup < 0.1 || tup > 50.0) {
    errors.push('Impact tup mass must be between 0.1 and 50.0 kg.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Builds an immutable certificate record with an official identifier.
 * Format: ARM-YYYYMM-XXXX
 * @param {Object} input
 * @param {Object} [analysisResult]
 * @returns {Object} complete certificate record
 */
export function buildArmoredCableCrushRecord(input = {}, analysisResult = null) {
  const analysis = analysisResult || evaluateArmoredCableCrush(input);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const certId = `ARM-${year}${month}-${rand}`;

  return {
    certId,
    timestamp: now.toISOString(),
    customer: String(input.customer || 'Shahdara Network Subscriber').trim(),
    route: String(input.route || 'G.T. Road Main Feeder Trench').trim(),
    technicianName: String(input.technicianName || 'Shahdara OSP Civil & Fiber Lineworker').trim(),
    status: analysis.verdict.id === 'FAILED_CRUSH_OVERLOAD' || analysis.verdict.id === 'FAILED_IMPACT_PUNCTURE' ? 'ACTION_REQUIRED' : 'VERIFIED',
    analysis
  };
}

let inMemoryArmoredCerts = [];

/**
 * Retrieves saved Armored Cable Crush certificates from LocalStorage or in-memory fallback.
 * @param {Object} [state]
 * @returns {Array} list of certificate records
 */
export function getSavedArmoredCableCrushCerts(state = {}) {
  if (state && typeof state === 'object' && Array.isArray(state.armoredCerts)) {
    return state.armoredCerts;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(ARMORED_CABLE_CRUSH_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      // fallback
    }
  }
  return inMemoryArmoredCerts;
}

/**
 * Saves an Armored Cable Crush certificate record to LocalStorage (FIFO capacity: 100 records).
 * @param {Object} record
 * @param {Object} [state]
 * @returns {Array} updated certificates list
 */
export function saveArmoredCableCrushCert(record, state = {}) {
  const current = getSavedArmoredCableCrushCerts(state);
  const filtered = current.filter(c => c.certId !== record.certId);
  filtered.unshift(record);
  if (filtered.length > 100) {
    filtered.pop();
  }
  inMemoryArmoredCerts = filtered;
  if (state && typeof state === 'object') {
    state.armoredCerts = filtered;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ARMORED_CABLE_CRUSH_STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      // fallback
    }
  }
  return filtered;
}

/**
 * Updates status of an existing certificate (VERIFIED, RESOLVED, ACTION_REQUIRED).
 * @param {string} certId
 * @param {string} newStatus
 * @param {Object} [state]
 * @returns {Array} updated certificates list
 */
export function updateArmoredCableCrushCertStatus(certId, newStatus, state = {}) {
  const current = getSavedArmoredCableCrushCerts(state);
  const item = current.find(c => c.certId === certId);
  if (item) {
    item.status = newStatus;
    item.updatedAt = new Date().toISOString();
  }
  inMemoryArmoredCerts = current;
  if (state && typeof state === 'object') {
    state.armoredCerts = current;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ARMORED_CABLE_CRUSH_STORAGE_KEY, JSON.stringify(current));
    } catch (e) {
      // fallback
    }
  }
  return current;
}

/**
 * Clears all saved Armored Cable Crush certificates from LocalStorage and in-memory.
 * @param {Object} [state]
 */
export function clearArmoredCableCrushCerts(state = {}) {
  inMemoryArmoredCerts = [];
  if (state && typeof state === 'object') {
    state.armoredCerts = [];
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(ARMORED_CABLE_CRUSH_STORAGE_KEY);
    } catch (e) {
      // fallback
    }
  }
  return [];
}

/**
 * Calculates high-level aggregate KPI metrics for saved Armored Cable Crush certificates.
 * @param {Array} [certs]
 * @returns {Object} aggregate metrics
 */
export function calculateArmoredCableCrushMetrics(certs = null) {
  const list = certs || getSavedArmoredCableCrushCerts();
  const total = list.length;
  if (total === 0) {
    return {
      totalInspections: 0,
      optimalCount: 0,
      conditionalCount: 0,
      failedCrushCount: 0,
      failedImpactCount: 0,
      passRatePercent: 0,
      avgBurialDepthM: 0,
      avgInducedLossDb: 0
    };
  }

  let optimal = 0;
  let conditional = 0;
  let failCrush = 0;
  let failImpact = 0;
  let depthSum = 0;
  let lossSum = 0;

  list.forEach(c => {
    const vId = c.analysis?.verdict?.id;
    if (vId === 'CERTIFIED_OPTIMAL') optimal++;
    else if (vId === 'CONDITIONAL_PASS') conditional++;
    else if (vId === 'FAILED_CRUSH_OVERLOAD') failCrush++;
    else if (vId === 'FAILED_IMPACT_PUNCTURE') failImpact++;

    depthSum += Number(c.analysis?.burialDepthM) || 0;
    lossSum += Number(c.analysis?.inducedLossDb) || 0;
  });

  const passingTotal = optimal + conditional;
  const passRate = Number(((passingTotal / total) * 100.0).toFixed(1));
  const avgDepth = Number((depthSum / total).toFixed(2));
  const avgLoss = Number((lossSum / total).toFixed(3));

  return {
    totalInspections: total,
    optimalCount: optimal,
    conditionalCount: conditional,
    failedCrushCount: failCrush,
    failedImpactCount: failImpact,
    passRatePercent: passRate,
    avgBurialDepthM: avgDepth,
    avgInducedLossDb: avgLoss
  };
}

/**
 * Pure-vector SVG visualizer rendering concentric cable cross-section,
 * corrugated steel armoring, buffer tubes, hydraulic crush plates, and telemetry ribbon.
 * @param {Object} analysis
 * @returns {string} pure SVG markup
 */
export function renderArmoredCableCrushSvg(analysis) {
  if (!analysis) return '';

  const {
    armorType,
    environment,
    appliedCrushLoadNPer100mm,
    burialDepthM,
    cableOuterDiameterMm,
    deflectionProfile,
    inducedLossDb,
    impactEnergyJoules,
    verdict,
    hasConcreteProtectionSlab
  } = analysis;

  const w = 780;
  const h = 330;

  const centerX = 230;
  const centerY = 165;
  const radius = 90;

  // Deformation squish: oval RX / RY
  const deformScale = Math.min(0.35, deflectionProfile.percentDeformation / 100.0);
  const rx = radius * (1.0 + deformScale * 0.7);
  const ry = radius * (1.0 - deformScale);

  // Status color
  const statusColor = verdict.color || '#16a34a';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%"  class="armored-cable-crush-svg" style="background:#090d16; border-radius:8px; font-family:system-ui,-apple-system,sans-serif;">
      <defs>
        <linearGradient id="crushPlateGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#475569" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
        <radialGradient id="hdpeJacketGrad" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stop-color="#1e293b" />
          <stop offset="100%" stop-color="#0f172a" />
        </radialGradient>
        <marker id="crushArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#f87171" />
        </marker>
      </defs>

      <!-- Background Grid -->
      <g stroke="#1e293b" stroke-width="0.8" opacity="0.6">
        <line x1="30" y1="50" x2="750" y2="50" />
        <line x1="30" y1="110" x2="750" y2="110" />
        <line x1="30" y1="170" x2="750" y2="170" />
        <line x1="30" y1="230" x2="750" y2="230" />
        <line x1="30" y1="290" x2="750" y2="290" />
      </g>

      <!-- Upper Hydraulic Crush Plate (IEC 60794-1-21 Method E3 100mm Plate) -->
      <rect x="90" y="${centerY - ry - 32}" width="280" height="24" fill="url(#crushPlateGrad)" rx="3" stroke="#94a3b8" stroke-width="1.5" />
      <text x="${centerX}" y="${centerY - ry - 16}" fill="#f8fafc" font-size="10.5" font-weight="700" text-anchor="middle">
        100mm COMPRESSIVE CRUSH HEAD: ${appliedCrushLoadNPer100mm} N/100mm
      </text>

      <!-- Crush Force Arrows Downward -->
      <line x1="140" y1="${centerY - ry - 55}" x2="140" y2="${centerY - ry - 36}" stroke="#ef4444" stroke-width="3" marker-end="url(#crushArrow)" />
      <line x1="${centerX}" y1="${centerY - ry - 55}" x2="${centerX}" y2="${centerY - ry - 36}" stroke="#ef4444" stroke-width="3" marker-end="url(#crushArrow)" />
      <line x1="320" y1="${centerY - ry - 55}" x2="320" y2="${centerY - ry - 36}" stroke="#ef4444" stroke-width="3" marker-end="url(#crushArrow)" />

      <!-- Lower Anvil Support Plate -->
      <rect x="90" y="${centerY + ry + 8}" width="280" height="24" fill="url(#crushPlateGrad)" rx="3" stroke="#94a3b8" stroke-width="1.5" />
      <text x="${centerX}" y="${centerY + ry + 24}" fill="#f8fafc" font-size="10.5" font-weight="700" text-anchor="middle">
        RIGID BASE ANVIL BEDDING
      </text>

      <!-- Concentric Cable Cross-Section Layers -->
      <!-- 1. Outer HDPE Jacket (Deformed Oval) -->
      <ellipse cx="${centerX}" cy="${centerY}" rx="${rx}" ry="${ry}" fill="url(#hdpeJacketGrad)" stroke="#38bdf8" stroke-width="2.5" />

      <!-- 2. Corrugated Steel Armor Ring (Corrugated pattern) -->
      <ellipse cx="${centerX}" cy="${centerY}" rx="${rx * 0.82}" ry="${ry * 0.82}" fill="none" stroke="${armorType.id === 'UNARMORED_DUCT_CABLE' ? '#ef4444' : '#fbbf24'}" stroke-width="4.5" stroke-dasharray="${armorType.id === 'UNARMORED_DUCT_CABLE' ? '4,4' : '6,3'}" />

      <!-- 3. Water-Blocking Swellable Tape Layer -->
      <ellipse cx="${centerX}" cy="${centerY}" rx="${rx * 0.70}" ry="${ry * 0.70}" fill="#0f172a" stroke="#0284c7" stroke-width="1.8" />

      <!-- 4. Central PBT Buffer Tube -->
      <ellipse cx="${centerX}" cy="${centerY}" rx="${rx * 0.42}" ry="${ry * 0.42}" fill="#1e293b" stroke="#e2e8f0" stroke-width="2" />

      <!-- 5. Optical Fiber Cores (Color Coded TIA-598-D: Blue, Orange, Green, Brown, Slate, White) -->
      <circle cx="${centerX - 16}" cy="${centerY - 8}" r="5.5" fill="#0284c7" stroke="#fff" stroke-width="1" />
      <circle cx="${centerX}" cy="${centerY - 16}" r="5.5" fill="#f97316" stroke="#fff" stroke-width="1" />
      <circle cx="${centerX + 16}" cy="${centerY - 8}" r="5.5" fill="#16a34a" stroke="#fff" stroke-width="1" />
      <circle cx="${centerX + 16}" cy="${centerY + 10}" r="5.5" fill="#854d0e" stroke="#fff" stroke-width="1" />
      <circle cx="${centerX}" cy="${centerY + 18}" r="5.5" fill="#94a3b8" stroke="#fff" stroke-width="1" />
      <circle cx="${centerX - 16}" cy="${centerY + 10}" r="5.5" fill="#f8fafc" stroke="#64748b" stroke-width="1" />

      <!-- Right Side Engineering Metrology Panel -->
      <g transform="translate(420, 40)">
        <!-- Header -->
        <rect x="0" y="0" width="330" height="250" fill="#0f172a" rx="8" stroke="#1e293b" stroke-width="1.5" />
        <text x="16" y="24" fill="#38bdf8" font-size="12" font-weight="800">
          ARMORED CABLE CRUSH &amp; IMPACT METROLOGY
        </text>
        <line x1="16" y1="34" x2="314" y2="34" stroke="#334155" stroke-width="1" />

        <!-- Parameter 1: Applied vs Rated Crush -->
        <text x="16" y="58" fill="#94a3b8" font-size="10.5">Applied Crush Load:</text>
        <text x="314" y="58" fill="#f8fafc" font-size="11.5" font-weight="700" text-anchor="end">
          ${appliedCrushLoadNPer100mm} N/100mm
        </text>
        <text x="16" y="74" fill="#64748b" font-size="9.5">Armor Capacity: ${armorType.ratedCrushLoadNPer100mm} N (${analysis.crushLoadRatio * 100}% load)</text>

        <!-- Parameter 2: Induced Optical Loss -->
        <text x="16" y="100" fill="#94a3b8" font-size="10.5">Induced Micro-Bending Loss:</text>
        <text x="314" y="100" fill="${inducedLossDb <= 0.05 ? '#10b981' : inducedLossDb <= 0.10 ? '#f59e0b' : '#ef4444'}" font-size="13" font-weight="800" text-anchor="end">
          ${inducedLossDb} dB
        </text>
        <text x="16" y="116" fill="#64748b" font-size="9.5">Limit: ≤ 0.05 dB residual (IEC 60794-1-21 E3)</text>

        <!-- Parameter 3: Impact Energy -->
        <text x="16" y="142" fill="#94a3b8" font-size="10.5">Shovel/Tup Impact Energy:</text>
        <text x="314" y="142" fill="${analysis.impactSafe ? '#10b981' : '#ef4444'}" font-size="12" font-weight="700" text-anchor="end">
          ${impactEnergyJoules} Joules
        </text>
        <text x="16" y="158" fill="#64748b" font-size="9.5">Tup: ${analysis.tupMassKg}kg @ ${analysis.tupDropHeightM}m (Limit: ${armorType.ratedImpactEnergyJoules}J)</text>

        <!-- Parameter 4: Burial Depth & Slab -->
        <text x="16" y="184" fill="#94a3b8" font-size="10.5">Trench Burial Depth:</text>
        <text x="314" y="184" fill="${analysis.depthCompliance.isCompliant ? '#10b981' : '#ef4444'}" font-size="12" font-weight="700" text-anchor="end">
          ${burialDepthM} m (${analysis.depthCompliance.safetyFactor}x Req)
        </text>
        <text x="16" y="200" fill="#64748b" font-size="9.5">
          ${hasConcreteProtectionSlab ? '✓ Concrete Warning Slab Fitted' : '⚠ No Concrete Slab Fitted'}
        </text>

        <!-- Verdict Banner -->
        <rect x="12" y="214" width="306" height="26" fill="${statusColor}22" rx="4" stroke="${statusColor}" stroke-width="1.2" />
        <text x="165" y="231" fill="${statusColor}" font-size="11" font-weight="800" text-anchor="middle">
          VERDICT: ${verdict.name}
        </text>
      </g>

      <!-- Bottom HUD Ribbon -->
      <rect x="25" y="302" width="730" height="22" fill="#0f172a" rx="4" stroke="#1e293b" stroke-width="1" />
      <text x="35" y="316" fill="#38bdf8" font-size="10" font-weight="700">
        ARMOR: ${armorType.name}
      </text>
      <text x="420" y="316" fill="#a78bfa" font-size="10" font-weight="700">
        ENVIRONMENT: ${environment.name}
      </text>
      <text x="690" y="316" fill="#34d399" font-size="10" font-weight="700">
        OD: ${cableOuterDiameterMm}mm
      </text>
    </svg>
  `;
}

/**
 * Generates printable HTML documents (Formal A4 QA Certificate & 80mm POS Thermal Slip).
 * @param {Object} certRecord
 * @param {Object} options
 * @returns {string} full HTML document
 */
export function generateArmoredCableCrushCertHtml(certRecord, options = { format: 'a4' }) {
  if (!certRecord || !certRecord.analysis) return '';

  const { certId, timestamp, customer, route, technicianName, analysis } = certRecord;
  const {
    armorType,
    environment,
    appliedCrushLoadNPer100mm,
    burialDepthM,
    cableOuterDiameterMm,
    deflectionProfile,
    inducedLossDb,
    impactEnergyJoules,
    verdict,
    hasConcreteProtectionSlab,
    deficiencyList
  } = analysis;

  const isA4 = options.format !== 'thermal';
  const dateStr = new Date(timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  if (isA4) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Armored Cable Crush &amp; Impact QA Accreditation Certificate - ${certId}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; line-height: 1.4; margin: 0; padding: 0; background: #fff; font-size: 11pt; }
          .cert-container { border: 2px solid #0284c7; padding: 24px; border-radius: 8px; position: relative; }
          .cert-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 16px; }
          .cert-title h1 { margin: 0; font-size: 18pt; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px; }
          .cert-title h2 { margin: 4px 0 0; font-size: 11pt; color: #64748b; font-weight: 500; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: 700; font-size: 10pt; text-transform: uppercase; }
          .badge-optimal { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
          .badge-conditional { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
          .badge-hazard { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
          .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
          .metric-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 6px; }
          .metric-label { font-size: 8.5pt; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 3px; }
          .metric-val { font-size: 13pt; font-weight: 700; color: #0f172a; }
          .metric-sub { font-size: 8.5pt; color: #475569; margin-top: 2px; }
          table.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 16px; font-size: 9.5pt; }
          table.data-table th, table.data-table td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
          table.data-table th { background: #f1f5f9; font-weight: 600; color: #334155; }
          .signature-row { display: flex; justify-content: space-between; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
          .sig-box { width: 42%; text-align: center; }
          .sig-line { border-bottom: 1px dashed #64748b; margin-bottom: 6px; height: 36px; }
        </style>
      </head>
      <body>
        <div class="cert-container">
          <div class="cert-header">
            <div class="cert-title">
              <h1>Armored Cable Crush &amp; Impact QA Certificate</h1>
              <h2>Shahdara Telecom Outside Plant Quality Assurance &amp; Civil Safety Division</h2>
              <p style="margin:4px 0 0; font-size:9pt; color:#64748b;">Standards: IEC 60794-1-21 Method E3/E4 · Telcordia GR-20-CORE · ITU-T L.400 / L.12</p>
            </div>
            <div style="text-align: right;">
              <span class="badge ${verdict.id === 'CERTIFIED_OPTIMAL' ? 'badge-optimal' : verdict.id === 'CONDITIONAL_PASS' ? 'badge-conditional' : 'badge-hazard'}">
                ${verdict.name}
              </span>
              <div style="font-size: 9pt; color: #64748b; margin-top: 6px;">Certificate ID: <strong>${certId}</strong></div>
              <div style="font-size: 9pt; color: #64748b;">Issued: ${dateStr}</div>
            </div>
          </div>

          <div class="grid-2">
            <div class="metric-box">
              <div class="metric-label">Trench Route / Demarcation</div>
              <div style="font-weight: 700; font-size: 11pt;">${route}</div>
              <div class="metric-sub">Subscriber / Network Node: <strong>${customer}</strong></div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Underground Soil / Right-of-Way Environment</div>
              <div style="font-weight: 700; font-size: 11pt;">${environment.name}</div>
              <div class="metric-sub">Required Depth: <strong>≥ ${environment.minBurialDepthM} m</strong></div>
            </div>
          </div>

          <div class="grid-3">
            <div class="metric-box">
              <div class="metric-label">Applied Crush Load</div>
              <div class="metric-val">${appliedCrushLoadNPer100mm} N/100mm</div>
              <div class="metric-sub">Rating: ${armorType.ratedCrushLoadNPer100mm} N (${analysis.crushLoadRatio * 100}% load)</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Induced Micro-Bending Loss</div>
              <div class="metric-val" style="color: ${inducedLossDb <= 0.05 ? '#16a34a' : '#dc2626'}">${inducedLossDb} dB</div>
              <div class="metric-sub">Limit: ≤ 0.05 dB residual (IEC Method E3)</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Shovel / Tup Impact Energy</div>
              <div class="metric-val" style="color: ${analysis.impactSafe ? '#16a34a' : '#dc2626'}">${impactEnergyJoules} J</div>
              <div class="metric-sub">Armor Threshold: ${armorType.ratedImpactEnergyJoules} J</div>
            </div>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>Metrology Parameter</th>
                <th>Engineering Value</th>
                <th>Standard Reference Limit</th>
                <th>Compliance Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Armoring Specification</strong></td>
                <td>${armorType.name} (OD: ${cableOuterDiameterMm}mm)</td>
                <td>Rodent Defense: ${armorType.rodentResistanceRating} · Puncture: ${armorType.punctureResistanceRating}</td>
                <td><strong style="color:#0284c7">VERIFIED</strong></td>
              </tr>
              <tr>
                <td><strong>Radial Crush Deflection</strong></td>
                <td>Deflection: ${deflectionProfile.deflectionMm} mm (${deflectionProfile.percentDeformation}%)</td>
                <td>Remaining Buffer Clearance: ${deflectionProfile.remainingBufferClearanceMm} mm</td>
                <td><strong style="color:${deflectionProfile.remainingBufferClearanceMm > 0 ? '#16a34a' : '#dc2626'}">${deflectionProfile.remainingBufferClearanceMm > 0 ? 'ELASTIC' : 'PLASTIC BUCKLE'}</strong></td>
              </tr>
              <tr>
                <td><strong>Trench Burial Depth</strong></td>
                <td>Depth: ${burialDepthM} m (Margin: ${analysis.depthCompliance.depthMarginM >= 0 ? '+' : ''}${analysis.depthCompliance.depthMarginM} m)</td>
                <td>Mandatory Depth ≥ ${environment.minBurialDepthM} m</td>
                <td><strong style="color:${analysis.depthCompliance.isCompliant ? '#16a34a' : '#dc2626'}">${analysis.depthCompliance.isCompliant ? 'COMPLIANT' : 'SHALLOW DEFECT'}</strong></td>
              </tr>
              <tr>
                <td><strong>Civil Warning Protection</strong></td>
                <td>Concrete Warning Slab: ${hasConcreteProtectionSlab ? 'Installed ✓' : 'None'}</td>
                <td>Required by Environment: ${environment.concreteSlabRequired ? 'Mandatory' : 'Optional'}</td>
                <td><strong style="color:${!environment.concreteSlabRequired || hasConcreteProtectionSlab ? '#16a34a' : '#d97706'}">${!environment.concreteSlabRequired || hasConcreteProtectionSlab ? 'PROTECTED' : 'ADVISORY'}</strong></td>
              </tr>
            </tbody>
          </table>

          ${deficiencyList.length > 0 ? `
            <div style="background:#fef2f2; border:1px solid #f87171; border-radius:6px; padding:10px 14px; margin-bottom:16px;">
              <strong style="color:#991b1b; font-size:9.5pt;">Mandatory Remedial Actions / Deficiencies:</strong>
              <ul style="margin:4px 0 0 16px; padding:0; font-size:9pt; color:#b91c1c;">
                ${deficiencyList.map(d => `<li>${d}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <div class="signature-row">
            <div class="sig-box">
              <div class="sig-line"></div>
              <div style="font-weight:700; font-size:9.5pt;">${technicianName}</div>
              <div style="font-size:8pt; color:#64748b;">OSP Certified Civil &amp; Trenching Inspector</div>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <div style="font-weight:700; font-size:9.5pt;">Chief Civil &amp; Optical Engineer</div>
              <div style="font-size:8pt; color:#64748b;">Shahdara Telecom Network Operations Center</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // 80mm Thermal POS Slip Format
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>POS Slip - ${certId}</title>
      <style>
        @page { size: 80mm auto; margin: 3mm; }
        body { font-family: "Courier New", Courier, monospace; width: 74mm; margin: 0 auto; padding: 2mm; font-size: 9pt; color: #000; line-height: 1.25; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .sep { border-top: 1px dashed #000; margin: 5px 0; }
        .row { display: flex; justify-content: space-between; }
      </style>
    </head>
    <body>
      <div class="center bold">SHAHDARA TELECOM OSP</div>
      <div class="center">ARMORED CABLE CRUSH &amp; IMPACT SLIP</div>
      <div class="center">IEC 60794-1-21 Method E3/E4</div>
      <div class="sep"></div>
      <div class="row"><span>CERT:</span><span>${certId}</span></div>
      <div class="row"><span>DATE:</span><span>${dateStr}</span></div>
      <div class="row"><span>TECH:</span><span>${technicianName}</span></div>
      <div class="row"><span>CUST:</span><span>${customer}</span></div>
      <div class="sep"></div>
      <div class="bold">CRUSH &amp; IMPACT METROLOGY:</div>
      <div class="row"><span>Armor Type:</span><span>${armorType.id}</span></div>
      <div class="row"><span>Applied Crush:</span><span>${appliedCrushLoadNPer100mm} N</span></div>
      <div class="row"><span>Induced Loss:</span><span class="bold">${inducedLossDb} dB</span></div>
      <div class="row"><span>Loss Limit:</span><span>≤ 0.05 dB</span></div>
      <div class="row"><span>Impact Energy:</span><span>${impactEnergyJoules} J</span></div>
      <div class="row"><span>Impact Limit:</span><span>${armorType.ratedImpactEnergyJoules} J</span></div>
      <div class="row"><span>Burial Depth:</span><span class="bold">${burialDepthM} m</span></div>
      <div class="row"><span>Min Depth Req:</span><span>≥ ${environment.minBurialDepthM} m</span></div>
      <div class="row"><span>Concrete Slab:</span><span>${hasConcreteProtectionSlab ? 'YES' : 'NO'}</span></div>
      <div class="sep"></div>
      <div class="center bold" style="font-size:11pt;">*** ${verdict.id} ***</div>
      <div class="center">${verdict.name}</div>
      <div class="sep"></div>
      <div style="height: 25px;"></div>
      <div class="center">Inspector Signature: __________________</div>
      <div class="center" style="font-size:7pt; margin-top:4px;">Shahdara ISP Offline Field POS</div>
    </body>
    </html>
  `;
}

/**
 * Formats bilingual Urdu & English WhatsApp technician dispatch and lineworker notice.
 * @param {Object} certRecord
 * @returns {string} WhatsApp formatted text
 */
export function formatArmoredCableCrushCertWhatsApp(certRecord) {
  if (!certRecord || !certRecord.analysis) return '';

  const { certId, customer, route, technicianName, analysis } = certRecord;
  const {
    armorType,
    environment,
    appliedCrushLoadNPer100mm,
    burialDepthM,
    inducedLossDb,
    impactEnergyJoules,
    verdict,
    hasConcreteProtectionSlab
  } = analysis;

  const isPass = verdict.id === 'CERTIFIED_OPTIMAL';
  const icon = isPass ? '✅' : verdict.id === 'CONDITIONAL_PASS' ? '⚠️' : '🚨';

  return `*${icon} SHAHDARA ISP · ARMORED CABLE CRUSH & IMPACT QA*
*سرٹیفکیٹ برائے زیرِ زمین فائبر کیبل کچلنے اور اثر کی جانچ*
---------------------------------------
📋 *Certificate:* ${certId}
👤 *Subscriber / Route:* ${customer}
📍 *Trench Route:* ${route}
👷 *Inspector:* ${technicianName}

🛡️ *Armoring & Trench Metrology / پیمائش:*
• Armor Specification: *${armorType.name}*
• Environment: *${environment.name}*
• Burial Depth (کھدائی کی گہرائی): *${burialDepthM} m* (Req: ≥ ${environment.minBurialDepthM}m)

💥 *Crush & Impact Stress / دباؤ اور اثر:*
• Applied Crush Load: *${appliedCrushLoadNPer100mm} N/100mm* (Rating: ${armorType.ratedCrushLoadNPer100mm} N)
• Induced Micro-Bending Loss: *${inducedLossDb} dB* (Limit: ≤ 0.05 dB)
• Tup Impact Energy: *${impactEnergyJoules} Joules* (Rating: ${armorType.ratedImpactEnergyJoules} J)
• Concrete Protection Slab: *${hasConcreteProtectionSlab ? 'Installed ✓' : 'Not Fitted ⚠️'}*

⚖️ *QA Verdict:* *${verdict.name}*
${isPass ? '✓ Cable satisfies all IEC 60794-1-21 Method E3/E4 crush & impact criteria.' : '⚠️ Immediate civil remediation required: install warning slab or verify burial depth.'}

_Shahdara Outside Plant & Civil Safety Division_`;
}

/**
 * Generates RFC-4180 compliant CSV export with UTF-8 BOM.
 * @param {Array} certs
 * @returns {string} CSV text
 */
export function generateArmoredCableCrushCertsCsv(certs = null) {
  const list = certs || getSavedArmoredCableCrushCerts();
  const headers = [
    'Certificate ID',
    'Date',
    'Customer',
    'Route / Trench',
    'Technician',
    'Armor Type',
    'Environment',
    'Applied Crush Load (N/100mm)',
    'Rated Crush Load (N/100mm)',
    'Induced Loss (dB)',
    'Impact Energy (J)',
    'Rated Impact (J)',
    'Burial Depth (m)',
    'Required Depth (m)',
    'Concrete Slab Fitted',
    'Verdict ID',
    'Status'
  ];

  const escape = (val) => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = list.map(c => {
    const a = c.analysis || {};
    return [
      escape(c.certId),
      escape(c.timestamp),
      escape(c.customer),
      escape(c.route),
      escape(c.technicianName),
      escape(a.armorType?.id),
      escape(a.environment?.id),
      escape(a.appliedCrushLoadNPer100mm),
      escape(a.armorType?.ratedCrushLoadNPer100mm),
      escape(a.inducedLossDb),
      escape(a.impactEnergyJoules),
      escape(a.armorType?.ratedImpactEnergyJoules),
      escape(a.burialDepthM),
      escape(a.environment?.minBurialDepthM),
      escape(a.hasConcreteProtectionSlab ? 'YES' : 'NO'),
      escape(a.verdict?.id),
      escape(c.status)
    ].join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Controller setting up the modal dialog, interactive recalculation,
 * live SVG preview, preset selection, printable views, and history table.
 * @param {Object} options
 * @returns {Object} modal controller instance
 */
export function setupArmoredCableCrushModal(options = {}) {
  const modal = document.getElementById('armoredCableCrushModal');
  if (!modal) return null;

  const triggerButton = options.triggerButton || document.getElementById('openArmoredCableCrushBtn');
  const closeBtn = document.getElementById('armoredCableCrushCloseBtn');
  const presetSelect = document.getElementById('armoredPresetSelect');
  const custInput = document.getElementById('armoredCustInput');
  const routeInput = document.getElementById('armoredRouteInput');
  const techInput = document.getElementById('armoredTechInput');
  const armorTypeSelect = document.getElementById('armoredTypeSelect');
  const envSelect = document.getElementById('armoredEnvSelect');
  const crushLoadInput = document.getElementById('armoredCrushLoadInput');
  const tupMassInput = document.getElementById('armoredTupMassInput');
  const tupDropInput = document.getElementById('armoredTupDropInput');
  const depthInput = document.getElementById('armoredDepthInput');
  const odInput = document.getElementById('armoredOdInput');
  const slabCheckbox = document.getElementById('armoredSlabCheckbox');
  const svgContainer = document.getElementById('armoredSvgContainer');
  const kpiRibbon = document.getElementById('armoredKpiRibbon');
  const saveBtn = document.getElementById('armoredSaveCertBtn');
  const printA4Btn = document.getElementById('armoredPrintA4Btn');
  const printThermalBtn = document.getElementById('armoredPrintThermalBtn');
  const copyWhatsAppBtn = document.getElementById('armoredCopyWhatsAppBtn');
  const exportCsvBtn = document.getElementById('armoredExportCsvBtn');
  const tableBody = document.getElementById('armoredHistoryTableBody');
  const searchInput = document.getElementById('armoredSearchInput');

  let currentAnalysis = null;
  let currentRecord = null;

  function getFormData() {
    return {
      customer: custInput ? custInput.value : 'Shahdara Central Trunk Feeder',
      route: routeInput ? routeInput.value : 'G.T. Road Km 12 Trench to ODF',
      technicianName: techInput ? techInput.value : 'Shahdara OSP Civil & Fiber Lineworker',
      armorTypeId: armorTypeSelect ? armorTypeSelect.value : 'CST_SINGLE_STEEL',
      environmentId: envSelect ? envSelect.value : 'DIRECT_BURIED_HEAVY_TRAFFIC',
      appliedCrushLoadNPer100mm: crushLoadInput ? Number(crushLoadInput.value) : 2800.0,
      tupMassKg: tupMassInput ? Number(tupMassInput.value) : 2.0,
      tupDropHeightM: tupDropInput ? Number(tupDropInput.value) : 0.5,
      burialDepthM: depthInput ? Number(depthInput.value) : 1.3,
      cableOuterDiameterMm: odInput ? Number(odInput.value) : 13.5,
      hasConcreteProtectionSlab: slabCheckbox ? slabCheckbox.checked : true
    };
  }

  function recalculate() {
    const data = getFormData();
    currentAnalysis = evaluateArmoredCableCrush(data);
    currentRecord = buildArmoredCableCrushRecord(data, currentAnalysis);

    if (svgContainer) {
      svgContainer.innerHTML = renderArmoredCableCrushSvg(currentAnalysis);
    }

    if (kpiRibbon) {
      const v = currentAnalysis.verdict;
      kpiRibbon.innerHTML = `
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 12px; text-align:center;">
          <div style="font-size:10px; color:#94a3b8; text-transform:uppercase; font-weight:700;">Applied Crush</div>
          <div style="font-size:16px; font-weight:800; color:#38bdf8;">${currentAnalysis.appliedCrushLoadNPer100mm} N</div>
          <div style="font-size:10px; color:#64748b;">Rating: ${currentAnalysis.armorType.ratedCrushLoadNPer100mm} N</div>
        </div>
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 12px; text-align:center;">
          <div style="font-size:10px; color:#94a3b8; text-transform:uppercase; font-weight:700;">Induced Loss</div>
          <div style="font-size:16px; font-weight:800; color:${currentAnalysis.inducedLossDb <= 0.05 ? '#10b981' : '#ef4444'};">${currentAnalysis.inducedLossDb} dB</div>
          <div style="font-size:10px; color:#64748b;">Limit ≤ 0.05 dB</div>
        </div>
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 12px; text-align:center;">
          <div style="font-size:10px; color:#94a3b8; text-transform:uppercase; font-weight:700;">Impact Energy</div>
          <div style="font-size:16px; font-weight:800; color:${currentAnalysis.impactSafe ? '#10b981' : '#ef4444'};">${currentAnalysis.impactEnergyJoules} J</div>
          <div style="font-size:10px; color:#64748b;">Rating: ${currentAnalysis.armorType.ratedImpactEnergyJoules} J</div>
        </div>
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 12px; text-align:center;">
          <div style="font-size:10px; color:#94a3b8; text-transform:uppercase; font-weight:700;">QA Verdict</div>
          <div style="font-size:13px; font-weight:800; color:${v.color}; margin-top:2px;">${v.name}</div>
          <div style="font-size:10px; color:#64748b;">Burial Depth: ${currentAnalysis.burialDepthM}m</div>
        </div>
      `;
    }
  }

  function renderHistoryTable() {
    if (!tableBody) return;
    const certs = getSavedArmoredCableCrushCerts();
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filtered = certs.filter(c => {
      if (!query) return true;
      return (
        c.certId.toLowerCase().includes(query) ||
        (c.customer && c.customer.toLowerCase().includes(query)) ||
        (c.route && c.route.toLowerCase().includes(query))
      );
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:16px; color:#94a3b8;">
            No armored cable crush certification records found.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = filtered.map(c => {
      const a = c.analysis || {};
      const v = a.verdict || {};
      return `
        <tr>
          <td><strong>${c.certId}</strong></td>
          <td>${new Date(c.timestamp).toLocaleDateString('en-GB')}</td>
          <td>${c.customer || '—'}</td>
          <td>${a.appliedCrushLoadNPer100mm || 0} N / ${a.inducedLossDb || 0} dB</td>
          <td><strong style="color:${a.depthCompliance?.isCompliant ? '#10b981' : '#ef4444'}">${a.burialDepthM || 0}m</strong></td>
          <td><span class="badge" style="background:${v.color}22; color:${v.color}; border:1px solid ${v.color}44; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700;">${v.id || 'N/A'}</span></td>
          <td>
            <button type="button" class="btn-arm-view" data-cert-id="${c.certId}" style="padding:2px 6px; font-size:10px; cursor:pointer;">View</button>
            <button type="button" class="btn-arm-print" data-cert-id="${c.certId}" style="padding:2px 6px; font-size:10px; cursor:pointer;">Print</button>
          </td>
        </tr>
      `;
    }).join('');

    tableBody.querySelectorAll('.btn-arm-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-cert-id');
        const match = certs.find(x => x.certId === id);
        if (match && match.analysis) {
          currentAnalysis = match.analysis;
          currentRecord = match;
          if (custInput) custInput.value = match.customer || '';
          if (routeInput) routeInput.value = match.route || '';
          if (armorTypeSelect) armorTypeSelect.value = match.analysis.armorType?.id || 'CST_SINGLE_STEEL';
          if (envSelect) envSelect.value = match.analysis.environment?.id || 'DIRECT_BURIED_HEAVY_TRAFFIC';
          if (crushLoadInput) crushLoadInput.value = match.analysis.appliedCrushLoadNPer100mm || 2800;
          if (tupMassInput) tupMassInput.value = match.analysis.tupMassKg || 2.0;
          if (tupDropInput) tupDropInput.value = match.analysis.tupDropHeightM || 0.5;
          if (depthInput) depthInput.value = match.analysis.burialDepthM || 1.3;
          if (odInput) odInput.value = match.analysis.cableOuterDiameterMm || 13.5;
          if (slabCheckbox) slabCheckbox.checked = match.analysis.hasConcreteProtectionSlab || false;
          recalculate();
        }
      });
    });

    tableBody.querySelectorAll('.btn-arm-print').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-cert-id');
        const match = certs.find(x => x.certId === id);
        if (match) {
          const html = generateArmoredCableCrushCertHtml(match, { format: 'a4' });
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(html);
            win.document.close();
            win.print();
          }
        }
      });
    });
  }

  function loadPreset(presetKey) {
    const p = SHAH_ARMORED_PRESETS[presetKey];
    if (!p) return;
    if (custInput) custInput.value = p.customer;
    if (routeInput) routeInput.value = p.route;
    if (armorTypeSelect) armorTypeSelect.value = p.armorTypeId;
    if (envSelect) envSelect.value = p.environmentId;
    if (crushLoadInput) crushLoadInput.value = p.appliedCrushLoadNPer100mm;
    if (tupMassInput) tupMassInput.value = p.tupMassKg;
    if (tupDropInput) tupDropInput.value = p.tupDropHeightM;
    if (depthInput) depthInput.value = p.burialDepthM;
    if (odInput) odInput.value = p.cableOuterDiameterMm;
    if (slabCheckbox) slabCheckbox.checked = p.hasConcreteProtectionSlab;
    recalculate();
  }

  // Event wiring
  if (presetSelect) {
    presetSelect.addEventListener('change', () => loadPreset(presetSelect.value));
  }

  [
    custInput, routeInput, techInput, armorTypeSelect, envSelect,
    crushLoadInput, tupMassInput, tupDropInput, depthInput, odInput, slabCheckbox
  ].forEach(el => {
    if (el) {
      el.addEventListener('input', recalculate);
      el.addEventListener('change', recalculate);
    }
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      recalculate();
      saveArmoredCableCrushCert(currentRecord);
      renderHistoryTable();
      alert(`Armored Cable Certification ${currentRecord.certId} saved successfully.`);
    });
  }

  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      recalculate();
      const html = generateArmoredCableCrushCertHtml(currentRecord, { format: 'a4' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.print();
      }
    });
  }

  if (printThermalBtn) {
    printThermalBtn.addEventListener('click', () => {
      recalculate();
      const html = generateArmoredCableCrushCertHtml(currentRecord, { format: 'thermal' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.print();
      }
    });
  }

  if (copyWhatsAppBtn) {
    copyWhatsAppBtn.addEventListener('click', () => {
      recalculate();
      const text = formatArmoredCableCrushCertWhatsApp(currentRecord);
      navigator.clipboard.writeText(text).then(() => {
        alert('WhatsApp Lineman dispatch notice copied to clipboard.');
      }).catch(() => {
        prompt('Copy WhatsApp Notice:', text);
      });
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const csv = generateArmoredCableCrushCertsCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `armored-cable-crush-certs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', renderHistoryTable);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    });
  }

  if (triggerButton) {
    triggerButton.addEventListener('click', () => {
      if (modal.showModal) modal.showModal();
      else modal.setAttribute('open', '');
      recalculate();
      renderHistoryTable();
    });
  }

  // Initial load
  recalculate();
  renderHistoryTable();

  return {
    modal,
    recalculate,
    renderHistoryTable,
    loadPreset
  };
}
