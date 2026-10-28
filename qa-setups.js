/**
 * qa-setups.js — FIRST-LOAD SPLIT (2026-10-28): the QA-certification modal
 * setups + calculators that used to be re-exported from form-validation.js.
 *
 * form-validation.js statically imported all 26 qa-* modules, which put
 * ~1.09 MB of QA-certification code (chunk-3WMVHHAB.js) into the static
 * first-load graph even though QA modals live in the customer profile and
 * are opened rarely. These re-exports now live here instead, and this module
 * is reached ONLY through the dynamic import in lazy-qa.js, so esbuild
 * ships it as a lazy chunk fetched on first profile open (or first
 * interaction) — never before first paint. The service worker precaches
 * every dist file, so the lazy chunk still works 100% offline.
 *
 * Nothing is renamed or re-implemented: the blocks below are moved verbatim
 * from form-validation.js (same order, same names). app.js imports the setup
 * functions from here via loadQaSetups(); tests/forms-qa.test.js imports the
 * QA names from here; form-validation.js keeps its own validators only.
 */

export {
  ORL_CERT_STORAGE_KEY,
  ORL_CONNECTOR_POLISHES,
  ORL_END_FACE_ZONES,
  ORL_DEFECT_TYPES,
  ORL_VERDICTS,
  calculateReflectanceFromOrl,
  calculateOrlFromReflectance,
  evaluateOrlReflectance,
  generateOrlCertId,
  validateOrlCertification,
  validateOrlCertInput,
  buildOrlCertRecord,
  getSavedOrlCerts,
  saveOrlCert,
  updateOrlCertStatus,
  clearOrlCerts,
  calculateOrlCertMetrics,
  formatOrlCertWhatsApp,
  generateOrlCertHtml,
  generateOrlCertsCsv,
  renderFerruleEndfaceSvg,
  setupOrlCertModal
} from './qa-orl-reflectance.js';

export {
  DDMI_CERT_STORAGE_KEY,
  DDMI_TRANSCEIVER_TYPES,
  DDMI_STATUS_VERDICTS,
  DDMI_SEVERITY_LEVELS,
  estimateLaserRulMonths,
  checkThreshold,
  evaluateDdmiTelemetry,
  buildDdmiCertRecord,
  getSavedDdmiCerts,
  saveDdmiCert,
  updateDdmiCertStatus,
  clearDdmiCerts,
  calculateDdmiCertMetrics,
  formatDdmiCertWhatsApp,
  generateDdmiCertHtml,
  generateDdmiCertsCsv,
  renderDdmiTelemetrySvg,
  setupDdmiCertModal
} from './qa-ddmi-calibration.js';

export {
  DISPERSION_STORAGE_KEY,
  FIBER_DISPERSION_PROFILES,
  BITRATE_DISPERSION_STANDARDS,
  DISPERSION_SEVERITY_LEVELS,
  calculateChromaticDispersionCoefficient,
  evaluateLinkDispersion,
  buildDispersionCertRecord,
  saveDispersionCert,
  getSavedDispersionCerts,
  clearDispersionCerts,
  formatDispersionCertWhatsApp,
  generateDispersionCertsCsv,
  generateDispersionCertHtml,
  renderDispersionAnalysisSvg,
  setupDispersionCertModal
} from './qa-dispersion-inspection.js';

export {
  BEND_LOSS_STORAGE_KEY,
  FIBER_BEND_STANDARDS,
  WAVELENGTH_BEND_MULTIPLIERS,
  ROUTING_CHECKLIST_ITEMS,
  BEND_VERDICTS,
  calculateMacroBendLoss,
  buildBendLossCertRecord,
  validateBendLossCertInput,
  getSavedBendLossCerts,
  saveBendLossCert,
  clearBendLossCerts,
  renderBendLossAnalysisSvg,
  formatBendLossCertWhatsApp,
  generateBendLossCertHtml,
  generateBendLossCertsCsv,
  calculateRecommendedSlackLoopDimensions,
  setupBendLossCertModal
} from './qa-bend-loss-inspection.js';

export {
  BIDIRECTIONAL_OTDR_STORAGE_KEY,
  OTDR_WAVELENGTHS,
  OTDR_EVENT_TYPES,
  OTDR_ROUTE_PRESETS,
  BIDIRECTIONAL_QA_VERDICTS,
  calculateBidirectionalAveraging,
  renderBidirectionalOtdrSvg,
  buildBidirectionalOtdrCertRecord,
  getSavedBidirectionalOtdrCerts,
  saveBidirectionalOtdrCert,
  clearBidirectionalOtdrCerts,
  formatBidirectionalOtdrCertWhatsApp,
  generateBidirectionalOtdrCertHtml,
  generateBidirectionalOtdrCsv,
  setupBidirectionalOtdrModal
} from './qa-otdr-bidirectional-inspection.js';

export {
  OTDR_DEADZONE_CERT_STORAGE_KEY,
  SPEED_OF_LIGHT_VACUUM_MPS,
  STANDARD_FIBER_REFRACTIVE_INDEX,
  OTDR_PULSE_CONFIGS,
  OTDR_WAVELENGTH_METRICS,
  OTDR_SPAN_PRESETS,
  calculatePulseWidthDeadZones,
  evaluateOtdrDeadzoneCalibration,
  generateOtdrDeadzoneCertId,
  renderOtdrDeadzoneSvg,
  generateOtdrDeadzoneCertHtml,
  formatOtdrDeadzoneCertWhatsApp,
  generateOtdrDeadzoneCertsCsv,
  getSavedOtdrDeadzoneCerts,
  saveOtdrDeadzoneCert,
  clearOtdrDeadzoneCerts,
  updateOtdrDeadzoneCertStatus,
  calculateOtdrDeadzoneMetrics,
  setupOtdrDeadzoneModal
} from './qa-otdr-deadzone-cert.js';

export {
  SPLITTER_QA_STORAGE_KEY,
  SPLITTER_TYPES,
  SPLITTER_QA_PRESETS,
  calculateTheoreticalSplittingLoss,
  evaluateSplitterPorts,
  validateSplitterQaInput,
  buildSplitterQaRecord,
  renderSplitterQaAnalysisSvg,
  generateSplitterQaCertHtml,
  formatSplitterQaCertWhatsApp,
  generateSplitterQaCertsCsv,
  getSavedSplitterQaCerts,
  saveSplitterQaCert,
  updateSplitterQaCertStatus,
  clearSplitterQaCerts,
  calculateSplitterQaMetrics,
  setupSplitterQaModal
} from './qa-splitter-tolerance.js';

export {
  FERRULE_GEOMETRY_CERT_STORAGE_KEY,
  FERRULE_CONNECTOR_TYPES,
  FERRULE_GEOMETRY_PRESETS,
  evaluateFerruleGeometry,
  renderFerruleGeometryAnalysisSvg,
  buildFerruleGeometryRecord,
  generateFerruleGeometryCertHtml,
  formatFerruleGeometryCertWhatsApp,
  generateFerruleGeometryCertsCsv,
  getSavedFerruleGeometryCerts,
  saveFerruleGeometryCert,
  updateFerruleGeometryCertStatus,
  clearFerruleGeometryCerts,
  calculateFerruleGeometryMetrics,
  setupFerruleGeometryModal
} from './qa-ferrule-geometry.js';

export {
  FUSION_ARC_QA_STORAGE_KEY,
  SPLICER_MODELS,
  FIBER_TYPES,
  PROOF_TEST_STATUSES,
  QA_VERDICTS,
  FUSION_ARC_PRESETS,
  calculateElectrodeLife,
  calculateArcCompensation,
  calculateSpliceLoss,
  evaluateFusionSpliceQa,
  renderFusionArcQaAnalysisSvg,
  buildFusionArcQaRecord,
  generateFusionArcQaCertId,
  generateFusionArcQaCertHtml,
  formatFusionArcQaCertWhatsApp,
  generateFusionArcQaCertsCsv,
  getSavedFusionArcQaCerts,
  saveFusionArcQaCert,
  updateFusionArcQaCertStatus,
  clearFusionArcQaCerts,
  calculateFusionArcQaMetrics,
  setupFusionArcQaModal
} from './qa-fusion-splicer-arc.js';

export {
  STRIP_FORCE_QA_STORAGE_KEY,
  STRIPPER_TOOLS,
  FIBER_COATING_TYPES,
  STRIP_QA_VERDICTS,
  STRIP_FORCE_PRESETS,
  calculateGriffithFractureStrength,
  evaluateStripForceQa,
  renderStripForceAnalysisSvg,
  buildStripForceRecord,
  generateStripForceCertId,
  generateStripForceCertHtml,
  formatStripForceCertWhatsApp,
  generateStripForceCertsCsv,
  getSavedStripForceCerts,
  saveStripForceCert,
  updateStripForceCertStatus,
  clearStripForceCerts,
  calculateStripForceMetrics,
  setupStripForceQaModal
} from './qa-coating-strip-force.js';

export {
  SPLICE_MFD_OFFSET_STORAGE_KEY,
  FIBER_PROFILES,
  SPLICER_ALIGNMENT_TYPES,
  OPERATING_WAVELENGTHS,
  TELCORDIA_SPLICE_VERDICTS,
  SHAH_SPLICE_PRESETS,
  calculateMfdMismatchLoss,
  calculateLateralOffsetLoss,
  calculateAngularTiltLoss,
  calculateNetCoreOffset,
  determineSpliceQualityVerdict,
  evaluateSpliceLoss,
  renderSpliceMfdOffsetSvg,
  validateSpliceMfdOffset,
  buildSpliceMfdOffsetRecord,
  getSavedSpliceMfdOffsetCerts,
  saveSpliceMfdOffsetCert,
  updateSpliceMfdOffsetCertStatus,
  clearSpliceMfdOffsetCerts,
  calculateSpliceMfdOffsetMetrics,
  generateSpliceMfdOffsetCertHtml,
  formatSpliceMfdOffsetCertWhatsApp,
  generateSpliceMfdOffsetCertsCsv,
  setupSpliceMfdOffsetModal
} from './qa-splice-mfd-offset.js';

export {
  SPLICE_SLEEVE_CURE_STORAGE_KEY,
  SLEEVE_TYPES,
  HOT_MELT_ADHESIVES,
  TUBE_CONDITIONS,
  SLEEVE_QA_VERDICTS,
  SHAH_SLEEVE_PRESETS,
  calculateCureThermalEnergy,
  calculateVoidMicroBendPenalty,
  calculateAxialTensileRetention,
  evaluateSleeveCureQa,
  renderSpliceSleeveCureSvg,
  validateSpliceSleeveCure,
  buildSpliceSleeveCureRecord,
  getSavedSpliceSleeveCureCerts,
  saveSpliceSleeveCureCert,
  updateSpliceSleeveCureCertStatus,
  clearSpliceSleeveCureCerts,
  calculateSpliceSleeveCureMetrics,
  generateSpliceSleeveCureCertHtml,
  formatSpliceSleeveCureCertWhatsApp,
  generateSpliceSleeveCureCertsCsv,
  setupSpliceSleeveCureModal
} from './qa-splice-sleeve-cure.js';

export {
  FIBER_CLEAVE_QUALITY_STORAGE_KEY,
  CLEAVER_MODELS,
  SURFACE_DEFECT_TYPES,
  BLADE_HEIGHT_SETTINGS,
  CLEAVE_QA_VERDICTS,
  SHAH_CLEAVE_PRESETS,
  calculateCleaveAngleLoss,
  calculateBladeWearMetrics,
  evaluateCleaveQuality,
  renderFiberCleaveQualitySvg,
  validateFiberCleaveInput,
  buildFiberCleaveRecord,
  getSavedFiberCleaveCerts,
  saveFiberCleaveCert,
  clearFiberCleaveCerts,
  calculateFiberCleaveMetrics,
  generateFiberCleaveQualityCertHtml,
  formatFiberCleaveQualityCertWhatsApp,
  generateFiberCleaveQualityCertsCsv,
  setupFiberCleaveQualityModal
} from './qa-cleave-quality.js';

export {
  OTDR_GHOST_ARTIFACT_STORAGE_KEY,
  GHOST_OTDR_WAVELENGTHS,
  ARTIFACT_CLASSIFICATIONS,
  GHOST_QA_VERDICTS,
  SHAH_OTDR_GHOST_PRESETS,
  calculateGhostDistanceMatches,
  evaluateOtdrGhostArtifact,
  renderOtdrGhostArtifactSvg,
  validateOtdrGhostInput,
  buildOtdrGhostRecord,
  getSavedOtdrGhostCerts,
  saveOtdrGhostCert,
  clearOtdrGhostCerts,
  calculateOtdrGhostMetrics,
  generateOtdrGhostArtifactCertHtml,
  formatOtdrGhostArtifactCertWhatsApp,
  generateOtdrGhostArtifactCertsCsv,
  setupOtdrGhostArtifactModal
} from './qa-otdr-ghost-artifact.js';

export {
  RIBBON_SPLICE_QA_STORAGE_KEY,
  TIA598_RIBBON_COLORS,
  RIBBON_SPLICER_MODELS,
  RIBBON_QA_VERDICTS,
  SHAH_RIBBON_SPLICE_PRESETS,
  calculateMarcuseCoreOffsetLoss,
  calculateCleaveTiltLoss,
  calculateRibbonArcThermalLoss,
  calculateRibbonPitchSkew,
  evaluateRibbonSpliceAnalysis,
  validateRibbonSpliceInput,
  buildRibbonSpliceRecord,
  getSavedRibbonSpliceCerts,
  saveRibbonSpliceCert,
  updateRibbonSpliceCertStatus,
  clearRibbonSpliceCerts,
  calculateRibbonSpliceMetrics,
  renderRibbonSpliceQaSvg,
  generateRibbonSpliceCertHtml,
  formatRibbonSpliceCertWhatsApp,
  generateRibbonSpliceCertsCsv,
  setupRibbonSpliceQaModal
} from './qa-ribbon-splice.js';

export {
  FAST_CONNECTOR_QA_STORAGE_KEY,
  POLISH_TYPES,
  FAST_CONNECTOR_MODELS,
  INDEX_GEL_CONDITIONS,
  FAST_CONNECTOR_VERDICTS,
  SHAH_FAST_CONNECTOR_PRESETS,
  calculateFresnelReturnLoss,
  calculateMechanicalSpliceLoss,
  evaluateFastConnectorQa,
  validateFastConnectorInput,
  buildFastConnectorRecord,
  getSavedFastConnectorCerts,
  saveFastConnectorCert,
  updateFastConnectorCertStatus,
  clearFastConnectorCerts,
  calculateFastConnectorMetrics,
  renderFastConnectorQaSvg,
  generateFastConnectorCertHtml,
  formatFastConnectorCertWhatsApp,
  generateFastConnectorCertsCsv,
  setupFastConnectorQaModal
} from './qa-fast-connector.js';

export {
  ADSS_SAG_TENSION_STORAGE_KEY,
  ADSS_CABLE_TYPES,
  ADSS_ENV_CONDITIONS,
  CROSSING_CLASSES,
  ADSS_VERDICTS,
  SHAH_ADSS_PRESETS,
  calculateWindPressure,
  calculateAerodynamicWindForce,
  calculateResultantUnitLoad,
  calculateMidspanSag,
  calculateMaxCableTension,
  calculateEverydayStressPercent,
  calculateMaxWorkingTensionPercent,
  calculateAeolianFrequencyAndDampers,
  evaluateAdssSagTension,
  validateAdssSagTensionInput,
  buildAdssSagTensionRecord,
  getSavedAdssSagTensionCerts,
  saveAdssSagTensionCert,
  updateAdssSagTensionCertStatus,
  clearAdssSagTensionCerts,
  calculateAdssSagTensionMetrics,
  renderAdssSagTensionSvg,
  generateAdssSagTensionCertHtml,
  formatAdssSagTensionCertWhatsApp,
  generateAdssSagTensionCertsCsv,
  setupAdssSagTensionModal
} from './qa-adss-sag-tension.js';

export {
  ARMORED_CABLE_CRUSH_STORAGE_KEY,
  ARMOR_TYPES,
  BURIAL_ENVIRONMENTS,
  ARMORED_CABLE_VERDICTS,
  SHAH_ARMORED_PRESETS,
  calculateImpactEnergyJoules,
  calculateRadialCrushDeflection,
  calculateInducedCrushLossDb,
  evaluateBurialDepthCompliance,
  evaluateArmoredCableCrush,
  validateArmoredCableCrushInput,
  buildArmoredCableCrushRecord,
  getSavedArmoredCableCrushCerts,
  saveArmoredCableCrushCert,
  updateArmoredCableCrushCertStatus,
  clearArmoredCableCrushCerts,
  calculateArmoredCableCrushMetrics,
  renderArmoredCableCrushSvg,
  generateArmoredCableCrushCertHtml,
  formatArmoredCableCrushCertWhatsApp,
  generateArmoredCableCrushCertsCsv,
  setupArmoredCableCrushModal
} from './qa-armored-cable-crush.js';

export {
  CABLE_JETTING_STORAGE_KEY,
  JETTING_CABLE_TYPES,
  JETTING_DUCT_TYPES,
  JETTING_EQUIPMENT_TYPES,
  CABLE_JETTING_VERDICTS,
  SHAH_JETTING_PRESETS,
  calculateDuctFillRatio,
  calculateCriticalBucklingPushForce,
  calculateViscousDragForce,
  calculateCapstanCurvatureFactor,
  evaluateCableJettingPhysics,
  validateCableJettingInput,
  buildCableJettingCertRecord,
  getSavedCableJettingCerts,
  saveCableJettingCert,
  updateCableJettingCertStatus,
  clearCableJettingCerts,
  calculateCableJettingMetrics,
  renderCableJettingAnalysisSvg,
  generateCableJettingCertHtml,
  formatCableJettingCertWhatsApp,
  generateCableJettingCertsCsv,
  setupCableJettingModal
} from './qa-cable-jetting-blowing.js';

export {
  TUBE_SLITTING_STORAGE_KEY,
  TUBE_SLITTER_TOOL_TYPES,
  BUFFER_TUBE_TYPES,
  TUBE_SLITTING_VERDICTS,
  SHAH_TUBE_SLITTING_PRESETS,
  calculateTubeSlitWallPenetration,
  calculateInducedSlitLossDb,
  evaluateTubeSlittingAccess,
  validateTubeSlittingInput,
  buildTubeSlittingCertRecord,
  getSavedTubeSlittingCerts,
  saveTubeSlittingCert,
  updateTubeSlittingCertStatus,
  clearTubeSlittingCerts,
  calculateTubeSlittingMetrics,
  renderTubeSlittingAccessSvg,
  generateTubeSlittingCertHtml,
  formatTubeSlittingCertWhatsApp,
  generateTubeSlittingCertsCsv,
  setupTubeSlittingAccessModal
} from './qa-tube-slitting-access.js';

export {
  CONDUIT_PULLING_STORAGE_KEY,
  CONDUIT_PULL_CABLE_TYPES,
  CONDUIT_TYPES,
  PULLING_LUBRICANT_MODES,
  CONDUIT_PULLING_VERDICTS,
  SHAHDARA_CONDUIT_PRESETS,
  calculateConduitFillRatio,
  calculateWeightCorrectionFactor,
  calculateConduitPullingTension,
  validateConduitPullingInput,
  buildConduitPullingCertRecord,
  getSavedConduitPullingCerts,
  saveConduitPullingCert,
  updateConduitPullingCertStatus,
  clearConduitPullingCerts,
  calculateConduitPullingMetrics,
  renderConduitPullingQaSvg,
  generateConduitPullingCertHtml,
  formatConduitPullingCertWhatsApp,
  generateConduitPullingCertsCsv,
  setupConduitPullingModal
} from './qa-conduit-pulling-tension.js';

export {
  SPECTRAL_ATTENUATION_STORAGE_KEY,
  SPECTRAL_FIBER_TYPES,
  MOISTURE_INGRESS_LEVELS,
  SPECTRAL_QA_VERDICTS,
  SHAHDARA_SPECTRAL_PRESETS,
  calculateSpectralAttenuation,
  validateSpectralAttenuationInput,
  buildSpectralAttenuationCertRecord,
  getSavedSpectralAttenuationCerts,
  saveSpectralAttenuationCert,
  updateSpectralAttenuationCertStatus,
  clearSpectralAttenuationCerts,
  calculateSpectralAttenuationMetrics,
  renderSpectralAttenuationQaSvg,
  generateSpectralAttenuationCertHtml,
  formatSpectralAttenuationCertWhatsApp,
  generateSpectralAttenuationCertsCsv,
  setupSpectralAttenuationModal
} from './qa-spectral-attenuation.js';

export {
  FOSC_SEAL_CERT_STORAGE_KEY,
  FOSC_ENCLOSURE_TYPES,
  SEALING_TECHNOLOGY_TYPES,
  DEPLOYMENT_ENVIRONMENTS,
  PORT_CLAMPING_CABLE_TYPES,
  FOSC_QA_VERDICTS,
  SHAHDARA_FOSC_PRESETS,
  calculateFoscSealPhysics,
  validateFoscSealInput,
  buildFoscSealCertRecord,
  getSavedFoscSealCerts,
  saveFoscSealCert,
  updateFoscSealCertStatus,
  clearFoscSealCerts,
  calculateFoscSealMetrics,
  renderFoscSealAnalysisSvg,
  generateFoscSealCertHtml,
  formatFoscSealCertWhatsApp,
  generateFoscSealCertsCsv,
  setupFoscSealModal
} from './qa-fosc-seal-inspection.js';

export {
  FIBER_THERMAL_CYCLE_STORAGE_KEY,
  THERMAL_CYCLE_PROFILES,
  BUFFER_TUBE_POLYMERS,
  FILLING_GEL_COMPOUNDS,
  THERMAL_QA_VERDICTS,
  SHAHDARA_THERMAL_PRESETS,
  calculateThermalCyclingPhysics,
  validateThermalCyclingInput,
  buildThermalCyclingCertRecord,
  getSavedThermalCyclingCerts,
  saveThermalCyclingCert,
  updateThermalCyclingCertStatus,
  clearThermalCyclingCerts,
  calculateThermalCyclingMetrics,
  renderThermalCyclingQaSvg,
  generateThermalCyclingCertHtml,
  formatThermalCyclingCertWhatsApp,
  generateThermalCyclingCertsCsv,
  setupThermalCyclingModal
} from './qa-thermal-cycling.js';

export {
  BILLING_CORRECTNESS_STORAGE_KEY,
  AUDIT_SEVERITY,
  BILLING_STATUSES,
  AUDIT_RULE_CODES,
  SHAHDARA_BILLING_PRESETS,
  auditBillingCorrectness,
  renderBillingCorrectnessSvg,
  generateBillingAuditHtml,
  formatBillingAuditWhatsApp,
  generateBillingAuditCsv,
  saveBillingAuditRecord,
  getSavedBillingAuditRecords,
  clearBillingAuditRecords,
  setupBillingCorrectnessModal
} from './qa-billing-correctness.js';

export {
  LATE_FEE_CONFIG_KEY,
  DEFAULT_LATE_FEE_CONFIG,
  getLateFeeConfig,
  saveLateFeeConfig,
  validatePaymentDiscount,
  calculateNetBillSettlement,
  isBillOverdue,
  pakistanDateKey,
  evaluateBillLateFeeEligibility,
  findOverdueBillsWithLateFeeStatus,
  applyLateFeeToEligibleBills,
  waiveLateFeeFromBills,
  formatLateFeeNoticeWhatsApp,
  formatReceiptWithDiscountAndFeeWhatsApp,
  generateLateFeeDiscountsCsv,
  generateLateFeeAuditPrintHtml,
  renderLateFeeDiscountsSvg,
  setupLateFeeModal
} from './qa-discounts-late-fee.js';
