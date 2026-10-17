/**
 * Shahdara ISP Billing & Network Operations - Outside Plant & Premises
 * Fiber Drop Cable Conduit Pulling Tension, Sidewall Bearing Pressure (SWBP) & Duct Fill QA Suite
 * Standards: IEC 60794-1-21 Method E1, Telcordia GR-20-CORE Issue 4, IEEE 1210, NEC Chapter 9 Table 1
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const CONDUIT_PULLING_STORAGE_KEY = 'shahdara_conduit_pulling_certs_v1';

export const CONDUIT_PULL_CABLE_TYPES = {
  'FTTH_DROP_FLAT_FRP_1F': {
    id: 'FTTH_DROP_FLAT_FRP_1F',
    name: '1-Core Flat Drop Cable (Dielectric FRP, G.657.A2)',
    category: 'Flat Drop Dielectric',
    effectiveDiameterMm: 3.0,
    unitWeightKgM: 0.009, // 0.0883 N/m
    unitWeightNm: 0.0883,
    maxPullingLoadN: 100.0,
    maxSwbpNm: 450.0,
    minDynamicBendRadiusMm: 60.0,
    typicalConduit: 'PVC_CONDUIT_25MM',
    description: 'Lightweight dielectric drop cable with dual FRP dielectric strength members; sensitive to sidewall crushing.'
  },
  'FTTH_DROP_FLAT_STEEL_2F': {
    id: 'FTTH_DROP_FLAT_STEEL_2F',
    name: '2-Core Flat Drop Cable with Steel Messenger Wire (G.657.A2)',
    category: 'Flat Drop Metallic Messenger',
    effectiveDiameterMm: 4.2,
    unitWeightKgM: 0.022, // 0.2158 N/m
    unitWeightNm: 0.2158,
    maxPullingLoadN: 300.0,
    maxSwbpNm: 600.0,
    minDynamicBendRadiusMm: 80.0,
    typicalConduit: 'PVC_CONDUIT_25MM',
    description: 'Self-supporting figure-8 or flat drop with high-tensile steel messenger wire providing increased pulling capacity.'
  },
  'RISER_DISTRIBUTION_6F': {
    id: 'RISER_DISTRIBUTION_6F',
    name: '6-Core Tight-Buffered Riser Distribution Cable (LSZH / Aramid)',
    category: 'Indoor Riser Distribution',
    effectiveDiameterMm: 5.5,
    unitWeightKgM: 0.028, // 0.2747 N/m
    unitWeightNm: 0.2747,
    maxPullingLoadN: 600.0,
    maxSwbpNm: 750.0,
    minDynamicBendRadiusMm: 110.0,
    typicalConduit: 'PVC_CONDUIT_25MM',
    description: 'Indoor multi-tenant riser cable reinforced with Kevlar aramid yarn strength member for vertical duct pulls.'
  },
  'CENTRAL_LOOSE_TUBE_12F_ARMORED': {
    id: 'CENTRAL_LOOSE_TUBE_12F_ARMORED',
    name: '12-Core Direct-Buried Armored Duct Cable (CST / PE)',
    category: 'Outside Plant Armored Feeder',
    effectiveDiameterMm: 8.5,
    unitWeightKgM: 0.075, // 0.7358 N/m
    unitWeightNm: 0.7358,
    maxPullingLoadN: 1500.0,
    maxSwbpNm: 1200.0,
    minDynamicBendRadiusMm: 170.0,
    typicalConduit: 'PVC_CONDUIT_32MM',
    description: 'Corrugated steel tape (CST) armored outdoor feeder cable designed for underground conduit road crossings.'
  },
  'INDOOR_MICRO_ROUND_DROP_1F': {
    id: 'INDOOR_MICRO_ROUND_DROP_1F',
    name: '1-Core Round Micro-Drop Cable (2.0mm LSZH, G.657.B3)',
    category: 'Premises Micro-Drop',
    effectiveDiameterMm: 2.0,
    unitWeightKgM: 0.005, // 0.0490 N/m
    unitWeightNm: 0.0490,
    maxPullingLoadN: 80.0,
    maxSwbpNm: 350.0,
    minDynamicBendRadiusMm: 40.0,
    typicalConduit: 'FLEXIBLE_CORRUGATED_20MM',
    description: 'Flexible 2.0mm ultra-bend-insensitive micro-drop for concealed wall chases and tight residential conduits.'
  }
};

export const CONDUIT_TYPES = {
  'PVC_CONDUIT_25MM': {
    id: 'PVC_CONDUIT_25MM',
    name: '25mm (1-Inch) Rigid Schedule 40 UPVC Conduit',
    material: 'Rigid UPVC',
    outerDiameterMm: 25.0,
    innerDiameterMm: 21.0,
    frictionCoeffDry: 0.35,
    frictionCoeffLubricated: 0.15,
    defaultElbowRadiusMm: 150.0,
    description: 'Standard rigid UPVC electrical/telecom conduit used in commercial riser shafts and exterior building runs.'
  },
  'PVC_CONDUIT_32MM': {
    id: 'PVC_CONDUIT_32MM',
    name: '32mm (1.25-Inch) Rigid UPVC Underground Pipe',
    material: 'Heavy UPVC',
    outerDiameterMm: 32.0,
    innerDiameterMm: 27.0,
    frictionCoeffDry: 0.35,
    frictionCoeffLubricated: 0.14,
    defaultElbowRadiusMm: 200.0,
    description: 'Heavy underground duct for road shoulders and feeder cable transitions across Shahdara thoroughfares.'
  },
  'FLEXIBLE_CORRUGATED_20MM': {
    id: 'FLEXIBLE_CORRUGATED_20MM',
    name: '20mm Flexible Corrugated Polypropylene Pipe (Concealed Wall Chase)',
    material: 'Corrugated PP',
    outerDiameterMm: 20.0,
    innerDiameterMm: 15.5,
    frictionCoeffDry: 0.50,
    frictionCoeffLubricated: 0.22,
    defaultElbowRadiusMm: 80.0,
    description: 'Flexible corrugated pipe in plaster walls; corrugations create high sliding friction if unlubricated.'
  },
  'HDPE_SMOOTH_BORE_40MM': {
    id: 'HDPE_SMOOTH_BORE_40MM',
    name: '40mm Sub-Duct Smooth-Wall HDPE (Silicone Internal Lining)',
    material: 'HDPE Silicon-Lined',
    outerDiameterMm: 40.0,
    innerDiameterMm: 33.0,
    frictionCoeffDry: 0.25,
    frictionCoeffLubricated: 0.10,
    defaultElbowRadiusMm: 450.0,
    description: 'Factory-extruded low-friction sub-duct engineered for long-distance winch pulls with large bend radii.'
  },
  'METALLIC_GI_CONDUIT_25MM': {
    id: 'METALLIC_GI_CONDUIT_25MM',
    name: '25mm Class 4 Heavy Galvanized Iron (GI) Conduit',
    material: 'Galvanized Steel',
    outerDiameterMm: 25.0,
    innerDiameterMm: 21.8,
    frictionCoeffDry: 0.40,
    frictionCoeffLubricated: 0.18,
    defaultElbowRadiusMm: 160.0,
    description: 'High-impact physical protection conduit deployed on exposed industrial or pole riser risers.'
  }
};

export const PULLING_LUBRICANT_MODES = {
  'POLYMER_LUBRICATED': {
    id: 'POLYMER_LUBRICATED',
    name: 'Water-based Polymer Cable Lubricant Applied (Recommended)',
    reductionFactor: 1.0, // Uses standard lubricated coefficient
    burnRisk: 'NEGLIGIBLE',
    recommendation: 'Compliant with IEEE 1210 and Telcordia GR-20-CORE. Minimizes pulling drag by up to 60%.'
  },
  'TALC_DRY_POWDER': {
    id: 'TALC_DRY_POWDER',
    name: 'Industrial Talc Powder (Dry Moderate)',
    reductionFactor: 1.45,
    burnRisk: 'LOW',
    recommendation: 'Acceptable for short indoor runs under 20m; does not attract dirt or degrade cable jackets.'
  },
  'UNLUBRICATED_DRY': {
    id: 'UNLUBRICATED_DRY',
    name: 'Unlubricated Dry Pull (High Friction / Sheath Burn Hazard)',
    reductionFactor: 2.33, // Uses dry friction coefficient
    burnRisk: 'HIGH',
    recommendation: 'Caution: high pulling drag can shear thin jackets against conduit elbows; lubricant strongly advised.'
  },
  'SOAP_DISHWASH_FIELD': {
    id: 'SOAP_DISHWASH_FIELD',
    name: 'Field Detergent / Dishwashing Soap (Unapproved Chemical Hazard)',
    reductionFactor: 1.25,
    burnRisk: 'CRITICAL_HAZARD',
    recommendation: 'Strictly prohibited: contains surfactants that degrade polyethylene jackets, causing environmental stress cracking.'
  }
};

export const CONDUIT_PULLING_VERDICTS = {
  'CERTIFIED_OPTIMAL_PULL': {
    id: 'CERTIFIED_OPTIMAL_PULL',
    name: 'Certified Optimal Conduit Pull (Pass)',
    badgeClass: 'badge-success',
    color: '#16a34a',
    description: 'Pulling tension ≤ 75% of MAPL, SWBP ≤ 75% limit, conduit fill within NEC rules, negligible optical attenuation (Δα ≤ 0.02 dB).'
  },
  'CONDITIONAL_PASS_MONITOR': {
    id: 'CONDITIONAL_PASS_MONITOR',
    name: 'Conditional Pass (High Drag / Verify OTDR Post-Pull)',
    badgeClass: 'badge-warning',
    color: '#f59e0b',
    description: 'Pulling tension is 75-100% of MAPL or SWBP is 75-100% of crushing limit; perform bidirectional OTDR attenuation check.'
  },
  'FAILED_OVERTENSION_HAZARD': {
    id: 'FAILED_OVERTENSION_HAZARD',
    name: 'Failed: Overtension / Glass Breakage Hazard (Reject)',
    badgeClass: 'badge-danger',
    color: '#dc2626',
    description: 'Calculated pulling tension exceeds Maximum Allowable Pulling Load (MAPL) or SWBP crushes buffer; acute risk of glass core fracture.'
  },
  'FAILED_CONDUIT_OVERFILL_JAM': {
    id: 'FAILED_CONDUIT_OVERFILL_JAM',
    name: 'Failed: Conduit Overfill / Jam Hazard (Reject)',
    badgeClass: 'badge-danger',
    color: '#dc2626',
    description: 'Conduit fill ratio exceeds NEC Chapter 9 Table 1 limit or jam ratio falls within jamming danger zone (1.05 - 1.40).'
  }
};

export const SHAHDARA_CONDUIT_PRESETS = [
  {
    id: 'BARADARI_COMMERCIAL_PLAZA_RISER',
    name: 'Baradari 3-Story Commercial Plaza Riser Conduit',
    subscriberName: 'Mian Tariq Textiles & General Mills',
    routeDescription: 'Baradari Central Market Plaza, Vertical Riser Duct to Floor 3 Server Room',
    cableTypeId: 'RISER_DISTRIBUTION_6F',
    conduitTypeId: 'PVC_CONDUIT_25MM',
    cableCount: 2,
    conduitLengthM: 38.0,
    bendCount90: 3,
    bendCount45: 1,
    bendRadiusMm: 150.0,
    lubricantModeId: 'POLYMER_LUBRICATED',
    pullingDirection: 'DOWNWARD_GRAVITY_ASSIST',
    notes: 'Vertical riser with pull box on Floor 2; cable lubricated with polymer gel before pulling.'
  },
  {
    id: 'VANDALA_ROAD_UNDERGROUND_CROSSING',
    name: 'Vandala Road Underground Street Crossing Pipe',
    subscriberName: 'Haji Usman Auto Engineering Works',
    routeDescription: 'Vandala Road Underground Duct Crossing, Pole-14 to Customer Boundary Wall',
    cableTypeId: 'CENTRAL_LOOSE_TUBE_12F_ARMORED',
    conduitTypeId: 'PVC_CONDUIT_32MM',
    cableCount: 1,
    conduitLengthM: 28.0,
    bendCount90: 2,
    bendCount45: 0,
    bendRadiusMm: 200.0,
    lubricantModeId: 'POLYMER_LUBRICATED',
    pullingDirection: 'HORIZONTAL',
    notes: 'Heavy CST armored cable pulled through underground road sleeve; winch pulling tension monitor attached.'
  },
  {
    id: 'BEGUM_KOT_WALL_CHASE_ENTRY',
    name: 'Begum Kot Residential Concealed Wall Chase Conduit',
    subscriberName: 'Malik Shakeel Electronics',
    routeDescription: 'Begum Kot Mohalla Street Riser, Pole drop into 20mm Corrugated Pipe',
    cableTypeId: 'FTTH_DROP_FLAT_FRP_1F',
    conduitTypeId: 'FLEXIBLE_CORRUGATED_20MM',
    cableCount: 1,
    conduitLengthM: 14.0,
    bendCount90: 2,
    bendCount45: 2,
    bendRadiusMm: 80.0,
    lubricantModeId: 'UNLUBRICATED_DRY',
    pullingDirection: 'HORIZONTAL',
    notes: 'Tight corrugated bend in masonry; high dry friction reported by installer.'
  },
  {
    id: 'JIA_MUSA_RISER_MULTIDROP',
    name: 'Jia Musa Commercial Plaza Shared Metal Conduit',
    subscriberName: 'Choudhry Waqas Apartment Complex',
    routeDescription: 'Jia Musa Commercial Strip, 25mm GI Conduit carrying multiple subscriber drops',
    cableTypeId: 'FTTH_DROP_FLAT_STEEL_2F',
    conduitTypeId: 'METALLIC_GI_CONDUIT_25MM',
    cableCount: 3,
    conduitLengthM: 24.0,
    bendCount90: 1,
    bendCount45: 4,
    bendRadiusMm: 160.0,
    lubricantModeId: 'TALC_DRY_POWDER',
    pullingDirection: 'HORIZONTAL',
    notes: 'Shared steel conduit carrying 3 drops; talc powder applied to mitigate cable-on-cable drag.'
  },
  {
    id: 'RAVI_SIPHON_DUCT_BANK',
    name: 'Ravi Siphon Feeder Sub-Duct Long Pull',
    subscriberName: 'Ravi Feeder Sub-Station Hub',
    routeDescription: 'Ravi River Siphon Bank, 40mm HDPE Sub-Duct to River Crossing Manhole',
    cableTypeId: 'CENTRAL_LOOSE_TUBE_12F_ARMORED',
    conduitTypeId: 'HDPE_SMOOTH_BORE_40MM',
    cableCount: 1,
    conduitLengthM: 75.0,
    bendCount90: 0,
    bendCount45: 2,
    bendRadiusMm: 450.0,
    lubricantModeId: 'POLYMER_LUBRICATED',
    pullingDirection: 'HORIZONTAL',
    notes: 'Long sub-duct run with smooth silicone bore; tension well within limits.'
  }
];

/**
 * Calculates conduit cross-sectional area and fill ratio according to NEC Chapter 9 Table 1.
 * NEC Table 1 allowable fill:
 * - 1 cable: 53%
 * - 2 cables: 31%
 * - 3 or more cables: 40%
 */
export function calculateConduitFillRatio(innerDiameterMm, cableDiameterMm, cableCount = 1) {
  const id = Math.max(1.0, Number(innerDiameterMm) || 21.0);
  const cd = Math.max(0.5, Number(cableDiameterMm) || 3.0);
  const count = Math.max(1, Math.round(Number(cableCount) || 1));

  const conduitArea = (Math.PI * Math.pow(id, 2)) / 4.0;
  const singleCableArea = (Math.PI * Math.pow(cd, 2)) / 4.0;
  const totalCableArea = singleCableArea * count;
  const fillRatioPercent = (totalCableArea / conduitArea) * 100.0;

  let maxAllowedPercent = 53.0;
  if (count === 2) {
    maxAllowedPercent = 31.0;
  } else if (count >= 3) {
    maxAllowedPercent = 40.0;
  }

  // Jam ratio J = ID / dc
  const jamRatio = id / cd;
  const isJamRisk = count >= 2 && jamRatio >= 1.05 && jamRatio <= 1.40;

  return {
    innerDiameterMm: id,
    cableDiameterMm: cd,
    cableCount: count,
    conduitAreaMm2: Number(conduitArea.toFixed(1)),
    totalCableAreaMm2: Number(totalCableArea.toFixed(1)),
    fillRatioPercent: Number(fillRatioPercent.toFixed(2)),
    maxAllowedPercent,
    isFillCompliant: fillRatioPercent <= maxAllowedPercent,
    jamRatio: Number(jamRatio.toFixed(2)),
    isJamRisk
  };
}

/**
 * Calculates Weight Correction Factor (WCF) for multi-cable pulls in conduit.
 * For single cable: WCF = 1.0
 * For multiple cables: WCF = 1 + (4/3) * (d_c / (ID - d_c))^2
 */
export function calculateWeightCorrectionFactor(innerDiameterMm, cableDiameterMm, cableCount = 1) {
  const count = Math.max(1, Math.round(Number(cableCount) || 1));
  if (count === 1) return 1.0;

  const id = Math.max(2.0, Number(innerDiameterMm) || 21.0);
  const cd = Math.max(0.5, Number(cableDiameterMm) || 3.0);
  const clearance = Math.max(0.5, id - cd);

  const ratio = cd / clearance;
  const wcf = 1.0 + (4.0 / 3.0) * Math.pow(ratio, 2);
  return Number(Math.min(2.5, Math.max(1.0, wcf)).toFixed(3));
}

/**
 * Calculates dynamic pulling tension and sidewall bearing pressure (SWBP)
 * through sequential straight sections and curved elbows.
 * Formula (Capstan equation): T_out = T_in * exp(mu * theta * WCF)
 * Sidewall Bearing Pressure: SWBP = T_out / R (in N/m)
 */
export function calculateConduitPullingTension(params = {}) {
  const cableType = CONDUIT_PULL_CABLE_TYPES[params.cableTypeId] || CONDUIT_PULL_CABLE_TYPES['FTTH_DROP_FLAT_FRP_1F'];
  const conduitType = CONDUIT_TYPES[params.conduitTypeId] || CONDUIT_TYPES['PVC_CONDUIT_25MM'];
  const lubricant = PULLING_LUBRICANT_MODES[params.lubricantModeId] || PULLING_LUBRICANT_MODES['POLYMER_LUBRICATED'];

  const lengthM = Math.max(1.0, Number(params.conduitLengthM) || 20.0);
  const bendCount90 = Math.max(0, Math.round(Number(params.bendCount90) || 0));
  const bendCount45 = Math.max(0, Math.round(Number(params.bendCount45) || 0));
  const bendRadiusMm = Math.max(20.0, Number(params.bendRadiusMm) || conduitType.defaultElbowRadiusMm);
  const bendRadiusM = bendRadiusMm / 1000.0;
  const cableCount = Math.max(1, Math.round(Number(params.cableCount) || 1));
  const pullingDirection = params.pullingDirection || 'HORIZONTAL';

  // Base friction coefficient
  let baseMu = conduitType.frictionCoeffLubricated;
  if (lubricant.id === 'UNLUBRICATED_DRY') {
    baseMu = conduitType.frictionCoeffDry;
  } else if (lubricant.id === 'TALC_DRY_POWDER') {
    baseMu = conduitType.frictionCoeffDry * 0.70;
  } else if (lubricant.id === 'SOAP_DISHWASH_FIELD') {
    baseMu = conduitType.frictionCoeffLubricated * 1.25;
  }

  // Multi-cable weight correction factor
  const wcf = calculateWeightCorrectionFactor(conduitType.innerDiameterMm, cableType.effectiveDiameterMm, cableCount);
  const effectiveMu = baseMu * wcf;

  // Unit weight for all cables being pulled together
  const unitWeightNm = cableType.unitWeightNm * cableCount;

  // Total bend angle in radians
  const totalBendsDegrees = (bendCount90 * 90.0) + (bendCount45 * 45.0);
  const totalBendsRadians = (totalBendsDegrees * Math.PI) / 180.0;

  // Initial tail tension (holding back tension off reel)
  let currentTensionN = 10.0; // 10 N nominal tail brake tension

  // Directional straight-run tension
  let straightTensionN = 0;
  if (pullingDirection === 'DOWNWARD_GRAVITY_ASSIST') {
    // Gravity assists vertical component
    straightTensionN = Math.max(2.0, (effectiveMu * unitWeightNm * lengthM) - (0.5 * unitWeightNm * lengthM));
  } else if (pullingDirection === 'UPWARD_VERTICAL') {
    straightTensionN = (unitWeightNm * lengthM) + (effectiveMu * unitWeightNm * lengthM);
  } else {
    // Horizontal
    straightTensionN = effectiveMu * unitWeightNm * lengthM;
  }

  currentTensionN += straightTensionN;

  // Apply Capstan exponential buildup for each bend
  // Distribute bends along route
  const totalBends = bendCount90 + bendCount45;
  const tensionProfile = [{ step: 'Entry', distanceM: 0, tensionN: 10.0, swbpNm: 0 }];

  if (totalBends === 0) {
    tensionProfile.push({ step: 'Exit', distanceM: lengthM, tensionN: Number(currentTensionN.toFixed(1)), swbpNm: 0 });
  } else {
    const segmentLength = lengthM / (totalBends + 1);
    let dist = segmentLength;

    // 90 degree bends
    for (let i = 1; i <= bendCount90; i++) {
      const theta = (90.0 * Math.PI) / 180.0;
      currentTensionN = currentTensionN * Math.exp(effectiveMu * theta);
      const swbp = currentTensionN / bendRadiusM;
      tensionProfile.push({
        step: `Bend 90° #${i}`,
        distanceM: Number(dist.toFixed(1)),
        tensionN: Number(currentTensionN.toFixed(1)),
        swbpNm: Number(swbp.toFixed(1))
      });
      dist += segmentLength;
    }

    // 45 degree bends
    for (let j = 1; j <= bendCount45; j++) {
      const theta = (45.0 * Math.PI) / 180.0;
      currentTensionN = currentTensionN * Math.exp(effectiveMu * theta);
      const swbp = currentTensionN / bendRadiusM;
      tensionProfile.push({
        step: `Bend 45° #${j}`,
        distanceM: Number(dist.toFixed(1)),
        tensionN: Number(currentTensionN.toFixed(1)),
        swbpNm: Number(swbp.toFixed(1))
      });
      dist += segmentLength;
    }

    tensionProfile.push({
      step: 'Conduit Exit',
      distanceM: lengthM,
      tensionN: Number(currentTensionN.toFixed(1)),
      swbpNm: 0
    });
  }

  const finalPullingTensionN = currentTensionN;
  const maxSwbpNm = totalBends > 0 ? (finalPullingTensionN / bendRadiusM) : 0;

  // Estimated mechanical tensile strain % = (T / MAPL) * 0.33% elastic limit
  const tensionRatio = finalPullingTensionN / cableType.maxPullingLoadN;
  const estimatedStrainPercent = tensionRatio * 0.33;

  // Induced optical loss model (ITU-T G.657 / IEC 60794-1-21 Method E1)
  let inducedLossDb = 0.005;
  if (tensionRatio > 1.0) {
    inducedLossDb = 0.05 + (tensionRatio - 1.0) * 0.45;
  } else if (tensionRatio > 0.75) {
    inducedLossDb = 0.02 + (tensionRatio - 0.75) * 0.08;
  }

  // Conduit fill calculation
  const fillInfo = calculateConduitFillRatio(conduitType.innerDiameterMm, cableType.effectiveDiameterMm, cableCount);

  // Verdict evaluation
  let verdict = CONDUIT_PULLING_VERDICTS['CERTIFIED_OPTIMAL_PULL'];
  if (!fillInfo.isFillCompliant || fillInfo.isJamRisk) {
    verdict = CONDUIT_PULLING_VERDICTS['FAILED_CONDUIT_OVERFILL_JAM'];
  } else if (finalPullingTensionN > cableType.maxPullingLoadN || maxSwbpNm > cableType.maxSwbpNm) {
    verdict = CONDUIT_PULLING_VERDICTS['FAILED_OVERTENSION_HAZARD'];
  } else if (finalPullingTensionN > cableType.maxPullingLoadN * 0.75 || maxSwbpNm > cableType.maxSwbpNm * 0.75 || lubricant.id === 'UNLUBRICATED_DRY') {
    verdict = CONDUIT_PULLING_VERDICTS['CONDITIONAL_PASS_MONITOR'];
  }

  return {
    cableType,
    conduitType,
    lubricant,
    conduitLengthM: lengthM,
    bendCount90,
    bendCount45,
    totalBends,
    totalBendsDegrees,
    bendRadiusMm,
    bendRadiusM,
    cableCount,
    wcf,
    effectiveMu: Number(effectiveMu.toFixed(3)),
    unitWeightNm: Number(unitWeightNm.toFixed(4)),
    finalPullingTensionN: Number(finalPullingTensionN.toFixed(1)),
    tensionUtilizationPercent: Number((tensionRatio * 100.0).toFixed(1)),
    maxSwbpNm: Number(maxSwbpNm.toFixed(1)),
    swbpUtilizationPercent: Number(((maxSwbpNm / cableType.maxSwbpNm) * 100.0).toFixed(1)),
    estimatedStrainPercent: Number(estimatedStrainPercent.toFixed(3)),
    inducedLossDb: Number(inducedLossDb.toFixed(3)),
    fillInfo,
    tensionProfile,
    verdict
  };
}

/**
 * Validates input parameters for a conduit pulling inspection certification.
 */
export function validateConduitPullingInput(data = {}) {
  const errors = [];

  if (!data.subscriberName || !String(data.subscriberName).trim()) {
    errors.push('Subscriber name or organization is required.');
  }

  if (!data.routeDescription || !String(data.routeDescription).trim()) {
    errors.push('Route description / conduit installation section is required.');
  }

  const length = Number(data.conduitLengthM);
  if (isNaN(length) || length < 1.0 || length > 500.0) {
    errors.push('Conduit length must be between 1.0 and 500.0 meters.');
  }

  const b90 = Number(data.bendCount90);
  if (isNaN(b90) || b90 < 0 || b90 > 10) {
    errors.push('90° bend count must be between 0 and 10.');
  }

  const b45 = Number(data.bendCount45);
  if (isNaN(b45) || b45 < 0 || b45 > 10) {
    errors.push('45° bend count must be between 0 and 10.');
  }

  const radius = Number(data.bendRadiusMm);
  if (isNaN(radius) || radius < 20.0 || radius > 1500.0) {
    errors.push('Elbow bend radius must be between 20.0 and 1500.0 mm.');
  }

  const count = Number(data.cableCount);
  if (isNaN(count) || count < 1 || count > 12) {
    errors.push('Cable count in conduit must be between 1 and 12.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Constructs an immutable, audit-ready certificate record.
 * Identifier format: CND-YYYYMM-XXXX
 */
export function buildConduitPullingCertRecord(data = {}) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const certId = data.id || `CND-${yearMonth}-${randomSuffix}`;

  const analysis = calculateConduitPullingTension(data);

  return {
    id: certId,
    timestamp: data.timestamp || now.toISOString(),
    subscriberName: String(data.subscriberName || 'Subscriber').trim(),
    customerId: data.customerId || null,
    routeDescription: String(data.routeDescription || 'Shahdara Conduit Route').trim(),
    cableTypeId: data.cableTypeId || 'FTTH_DROP_FLAT_FRP_1F',
    conduitTypeId: data.conduitTypeId || 'PVC_CONDUIT_25MM',
    lubricantModeId: data.lubricantModeId || 'POLYMER_LUBRICATED',
    conduitLengthM: Number(data.conduitLengthM) || 20.0,
    bendCount90: Number(data.bendCount90) || 0,
    bendCount45: Number(data.bendCount45) || 0,
    bendRadiusMm: Number(data.bendRadiusMm) || 150.0,
    cableCount: Number(data.cableCount) || 1,
    pullingDirection: data.pullingDirection || 'HORIZONTAL',
    technicianName: String(data.technicianName || 'Shahdara Lineman Team').trim(),
    notes: String(data.notes || '').trim(),
    status: data.status || 'VERIFIED',
    analysis
  };
}

let inMemoryConduitCerts = [];

/**
 * LocalStorage CRUD operations.
 */
export function getSavedConduitPullingCerts() {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(CONDUIT_PULLING_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error('Failed to read conduit pulling certs from localStorage:', err);
    }
  }
  return inMemoryConduitCerts;
}

export function saveConduitPullingCert(record) {
  const existing = getSavedConduitPullingCerts();
  const filtered = existing.filter(item => item.id !== record.id);
  filtered.unshift(record);
  const trimmed = filtered.slice(0, 100);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(CONDUIT_PULLING_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (err) {
      console.error('Failed to save conduit pulling cert to localStorage:', err);
    }
  }
  inMemoryConduitCerts = trimmed;
  return record;
}

export function updateConduitPullingCertStatus(certId, newStatus) {
  const list = getSavedConduitPullingCerts();
  const target = list.find(c => c.id === certId);
  if (target) {
    target.status = newStatus;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(CONDUIT_PULLING_STORAGE_KEY, JSON.stringify(list));
      } catch (err) {
        console.error('Failed to update conduit cert status:', err);
      }
    }
    return true;
  }
  return false;
}

export function clearConduitPullingCerts() {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(CONDUIT_PULLING_STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear conduit pulling certs:', err);
    }
  }
  inMemoryConduitCerts = [];
}

/**
 * Aggregates summary KPI metrics from certified records.
 */
export function calculateConduitPullingMetrics(records = []) {
  const total = records.length;
  if (total === 0) {
    return {
      totalCertificates: 0,
      optimalPassCount: 0,
      conditionalPassCount: 0,
      failedCount: 0,
      passRatePercent: 0,
      avgTensionN: 0,
      maxObservedTensionN: 0,
      avgFillRatioPercent: 0,
      jamRiskCount: 0
    };
  }

  let optimal = 0;
  let conditional = 0;
  let failed = 0;
  let sumTension = 0;
  let maxTension = 0;
  let sumFill = 0;
  let jamRisks = 0;

  for (const r of records) {
    const a = r.analysis;
    if (a && a.verdict) {
      if (a.verdict.id === 'CERTIFIED_OPTIMAL_PULL') optimal++;
      else if (a.verdict.id === 'CONDITIONAL_PASS_MONITOR') conditional++;
      else failed++;
    }
    if (a) {
      const t = a.finalPullingTensionN || 0;
      sumTension += t;
      if (t > maxTension) maxTension = t;
      if (a.fillInfo) {
        sumFill += a.fillInfo.fillRatioPercent || 0;
        if (a.fillInfo.isJamRisk) jamRisks++;
      }
    }
  }

  const passRate = total > 0 ? ((optimal + conditional) / total) * 100.0 : 0;

  return {
    totalCertificates: total,
    optimalPassCount: optimal,
    conditionalPassCount: conditional,
    failedCount: failed,
    passRatePercent: Number(passRate.toFixed(1)),
    avgTensionN: Number((sumTension / total).toFixed(1)),
    maxObservedTensionN: Number(maxTension.toFixed(1)),
    avgFillRatioPercent: Number((sumFill / total).toFixed(1)),
    jamRiskCount: jamRisks
  };
}

/**
 * Pure-vector SVG visualizer rendering the conduit profile,
 * bends, pulling tension vectors, sidewall bearing pressure (SWBP),
 * and real-time HUD telemetry ribbon.
 */
export function renderConduitPullingQaSvg(analysis) {
  if (!analysis) return '<svg width="100%" height="220" viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg"><text x="320" y="110" text-anchor="middle" fill="#64748b">No Telemetry Available</text></svg>';

  const v = analysis.verdict;
  const statusColor = v ? v.color : '#16a34a';
  const tension = analysis.finalPullingTensionN || 0;
  const maxAllowed = analysis.cableType.maxPullingLoadN;
  const tensionPct = Math.min(100, Math.max(0, analysis.tensionUtilizationPercent || 0));
  const swbp = analysis.maxSwbpNm || 0;
  const maxSwbp = analysis.cableType.maxSwbpNm;
  const swbpPct = Math.min(100, Math.max(0, analysis.swbpUtilizationPercent || 0));
  const fillPct = Math.min(100, Math.max(0, analysis.fillInfo ? analysis.fillInfo.fillRatioPercent : 0));
  const loss = analysis.inducedLossDb || 0;

  return `
<svg width="100%" height="220" viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg" style="background:#0f172a; border-radius:10px; font-family:system-ui,-apple-system,sans-serif;">
  <defs>
    <linearGradient id="pipeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#334155" />
      <stop offset="50%" stop-color="#475569" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="cableGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
    <linearGradient id="swbpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#dc2626" />
    </linearGradient>
  </defs>

  <!-- Title / Standard Header -->
  <rect x="0" y="0" width="640" height="34" fill="#1e293b" />
  <text x="16" y="22" fill="#94a3b8" font-size="11" font-weight="600" letter-spacing="0.5">OUTSIDE PLANT CONDUIT PULLING METROLOGY · IEC 60794-1-21 / IEEE 1210</text>
  <rect x="500" y="7" width="124" height="20" rx="4" fill="${statusColor}22" stroke="${statusColor}" stroke-width="1" />
  <text x="562" y="21" fill="${statusColor}" font-size="10" font-weight="700" text-anchor="middle">${v ? v.name.split(' ')[0] : 'VERIFIED'}</text>

  <!-- Conduit Schematic Route -->
  <g transform="translate(20, 48)">
    <!-- Conduit Outer Wall -->
    <path d="M 10,70 L 130,70 C 160,70 170,80 170,110 L 170,130 C 170,150 180,160 200,160 L 330,160"
          fill="none" stroke="url(#pipeGrad)" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Conduit Inner Bore -->
    <path d="M 10,70 L 130,70 C 160,70 170,80 170,110 L 170,130 C 170,150 180,160 200,160 L 330,160"
          fill="none" stroke="#090d16" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Fiber Drop Cable inside Conduit -->
    <path d="M 0,70 L 130,70 C 160,70 170,80 170,110 L 170,130 C 170,150 180,160 200,160 L 340,160"
          fill="none" stroke="url(#cableGrad)" stroke-width="6" stroke-linecap="round" stroke-dasharray="6,2" />

    <!-- Pulling Winch / Tension Arrow at Exit -->
    <g transform="translate(345, 160)">
      <polygon points="0,-7 14,0 0,7" fill="#38bdf8" />
      <line x1="-12" y1="0" x2="0" y2="0" stroke="#38bdf8" stroke-width="3" />
      <text x="20" y="4" fill="#38bdf8" font-size="10" font-weight="700">T_pull: ${tension} N</text>
    </g>

    <!-- Sidewall Bearing Pressure (SWBP) Vector Callout at Elbow -->
    <g transform="translate(182, 95)">
      <circle cx="0" cy="0" r="14" fill="#dc262622" stroke="#dc2626" stroke-width="1.5" />
      <line x1="-8" y1="-8" x2="8" y2="8" stroke="#dc2626" stroke-width="2" />
      <line x1="-8" y1="8" x2="8" y2="-8" stroke="#dc2626" stroke-width="2" />
      <text x="18" y="-4" fill="#f87171" font-size="9" font-weight="600">SWBP: ${swbp} N/m</text>
      <text x="18" y="8" fill="#94a3b8" font-size="8">Limit: ${maxSwbp} N/m</text>
    </g>

    <!-- Cable Reel at Entry -->
    <g transform="translate(0, 70)">
      <circle cx="-10" cy="0" r="12" fill="#1e293b" stroke="#64748b" stroke-width="2" />
      <circle cx="-10" cy="0" r="4" fill="#94a3b8" />
      <text x="-10" y="24" fill="#64748b" font-size="8" text-anchor="middle">Feed Reel</text>
    </g>
  </g>

  <!-- Right Side HUD Telemetry Card -->
  <g transform="translate(420, 46)">
    <rect x="0" y="0" width="206" height="162" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1" />

    <!-- Metric 1: Pulling Tension Load -->
    <text x="12" y="20" fill="#94a3b8" font-size="9">PULLING TENSION</text>
    <text x="12" y="36" fill="#f8fafc" font-size="13" font-weight="700">${tension} N</text>
    <text x="90" y="36" fill="#64748b" font-size="10">/ ${maxAllowed} N</text>
    <rect x="12" y="42" width="182" height="6" rx="3" fill="#334155" />
    <rect x="12" y="42" width="${(182 * tensionPct) / 100}" height="6" rx="3" fill="${tensionPct > 100 ? '#dc2626' : (tensionPct > 75 ? '#f59e0b' : '#38bdf8')}" />

    <!-- Metric 2: Sidewall Bearing Pressure -->
    <text x="12" y="66" fill="#94a3b8" font-size="9">SWBP AT ELBOWS</text>
    <text x="12" y="82" fill="#f8fafc" font-size="13" font-weight="700">${swbp} N/m</text>
    <text x="100" y="82" fill="#64748b" font-size="10">/ ${maxSwbp} N/m</text>
    <rect x="12" y="88" width="182" height="6" rx="3" fill="#334155" />
    <rect x="12" y="88" width="${(182 * swbpPct) / 100}" height="6" rx="3" fill="${swbpPct > 100 ? '#dc2626' : (swbpPct > 75 ? '#f59e0b' : '#22c55e')}" />

    <!-- Metric 3: Conduit Fill Ratio & Loss -->
    <text x="12" y="112" fill="#94a3b8" font-size="9">CONDUIT FILL &amp; LOSS</text>
    <text x="12" y="128" fill="#f8fafc" font-size="12" font-weight="700">${fillPct}% Fill</text>
    <text x="100" y="128" fill="#38bdf8" font-size="11" font-weight="600">Δα ≤ ${loss} dB</text>
    <rect x="12" y="134" width="182" height="6" rx="3" fill="#334155" />
    <rect x="12" y="134" width="${(182 * fillPct) / 100}" height="6" rx="3" fill="${fillPct > (analysis.fillInfo ? analysis.fillInfo.maxAllowedPercent : 40) ? '#dc2626' : '#10b981'}" />

    <!-- Bottom Status Text -->
    <text x="12" y="152" fill="#64748b" font-size="8">Jam Ratio: ${analysis.fillInfo ? analysis.fillInfo.jamRatio : 1.0} (${analysis.fillInfo && analysis.fillInfo.isJamRisk ? 'JAM RISK' : 'CLEAR'})</text>
  </g>
</svg>
`;
}

/**
 * Generates printable HTML certificate:
 * Options: { format: 'A4' | 'POS80' }
 */
export function generateConduitPullingCertHtml(record, options = {}) {
  const format = options.format || 'A4';
  const a = record.analysis;
  const v = a ? a.verdict : CONDUIT_PULLING_VERDICTS['CERTIFIED_OPTIMAL_PULL'];

  if (format === 'POS80') {
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>POS-80 ${record.id}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  body { font-family: monospace, sans-serif; font-size: 11px; color: #000; margin: 0; padding: 4px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
  .badge { display: inline-block; padding: 2px 4px; border: 1px solid #000; font-weight: bold; }
</style>
</head>
<body>
  <div class="center bold" style="font-size: 13px;">SHAHDARA ISP BROADBAND</div>
  <div class="center" style="font-size: 9px;">CONDUIT PULLING QA FIELD SLIP</div>
  <div class="center" style="font-size: 9px;">IEC 60794-1-21 / IEEE 1210</div>
  <div class="divider"></div>

  <div class="row"><span>Cert ID:</span><span class="bold">${record.id}</span></div>
  <div class="row"><span>Date:</span><span>${new Date(record.timestamp).toLocaleDateString()}</span></div>
  <div class="row"><span>Subscriber:</span><span class="bold">${record.subscriberName.slice(0, 18)}</span></div>
  <div class="row"><span>Length:</span><span>${record.conduitLengthM} m</span></div>
  <div class="row"><span>Bends:</span><span>90°: ${record.bendCount90} | 45°: ${record.bendCount45}</span></div>
  <div class="row"><span>Cables in Duct:</span><span>${record.cableCount}</span></div>
  <div class="row"><span>Lubricant:</span><span>${a.lubricant.name.slice(0, 16)}</span></div>

  <div class="divider"></div>
  <div class="row bold"><span>Pulling Tension:</span><span>${a.finalPullingTensionN} N</span></div>
  <div class="row"><span>Tension Limit:</span><span>${a.cableType.maxPullingLoadN} N</span></div>
  <div class="row bold"><span>SWBP Pressure:</span><span>${a.maxSwbpNm} N/m</span></div>
  <div class="row"><span>SWBP Limit:</span><span>${a.cableType.maxSwbpNm} N/m</span></div>
  <div class="row"><span>Conduit Fill:</span><span>${a.fillInfo.fillRatioPercent}% (Max ${a.fillInfo.maxAllowedPercent}%)</span></div>
  <div class="row"><span>Jam Ratio:</span><span>${a.fillInfo.jamRatio}</span></div>
  <div class="row"><span>Induced Loss:</span><span>&le; ${a.inducedLossDb} dB</span></div>

  <div class="divider"></div>
  <div class="center bold badge">${v.name.slice(0, 24)}</div>
  <div class="center" style="margin-top: 6px; font-size: 8px;">Lineman: ${record.technicianName}</div>
  <div class="center" style="margin-top: 10px;">_________________________<br>QA Inspector Signature</div>
</body>
</html>
`;
  }

  // Formal A4 Certificate
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Conduit Pulling Certificate ${record.id}</title>
<style>
  @page { size: A4 portrait; margin: 15mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; line-height: 1.5; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
  .logo { font-size: 20px; font-weight: 800; color: #0284c7; letter-spacing: -0.5px; }
  .sub-logo { font-size: 11px; color: #64748b; font-weight: 500; }
  .cert-meta { text-align: right; }
  .cert-title { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 6px; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: 700; font-size: 11px; text-transform: uppercase; }
  .badge-success { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
  .badge-warning { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
  .badge-danger { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
  .section { margin-bottom: 18px; }
  .section-title { font-size: 13px; font-weight: 700; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
  .card-label { font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; }
  .card-value { font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; color: #475569; }
  .footer { margin-top: 30px; border-top: 1px solid #cbd5e1; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">SHAHDARA BROADBAND ISP</div>
      <div class="sub-logo">Outside Plant & Customer Premises Civil Engineering QA Division</div>
    </div>
    <div class="cert-meta">
      <div style="font-size: 11px; color: #64748b;">Certificate No:</div>
      <div style="font-size: 14px; font-weight: 800; color: #0284c7;">${record.id}</div>
      <div style="font-size: 10px; color: #94a3b8;">Issued: ${new Date(record.timestamp).toLocaleString()}</div>
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
    <div>
      <div class="cert-title">Fiber Drop Cable Conduit Pulling Tension &amp; Sidewall Pressure Certification</div>
      <div style="font-size: 11px; color: #64748b;">Standards Compliance: IEC 60794-1-21 Method E1 · Telcordia GR-20-CORE · IEEE 1210 · NEC Chapter 9 Table 1</div>
    </div>
    <div>
      <span class="badge ${v.badgeClass}">${v.name}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">1. Subscriber &amp; Installation Route Metadata</div>
    <div class="grid">
      <div class="card">
        <div class="card-label">Subscriber / Demarcation Point</div>
        <div class="card-value">${record.subscriberName}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Route: ${record.routeDescription}</div>
      </div>
      <div class="card">
        <div class="card-label">Field Execution &amp; Lineman Team</div>
        <div class="card-value">${record.technicianName}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Pulling Vector: ${record.pullingDirection}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">2. Cable &amp; Conduit Specifications</div>
    <div class="grid">
      <div class="card">
        <div class="card-label">Installed Optical Cable</div>
        <div class="card-value">${a.cableType.name}</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
          OD: ${a.cableType.effectiveDiameterMm} mm | Weight: ${a.cableType.unitWeightNm} N/m | MAPL: ${a.cableType.maxPullingLoadN} N | Max SWBP: ${a.cableType.maxSwbpNm} N/m
        </div>
      </div>
      <div class="card">
        <div class="card-label">Conduit &amp; Route Topology</div>
        <div class="card-value">${a.conduitType.name}</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
          Length: ${record.conduitLengthM} m | ID: ${a.conduitType.innerDiameterMm} mm | Bends: ${record.bendCount90}x 90°, ${record.bendCount45}x 45° (R = ${record.bendRadiusMm} mm)
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">3. Dynamic Tensile Load &amp; Sidewall Pressure Metrology</div>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
      <div class="card">
        <div class="card-label">Final Pulling Tension</div>
        <div class="card-value" style="color: ${a.finalPullingTensionN > a.cableType.maxPullingLoadN ? '#dc2626' : '#0284c7'};">
          ${a.finalPullingTensionN} N
        </div>
        <div style="font-size: 10px; color: #64748b;">${a.tensionUtilizationPercent}% of MAPL (${a.cableType.maxPullingLoadN} N)</div>
      </div>
      <div class="card">
        <div class="card-label">Max SWBP at Elbows</div>
        <div class="card-value" style="color: ${a.maxSwbpNm > a.cableType.maxSwbpNm ? '#dc2626' : '#047857'};">
          ${a.maxSwbpNm} N/m
        </div>
        <div style="font-size: 10px; color: #64748b;">${a.swbpUtilizationPercent}% of Max (${a.cableType.maxSwbpNm} N/m)</div>
      </div>
      <div class="card">
        <div class="card-label">Conduit Fill Ratio</div>
        <div class="card-value" style="color: ${a.fillInfo.isFillCompliant ? '#047857' : '#dc2626'};">
          ${a.fillInfo.fillRatioPercent}%
        </div>
        <div style="font-size: 10px; color: #64748b;">NEC Limit: ${a.fillInfo.maxAllowedPercent}% | Jam Ratio: ${a.fillInfo.jamRatio}</div>
      </div>
      <div class="card">
        <div class="card-label">Estimated Attenuation Δα</div>
        <div class="card-value" style="color: ${a.inducedLossDb > 0.05 ? '#dc2626' : '#047857'};">
          &le; ${a.inducedLossDb} dB
        </div>
        <div style="font-size: 10px; color: #64748b;">Pulling Strain: ${a.estimatedStrainPercent}%</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">4. Step-by-Step Pulling Tension Profile</div>
    <table>
      <thead>
        <tr>
          <th>Conduit Segment / Station</th>
          <th>Cumulative Distance (m)</th>
          <th>Pulling Tension (N)</th>
          <th>Sidewall Bearing Pressure (N/m)</th>
          <th>Segment Status</th>
        </tr>
      </thead>
      <tbody>
        ${a.tensionProfile.map(p => `
          <tr>
            <td><strong>${p.step}</strong></td>
            <td>${p.distanceM} m</td>
            <td><strong>${p.tensionN} N</strong></td>
            <td>${p.swbpNm > 0 ? `${p.swbpNm} N/m` : '0 N/m'}</td>
            <td><span style="color: ${p.tensionN > a.cableType.maxPullingLoadN ? '#dc2626' : '#16a34a'}; font-weight: bold;">${p.tensionN > a.cableType.maxPullingLoadN ? 'OVERTENSION' : 'SAFE'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  ${record.notes ? `
  <div class="section">
    <div class="section-title">5. Field Installation Observations</div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; font-style: italic;">
      "${record.notes}"
    </div>
  </div>
  ` : ''}

  <div class="footer">
    <div>Shahdara Optical Outside Plant Engineering Division · Ravi Zone NOC Lahore</div>
    <div>Accredited Laboratory Verification · No Unauthorized Alterations Permitted</div>
  </div>
</body>
</html>
`;
}

/**
 * Generates a bilingual Urdu/English WhatsApp technician notice.
 */
export function formatConduitPullingCertWhatsApp(record) {
  const a = record.analysis;
  const v = a ? a.verdict : CONDUIT_PULLING_VERDICTS['CERTIFIED_OPTIMAL_PULL'];

  const statusEmoji = v.id === 'CERTIFIED_OPTIMAL_PULL' ? '✅' : (v.id === 'CONDITIONAL_PASS_MONITOR' ? '⚠️' : '❌');

  return `*${statusEmoji} SHAHDARA ISP CONDUIT PULLING QA CERTIFICATE*
*سرٹیفکیٹ برائے فائبر آپٹک کنڈیوٹ کھینچاو و دباؤ تصدیق*

📄 *Certificate ID:* ${record.id}
👤 *Subscriber:* ${record.subscriberName}
📍 *Route:* ${record.routeDescription}
📅 *Date:* ${new Date(record.timestamp).toLocaleDateString()}

🔍 *METROLOGICAL RESULTS (نتائج تجزیہ):*
• *Cable:* ${a.cableType.name}
• *Conduit:* ${a.conduitType.name} (${record.conduitLengthM}m)
• *Bends:* 90°: ${record.bendCount90}x | 45°: ${record.bendCount45}x
• *Pulling Tension:* *${a.finalPullingTensionN} N* (Max MAPL: ${a.cableType.maxPullingLoadN} N)
• *Sidewall Pressure (SWBP):* *${a.maxSwbpNm} N/m* (Max: ${a.cableType.maxSwbpNm} N/m)
• *Conduit Fill:* ${a.fillInfo.fillRatioPercent}% (NEC Limit: ${a.fillInfo.maxAllowedPercent}%)
• *Estimated Loss (Δα):* ≤ ${a.inducedLossDb} dB

📋 *VERDICT (حتمی فیصلہ):*
*${v.name}*
${v.description}

🔧 *Lineman / Team:* ${record.technicianName}
_Shahdara Outside Plant & Civil Engineering QA Division_`;
}

/**
 * Generates RFC-4180 compliant CSV export with UTF-8 BOM.
 */
export function generateConduitPullingCertsCsv(records = []) {
  const headers = [
    'Certificate ID',
    'Timestamp',
    'Subscriber Name',
    'Route Description',
    'Cable Type',
    'Conduit Type',
    'Conduit Length (m)',
    'Bend Count 90',
    'Bend Count 45',
    'Cable Count',
    'Lubricant Mode',
    'Pulling Direction',
    'Final Tension (N)',
    'MAPL Limit (N)',
    'Tension Ratio (%)',
    'Max SWBP (N/m)',
    'SWBP Limit (N/m)',
    'Conduit Fill (%)',
    'Jam Ratio',
    'Induced Loss (dB)',
    'Verdict',
    'Technician Name',
    'Status'
  ];

  const rows = records.map(r => {
    const a = r.analysis || {};
    const ct = a.cableType || {};
    const cond = a.conduitType || {};
    const fill = a.fillInfo || {};
    const v = a.verdict || {};

    return [
      r.id,
      r.timestamp,
      r.subscriberName,
      r.routeDescription,
      ct.name || r.cableTypeId,
      cond.name || r.conduitTypeId,
      r.conduitLengthM,
      r.bendCount90,
      r.bendCount45,
      r.cableCount,
      r.lubricantModeId,
      r.pullingDirection,
      a.finalPullingTensionN,
      ct.maxPullingLoadN,
      a.tensionUtilizationPercent,
      a.maxSwbpNm,
      ct.maxSwbpNm,
      fill.fillRatioPercent,
      fill.jamRatio,
      a.inducedLossDb,
      v.name || 'UNKNOWN',
      r.technicianName,
      r.status
    ].map(val => {
      const s = String(val == null ? '' : val).replace(/"/g, '""');
      return `"${s}"`;
    }).join(',');
  });

  return '\uFEFF' + [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
}

/**
 * Interactive UI Modal Dialog Controller for Conduit Pulling QA.
 */
export function setupConduitPullingModal(options = {}) {
  const {
    state,
    dialogElement,
    triggerButton,
    onToast
  } = options;

  if (!dialogElement) return null;

  // Form input elements
  const presetSelect = dialogElement.querySelector('#cndPresetSelect');
  const subscriberInput = dialogElement.querySelector('#cndSubscriberInput');
  const routeInput = dialogElement.querySelector('#cndRouteInput');
  const cableTypeSelect = dialogElement.querySelector('#cndCableTypeSelect');
  const conduitTypeSelect = dialogElement.querySelector('#cndConduitTypeSelect');
  const lengthInput = dialogElement.querySelector('#cndLengthInput');
  const bend90Input = dialogElement.querySelector('#cndBend90Input');
  const bend45Input = dialogElement.querySelector('#cndBend45Input');
  const bendRadiusInput = dialogElement.querySelector('#cndBendRadiusInput');
  const cableCountInput = dialogElement.querySelector('#cndCableCountInput');
  const lubricantSelect = dialogElement.querySelector('#cndLubricantSelect');
  const directionSelect = dialogElement.querySelector('#cndDirectionSelect');
  const technicianInput = dialogElement.querySelector('#cndTechnicianInput');
  const notesInput = dialogElement.querySelector('#cndNotesInput');

  // Preview elements
  const svgContainer = dialogElement.querySelector('#cndSvgContainer');
  const tensionDisplay = dialogElement.querySelector('#cndTensionDisplay');
  const swbpDisplay = dialogElement.querySelector('#cndSwbpDisplay');
  const fillDisplay = dialogElement.querySelector('#cndFillDisplay');
  const lossDisplay = dialogElement.querySelector('#cndLossDisplay');
  const verdictBanner = dialogElement.querySelector('#cndVerdictBanner');

  // Action buttons
  const saveBtn = dialogElement.querySelector('#cndSaveBtn');
  const printA4Btn = dialogElement.querySelector('#cndPrintA4Btn');
  const printPosBtn = dialogElement.querySelector('#cndPrintPosBtn');
  const whatsappBtn = dialogElement.querySelector('#cndWhatsAppBtn');
  const csvExportBtn = dialogElement.querySelector('#cndCsvExportBtn');
  const closeBtn = dialogElement.querySelector('#cndCloseBtn');
  const historyTableBody = dialogElement.querySelector('#cndHistoryTableBody');

  let currentAnalysis = null;
  let activeRecord = null;

  function getCurrentFormData() {
    return {
      subscriberName: subscriberInput ? subscriberInput.value : '',
      routeDescription: routeInput ? routeInput.value : '',
      cableTypeId: cableTypeSelect ? cableTypeSelect.value : 'FTTH_DROP_FLAT_FRP_1F',
      conduitTypeId: conduitTypeSelect ? conduitTypeSelect.value : 'PVC_CONDUIT_25MM',
      conduitLengthM: Number(lengthInput ? lengthInput.value : 20),
      bendCount90: Number(bend90Input ? bend90Input.value : 0),
      bendCount45: Number(bend45Input ? bend45Input.value : 0),
      bendRadiusMm: Number(bendRadiusInput ? bendRadiusInput.value : 150),
      cableCount: Number(cableCountInput ? cableCountInput.value : 1),
      lubricantModeId: lubricantSelect ? lubricantSelect.value : 'POLYMER_LUBRICATED',
      pullingDirection: directionSelect ? directionSelect.value : 'HORIZONTAL',
      technicianName: technicianInput ? technicianInput.value : 'Shahdara Lineman Team',
      notes: notesInput ? notesInput.value : ''
    };
  }

  function recalculate() {
    const data = getCurrentFormData();
    currentAnalysis = calculateConduitPullingTension(data);

    if (tensionDisplay) tensionDisplay.textContent = `${currentAnalysis.finalPullingTensionN} N`;
    if (swbpDisplay) swbpDisplay.textContent = `${currentAnalysis.maxSwbpNm} N/m`;
    if (fillDisplay) fillDisplay.textContent = `${currentAnalysis.fillInfo.fillRatioPercent}%`;
    if (lossDisplay) lossDisplay.textContent = `≤ ${currentAnalysis.inducedLossDb} dB`;

    if (verdictBanner) {
      const v = currentAnalysis.verdict;
      verdictBanner.className = `verdict-banner ${v.badgeClass}`;
      verdictBanner.textContent = `${v.name} - ${v.description}`;
    }

    if (svgContainer) {
      svgContainer.innerHTML = renderConduitPullingQaSvg(currentAnalysis);
    }
  }

  function loadPreset(presetId) {
    const p = SHAHDARA_CONDUIT_PRESETS.find(item => item.id === presetId);
    if (!p) return;

    if (subscriberInput) subscriberInput.value = p.subscriberName;
    if (routeInput) routeInput.value = p.routeDescription;
    if (cableTypeSelect) cableTypeSelect.value = p.cableTypeId;
    if (conduitTypeSelect) conduitTypeSelect.value = p.conduitTypeId;
    if (lengthInput) lengthInput.value = p.conduitLengthM;
    if (bend90Input) bend90Input.value = p.bendCount90;
    if (bend45Input) bend45Input.value = p.bendCount45;
    if (bendRadiusInput) bendRadiusInput.value = p.bendRadiusMm;
    if (cableCountInput) cableCountInput.value = p.cableCount;
    if (lubricantSelect) lubricantSelect.value = p.lubricantModeId;
    if (directionSelect) directionSelect.value = p.pullingDirection;
    if (notesInput) notesInput.value = p.notes;

    recalculate();
  }

  function renderHistory() {
    if (!historyTableBody) return;
    const certs = getSavedConduitPullingCerts();
    if (certs.length === 0) {
      historyTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b; padding:12px;">No saved conduit pulling certifications.</td></tr>';
      return;
    }

    historyTableBody.innerHTML = certs.map(c => {
      const v = c.analysis ? c.analysis.verdict : null;
      return `
        <tr>
          <td><strong>${c.id}</strong></td>
          <td>${new Date(c.timestamp).toLocaleDateString()}</td>
          <td>${c.subscriberName}</td>
          <td><strong>${c.analysis ? c.analysis.finalPullingTensionN : '-'} N</strong> / ${c.analysis ? c.analysis.maxSwbpNm : '-'} N/m</td>
          <td><span class="badge ${v ? v.badgeClass : 'badge-secondary'}">${v ? v.name.split(' ')[0] : 'VERIFIED'}</span></td>
          <td>
            <button type="button" class="action-link-btn" data-cnd-view="${c.id}" style="background:none; border:none; color:#0284c7; cursor:pointer; font-weight:600;">View</button>
          </td>
        </tr>
      `;
    }).join('');

    // Wire view buttons
    historyTableBody.querySelectorAll('[data-cnd-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cnd-view');
        const record = certs.find(item => item.id === id);
        if (record) {
          activeRecord = record;
          if (subscriberInput) subscriberInput.value = record.subscriberName;
          if (routeInput) routeInput.value = record.routeDescription;
          if (cableTypeSelect) cableTypeSelect.value = record.cableTypeId;
          if (conduitTypeSelect) conduitTypeSelect.value = record.conduitTypeId;
          if (lengthInput) lengthInput.value = record.conduitLengthM;
          if (bend90Input) bend90Input.value = record.bendCount90;
          if (bend45Input) bend45Input.value = record.bendCount45;
          if (bendRadiusInput) bendRadiusInput.value = record.bendRadiusMm;
          if (cableCountInput) cableCountInput.value = record.cableCount;
          if (lubricantSelect) lubricantSelect.value = record.lubricantModeId;
          if (directionSelect) directionSelect.value = record.pullingDirection;
          if (technicianInput) technicianInput.value = record.technicianName;
          if (notesInput) notesInput.value = record.notes;
          recalculate();
          if (onToast) onToast(`Loaded certificate ${record.id}`);
        }
      });
    });
  }

  // Bind input change events for live recalculation
  const inputsToListen = [
    cableTypeSelect, conduitTypeSelect, lengthInput, bend90Input,
    bend45Input, bendRadiusInput, cableCountInput, lubricantSelect, directionSelect
  ];
  inputsToListen.forEach(input => {
    if (input) {
      input.addEventListener('input', recalculate);
      input.addEventListener('change', recalculate);
    }
  });

  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      if (presetSelect.value) {
        loadPreset(presetSelect.value);
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const data = getCurrentFormData();
      const val = validateConduitPullingInput(data);
      if (!val.isValid) {
        alert('Validation errors:\n' + val.errors.join('\n'));
        return;
      }
      const record = buildConduitPullingCertRecord(data);
      saveConduitPullingCert(record);
      activeRecord = record;
      renderHistory();
      if (onToast) onToast(`Certified and saved ${record.id}`);
    });
  }

  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      const record = activeRecord || buildConduitPullingCertRecord(getCurrentFormData());
      const html = generateConduitPullingCertHtml(record, { format: 'A4' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 300);
      }
    });
  }

  if (printPosBtn) {
    printPosBtn.addEventListener('click', () => {
      const record = activeRecord || buildConduitPullingCertRecord(getCurrentFormData());
      const html = generateConduitPullingCertHtml(record, { format: 'POS80' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 300);
      }
    });
  }

  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
      const record = activeRecord || buildConduitPullingCertRecord(getCurrentFormData());
      const msg = formatConduitPullingCertWhatsApp(record);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(msg).then(() => {
          if (onToast) onToast('Copied WhatsApp dispatch notice to clipboard!');
        });
      } else {
        alert(msg);
      }
    });
  }

  if (csvExportBtn) {
    csvExportBtn.addEventListener('click', () => {
      const list = getSavedConduitPullingCerts();
      if (list.length === 0) {
        const dummy = activeRecord || buildConduitPullingCertRecord(getCurrentFormData());
        list.push(dummy);
      }
      const csv = generateConduitPullingCertsCsv(list);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conduit-pulling-certs-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (onToast) onToast('Downloaded conduit pulling certificates CSV.');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      dialogElement.close();
    });
  }

  // Initial load
  if (presetSelect && presetSelect.options.length > 0) {
    presetSelect.value = 'BARADARI_COMMERCIAL_PLAZA_RISER';
    loadPreset('BARADARI_COMMERCIAL_PLAZA_RISER');
  } else {
    recalculate();
  }
  renderHistory();

  return {
    recalculate,
    loadPreset,
    renderHistory,
    getCurrentFormData
  };
}
