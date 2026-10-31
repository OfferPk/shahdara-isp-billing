import {
  INITIAL_NAMES, PAYMENT_METHODS, MONTH_LIMIT, STORAGE_KEY, readState, persistState, monthsForHistory, generateMonthlyBillsThroughCurrentMonth,
  addCustomer, deleteCustomer, archiveCustomer, unarchiveCustomer, updateCustomerProfile, saveBillMonth, addPayment, correctPayment,
  deletePayment, setPaymentWalletVerified, recordedAmount, customerPackageProfit, calculateDashboard, searchCustomers, filterCustomersByStatus, derivedBillStatus,
  listTransactions, buildMonthlyReport, effectiveBillStatus, calculatePaymentAllocations, buildPayrollSummary, addIncident, updateIncident,
  deleteIncident, countCustomerIncidentsLast30Days, exportAllPayments, exportCustomerHistory, formatPKR, createJsonBackup, previewJsonBackupMerge, PAKISTAN_TIME_ZONE, autoClosePreviousMonth, buildMonthlyClosingSnapshot,
  summarizeCustomerReceipts, summarizeCustomerTenure, applyLateFeeToBill, waiveLateFeeFromBill, recordCustomerRelocation, applyConcessionToBill, removeConcessionFromBill,
  calculateMethodCollectionTotals, findDuplicatePaymentReference, findIdentityConflicts, paymentSenderLabel,
  buildNewCustomerReport, filterNewCustomerMonths, newCustomerQuickRanges,
  autoPackageFromPayment,
  addManualBaqayaEntry, updateManualBaqayaEntry, removeManualBaqayaEntry, manualBaqayaEntriesWithRemaining
} from './core.js?v=1.11.0';
import { initDigitalPaymentsSettingsModal, getDigitalPaymentsSettings, saveDigitalPaymentsSettings, DIGITAL_PAYMENTS_SETTINGS_KEY } from './digital-payments-settings.js?v=1.11.0';
import { setupHomeTodaySection } from './home-today.js?v=1.11.0';
import {
  EXPENSE_CATEGORIES, INVENTORY_STATES, PAYROLL_RULES_EFFECTIVE_DATE, UMAIR_PER_LOGGED_WORKDAY,
  addInventoryItem, updateInventoryItem, addStockMovement, deleteStockMovement, addSaadAttendanceDay, removeSaadAttendanceDay,
  addUmairWorkday, removeUmairWorkday, inventorySummary, addExpense, updateExpense, deleteExpense, buildPhase3Analytics, buildAreaIntelligence, buildPackageRevenue, areaLabel, buildPartnerShareReport, groupAreaIntelligenceCards, buildAreaSummaryCards, canonicalMohalla, DEFAULT_MOHALLAS
} from './phase3.js?v=1.11.0';
import { LOAN_KEY, loadLoans, saveLoans, addLoanEntry, deleteLoanEntry, loanPersonSummaries, loanGrandTotals, filterLoanPersons } from './loan-ledger.js?v=1.11.0';
import { OVERHEAD_KEY, loadOverheads, saveOverheads, resolveOverheadTemplates, updateOverheadDefault, postOverhead, overheadPostingFor, bandwidthDueStatus } from './fixed-overheads.js?v=1.11.0';
import { manualServiceStatusBareLabel, manualServiceStatusLabel, profileArchiveLabel } from './profile-labels.js?v=1.11.0';
import { currentBillPresentation, contactActionTargets, buildGlobalLedgerSearch, resolveReceiptWhatsAppAction, pauseBillingSummary, vacationHoldRouterPresentation, kistSettlementPresentation, referralBillingSummary, depositSettlementPresentation, badDebtPresentation, upsellProfileHintHtml, bottleneckProfileHintHtml, prepaidUntilBadgeHtml, loyaltyBadgeHtml, commercialVipBadgeHtml, paymentHabitPresentation, speakDueButtonMarkup, gpsPinPresentation, pngReceiptButtonMarkup } from './profile-ui.js?v=1.11.0';
import { routerCredentialsOf, routerCredentialsSectionHtml, resolveWifiWhatsAppAction } from './router-credentials.js?v=1.11.0';
import { captureCurrentPosition, loadSplitterBoxPins, saveSplitterBoxPins, SPLITTER_BOX_GPS_STORAGE_KEY } from './gps-pin-helper.js';
import { REFERRAL_CREDITS_KEY, loadReferralCredits, saveReferralCredits, reconcileReferralCredits } from './referral-credits.js?v=1.11.0';
import { buildKistProgress, billKistTotal, createInstallmentPlan, settlePlanEarly } from './installment-plan.js?v=1.11.0';
import { PACKAGE_TERMS_NOTE, RECEIPT_URDU_NOTE, buildPaymentReceipt, generatePaymentReceiptHtml, generateReceiptNumber, buildDownPaymentKistReceipt, buildDownPaymentKistReceiptHtml, buildDepositSettlementReceipt, generateDepositSettlementReceiptHtml, buildReceiptPaymentReceivedMessage, buildReceiptBillNoticeMessage } from './receipt.js?v=1.11.0';
import { setupReceiptVerifyModal } from './receipt-verifier.js';
import { generateReceiptPNG, shareOrDownloadPng } from './png-receipt.js?v=1.11.0';
import { buildKhataCardModel, buildKhataCardPrintHtml, drawQrToCanvas, encodeQrMatrix, parseCustomerDeepLink, resolveDeepLinkCustomer, resolveQrBaseUrl } from './qr-card.js';
import { thermalPrinter, buildEscPosReceipt, escPosFieldsFromPaymentReceipt, isWebBluetoothAvailable } from './thermal-printer.js?v=1.0.0';
import { customerHasMonthlyFee, executeQuickCollection, compressPaymentProofImage } from './nav-quick-collect.js';
import { setupFieldMode, speakCustomerDue } from './field-mode.js?v=1.11.0';
import { BILL_PACKAGES, billPackageById, validateBillPackageSnapshot } from './package-catalog.js?v=1.11.0';
import { groupByDay, dayHeaderText, billMonthDiffers, methodSlug, pktDateKey, recordPaymentDeletion, markPaymentDeletionUndone, setupPaymentsList } from './payments-list.js?v=1.11.0';
import { buildCustomerHealthScore, buildCustomerPaymentBehavior, buildCustomerLifetimeValue } from './owner-insights.js?v=1.11.0';
import { setupOwnerCenter } from './owner-ui.js?v=1.11.0';
import {
  createLocalBackupStore, isAutomaticBackupDue, DEFAULT_BACKUP_FREQUENCY,
  calculateBackupAge, checkStoragePersistence, requestStoragePersistence,
  getStorageEstimateInfo, shareJsonBackupFile, LAST_BACKUP_TIME_KEY, STORAGE_PERSISTENCE_KEY,
  encryptBackupJson, decryptBackupJson, isEncryptedBackupPayload,
  loadKhataDoctorCache, saveKhataDoctorCache
} from './backup-store.js?v=1.11.0';
import { saveBranchGuard, ensureBranchGuard, createBranchGuardStamp, recordBranchGuardExport, recordBranchGuardApply } from './branch-guard.js?v=1.11.0';
import { parseCustomerCsvImport, applyCustomerCsvImport, generateSampleCustomerCsv, verifyAllStorageKeysRoundTrip, inspectBackupFileHeader } from './qa-backup-csv-import.js?v=1.11.0';
import { BACKUP_HEALTH_KEY, assessBackupHealth, countAllPayments, countPaymentsAfterDate, recordBackupHealthExport, shareBackupOffDevice } from './backup-health.js?v=1.11.0';
import { SAFETY_SNAPSHOT_KIND, MAX_SAFETY_SNAPSHOTS, assessSaveSize, isQuotaError, selectSafetySnapshotsToRotate, countLedgerRecords, verifyLiveLedger, rankRecoveryCandidates, createSaveFallbackStore } from './storage-safety.js?v=1.11.0';
import { findPossibleDuplicateCustomers } from './duplicate-detection.js?v=1.11.0';
import { calculateDashboardKpis, calculateCollectionVelocity, setupDashboardQuickActions, renderDashboardCharts, setupDashboardBriefingButton, setupDashboardBriefingModal, setupAreaDrilldownModal, setupCustomerHealthActions, setupChurnRiskModal, setupAreaHeatmapEvents, setupDailyClosingCard, setupKhataDoctorCard } from './dashboard.js?v=1.11.0';
import { setupNavigationDrawer, updateNavigationBadges, setupSidebarRailToggle, setupScrollToTop, setupNetworkStatusIndicator, setupKeyboardShortcuts, setupMobileActionSheet, triggerHaptic, setupPullToRefresh, setupCommandPalette, setupSwipeNavigation, setupOfflineSyncBanner, setupMobileSpeedDial, setupOfflineQueueModal, setupMobileBreadcrumbs, setupTabSliderIndicator, setupCustomerEnrollmentWizard, startOfflineQueueAutoRetryEngine, setupFieldDiagnosticsModal, setupFieldRouteSheet, setupFieldWorkOrderSheet, setupSyncConflictModal, setupOpticalSignalMapModal, setupVehicleTransferModal, setupAerialAlertsModal, setupMobileOtdrTraceModal, setupMobileGpsBreadcrumbsModal, setupMobileOpmTestingModal, setupMobileVflModal, setupMobileFusionSpliceModal, setupMobileWifiSurveyModal, setupMobileOpticalBudgetModal, setupMobileFdtAllocationModal, setupMobileOntDiagnosticsModal, setupMobileFiberProbeModal, setupMobileSplitterTreeModal, setupMobileMacroBendModal, setupMobileAttenuatorModal, setupMobileOrlModal, setupMobileCleaverModal, setupMobileOltsModal, setupMobileFiberIdentifierModal, setupMobileMpoModal, setupMobileFastConnectorModal, setupMobileOtdrLaunchModal, setupMobileBareFiberAdapterModal, setupMobileSlsToneModal, setupMobileFiberTalksetModal, setupMobileWdmSpectrumModal, setupMobileMidspanAccessModal, setupMobilePowerLoggerModal, setupMobileDropRetentionModal, setupMobileRefJumpersModal, setupMobileRibbonSeparatorModal, setupMobileMechanicalSpliceModal, setupMobileFiberMicroscopeModal, setupMobileConnectorCleaningModal, setupMobileOtdrDeadzoneModal, setupMobileTubeShavingModal, setupQuickCollectModal, setupFastCustomerSearchModal, setupMobileQuickProfileModal, setupLanguageToggle, setupPendingActionsModal, setupPwaInstallPrompt, setupPwaStatusModal, setupPwaShortcuts, createLazyModalController, deferLowPriorityInit, t } from './nav.js?v=1.11.0';

import {
  validatePakistanPhone,
  validateCustomerCnic,
  formatCnicDisplay,
  validatePositiveAmount,
  validateCustomerName,
  validateTransactionDate,
  paginateRows,
  calculateTransactionSummary,
  sortCustomerRoster,
  filterCustomersByArea,
  getUniqueCustomerAreas,
  groupAreasWithCounts,
  sortMonthlyReportRows,
  sortTransactionsList,
  renderCustomerTableRowMarkup,
  generateCustomerRosterCsv,
  renderCustomerTableEmptyMarkup,
  saveFormDraft,
  loadFormDraft,
  clearFormDraft,
  wireFormDraftAutosave,
  generateCsvContent,
  downloadCsvFile,
  generateBatchReceiptHtml,
  maskPakistanPhone,
  wirePhoneInputMask,
  formatCustomerStatement,
  formatCustomerStatementWhatsApp,
  generateCustomerStatementHtml,
  downloadCustomerStatementCsv,
  filterStatementEvents,
  statementFilterMonths,
  statementFilterMethods,
  sortStatementEvents,
  statementMonthSubtotals,
  statementAging,
  statementTrendSvg,
  statementDaysOverdue,
  formatWhatsAppUrl,
  buildPaymentReminderMessage,
  generatePaymentReminderSlipHtml,
  buildCustomerBillInvoiceData,
  generateBillInvoiceHtml,
  buildWhatsAppBillInvoiceText,
  generateStandaloneInvoiceDocument,
  downloadHtmlFile,
  reconcileCustomerLedger,
  generateLedgerAuditReport,
  generateLedgerAuditCsv,
  generateLedgerAuditPrintHtml,
  calculateDenominationTotal,
  buildDailyRegisterData,
  formatDailyRegisterWhatsAppText,
  generateDailyRegisterCsv,
  generateDailyRegisterPrintHtml,
  setupDailyRegisterModal,
  setupAdjustmentVoucherModal,
  setupServiceContractModal,
  setupDisputeClaimModal,
  setupKycComplianceModal,
  setupEquipmentRetrievalModal,
  setupSpliceInspectionModal,
  setupPlanMigrationModal,
  setupOpticalAcceptanceModal,
  setupDropSafetyInspectionModal,
  setupEthernetCertModal,
  calculatePlanMigrationProration,
  buildAdjustmentVoucherData,
  saveAdjustmentVoucher,
  generateAreaIntelligenceCsv,
  generatePackageSummaryCsv,
  generateAreaSummaryCsv,
  validateExpenseFormFields,
  buildPayrollExpensePrefill,
  validateStaffAttendanceDate,
  filterExpenseRows,
  buildExpenseCategoryTotals,
  sortExpenseRows,
  generateExpensesCsv
} from './form-validation.js?v=1.11.0';
import { normalizeCustomerSearchField, filterCustomersBySearchField, buildMohallaUserCounts } from './customer-search-filter.js?v=1.11.0';
import { BILLING_REGISTER_CSV_HEADERS, billingRegisterCsvFilename, billingRegisterCsvNote, billingRegisterCsvRows, buildBillingRegister, normalizeBillingRegisterPeriod, normalizeBillingRegisterStatus } from './billing-register.js?v=1.11.0';
// FIRST-LOAD SPLIT: getLateFeeConfig/isBillOverdue are used by renderHistory
// (synchronous), so they stay static via a direct import; all other QA names
// load lazily through qa-setups.js (see lazy-qa.js).
import { getLateFeeConfig, isBillOverdue } from './qa-discounts-late-fee.js';
import { loadQaSetups } from './lazy-qa.js';
import { setupCollectionTargetModal } from './dashboard-collection-target.js';
import { setupDuesAgingModal } from './dashboard-dues-aging.js';
import { setupTopDefaultersModal } from './dashboard-top-defaulters.js';
import { setupZoneSheetDialog } from './lineman-sheet-print.js';
import { setupExpenseVoucherDialog } from './expense-voucher-print.js';
import { setupOwnerPinGuard, guardDecision, loadOwnerPinRecord } from './owner-pin-guard.js';
import { setupAreaCollectionsModal } from './dashboard-area-collections.js';
import { setupPackageRevenueModal } from './dashboard-package-revenue.js';
import { setupPnlModal } from './dashboard-pnl.js';
import { setupMomGrowthModal } from './dashboard-mom-growth.js';
import { setupDailyClosingModal } from './dashboard-daily-closing.js';
import { SHOP_SETTLEMENTS_KEY, buildShopSummaries, loadShopSettlements, saveShopSettlements, setupShopSettlementModal } from './shop-settlement.js';
import { PARTNER_LEDGER_KEY, PARTNER_SETTLEMENTS_KEY, PARTNER_SETTINGS_KEY, buildPartnerSettlementReport, loadPartnerLedgerEntries, savePartnerLedgerEntries, cleanPartnerLedgerEntry, upsertPartnerLedgerEntry, deletePartnerLedgerEntry, loadPartnerSettlements, savePartnerSettlements, settlementForMonth, createPartnerSettlement, upsertPartnerSettlement, reopenPartnerSettlement, generatePartnerSettlementWhatsAppText, partnerSettlementWhatsAppUrl, loadPartnerSettings, savePartnerSettings, syncShopPickupDrawings, isShopPickupEntry } from './partner-settlement.js';
import { computeWaadaChipDate, setCustomerWaada, clearCustomerWaada, setupWaadaChipDialog, waadaBadgeLabel } from './waada-queue.js';
import { VOIDED_PAYMENTS_KEY, voidPayment, loadVoidPayments, saveVoidPayments, voidBadgeMarkup } from './payment-void-audit.js?v=1.11.0';
import { displayCustomerName, currentAppLanguage } from './urdu-names.js';
import { applyFifoPaymentEventToState, buildArrearsBreakdown, loadBillingCycles, setupBillingCycleModal } from './billing-cycle.js';
import { calculateInstallationCost } from './installation-cost.js?v=1.11.0';
import { AREA_OUTAGE_CUSTOMER_ID, COMPLAINTS_KEY, buildComplaintSummary, collectComplaintZones, complaintCustomerLabel, createComplaint, formatDowntimeHours, loadComplaints, pakistanDateTimeNow, pakistanMonthNow, saveComplaints, setupComplaintRegisterModal } from './complaint-register.js';
import { TICKETS_KEY, applyTicketStockBridge, billedTicketChargesPending, buildTicketSummary, buildVisitPrefillFromTicket, hasRecurringFaultWarning, loadTickets, saveTickets, setupFieldTicketsModal, ticketFaultLabel, ticketsForCustomer, unsettleTicketChargesForPayment } from './complaint-tickets.js';
import { assignTicketForComplaint, linkedTicketSummary, syncComplaintTicketLinks } from './complaint-ticket-sync.js?v=1.11.0';
import { buildCustomerDowntimeSummary, buildMonthlyDowntimeAnalytics, setupDowntimeAnalyticsModal } from './downtime-analytics.js';
import { buildConcessionSuggestion, concessionBadgeText, netDueAfterConcession } from './concession-helper.js?v=1.11.0';
import { buildMonthlyUptime, currentStatusSession, refreshLiveSessionCounters, splitMinutes, summarizeProfileAge } from './uptime-tracking.js';
import { buildSplitterOverview, createAttenuationTicket, formatRxDbm, normalizeOpticalFields, rxSignalStatus, setupSplitterMapModal } from './splitter-map.js';
import { appendSignalReading, setupAreaSignalModal, signalReadingsNewestFirst } from './signal-history.js';
import { buildMonthlyComplaintReport, setupMonthlyComplaintReportModal } from './monthly-complaint-report.js';
import { ROZNAMCHA_KEY, buildRoznamchaDay, loadRoznamchaDays, pakistanToday, saveRoznamchaDays, setupRoznamchaModal, syncRoznamchaExpenses } from './roznamcha.js';
import { INVENTORY_ITEM_IDS, INVENTORY_KEY, addMovement, computeStock, loadInventory, saveInventory, setupInventoryBookModal } from './inventory-book.js';
import { HOME_BUDGET_CATEGORIES, addHomeBudgetExpense, deleteHomeBudgetExpense, filterHomeBudget, homeBudgetCategories, homeBudgetMonths, loadHomeBudgetExpenses, pakistanDateNow, saveHomeBudgetExpenses, sortHomeBudgetEntries, summarizeHomeBudget, updateHomeBudgetExpense } from './home-budget.js?v=1.11.0';
import { FIBER_ZONES, buildOutageQueue, normalizeFeederFields, setupOutageImpactModal, summarizeFeederNetwork, traceDownstreamImpact } from './outage-impact.js';
import { SAAD_PAYMENTS_KEY, SAAD_VISITS_KEY, buildMonthlySaadSummary, formatHours, visitHours, loadSaadPayments, loadSaadVisits, saveSaadPayments, saveSaadVisits, setupSaadVisitsModal, syncSaadPaymentLedgers, visitTypeLabel, visitWhereLabel } from './saad-visits.js';
import { INSTALL_REQUESTS_KEY, buildMonthlyInstallSummary, installTrackerToday, loadInstallRequests, saveInstallRequests, setupInstallTrackerModal } from './install-tracker.js';
import { PENDING_WORKS_KEY, countActiveCustomers, loadPendingWorks, pendingWorksSummary, savePendingWorks, setupPendingWorksModal } from './pending-works.js';
import { renderRelocationTimeline, setupRelocationModal } from './relocation-log.js';
import { buildCheatSheet, cheatSheetText, normalizePoleFields, poleDirectorySummary, setupPoleLandmarkModal } from './pole-landmark-book.js';import { buildCustomerMikrotikSnippet } from './mikrotik-generator.js';
import { GROUP_BILLING_KEY, billingGroupsSummary, buildGroupDue, buildGroupReceipt, collectGroupFull, collectGroupPartial, loadBillingGroups, saveBillingGroups, setupGroupBillingModal } from './group-billing.js';
import { SUSPENSE_PAYMENTS_KEY, buildSuspenseReceipt, claimSuspensePayment, loadSuspensePayments, saveSuspensePayments, setupSuspensePaymentsModal, suspenseSummary } from './suspense-payments.js';
import { COMMISSION_RULES_KEY, loadCommissionRules, saveCommissionRules, setupCommissionModal } from './collector-commission.js';
import { FIELD_TOOLS_KEY, fieldToolsSummary, loadFieldTools, saveFieldTools, setupToolCustodyModal } from './tool-custody-register.js';
import { SPLICE_CLOSURES_KEY, loadSpliceClosures, saveSpliceClosures, setupSpliceClosureModal } from './fiber-splice-closure.js';
import { setupQrScannerModal } from './qr-scanner.js';
import './bulk-customer-import.js'; // SISP-53: self-wiring Excel/CSV import wizard (dialog lives in index.html).
import { applyDefaultCustomerRoster } from './default-customers.js';
import { buildMonthlyScorecard, setupLinemanScorecardModal } from './lineman-scorecard.js';
import { buildRecentPayments } from './recent-payments.js';
import { buildAdvanceDashboard } from './advance-dashboard.js';
import { buildCollectionForecast } from './collection-forecaster.js';
import { buildDailyPartnerDigest, dailyPartnerDigestWhatsAppUrl } from './daily-partner-digest.js';
import { setupMultiMonthMatrix } from './multi-month-comparison.js';
import { buildUpsellCandidates, buildUpsellSummary, upsellCandidateForCustomer } from './upsell-optimizer.js';
import { buildAtRiskLoyalCustomers, buildLoyaltySummary } from './loyalty-retention.js';
import { buildRevenueLeakAudit, buildRevenueLeakSummary } from './revenue-leak-detector.js';
import { setupBulkTariffDialog } from './bulk-tariff-updater.js';
import { buildBottleneckSuspects, buildBottleneckSummary, bottleneckForCustomer } from './hardware-speed-audit.js';
import { buildFieldDispatchBoard, DISPATCH_ITEM_TYPES, UNASSIGNED_ZONE_KEY } from './field-dispatch-board.js';
import { advanceBalanceCents, normalPaymentBlockReason, recordAdvancePayment, advanceTargetMonthOptions, defaultAdvanceTargetMonth, advancePaymentTargetMonth } from './advance-payment.js';
import { recordPrepay, prepayQuote, PREPAY_MONTH_OPTIONS } from './advance-prepay.js';
import { sameNameBadgeHtml } from './name-disambiguator.js';
import { buildSmsReceiptUrl, buildSmsReminderUrl, customerPrefersSms } from './sms-fallback.js';
import { receiptChannelPreference } from './receipt-preferences.js';
import { BAD_DEBTS_KEY, activeBadDebtFor, badDebtSummary, loadBadDebts, restoreBadDebt, saveBadDebts, writeOffBadDebt } from './bad-debt-ledger.js';
import { manualBaqayaCardBadgeMarkup, manualBaqayaStatMarkup, manualBaqayaSectionMarkup } from './manual-baqaya.js';
import { UPS_NODES_KEY, activeOutages, checkUpsNodeDepletions, formatClockTime, loadUpsNodes, powerBackupSummary, saveUpsNodes, setupPowerBackupModal } from './power-backup-monitor.js';
import { CUSTODY_OWNERSHIP_OPTIONS, custodyOwnershipLabel, disconnectionChecklist, isDisconnected, markAllHardwareRecovered, markHardwareRecovered, normalizeCustodyFields, pendingHardwareRecovery, recoveryStockMovements, applyDepositSettlement } from './hardware-custody.js';
import { buildOwnerKhataReport, setupOwnerKhataModal } from './owner-khata.js';
import { MONTHLY_CLOSING_NOTES_KEY, loadMonthlyClosingNotes, saveMonthlyClosingNotes } from './monthly-closing-notes.js';import { setupWorklistsModal, calculateDisconnectReconnectWorklists } from './dashboard-worklists.js';
import { buildWalletReconciliation, walletVerificationLabel, walletReconciliationSummaryText, DIGITAL_BREAKDOWN_METHODS } from './wallet-reconciliation.js';import { setupStaffPerformanceModal } from './dashboard-staff-performance.js';
import { setupDataIntegrityModal } from './qa-data-integrity.js';
import {
  getTodayDateString,
  getReminderStagesSettings,
  saveReminderStagesSettings,
  resetReminderStagesSettings,
  getMatchingReminderStage,
  getRemindersTodayQueue,
  updateRemindersQueueNavBadge,
  recordReminderDispatched,
  getCustomerReminderHistory,
  getCustomerOutstandingDues,
  getPromiseToPayFollowupList,
  formatPromiseFollowupWhatsApp,
  recordCustomerPromise,
  markPromiseFulfilled,
  cancelPromise,
  reschedulePromise,
  getCollectionPromises,
  formatDisplayDate,
  buildCampaignQueue,
  markCustomerLastReminded
} from './reminder-queue.js?v=1.11.0';
import { WA_TEMPLATES_STORAGE_KEY, WA_TEMPLATE_LABELS, WA_TEMPLATE_DESCRIPTIONS, WA_PLACEHOLDER_KEYS, getWaTemplates, getStoredWaTemplates, saveWaTemplates, updateWaTemplate, renderWaTemplateFor, renderCustomWaTemplate } from './whatsapp-templates.js?v=1.11.0';

// SISP-19 wiring into the SISP-18 stock book: when hardware is marked
// recovered, the device comes BACK into stock. This runs AFTER the
// recovery record is saved (both call sites persist first), so a stock
// failure can never lose a recovery — failures only produce a warning
// toast naming the outcome, and the recovery itself stays saved.
function recordRecoveryStock(beforeCustomer, updatedCustomer) {
  const movements = recoveryStockMovements(beforeCustomer, updatedCustomer);
  if (movements.length === 0) return;
  let stored = loadInventory();
  const failed = [];
  for (const movement of movements) {
    try { stored = addMovement(stored, movement); }
    catch (err) { failed.push(movement.itemId); }
  }
  let saved = true;
  try { saveInventory(stored); } catch { saved = false; }
  if (failed.length > 0 || !saved) toast('Hardware recovered, but the stock book could not be updated — check Stock Book.');
}

// SISP-42 wiring into the SISP-18 stock book: the stock deductions staged
// on SISP-12 tickets are consumed LIVE. Resolving a ticket logs its Stock
// Out movements; reopening a ticket whose stock already went out returns
// it as Stock In, so a re-resolve can never deduct the same stock twice.
// The pass runs after every ticket change, once at startup, and after
// stock-book edits. It NEVER blocks or undoes a resolution: when the book
// refuses a deduction (not enough stock), the ticket stays resolved with
// its deduction pending, the operator is warned, and the deduction
// retries automatically on the next pass.
function recordTicketStockBridge() {
  const tickets = loadTickets();
  const hasWork = tickets.some((ticket) => (ticket.status === 'Resolved' && !ticket.stockDeducted && ticket.stockDeductions.length > 0)
    || (ticket.status !== 'Resolved' && ticket.stockDeducted));
  if (!hasWork) return;
  let result;
  try {
    result = applyTicketStockBridge(tickets, loadInventory(), addMovement);
  } catch { return; }
  if (!result.deducted.length && !result.reversed.length && !result.failures.length) return;
  // Ticket records persist first (mirroring recordRecoveryStock: the
  // primary record is never lost to a stock-book failure). If the ticket
  // save itself fails, the computed movements are discarded with it, so
  // the deduction simply stays pending and retries on the next pass.
  try { saveTickets(result.tickets); } catch { toast(t('ticket_stock_save_failed_toast')); return; }
  let saved = true;
  try { saved = saveInventory(result.movements) !== false; } catch { saved = false; }
  if (result.failures.length) {
    const first = result.failures[0];
    toast(t('ticket_stock_pending_toast', null, { id: first.id, reason: first.message }));
  } else if (!saved) {
    toast(t('ticket_stock_save_failed_toast'));
  }
}

// SISP-57 wiring: execute an installation completion plan built by
// install-tracker.js (buildInstallCompletionPlan). LINK mode updates the
// request's already-linked customer with only the connection fields the
// operator entered (plus connectionDate when unset and an Active status
// — the connection is now live); CREATE mode adds a new active customer
// from the request via core addCustomer (its duplicate-name guard is
// the operator's cue to link instead). Stock Out movements go through
// inventory-book addMovement ONLY, after the customer state is saved —
// the plan was built against the live stock, so a deduction the book
// would refuse was already diverted to the plan's warnings; if
// addMovement still throws, the whole completion fails and the request
// stays pending (the modal stamps it only on success). An
// already-completed plan returns its customer untouched: no second
// customer, no second deduction.
function completeInstallRequest(plan) {
  if (plan.alreadyCompleted) {
    const existing = state.customers.find((c) => c.id === plan.customerId);
    if (!existing) throw new Error('The completed customer is no longer in the list.');
    return { customer: { id: existing.id, name: existing.name, customerNumber: existing.customerNumber } };
  }
  const referenceDate = new Date(`${plan.installDate}T12:00:00+05:00`);
  let customer;
  if (plan.mode === 'link') {
    const existing = state.customers.find((c) => c.id === plan.customerId);
    if (!existing) throw new Error('The linked customer is no longer in the list — edit the request to fix the link before completing it.');
    const fields = { ...plan.customerFields };
    if (!existing.connectionDate) fields.connectionDate = plan.installDate;
    if (existing.serviceStatus !== 'active') fields.serviceStatus = 'active';
    state = updateCustomerProfile(state, existing.id, fields, referenceDate);
    customer = state.customers.find((c) => c.id === existing.id);
  } else {
    const nc = plan.newCustomer || {};
    const beforeIds = new Set(state.customers.map((c) => c.id));
    state = addCustomer(state, nc.name, referenceDate, {
      phone: nc.phone || '',
      connectionFee: nc.connectionFee,
      routerModel: nc.routerModel || '',
      routerPrice: nc.routerPrice,
      fiberMeters: nc.fiberMeters,
      serviceStatus: 'active'
    });
    customer = state.customers.find((c) => !beforeIds.has(c.id));
    if (!customer) throw new Error('Customer could not be created.');
    state = updateCustomerProfile(state, customer.id, { connectionDate: plan.installDate }, referenceDate);
    customer = state.customers.find((c) => c.id === customer.id);
  }
  let movements = loadInventory();
  for (const deduction of plan.deductions) movements = addMovement(movements, deduction);
  save();
  if (plan.deductions.length) saveInventory(movements);
  return { customer: { id: customer.id, name: customer.name, customerNumber: customer.customerNumber } };
}

// SISP-44 wiring: one complaint↔ticket reconcile pass after every
// complaint or ticket change (and once at startup). Resolving a ticket
// resolves its linked register complaint (downtime + note sync);
// resolving a complaint resolves its linked ticket; a reopen on either
// side undoes only a synced resolution on the other. The pass is
// convergent — running it on already-synced ledgers changes nothing —
// so it can sit safely inside both change callbacks. The trigger names
// the side that just changed, so a deliberate reopen is never undone
// by its own pass (see the sync module's CAUSALITY note). It runs
// BEFORE the stock bridge so a sync that reopens a deducted ticket is
// reversed by the same change cycle.
function recordComplaintTicketSync(trigger) {
  let result;
  try {
    result = syncComplaintTicketLinks(loadComplaints(), loadTickets(), { trigger });
  } catch { return; }
  if (!result.changedComplaints && !result.changedTickets) return;
  if (result.changedComplaints) {
    try { saveComplaints(result.complaints); } catch { /* next pass retries */ }
  }
  if (result.changedTickets) {
    try { saveTickets(result.tickets); } catch { /* next pass retries */ }
  }
}

// SISP-45 wiring: mirror roznamcha petty-cash outflows into the main
// Expenses ledger so monthly P&L (dashboard-pnl.js) and the Nasir/Aqib
// 50% partner shares deduct field spending. The pass is a convergent
// reconcile (roznamcha.js syncRoznamchaExpenses): every outflow lands
// as exactly one expense deduplicated by roznamchaEntryId, a deleted
// outflow's mirror is removed, and re-running it changes nothing — so
// it can run at startup, after every roznamcha change, and after a
// backup restore without ever double-counting. The roznamcha stays the
// source of truth; the Expenses screen shows synced rows with a
// Roznamcha badge and no edit/delete buttons.
function recordRoznamchaExpenseSync() {
  let result;
  try {
    result = syncRoznamchaExpenses(state.expenses ?? [], loadRoznamchaDays());
  } catch { return; }
  if (!result.changed) return;
  state = { ...state, expenses: result.expenses };
  if (storageAvailable) { try { persistState(state, localStorage); } catch { /* next pass retries */ } }
}

// SISP-56 wiring: mirror recorded Saad salary/commission payouts into
// the main Expenses ledger (saad-visits.js syncSaadPaymentLedgers) so
// monthly P&L and the Nasir/Aqib 50% partner shares deduct what Saad
// was actually paid, and mirror drawer-paid payouts into the Daily
// Roznamcha as exactly one outflow each. The pass is a convergent
// reconcile in the SISP-45 shape — the payment list is the source of
// truth, re-running it changes nothing, and syncRoznamchaExpenses
// skips the Saad-owned outflows — so it can run at startup, after
// every Saad-log or roznamcha change, and after a backup restore
// without ever double-counting. The Expenses screen shows the synced
// rows with a Saad Visit Log badge and no edit/delete buttons.
function recordSaadPaymentSync() {
  let result;
  try {
    result = syncSaadPaymentLedgers(state.expenses ?? [], loadRoznamchaDays(), loadSaadPayments());
  } catch { return; }
  if (result.daysChanged) {
    try { saveRoznamchaDays(result.days); } catch { /* next pass retries */ }
  }
  if (!result.expensesChanged) return;
  state = { ...state, expenses: result.expenses };
  if (storageAvailable) { try { persistState(state, localStorage); } catch { /* next pass retries */ } }
}

// SISP-68 wiring: mirror shop handovers a partner kept (SISP-1
// settlements stamped receivedInto) into the SISP-22 partner ledger as
// linked drawings (partner-settlement.js syncShopPickupDrawings). The
// pass is a convergent reconcile keyed by the settlement id — the
// settlement records are the source of truth and re-running it changes
// nothing — so it runs at startup, in the shop settlement modal itself,
// and after a backup restore without ever double-recording a pickup.
function recordShopPickupDrawingSync() {
  let result;
  try {
    result = syncShopPickupDrawings(loadPartnerLedgerEntries(), loadShopSettlements());
  } catch { return; }
  if (!result.changed) return;
  try { savePartnerLedgerEntries(result.entries); } catch { /* next pass retries */ }
}

const $ = selector => document.querySelector(selector);
const appShell = $('.app-shell');
const customerList = $('#customerList');
const historyContainer = $('#historyContainer');
const transactionList = $('#transactionsList');
const reportList = $('#monthlyReportList');
let storageAvailable = true;
let persistenceBlocked = false;
let readFailureMessage = '';
let quotaWarningShown = false;
let pendingFallbackRecord = null;
export let collectionTargetController = null;
export let duesAgingController = null;
export let topDefaultersModalController = null;
export let zoneSheetDialogController = null;
export let expenseVoucherDialogController = null;
export let bulkTariffDialogController = null;
export let ownerPinGuardController = null;
export let multiMonthMatrixController = null;
export let areaCollectionsModalController = null;
export let packageRevenueModalController = null;
export let pnlModalController = null;
export let momGrowthModalController = null;
export let dailyClosingModalController = null;
export let shopSettlementModalController = null;
export let billingCycleModalController = null;
export let complaintRegisterModalController = null;
export let fieldTicketsModalController = null;
export let downtimeAnalyticsModalController = null;
export let splitterMapModalController = null;
export let areaSignalModalController = null;
export let monthlyComplaintReportModalController = null;
export let roznamchaModalController = null;
export let inventoryBookModalController = null;
export let outageImpactModalController = null;
export let saadVisitsModalController = null;
export let installTrackerModalController = null;
export let pendingWorksModalController = null;
export let relocationModalController = null;
export let poleLandmarkModalController = null;export let ownerKhataModalController = null;export let walletLedgerModalController = null;
export let groupBillingModalController = null;
export let suspensePaymentsModalController = null;
export let commissionModalController = null;
export let toolCustodyModalController = null;
export let spliceClosureModalController = null;
export let powerBackupModalController = null;
export let qrScannerModalController = null;
export let receiptVerifyModalController = null;
export let linemanScorecardModalController = null;
export let lateFeeModalController = null;export let worklistsModalController = null;
export let staffPerformanceModalController = null;
let state;
try {
  state = readState(localStorage);
} catch (error) {
  storageAvailable = false;
  persistenceBlocked = true;
  readFailureMessage = error?.message ?? 'Saved data could not be read.';
  state = {
    version:1,
    nextCustomerNumber:INITIAL_NAMES.length + 1,
    customers:INITIAL_NAMES.map((name, index) => ({ id:`seed-${String(index + 1).padStart(3, '0')}`, customerNumber:index + 1, name, mohalla:'', zone:'', address:'', phone:'', ispProvider:'', serviceStatus:'not-set', serviceStatusHistory:[], packageSpeed:'', monthlyPurchaseCost:null, monthlySellingAmount:null, monthlyPriceSchedule:[], billingStartMonth:null, connectionDate:null, expiryDate:null, cancellationDate:null, packageHistory:[], relocationLog:[], archived:false, archivedAt:null, bills:[], incidents:[] })), inventoryItems:[], inventoryMovements:[], expenses:[],saadAttendanceDays:[],umairWorkdays:[]
  };
}
state = generateMonthlyBillsThroughCurrentMonth(state, new Date());
if (!persistenceBlocked) state = autoClosePreviousMonth(state, new Date());
// Owner default roster (2026-10-29): ALEX's written customer list is
// imported once by default (settings marker + idempotent planner in
// default-customers.js) — blank records only; packages and mobile
// numbers are added by the admin later.
if (!persistenceBlocked) state = applyDefaultCustomerRoster(state, new Date());
if (storageAvailable) { try { persistState(state, localStorage); } catch { storageAvailable = false; } }
let selectedCustomerId = null;
let navDrawer = null;
let mobileBreadcrumbs = null;
let tabSlider = null;
let customerEnrollmentWizard = null;
let mobileActionSheetController = null;
let profileEditMode = false;
let selectedProfileTab = 'billing';
// SISP-94: router-vault eye-toggle state — session-only, never persisted;
// it resets whenever a different customer's profile is rendered, so a
// revealed password is never left showing on the next profile.
let routerCredRevealed = { wifi: false, admin: false };
let routerCredRevealedFor = null;
let selectedReportFilter = 'all';
let selectedServiceFilter = 'all';
let selectedBillingFilter = 'all';
let selectedBillingMonth = monthsForHistory()[0];
let billingRegisterPeriod = 'this';
let billingRegisterStatus = 'paid';
// New-customers panel state (customer ledger): a quick view or one chosen month.
let newCustomersView = 'thisMonth';
let newCustomersMonth = '';
let selectedPayrollMonth = monthsForHistory()[0];
let pendingBackupPreview = null;
let pendingBackupSourceText = '';
let toastTimer;
let refreshOwnerCenter = () => {};
let customerDraftController = null;
let expenseDraftController = null;
const localBackupStore = createLocalBackupStore();
const saveFallbackStore = createSaveFallbackStore();
let automaticBackupInFlight = null;
let lastAutomaticBackupCheckAt = 0;
let backupOperationBusy = false;
let storagePersistenceInfo = { supported: false, persisted: false, status: 'unsupported' };
let storageEstimateInfo = { supported: false, usageFormatted: 'Not available', quotaFormatted: 'Not available', percentUsed: null };
let persistenceAutoRequested = false;

async function requestPersistenceOnFirstWrite() {
  if (persistenceAutoRequested) return;
  persistenceAutoRequested = true;
  try {
    const res = await requestStoragePersistence();
    storagePersistenceInfo = res;
    updateDataSafetyUi();
  } catch { /* best effort */ }
}

async function refreshStorageSafetyInfo() {
  try {
    const [persistence, estimate] = await Promise.all([
      checkStoragePersistence(),
      getStorageEstimateInfo()
    ]);
    storagePersistenceInfo = persistence;
    storageEstimateInfo = estimate;
    updateDataSafetyUi();
  } catch { /* best effort */ }
}

function getLatestBackupTimestamp(status = null) {
  let localTime = null;
  try { localTime = localStorage.getItem(LAST_BACKUP_TIME_KEY); } catch { /* ignore */ }
  const storeTime = status?.lastSuccessfulAt;
  if (!localTime) return storeTime;
  if (!storeTime) return localTime;
  return new Date(localTime) > new Date(storeTime) ? localTime : storeTime;
}

// SISP-10: off-device export record. Local IndexedDB snapshots deliberately
// do NOT call this — a browser cache clear wipes them too, so only a copy
// that left the device (JSON download / share / encrypted export / sync-code
// copy) resets the health badge.
function recordOffDeviceBackupExport() {
  // SISP-52: the health record write lives in backup-health.js so every
  // export path (download, share, encrypted, sync code) stamps the exact
  // same record shape the share flow pins in tests.
  const record = recordBackupHealthExport(localStorage, state, new Date());
  const nowIso = record?.lastExportAt ?? new Date().toISOString();
  try { localStorage.setItem(LAST_BACKUP_TIME_KEY, nowIso); } catch { /* ignore */ }
}

function readBackupHealthRecord() {
  try {
    const raw = localStorage.getItem(BACKUP_HEALTH_KEY);
    if (raw) {
      const record = JSON.parse(raw);
      if (record && typeof record.lastExportAt === 'string') return record;
    }
  } catch { /* ignore */ }
  // Migration: ledgers that exported before the health record existed fall
  // back to the legacy timestamp with a date-based payment count.
  try {
    const legacy = localStorage.getItem(LAST_BACKUP_TIME_KEY);
    if (legacy) return { lastExportAt: legacy, paymentCountAtExport: null };
  } catch { /* ignore */ }
  return { lastExportAt: null, paymentCountAtExport: null };
}

// SISP-10 top-bar badge. Refreshed from updateDataSafetyUi, which already
// runs on load, on dashboard renders, and after every export.
function renderBackupHealthBadge() {
  const badge = $('#backupHealthBadge');
  if (!badge) return;
  const record = readBackupHealthRecord();
  let paymentsSinceExport = null;
  if (Number.isSafeInteger(record.paymentCountAtExport)) {
    paymentsSinceExport = Math.max(0, countAllPayments(state) - record.paymentCountAtExport);
  } else if (record.lastExportAt) {
    paymentsSinceExport = countPaymentsAfterDate(state, record.lastExportAt.slice(0, 10));
  }
  const health = assessBackupHealth({ lastExportAt: record.lastExportAt, paymentsSinceExport, now: new Date() });
  const emojiEl = $('#backupHealthEmoji');
  const labelEl = $('#backupHealthLabel');
  if (emojiEl) emojiEl.textContent = health.emoji;
  if (labelEl) labelEl.textContent = health.label;
  badge.className = `backup-health-badge health-${health.status}${health.pulse ? ' is-critical' : ''}`;
  badge.title = `${health.title} Tap to download a JSON backup.`;
  badge.setAttribute('aria-label', `${health.label}. ${health.title} Tap to download a JSON backup.`);
}

$('#backupHealthBadge')?.addEventListener('click', () => {
  // Spec: tapping the badge triggers a 1-click JSON backup download.
  $('#downloadJsonBackupButton')?.click();
});

function updateDataSafetyUi(status = null) {
  const latestBackupAt = getLatestBackupTimestamp(status);
  const age = calculateBackupAge(latestBackupAt, new Date());

  const bannerBackupBadge = $('#dataSafetyBackupBadge');
  if (bannerBackupBadge) {
    bannerBackupBadge.textContent = `Backup: ${age.shortLabel}`;
    bannerBackupBadge.className = `safety-badge badge-${age.level}`;
    bannerBackupBadge.title = age.statusText;
  }
  const bannerPersistenceBadge = $('#dataSafetyPersistenceBadge');
  if (bannerPersistenceBadge) {
    const pText = storagePersistenceInfo.persisted ? 'Protected' : 'Best-Effort';
    bannerPersistenceBadge.textContent = `Storage: ${pText}`;
    bannerPersistenceBadge.className = `safety-badge ${storagePersistenceInfo.persisted ? 'badge-healthy' : 'badge-neutral'}`;
    bannerPersistenceBadge.title = storageEstimateInfo.supported ? `Browser storage eviction protection status · ${storageEstimateInfo.usageFormatted} of ${storageEstimateInfo.quotaFormatted} (${storageEstimateInfo.percentUsed}% used)` : 'Browser storage eviction protection status';
  }

  const footerPersist = $('#backupStoragePersistence');
  if (footerPersist) {
    footerPersist.textContent = storagePersistenceInfo.persisted
      ? 'Protected (Persistent · immune to browser eviction)'
      : 'Best-effort (Not protected · browser may evict under storage pressure)';
  }
  const footerQuota = $('#backupStorageQuota');
  if (footerQuota) {
    footerQuota.textContent = storageEstimateInfo.supported
      ? `${storageEstimateInfo.usageFormatted} of ${storageEstimateInfo.quotaFormatted} (${storageEstimateInfo.percentUsed}% used)`
      : 'Storage quota API not supported in this browser';
  }
  renderBackupHealthBadge();
}

const zonedDateTimeParts = date => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone:PAKISTAN_TIME_ZONE, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type,part.value]));
const localDate = (date = new Date()) => { const p=zonedDateTimeParts(date); return `${p.year}-${p.month}-${p.day}`; };
const localDateTime = (date = new Date()) => { const p=zonedDateTimeParts(date); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const monthName = month => new Intl.DateTimeFormat(undefined, { month:'long', year:'numeric', timeZone:'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
const humanDate = date => new Intl.DateTimeFormat(undefined, { dateStyle:'medium', timeZone:PAKISTAN_TIME_ZONE }).format(new Date(`${date}T00:00:00Z`));
const humanLocalDateTime = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle:'medium', timeStyle:'short', timeZone:PAKISTAN_TIME_ZONE }).format(new Date(`${value}:00+05:00`)) : 'Not restored';
const selectedCustomer = () => state.customers.find(customer => customer.id === selectedCustomerId);
const formatAmount = formatPKR;
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
function paidByFieldMarkup(inputId, value = '') {
  const id = escapeHtml(inputId);
  return `<label class="field-label full" for="${id}">${t('prof_paid_by_label')}</label><input id="${id}" class="full" name="paidBy" type="text" maxlength="100" autocomplete="off" placeholder="${t('prof_paid_by_ph')}" value="${escapeHtml(value)}">`;
}
function paymentPayerMarkup(payment) {
  const paidBy = String(payment?.paidBy ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, 100);
  return paidBy ? ` · Paid by: ${escapeHtml(paidBy)}` : '';
}
// Phase 3 profile-local mirrors of the Transactions-shared helpers above:
// same markup, Urdu labels. The originals are untouched so Transactions
// keeps its English until its own phase.
function profilePaymentPayerMarkup(payment) {
  const paidBy = String(payment?.paidBy ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, 100);
  return paidBy ? ` · ${escapeHtml(t('prof_hist_paid_by', null, { name: paidBy }))}` : '';
}
// SISP-63: sender proof metadata on the payment row — who sent a
// digital payment and the last 4 digits it came from, next to the
// payer line. Empty for every payment without sender metadata.
function profilePaymentSenderMarkup(payment) {
  const label = paymentSenderLabel(payment);
  return label ? ` · ${escapeHtml(t('spay_sender_row', null, { label }))}` : '';
}
function profileVoidBadgeMarkup(payment) {
  if (!payment || typeof payment !== 'object' || payment.voided !== true) return '';
  const reason = typeof payment.voidReason === 'string' && payment.voidReason.trim() ? payment.voidReason.trim() : t('prof_hist_void_no_reason');
  return `<span class="void-badge">${t('prof_hist_void_badge')}</span><span class="payment-meta">${escapeHtml(t('prof_hist_voided', null, { reason }))}</span>`;
}
// Payment proof: a payment saved with a proof screenshot gets a small
// thumbnail button on its row (profile history AND Transactions share
// this markup); tapping it opens the read-only proof viewer dialog
// (paymentProofDialog in index.html). Voided payments keep the button —
// the proof is part of the SISP-34 audit trail.
function paymentProofButtonMarkup(customerId, month, payment) {
  if (!payment || typeof payment.screenshot !== 'string' || !payment.screenshot.startsWith('data:image/')) return '';
  return `<button class="proof-thumb-button" type="button" data-view-proof data-customer-id="${escapeHtml(customerId)}" data-month="${escapeHtml(month)}" data-payment-id="${escapeHtml(payment.id)}" aria-label="${t('proof_view')}"><img class="payment-proof-thumb" src="${escapeHtml(payment.screenshot)}" alt="" loading="lazy"></button>`;
}

const profileTabMap = {
  billing:['profileTabBilling','profilePanelBilling'],
  info:['profileTabInfo','profilePanelInfo'],
  complaints:['profileTabComplaints','profilePanelComplaints']
};
function mountCustomerProfileContent() {
  const mounts = $('#profileContentMounts');
  if (!mounts) return;
  const groups = {
    billing:['#customerReceiptSummary','#manualBaqayaSection','.ledger-heading','.history-retention-note','#customerEmptyNote','#historyContainer'],
    info:['.customer-meta','.package-history-section','.uptime-section'],
    complaints:['.incident-section:not(.uptime-section)']
  };
  for (const [name, selectors] of Object.entries(groups)) {
    const panel = $(`#${profileTabMap[name][1]}`);
    for (const selector of selectors) {
      const element = mounts.querySelector(selector);
      if (element) panel.append(element);
    }
  }
  mounts.remove();
}
function activateProfileTab(name, focus = false) {
  if (!profileTabMap[name]) return;
  selectedProfileTab = name;
  for (const [tabName, [tabId,panelId]] of Object.entries(profileTabMap)) {
    const active = tabName === name;
    const tab = $(`#${tabId}`);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
    tab.tabIndex = active ? 0 : -1;
    $(`#${panelId}`).hidden = !active;
  }
  if (focus) $(`#${profileTabMap[name][0]}`).focus();
}
mountCustomerProfileContent();

function toast(message, options = {}) {
  // ui-feedback.js: typed, stacked toasts with icon/title/progress (falls back to the #220 toast below).
  if (typeof window.__toastImpl === 'function') return window.__toastImpl(message, options || {});
  const { actionLabel = null, onAction = null, duration = 2800 } = options || {};
  const element = $('#toast');
  if (!element) return;
  element.replaceChildren();
  if (typeof message === 'string') {
    const textSpan = document.createElement('span');
    textSpan.className = 'toast-text';
    textSpan.textContent = message;
    element.appendChild(textSpan);
  }
  if (actionLabel && typeof onAction === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action-btn';
    btn.textContent = actionLabel;
    btn.onclick = (e) => {
      e.stopPropagation();
      element.hidden = true;
      try { onAction(); } catch (err) { console.error('Toast action failed:', err); }
    };
    element.appendChild(btn);
  }
  element.hidden = false;
  element.onclick = () => { element.hidden = true; };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.hidden = true; }, duration);
}
window.toast = toast;
// In-app confirm (ui-feedback.js) instead of the browser's confirm(); resolves 'confirm' | 'alt' | false.
function appConfirm(options) {
  if (typeof window.appConfirm === 'function') return window.appConfirm(options);
  return Promise.resolve(window.confirm([options.title, options.subject, options.message].filter(Boolean).join('\n\n')) ? 'confirm' : false);
}
function duplicateTxnConfirm(txnId, dup) {
  return appConfirm({ tone:'warning', title:'Duplicate Transaction ID', subject:`Transaction ID "${txnId}"`, message:`Already recorded on ${dup.date} for ${dup.customerName} (#${dup.customerNumber}) in month ${dup.month} (PKR ${Number(dup.amount || 0).toLocaleString()}). Save this payment with the same reference anyway?`, confirmLabel:'Save anyway', cancelLabel:'Cancel' });
}
function searchQuery() { return $('#globalCustomerSearch').value; }
function customerListQuery() { return $('#customerListSearch').value.trim() || searchQuery(); }
function save() {
  void requestPersistenceOnFirstWrite();
  state = generateMonthlyBillsThroughCurrentMonth(state, new Date());
  if (!persistenceBlocked) state = autoClosePreviousMonth(state, new Date());
  if (persistenceBlocked) {
    toast('Saved data could not be read. No changes were written; use a valid JSON backup to recover it.');
    renderStorageWarning(); renderDashboard(); renderGlobalSearch(); renderCustomers(); renderTransactions(); renderMonthlyReport(); refreshOwnerCenter(); renderPhase3();
    return false;
  }
  // Layer B — Quota guard: measure the serialized ledger before writing.
  // One warning per session; the save itself always proceeds. The estimate
  // signal reuses the already-cached storage estimate from the backup UI
  // (no new async work on the save path).
  let serialized = null;
  try { serialized = JSON.stringify(state); } catch { serialized = null; }
  if (serialized !== null && !quotaWarningShown) {
    const assessment = assessSaveSize(new TextEncoder().encode(serialized).byteLength, storageEstimateInfo?.supported ? { quota: storageEstimateInfo.quotaBytes, usage: storageEstimateInfo.usageBytes } : null);
    if (assessment.warn) {
      quotaWarningShown = true;
      toast('Ledger is getting large for browser storage — download a JSON backup now so nothing is lost.', { type: 'warning', title: 'Storage getting full', duration: 8000, actionLabel: 'Download JSON backup', onAction: () => { $('#downloadJsonBackupButton')?.click(); } });
    }
  }
  // SISP-40: keep the hamsaya referral queue in step with the ledger on
  // every save — a first payment queues the referrer's credit, a voided
  // trigger payment cancels a still-queued one. Reconcile is idempotent
  // and the queue lives in its own key; a failure here must never block
  // the ledger save below.
  try {
    const referralSync = reconcileReferralCredits(state, loadReferralCredits());
    if (referralSync.changed) saveReferralCredits(referralSync.credits);
  } catch { /* referral queue sync is best-effort on the save path */ }
  try { persistState(state, localStorage); storageAvailable = true; }
  catch (error) {
    storageAvailable = false;
    // A failed save must NEVER look like a success. Quota failures get the
    // emergency fallback attempt; anything else gets an explicit failure.
    if (isQuotaError(error) && serialized !== null) {
      void saveFallbackAndWarn(serialized);
    } else {
      toast('Could not save — your latest changes were NOT saved. Check browser storage is available, then retry.', { type: 'error', title: 'Save failed', duration: 8000 });
    }
  }
  renderDashboard();
  renderGlobalSearch();
  renderCustomers();
  renderTransactions();
  renderMonthlyReport();
  refreshOwnerCenter();
  renderPhase3();
  renderStorageWarning();
  if (typeof dailyRegisterController?.refresh === 'function') {
    dailyRegisterController.refresh();
  }
  return storageAvailable;
}
function checkMonthlyBilling() {
  const updated = generateMonthlyBillsThroughCurrentMonth(state, new Date());
  if (updated !== state) { state = updated; save(); }
}
/**
 * SISP-62: Power Backup dashboard surfaces — the summary card (node
 * count / on-battery state / soonest battery to die) and the active
 * outage strip (hidden unless an outage is running). Also called by
 * the 30-second power tick so remaining times stay live without a
 * full dashboard re-render.
 */
function renderPowerBackupDashboard(now = new Date()) {
  const nodes = loadUpsNodes();
  const summary = powerBackupSummary(nodes, now);
  const valueEl = $('#dashboardPowerValue');
  if (valueEl) {
    valueEl.textContent = summary.nodeCount === 0
      ? t('pwr_card_none')
      : summary.activeCount > 0
        ? t('pwr_card_outage', null, { count: summary.activeCount })
        : t('pwr_card_ok', null, { count: summary.nodeCount });
  }
  const periodEl = $('#dashboardPowerPeriod');
  if (periodEl) {
    periodEl.textContent = summary.worst
      ? (summary.worst.status.depleted
        ? `${summary.worst.node.name} · ${t('pwr_row_depleted')}`
        : t('pwr_card_next', null, { name: summary.worst.node.name, label: summary.worst.status.remainingLabel }))
      : t('pwr_card_sub');
  }
  const section = $('#powerOutageSection');
  if (section) {
    const active = activeOutages(nodes, now);
    section.hidden = active.length === 0;
    const listEl = $('#powerOutageList');
    if (listEl) {
      listEl.innerHTML = active.map(({ node, status }) => `
        <li class="power-outage-item${status.depleted ? ' power-outage-item-depleted' : ''}">
          <span class="power-outage-main">
            <strong class="power-outage-name" dir="auto">${escapeHtml(node.name)}</strong>
            <span class="power-outage-sub">${escapeHtml(t('pwr_status_since', null, { time: formatClockTime(status.startedAt) }))}</span>
          </span>
          <strong class="power-outage-remaining">${escapeHtml(status.depleted ? t('pwr_row_depleted') : t('pwr_row_remaining', null, { label: status.remainingLabel }))}</strong>
        </li>`).join('');
    }
  }
}

function renderDashboard() {
  const referenceDate = new Date();
  // SISP-27: upstream bandwidth bill due banner.
  const overheadBannerEl = $('#overheadsDueBanner');
  if (overheadBannerEl) {
    const dueStatus = bandwidthDueStatus(state, loadOverheads(), referenceDate);
    if (dueStatus.due) {
      overheadBannerEl.hidden = false;
      overheadBannerEl.innerHTML = `<span>\u26a1 ${escapeHtml(t('dash_overhead_due', null, { month: displayMonthName(dueStatus.month) }))}</span><button id="overheadsDueBannerBtn" class="secondary-button" type="button">${t('dash_overhead_btn')}</button>`;
      $('#overheadsDueBannerBtn')?.addEventListener('click', () => { expenseActiveTab = 'overheads'; switchView('expenses'); syncExpenseTabs(); renderOverheads(); });
    } else {
      overheadBannerEl.hidden = true;
      overheadBannerEl.innerHTML = '';
    }
  }
  const totals = calculateDashboard(state, referenceDate);
  const currentCash = buildMonthlyClosingSnapshot(state, totals.currentMonth, referenceDate);
  const retainedMonths = new Set(monthsForHistory(referenceDate));
  const allBillRows = state.customers.flatMap(customer => (customer.bills ?? []).map(bill => ({ bill })));
  const retainedBills = allBillRows.filter(({bill}) => retainedMonths.has(bill.month));
  const pricedRetainedBills = retainedBills.filter(({bill}) => bill.dueAmount !== null && bill.dueAmount !== undefined && bill.dueAmount !== '' && Number(bill.dueAmount) > 0);
  const currentBills = allBillRows.filter(({bill}) => bill.month === totals.currentMonth);
  const pricedCurrentBills = currentBills.filter(({bill}) => bill.dueAmount !== null && bill.dueAmount !== undefined && bill.dueAmount !== '' && Number(bill.dueAmount) > 0);
  const retainedPayments = retainedBills.flatMap(({bill}) => bill.payments ?? []);
  const allPayments = allBillRows.flatMap(({bill}) => bill.payments ?? []);
  const todayPayments = allPayments.filter(payment => payment.date === totals.today).length;
  const previousMonthPayments = allPayments.filter(payment => typeof payment.date === 'string' && payment.date.slice(0,7) === totals.previousMonth).length;
  const profilesWithCost = totals.providerCostBreakdown.reduce((sum,group) => sum + group.profilesWithCost, 0);
  const profilesWithProfit = state.customers.filter(customer => !customer.archived && customerPackageProfit(customer) !== null).length;
  $('#dashboardCustomerCount').textContent = totals.totalCustomers;
  // SISP-1: shop settlement summary card (unsettled cash per shop).
  const shopSummaryEl = $('#shopSettlementSummary');
  if (shopSummaryEl) {
    const shopSummaries = buildShopSummaries(state, loadShopSettlements(), referenceDate);
    const totalUnsettled = shopSummaries.reduce((sum, s) => sum + s.unsettled, 0);
    const pendingCount = shopSummaries.reduce((sum, s) => sum + s.unsettledReceiptCount, 0);
    const valueEl = $('#dashboardShopSettlementValue');
    if (valueEl) valueEl.textContent = shopSummaries.length === 0 ? t('dash_shop_empty') : formatAmount(totalUnsettled);
    const periodEl = $('#dashboardShopSettlementPeriod');
    if (periodEl) periodEl.textContent = shopSummaries.length === 0 ? t('dash_shop_empty_period') : `${t(shopSummaries.length === 1 ? 'dash_shop_sing' : 'dash_shop_plur', null, { count: shopSummaries.length })} · ${t(pendingCount === 1 ? 'dash_shop_receipt_sing' : 'dash_shop_receipt_plur', null, { count: pendingCount })}`;
    shopSummaryEl.innerHTML = shopSummaries.length === 0
      ? ''
      : shopSummaries.map((s) => `<p><span>${escapeHtml(s.shop)}</span><strong>${escapeHtml(formatAmount(s.unsettled))}</strong><small> · ${escapeHtml(t('dash_shop_detail', null, { collected: formatAmount(s.collectedThisMonth), date: s.lastHandoverDate || t('dash_shop_never') }))}</small></p>`).join('');
  }
  // Owner feature 2026-10-29: Recent Payments card (last 5 payments
  // across all customers; voided SISP-34 payments excluded by the
  // builder). Read-only — rows open the customer profile, "All" opens
  // the Transactions view.
  const recentPaymentsListEl = $('#recentPaymentsList');
  if (recentPaymentsListEl) {
    const recentRows = buildRecentPayments(state);
    recentPaymentsListEl.innerHTML = recentRows.length === 0
      ? `<li class="recent-payments-empty">${escapeHtml(t('dash_recent_empty'))}</li>`
      : recentRows.map((row) => `<li class="recent-payment-item"><button type="button" class="recent-payment-row" data-recent-customer-id="${escapeHtml(row.customerId)}"><span class="recent-payment-main"><strong class="recent-payment-ref">${escapeHtml(row.receiptRef || humanDate(row.date))}</strong><span class="recent-payment-sub" dir="auto">${escapeHtml(row.customerName)}${row.method ? ` · ${escapeHtml(row.method)}` : ''}</span></span><strong class="recent-payment-amount">${escapeHtml(formatAmount(row.amount))}</strong></button></li>`).join('');
    recentPaymentsListEl.querySelectorAll('[data-recent-customer-id]').forEach(button => button.addEventListener('click', () => selectCustomer(button.dataset.recentCustomerId)));
    const recentAllBtn = $('#recentPaymentsAllBtn');
    if (recentAllBtn && !recentAllBtn.dataset.wired) {
      recentAllBtn.dataset.wired = 'true';
      recentAllBtn.addEventListener('click', () => { switchView('transactions'); renderTransactions(); });
    }
  }
  // SISP-59: Package Upgrade Suggestions — active customers on
  // <= 5 Mbps who logged slow-speed complaints or paid on time 3+
  // months, with the projected +Rs/month ARPU lift and a 1-tap
  // WhatsApp offer per row. Read-only: the builder never changes a
  // package; rows open the profile, the offer button opens wa.me.
  const upsellListEl = $('#upsellList');
  if (upsellListEl) {
    const upsellCandidates = buildUpsellCandidates(state, { complaints: loadComplaints(), tickets: loadTickets() }, referenceDate);
    const upsellSummary = buildUpsellSummary(upsellCandidates);
    const upsellTotalEl = $('#upsellTotalGain');
    if (upsellTotalEl) upsellTotalEl.textContent = upsellSummary.count > 0 ? t('upsell_total', null, { amount: formatAmount(upsellSummary.totalGainPerMonth) }) : '';
    upsellListEl.innerHTML = upsellCandidates.length === 0
      ? `<li class="upsell-empty">${escapeHtml(t('upsell_empty'))}</li>`
      : upsellCandidates.map((row) => {
        const reasons = [
          row.slowSpeedComplaints > 0 ? t('upsell_reason_complaints', null, { count: row.slowSpeedComplaints }) : '',
          row.onTimeStreak >= 3 ? t('upsell_reason_ontime', null, { count: row.onTimeStreak }) : ''
        ].filter(Boolean).join(' · ');
        return `<li class="upsell-item"><button type="button" class="upsell-row" data-upsell-customer-id="${escapeHtml(row.customerId)}"><span class="upsell-main"><strong class="upsell-name" dir="auto">${escapeHtml(row.customerName)}${row.mohalla ? ` · ${escapeHtml(row.mohalla)}` : ''}</strong><span class="upsell-sub-line">${escapeHtml(t('upsell_pkg_line', null, { current: row.currentLabel, fee: formatAmount(row.currentFee), target: row.targetLabel, price: formatAmount(row.targetPrice) }))}</span><span class="upsell-sub-line">${escapeHtml(reasons)}</span></span><strong class="upsell-gain">${escapeHtml(t('upsell_gain', null, { amount: formatAmount(row.gainPerMonth) }))}</strong></button>${row.whatsappUrl ? `<a class="upsell-offer-btn" href="${escapeHtml(row.whatsappUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('upsell_offer'))}</a>` : ''}</li>`;
      }).join('');
    upsellListEl.querySelectorAll('[data-upsell-customer-id]').forEach(button => button.addEventListener('click', () => selectCustomer(button.dataset.upsellCustomerId)));
  }
  // SISP-90: At-Risk Loyal Customers — 12+ month subscribers who
  // logged 2+ complaints this month or lost 12+ hours to downtime
  // this month (read-only derivation in loyalty-retention.js from the
  // SISP-15 register, the SISP-12 tickets and the recorded uptime
  // incidents). Rows open the profile; nothing here writes a record.
  const loyaltyListEl = $('#loyaltyAtRiskList');
  if (loyaltyListEl) {
    const atRiskRows = buildAtRiskLoyalCustomers(state, { complaints: loadComplaints(), tickets: loadTickets() }, referenceDate);
    const loyaltySummary = buildLoyaltySummary(atRiskRows);
    const loyaltyCountEl = $('#loyaltyAtRiskCount');
    if (loyaltyCountEl) loyaltyCountEl.textContent = loyaltySummary.count > 0 ? t('loyalty_count', null, { count: loyaltySummary.count }) : '';
    loyaltyListEl.innerHTML = atRiskRows.length === 0
      ? `<li class="upsell-empty">${escapeHtml(t('loyalty_empty'))}</li>`
      : atRiskRows.map((row) => {
        const reasons = [
          row.reasons.includes('complaints') ? t('loyalty_reason_complaints', null, { count: row.complaintsThisMonth }) : '',
          row.reasons.includes('downtime') ? t('loyalty_reason_downtime', null, { hours: row.downtimeHours }) : ''
        ].filter(Boolean).join(' · ');
        return `<li class="upsell-item"><button type="button" class="upsell-row" data-loyalty-customer-id="${escapeHtml(row.customerId)}"><span class="upsell-main"><strong class="upsell-name" dir="auto">${escapeHtml(row.customerName)}${row.mohalla ? ` · ${escapeHtml(row.mohalla)}` : ''}</strong><span class="upsell-sub-line">${escapeHtml(t('loyalty_tenure_line', null, { months: row.tenureMonths }))}</span><span class="upsell-sub-line">${escapeHtml(reasons)}</span></span><strong class="upsell-gain">⚠️</strong></button></li>`;
      }).join('');
    loyaltyListEl.querySelectorAll('[data-loyalty-customer-id]').forEach(button => button.addEventListener('click', () => selectCustomer(button.dataset.loyaltyCustomerId)));
  }
  // SISP-85: Revenue Leak Audit — active zero-rate connections,
  // expired vacation holds and active customers with no bill in the
  // current cycle, with an estimated monthly leakage taken only from
  // recorded rates/bills. Read-only: rows open the customer profile;
  // the audit never resumes a hold, sets a rate or creates a bill.
  const revenueLeakListEl = $('#revenueLeakList');
  if (revenueLeakListEl) {
    const leakRows = buildRevenueLeakAudit(state, referenceDate);
    const leakSummary = buildRevenueLeakSummary(leakRows);
    const leakTotalEl = $('#revenueLeakTotal');
    if (leakTotalEl) leakTotalEl.textContent = leakSummary.totalEstimatedMonthlyLeakage > 0
      ? t('revleak_total', null, { amount: formatAmount(leakSummary.totalEstimatedMonthlyLeakage) })
      : '';
    const leakFlagKeys = {
      'zero-rate': 'revleak_flag_zero',
      'expired-pause': 'revleak_flag_expired',
      'missing-current-bill': 'revleak_flag_missing'
    };
    revenueLeakListEl.innerHTML = leakRows.length === 0
      ? `<li class="revleak-empty">${escapeHtml(t('revleak_empty'))}</li>`
      : leakRows.map((row) => {
        const detail = row.flag === 'zero-rate'
          ? t('revleak_zero_line')
          : row.flag === 'expired-pause'
            ? t('revleak_expired_line', null, { date: row.autoResumeDate ? humanDate(row.autoResumeDate) : '' })
            : t('revleak_missing_line', null, { month: displayMonthName(row.currentMonth) });
        const amount = row.estimatedMonthlyLeakage === null
          ? `<span class="revleak-no-estimate">${escapeHtml(t('revleak_no_estimate'))}</span>`
          : `<strong class="revleak-amount">${escapeHtml(t('revleak_estimate', null, { amount: formatAmount(row.estimatedMonthlyLeakage) }))}</strong>`;
        return `<li class="revleak-item"><button type="button" class="revleak-row" data-revleak-customer-id="${escapeHtml(row.customerId)}"><span class="revleak-main"><strong class="revleak-name" dir="auto">${escapeHtml(row.customerName)}${row.mohalla ? ` · ${escapeHtml(row.mohalla)}` : ''}</strong><span class="revleak-flag">${escapeHtml(t(leakFlagKeys[row.flag] || 'revleak_flag_missing'))}</span><span class="revleak-sub-line">${escapeHtml(detail)}</span></span>${amount}</button></li>`;
      }).join('');
    revenueLeakListEl.querySelectorAll('[data-revleak-customer-id]').forEach(button => button.addEventListener('click', () => selectCustomer(button.dataset.revleakCustomerId)));
  }
  // SISP-75: Daily Partner Digest — one tap builds today's Roman Urdu
  // partner summary (direct cash, per-shop unsettled cash, roznamcha
  // drawer, remaining defaulters, today's complaints) from the pure
  // builder and copies it for WhatsApp; when the clipboard is
  // unavailable the WhatsApp share sheet opens instead. Read-only.
  const partnerDigestBtn = $('#copyPartnerDigestBtn');
  if (partnerDigestBtn && !partnerDigestBtn.dataset.wired) {
    partnerDigestBtn.dataset.wired = 'true';
    partnerDigestBtn.addEventListener('click', async () => {
      const text = buildDailyPartnerDigest(state, pakistanToday(), {
        settlements: loadShopSettlements(),
        roznamchaDays: loadRoznamchaDays(),
        complaints: loadComplaints()
      });
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          toast(t('digest_copied'));
          return;
        }
        throw new Error('clipboard unavailable');
      } catch {
        const shareWindow = window.open(dailyPartnerDigestWhatsAppUrl(text), '_blank');
        toast(t(shareWindow ? 'digest_copied' : 'digest_failed'), shareWindow ? {} : { type: 'warning' });
      }
    });
  }
  // SISP-69: Hardware / Optical Bottleneck Audit — active customers on
  // >= 15 Mbps catalogue packages whose last recorded optical RX is
  // below the -26.0 dBm weak-signal line (SISP-24 field). Slow-speed
  // complaints ride along as corroborating evidence only; the flag is
  // speed + weak RX. Read-only: rows open the profile, nothing here
  // changes a record.
  const hwauditListEl = $('#hwauditList');
  if (hwauditListEl) {
    const suspects = buildBottleneckSuspects(state, { complaints: loadComplaints(), tickets: loadTickets() });
    const hwSummary = buildBottleneckSummary(suspects);
    const hwauditCountEl = $('#hwauditCount');
    if (hwauditCountEl) hwauditCountEl.textContent = hwSummary.count > 0 ? t('hwaudit_count', null, { count: hwSummary.count }) : '';
    hwauditListEl.innerHTML = suspects.length === 0
      ? `<li class="hwaudit-empty">${escapeHtml(t('hwaudit_empty'))}</li>`
      : suspects.map((row) => {
        const complaintsLine = row.slowSpeedComplaints > 0 ? t('hwaudit_complaints', null, { count: row.slowSpeedComplaints }) : t('hwaudit_no_complaints');
        const boxLine = row.splitterBoxId ? t('hwaudit_box', null, { box: row.splitterBoxId, port: row.splitterPort ?? '—' }) : '';
        return `<li class="hwaudit-item"><button type="button" class="hwaudit-row" data-hwaudit-customer-id="${escapeHtml(row.customerId)}"><span class="hwaudit-main"><strong class="hwaudit-name" dir="auto">${escapeHtml(row.customerName)}${row.mohalla ? ` · ${escapeHtml(row.mohalla)}` : ''}</strong><span class="hwaudit-sub-line">${escapeHtml(t('hwaudit_line', null, { label: row.packageLabel, rx: formatRxDbm(row.lastRxDbm) }))}</span><span class="hwaudit-sub-line">${escapeHtml([boxLine, complaintsLine].filter(Boolean).join(' · '))}</span></span><strong class="hwaudit-rx">${escapeHtml(formatRxDbm(row.lastRxDbm))}</strong></button></li>`;
      }).join('');
    hwauditListEl.querySelectorAll('[data-hwaudit-customer-id]').forEach(button => button.addEventListener('click', () => selectCustomer(button.dataset.hwauditCustomerId)));
  }
  // SISP-67: Unified Zone Field Dispatch Board — every OPEN field
  // item (complaints, tickets, installations, pending works,
  // hardware recovery) grouped by canonical mohalla via
  // field-dispatch-board.js, with a 1-tap WhatsApp worklist per zone.
  // Read-only aggregation: the board never writes to any source.
  const fdispListEl = $('#fieldDispatchList');
  if (fdispListEl) {
    const board = buildFieldDispatchBoard(state, {
      complaints: loadComplaints(),
      tickets: loadTickets(),
      installRequests: loadInstallRequests(),
      pendingWorks: loadPendingWorks()
    });
    const fdispTotalEl = $('#fieldDispatchTotal');
    if (fdispTotalEl) fdispTotalEl.textContent = board.totalOpen > 0 ? t('fdisp_total', null, { count: board.totalOpen }) : '';
    const fdispTypeIcons = { complaint: '⚠️', ticket: '🎫', installation: '🔌', work: '📝', recovery: '📦' };
    fdispListEl.innerHTML = board.zones.length === 0
      ? `<p class="field-dispatch-empty">${escapeHtml(t('fdisp_empty'))}</p>`
      : board.zones.map((zone) => {
        const zoneLabel = zone.key === UNASSIGNED_ZONE_KEY ? t('fdisp_unassigned') : zone.label;
        const countsLine = DISPATCH_ITEM_TYPES
          .filter((type) => zone.counts[type] > 0)
          .map((type) => `${fdispTypeIcons[type]} ${escapeHtml(t(`fdisp_type_${type}`))} ${zone.counts[type]}`)
          .join(' · ');
        const itemsHtml = zone.items.map((item) => {
          const inner = `<span class="field-dispatch-item-icon" aria-hidden="true">${fdispTypeIcons[item.type]}</span><span class="field-dispatch-item-main"><span class="field-dispatch-item-title" dir="auto">${escapeHtml(item.title)}</span>${item.detail ? `<span class="field-dispatch-item-detail" dir="auto">${escapeHtml(item.detail)}</span>` : ''}</span>`;
          return item.customerId
            ? `<li><button type="button" class="field-dispatch-item" data-fdisp-customer-id="${escapeHtml(item.customerId)}">${inner}</button></li>`
            : `<li class="field-dispatch-item">${inner}</li>`;
        }).join('');
        return `<article class="field-dispatch-zone"><div class="field-dispatch-zone-head"><span class="field-dispatch-zone-name" dir="auto">${escapeHtml(zoneLabel)}</span><span class="field-dispatch-zone-count">${escapeHtml(t('fdisp_items_count', null, { count: zone.totalCount }))}</span></div><p class="field-dispatch-counts">${countsLine}</p><ul class="field-dispatch-items">${itemsHtml}</ul><a class="field-dispatch-send" href="${escapeHtml(zone.whatsappUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('fdisp_send'))}</a></article>`;
      }).join('');
    fdispListEl.querySelectorAll('[data-fdisp-customer-id]').forEach(button => button.addEventListener('click', () => selectCustomer(button.dataset.fdispCustomerId)));
  }
  // SISP-62: power backup summary card + active outage strip.
  renderPowerBackupDashboard(referenceDate);
  // SISP-2: monthly billing cycle card (last run + open the cycle modal).
  const cycleSummaryEl = $('#billingCycleSummary');
  if (cycleSummaryEl) {
    const cycles = loadBillingCycles();
    const latest = cycles[0] || null;
    const valueEl = $('#dashboardBillingCycleValue');
    const periodEl = $('#dashboardBillingCyclePeriod');
    if (valueEl) valueEl.textContent = latest ? t('dash_cycle_cycled', null, { month: displayMonthName(latest.month) }) : t('dash_cycle_empty');
    if (periodEl) periodEl.textContent = latest ? t('dash_cycle_bills', null, { count: latest.totals.billedCount, amount: formatAmount(latest.totals.netExpectedCollection) }) : t('dash_cycle_period_empty');
    cycleSummaryEl.innerHTML = latest
      ? `<p><span>${escapeHtml(displayMonthName(latest.month))}</span><strong>${escapeHtml(t('dash_cycle_billed', null, { amount: formatAmount(latest.totals.totalBilled) }))}</strong><small> · ${escapeHtml(t('dash_cycle_arrears', null, { amount: formatAmount(latest.totals.totalArrears) }))} · ${escapeHtml(latest.ranAt || '')}</small></p>`
      : '';
  }
  // SISP-15: complaint register card (open faults + this-month downtime).
  const complaintSummaryEl = $('#complaintRegisterSummary');
  if (complaintSummaryEl) {
    const summary = buildComplaintSummary(loadComplaints(), referenceDate);
    const valueEl = $('#dashboardComplaintValue');
    const periodEl = $('#dashboardComplaintPeriod');
    if (valueEl) valueEl.textContent = summary.total === 0 ? t('dash_complaint_empty') : t('dash_complaint_open', null, { open: summary.open, inProgress: summary.inProgress });
    if (periodEl) periodEl.textContent = summary.total === 0 ? t('dash_complaint_period_empty') : t('dash_complaint_period', null, { resolved: summary.resolved, count: summary.thisMonthCount, hours: summary.thisMonthDowntime });
    complaintSummaryEl.innerHTML = summary.total === 0
      ? ''
      : `<p><span>${t('dash_detail_open_now')}</span><strong>${escapeHtml(String(summary.open))}</strong><small> · ${escapeHtml(t('dash_detail_progress_resolved', null, { inProgress: summary.inProgress, resolved: summary.resolved }))}</small></p>`;
  }
  // SISP-12: field tickets card (open worklist + pending ticket charges).
  const ticketSummaryEl = $('#fieldTicketsSummary');
  if (ticketSummaryEl) {
    const summary = buildTicketSummary(loadTickets());
    const valueEl = $('#dashboardFieldTicketsValue');
    const periodEl = $('#dashboardFieldTicketsPeriod');
    if (valueEl) valueEl.textContent = summary.total === 0 ? t('dash_ticket_empty') : t('dash_complaint_open', null, { open: summary.open, inProgress: summary.inProgress });
    if (periodEl) periodEl.textContent = summary.total === 0 ? t('dash_ticket_period_empty') : t('dash_ticket_period', null, { resolved: summary.resolved, charges: summary.pendingCharges });
    ticketSummaryEl.innerHTML = summary.total === 0
      ? ''
      : `<p><span>${t('dash_detail_open_now')}</span><strong>${escapeHtml(String(summary.open))}</strong><small> · ${escapeHtml(t('dash_detail_progress_resolved', null, { inProgress: summary.inProgress, resolved: summary.resolved }))}</small></p>`;
  }
  // SISP-16: downtime analytics card (this-month customer + network downtime).
  const downtimeSummaryEl = $('#downtimeAnalyticsSummary');
  if (downtimeSummaryEl) {
    const analytics = buildMonthlyDowntimeAnalytics(loadComplaints(), pakistanMonthNow(referenceDate));
    const valueEl = $('#dashboardDowntimeValue');
    const periodEl = $('#dashboardDowntimePeriod');
    if (valueEl) valueEl.textContent = analytics.totalComplaints === 0 ? t('dash_downtime_empty') : t('dash_downtime_value', null, { hours: analytics.totalDowntime });
    if (periodEl) periodEl.textContent = analytics.totalComplaints === 0 ? t('dash_downtime_period_empty') : t('dash_downtime_period', null, { count: analytics.totalComplaints, customers: analytics.perCustomer.length });
    downtimeSummaryEl.innerHTML = analytics.totalComplaints === 0
      ? ''
      : `<p><span>${t('dash_downtime_top')}</span><strong>${escapeHtml(analytics.perCustomer.length ? `${analytics.perCustomer[0].customerName} · ${analytics.perCustomer[0].totalDowntime} h` : '—')}</strong><small> · ${escapeHtml(t('dash_downtime_detail', null, { count: analytics.areaOutageComplaints, hours: analytics.areaOutageDowntime }))}</small></p>`;
  }
  // SISP-24: splitter port map card (boxes mapped, ports used, weak signals).
  const splitterSummaryEl = $('#splitterMapSummary');
  if (splitterSummaryEl) {
    const overview = buildSplitterOverview(state.customers);
    const splitterValueEl = $('#dashboardSplitterValue');
    const splitterPeriodEl = $('#dashboardSplitterPeriod');
    if (splitterValueEl) splitterValueEl.textContent = overview.boxCount === 0 ? t('dash_splitter_empty') : `${t(overview.boxCount === 1 ? 'dash_splitter_box_sing' : 'dash_splitter_box_plur', null, { count: overview.boxCount })} · ${t('dash_splitter_ports', null, { count: overview.occupiedPorts })}`;
    if (splitterPeriodEl) splitterPeriodEl.textContent = overview.boxCount === 0 ? t('dash_splitter_period_empty') : `${t(overview.freePorts === 1 ? 'dash_splitter_spare_sing' : 'dash_splitter_spare_plur', null, { count: overview.freePorts })}${overview.weakCount ? ` · ${t(overview.weakCount === 1 ? 'dash_splitter_weak_sing' : 'dash_splitter_weak_plur', null, { count: overview.weakCount })}` : ` · ${t('dash_splitter_no_weak')}`}`;
    splitterSummaryEl.innerHTML = overview.weakCustomers.length === 0
      ? ''
      : `<p><span>${t('dash_splitter_weakest')}</span><strong>${escapeHtml(overview.weakCustomers[0].customerName || t('dash_fallback_unnamed'))} · ${escapeHtml(formatRxDbm(overview.weakCustomers[0].lastRxDbm))}</strong><small> · ${escapeHtml(overview.weakCustomers[0].boxId)} ${escapeHtml(t('dash_splitter_port', null, { port: overview.weakCustomers[0].splitterPort ?? overview.weakCustomers[0].port ?? '' }))}</small></p>`;
  }
  // Owner feature (2026-10-29): Mohalla dashboard — one card per mohalla
  // that actually has users (zero-user mohallas render no card). Counts go
  // through canonicalMohalla so "Bani" and "BANII" share one card. Clicking
  // a card opens the Customers list with the Area search field set to that
  // mohalla, landing the owner on exactly those users.
  const mohallaCardsEl = $('#mohallaDashboardCards');
  if (mohallaCardsEl) {
    const mohallaCounts = buildMohallaUserCounts(state.customers);
    const mohallaEmptyEl = $('#mohallaDashboardEmpty');
    if (mohallaEmptyEl) mohallaEmptyEl.hidden = mohallaCounts.length > 0;
    mohallaCardsEl.innerHTML = mohallaCounts.map((row) => `<button type="button" class="mohalla-card" data-mohalla-card="${escapeHtml(row.stored)}" aria-label="${escapeHtml(`${row.stored}: ${row.count} ${t('dash_mohalla_users')}`)}"><span class="mohalla-card-name">${escapeHtml(row.stored)}</span><strong class="mohalla-card-count">${row.count}</strong><span class="mohalla-card-users">${escapeHtml(t('dash_mohalla_users'))}</span></button>`).join('');
    mohallaCardsEl.querySelectorAll('[data-mohalla-card]').forEach((button) => button.addEventListener('click', () => {
      customerSearchField = 'area';
      customerAreaFilter = 'all';
      if ($('#customerFilterArea')) $('#customerFilterArea').value = 'all';
      if ($('#customerSearchField')) $('#customerSearchField').value = 'area';
      if ($('#customerListSearch')) $('#customerListSearch').value = button.dataset.mohallaCard;
      customerCurrentPage = 1;
      switchView('customers');
      renderCustomers();
    }));
  }
  // SISP-17: monthly complaint report card (this-month 4-part report totals).
  const monthlyReportSummaryEl = $('#monthlyComplaintReportSummary');
  if (monthlyReportSummaryEl) {
    const report = buildMonthlyComplaintReport(loadComplaints(), pakistanMonthNow(referenceDate));
    const valueEl = $('#dashboardMonthlyReportValue');
    const periodEl = $('#dashboardMonthlyReportPeriod');
    if (valueEl) valueEl.textContent = report.summary.totalComplaints === 0 ? t('dash_complaint_empty') : t('dash_report_value', null, { count: report.summary.totalComplaints, hours: report.summary.totalDowntime });
    if (periodEl) periodEl.textContent = report.summary.totalComplaints === 0 ? t('dash_report_period_empty') : t('dash_report_period', null, { resolved: report.summary.resolvedCount, pending: report.summary.pendingCount, hours: report.summary.fiberCutHours });
    monthlyReportSummaryEl.innerHTML = report.summary.totalComplaints === 0
      ? ''
      : `<p><span>${t('dash_downtime_top')}</span><strong>${escapeHtml(report.perCustomer.length ? t('dash_report_complaints', null, { name: report.perCustomer[0].customerName, count: report.perCustomer[0].complaintCount }) : '—')}</strong></p>`;
  }
  // SISP-11: roznamcha card (today's cash drawer).
  const roznamchaSummaryEl = $('#roznamchaSummary');
  if (roznamchaSummaryEl) {
    const today = pakistanToday();
    const day = buildRoznamchaDay(state, loadRoznamchaDays(), today, loadShopSettlements());
    const valueEl = $('#dashboardRoznamchaValue');
    const periodEl = $('#dashboardRoznamchaPeriod');
    if (valueEl) valueEl.textContent = day.closed ? t('dash_roz_closed', null, { amount: formatAmount(day.closingBalance) }) : t('dash_roz_expected', null, { amount: formatAmount(day.expectedClosing) });
    if (periodEl) periodEl.textContent = day.closed ? t('dash_roz_farq', null, { amount: formatAmount(day.discrepancy) }) : t('dash_roz_cash', null, { amount: formatAmount(day.totalIn), out: formatAmount(day.outTotal) });
    roznamchaSummaryEl.innerHTML = `<p><span>${t('dash_roz_opening')}</span><strong>${escapeHtml(formatAmount(day.openingBalance))}</strong><small> · ${escapeHtml(t('dash_roz_detail', null, { cash: day.cashPayments.length, handovers: day.handovers.length }))}</small></p>`;
  }
  // SISP-18: stock book card (live available stock + low-stock count).
  const inventorySummaryEl = $('#inventoryBookSummary');
  if (inventorySummaryEl) {
    const movements = loadInventory();
    const stock = computeStock(movements);
    const lowItems = stock.filter((row) => row.isLow);
    const valueEl = $('#dashboardInventoryValue');
    const periodEl = $('#dashboardInventoryPeriod');
    if (valueEl) valueEl.textContent = movements.length === 0 ? t('dash_inv_empty') : t(lowItems.length === 1 ? 'dash_inv_low_sing' : 'dash_inv_low_plur', null, { count: lowItems.length });
    if (periodEl) periodEl.textContent = movements.length === 0 ? t('dash_inv_period_empty') : t(movements.length === 1 ? 'dash_inv_move_sing' : 'dash_inv_move_plur', null, { count: movements.length });
    const fiberRow = stock.find((row) => row.id === 'fiber-2core');
    inventorySummaryEl.innerHTML = movements.length === 0
      ? ''
      : `<p><span>${t('dash_inv_fiber_left')}</span><strong>${escapeHtml(String(fiberRow ? fiberRow.available : 0))} m</strong><small> · ${escapeHtml(t(lowItems.length === 1 ? 'dash_inv_low_sing' : 'dash_inv_low_plur', null, { count: lowItems.length }))}</small></p>`;
  }
  // SISP-7: feeder outage card (linked customers + longest downstream chain).
  const outageSummaryEl = $('#outageImpactSummary');
  if (outageSummaryEl) {
    const feeder = summarizeFeederNetwork(state.customers);
    const outageValueEl = $('#dashboardOutageValue');
    const outagePeriodEl = $('#dashboardOutagePeriod');
    if (outageValueEl) outageValueEl.textContent = feeder.linkedCount === 0 ? t('dash_outage_empty') : t('dash_outage_linked', null, { count: feeder.linkedCount });
    if (outagePeriodEl) outagePeriodEl.textContent = feeder.maxDownstream === 0 ? t('dash_outage_period_empty') : t('dash_outage_chain', null, { count: feeder.maxDownstream });
    outageSummaryEl.innerHTML = feeder.maxSource
      ? `<p><span>${t('dash_outage_chain_label')}</span><strong>${escapeHtml(t('dash_outage_downstream', null, { name: feeder.maxSource.name || t('dash_fallback_unknown'), count: feeder.maxDownstream }))}</strong></p>`
      : '';
  }
  // Saad visit log: this-month visits, days present and hours worked.
  const saadSummaryEl = $('#saadVisitsSummary');
  if (saadSummaryEl) {
    const summary = buildMonthlySaadSummary(loadSaadVisits(), loadSaadPayments(), pakistanMonthNow(referenceDate));
    const valueEl = $('#dashboardSaadVisitsValue');
    const periodEl = $('#dashboardSaadVisitsPeriod');
    if (valueEl) valueEl.textContent = summary.visits.length === 0 ? t('dash_saad_empty') : `${t(summary.visits.length === 1 ? 'dash_saad_visit_sing' : 'dash_saad_visit_plur', null, { count: summary.visits.length })} · ${t(summary.dayCount === 1 ? 'dash_saad_day_sing' : 'dash_saad_day_plur', null, { count: summary.dayCount })}`;
    if (periodEl) periodEl.textContent = summary.visits.length === 0 ? t('dash_saad_period_empty') : t('dash_saad_period', null, { hours: formatHours(summary.totalHours), amount: summary.grandTotal });
    saadSummaryEl.innerHTML = summary.visits.length === 0
      ? ''
      : `<p><span>${t('dash_detail_latest')}</span><strong>${escapeHtml(summary.visits[summary.visits.length - 1].date)} · ${escapeHtml(visitWhereLabel(summary.visits[summary.visits.length - 1]))} · ${escapeHtml(formatHours(visitHours(summary.visits[summary.visits.length - 1])))} h</strong></p>`;
  }
  // Installation tracker: this-month requests / installed / pending / total delay days.
  const installSummaryEl = $('#installTrackerSummary');
  if (installSummaryEl) {
    const installSummary = buildMonthlyInstallSummary(loadInstallRequests(), pakistanMonthNow(referenceDate), installTrackerToday(referenceDate));
    const installValueEl = $('#dashboardInstallTrackerValue');
    const installPeriodEl = $('#dashboardInstallTrackerPeriod');
    if (installValueEl) installValueEl.textContent = installSummary.requestCount === 0 ? t('dash_install_empty') : `${t(installSummary.requestCount === 1 ? 'dash_install_req_sing' : 'dash_install_req_plur', null, { count: installSummary.requestCount })} · ${t('dash_install_installed', null, { count: installSummary.installedCount })}`;
    if (installPeriodEl) installPeriodEl.textContent = installSummary.requestCount === 0 ? t('dash_install_period_empty') : t('dash_install_period', null, { pending: installSummary.pendingCount, days: installSummary.totalDelayDays });
    installSummaryEl.innerHTML = installSummary.requestCount === 0
      ? ''
      : `<p><span>${t('dash_detail_latest')}</span><strong>${escapeHtml(installSummary.requests[installSummary.requests.length - 1].requestDate)} · ${escapeHtml(installSummary.requests[installSummary.requests.length - 1].requesterName)} · ${escapeHtml(String(installSummary.requests[installSummary.requests.length - 1].amountPaid))} PKR</strong></p>`;
  }
  // Pending works: due reminders + nearest threshold progress.
  const pendingWorksSummaryEl = $('#pendingWorksSummary');
  if (pendingWorksSummaryEl) {
    const pendingSummary = pendingWorksSummary(loadPendingWorks(), countActiveCustomers(state.customers));
    const pendingValueEl = $('#dashboardPendingWorksValue');
    const pendingPeriodEl = $('#dashboardPendingWorksPeriod');
    if (pendingValueEl) pendingValueEl.textContent = pendingSummary.pendingCount === 0 ? t('dash_pending_empty') : pendingSummary.dueCount > 0 ? t('dash_pending_due', null, { count: pendingSummary.dueCount }) : t('dash_pending_count', null, { count: pendingSummary.pendingCount });
    if (pendingPeriodEl) pendingPeriodEl.textContent = pendingSummary.nearestLabel ? t('dash_pending_nearest', null, { label: pendingSummary.nearestLabel }) : t('dash_pending_period_empty');
    pendingWorksSummaryEl.innerHTML = pendingSummary.dueItems.length === 0
      ? ''
      : `<p><span>${t('dash_pending_due_label')}</span><strong>${escapeHtml(pendingSummary.dueItems.map((item) => item.note).join(' · '))}</strong></p>`;
  }
  // SISP-32: pole & landmark directory — poles mapped vs live customers.
  const poleSummaryEl = $('#poleLandmarkSummary');
  if (poleSummaryEl) {
    const poleSummary = poleDirectorySummary(state.customers);
    const poleValueEl = $('#dashboardPoleLandmarkValue');
    const polePeriodEl = $('#dashboardPoleLandmarkPeriod');
    if (poleValueEl) poleValueEl.textContent = poleSummary.mappedCount === 0 ? t('dash_pole_empty') : t(poleSummary.mappedCount === 1 ? 'dash_pole_map_sing' : 'dash_pole_map_plur', null, { count: poleSummary.mappedCount });
    if (polePeriodEl) polePeriodEl.textContent = t('dash_pole_period', null, { total: poleSummary.totalCustomers });
    poleSummaryEl.innerHTML = poleSummary.mappedCount === 0
      ? ''
      : `<p><span>${t('dash_pole_label')}</span><strong>${escapeHtml(t('dash_pole_detail', null, { mapped: poleSummary.mappedCount, total: poleSummary.totalCustomers }))}</strong></p>`;
  }
  // SISP-35: group billing card — group count + live collectible total.
  const groupBillingSummaryEl = $('#groupBillingSummary');
  if (groupBillingSummaryEl) {
    const groupSummary = billingGroupsSummary(loadBillingGroups(), state.customers, monthsForHistory(new Date())[0], calculatePaymentAllocations(state));
    const groupValueEl = $('#dashboardGroupBillingValue');
    const groupPeriodEl = $('#dashboardGroupBillingPeriod');
    if (groupValueEl) groupValueEl.textContent = groupSummary.groupCount === 0 ? t('dash_group_empty') : formatAmount(groupSummary.totalDueCents / 100);
    if (groupPeriodEl) groupPeriodEl.textContent = groupSummary.groupCount === 0 ? t('dash_group_period_empty') : `${t(groupSummary.groupCount === 1 ? 'dash_group_sing' : 'dash_group_plur', null, { count: groupSummary.groupCount })} · ${t('dash_group_dues', null, { count: groupSummary.groupsWithDue })}`;
    groupBillingSummaryEl.innerHTML = groupSummary.groupCount === 0
      ? ''
      : `<p><span>${t('dash_group_collectible')}</span><strong>${escapeHtml(formatAmount(groupSummary.totalDueCents / 100))}</strong></p>`;
  }
  // SISP-19: pending hardware recovery card (disconnected customers
  // holding unrecovered ISP-owned hardware).
  const recoverySummaryEl = $('#hardwareRecoverySummary');
  if (recoverySummaryEl) {
    const pending = pendingHardwareRecovery(state.customers);
    const pendingItems = pending.reduce((sum, entry) => sum + entry.items.length, 0);
    const valueEl = $('#dashboardHardwareRecoveryValue');
    const periodEl = $('#dashboardHardwareRecoveryPeriod');
    if (valueEl) valueEl.textContent = pending.length === 0 ? t('dash_pending_empty') : `${t(pending.length === 1 ? 'dash_recovery_cust_sing' : 'dash_recovery_cust_plur', null, { count: pending.length })} · ${t(pendingItems === 1 ? 'dash_recovery_item_sing' : 'dash_recovery_item_plur', null, { count: pendingItems })}`;
    if (periodEl) periodEl.textContent = pending.length === 0 ? t('dash_recovery_period_empty') : t('dash_recovery_period');
    recoverySummaryEl.innerHTML = pending.length === 0
      ? ''
      : `<p><span>${t('dash_recovery_first')}</span><strong>${escapeHtml(pending[0].customer.name)} (#${escapeHtml(String(pending[0].customer.customerNumber))})</strong><small> · ${escapeHtml(pending[0].items.map(item => item.label).join(', '))}</small></p>`;
  }
  // SISP-20: owner khata closing card (current-month financials + network).
  const ownerKhataSummaryEl = $('#ownerKhataSummary');
  if (ownerKhataSummaryEl) {
    const khataMonth = pakistanMonthNow(referenceDate);
    const khataSaved = (state.monthlyClosings ?? []).find((row) => row.month === khataMonth) ?? null;
    const khata = buildOwnerKhataReport(state, khataMonth, {
      complaints: loadComplaints(),
      settlements: loadShopSettlements(),
      notes: loadMonthlyClosingNotes(),
      savedSnapshot: khataSaved,
      badDebt: badDebtSummary(loadBadDebts()),
      referenceDate
    });
    const valueEl = $('#dashboardOwnerKhataValue');
    const periodEl = $('#dashboardOwnerKhataPeriod');
    if (valueEl) valueEl.textContent = khata.receiptCount === 0 && khata.expenseCount === 0 ? t('dash_khata_empty') : t('dash_khata_profit', null, { amount: formatAmount(khata.profit) });
    if (periodEl) periodEl.textContent = t('dash_khata_period', null, { month: displayMonthName(khataMonth), collected: formatAmount(khata.collected), arrears: formatAmount(khata.pendingArrears) });
    ownerKhataSummaryEl.innerHTML = khata.receiptCount === 0 && khata.expenseCount === 0 && khata.totalComplaints === 0
      ? ''
      : `<p><span>${t('dash_khata_shares')}</span><strong>${escapeHtml(formatAmount(khata.nasirShare))} / ${escapeHtml(formatAmount(khata.aqibShare))}</strong><small> · ${t('dash_khata_partners')} · ${escapeHtml(t('dash_khata_detail', null, { complaints: khata.totalComplaints, hours: khata.totalDowntime }))}</small></p>${khata.badDebtWrittenOff > 0 ? `<p><span>${t('dash_khata_baddebt', null, { amount: formatAmount(khata.badDebtWrittenOff), count: khata.badDebtCustomerCount })}</span></p>` : ''}`;
  }
  // SISP-21: digital wallet ledger card (this-month wallet totals + flags).
  const walletSummaryEl = $('#walletLedgerSummary');
  if (walletSummaryEl) {
    const wallet = buildWalletReconciliation(state.customers, totals.currentMonth, loadShopSettlements());
    const valueEl = $('#dashboardWalletValue');
    const periodEl = $('#dashboardWalletPeriod');
    if (valueEl) valueEl.textContent = wallet.digitalCount === 0 ? t('dash_wallet_empty') : formatAmount(wallet.digitalTotal);
    if (periodEl) periodEl.textContent = wallet.digitalCount === 0
      ? t('dash_wallet_period_empty')
      : `${t('dash_wallet_pending', null, { count: wallet.pendingVerification.length })}${wallet.duplicateGroups.length ? ` · ${t(wallet.duplicateGroups.length === 1 ? 'dash_wallet_dup_sing' : 'dash_wallet_dup_plur', null, { count: wallet.duplicateGroups.length })}` : ''}`;
    walletSummaryEl.innerHTML = wallet.digitalCount === 0
      ? ''
      : DIGITAL_BREAKDOWN_METHODS.filter((label) => (wallet.byWallet[label]?.count ?? 0) > 0)
        .map((label) => `<p><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatAmount(wallet.byWallet[label].amount))}</strong><small> · ${escapeHtml(t(wallet.byWallet[label].count === 1 ? 'dash_wallet_pay_sing' : 'dash_wallet_pay_plur', null, { count: wallet.byWallet[label].count }))} · ${escapeHtml(t('dash_wallet_verified', null, { count: wallet.byWallet[label].verifiedCount }))}</small></p>`).join('');  }
  // SISP-37: suspense (unidentified) wallet transfers card.
  const suspenseSummaryEl = $('#suspensePaymentsSummary');
  if (suspenseSummaryEl) {
    const suspense = suspenseSummary(loadSuspensePayments());
    const suspenseValueEl = $('#dashboardSuspenseValue');
    const suspensePeriodEl = $('#dashboardSuspensePeriod');
    if (suspenseValueEl) suspenseValueEl.textContent = suspense.totalCount === 0 ? t('dash_suspense_empty') : formatAmount(suspense.unclaimedAmount);
    if (suspensePeriodEl) suspensePeriodEl.textContent = suspense.totalCount === 0
      ? t('dash_suspense_period_empty')
      : `${t(suspense.unclaimedCount === 1 ? 'dash_suspense_unclaimed_sing' : 'dash_suspense_unclaimed_plur', null, { count: suspense.unclaimedCount })} · ${t('dash_suspense_claimed', null, { count: suspense.claimedCount })}`;
    suspenseSummaryEl.innerHTML = suspense.totalCount === 0
      ? ''
      : `<p><span>${t('dash_suspense_unclaimed')}</span><strong>${escapeHtml(formatAmount(suspense.unclaimedAmount))}</strong></p>`;
  }
  // SISP-82: field tool custody card (register totals; detail + actions
  // live in the tool custody modal).
  const toolsValueEl = $('#dashboardToolsValue');
  if (toolsValueEl) {
    const tools = fieldToolsSummary(loadFieldTools());
    const toolsPeriodEl = $('#dashboardToolsPeriod');
    if (tools.totalCount === 0) {
      toolsValueEl.textContent = t('dash_tools_empty');
      if (toolsPeriodEl) toolsPeriodEl.textContent = t('dash_tools_period_empty');
    } else {
      toolsValueEl.textContent = t('dash_tools_total', null, { count: tools.totalCount });
      if (toolsPeriodEl) toolsPeriodEl.textContent = `${t('dash_tools_out', null, { count: tools.assignedCount })}${tools.maintenanceCount ? ` · ${t('dash_tools_maintenance', null, { count: tools.maintenanceCount })}` : ''}`;
    }
  }
  // SISP-39: lineman monthly scorecard card (resolved complaints across
  // field staff this month; detail lives in the scorecard modal).
  const linemanValueEl = $('#dashboardLinemanScorecardValue');
  if (linemanValueEl) {
    const scorecard = buildMonthlyScorecard({ state, tickets: loadTickets(), complaints: loadComplaints(), roznamchaDays: loadRoznamchaDays() });
    const totalResolved = scorecard.linemen.reduce((sum, person) => sum + person.complaintsResolved, 0);
    const linemanPeriodEl = $('#dashboardLinemanScorecardPeriod');
    if (totalResolved === 0 && scorecard.collectors.length === 0) {
      linemanValueEl.textContent = t('dash_lineman_empty');
      if (linemanPeriodEl) linemanPeriodEl.textContent = t('dash_lineman_period_empty');
    } else {
      linemanValueEl.textContent = t(totalResolved === 1 ? 'dash_lineman_resolved_sing' : 'dash_lineman_resolved_plur', null, { count: totalResolved });
      if (linemanPeriodEl) linemanPeriodEl.textContent = t('dash_lineman_period', null, { linemen: scorecard.linemen.length, collectors: scorecard.collectors.length });
    }
  }
  $('#serviceCountActive').textContent = totals.activeServiceCount;
  $('#serviceCountOffline').textContent = totals.offlineServiceCount;
  $('#serviceCountNotSet').textContent = totals.unsetServiceCount;
  document.querySelector('[data-customer-service-filter="active"]').setAttribute('aria-label', t('dash_service_active_aria', null, { count: totals.activeServiceCount }));
  document.querySelector('[data-customer-service-filter="offline"]').setAttribute('aria-label', t('dash_service_offline_aria', null, { count: totals.offlineServiceCount }));
  document.querySelector('[data-customer-service-filter="not-set"]').setAttribute('aria-label', t('dash_service_notset_aria', null, { count: totals.unsetServiceCount }));
  $('#serviceStateCountsAnnouncement').textContent = t('dash_service_announce', null, { active: totals.activeServiceCount, offline: totals.offlineServiceCount, notset: totals.unsetServiceCount });
  $('#dashboardTotalCollection').textContent = retainedPayments.length ? formatAmount(totals.totalCollection) : t('dash_no_payments');
  $('#dashboardTotalDue').textContent = retainedBills.length === 0 ? t('dash_no_bills') : pricedRetainedBills.length ? formatAmount(totals.totalDue) : t('dash_not_set');
  $('#dashboardTodayCollection').textContent = todayPayments ? formatAmount(totals.todayCollection) : t('dash_no_payments');
  $('#dashboardCurrentExpenses').textContent = currentCash.expenseCount ? formatAmount(currentCash.expenses) : t('dash_no_entries');
  $('#dashboardCurrentExpensesPeriod').textContent = t('dash_expenses_period', null, { month: displayMonthName(totals.currentMonth) });
  $('#dashboardCashProfit').textContent = currentCash.paymentCount || currentCash.expenseCount ? formatAmount(currentCash.profit) : t('dash_no_activity');
  $('#dashboardCashProfitPeriod').textContent = t('dash_profit_period', null, { collection: formatAmount(currentCash.collection), expenses: formatAmount(currentCash.expenses) });
  $('#dashboardPreviousCollection').textContent = previousMonthPayments ? formatAmount(totals.previousMonthCollection) : t('dash_no_payments');
  $('#dashboardCurrentMonthDue').textContent = currentBills.length === 0 ? t('dash_no_bills') : pricedCurrentBills.length ? formatAmount(totals.currentMonthDue) : t('dash_not_set');
  $('#dashboardPendingCredit').textContent = allPayments.length ? formatAmount(totals.pendingCredit) : t('dash_no_credit');
  $('#dashboardExpectedProfit').textContent = profilesWithProfit ? formatAmount(totals.expectedMonthlyPackageProfit) : t('dash_not_set');
  $('#dashboardProviderCost').textContent = profilesWithCost ? formatAmount(totals.expectedMonthlyProviderCost) : t('dash_not_set');
  $('#dashboardCustomerPeriod').textContent = t('dash_customer_period', null, { archived: totals.archivedCustomers, total: totals.totalCustomers });
  $('#dashboardProviderCostPeriod').textContent = profilesWithCost ? t('dash_provcost_period') : t('dash_provcost_empty');
  $('#providerCostBreakdownList').innerHTML = totals.providerCostBreakdown.map(group => `<li><span class="provider-breakdown-name">${escapeHtml(group.provider)}</span><strong>${escapeHtml(formatAmount(group.expectedMonthlyCost))}</strong><span class="provider-breakdown-meta">${t(group.profilesWithCost === 1 ? 'dash_provcost_cost_sing' : 'dash_provcost_cost_plur', null, { count: group.profilesWithCost })} · ${t('dash_provcost_missing', null, { count: group.profilesMissingCost })}</span></li>`).join('');
  $('#providerCostBreakdownEmpty').hidden = totals.providerCostBreakdown.length > 0;
  $('#dashboardTotalCollectionPeriod').textContent = retainedPayments.length ? t('dash_coll_period', null, { months: MONTH_LIMIT }) : t('dash_coll_period_empty');
  $('#dashboardTotalDuePeriod').textContent = retainedBills.length ? t('dash_due_period', null, { months: MONTH_LIMIT }) : t('dash_due_period_empty');
  $('#dashboardTodayPeriod').textContent = t('dash_today_period', null, { date: totals.today });
  $('#dashboardPreviousPeriod').textContent = t('dash_prev_period', null, { month: displayMonthName(totals.previousMonth) });
  $('#dashboardCurrentDuePeriod').textContent = `${t('dash_current_due_period', null, { month: displayMonthName(totals.currentMonth) })}${currentBills.length ? '' : t('dash_current_due_suffix')}`;
  $('#dashboardExpectedProfitPeriod').textContent = t('dash_margin_note');
  const notes = [];
  if (totals.customersMissingSellingAmount) notes.push(t(totals.customersMissingSellingAmount === 1 ? 'dash_note_selling_sing' : 'dash_note_selling_plur', null, { count: totals.customersMissingSellingAmount }));
  if (totals.unpricedBillCount) notes.push(t(totals.unpricedBillCount === 1 ? 'dash_note_unpriced_sing' : 'dash_note_unpriced_plur', null, { count: totals.unpricedBillCount }));
  if (totals.incompleteProfitProfiles) notes.push(t(totals.incompleteProfitProfiles === 1 ? 'dash_note_profit_sing' : 'dash_note_profit_plur', null, { count: totals.incompleteProfitProfiles }));
  if (totals.customersMissingProviderCost) notes.push(t(totals.customersMissingProviderCost === 1 ? 'dash_note_provcost_sing' : 'dash_note_provcost_plur', null, { count: totals.customersMissingProviderCost }));
  $('#dashboardExcludedAmounts').textContent = notes.length ? notes.join(' ') : t('dash_excluded_default');

  const kpis = calculateDashboardKpis(state, referenceDate);
  const activeSubscribersEl = $('#dashboardActiveCustomers');
  if (activeSubscribersEl) {
    activeSubscribersEl.textContent = `${kpis.activeSubscribers} (${kpis.activePercent}%)`;
    $('#dashboardActiveCustomersPeriod').textContent = t('dash_kpi_active_period', null, { offline: kpis.offlineSubscribers, notset: kpis.unsetSubscribers });
  }
  const billStatusEl = $('#dashboardMonthBillStatus');
  if (billStatusEl) {
    if (kpis.totalCurrentMonthBills === 0) {
      billStatusEl.textContent = t('dash_no_bills');
      $('#dashboardMonthBillStatusPeriod').textContent = t('dash_billstatus_empty');
    } else {
      billStatusEl.textContent = t('dash_billstatus_value', null, { paid: kpis.paidBillsCount, unpaid: kpis.unpaidBillsCount });
      $('#dashboardMonthBillStatusPeriod').textContent = t('dash_billstatus_period', null, { partial: kpis.partialBillsCount, total: kpis.totalCurrentMonthBills, month: displayMonthName(totals.currentMonth) });
    }
  }
  const billedRevenueEl = $('#dashboardCurrentMonthBilled');
  if (billedRevenueEl) {
    billedRevenueEl.textContent = kpis.currentMonthBilled > 0 ? formatAmount(kpis.currentMonthBilled) : t('dash_no_bills');
    $('#dashboardCurrentMonthBilledPeriod').textContent = kpis.collectionRate !== null ? t('dash_billed_rate', null, { rate: kpis.collectionRate }) : t('dash_billed_period', null, { month: displayMonthName(totals.currentMonth) });
  }
  const monthCollectionEl = $('#dashboardCurrentMonthCollection');
  if (monthCollectionEl) {
    monthCollectionEl.textContent = currentCash.paymentCount ? formatAmount(kpis.currentMonthCollection) : t('dash_no_payments');
    $('#dashboardCurrentMonthCollectionPeriod').textContent = t(currentCash.paymentCount === 1 ? 'dash_monthcoll_sing' : 'dash_monthcoll_plur', null, { count: currentCash.paymentCount, month: displayMonthName(totals.currentMonth) });
  }
  const newConnEl = $('#dashboardNewConnections');
  if (newConnEl) {
    newConnEl.textContent = String(kpis.newConnectionsCount);
    $('#dashboardNewConnectionsPeriod').textContent = t('dash_newconn_period', null, { month: displayMonthName(totals.currentMonth) });
  }
  const velocity = calculateCollectionVelocity(state, referenceDate);
  const velocityValEl = $('#dashboardCollectionVelocity');
  if (velocityValEl) {
    velocityValEl.textContent = t('dash_velocity_day', null, { amount: formatAmount(velocity.dailyRunRate) });
    $('#dashboardCollectionVelocityPeriod').textContent = velocity.projectedRate !== null
      ? t('dash_velocity_proj', null, { amount: formatAmount(velocity.projectedMonthEnd), rate: velocity.projectedRate, days: velocity.daysRemaining })
      : t('dash_velocity_days', null, { day: velocity.currentDay, daysInMonth: velocity.daysInMonth, days: velocity.daysRemaining });
    const fillEl = $('#dashboardVelocityFill');
    if (fillEl) {
      const pct = Math.min(100, Math.max(0, velocity.currentRate ?? 0));
      fillEl.style.width = `${pct}%`;
      const bar = fillEl.parentElement;
      if (bar && bar.setAttribute) bar.setAttribute('aria-valuenow', String(pct));
    }
  }
  collectionTargetController?.refresh();
  const discCountEl = $('#worklistsSummaryDiscCount');
  const discAmtEl = $('#worklistsSummaryDiscAmount');
  const recCountEl = $('#worklistsSummaryRecCount');
  if (discCountEl || recCountEl) {
    const wData = calculateDisconnectReconnectWorklists(state, { referenceDate });
    if (discCountEl) discCountEl.textContent = String(wData.kpis.toDisconnectCount);
    if (discAmtEl) discAmtEl.textContent = t('dash_worklist_dues', null, { amount: formatAmount(wData.kpis.toDisconnectTotalAmount), days: wData.rules.disconnectOverdueDays });
    if (recCountEl) recCountEl.textContent = String(wData.kpis.toReconnectCount);
  }
  worklistsModalController?.render?.();
  staffPerformanceModalController?.refresh?.();
  // Home Screen Overload Redesign (#213): Populate compact KPI strip
  const kpiTodayEl = $('#kpiTodayCollection');
  if (kpiTodayEl) {
    kpiTodayEl.textContent = todayPayments ? formatAmount(totals.todayCollection) : 'PKR 0';
  }
  const kpiMonthEl = $('#kpiMonthCollectionBilled');
  if (kpiMonthEl) {
    const collStr = formatAmount(kpis.currentMonthCollection || 0);
    const billStr = formatAmount(kpis.currentMonthBilled || 0);
    kpiMonthEl.textContent = `${collStr} / ${billStr}`;
    const kpiRateSub = $('#kpiMonthRateSub');
    if (kpiRateSub) {
      kpiRateSub.textContent = kpis.collectionRate !== null ? t('dash_kpi_rate', null, { rate: kpis.collectionRate }) : t('dash_kpi_rate_zero');
    }
  }
  const kpiDuesEl = $('#kpiTotalDue');
  if (kpiDuesEl) {
    kpiDuesEl.textContent = retainedBills.length === 0 ? 'PKR 0' : pricedRetainedBills.length ? formatAmount(totals.totalDue) : t('dash_not_set');
  }
  const kpiDefaultersEl = $('#kpiCustomersWithDues');
  if (kpiDefaultersEl) {
    let defaultersCount = 0;
    const alloc = calculatePaymentAllocations(state);
    for (const c of state.customers) {
      if (c.archived) continue;
      const bills = Array.isArray(c.bills) ? c.bills : [];
      const hasDue = bills.some(b => {
        if (b.dueAmount === null || b.dueAmount === undefined || b.dueAmount === '' || Number(b.dueAmount) <= 0) return false;
        return derivedBillStatus(c, b, alloc) !== 'paid';
      });
      if (hasDue) defaultersCount++;
    }
    kpiDefaultersEl.textContent = t(defaultersCount === 1 ? 'dash_defaulters_sing' : 'dash_defaulters_plur', null, { count: defaultersCount });
  }
  // Owner feature 2026-10-29: Advance Held KPI card — total advance
  // credit being held right now (unapplied, voided excluded, via the
  // allocation engine) with this month's advance intake as the sub-line.
  // Tapping the card opens the holders dialog. Read-only presentation.
  const kpiAdvanceEl = $('#kpiAdvanceHeld');
  if (kpiAdvanceEl) {
    const advSummary = buildAdvanceDashboard(state, totals.currentMonth);
    kpiAdvanceEl.textContent = formatAmount(advSummary.heldTotalCents / 100);
    const kpiAdvanceSubEl = $('#kpiAdvanceMonthSub');
    if (kpiAdvanceSubEl) kpiAdvanceSubEl.textContent = t('dash_adv_month_sub', null, { amount: formatAmount(advSummary.collectedThisMonthCents / 100) });
    const advCard = $('#kpiCardAdvance');
    if (advCard && !advCard.dataset.wired) {
      advCard.dataset.wired = 'true';
      advCard.addEventListener('click', () => openAdvanceHoldersDialog());
      advCard.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openAdvanceHoldersDialog(); }
      });
    }
  }

  // SISP-54: Monthly Collection Thermometer — collected so far vs
  // this month's billed + arrears carried in (target derived from the
  // ledger itself via collection-forecaster.js, never a typed-in
  // goal), the required daily run-rate for the days left, and
  // area-by-area progress bars. Read-only presentation.
  const fcstSection = $('#collectionForecastSection');
  if (fcstSection) {
    const forecast = buildCollectionForecast(state, totals.currentMonth, referenceDate);
    const pctText = forecast.progressPercent === null ? '—' : `${forecast.progressPercent}%`;
    const pctEl = $('#collectionForecastPct');
    if (pctEl) pctEl.textContent = pctText;
    const fillEl = $('#collectionForecastFill');
    if (fillEl) {
      const fillPct = forecast.progressPercent === null ? 0 : Math.min(100, Math.max(0, forecast.progressPercent));
      fillEl.style.width = `${fillPct}%`;
      const bar = fillEl.parentElement;
      if (bar && bar.setAttribute) bar.setAttribute('aria-valuenow', String(fillPct));
    }
    const collectedEl = $('#collectionForecastCollected');
    if (collectedEl) {
      collectedEl.textContent = t('fcst_collected_of', null, {
        collected: formatAmount(forecast.collectedCents / 100),
        target: formatAmount(forecast.targetCents / 100)
      });
    }
    const splitEl = $('#collectionForecastSplit');
    if (splitEl) {
      splitEl.textContent = t('fcst_split', null, {
        billed: formatAmount(forecast.billedCents / 100),
        arrears: formatAmount(forecast.arrearsCents / 100)
      });
    }
    const runRateEl = $('#collectionForecastRunRate');
    if (runRateEl) {
      const daysText = forecast.daysRemaining === 0
        ? t('fcst_no_days_left')
        : t(forecast.daysRemaining === 1 ? 'fcst_days_left_one' : 'fcst_days_left_many', null, { days: forecast.daysRemaining });
      runRateEl.textContent = forecast.remainingCents > 0
        ? `${t('fcst_run_rate', null, { amount: formatAmount(forecast.requiredDailyRunRateCents / 100) })} · ${daysText}`
        : (forecast.hasTarget ? t('fcst_done') : '');
    }
    const paceEl = $('#collectionForecastPace');
    if (paceEl) {
      paceEl.textContent = forecast.hasTarget
        ? t('fcst_pace', null, {
          pace: formatAmount(forecast.actualDailyPaceCents / 100),
          projected: formatAmount(forecast.projectedMonthEndCents / 100)
        })
        : '';
    }
    const emptyEl = $('#collectionForecastEmpty');
    if (emptyEl) emptyEl.hidden = forecast.hasTarget;
    const areasTitleEl = fcstSection.querySelector('.collection-forecast-areas-title');
    if (areasTitleEl) areasTitleEl.hidden = forecast.areas.length === 0;
    const areasEl = $('#collectionForecastAreas');
    if (areasEl) {
      areasEl.innerHTML = forecast.areas.map(area => {
        const areaPct = Math.min(100, Math.max(0, area.progressPercent ?? 0));
        return `<div class="fcst-area-row">
          <div class="fcst-area-head"><span class="fcst-area-label">${escapeHtml(area.label)}</span><span class="fcst-area-figures">${escapeHtml(formatAmount(area.collectedCents / 100))} / ${escapeHtml(formatAmount(area.targetCents / 100))} · ${area.progressPercent}%</span></div>
          <div class="fcst-area-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${areaPct}" aria-label="${escapeHtml(area.label)}"><div class="fcst-area-fill" style="width: ${areaPct}%"></div></div>
          <span class="fcst-area-sub">${escapeHtml(t('fcst_remaining', null, { amount: formatAmount(area.remainingCents / 100) }))}</span>
        </div>`;
      }).join('');
    }
  }

  // SISP-70: Multi-Month Growth & Finance Matrix — 3/6/12-month
  // side-by-side comparison under the thermometer, every figure from
  // its own source engine (allocation engine, P&L, SISP-16 downtime,
  // join/archive stamps). Read-only presentation.
  if (multiMonthMatrixController) {
    try { multiMonthMatrixController.refresh(); } catch { /* section is optional chrome */ }
  }

  // Wire #homeActionDuesList
  const duesListBtn = $('#homeActionDuesList');
  if (duesListBtn && !duesListBtn.dataset?.wiredDues) {
    if (duesListBtn.dataset) duesListBtn.dataset.wiredDues = 'true';
    else duesListBtn.setAttribute('data-wired-dues', 'true');
    duesListBtn.addEventListener('click', () => {
      try {
        window.location.hash = '#/recovery';
      } catch {
        switchView('reports');
        $('#duesRecoveryPanel')?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  setupDashboardQuickActions({
    onReceivePayment: () => {
      if (window.quickCollectModalController?.open) {
        window.quickCollectModalController.open();
      } else {
        switchView('customers');
        openPaymentEntry();
      }
    },
    onAddCustomer: () => {
      $('#addCustomerForm').reset();
      $('#addCustomerError').hidden = true;
      resetDuplicateReview();
      $('#addCustomerDialog').showModal();
      $('#newCustomerName').focus();
    },
    onDuesList: () => {
      try {
        window.location.hash = '#/recovery';
      } catch {
        switchView('reports');
        $('#duesRecoveryPanel')?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    onDailyClosing: () => {
      const modal = $('#dailyClosingModal');
      if (modal?.showModal) modal.showModal();
    },
    onRecordExpense: () => { expenseActiveTab = 'ledger'; switchView('expenses'); renderExpenses(); },
    onMonthlyReport: () => { switchView('reports'); renderMonthlyReport(); },
    onAnalytics: () => { switchView('analytics'); renderAnalytics(); },
    onBackup: () => {
      const toggle = $('#backupControlsToggle');
      if (toggle) toggle.click();
      const panel = $('#backupControls');
      if (panel && !panel.hidden) panel.scrollIntoView({ behavior: 'smooth' });
    },
    onBriefing: () => {
      setupDashboardBriefingModal(state, referenceDate, { onToast: toast });
    }
  });
  setupDashboardBriefingModal(state, referenceDate, { onToast: toast });
  setupDashboardBriefingButton(state, referenceDate, { onToast: toast });
  setupDailyClosingCard(state, referenceDate, {
    getState: () => state,
    onToast: toast
  });
  setupHomeTodaySection({
    getState: () => state,
    getRefDate: () => referenceDate,
    doc: document,
    win: window
  });
  setupAreaDrilldownModal(state, referenceDate, {
    onFilterRoster: (areaName) => {
      switchView('customers');
      const searchInput = $('#customerSearch');
      if (searchInput) {
        searchInput.value = areaName;
        searchInput.dispatchEvent(new Event('input'));
      }
    }
  });
  setupCustomerHealthActions(state, referenceDate, {
    onFilterHealth: (category, healthData) => {
      switchView('customers');
      if (category === 'offline') {
        const offlineBtn = document.querySelector('[data-customer-service-filter="offline"]');
        if (offlineBtn) offlineBtn.click();
      } else if (category === 'goodStanding') {
        const paidBtn = document.querySelector('[data-customer-billing-filter="paid"]');
        if (paidBtn) paidBtn.click();
      } else if (category === 'watchlist') {
        const pendingBtn = document.querySelector('[data-customer-billing-filter="pending"]');
        if (pendingBtn) pendingBtn.click();
      } else if (category === 'delinquent') {
        const searchInput = $('#customerSearch');
        if (searchInput && healthData.delinquent?.customerIds?.length) {
          const cust = state.customers.find(c => c.id === healthData.delinquent.customerIds[0]);
          if (cust) {
            searchInput.value = cust.name;
            searchInput.dispatchEvent(new Event('input'));
          }
        }
      }
    }
  });
  setupChurnRiskModal(state, referenceDate, {
    onFilterCustomer: (customerName) => {
      switchView('customers');
      const searchInput = $('#customerSearch');
      if (searchInput) {
        searchInput.value = customerName;
        searchInput.dispatchEvent(new Event('input'));
      }
    }
  });
  setupAreaHeatmapEvents(state, referenceDate, {
    onFilterArea: (areaName) => {
      switchView('customers');
      const searchInput = $('#customerSearch');
      if (searchInput) {
        searchInput.value = areaName;
        searchInput.dispatchEvent(new Event('input'));
      }
    }
  });
  renderDashboardCharts(state, referenceDate, {
    onFilterCustomer: (customerName) => {
      switchView('customers');
      const searchInput = $('#customerSearch');
      if (searchInput) {
        searchInput.value = customerName;
        searchInput.dispatchEvent(new Event('input'));
      }
    },
    onToast: (msg) => {
      toast(msg);
    }
  });
  updateDataSafetyUi();
}
function initials(name) { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
function tenurePresentation(customer) {
  const tenure = summarizeCustomerTenure(customer, new Date());
  const monthLabel = tenure.serviceMonths === 1 ? t('prof_tenure_month_1') : t('prof_tenure_months', null, { n: tenure.serviceMonths });
  if (tenure.status === 'current') return { primary:monthLabel, detail:t('prof_tenure_connected_since', null, { date: humanDate(tenure.connectionDate) }) };
  if (tenure.status === 'ended') return { primary:monthLabel, detail:t('prof_tenure_ended', null, { date: humanDate(tenure.endDate) }) };
  if (tenure.status === 'future') return { primary:t('prof_tenure_not_started'), detail:t('prof_tenure_recorded_date', null, { date: humanDate(tenure.connectionDate) }) };
  if (tenure.status === 'end-date-unknown') return { primary:t('prof_tenure_end_unknown'), detail:t('prof_tenure_connected_duration_unknown', null, { date: humanDate(tenure.connectionDate) }) };
  if (tenure.status === 'date-review') return { primary:t('prof_tenure_check_dates'), detail:t('prof_tenure_end_before_connection', null, { date: humanDate(tenure.endDate) }) };
  return { primary:t('prof_not_recorded'), detail:tenure.profileAddedOn ? t('prof_tenure_profile_added', null, { date: humanDate(tenure.profileAddedOn) }) : t('prof_tenure_connection_not_recorded') };
}
// Uptime tracking: shared duration text (e.g. "28 days 18 hours") built
// from the upt_dur_* keys; zero parts are dropped, an all-zero duration
// reads "0 min".
function uptimeDurationText(totalMinutes) {
  const parts = splitMinutes(totalMinutes);
  const pieces = [];
  if (parts.days) pieces.push(parts.days === 1 ? t('upt_dur_day_1') : t('upt_dur_days', null, { n: parts.days }));
  if (parts.hours) pieces.push(parts.hours === 1 ? t('upt_dur_hour_1') : t('upt_dur_hours', null, { n: parts.hours }));
  if (parts.minutes) pieces.push(parts.minutes === 1 ? t('upt_dur_min_1') : t('upt_dur_mins', null, { n: parts.minutes }));
  return pieces.length ? pieces.join(' ') : t('upt_dur_zero');
}
// Live status-session counter (owner feature): how long the customer
// has been in their CURRENT service status ("🟢 Online · 12 days
// 5 hours · since …"), counted from the recorded status history via
// uptime-tracking.js currentStatusSession. ONE shared text builder +
// markup feeds both the customer cards and the profile uptime panel,
// so the two surfaces can never disagree; the per-minute ticker at
// boot rewrites only these nodes' text (never a list re-render).
function formatSessionInstant(ms) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: PAKISTAN_TIME_ZONE }).format(new Date(ms));
}
function liveSessionText(customer, now = new Date()) {
  const session = currentStatusSession(customer, now);
  if (session.precision === 'datetime') {
    return t(session.status === 'offline' ? 'upt_live_offline' : 'upt_live_online', null, { duration: uptimeDurationText(session.totalMinutes), datetime: formatSessionInstant(session.sinceMs) });
  }
  if (session.precision === 'date') {
    // Legacy record without a status stamp: whole days from the
    // recorded connection/profile date — no invented hours.
    return t('upt_live_active_since', null, { duration: uptimeDurationText(session.totalMinutes), date: humanDate(session.sinceDate) });
  }
  return '';
}
function liveSessionMarkup(customer) {
  const text = liveSessionText(customer);
  if (!text) return '';
  const tone = customer.serviceStatus === 'offline' ? 'is-offline' : 'is-online';
  return `<p class="status-session-line ${tone}" data-live-session-for="${escapeHtml(customer.id)}">${escapeHtml(text)}</p>`;
}
// Uptime tracking: the profile age stamp — how many months + days this
// profile/connection has existed, from the recorded connection date
// (falling back to the profile-added date, labelled as such). No date
// is ever invented: with neither recorded, the card says so.
function profileAgeMarkup(customer) {
  const age = summarizeProfileAge(customer, new Date());
  let primary;
  let detail;
  if (age.months !== null) {
    const pieces = [];
    if (age.months) pieces.push(age.months === 1 ? t('upt_age_month_1') : t('upt_age_months', null, { n: age.months }));
    if (age.days) pieces.push(age.days === 1 ? t('upt_age_day_1') : t('upt_age_days', null, { n: age.days }));
    primary = pieces.length ? pieces.join(' · ') : t('upt_age_less_day');
    detail = age.basis === 'profile'
      ? t('prof_tenure_profile_added', null, { date: humanDate(age.startDate) })
      : (age.status === 'ended' && age.endDate
        ? t('prof_tenure_ended', null, { date: humanDate(age.endDate) })
        : t('prof_tenure_connected_since', null, { date: humanDate(age.startDate) }));
  } else if (age.status === 'future') {
    primary = t('prof_tenure_not_started');
    detail = t('prof_tenure_recorded_date', null, { date: humanDate(age.startDate) });
  } else {
    primary = t('prof_not_recorded');
    detail = age.basis === 'profile' ? t('prof_tenure_profile_added', null, { date: humanDate(age.startDate) }) : t('prof_tenure_connection_not_recorded');
  }
  return `<article class="profile-summary-stat profile-summary-age"><span>${t('upt_age_label')}</span><strong>${escapeHtml(primary)}</strong><small>${escapeHtml(detail)}</small></article>`;
}
let selectedUptimeMonth = null;
// Uptime tracking panel: month summary (real calendar days, online vs
// offline) + the recorded offline periods with their reasons for the
// chosen month. Periods come from the complaint/outage records and the
// service-status history (see uptime-tracking.js) — nothing is
// monitored or estimated.
function renderUptimePanel(customer) {
  const body = $('#uptimeSummaryBody');
  const select = $('#uptimeMonthSelect');
  if (!body || !select) return;
  const months = monthsForHistory();
  if (!selectedUptimeMonth || !months.includes(selectedUptimeMonth)) selectedUptimeMonth = months[0];
  select.innerHTML = months.map(month => `<option value="${month}"${month === selectedUptimeMonth ? ' selected' : ''}>${escapeHtml(displayMonthName(month))}</option>`).join('');
  const summary = buildMonthlyUptime(customer, selectedUptimeMonth, new Date());
  const formatInstant = ms => new Intl.DateTimeFormat(undefined, { dateStyle:'medium', timeStyle:'short', timeZone:PAKISTAN_TIME_ZONE }).format(new Date(ms));
  const stats = `<div class="uptime-summary-grid"><article class="uptime-stat"><span>${t('upt_online_label')}</span><strong>${escapeHtml(uptimeDurationText(summary.onlineMinutes))}</strong></article><article class="uptime-stat"><span>${t('upt_offline_label')}</span><strong>${escapeHtml(uptimeDurationText(summary.offlineMinutes))}</strong></article><article class="uptime-stat"><span>${t('upt_month_days_label')}</span><strong>${summary.daysInMonth}</strong></article></div>`;
  const partial = summary.lifetimeClamped && summary.lifetimeStart ? `<p class="uptime-note">${escapeHtml(t('upt_partial_note', null, { date: humanDate(summary.lifetimeStart) }))}</p>` : '';
  // Live current-status counter (shared with the customer cards).
  // When it already states the very same open offline span, the older
  // "currently offline" line would only repeat it, so it stands down;
  // a record-based open span (different start) keeps its own line.
  const session = currentStatusSession(customer, new Date());
  const liveLine = liveSessionMarkup(customer);
  const sameOpenSpan = session.precision === 'datetime' && session.status === 'offline' && summary.openSinceMs === session.sinceMs;
  const currently = summary.openSinceMs !== null && !sameOpenSpan ? `<p class="uptime-current">🔴 ${escapeHtml(t('upt_currently_offline', null, { datetime: formatInstant(summary.openSinceMs) }))}</p>` : '';
  const periods = summary.periods.length
    ? `<h4 class="uptime-periods-heading">${t('upt_periods_heading')}</h4><ul class="uptime-period-list">${summary.periods.map(period => {
      const range = t('upt_period_range', null, { from: formatInstant(period.startMs), to: period.open ? t('upt_period_open') : formatInstant(period.endMs) });
      const reason = period.reason || (period.source === 'status' ? t('upt_reason_status') : t('upt_reason_none'));
      return `<li class="uptime-period"><div class="uptime-period-head"><strong>${escapeHtml(uptimeDurationText(period.minutes))}</strong><span>${escapeHtml(range)}</span></div><p class="uptime-period-reason">${escapeHtml(reason)}</p></li>`;
    }).join('')}</ul>`
    : `<p class="uptime-note">${escapeHtml(t('upt_none_offline'))}</p>`;
  body.innerHTML = `${liveLine}${stats}${partial}${currently}${periods}`;
}
// Phase 3 mirror of buildCustomerPaymentBehavior's averageMonthlyPaymentBasis:
// the behavior object carries the sentence, not the priced-month count, so
// the profile re-derives the count with the engine's exact rule (valid
// price + month <= current Pakistan month). No engine module changes.
function profileAvgPaymentBasis(customer) {
  const pricedMonths = new Set((customer.bills ?? []).filter(bill => bill?.dueAmount !== null && bill?.dueAmount !== undefined && bill?.dueAmount !== '' && Number.isFinite(Number(bill.dueAmount)) && Number(bill.dueAmount) > 0 && bill.month <= pakistanMonthNow()).map(bill => bill.month)).size;
  if (pricedMonths === 0) return t('prof_stat_avg_basis_none');
  return pricedMonths === 1 ? t('prof_stat_avg_basis_1', null, { months: pricedMonths }) : t('prof_stat_avg_basis_n', null, { months: pricedMonths });
}
function profileReceiptSummaryMarkup(customer) {
  const receipts = summarizeCustomerReceipts(customer);
  const tenure = tenurePresentation(customer);
  const allocations = calculatePaymentAllocations(state);
  const behavior = buildCustomerPaymentBehavior(state, customer, new Date(), allocations);
  const health = behavior?.health;
  const pendingCreditCents = [...allocations.byPaymentId.values()].filter(row => row.customerId === customer.id).reduce((sum,row) => sum + (row.unappliedCreditCents ?? 0), 0);
  const receiptRows = receipts.monthly.map(row => `<li class="receipt-month-row"><span>${escapeHtml(displayMonthName(row.month))}</span><strong>${escapeHtml(formatAmount(row.amount))}</strong><small>${row.receiptCount === 1 ? t('prof_stat_receipt_1', null, { count: row.receiptCount }) : t('prof_stat_receipt_n', null, { count: row.receiptCount })}</small></li>`).join('');
  const lastPayment = behavior?.receipts[0] ?? null;
  const healthCategoryKey = { 'Good': 'prof_health_cat_good', 'Risk': 'prof_health_cat_risk', 'Critical': 'prof_health_cat_critical' }[health?.category];
  const scoreText = health?.score === null || health?.score === undefined ? t('prof_health_score_null') : t('prof_health_score', null, { score: health.score, category: healthCategoryKey ? t(healthCategoryKey) : health.category });
  const scoreReasons = (health?.reasons ?? []).map(reason => `<li>${escapeHtml(reason)}</li>`).join('');
  const behaviorCards = behavior ? `<article class="profile-summary-stat"><span>${t('prof_receipts_outstanding')}</span><strong>${escapeHtml(formatAmount(behavior.totalOutstanding))}</strong><small>${t('prof_stat_credit_tracked')}</small></article><article class="profile-summary-stat"><span>${t('prof_receipts_credit')}</span><strong>${pendingCreditCents ? escapeHtml(formatAmount(pendingCreditCents / 100)) : t('prof_none_recorded')}</strong><small>${t('prof_stat_prepaid')}</small></article><article class="profile-summary-stat"><span>${t('prof_receipts_avg')}</span><strong>${behavior.averageMonthlyPayment===null?t('prof_stat_not_calc'):escapeHtml(formatAmount(behavior.averageMonthlyPayment))}</strong><small>${escapeHtml(profileAvgPaymentBasis(customer))}</small></article><article class="profile-summary-stat"><span>${t('prof_receipts_delay')}</span><strong>${behavior.averagePaymentDelayDays===null?t('prof_not_recorded'):t('prof_stat_delay_days', null, { days: behavior.averagePaymentDelayDays })}</strong><small>${t('prof_stat_delay_pairs', null, { count: behavior.delaySampleCount })}</small></article><article class="profile-summary-stat"><span>${t('prof_receipts_range')}</span><strong>${behavior.highestPayment===null?t('prof_not_recorded'):`${escapeHtml(formatAmount(behavior.lowestPayment))}–${escapeHtml(formatAmount(behavior.highestPayment))}`}</strong><small>${t('prof_stat_range_sub')}</small></article><article class="profile-summary-stat"><span>${t('prof_receipts_late')}</span><strong>${behavior.latePaymentCount} / ${behavior.partialPaymentCount}</strong><small>${t('prof_stat_late_sub', null, { count: behavior.totalPayments })}</small></article><article class="profile-summary-stat"><span>${t('prof_receipts_consistency')}</span><strong>${behavior.paymentConsistency===null?t('prof_health_cat_insufficient'):`${behavior.paymentConsistency}%`}</strong><small>${t('prof_stat_consistency_sub', null, { settled: behavior.consistencySettledMonths, bill: behavior.consistencyBillMonths })}</small></article><article class="profile-summary-stat"><span>${t('prof_receipts_last')}</span><strong>${lastPayment?escapeHtml(formatAmount(lastPayment.amount)):t('prof_not_recorded')}</strong><small>${lastPayment?escapeHtml(t('prof_stat_last_receipt', null, { date: humanDate(lastPayment.date) })): t('prof_stat_last_none')}</small></article>` : '';
  return `<section class="customer-receipt-summary" aria-label="${t('prof_receipts_aria')}"><div class="profile-summary-heading"><h3>${t('prof_receipts_heading')}</h3><button type="button" class="secondary-button profile-summary-edit-btn" data-edit-customer="${escapeHtml(customer.id)}">✏️ ${t('prof_receipts_edit')}</button></div><div class="profile-summary-grid"><article class="profile-summary-stat profile-summary-receipts"><span>${t('prof_receipts_total')}</span><strong>${receipts.receiptCount ? escapeHtml(formatAmount(receipts.total)) : t('prof_receipts_none')}</strong><small>${receipts.receiptCount ? (receipts.receiptCount === 1 ? t('prof_stat_total_small_1', null, { count: receipts.receiptCount }) : t('prof_stat_total_small_n', null, { count: receipts.receiptCount })) : t('prof_stat_receipts_none_note')}</small></article><article class="profile-summary-stat profile-summary-tenure"><span>${t('prof_receipts_tenure')}</span><strong>${escapeHtml(tenure.primary)}</strong><small>${escapeHtml(tenure.detail)}</small></article>${profileAgeMarkup(customer)}${behaviorCards}</div><section class="customer-health-summary" aria-label="${t('prof_health_aria')}"><strong>${escapeHtml(scoreText)}</strong><details><summary>${t('prof_health_basis')}</summary><ul>${scoreReasons || `<li>${t('prof_health_none')}</li>`}</ul></details></section><div class="receipt-month-history"><div class="receipt-month-heading"><strong>${t('prof_receipts_by_month')}</strong><span>${t('prof_receipts_by_month_sub')}</span></div>${receiptRows ? `<ul class="receipt-month-list" aria-label="${t('prof_receipts_by_month_aria')}">${receiptRows}</ul>` : `<p class="receipt-month-empty">${t('prof_receipts_by_month_empty')}</p>`}</div></section>`;
}
function customerCardMarkup(customer, archived = false, allocations = calculatePaymentAllocations(state)) {
  const receipts = summarizeCustomerReceipts(customer);
  const cardIsUr = currentAppLanguage() === 'ur';
  const tenure = cardIsUr ? buildUrduTenure(customer) : tenurePresentation(customer);
  const monthBill = (customer.bills ?? []).find(bill => bill.month === selectedBillingMonth);
  const billing = statusPresentation(customer, monthBill);
  const CUST_BILL_WORDS = { paid: 'cust_bill_paid', pending: 'cust_bill_pending', partial: 'cust_bill_partial', 'not-set': 'cust_not_set' };
  const billWord = t(CUST_BILL_WORDS[billing.value] || 'cust_not_set');
  const isFeeSet = customer.monthlySellingAmount !== null && customer.monthlySellingAmount !== undefined && Number(customer.monthlySellingAmount) > 0;
  const chipText = isFeeSet
    ? (billing.value === 'not-set' ? t('cust_card_chip_fee', null, { amount: customer.monthlySellingAmount }) : `${billWord} · ${t('cust_card_chip_fee', null, { amount: customer.monthlySellingAmount })}`)
    : (billing.value === 'not-set' ? t('cust_bill_not_set') : billWord);
  const CUST_SERVICE_WORDS = { active: 'cust_service_active', offline: 'cust_service_offline', 'not-set': 'cust_not_set' };
  const manualStatus = t('cust_service_status_chip', null, { status: t(CUST_SERVICE_WORDS[customer.serviceStatus] || 'cust_not_set') });
  const health = buildCustomerHealthScore(state, customer, new Date(), allocations);
  const CUST_HEALTH_CATS = { 'Insufficient history': 'cust_health_cat_insufficient', 'Insufficient recorded metrics': 'cust_health_cat_insufficient_metrics', 'Strong recorded indicators': 'cust_health_cat_strong', 'Mixed recorded indicators': 'cust_health_cat_mixed', 'Needs attention': 'cust_health_cat_attention' };
  const healthLabel = health?.score === null || !health ? `${t('cust_card_health')} · ${t('cust_health_cat_insufficient')}` : `${t('cust_card_health')} · ${health.score}/100 · ${CUST_HEALTH_CATS[health.category] ? t(CUST_HEALTH_CATS[health.category]) : health.category}`;
  const healthReasons = (health?.reasons ?? []).map(reason => `<li>${escapeHtml(reason)}</li>`).join('');
  const receiptValue = receipts.receiptCount ? formatAmount(receipts.total) : t('cust_card_no_receipts');
  const receiptCount = receipts.receiptCount ? (cardIsUr ? t('cust_card_recorded_receipts', null, { count: receipts.receiptCount }) : plural(receipts.receiptCount, 'recorded receipt')) : t('cust_card_no_payment_entries');
  const openLabel = t('cust_card_open_profile_title', null, { number: customer.customerNumber, name: customer.name, receipts: receiptValue, health: healthLabel, tenurePrimary: tenure.primary, tenureDetail: tenure.detail });
  const serviceButtons = ['active','offline','not-set'].map(status => {
    const label = t(CUST_SERVICE_WORDS[status]);
    const selected = status === customer.serviceStatus;
    return `<button class="service-choice service-choice-${status} ${selected ? 'is-selected' : ''}" type="button" data-set-service="${escapeHtml(customer.id)}" data-service-status="${status}" aria-pressed="${selected}" aria-label="${t('cust_service_button_aria', null, { number: customer.customerNumber, status: label })}">${label}</button>`;
  }).join('');
  return `<li class="customer-item ${archived ? 'archived-customer-item' : ''}"><button class="customer-select customer-profile-card-open" type="button" data-customer-id="${escapeHtml(customer.id)}" aria-current="${customer.id === selectedCustomerId}" title="${escapeHtml(openLabel)}"><span class="customer-card-heading"><span class="avatar" aria-hidden="true">${escapeHtml(initials(customer.name))}</span><span class="customer-copy"><span class="customer-number-line">#${customer.customerNumber}${archived ? ` · ${t('cust_card_archived')}` : ''}${customer.isFreeConnection ? ` <span class="free-connection-badge">${t('cust_free_badge')}</span>` : ''} ${prepaidUntilBadgeHtml(state, customer)} ${loyaltyBadgeHtml(customer)} ${sameNameBadgeHtml(state, customer)}</span><span class="customer-name" dir="auto">${escapeHtml(displayCustomerName(customer, currentAppLanguage()))}</span>${manualBaqayaCardBadgeMarkup(customer)}</span><span class="customer-manual-state">${escapeHtml(manualStatus)}</span></span><span class="customer-card-stats"><span class="customer-card-stat"><span>${t('cust_card_actually_received')}</span><strong>${escapeHtml(receiptValue)}</strong><small>${escapeHtml(receiptCount)}</small></span><span class="customer-card-stat"><span>${t('cust_card_time_with_isp')}</span><strong>${escapeHtml(tenure.primary)}</strong><small>${escapeHtml(tenure.detail)}</small></span></span><span class="customer-card-package">${escapeHtml(customer.packageSpeed || t('cust_card_package_not_set'))}</span><span class="customer-health-badge health-${escapeHtml((health?.category??'unknown').toLowerCase().replaceAll(' ','-'))}">${escapeHtml(healthLabel)}</span><span class="customer-card-open-hint">${t('cust_card_open_hint')} <span aria-hidden="true">${cardIsUr ? '←' : '→'}</span></span></button><details class="customer-health-reasons"><summary>${t('cust_card_health_reasons')}</summary><ul>${healthReasons || `<li>${t('cust_card_health_none')}</li>`}</ul></details><div class="customer-card-controls"><span role="button" tabindex="0" class="customer-billing-badge ${billing.className} ${isFeeSet ? 'has-fee' : 'no-fee'}" data-inline-bill-edit="${escapeHtml(customer.id)}" data-bill-unset="${!isFeeSet}" aria-label="${escapeHtml(t('cust_card_bill_badge_aria', null, { chip: chipText, month: displayMonthName(selectedBillingMonth), label: billWord, action: t(isFeeSet ? 'cust_card_bill_action_edit' : 'cust_card_bill_action_set') }))}">${escapeHtml(chipText)}</span><div class="service-choice-group" role="group" aria-label="${t('cust_service_group_aria', null, { number: customer.customerNumber, name: customer.name })}">${serviceButtons}</div>${liveSessionMarkup(customer)}</div>${archived ? `<button class="archived-unarchive-button" type="button" data-unarchive-customer="${escapeHtml(customer.id)}">${t('cust_card_unarchive')}</button>` : ''}</li>`;
}
let customerCurrentPage = 1;
let customerPageSize = 15;
let customerSortBy = 'number-asc';
let customerAreaFilter = 'all';
let customerSearchField = 'name';
let customerViewMode = (typeof localStorage !== 'undefined' && localStorage.getItem('shahdara_customer_view_mode')) || 'cards';

// New-customers panel (customer ledger): view-only monthly join counts and
// onboarding totals over saved customers. Join months come from
// buildNewCustomerReport; this function never rewrites any saved value.

// Urdu auto-translation phases 1-3: month names on the Customers +
// Dashboard + Profile screens. Other screens keep monthName() until their
// own phase; only the customers + dashboard + profile renderers call this
// helper. The fallback calls monthName(), never itself (a self-call here
// recursed forever in English mode, where the Urdu branch never returns).
const CUST_MONTH_KEYS = { '01': 'cust_month_jan', '02': 'cust_month_feb', '03': 'cust_month_mar', '04': 'cust_month_apr', '05': 'cust_month_may', '06': 'cust_month_jun', '07': 'cust_month_jul', '08': 'cust_month_aug', '09': 'cust_month_sep', '10': 'cust_month_oct', '11': 'cust_month_nov', '12': 'cust_month_dec' };
function displayMonthName(month) {
  const raw = String(month || '');
  if (currentAppLanguage() === 'ur' && /^\d{4}-\d{2}$/.test(raw)) {
    const key = CUST_MONTH_KEYS[raw.slice(5, 7)];
    if (key) return `${t(key)} ${raw.slice(0, 4)}`;
  }
  return monthName(month);
}

// Urdu tenure lines for customer cards (phase 1). tenurePresentation() stays
// untouched so the profile screen is unchanged until its own phase; the card
// picks this version in Urdu mode only. Dates keep humanDate() output.
function buildUrduTenure(customer) {
  const tenure = summarizeCustomerTenure(customer, new Date());
  const months = t('cust_tenure_months', null, { months: tenure.serviceMonths });
  if (tenure.status === 'current') return { primary: months, detail: t('cust_tenure_connected_since', null, { date: humanDate(tenure.connectionDate) }) };
  if (tenure.status === 'ended') return { primary: months, detail: t('cust_tenure_ended', null, { date: humanDate(tenure.endDate) }) };
  if (tenure.status === 'future') return { primary: t('cust_tenure_not_started'), detail: t('cust_tenure_recorded_date', null, { date: humanDate(tenure.connectionDate) }) };
  if (tenure.status === 'end-date-unknown') return { primary: t('cust_tenure_end_unknown'), detail: t('cust_tenure_connected_duration_unknown', null, { date: humanDate(tenure.connectionDate) }) };
  if (tenure.status === 'date-review') return { primary: t('cust_tenure_check_dates'), detail: t('cust_tenure_end_before_connection', null, { date: humanDate(tenure.endDate) }) };
  return { primary: t('cust_tenure_not_recorded'), detail: tenure.profileAddedOn ? t('cust_tenure_profile_added', null, { date: humanDate(tenure.profileAddedOn) }) : t('cust_tenure_connection_not_recorded') };
}
function renderNewCustomersPanel() {
  const mount = $('#newCustomersPanel');
  if (!mount) return;
  const report = buildNewCustomerReport(state.customers, new Date());
  const ranges = newCustomerQuickRanges(new Date());
  const NEWCUST_RANGE_KEYS = { thisMonth: 'cust_newcust_this_month', lastMonth: 'cust_newcust_last_month', last3Months: 'cust_newcust_last_3_months', last6Months: 'cust_newcust_last_6_months' };
  let shown = [];
  let heading = '';
  if (newCustomersView === 'month' && newCustomersMonth) {
    shown = report.months.filter(entry => entry.month === newCustomersMonth);
    heading = displayMonthName(newCustomersMonth);
  } else {
    if (!ranges[newCustomersView]) newCustomersView = 'thisMonth';
    const range = ranges[newCustomersView];
    shown = filterNewCustomerMonths(report.months, range.start, range.end);
    const rangeLabel = t(NEWCUST_RANGE_KEYS[newCustomersView]);
    heading = range.start === range.end
      ? `${rangeLabel} · ${displayMonthName(range.start)}`
      : `${rangeLabel} · ${displayMonthName(range.start)} – ${displayMonthName(range.end)}`;
  }
  const totals = shown.reduce((sum, entry) => ({
    count: sum.count + entry.totals.count,
    connectionFees: sum.connectionFees + entry.totals.connectionFees,
    routersIssued: sum.routersIssued + entry.totals.routersIssued,
    routerTotal: sum.routerTotal + entry.totals.routerTotal,
    fiberMeters: sum.fiberMeters + entry.totals.fiberMeters
  }), { count: 0, connectionFees: 0, routersIssued: 0, routerTotal: 0, fiberMeters: 0 });
  totals.connectionFees = Math.round(totals.connectionFees * 100) / 100;
  totals.routerTotal = Math.round(totals.routerTotal * 100) / 100;
  totals.fiberMeters = Math.round(totals.fiberMeters * 10) / 10;
  const rows = shown.flatMap(entry => entry.customers.map(customer => {
    const onboarding = [];
    const panelIsUr = currentAppLanguage() === 'ur';
    if (customer.connectionFee !== null && customer.connectionFee !== undefined && Number(customer.connectionFee) > 0) onboarding.push(t('cust_newcust_fee', null, { amount: formatAmount(customer.connectionFee) }));
    if (String(customer.routerModel ?? '').trim()) onboarding.push(t('cust_newcust_router', null, { model: escapeHtml(customer.routerModel) }) + (customer.routerPrice !== null && customer.routerPrice !== undefined && Number(customer.routerPrice) > 0 ? ` (${formatAmount(customer.routerPrice)})` : ''));
    if (customer.fiberMeters !== null && customer.fiberMeters !== undefined && Number(customer.fiberMeters) > 0) onboarding.push(t('cust_newcust_fiber_m', null, { meters: customer.fiberMeters }));
    // SISP-23: per-installation subsidy/surplus badge on the ledger row.
    const installCost = calculateInstallationCost(customer);
    if (installCost.status === 'surplus') onboarding.push(t('cust_newcust_install_surplus', null, { amount: formatAmount(installCost.net) }));
    else if (installCost.status === 'subsidy') onboarding.push(t('cust_newcust_install_subsidy', null, { amount: formatAmount(installCost.subsidy) }) + (installCost.breakEvenMonths !== null ? (panelIsUr ? t('cust_newcust_install_breakeven_suffix', null, { months: installCost.breakEvenMonths }) : ` · break-even ${installCost.breakEvenMonths} bill${installCost.breakEvenMonths === 1 ? '' : 's'}`) : ''));
    else if (installCost.status === 'break-even') onboarding.push(t('cust_newcust_install_breakeven'));
    else if (installCost.status === 'unknown') onboarding.push(t('cust_newcust_install_unknown', null, { cost: formatAmount(installCost.totalCost) }));
    return `<li><button class="new-customer-row" type="button" data-customer-id="${escapeHtml(customer.id)}"><span class="new-customer-name">#${escapeHtml(customer.customerNumber)} ${escapeHtml(customer.name)}</span><span class="new-customer-meta">${escapeHtml(customer.mohalla || t('cust_newcust_area_not_set'))} · ${t('cust_newcust_joined', null, { month: entry.month })}</span><span class="new-customer-onb">${onboarding.length ? onboarding.join(' · ') : t('cust_newcust_onboarding_none')}</span></button></li>`;
  })).join('');
  const monthOptions = report.months.map(entry => `<option value="${escapeHtml(entry.month)}"${entry.month === newCustomersMonth ? ' selected' : ''}>${escapeHtml(displayMonthName(entry.month))} (${entry.totals.count})</option>`).join('');
  const panelIsUr = currentAppLanguage() === 'ur';
  mount.innerHTML = `<div class="new-customers-head"><div><p class="eyebrow">${t('cust_new_customers_eyebrow')}</p><h3>${t('cust_new_customers_by_month')}</h3></div><p class="new-customers-heading">${escapeHtml(heading)}</p></div>`
    + `<div class="new-customers-controls" role="group" aria-label="${t('cust_newcust_quick_views_aria')}">`
    + Object.entries(ranges).map(([key, range]) => `<button class="customer-filter-button" type="button" data-newcust-view="${key}" aria-pressed="${newCustomersView === key ? 'true' : 'false'}">${t(NEWCUST_RANGE_KEYS[key])}</button>`).join('')
    + `<label class="new-customers-month" for="newCustomersMonthSelect">${t('cust_newcust_month_label')} <select id="newCustomersMonthSelect"><option value="">${t('cust_newcust_choose_month')}</option>${monthOptions}</select></label></div>`
    + `<div class="new-customers-totals" role="status"><span>${t('cust_newcust_count', null, { count: `<strong>${totals.count}</strong>` })}</span><span>${t('cust_newcust_connection_fees')} <strong>${formatAmount(totals.connectionFees)}</strong></span><span><strong>${totals.routersIssued}</strong> ${t('cust_newcust_routers')} · <strong>${formatAmount(totals.routerTotal)}</strong></span><span>${t('cust_newcust_fiber')} <strong>${t('cust_newcust_fiber_meters', null, { meters: totals.fiberMeters })}</strong></span></div>`
    + (rows ? `<ul class="new-customers-list">${rows}</ul>` : `<p class="new-customers-empty">${t('cust_newcust_empty')}</p>`)
    + `<p class="new-customers-note">${t('cust_newcust_note')}${report.undatedCount ? (panelIsUr ? ` ${t('cust_newcust_undated', null, { count: report.undatedCount })}` : ` ${report.undatedCount} customer${report.undatedCount === 1 ? '' : 's'} have no join date (added before dates were recorded) and are not counted in any month.`) : ''}</p>`;
  mount.querySelectorAll('[data-newcust-view]').forEach(button => button.addEventListener('click', () => {
    newCustomersView = button.dataset.newcustView;
    newCustomersMonth = '';
    renderNewCustomersPanel();
  }));
  const monthSelect = $('#newCustomersMonthSelect');
  if (monthSelect) monthSelect.addEventListener('change', () => {
    if (!monthSelect.value) return;
    newCustomersView = 'month';
    newCustomersMonth = monthSelect.value;
    renderNewCustomersPanel();
  });
  mount.querySelectorAll('[data-customer-id]').forEach(button => button.addEventListener('click', () => selectCustomer(button.dataset.customerId)));
}
function renderCustomers() {
  const customerQuery = customerListQuery();
  const healthAllocations = calculatePaymentAllocations(state);

  // Sync unique areas into dropdown
  const areaSelect = $('#customerFilterArea');
  if (areaSelect) {
    const areaOptions = groupAreasWithCounts(state.customers.filter(c => !c.archived), c => (c.mohalla || c.area || '').trim(), raw => canonicalMohalla(raw)?.key ?? raw.toLowerCase(), raw => canonicalMohalla(raw)?.label ?? raw);
    const currentVal = customerAreaFilter;
    areaSelect.innerHTML = `<option value="all">${t('cust_all_areas')}</option>` + areaOptions.map(option => `<option value="${escapeHtml(option.value)}"${option.value === currentVal ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('');
    if (!areaOptions.some(option => option.value === currentVal) && currentVal !== 'all') {
      customerAreaFilter = 'all';
      areaSelect.value = 'all';
    } else {
      areaSelect.value = customerAreaFilter;
    }
  }

  const monthSelect = $('#customerFilterMonth');
  if (monthSelect) {
    monthSelect.innerHTML = monthsForHistory().map(month => `<option value="${escapeHtml(month)}">${escapeHtml(displayMonthName(month))}</option>`).join('');
    monthSelect.value = selectedBillingMonth;
  }

  const sortSelect = $('#customerSortSelect');
  if (sortSelect) sortSelect.value = customerSortBy;

  const searchFieldSelect = $('#customerSearchField');
  if (searchFieldSelect) searchFieldSelect.value = customerSearchField;

  // Owner feature: with a non-Name field picked, the typed query matches
  // ONLY that field (mobile digits / user ID / mohalla), so the broad
  // all-fields matcher is bypassed and the field filter runs on the
  // status-filtered roster instead. Name keeps the historical behaviour.
  const fieldScopedSearch = customerSearchField !== 'name' && customerQuery.trim() !== '';
  let filtered = filterCustomersByStatus(state, { serviceStatus:selectedServiceFilter, billingStatus:selectedBillingFilter, month:selectedBillingMonth, customerQuery: fieldScopedSearch ? '' : customerQuery });
  if (fieldScopedSearch) filtered = filterCustomersBySearchField(filtered, customerSearchField, customerQuery);
  if (customerAreaFilter !== 'all') {
    filtered = filterCustomersByArea(filtered, customerAreaFilter);
  }

  let active = filtered.filter(customer => !customer.archived);
  let archived = filtered.filter(customer => customer.archived);

  // Apply Sorting
  active = sortCustomerRoster(active, { sortBy: customerSortBy, billingMonth: selectedBillingMonth, allocations: healthAllocations });
  archived = sortCustomerRoster(archived, { sortBy: customerSortBy, billingMonth: selectedBillingMonth, allocations: healthAllocations });

  const searched = fieldScopedSearch ? filterCustomersBySearchField(state.customers, customerSearchField, customerQuery) : searchCustomers(state, customerQuery);
  const activeTotal = searched.filter(customer => !customer.archived).length;
  const archivedTotal = searched.filter(customer => customer.archived).length;

  // Pagination for Active Roster
  const paged = paginateRows(active, customerCurrentPage, customerPageSize);
  customerCurrentPage = paged.page;

  const pagNav = $('#customerPagination');
  if (pagNav) {
    pagNav.hidden = active.length === 0;
    const pageInfo = $('#customerPageInfo');
    if (pageInfo) pageInfo.textContent = t('cust_page_info', null, { page: paged.page, totalPages: paged.totalPages, total: active.length });
    const prevBtn = $('#customerPrevPage');
    if (prevBtn) prevBtn.disabled = paged.page <= 1;
    const nextBtn = $('#customerNextPage');
    if (nextBtn) nextBtn.disabled = paged.page >= paged.totalPages;
  }

  const tableWrap = $('#customerTableWrap');
  const tableBody = $('#customerRosterTableBody');
  const cardsBtn = $('#customerViewCardsBtn');
  const tableBtn = $('#customerViewTableBtn');
  const expandBtn = $('#customerTableExpandBtn');

  if (customerViewMode === 'table') {
    if (customerList) customerList.hidden = true;
    if (tableWrap) tableWrap.hidden = false;
    if (expandBtn) expandBtn.hidden = false;
    if (cardsBtn) { cardsBtn.classList.remove('is-active'); cardsBtn.setAttribute('aria-pressed', 'false'); }
    if (tableBtn) { tableBtn.classList.add('is-active'); tableBtn.setAttribute('aria-pressed', 'true'); }
    if (tableBody) {
      if (paged.items.length === 0) {
        tableBody.innerHTML = renderCustomerTableEmptyMarkup(customerQuery, customerAreaFilter);
        $('#resetCustomerTableFiltersBtn')?.addEventListener('click', () => {
          if ($('#customerListSearch')) $('#customerListSearch').value = '';
          if ($('#globalCustomerSearch')) $('#globalCustomerSearch').value = '';
          customerSearchField = 'name';
          if ($('#customerSearchField')) $('#customerSearchField').value = 'name';
          customerAreaFilter = 'all';
          if ($('#customerFilterArea')) $('#customerFilterArea').value = 'all';
          selectedServiceFilter = 'all';
          selectedBillingFilter = 'all';
          customerCurrentPage = 1;
          renderCustomers();
        });
      } else {
        tableBody.innerHTML = paged.items.map(customer => renderCustomerTableRowMarkup(customer, { selectedCustomerId, selectedBillingMonth, allocations: healthAllocations })).join('');
        tableBody.querySelectorAll('[data-customer-id]').forEach(button => button.addEventListener('click', () => selectCustomer(button.dataset.customerId)));
      }
    }
    document.querySelectorAll('#customerRosterTable th[data-sort-cust]').forEach(th => {
      const field = th.dataset.sortCust;
      const icon = th.querySelector('.sort-icon');
      if (customerSortBy.startsWith(field)) {
        th.classList.add('sort-active');
        const isDesc = customerSortBy.endsWith('-desc');
        th.setAttribute('aria-sort', isDesc ? 'descending' : 'ascending');
        if (icon) icon.textContent = isDesc ? '▼' : '▲';
      } else {
        th.classList.remove('sort-active');
        th.removeAttribute('aria-sort');
        if (icon) icon.textContent = '⇅';
      }
    });
  } else {
    if (customerList) {
      customerList.hidden = false;
      customerList.innerHTML = paged.items.map(customer => customerCardMarkup(customer, false, healthAllocations)).join('');
    }
    if (tableWrap) tableWrap.hidden = true;
    if (expandBtn) expandBtn.hidden = true;
    appShell.classList.remove('roster-table-expanded');
    if (cardsBtn) { cardsBtn.classList.add('is-active'); cardsBtn.setAttribute('aria-pressed', 'true'); }
    if (tableBtn) { tableBtn.classList.remove('is-active'); tableBtn.setAttribute('aria-pressed', 'false'); }
  }

  $('#archivedCustomerList').innerHTML = archived.map(customer => customerCardMarkup(customer, true, healthAllocations)).join('');
  $('#customerCount').textContent = selectedServiceFilter === 'all' && selectedBillingFilter === 'all' && customerAreaFilter === 'all' && active.length === activeTotal ? activeTotal : `${active.length}/${activeTotal}`;
  $('#archivedCustomerCount').textContent = archived.length === archivedTotal ? archivedTotal : `${archived.length}/${archivedTotal}`;
  $('#welcomeCount').textContent = state.customers.filter(customer => !customer.archived).length;
  const emptySearch = $('#noSearchResults');
  if (emptySearch) {
    emptySearch.textContent = customerQuery.trim() || customerAreaFilter !== 'all' ? t('cust_no_matching') : t('cust_no_match_filters');
    emptySearch.hidden = active.length > 0 || archived.length > 0;
  }
  document.querySelectorAll('[data-customer-service-filter]').forEach(button => button.setAttribute('aria-pressed', button.dataset.customerServiceFilter === selectedServiceFilter ? 'true' : 'false'));
  document.querySelectorAll('[data-customer-billing-filter]').forEach(button => button.setAttribute('aria-pressed', button.dataset.customerBillingFilter === selectedBillingFilter ? 'true' : 'false'));
  for (const list of [customerList,$('#archivedCustomerList')]) list.querySelectorAll('[data-customer-id]').forEach(button => button.addEventListener('click', () => selectCustomer(button.dataset.customerId)));
  for (const list of [customerList,$('#archivedCustomerList')]) list.querySelectorAll('[data-set-service]').forEach(button => button.addEventListener('click', () => setManualServiceStatus(button.dataset.setService, button.dataset.serviceStatus)));
  $('#archivedCustomerList').querySelectorAll('[data-unarchive-customer]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); restoreCustomer(button.dataset.unarchiveCustomer); }));
  renderNewCustomersPanel();
  updateNavigationBadges(state);
}
function setManualServiceStatus(customerId, serviceStatus) {
  const label = ({ active:'Active', offline:'Offline', 'not-set':'Not set' })[serviceStatus];
  if (!label) return;
  try {
    state = updateCustomerProfile(state, customerId, { serviceStatus });
    save();
    if (selectedCustomerId === customerId) {
      $('#serviceStatusInput').value = serviceStatus;
      if (!profileEditMode) renderDetail();
    }
    toast(`Manual service status set to ${label}. No connectivity monitoring is performed.`);
  } catch (error) { toast(error.message); }
}
function renderGlobalSearch() {
  const input = $('#globalCustomerSearch');
  const box = $('#globalCustomerResults');
  const options = $('#globalCustomerOptionList');
  const query = input.value.trim();
  if (!query) {
    box.hidden = true;
    options.innerHTML = '';
    $('#globalSearchResultCount').textContent = '';
    input.setAttribute('aria-expanded', 'false');
    $('#globalSearchStatus').textContent = '';
    return;
  }
  const matches = buildGlobalLedgerSearch(state, query, selectedBillingMonth);
  const shown = matches.slice(0, 12);
  options.innerHTML = shown.map(({customer,billing,receipts,receiptCount}) => {
    const receiptText = receipts.length ? `Recent receipts: ${receipts.map(row => `${humanDate(row.date)} · ${formatAmount(row.amount)} · ${row.method} · ${monthName(row.month)}`).join('  |  ')}${receiptCount > receipts.length ? ` · ${receiptCount - receipts.length} more saved` : ''}` : 'No payment receipts saved.';
    return `<button class="global-result-option" type="button" role="option" aria-selected="false" data-global-customer="${escapeHtml(customer.id)}"><span class="global-result-number">#${customer.customerNumber}${customer.archived ? ' · Archived' : ''}</span><span class="global-result-copy"><span class="global-result-name">${escapeHtml(customer.name)}</span><span class="global-result-ledger">${escapeHtml(monthName(billing.month))} · <strong class="customer-billing-badge ${escapeHtml(billing.statusClassName)}">${escapeHtml(billing.statusLabel)}</strong> · Bill ${escapeHtml(billing.billAmountLabel)} · Received ${escapeHtml(billing.receivedAmountLabel)} · Balance ${escapeHtml(billing.balanceDueLabel)}</span><span class="global-result-receipt">${escapeHtml(receiptText)}</span></span></button>`;
  }).join('') || '<div class="global-result-no-match" role="option" aria-disabled="true">No customer, bill, or receipt matches.</div>';
  $('#globalSearchResultCount').textContent = matches.length ? `Showing ${shown.length} of ${matches.length} customers with matching saved history. Service and billing filters affect the customer list only.` : 'Search includes saved customer details, bill status and amounts, and payment date, method, and amount.';
  box.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  $('#globalSearchStatus').textContent = `${matches.length} ${matches.length === 1 ? 'customer' : 'customers'} found with saved bill summaries and receipt history.`;
  options.querySelectorAll('[data-global-customer]').forEach(button => button.addEventListener('click', () => {
    const customerId = button.dataset.globalCustomer;
    box.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    selectCustomer(customerId);
  }));
}
function switchView(view, { pushHistory = true } = {}) {
  const views = { customers:['customersView','showCustomersButton'], transactions:['transactionsView','showTransactionsButton'], reports:['billingReportsView','showReportsButton'], analytics:['analyticsView','showAnalyticsButton'], inventory:['inventoryView','showInventoryButton'], expenses:['expensesView','showExpensesButton'], homeBudget:['homeBudgetView','showHomeBudgetButton'], loans:['loanView','showLoansButton'], waTemplates:['waTemplatesView','showWaTemplatesButton'] };
  if (!views[view]) view = 'customers';
  for (const [name, [sectionId, buttonId]] of Object.entries(views)) {
    const active = name === view;
    $(`#${sectionId}`).hidden = !active;
    $(`#${buttonId}`).setAttribute('aria-current', active ? 'page' : 'false');
  }
  const mobileView = view === 'transactions' ? 'collection' : view === 'reports' ? 'reports' : view === 'customers' ? 'customers' : 'more';
  document.querySelectorAll('[data-mobile-nav]').forEach(button => button.setAttribute('aria-current', button.dataset.mobileNav === mobileView ? 'page' : 'false'));
  navDrawer?.updateActive(view);
  tabSlider?.updateSlider();
  if (view === 'home') {
    mobileBreadcrumbs?.resetBreadcrumbs();
  } else {
    mobileBreadcrumbs?.setBreadcrumbs([
      { id: 'home', label: 'Home' },
      { id: view, label: view.charAt(0).toUpperCase() + view.slice(1) }
    ]);
  }
  if (view !== 'customers') appShell.classList.remove('show-detail');
  if (view !== 'customers') mobileActionSheetController?.clearContext();
  if (pushHistory && typeof window !== 'undefined' && window.location) {
    const targetHash = '#/' + view;
    if (window.location.hash !== targetHash) {
      try { history.pushState({ view }, '', targetHash); } catch {}
    }
  }
}
if (typeof window !== 'undefined') {
  window.switchView = switchView;
}
for (const [name, [tabId]] of Object.entries(profileTabMap)) $(`#${tabId}`).addEventListener('click', () => activateProfileTab(name));
$('.profile-tabs').addEventListener('keydown', event => {
  const names = Object.keys(profileTabMap);
  const current = names.indexOf(selectedProfileTab);
  let next = current;
  if (event.key === 'ArrowRight') next = (current + 1) % names.length;
  else if (event.key === 'ArrowLeft') next = (current + names.length - 1) % names.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = names.length - 1;
  else return;
  event.preventDefault();
  activateProfileTab(names[next], true);
});
function statusPresentation(customer, bill, allocations = null) {
  const value = derivedBillStatus(customer, bill, allocations);
  return {
    paid:{ label:t('prof_status_paid'), className:'status-received', value },
    pending:{ label:t('prof_status_pending'), className:'status-pending', value },
    partial:{ label:t('prof_status_partial'), className:'status-partial', value },
    'not-set':{ label:t('prof_not_set'), className:'status-empty', value }
  }[value];
}
function paymentAllocationMarkup(allocation) {
  if (!allocation) return '';
  const sameMonthCents = allocation.allocations.filter(item => item.kind === 'same-month').reduce((sum,item) => sum + item.amountCents, 0);
  const lines = [allocation.billUnpriced
    ? 'Selected month has no saved bill amount; this receipt is held as credit for later bills.'
    : `Applied to selected month: ${formatAmount(sameMonthCents / 100)}`];
  for (const item of allocation.allocations.filter(item => item.kind === 'carry-forward')) lines.push(`Auto-credit to ${monthName(item.month)}: ${formatAmount(item.amountCents / 100)} (allocation, not a new receipt)`);
  if (allocation.unappliedCreditCents) lines.push(`Credit waiting for a future generated bill: ${formatAmount(allocation.unappliedCreditCents / 100)}`);
  return `<span class="payment-allocation">${lines.map(escapeHtml).join('<br>')}</span>`;
}
function profilePaymentAllocationMarkup(allocation) {
  if (!allocation) return '';
  const sameMonthCents = allocation.allocations.filter(item => item.kind === 'same-month').reduce((sum,item) => sum + item.amountCents, 0);
  const lines = [allocation.billUnpriced
    ? t('prof_hist_alloc_unpriced')
    : t('prof_hist_alloc_same_month', null, { amount: formatAmount(sameMonthCents / 100) })];
  for (const item of allocation.allocations.filter(item => item.kind === 'carry-forward')) lines.push(t('prof_hist_alloc_carry', null, { month: displayMonthName(item.month), amount: formatAmount(item.amountCents / 100) }));
  if (allocation.unappliedCreditCents) lines.push(t('prof_hist_alloc_waiting', null, { amount: formatAmount(allocation.unappliedCreditCents / 100) }));
  return `<span class="payment-allocation">${lines.map(escapeHtml).join('<br>')}</span>`;
}
// SISP-76: native SMS slip beside the WhatsApp receipt — for keypad /
// non-WhatsApp customers. The sms: URI opens the phone's SMS composer
// with a short Roman Urdu draft; nothing is sent automatically. An
// SMS-valid number yields a link even when WhatsApp cannot draft
// (e.g. a locally saved 03xx number); an invalid number yields ''.
function receiptSmsSlipMarkup(customer, receipt) {
  const sms = buildSmsReceiptUrl({
    phone: customer.phone || '',
    customerName: customer.name || '',
    amount: receipt.amount,
    balanceDue: receipt.balanceDueCents === null || receipt.balanceDueCents === undefined ? null : receipt.balanceDueCents / 100,
    receiptNumber: receipt.receiptNumber || ''
  });
  if (!sms.valid) return '';
  return `<a class="receipt-whatsapp-action receipt-sms-action" href="${escapeHtml(sms.url)}" aria-label="${escapeHtml(t('sms_slip_aria', null, { number: customer.customerNumber, name: customer.name }))}">${escapeHtml(t('sms_slip_btn'))}</a>`;
}
function receiptWhatsAppActionMarkup(customer, receipt, { askLabel = null } = {}) {
  const action = resolveReceiptWhatsAppAction(customer, receipt);
  const smsMarkup = receiptSmsSlipMarkup(customer, receipt);
  if (action.type === 'phone-required') {
    // #298: in the payments list the button says "WhatsApp receipt" and asks for the number only when tapped.
    const label = askLabel || (action.hasSavedPhone ? 'Update WhatsApp number' : 'Add WhatsApp number');
    return `${smsMarkup}<button class="receipt-phone-help" type="button" data-edit-receipt-phone="${escapeHtml(customer.id)}" aria-label="${label} for customer #${escapeHtml(customer.customerNumber)} ${escapeHtml(customer.name)} before preparing this receipt" title="Use this customer's full international number including country code.">${label}</button>`;
  }
  if (action.type !== 'draft') return smsMarkup || '<span class="whatsapp-receipt-unavailable">Receipt draft unavailable for this customer.</span>';
  const whatsappMarkup = `<span class="receipt-whatsapp-action-wrap"><a class="receipt-whatsapp-action" href="${escapeHtml(action.draft.url)}" target="_blank" rel="noopener noreferrer" aria-label="Review WhatsApp receipt draft for customer #${escapeHtml(customer.customerNumber)} ${escapeHtml(customer.name)}; an internet connection is required to open WhatsApp; it will not send automatically" title="Draft prepared locally; internet is required to open WhatsApp.">WhatsApp receipt</a><small class="receipt-network-note">Internet required to open WhatsApp.</small></span>`;
  // SISP-76: an SMS-preference customer sees the SMS slip first.
  // SISP-91: decided by the ONE channel mapping (receiptChannelPreference),
  // so an explicit 'sms' channel and the legacy prefersSms flag agree.
  return receiptChannelPreference(customer) === 'sms' ? `${smsMarkup}${whatsappMarkup}` : `${whatsappMarkup}${smsMarkup}`;
}
function editCustomerPhoneFromReceipt(customerId) {
  if (!customerId || !state.customers.some(customer => customer.id === customerId)) return;
  selectCustomer(customerId);
  if (selectedCustomerId !== customerId) return;
  profileEditMode = true;
  renderDetail();
  activateProfileTab('info');
  const phoneInput = $('#phoneInput');
  phoneInput.focus();
  phoneInput.scrollIntoView({ behavior:'smooth', block:'center' });
  toast('Edit this customer’s international WhatsApp number, then select Save profile.');
}
function bindReceiptPhoneActions(container) {
  container.querySelectorAll('[data-edit-receipt-phone]').forEach(button => button.addEventListener('click', () => editCustomerPhoneFromReceipt(button.dataset.editReceiptPhone)));
}
function receiptFieldMarkup(label, value, className = '') {
  return `<div class="receipt-field"><dt>${escapeHtml(label)}</dt><dd class="${className}">${value ? escapeHtml(value) : '&nbsp;'}</dd></div>`;
}
function clearReceiptPrint() {
  document.body.classList.remove('printing-receipt', 'printing-thermal', 'printing-thermal-80', 'printing-thermal-58');
  const area = $('#receiptPrintArea');
  if (area) { area.hidden = true; area.replaceChildren(); }
}
// Receipt print fields: 'Nominal package price', 'Balance due after this payment'
function printPaymentReceipt(customerId, month, paymentId, { isThermal = false, format = isThermal ? 'thermal-80' : 'a4' } = {}) {
  const customer = state.customers.find(row => row.id === customerId);
  const bill = customer?.bills?.find(row => row.month === month);
  const payment = bill?.payments?.find(row => row.id === paymentId);
  if (!customer || !bill || !payment) { toast('This saved payment receipt is no longer available.'); return; }
  const receipt = buildPaymentReceipt(customer, bill, payment);
  const area = $('#receiptPrintArea');
  if (!area) return;

  const targetFormat = format === 'thermal-58' ? 'thermal-58' : (format === 'thermal-80' || isThermal) ? 'thermal-80' : 'a4';
  area.innerHTML = generatePaymentReceiptHtml(receipt, {
    format: targetFormat,
    businessName: state.settings?.businessName || 'Shahdara ISP',
    businessPhone: state.settings?.businessPhone || '0300-1234567'
  });
  area.hidden = false;
  document.body.classList.add('printing-receipt');
  if (targetFormat === 'thermal-58') {
    document.body.classList.add('printing-thermal-58');
  } else if (targetFormat === 'thermal-80') {
    document.body.classList.add('printing-thermal', 'printing-thermal-80');
  }
  requestAnimationFrame(() => {
    try { window.print(); }
    catch { toast('Printing is not available in this browser.'); }
    finally { clearReceiptPrint(); }
  });
}

// SISP-29: print the down-payment + kist schedule receipt into the same
// print area the standard receipts use, then print it the same way.
function printDownPaymentKistReceipt(customerForReceipt, plan, payment) {
  try {
    const receipt = buildDownPaymentKistReceipt(customerForReceipt, plan, payment);
    const area = $('#receiptPrintArea');
    if (!area) return;
    area.innerHTML = buildDownPaymentKistReceiptHtml(receipt, {
      businessName: state.settings?.businessName || 'Shahdara ISP',
      businessPhone: state.settings?.businessPhone || '0300-1234567'
    });
    area.hidden = false;
    document.body.classList.add('printing-receipt');
    requestAnimationFrame(() => {
      try { window.print(); }
      catch { toast('Printing is not available in this browser.'); }
      finally { clearReceiptPrint(); }
    });
  } catch (err) { toast(err?.message || 'Down-payment receipt could not be generated.'); }
}

// SISP-50: print the Final Disconnection Clearance Receipt into the
// same print area the standard receipts use, then print it the same
// way. The receipt reads the settlement stamped on the customer at
// settle time — it can never be produced for an unsettled deposit.
function printDepositSettlementReceipt(customerId) {
  const customer = state.customers.find(row => row.id === customerId);
  const receipt = customer ? buildDepositSettlementReceipt(customer) : null;
  if (!receipt) { toast('No deposit settlement is recorded for this customer.'); return; }
  const area = $('#receiptPrintArea');
  if (!area) return;
  area.innerHTML = generateDepositSettlementReceiptHtml(receipt, {
    businessName: state.settings?.businessName || 'Shahdara ISP',
    businessPhone: state.settings?.businessPhone || '0300-1234567'
  });
  area.hidden = false;
  document.body.classList.add('printing-receipt');
  requestAnimationFrame(() => {
    try { window.print(); }
    catch { toast('Printing is not available in this browser.'); }
    finally { clearReceiptPrint(); }
  });
}

// SISP-6: PNG image receipt — 1-tap share (WhatsApp target chooser on
// mobile/Capacitor) with a 1-click download fallback. Reuses the existing
// buildPaymentReceipt data path (SISP-2 arrears + SISP-4 kist included);
// the PNG itself is a white paper slip by design, like a bank slip.
async function downloadPngReceipt(customerId, month, paymentId) {
  const customer = state.customers.find(row => row.id === customerId);
  const bill = customer?.bills?.find(row => row.month === month);
  const payment = bill?.payments?.find(row => row.id === paymentId);
  if (!customer || !bill || !payment) { toast('This saved payment receipt is no longer available.'); return; }
  try {
    const receipt = buildPaymentReceipt(customer, bill, payment);
    const png = await generateReceiptPNG(receipt, customer, {
      businessName: state.settings?.businessName || 'Shahdara ISP',
      businessPhone: state.settings?.businessPhone || '0300-1234567',
    });
    const outcome = await shareOrDownloadPng(png);
    toast(outcome === 'shared' ? 'PNG receipt shared.' : 'PNG receipt downloaded.');
  } catch (err) {
    toast(`PNG receipt failed: ${err?.message || err}`);
  }
}

// #226: Bluetooth thermal printing. Every Bluetooth affordance stays hidden
// unless Web Bluetooth exists; the system-print slips above remain the
// fallback everywhere else.
function bluetoothReceiptButtonMarkup(customerId, month, paymentId, customerNumber) {
  if (!isWebBluetoothAvailable()) return '';
  return `<button class="print-receipt-button bluetooth-receipt-button" type="button" data-print-bluetooth-receipt data-customer-id="${escapeHtml(customerId)}" data-month="${escapeHtml(month)}" data-payment-id="${escapeHtml(paymentId)}" aria-label="Print receipt on Bluetooth printer for customer ${escapeHtml(customerNumber)}">BT print</button>`;
}
function profileBluetoothReceiptButtonMarkup(customerId, month, paymentId, customerNumber) {
  if (!isWebBluetoothAvailable()) return '';
  return `<button class="print-receipt-button bluetooth-receipt-button" type="button" data-print-bluetooth-receipt data-customer-id="${escapeHtml(customerId)}" data-month="${escapeHtml(month)}" data-payment-id="${escapeHtml(paymentId)}" aria-label="${t('prof_bt_print_aria', null, { number: customerNumber })}">${t('prof_bt_print')}</button>`;
}

async function printBluetoothReceipt(customerId, month, paymentId) {
  const customer = state.customers.find(row => row.id === customerId);
  const bill = customer?.bills?.find(row => row.month === month);
  const payment = bill?.payments?.find(row => row.id === paymentId);
  if (!customer || !bill || !payment) { toast('This saved payment receipt is no longer available.'); return; }
  try {
    if (!thermalPrinter.isConnected()) {
      toast('Choose your Bluetooth printer…');
      await thermalPrinter.connect();
    }
    const receipt = buildPaymentReceipt(customer, bill, payment);
    const fields = escPosFieldsFromPaymentReceipt(receipt, {
      businessName: state.settings?.businessName || 'Shahdara ISP',
      businessPhone: state.settings?.businessPhone || '0300-1234567'
    });
    await thermalPrinter.print(buildEscPosReceipt(fields).bytes);
    toast('Receipt sent to the Bluetooth printer.');
  } catch (err) {
    toast(`Bluetooth print failed: ${err?.message || err}`);
  }
}

function refreshBluetoothPrinterUi() {
  const available = isWebBluetoothAvailable();
  const tile = $('#mobileMoreBluetoothPrinterBtn');
  if (tile) tile.hidden = !available;
  const qcBtn = $('#quickCollectBluetoothPrintBtn');
  if (qcBtn) qcBtn.hidden = !available;
  const status = $('#bluetoothPrinterStatus');
  if (status) {
    if (!available) status.textContent = 'Web Bluetooth is not available in this browser. Use the 58mm/80mm slip buttons (system print) instead.';
    else if (thermalPrinter.isConnected()) status.textContent = 'Printer connected and ready.';
    else {
      const remembered = thermalPrinter.remembered();
      status.textContent = remembered
        ? `Remembered printer: ${remembered.name}. Tap Connect and pick it again (the browser asks once per session).`
        : 'No printer connected yet. Tap Connect printer and choose your 58mm printer.';
    }
  }
}

function setupBluetoothPrinterUi() {
  refreshBluetoothPrinterUi();
  const modal = $('#bluetoothPrinterModal');
  $('#mobileMoreBluetoothPrinterBtn')?.addEventListener('click', () => {
    refreshBluetoothPrinterUi();
    if (modal?.showModal) modal.showModal();
    else modal?.setAttribute('open', '');
  });
  $('#closeBluetoothPrinterModalBtn')?.addEventListener('click', () => {
    if (modal?.close) modal.close();
    else modal?.removeAttribute('open');
  });
  $('#connectBluetoothPrinterBtn')?.addEventListener('click', async () => {
    try {
      const info = await thermalPrinter.connect();
      toast(`Printer connected: ${info.name}`);
    } catch (err) {
      toast(`Could not connect: ${err?.message || err}`);
    }
    refreshBluetoothPrinterUi();
  });
  $('#disconnectBluetoothPrinterBtn')?.addEventListener('click', async () => {
    await thermalPrinter.disconnect();
    thermalPrinter.forget();
    toast('Printer disconnected and forgotten.');
    refreshBluetoothPrinterUi();
  });
  $('#testBluetoothPrinterBtn')?.addEventListener('click', async () => {
    try {
      if (!thermalPrinter.isConnected()) await thermalPrinter.connect();
      const { bytes } = buildEscPosReceipt({
        businessName: state.settings?.businessName || 'Shahdara ISP',
        businessPhone: state.settings?.businessPhone || '',
        receiptNumber: 'TEST',
        dateTimeLabel: new Date().toLocaleString('en-PK'),
        amount: 'PKR 0',
        statusLabel: 'TEST SLIP',
        footerNote: 'Bluetooth printer test — connection OK.'
      });
      await thermalPrinter.print(bytes);
      toast('Test slip sent to the printer.');
    } catch (err) {
      toast(`Test print failed: ${err?.message || err}`);
    }
    refreshBluetoothPrinterUi();
  });
}
if (typeof document !== 'undefined') setupBluetoothPrinterUi();

function billAmountAuditMarkup(bill) {
  const changes = bill?.amountHistory ?? [];
  if (!changes.length) return '';
  const items = changes.map(change => `<li>${escapeHtml(humanLocalDateTime(change.changedAt))}: ${escapeHtml(formatAmount(change.previousAmount))} → ${escapeHtml(formatAmount(change.newAmount))}</li>`).join('');
  return `<details class="bill-audit"><summary>${t('prof_hist_audit_title', null, { count: changes.length })}</summary><ol>${items}</ol></details>`;
}
function billPackageSelectorMarkup(bill, month) {
  const savedPlan = validateBillPackageSnapshot(bill?.packageSnapshot);
  const options = BILL_PACKAGES.map(plan => `<option value="${plan.id}" ${savedPlan?.packageId === plan.id ? 'selected' : ''}>${escapeHtml(plan.label)} — ${escapeHtml(formatAmount(plan.price))} / month</option>`).join('');
  return `<label class="field-label full" for="package-${month}">${t('prof_hist_pkg_label')} <span class="optional-label">${t('prof_hist_pkg_opt')}</span></label><select id="package-${month}" class="full" name="packageId" data-bill-package aria-describedby="package-help-${month}"><option value="" ${savedPlan ? '' : 'selected'}>${t('prof_hist_pkg_none')}</option>${options}</select><p id="package-help-${month}" class="field-help full">${t('prof_hist_pkg_help')}</p>`;
}
function renderHistory(customer) {
  const monthList = monthsForHistory();
  const byMonth = new Map(customer.bills.map(bill => [bill.month, bill]));
  const allocations = calculatePaymentAllocations(state);
  const allComplaints = loadComplaints();
  const openMonths = new Set(
    Array.from(historyContainer.querySelectorAll('details.month-card[open]'))
      .map(el => el.getAttribute('data-month-card'))
  );
  $('#customerEmptyNote').hidden = customer.bills.length > 0;
  historyContainer.innerHTML = monthList.map((month, idx) => {
    const isOpen = openMonths.has(month) || (openMonths.size === 0 && idx === 0);
    const bill = byMonth.get(month);
    const status = statusPresentation(customer, bill, allocations);
    const received = bill ? recordedAmount(bill) : 0;
    const effectiveAmount = bill?.dueAmount ?? null;
    const displayAmount = effectiveAmount === null || effectiveAmount === undefined ? t('prof_not_recorded') : formatAmount(effectiveAmount);
    const monthAllocation = allocations.forMonth(customer.id, month);
    const balanceDue = monthAllocation?.balanceDueCents === null || monthAllocation?.balanceDueCents === undefined ? t('prof_not_set') : formatAmount(monthAllocation.balanceDueCents / 100);
    const creditApplied = formatAmount((monthAllocation?.creditAppliedCents ?? 0) / 100);
    const activeHistoryMonths = new Set(monthList);
    const creditSourceMarkup = (monthAllocation?.creditSources ?? []).map(source => {
      const aged = !activeHistoryMonths.has(source.originMonth);
      const sourceControls = aged ? `<span class="carry-source-actions"><button class="edit-payment" type="button" data-edit-payment="${escapeHtml(source.paymentId)}" data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(source.originMonth)}" aria-label="${t('prof_hist_edit_source_aria', null, { date: humanDate(source.paymentDate) })}">${t('prof_hist_edit_source')}</button><button class="delete-payment" type="button" data-delete-payment="${escapeHtml(source.paymentId)}" data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(source.originMonth)}" aria-label="${t('prof_hist_delete_source_aria', null, { date: humanDate(source.paymentDate) })}">${t('prof_hist_delete_source')}</button></span>` : '';
      return `<div class="carry-credit-source" ${aged ? `data-payment-row="${escapeHtml(source.paymentId)}"` : ''}><span>${escapeHtml(t('prof_hist_credit_source', null, { month: displayMonthName(source.originMonth), date: humanDate(source.paymentDate), method: source.method, original: formatAmount(source.receiptAmount), applied: formatAmount(source.amountCents / 100) }))}</span>${sourceControls}</div>`;
    }).join('');
    const generatedNote = bill?.generated && bill.priceSnapshot !== null && bill.priceSnapshot !== undefined ? `<p class="bill-snapshot-note">${t('prof_hist_snapshot_note', null, { amount: formatAmount(bill.priceSnapshot) })}</p>` : '';
    const payments = (bill?.payments ?? []).map(payment => {
      // SISP-34: voided rows are frozen history — VOID badge + reason, no
      // Edit/Delete/receipt actions (core guards refuse those too).
      if (payment.voided === true) {
        return `<li class="payment-row payment-row-voided" data-payment-row="${escapeHtml(payment.id)}"><span class="payment-main"><span class="payment-amount">${escapeHtml(t('prof_hist_receipt_amount', null, { amount: formatAmount(payment.amount) }))}</span><span class="payment-meta">${escapeHtml(humanDate(payment.date))} · ${escapeHtml(payment.method)}${profilePaymentPayerMarkup(payment)}${profilePaymentSenderMarkup(payment)}${payment.note ? ` · ${escapeHtml(payment.note)}` : ''}</span>${payment.kind === 'advance' ? `<span class="advance-badge">${advanceBadgeLabel(payment)}</span>` : ''}${profileVoidBadgeMarkup(payment)}${paymentProofButtonMarkup(customer.id, month, payment)}</span></li>`;      }
      const allocation = profilePaymentAllocationMarkup(allocations.byPaymentId.get(payment.id));
      const receiptData = buildPaymentReceipt(customer, bill, payment);
      const discountMarkup = (payment.discount && Number(payment.discount) > 0) ? ` <span class="discount-badge-applied">${t('prof_hist_discount_badge', null, { amount: formatAmount(payment.discount) })}${payment.discountReason ? ` (${escapeHtml(payment.discountReason)})` : ''}</span>` : '';
      const advanceMarkup = payment.kind === 'advance' ? ` <span class="advance-badge">${advanceBadgeLabel(payment)}</span>` : '';
      return `<li class="payment-row" data-payment-row="${escapeHtml(payment.id)}"><span class="payment-main"><span class="payment-amount">${escapeHtml(t('prof_hist_receipt_amount', null, { amount: formatAmount(payment.amount) }))}${discountMarkup}${advanceMarkup}</span><span class="payment-meta">${escapeHtml(humanDate(payment.date))} · ${escapeHtml(payment.method)}${profilePaymentPayerMarkup(payment)}${profilePaymentSenderMarkup(payment)}${payment.note ? ` · ${escapeHtml(payment.note)}` : ''}</span>${allocation}</span><span class="payment-actions">${paymentProofButtonMarkup(customer.id, month, payment)}${receiptWhatsAppActionMarkup(customer, { customerId:customer.id, date:payment.date, amount:payment.amount, method:payment.method, paidBy:payment.paidBy, month, paymentId:payment.id, billStatus:receiptData.status === 'PAID' ? 'paid' : receiptData.status === 'PARTIAL' ? 'partial' : null, billAmount:receiptData.nominalPrice, balanceDueCents:receiptData.balanceDueCents, billDueDate:bill?.dueDate ?? null, arrearsBreakdown:buildArrearsBreakdown(customer, bill), fifoAllocation:receiptData.fifoAllocation, fifoRemaining:receiptData.fifoRemaining, fifoShow:receiptData.fifoShow, ticketCharges:receiptData.ticketCharges })}<button class="print-receipt-button" type="button" data-print-receipt data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(month)}" data-payment-id="${escapeHtml(payment.id)}" aria-label="${t('prof_hist_print_receipt_aria', null, { number: customer.customerNumber, date: payment.date })}">${t('prof_hist_print_receipt')}</button><button class="print-receipt-button thermal-receipt-button" type="button" data-print-thermal-receipt data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(month)}" data-payment-id="${escapeHtml(payment.id)}" aria-label="${t('prof_hist_slip80_aria', null, { number: customer.customerNumber })}">${t('prof_hist_slip80')}</button><button class="print-receipt-button thermal58-receipt-button" type="button" data-print-thermal58-receipt data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(month)}" data-payment-id="${escapeHtml(payment.id)}" aria-label="${t('prof_hist_slip58_aria', null, { number: customer.customerNumber })}">${t('prof_hist_slip58')}</button>${pngReceiptButtonMarkup(customer.id, month, payment.id, customer.customerNumber)}${profileBluetoothReceiptButtonMarkup(customer.id, month, payment.id, customer.customerNumber)}<button class="edit-payment" type="button" data-edit-payment="${escapeHtml(payment.id)}" data-customer-id="${escapeHtml(customer.id)}" data-month="${month}" aria-label="${t('prof_hist_edit_pay_aria', null, { number: customer.customerNumber })}">${t('prof_hist_edit_pay')}</button><button class="delete-payment" type="button" data-delete-payment="${escapeHtml(payment.id)}" data-customer-id="${escapeHtml(customer.id)}" data-month="${month}" aria-label="${t('prof_hist_delete_pay_aria', null, { number: customer.customerNumber })}">${t('prof_hist_delete_pay')}</button><button class="void-payment" type="button" data-void-payment="${escapeHtml(payment.id)}" data-customer-id="${escapeHtml(customer.id)}" data-month="${month}" aria-label="${t('prof_hist_void_pay_aria', null, { number: customer.customerNumber })}">${t('prof_hist_void_pay')}</button></span></li>`;    }).join('');
    const statusValue = status.value;
    const due = bill?.dueAmount ?? '';
    const hasPartial = statusValue === 'partial';
    const lateFeeMarkup = bill?.lateFee ? `<span class="month-summary-wide">${t('prof_hist_late_fee')}: <strong class="late-fee-badge-applied">+${formatAmount(bill.lateFee)}</strong> <small>(${escapeHtml(bill.lateFeeReason || t('prof_hist_owner_surcharge'))})</small> <button type="button" class="waive-late-fee-btn" data-waive-late-fee data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(month)}" title="${t('prof_hist_waive_title')}">${t('prof_hist_waive')}</button></span>` : '';
    const overdueEligible = bill && bill.dueDate && isBillOverdue(bill).isOverdue && (monthAllocation?.balanceDueCents ?? 0) > 0 && !bill.lateFee;
    const applyFeeBtnMarkup = overdueEligible ? `<span class="month-summary-wide"><button type="button" class="apply-late-fee-btn" data-apply-late-fee data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(month)}" title="${t('prof_hist_apply_fee_title')}">${t('prof_hist_apply_fee', null, { amount: getLateFeeConfig().defaultAmount })}</button></span>` : '';
    // SISP-30: outage concession badge + 1-click apply/remove. The gross
    // allocation balance stays as the audit trail; the net-due line shows
    // what the customer actually owes after the concession.
    const concessionSuggestion = bill ? buildConcessionSuggestion(customer, bill, allComplaints) : null;
    const concessionBalance = typeof monthAllocation?.balanceDueCents === 'number' ? monthAllocation.balanceDueCents / 100 : null;
    const concessionNetDue = concessionSuggestion?.alreadyApplied && concessionBalance !== null ? netDueAfterConcession(concessionBalance, concessionSuggestion.existingAmount) : null;
    const concessionAppliedMarkup = concessionSuggestion?.alreadyApplied ? `<span class="month-summary-wide">${t('prof_hist_concession_applied')}: <strong class="discount-badge-applied">−${formatAmount(concessionSuggestion.existingAmount)}</strong> <small>(${escapeHtml(concessionSuggestion.existingReason || t('prof_hist_concession_reason_default'))})</small> <button type="button" class="waive-late-fee-btn" data-remove-concession data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(month)}" title="${t('prof_hist_concession_remove_title')}">${t('prof_hist_concession_remove')}</button></span>` : '';
    const concessionSuggestMarkup = concessionSuggestion && !concessionSuggestion.alreadyApplied && concessionSuggestion.eligible ? `<span class="month-summary-wide"><span class="discount-badge-applied">${escapeHtml(t('prof_hist_concession_suggest', null, { hours: concessionSuggestion.downtimeHours, amount: concessionSuggestion.suggestedAmount }))}</span>${concessionBalance !== null && concessionBalance > 0 ? ` <button type="button" class="apply-late-fee-btn" data-apply-concession data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(month)}" title="${t('prof_hist_concession_apply_title')}">${t('prof_hist_concession_apply', null, { amount: concessionSuggestion.suggestedAmount })}</button>` : ''}</span>` : '';
    const concessionNetMarkup = concessionNetDue !== null ? `<span class="month-summary-stat">${t('prof_hist_net_after_concession')}: <strong>${formatAmount(concessionNetDue)}</strong></span>` : '';
    const summaryMarkup = !bill ? `<p class="empty-month">${t('prof_hist_empty_month')}</p>` : `<div class="month-summary"><span class="month-summary-stat">${t('prof_hist_status')}: <strong>${status.label}</strong></span><span class="month-summary-stat">${t('prof_hist_due_date')}: <strong>${bill.dueDate ? escapeHtml(humanDate(bill.dueDate)) : t('prof_hist_due_not_set')}</strong></span><span class="month-summary-stat">${t('prof_hist_receipts')}: <strong>${formatAmount(received)}</strong></span><span class="month-summary-stat">${t('prof_hist_carry_in')}: <strong>${creditApplied}</strong></span>${creditSourceMarkup}<span class="month-summary-stat">${t('prof_hist_bill_amount')}: <strong>${escapeHtml(displayAmount)}</strong></span>${lateFeeMarkup}${applyFeeBtnMarkup}${concessionAppliedMarkup}${concessionSuggestMarkup}<span class="month-summary-stat">${t('prof_hist_balance_due')}: <strong>${escapeHtml(balanceDue)}</strong></span>${concessionNetMarkup}${monthAllocation?.excessGeneratedCents ? `<span class="month-summary-stat">${t('prof_hist_credit_generated')}:  <strong>${formatAmount(monthAllocation.excessGeneratedCents / 100)}</strong></span>` : ''}${monthAllocation?.creditForwardedCents ? `<span class="month-summary-stat">${t('prof_hist_credit_forwarded')}: <strong>${formatAmount(monthAllocation.creditForwardedCents / 100)}</strong></span>` : ''}${monthAllocation?.pendingCreditCents ? `<span class="month-summary-stat">${t('prof_hist_credit_waiting')}: <strong>${formatAmount(monthAllocation.pendingCreditCents / 100)}</strong></span>` : ''}${hasPartial ? `<span class="month-status status-pending month-summary-wide">${t('prof_hist_partial_badge')}</span>` : ''}</div>${generatedNote}${billAmountAuditMarkup(bill)}`;
    const amountRequired = bill ? '' : 'required';
    const amountLabel = bill ? t('prof_optional') : t('prof_hist_bill_required');
    const amountPlaceholder = bill ? t('prof_hist_bill_amount_ph_blank') : t('prof_hist_bill_amount_ph_enter');
    const savedPackage = validateBillPackageSnapshot(bill?.packageSnapshot);
    const packageSelector = billPackageSelectorMarkup(bill, month);
    const archivedWithoutBill = customer.archived && !bill;
    const formsMarkup = archivedWithoutBill ? `<p class="notice">${t('prof_hist_archived_notice')}</p>` : `<div class="month-forms"><form class="form-card bill-form" data-kind="bill" data-month="${month}"><h4>${bill ? t('prof_hist_bill_update') : t('prof_hist_bill_record')}</h4><div class="form-grid">${packageSelector}<div class="form-cell"><label class="field-label full" for="due-${month}">${t('prof_hist_bill_amount_label')} <span class="optional-label">${amountLabel}</span></label><input id="due-${month}" class="full" name="dueAmount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="${amountPlaceholder}" value="${escapeHtml(due)}" ${amountRequired} ${savedPackage ? 'readonly' : ''}></div><div class="form-cell"><label class="field-label full" for="due-date-${month}">${t('prof_hist_due_date_label')}</label><input id="due-date-${month}" class="full" name="dueDate" type="date" value="${escapeHtml(bill?.dueDate ?? '')}"></div><p class="field-help full">${t('prof_hist_due_help')}</p><button class="primary-button" type="submit">${bill ? t('prof_hist_bill_save') : t('prof_hist_bill_record_btn')}</button></div></form><form class="form-card payment-form" data-kind="payment" data-month="${month}"><h4>${t('prof_hist_pay_title')}</h4><p class="field-help payment-guidance" id="payment-guidance-${month}" role="status">${t('prof_hist_pay_guidance')}</p><div class="form-grid"><div class="form-cell"><label class="field-label full" for="amount-${month}">${t('prof_hist_pay_amount_label')}</label><input id="amount-${month}" class="full" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="${t('prof_hist_pay_amount_ph')}" required></div><div class="form-cell"><label class="field-label full" for="method-${month}">${t('prof_hist_pay_method_label')}</label><select id="method-${month}" class="full" name="method" required><option value="">${t('prof_hist_pay_method_choose')}</option>${PAYMENT_METHODS.map(method => `<option value="${method}">${method}</option>`).join('')}</select></div><div class="form-cell">${paidByFieldMarkup(`paid-by-${month}`)}</div><div class="form-cell"><label class="field-label full" for="date-${month}">${t('prof_hist_pay_date_label')}</label><input id="date-${month}" class="full" name="date" type="date" max="${localDate()}" required></div><div class="form-cell"><label class="field-label full" for="txnid-${month}">${t('prof_hist_pay_txn_label')} <span class="optional-label">${t('prof_optional')}</span></label><input id="txnid-${month}" class="full" name="transactionId" type="text" maxlength="64" placeholder="${t('prof_hist_pay_txn_ph')}"></div><div class="form-cell"><label class="field-label full" for="sender-name-${month}">${t('spay_sender_name_label')} <span class="optional-label">${t('prof_optional')}</span></label><input id="sender-name-${month}" class="full" name="senderTitle" type="text" maxlength="100" placeholder="${t('spay_sender_name_ph')}"></div><div class="form-cell"><label class="field-label full" for="sender-digits-${month}">${t('spay_sender_digits_label')} <span class="optional-label">${t('prof_optional')}</span></label><input id="sender-digits-${month}" class="full" name="senderDigits" type="text" inputmode="numeric" maxlength="19" placeholder="${t('spay_sender_digits_ph')}"></div><div class="form-cell"><label class="field-label full" for="proof-${month}">${t('proof_attach_label')} <span class="optional-label">${t('prof_optional')}</span></label><input id="proof-${month}" class="full" name="proofScreenshot" type="file" accept="image/*"></div><div class="form-cell"><label class="field-label full" for="discount-${month}">${t('prof_hist_pay_discount_label')} <span class="optional-label">${t('prof_hist_discount_opt')}</span></label><input id="discount-${month}" class="full" name="discount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="${t('prof_hist_pay_discount_ph')}"></div><label class="field-label full" for="discount-reason-${month}">${t('prof_hist_pay_discount_reason')} <span class="optional-label">${t('prof_optional')}</span></label><input id="discount-reason-${month}" class="full" name="discountReason" type="text" maxlength="100" placeholder="${t('prof_hist_pay_discount_reason_ph')}">${billKistTotal(bill) > 0 ? `<label class="field-label full"><input type="checkbox" name="fifoPrioritizeKist"> ${t('prof_hist_fifo_first')} <span class="optional-label">${t('prof_hist_fifo_first_note')}</span></label>` : ''}<button class="primary-button" type="submit">${t('prof_hist_pay_submit')}</button></div></form></div>`;
    return `<details class="month-card" data-month-card="${month}" ${isOpen ? 'open' : ''}><summary><span class="month-label">${escapeHtml(displayMonthName(month))}</span><span class="history-count">${bill ? ((bill.payments?.length ?? 0) === 1 ? t('prof_hist_payments_1', null, { count: bill.payments?.length ?? 0 }) : t('prof_hist_payments_n', null, { count: bill.payments?.length ?? 0 })) : ''}</span><span class="month-status ${status.className}">${status.label}</span></summary><div class="month-body">${summaryMarkup}${formsMarkup}<ul class="payment-list" aria-label="${t('prof_hist_payments_for', null, { month: displayMonthName(month) })}">${payments}</ul></div></details>`;
  }).join('');
  historyContainer.querySelectorAll('form[data-kind="bill"]').forEach(form => form.addEventListener('submit', onBillSubmit));
  historyContainer.querySelectorAll('select[data-bill-package]').forEach(select => select.addEventListener('change', () => {
    const plan = billPackageById(select.value);
    select.form.dataset.packageSelectionChanged = 'true';
    const amount = select.form.elements.namedItem('dueAmount');
    if (plan) { amount.value = String(plan.price); amount.readOnly = true; select.form.dataset.clearPackageSnapshot = 'false'; }
    else { amount.readOnly = false; select.form.dataset.clearPackageSnapshot = 'true'; }
  }));
  historyContainer.querySelectorAll('form[data-kind="payment"]').forEach(form => form.addEventListener('submit', onPaymentSubmit));
  historyContainer.querySelectorAll('[data-edit-payment]').forEach(button => button.addEventListener('click', () => beginCorrection(button.dataset.customerId, button.dataset.month, button.dataset.editPayment, 'history')));
  historyContainer.querySelectorAll('[data-delete-payment]').forEach(button => button.addEventListener('click', () => requestDeletePayment(button.dataset.customerId, button.dataset.month, button.dataset.deletePayment)));
  historyContainer.querySelectorAll('[data-void-payment]').forEach(button => button.addEventListener('click', () => openVoidPaymentDialog(button.dataset.customerId, button.dataset.month, button.dataset.voidPayment)));
  historyContainer.querySelectorAll('[data-view-proof]').forEach(button => button.addEventListener('click', () => openPaymentProofDialog(button.dataset.customerId, button.dataset.month, button.dataset.paymentId)));
  historyContainer.querySelectorAll('[data-print-receipt]').forEach(button => button.addEventListener('click', () => printPaymentReceipt(button.dataset.customerId, button.dataset.month, button.dataset.paymentId)));
  historyContainer.querySelectorAll('[data-print-thermal-receipt]').forEach(button => button.addEventListener('click', () => printPaymentReceipt(button.dataset.customerId, button.dataset.month, button.dataset.paymentId, { isThermal: true })));
  historyContainer.querySelectorAll('[data-print-thermal58-receipt]').forEach(button => button.addEventListener('click', () => printPaymentReceipt(button.dataset.customerId, button.dataset.month, button.dataset.paymentId, { format: 'thermal-58' })));
  historyContainer.querySelectorAll('[data-png-receipt]').forEach(button => button.addEventListener('click', () => downloadPngReceipt(button.dataset.customerId, button.dataset.month, button.dataset.paymentId)));
  historyContainer.querySelectorAll('[data-print-bluetooth-receipt]').forEach(button => button.addEventListener('click', () => printBluetoothReceipt(button.dataset.customerId, button.dataset.month, button.dataset.paymentId)));
  historyContainer.querySelectorAll('[data-apply-late-fee]').forEach(button => button.addEventListener('click', () => {
    const custId = button.dataset.customerId;
    const month = button.dataset.month;
    const config = getLateFeeConfig();
    const promptAmount = window.prompt(`Enter late fee surcharge in PKR for bill ${month}:`, String(config.defaultAmount));
    if (promptAmount === null) return;
    const num = Number(promptAmount);
    if (!Number.isFinite(num) || num <= 0) { toast('Enter a valid positive number for late fee.'); return; }
    try {
      state = applyLateFeeToBill(state, custId, month, { amount: num, reason: config.reason });
      save(); renderDetail(); toast(`Late fee of PKR ${num} applied to bill ${month}.`);
    } catch (err) { toast(err.message); }
  }));
  historyContainer.querySelectorAll('[data-waive-late-fee]').forEach(button => button.addEventListener('click', async () => {
    const custId = button.dataset.customerId;
    const month = button.dataset.month;
    if (!(await appConfirm({ tone:'warning', title:'Waive late fee?', message:`Remove the late fee on bill ${month}? The bill goes back to its normal amount.`, confirmLabel:'Waive late fee' }))) return;
    try {
      state = waiveLateFeeFromBill(state, custId, month, { reason: 'Waived by owner' });
      save(); renderDetail(); toast(`Late fee waived on bill ${month}.`);
    } catch (err) { toast(err.message); }
  }));
  // SISP-30: 1-click outage concession apply/remove. The suggested amount is
  // recomputed at click time from fresh complaints, never trusted from markup.
  historyContainer.querySelectorAll('[data-apply-concession]').forEach(button => button.addEventListener('click', () => {
    const custId = button.dataset.customerId;
    const month = button.dataset.month;
    try {
      const target = state.customers.find(c => c.id === custId);
      const targetBill = target?.bills?.find(b => b.month === month);
      if (!target || !targetBill) throw new Error('Bill not found for this concession.');
      const suggestion = buildConcessionSuggestion(target, targetBill, loadComplaints());
      if (!suggestion.eligible) throw new Error('No outage concession is due for this bill month.');
      state = applyConcessionToBill(state, custId, month, { amount: suggestion.suggestedAmount, reason: suggestion.reason });
      save(); renderDetail(); toast(`Outage concession of PKR ${suggestion.suggestedAmount} applied to bill ${month}.`);
    } catch (err) { toast(err.message); }
  }));
  historyContainer.querySelectorAll('[data-remove-concession]').forEach(button => button.addEventListener('click', async () => {
    const custId = button.dataset.customerId;
    const month = button.dataset.month;
    if (!(await appConfirm({ tone:'warning', title:'Remove outage concession?', message:`Remove the outage concession on bill ${month}? The bill goes back to its full amount.`, confirmLabel:'Remove concession' }))) return;
    try {
      state = removeConcessionFromBill(state, custId, month, { reason: 'Outage concession removed by owner' });
      save(); renderDetail(); toast(`Outage concession removed from bill ${month}.`);
    } catch (err) { toast(err.message); }
  }));
  bindReceiptPhoneActions(historyContainer);
}
let transactionMethodFilter = 'all';
let transactionCurrentPage = 1;
let transactionPageSize = 15;
let transactionSortBy = 'date-desc';

let reportSearchQuery = '';
let reportCurrentPage = 1;
let reportPageSize = 15;
let reportSortBy = 'number-asc';

function renderTransactions() {
  const date = $('#transactionDateFilter').value;
  const recencyValue = $('#transactionRecencyFilter').value;
  const recencyDays = recencyValue === 'all' ? null : Number(recencyValue);
  let transactions = listTransactions(state, { customerQuery:searchQuery(), date, recencyDays });

  if (transactionMethodFilter !== 'all') {
    transactions = transactions.filter(tx => String(tx.method || '').toLowerCase() === transactionMethodFilter.toLowerCase());
  }

  const sortSelect = $('#transactionSortSelect');
  if (sortSelect) sortSelect.value = transactionSortBy;
  transactions = sortTransactionsList(transactions, transactionSortBy);

  const total = listTransactions(state).length;
  $('#transactionsCount').textContent = `${transactions.length} of ${total} recorded ${total === 1 ? 'payment' : 'payments'}`;
  $('#transactionsEmpty').hidden = transactions.length > 0;

  const summary = calculateTransactionSummary(transactions);
  const totalEl = $('#txSummaryTotal');
  const avgEl = $('#txSummaryAverage');
  if (totalEl) totalEl.textContent = formatAmount(summary.totalAmount);
  if (avgEl) avgEl.textContent = formatAmount(summary.averageAmount);

  const paged = paginateRows(transactions, transactionCurrentPage, transactionPageSize);
  transactionCurrentPage = paged.page;

  const pagNav = $('#transactionPagination');
  if (pagNav) {
    pagNav.hidden = transactions.length === 0;
    const pageInfo = $('#txPageInfo');
    if (pageInfo) pageInfo.textContent = `Page ${paged.page} of ${paged.totalPages} (${transactions.length} total)`;
    const prevBtn = $('#txPrevPage');
    if (prevBtn) prevBtn.disabled = paged.page <= 1;
    const nextBtn = $('#txNextPage');
    if (nextBtn) nextBtn.disabled = paged.page >= paged.totalPages;
  }

  // #298: compact rows grouped by day; tap a row to see its details and actions.
  const dateSorted = transactionSortBy === 'date-desc' || transactionSortBy === 'date-asc';
  const dayGroups = dateSorted ? groupByDay(transactions) : null;
  const todayKey = pktDateKey();
  let lastDay = null;
  transactionList.innerHTML = paged.items.map(transaction => {
    const customer = state.customers.find(item => item.id === transaction.customerId);
    const statusText = reportStatusLabel(transaction.status);
    const serviceStatus = transaction.customerServiceStatus;
    const serviceLabel = ({ active:'Active', offline:'Offline' })[serviceStatus] ?? null;
    const savedBill = customer?.bills?.find(bill => bill.month === transaction.month);
    const savedPayment = savedBill?.payments?.find(payment => payment.id === transaction.paymentId);
    const receiptData = customer && savedBill && savedPayment ? buildPaymentReceipt(customer, savedBill, savedPayment) : null;
    const receiptBillStatus = receiptData?.status === 'PAID' ? 'paid' : receiptData?.status === 'PARTIAL' ? 'partial' : null;
    const pid = escapeHtml(transaction.paymentId);
    const detailsId = `txd-${String(transaction.paymentId).replace(/[^A-Za-z0-9_-]/g, '')}`;
    let header = '';
    if (dayGroups && transaction.date !== lastDay) {
      lastDay = transaction.date;
      header = `<li class="tx-day-header" role="presentation"><span class="tx-day-text">${escapeHtml(dayHeaderText(transaction.date, dayGroups.get(transaction.date) || [], todayKey))}</span></li>`;
    }
    const context = [
      billMonthDiffers(transaction) ? `Bill month: ${escapeHtml(monthName(transaction.month))}` : '',
      `Billing status: <span class="report-status report-status-${transaction.status}">${statusText}</span>`,
      serviceLabel ? `Manual service: ${serviceLabel}` : ''
    ].filter(Boolean).join(' · ');
    // FIX-TXN-NAME: the badge is interpolated inside .tx-main (its own
    // line under the method/date line), never inside .tx-side — that
    // column is auto-width, so the long "Advance · for <Month Year>"
    // badge used to widen it and ellipsize the customer name ("#35 RA...").
    const advanceBadge = transaction.isAdvance ? `<span class="advance-badge">${transaction.targetMonth ? `${t('adv_badge')} · ${escapeHtml(t('adv_target_suffix', null, { month: displayMonthName(transaction.targetMonth) }))}` : t('adv_badge')}</span>` : '';
    return `${header}<li class="transaction-card tx-compact" data-payment-row="${pid}"><button class="tx-row" type="button" aria-expanded="false" aria-controls="${detailsId}" aria-label="#${transaction.customerNumber} ${escapeHtml(transaction.customerName)}, ${escapeHtml(formatAmount(transaction.amount))}, ${escapeHtml(transaction.method)}, ${escapeHtml(humanDate(transaction.date))}, ${statusText}. Show details and actions"><span class="tx-avatar" aria-hidden="true">${escapeHtml(initials(transaction.customerName))}</span><span class="tx-main"><span class="transaction-customer"><span class="transaction-customer-number">#${transaction.customerNumber}</span>${escapeHtml(transaction.customerName)}</span><span class="tx-sub"><span class="tx-method-chip tx-method-${methodSlug(transaction.method)}">${escapeHtml(transaction.method)}</span><span class="tx-date">${escapeHtml(humanDate(transaction.date))}</span></span>${advanceBadge}</span><span class="tx-side"><strong class="transaction-amount">${escapeHtml(formatAmount(transaction.amount))}</strong>${savedPayment?.voided === true ? '<span class="void-badge">VOID</span>' : ''}<span class="report-status report-status-${transaction.status} tx-status-chip">${statusText}</span></span><span class="tx-chevron" aria-hidden="true">▾</span></button><div class="tx-details" id="${detailsId}" hidden><div class="transaction-data"><p class="transaction-meta">Actual payment date: ${escapeHtml(humanDate(transaction.date))} · Method: ${escapeHtml(transaction.method)}${paymentPayerMarkup(transaction)}</p>${savedPayment?.voided === true ? `<p class="transaction-meta">${voidBadgeMarkup(savedPayment)}</p>` : ''}<p class="transaction-context">${context}</p>${paymentAllocationMarkup(transaction.allocation)}</div><div class="transaction-actions">${savedPayment?.screenshot ? paymentProofButtonMarkup(transaction.customerId, transaction.month, savedPayment) : ''}${receiptWhatsAppActionMarkup(customer, { ...transaction, billStatus:receiptBillStatus, billAmount:receiptData?.nominalPrice ?? null, balanceDueCents:receiptData?.balanceDueCents ?? null, ticketCharges:receiptData?.ticketCharges ?? [], arrearsBreakdown:buildArrearsBreakdown(customer, (customer.bills ?? []).find((bill) => bill.month === transaction.month)) }, { askLabel:'WhatsApp receipt' })}<button class="print-receipt-button" type="button" data-print-receipt data-customer-id="${escapeHtml(transaction.customerId)}" data-month="${escapeHtml(transaction.month)}" data-payment-id="${pid}" aria-label="Print receipt for customer ${transaction.customerNumber}, payment dated ${escapeHtml(transaction.date)}">🖨 Print receipt</button><button class="print-receipt-button thermal-receipt-button" type="button" data-print-thermal-receipt data-customer-id="${escapeHtml(transaction.customerId)}" data-month="${escapeHtml(transaction.month)}" data-payment-id="${pid}" aria-label="Print 80mm thermal slip for customer ${transaction.customerNumber}">80mm slip</button><button class="print-receipt-button thermal58-receipt-button" type="button" data-print-thermal58-receipt data-customer-id="${escapeHtml(transaction.customerId)}" data-month="${escapeHtml(transaction.month)}" data-payment-id="${pid}" aria-label="Print 58mm thermal slip for customer ${transaction.customerNumber}">58mm slip</button>${bluetoothReceiptButtonMarkup(transaction.customerId, transaction.month, pid, transaction.customerNumber)}${savedPayment?.voided === true ? '' : `<button class="edit-payment" type="button" data-transaction-edit="${pid}" data-customer-id="${escapeHtml(transaction.customerId)}" data-month="${escapeHtml(transaction.month)}">✎ Edit</button><button class="delete-payment" type="button" data-transaction-delete="${pid}" data-customer-id="${escapeHtml(transaction.customerId)}" data-month="${escapeHtml(transaction.month)}">🗑 Delete</button><button class="void-payment" type="button" data-transaction-void="${pid}" data-customer-id="${escapeHtml(transaction.customerId)}" data-month="${escapeHtml(transaction.month)}">Void</button>`}</div></div></li>`;  }).join('');
  transactionList.querySelectorAll('[data-transaction-edit]').forEach(button => button.addEventListener('click', () => beginCorrection(button.dataset.customerId, button.dataset.month, button.dataset.transactionEdit, 'transactions')));
  transactionList.querySelectorAll('[data-transaction-delete]').forEach(button => button.addEventListener('click', () => requestDeletePayment(button.dataset.customerId, button.dataset.month, button.dataset.transactionDelete)));
  transactionList.querySelectorAll('[data-transaction-void]').forEach(button => button.addEventListener('click', () => openVoidPaymentDialog(button.dataset.customerId, button.dataset.month, button.dataset.transactionVoid)));
  transactionList.querySelectorAll('[data-print-receipt]').forEach(button => button.addEventListener('click', () => printPaymentReceipt(button.dataset.customerId, button.dataset.month, button.dataset.paymentId)));
  transactionList.querySelectorAll('[data-print-thermal-receipt]').forEach(button => button.addEventListener('click', () => printPaymentReceipt(button.dataset.customerId, button.dataset.month, button.dataset.paymentId, { isThermal: true })));
  transactionList.querySelectorAll('[data-print-thermal58-receipt]').forEach(button => button.addEventListener('click', () => printPaymentReceipt(button.dataset.customerId, button.dataset.month, button.dataset.paymentId, { format: 'thermal-58' })));
  transactionList.querySelectorAll('[data-print-bluetooth-receipt]').forEach(button => button.addEventListener('click', () => printBluetoothReceipt(button.dataset.customerId, button.dataset.month, button.dataset.paymentId)));
  transactionList.querySelectorAll('[data-view-proof]').forEach(button => button.addEventListener('click', () => openPaymentProofDialog(button.dataset.customerId, button.dataset.month, button.dataset.paymentId)));
  bindReceiptPhoneActions(transactionList);
}
function reportStatusLabel(status) { return ({ paid:'Paid', pending:'Pending', unpaid:'Pending', partial:'Partial', 'not-set':'Not set' })[status] ?? 'Not set'; }
// Urdu phase 4: Billing-screen status labels via t(). reportStatusLabel is
// left untouched: it also feeds the Transactions screen (a later phase).
function billStatusLabel(status) { return ({ paid: t('bill_status_paid'), pending: t('bill_status_pending'), unpaid: t('bill_status_pending'), partial: t('bill_status_partial'), 'not-set': t('bill_status_notset') })[status] ?? t('bill_status_notset'); }
function renderMonthlyReport() {
  const month = selectedBillingMonth;
  const query = reportSearchQuery.trim() || searchQuery();
  const rows = buildMonthlyReport(state, { month, statusFilter:selectedReportFilter, customerQuery:query });
  $('#monthlyReportCount').textContent = t(rows.length === 1 ? 'bill_count_sing' : 'bill_count_plur', null, { count: rows.length, month: displayMonthName(month) });
  $('#monthlyReportEmpty').hidden = rows.length > 0;

  const totalBilled = rows.reduce((s, r) => s + (r.billAmount || 0), 0);
  const totalCollected = rows.reduce((s, r) => s + (r.amountReceived || 0), 0);
  const totalBalance = rows.reduce((s, r) => s + (r.balanceDue || 0), 0);
  const billedEl = $('#reportSummaryBilled');
  const collEl = $('#reportSummaryCollected');
  const balEl = $('#reportSummaryBalance');
  if (billedEl) billedEl.textContent = formatAmount(totalBilled);
  if (collEl) collEl.textContent = formatAmount(totalCollected);
  if (balEl) balEl.textContent = formatAmount(totalBalance);

  const methodTotals = calculateMethodCollectionTotals(state, month);
  const methodBreakdownEl = $('#monthlyReportMethodBreakdown');
  if (methodBreakdownEl) {
    const chips = [];
    if (methodTotals.Cash > 0) chips.push(`<span class="method-chip cash">${t('bill_method_cash')}: ${formatAmount(methodTotals.Cash)}</span>`);
    if (methodTotals.JazzCash > 0) chips.push(`<span class="method-chip jazzcash">${t('bill_method_jazzcash')}: ${formatAmount(methodTotals.JazzCash)}</span>`);
    if (methodTotals.Easypaisa > 0) chips.push(`<span class="method-chip easypaisa">${t('bill_method_easypaisa')}: ${formatAmount(methodTotals.Easypaisa)}</span>`);
    if (methodTotals.Raast > 0) chips.push(`<span class="method-chip raast">${t('bill_method_raast')}: ${formatAmount(methodTotals.Raast)}</span>`);
    if (methodTotals.Bank > 0) chips.push(`<span class="method-chip bank">${t('bill_method_bank')}: ${formatAmount(methodTotals.Bank)}</span>`);
    if (methodTotals.other > 0) chips.push(`<span class="method-chip other">${t('bill_method_other')}: ${formatAmount(methodTotals.other)}</span>`);
    methodBreakdownEl.innerHTML = chips.length > 0
      ? `<span class="method-breakdown-title">${t('bill_method_title')}</span> ${chips.join(' ')}`
      : '';
  }

  const sortSelect = $('#reportSortSelect');
  if (sortSelect) sortSelect.value = reportSortBy;

  const sortedRows = sortMonthlyReportRows(rows, reportSortBy);
  const paged = paginateRows(sortedRows, reportCurrentPage, reportPageSize);
  reportCurrentPage = paged.page;

  const pagNav = $('#monthlyReportPagination');
  if (pagNav) {
    pagNav.hidden = rows.length === 0;
    const pageInfo = $('#reportPageInfo');
    if (pageInfo) pageInfo.textContent = t('bill_page_info', null, { page: paged.page, totalPages: paged.totalPages, total: rows.length });
    const prevBtn = $('#reportPrevPage');
    if (prevBtn) prevBtn.disabled = paged.page <= 1;
    const nextBtn = $('#reportNextPage');
    if (nextBtn) nextBtn.disabled = paged.page >= paged.totalPages;
  }

  reportList.innerHTML = paged.items.map(row => {
    const monthlySale = row.monthlySellingAmount === null || row.monthlySellingAmount === undefined ? t('bill_not_set') : formatAmount(row.monthlySellingAmount);
    const billAmount = row.billAmount === null ? t('bill_not_set') : formatAmount(row.billAmount);
    const due = row.balanceDue === null ? t('bill_not_set') : formatAmount(row.balanceDue);
    const speed = row.packageSpeed || t('bill_not_set');
    const provider = row.ispProvider || t('bill_not_set');
    const dueDate = row.dueDate ? humanDate(row.dueDate) : t('bill_due_notset');
    const creditSources = row.creditSources.map(source => t('bill_credit_applied', null, { month: displayMonthName(source.originMonth), date: humanDate(source.paymentDate), method: source.method, receipt: formatAmount(source.receiptAmount), amount: formatAmount(source.amountCents / 100) })).join('; ');
    const pendingSources = row.pendingCreditSources.map(source => t('bill_credit_waiting', null, { month: displayMonthName(source.originMonth), date: humanDate(source.paymentDate), method: source.method, receipt: formatAmount(source.receiptAmount), amount: formatAmount(source.amountCents / 100) })).join('; ');
    const creditSummary = t('bill_credit_summary', null, { applied: formatAmount(row.creditApplied), forwarded: formatAmount(row.creditForwarded), pending: formatAmount(row.creditPending) }) + (creditSources ? ` · ${t('bill_credit_applied_label')} ${creditSources}` : '') + (pendingSources ? ` · ${t('bill_credit_waiting_label')} ${pendingSources}` : '');
    const serviceLabel = ({ active: t('bill_service_active'), offline: t('bill_service_offline'), 'not-set': t('bill_not_set') })[row.serviceStatus] ?? t('bill_not_set');
    return `<li class="report-row"><div class="report-customer"><span class="customer-number-line">#${row.customerNumber}${row.archived ? ` · ${t('bill_row_archived')}` : ''}</span><div class="report-customer-name">${escapeHtml(row.customerName)}</div><span class="report-cell-label">${t('bill_row_service')}: ${serviceLabel} · ${t('bill_row_package')}: ${escapeHtml(speed)} · ${t('bill_row_provider')}: ${escapeHtml(provider)}</span></div><div class="report-cell"><span class="report-cell-label">${t('bill_row_monthly_sale')}</span><span class="report-cell-value">${escapeHtml(monthlySale)}</span></div><div class="report-cell"><span class="report-cell-label">${escapeHtml(t('bill_row_month_bill', null, { month: displayMonthName(row.month) }))}</span><span class="report-cell-value">${escapeHtml(billAmount)}</span></div><div class="report-cell"><span class="report-cell-label">${t('bill_row_due_date')}</span><span class="report-cell-value">${escapeHtml(dueDate)}</span></div><div class="report-cell"><span class="report-cell-label">${t('bill_row_received')}</span><span class="report-cell-value">${escapeHtml(formatAmount(row.amountReceived))}</span></div><div class="report-cell"><span class="report-cell-label">${t('bill_row_balance')}</span><span class="report-cell-value">${escapeHtml(due)}</span></div><div class="report-cell report-credit-cell"><span class="report-cell-label">${t('bill_row_credit')}</span><span class="report-credit-value">${escapeHtml(creditSummary)}</span></div><div class="report-cell report-status-cell"><span class="report-cell-label">${t('bill_row_status')}</span><span class="report-status report-status-${row.status}">${billStatusLabel(row.status)}</span></div></li>`;
  }).join('');
  document.querySelectorAll('[data-report-filter]').forEach(button => button.setAttribute('aria-pressed', button.dataset.reportFilter === selectedReportFilter ? 'true' : 'false'));
  renderBillingRegister();
}

const REGISTER_STATUS_CLASS = { paid: 'report-status-paid', partial: 'report-status-partial', unpaid: 'report-status-pending' };
const REGISTER_STATUS_KEY = { paid: 'bill_reg_status_paid', partial: 'bill_reg_status_partial', unpaid: 'bill_reg_status_unpaid' };

// Billing Invoice Register: read-only invoice-style rows for a period
// (This Month / Last Month / Last 3 / 6 / 12 Months by bill month) with a
// status chip filter (default Paid). Totals come from the same filtered
// rows the CSV download exports, so screen and file always agree.
function renderBillingRegister() {
  const list = $('#billingRegisterList');
  if (!list) return;
  const register = buildBillingRegister(state, {
    period: billingRegisterPeriod,
    status: billingRegisterStatus,
    currentMonth: monthsForHistory()[0]
  });
  billingRegisterPeriod = register.period;
  billingRegisterStatus = register.status;
  const periodSelect = $('#billingRegisterPeriod');
  if (periodSelect) periodSelect.value = billingRegisterPeriod;
  document.querySelectorAll('[data-register-status]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.registerStatus === billingRegisterStatus));
  });
  list.innerHTML = register.rows.map(row => `<li class="register-row">
      <div class="register-customer"><span class="register-reference">${escapeHtml(row.reference)}</span><span class="report-customer-name">${escapeHtml(row.customerName)}</span>${row.mobile ? `<span class="register-customer-sub">${escapeHtml(row.mobile)}</span>` : ''}</div>
      <div class="report-cell"><span class="report-cell-label">${t('bill_reg_col_package')}</span><span class="report-cell-value">${escapeHtml(row.packageSpeed || '—')}</span></div>
      <div class="report-cell"><span class="report-cell-label">${t('bill_reg_col_month')}</span><span class="report-cell-value">${escapeHtml(row.month)}</span></div>
      <div class="report-cell"><span class="report-cell-label">${t('bill_reg_col_bill')}</span><span class="report-cell-value">${escapeHtml(formatAmount(row.billAmount))}</span></div>
      <div class="report-cell"><span class="report-cell-label">${t('bill_reg_col_paid')}</span><span class="report-cell-value">${escapeHtml(formatAmount(row.paidAmount))}</span></div>
      <div class="report-cell"><span class="report-cell-label">${t('bill_reg_col_status')}</span><span class="report-status ${REGISTER_STATUS_CLASS[row.status]}">${t(REGISTER_STATUS_KEY[row.status])}</span></div>
    </li>`).join('');
  const totals = $('#billingRegisterTotals');
  if (totals) totals.textContent = t('bill_reg_totals', null, { count: register.totals.count, billed: formatAmount(register.totals.totalBilled), paid: formatAmount(register.totals.totalPaid) });
  const empty = $('#billingRegisterEmpty');
  if (empty) empty.hidden = register.rows.length > 0;
}
function populateReportMonths() {
  const months = monthsForHistory();
  // Urdu phase 4: the Billing month select shows Urdu month names in Urdu
  // mode; the Customers month filter keeps monthName (phase 1 surface).
  $('#reportMonth').innerHTML = months.map(month => `<option value="${month}">${escapeHtml(displayMonthName(month))}</option>`).join('');
  $('#customerFilterMonth').innerHTML = months.map(month => `<option value="${month}">${escapeHtml(monthName(month))}</option>`).join('');
  $('#reportMonth').value = selectedBillingMonth;
  $('#customerFilterMonth').value = selectedBillingMonth;
}
function renderProfileMarginPreview() {
  const sellingText = $('#monthlySellingAmountInput').value.trim();
  const costText = $('#monthlyPurchaseCostInput').value.trim();
  const preview = $('#customerProfitPreview');
  if (!sellingText || !costText) { preview.textContent = t('prof_margin_unset'); return; }
  const selling = Number(sellingText); const cost = Number(costText);
  if (!Number.isFinite(selling) || selling <= 0 || !Number.isFinite(cost) || cost < 0) { preview.textContent = t('prof_margin_invalid'); return; }
  preview.textContent = t('prof_margin_ok', null, { amount: formatAmount(selling - cost) });
}
function incidentAuditMarkup(incident) {
  const corrections = incident.corrections ?? [];
  if (!corrections.length) return '';
  const items = corrections.map(correction => `<li><strong>${escapeHtml(humanLocalDateTime(correction.recordedAt))}</strong><br>${escapeHtml(t('prof_incident_audit_prev', null, { reported: humanLocalDateTime(correction.previous.reportedAt), offline: humanLocalDateTime(correction.previous.offlineAt), restored: humanLocalDateTime(correction.previous.restoredAt) }))}<br>${escapeHtml(t('prof_incident_audit_note', null, { note: correction.previous.note || t('prof_not_recorded') }))}</li>`).join('');
  return `<details class="incident-audit"><summary>${t('prof_incident_audit_title', null, { count: corrections.length })}</summary><ol>${items}</ol></details>`;
}
function renderIncidents(customer) {
  const incidents = [...(customer.incidents ?? [])].sort((a,b) => b.reportedAt.localeCompare(a.reportedAt) || a.id.localeCompare(b.id));
  $('#incidentCount30Days').textContent = countCustomerIncidentsLast30Days(state, customer.id, new Date());
  $('#incidentEmptyNote').hidden = incidents.length > 0;
  $('#incidentList').innerHTML = incidents.map(incident => {
    const resolved = Boolean(incident.restoredAt);
    return `<li class="incident-card"><div class="incident-card-head"><span class="incident-card-state ${resolved ? 'incident-resolved' : 'incident-open'}">${resolved ? t('prof_incident_resolved') : t('prof_incident_open')}</span><span class="incident-reported">${escapeHtml(t('prof_incident_reported', null, { datetime: humanLocalDateTime(incident.reportedAt) }))}</span></div><dl class="incident-times"><div><dt>${t('prof_incident_offline_since')}</dt><dd>${escapeHtml(humanLocalDateTime(incident.offlineAt))}</dd></div><div><dt>${t('prof_incident_restored')}</dt><dd>${escapeHtml(humanLocalDateTime(incident.restoredAt))}</dd></div></dl><p class="incident-note">${escapeHtml(incident.note || t('prof_incident_note_none'))}</p>${incidentAuditMarkup(incident)}<div class="incident-actions"><button class="edit-incident secondary-button" type="button" data-edit-incident="${escapeHtml(incident.id)}">${t('prof_incident_edit')}</button><button class="delete-incident" type="button" data-delete-incident="${escapeHtml(incident.id)}">${t('prof_incident_delete')}</button></div></li>`;
  }).join('');
  $('#incidentList').querySelectorAll('[data-edit-incident]').forEach(button => button.addEventListener('click', () => showIncidentEditor(incidents.find(item => item.id === button.dataset.editIncident))));
  $('#incidentList').querySelectorAll('[data-delete-incident]').forEach(button => button.addEventListener('click', () => requestDeleteIncident(customer.id, button.dataset.deleteIncident)));
}
function profileReadonlyField(label, value, wide = false) {
  return `<div class="profile-readonly-field${wide ? ' profile-readonly-field-wide' : ''}"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

// Profile UI polish: compact grouped info. Related fields share one
// 2-column group (phones stay side-by-side on narrow screens); long values
// (address, notes) span both columns. NO field removed, NO label/value changed.
function profileInfoGroupMarkup(heading, rows) {
  return `<section class="profile-info-group"><h4>${escapeHtml(heading)}</h4><dl class="profile-readonly-grid">${rows.map(([label, value, wide]) => profileReadonlyField(label, value, wide)).join('')}</dl></section>`;
}
function customerLifetimeValueMarkup(lifetime) {
  const tenure=lifetime.tenure;
  const tenureLabel=tenure.serviceMonths===null
    ? tenure.status==='future'?t('prof_clv_future'):tenure.status==='date-review'?t('prof_clv_date_review'):tenure.status==='end-date-unknown'?t('prof_tenure_end_unknown'):t('prof_not_recorded')
    : (tenure.serviceMonths===1?t('prof_tenure_month_1'):t('prof_tenure_months', null, { n: tenure.serviceMonths }));
  const tenureBasis=tenure.connectionDate
    ? (tenure.endDate ? t('prof_clv_tenure_basis_ended', null, { date: tenure.connectionDate, end: tenure.endDate }) : t('prof_clv_tenure_basis', null, { date: tenure.connectionDate }))
    : t('prof_clv_tenure_basis_none');
  const monthlyRevenue=lifetime.averageMonthlyRevenue===null?t('prof_health_cat_insufficient'):t('prof_clv_per_month', null, { amount: formatAmount(lifetime.averageMonthlyRevenue) });
  const delay=lifetime.averagePaymentDelayDays===null?t('prof_clv_not_available'):(lifetime.averagePaymentDelayDays===1?t('prof_clv_delay_1', null, { days: 1 }):t('prof_clv_delay_n', null, { days: lifetime.averagePaymentDelayDays }));
  const delayBasis=lifetime.paymentDelaySampleCount
    ? (lifetime.paymentDelaySampleCount===1?t('prof_clv_delay_basis_1', null, { count: 1 }):t('prof_clv_delay_basis_n', null, { count: lifetime.paymentDelaySampleCount }))
    : t('prof_clv_delay_basis_none');
  const future=lifetime.estimatedFutureValue===null?t('prof_health_cat_insufficient'):formatAmount(lifetime.estimatedFutureValue);
  // Phase 3: the CLV bases are rebuilt at the profile site from the counts
  // the engine already returns (observationMonths, receiptMonths, asOf),
  // so the engine's English basis sentences are never rendered. The
  // future-basis average replicates pkr() exactly (PKR + en-PK grouping).
  const avgBasis=lifetime.observationMonths
    ? (lifetime.observationMonths===1?t('prof_clv_avg_basis_1', null, { months: 1, month: lifetime.asOf.slice(0,7) }):t('prof_clv_avg_basis_n', null, { months: lifetime.observationMonths, month: lifetime.asOf.slice(0,7) }))
    : t('prof_clv_avg_basis_none');
  const futureBasis=lifetime.estimatedFutureValue===null
    ? (lifetime.receiptMonths===0?t('prof_clv_future_none_0'):t('prof_clv_future_none_2'))
    : t(`prof_clv_future_basis_${lifetime.receiptMonths===1?'1':'n'}${lifetime.observationMonths===1?'1':'n'}`, null, { avg: `PKR ${Number(lifetime.averageMonthlyRevenue).toLocaleString('en-PK')}`, receipts: lifetime.receiptMonths, months: lifetime.observationMonths, month: lifetime.asOf.slice(0,7) });
  const revenueBasis=lifetime.receiptCount===1?t('prof_clv_rev_basis_1', null, { count: 1 }):t('prof_clv_rev_basis_n', null, { count: lifetime.receiptCount });
  return `<section class="customer-lifetime-value" aria-labelledby="customerLifetimeValueHeading"><h3 id="customerLifetimeValueHeading">${t('prof_clv_heading')}</h3><dl class="customer-lifetime-grid"><div><dt>${t('prof_clv_revenue')}</dt><dd>${escapeHtml(formatAmount(lifetime.totalHistoricalRevenue))}</dd><dd class="customer-lifetime-basis">${escapeHtml(revenueBasis)}</dd></div><div><dt>${t('prof_clv_tenure')}</dt><dd>${escapeHtml(tenureLabel)}</dd><dd class="customer-lifetime-basis">${escapeHtml(tenureBasis)}</dd></div><div><dt>${t('prof_clv_avg_revenue')}</dt><dd>${escapeHtml(monthlyRevenue)}</dd><dd class="customer-lifetime-basis">${escapeHtml(avgBasis)}</dd></div><div><dt>${t('prof_clv_delay')}</dt><dd>${escapeHtml(delay)}</dd><dd class="customer-lifetime-basis">${escapeHtml(delayBasis)}</dd></div><div class="customer-lifetime-estimate"><dt>${t('prof_clv_future_value')}</dt><dd>${escapeHtml(future)}</dd><dd class="customer-lifetime-basis">${escapeHtml(futureBasis)}</dd></div></dl><p class="customer-lifetime-note">${t('prof_clv_note')}</p></section>`;
}
// SISP-23: one-line installation profitability summary for the profile
// Connection group. Plain text (the field renderer escapes it); the
// partial-cost note matters because a subsidy computed without a fiber
// rate is only a lower bound, never the final number.
function installationCostProfileLine(customer) {
  const cost = calculateInstallationCost(customer);
  if (cost.status === 'not-recorded') return t('prof_not_recorded');
  const costText = cost.totalIsPartial ? t('prof_install_cost_partial', null, { amount: formatAmount(cost.totalCost) }) : t('prof_install_cost', null, { amount: formatAmount(cost.totalCost) });
  if (cost.status === 'unknown') return `${costText} · ${t('prof_install_conn_fee_norec')}`;
  if (cost.status === 'surplus') return t('prof_install_surplus', null, { net: formatAmount(cost.net), cost: costText });
  if (cost.status === 'break-even') return t('prof_install_breakeven', null, { cost: costText });
  const breakEven = cost.breakEvenMonths === null
    ? t('prof_install_be_nocompute')
    : (cost.breakEvenMonths === 1 ? t('prof_install_be_months_1', null, { n: 1 }) : t('prof_install_be_months_n', null, { n: cost.breakEvenMonths }));
  return t('prof_install_subsidy', null, { subsidy: formatAmount(cost.subsidy), cost: costText, breakeven: breakEven });
}
// Phase 3 profile-site ownership mapping (by stored VALUE, never by editing
// the shared custodyOwnershipLabel): 'isp-owned'/'customer-owned'/anything
// else maps exactly like the helper's found/not-found rule.
function profileCustodyOwnershipLabel(value) {
  if (value === 'isp-owned') return t('prof_custody_own_isp');
  if (value === 'customer-owned') return t('prof_custody_own_customer');
  return t('prof_not_recorded');
}

function renderCustomerProfileView(customer) {
  const phone = String(customer.phone ?? '').trim();
  const cnic = String(customer.cnic ?? '').trim();
  const phoneTargets = contactActionTargets(phone);
  // SISP-76: an SMS-preference customer gets the SMS shortcut first
  // among the contact actions (generic reminder draft, no figures).
  const smsContact = customerPrefersSms(customer) ? buildSmsReminderUrl({ phone, customerName: customer.name || '' }) : null;
  const smsAction = smsContact?.valid ? `<a class="secondary-button" href="${escapeHtml(smsContact.url)}">${t('prof_view_sms')}</a>` : '';
  const phoneActions = phoneTargets ? `<span class="profile-contact-actions" aria-label="${t('prof_view_contact_aria')}"><a class="secondary-button" href="${escapeHtml(phoneTargets.tel)}">${t('prof_view_call')}</a>${smsAction}${phoneTargets.whatsapp ? `<a class="secondary-button" href="${escapeHtml(phoneTargets.whatsapp)}" target="_blank" rel="noopener noreferrer">${t('prof_view_whatsapp')}</a>` : ''}</span>` : '';
  const phoneHint = phoneTargets?.whatsapp ? '' : `<p class="profile-contact-note">${t('prof_view_phone_hint')}</p>`;
  const profit = customerPackageProfit(customer);
  const lifetimeValue = buildCustomerLifetimeValue(state, customer, new Date());
  // SISP-8: vacation-hold summary for the Service group below. This must be
  // computed here: renderDetail has its own pauseSummary const for the header
  // badge, but that binding is local to renderDetail and invisible here —
  // without this line every profile render (and every payment save, via the
  // save callback's renderDetail) threw "pauseSummary is not defined".
  const pauseSummary = pauseBillingSummary(customer);
  // SISP-79: habitual pay-day line for the Service group (derived live
  // from the customer's receipts by payment-day-advisor.js — read-only).
  const paydaySummary = paymentHabitPresentation(customer);
  // SISP-3: profile Waada chips — one-tap promise dates on the customer record.
  const waadaToday = getTodayDateString();
  // Phase 3: waadaBadgeLabel stays the validity gate (invalid dates -> null),
  // but the badge text itself comes from prof_ keys.
  const waadaLabel = customer.promiseDate ? (waadaBadgeLabel(customer, waadaToday) ? (customer.promiseDate < waadaToday ? t('prof_waada_badge_expired', null, { date: String(customer.promiseDate).trim() }) : t('prof_waada_badge', null, { date: String(customer.promiseDate).trim() })) : null) : null;
  const waadaBadge = waadaLabel ? `<span class="wada-badge ${customer.promiseDate < waadaToday ? 'wada-badge-broken waada-pulse' : 'wada-badge-upcoming'}">${escapeHtml(waadaLabel)}</span>` : '';
  const waadaSectionHtml = `<section class="profile-waada-section" aria-label="${t('prof_waada_aria')}"><h4>${t('prof_waada_heading')}</h4><p class="profile-waada-current">${customer.promiseDate ? `${escapeHtml(t('prof_waada_promise', null, { date: customer.promiseDate }))}${customer.promiseAmount ? ` · PKR ${Number(customer.promiseAmount).toLocaleString()}` : ''}${customer.promiseNote ? ` · “${escapeHtml(customer.promiseNote)}”` : ''} ${waadaBadge}` : t('prof_waada_none')}</p><div class="waada-chip-row" role="group" aria-label="${t('prof_waada_chips_aria')}"><button type="button" class="secondary-button waada-chip-btn" data-profile-waada-chip="plus2">${t('prof_waada_chip_2')}</button><button type="button" class="secondary-button waada-chip-btn" data-profile-waada-chip="plus5">${t('prof_waada_chip_5')}</button><button type="button" class="secondary-button waada-chip-btn" data-profile-waada-chip="tenth">${t('prof_waada_chip_10th')}</button></div><div class="waada-chip-custom"><label for="profileWaadaCustomDate">${t('prof_waada_custom')}</label><input id="profileWaadaCustomDate" type="date" aria-label="${t('prof_waada_custom_aria')}"><button type="button" class="primary-button" id="profileWaadaSetCustomBtn">${t('prof_waada_set')}</button><button type="button" class="secondary-button text-button danger" id="profileWaadaClearBtn">${t('prof_waada_clear')}</button></div></section>`;
  // SISP-15: profile complaint history — this customer's register entries only.
  const customerComplaints = loadComplaints().filter((c) => String(c.customerId) === String(customer.id)).sort((a, b) => String(b.reportedAt || '').localeCompare(String(a.reportedAt || '')));
  const complaintsSectionHtml = `<section class="profile-complaints-section" aria-label="${t('prof_complaint_aria')}"><h4>${t('prof_complaint_heading')}</h4>${customerComplaints.length === 0 ? `<p class="profile-complaints-empty">${t('prof_complaint_empty')}</p>` : `<ul class="profile-complaints-list">${customerComplaints.map((c) => `<li><span><strong>${escapeHtml(c.id)}</strong> · ${escapeHtml(c.issueCategory)} · ${escapeHtml(c.status)}</span><span>${escapeHtml(t('prof_complaint_reported', null, { date: c.reportedAt || t('prof_complaint_not_recorded') }))} · ${escapeHtml(t('prof_complaint_downtime', null, { hours: formatDowntimeHours(c.downtimeHours) }))}</span></li>`).join('')}</ul>`}<button type="button" class="secondary-button" id="profileOpenComplaintRegisterBtn">${t('prof_complaint_open')}</button></section>`;
  // SISP-12: profile field tickets — this customer's worklist only, plus
  // pending ticket charges and the recurring-fault warning badge. Charges
  // live on the tickets, never inside bills or the billing cycle.
  const customerTickets = ticketsForCustomer(loadTickets(), customer.id);
  const ticketPending = billedTicketChargesPending(loadTickets(), customer.id);
  const recurringWarning = hasRecurringFaultWarning(loadTickets(), customer.id);
  const ticketsSectionHtml = `<section class="profile-tickets-section" aria-label="${t('prof_ticket_aria')}"><h4>${t('prof_ticket_heading')}</h4>${recurringWarning ? `<p class="profile-tickets-warning">${t('prof_ticket_recurring')}</p>` : ''}<p class="profile-tickets-charges">${escapeHtml(t('prof_ticket_pending', null, { amount: formatAmount(ticketPending) }))}${ticketPending > 0 ? escapeHtml(t('prof_ticket_pending_note')) : ''}</p>${customerTickets.length === 0 ? `<p class="profile-tickets-empty">${t('prof_ticket_empty')}</p>` : `<ul class="profile-tickets-list">${customerTickets.map((t) => `<li><span><strong>${escapeHtml(t.id)}</strong> · ${escapeHtml(ticketFaultLabel(t))} · ${escapeHtml(t.status)}</span><span>${escapeHtml(t('prof_ticket_lineman', null, { name: t.technician || t('prof_ticket_not_set') }))} · ${escapeHtml(t.priority)}${t.billingType === 'billed' ? `${escapeHtml(t('prof_ticket_billed', null, { amount: t.billedAmount }))}${t.chargePaid ? t('prof_ticket_paid') : t('prof_ticket_unpaid')}` : t('prof_ticket_free')}</span></li>`).join('')}</ul>`}<button type="button" class="secondary-button" id="profileOpenFieldTicketsBtn">${t('prof_ticket_open')}</button></section>`;
  // SISP-16: profile downtime summary — this month + all time for this customer.
  const downtimeMonth = buildCustomerDowntimeSummary(loadComplaints(), customer.id, pakistanMonthNow());
  const downtimeAll = buildCustomerDowntimeSummary(loadComplaints(), customer.id, '');
  const downtimeSectionHtml = `<section class="profile-downtime-section" aria-label="${t('prof_downtime_aria')}"><h4>${t('prof_downtime_heading')}</h4><p><strong>${escapeHtml(downtimeMonth.complaintCount === 1 ? t('prof_downtime_month_1', null, { count: downtimeMonth.complaintCount, hours: downtimeMonth.totalDowntime }) : t('prof_downtime_month_n', null, { count: downtimeMonth.complaintCount, hours: downtimeMonth.totalDowntime }))}</strong>${downtimeMonth.primaryIssueTag ? escapeHtml(t('prof_downtime_issue', null, { tag: downtimeMonth.primaryIssueTag })) : ''}</p><p><strong>${escapeHtml(downtimeAll.complaintCount === 1 ? t('prof_downtime_all_1', null, { count: downtimeAll.complaintCount, hours: downtimeAll.totalDowntime }) : t('prof_downtime_all_n', null, { count: downtimeAll.complaintCount, hours: downtimeAll.totalDowntime }))}</strong>${downtimeAll.primaryIssueTag ? escapeHtml(t('prof_downtime_issue', null, { tag: downtimeAll.primaryIssueTag })) : ''}</p><button type="button" class="secondary-button" id="profileOpenDowntimeAnalyticsBtn">${t('prof_downtime_open')}</button></section>`;
  // SISP-40: profile hamsaya referral section — who referred this
  // customer, and the referral credits this customer has earned (queued
  // for the next billing cycle / already deducted). Rendered only when
  // there is something to show.
  const referralSummary = referralBillingSummary(customer, state, loadReferralCredits());
  // SISP-59: profile upgrade hint — shown only when this customer is
  // an upsell candidate (same read-only builder as the dashboard card).
  const upsellCandidate = upsellCandidateForCustomer(state, customer, { complaints: loadComplaints(), tickets: loadTickets() });
  const upsellSectionHtml = upsellProfileHintHtml(upsellCandidate, formatAmount);
  // SISP-69: profile bottleneck hint — shown only when this customer
  // is flagged by the hardware/optical audit (same read-only builder
  // as the dashboard panel).
  const bottleneckSuspect = bottleneckForCustomer(customer, { complaints: loadComplaints(), tickets: loadTickets() });
  const bottleneckSectionHtml = bottleneckProfileHintHtml(bottleneckSuspect, formatRxDbm);
  const referralSectionHtml = referralSummary.hasContent ? `<section class="profile-referral-section" aria-label="${t('prof_ref_aria')}"><h4>${t('prof_ref_heading')}</h4>${referralSummary.referredByLabel ? `<p>${escapeHtml(referralSummary.referredByLabel)}</p>` : ''}${referralSummary.earned.length ? `<ul class="profile-referral-list">${referralSummary.earned.map((row) => `<li>${escapeHtml(row.label)}</li>`).join('')}</ul>` : ''}${referralSummary.queuedLabel ? `<p><strong>${escapeHtml(referralSummary.queuedLabel)}</strong></p>` : ''}${referralSummary.appliedLabel ? `<p>${escapeHtml(referralSummary.appliedLabel)}</p>` : ''}</section>` : '';
  // SISP-24: profile optical section — splitter box, port, PON port and
  // last RX reading, with a red high-loss badge below -26.0 dBm.
  const opticalFields = normalizeOpticalFields(customer);
  const opticalStatus = rxSignalStatus(opticalFields.lastRxDbm);
  const opticalBadge = opticalStatus === 'weak'
    ? `<span class="safety-badge badge-danger">${t('prof_optical_weak')}</span>`
    : opticalStatus === 'healthy'
      ? `<span class="safety-badge badge-healthy">${t('prof_optical_ok')}</span>`
      : '';
  // OWNER-SIGNAL: signal reading history (newest first) under the
  // SISP-24 optical facts, plus the quick "record a reading" row. The
  // history is append-only; every append also refreshes lastRxDbm, so
  // the current-signal line above and this list can never disagree.
  const signalSourceLabels = { manual: t('sig_source_manual'), install: t('sig_source_install'), 'complaint-before': t('sig_source_complaint_before'), 'complaint-after': t('sig_source_complaint_after') };
  const signalHistoryRows = signalReadingsNewestFirst(customer);
  const signalHistoryHtml = signalHistoryRows.length === 0
    ? `<p class="signal-history-empty">${t('sig_history_empty')}</p>`
    : `<ul class="signal-history-list">${signalHistoryRows.map((reading) => `<li class="signal-history-row"><span>${escapeHtml(humanDate(reading.date))} · ${escapeHtml(signalSourceLabels[reading.source] || reading.source)}${reading.complaintId ? ` · ${escapeHtml(reading.complaintId)}` : ''}${reading.note ? ` · ${escapeHtml(reading.note)}` : ''}</span><strong>${escapeHtml(formatRxDbm(reading.dbm))}</strong>${reading.weak ? `<span class="safety-badge badge-danger">${escapeHtml(t('sig_weak_badge'))}</span>` : ''}</li>`).join('')}</ul>`;
  const opticalSectionHtml = `<section class="profile-splitter-section" aria-label="${t('prof_optical_aria')}"><h4>${t('prof_optical_heading')}</h4><p>${escapeHtml(t('prof_optical_box', null, { id: opticalFields.splitterBoxId || t('prof_not_recorded') }))}${opticalFields.splitterPort !== null ? escapeHtml(t('prof_optical_port', null, { port: opticalFields.splitterPort })) : ''}</p><p>${escapeHtml(t('prof_optical_pon', null, { port: opticalFields.oltPonPort || t('prof_not_recorded') }))}${escapeHtml(t('prof_optical_rx', null, { rx: formatRxDbm(opticalFields.lastRxDbm) }))} ${opticalBadge}</p><button type="button" class="secondary-button" id="profileOpenSplitterMapBtn">${t('prof_optical_open')}</button><h5 class="signal-history-heading">${t('sig_history_title')}</h5>${signalHistoryHtml}<div class="signal-record-row"><label class="field-label" for="profileSignalDbmInput">${t('sig_dbm_label')}</label><input id="profileSignalDbmInput" class="form-input" type="number" min="-60" max="10" step="0.1" inputmode="decimal" placeholder="-19.4"><label class="field-label" for="profileSignalNoteInput">${t('sig_note_label')}</label><input id="profileSignalNoteInput" class="form-input" type="text" maxlength="200"><button type="button" class="primary-button" id="profileSignalRecordBtn">${t('sig_record_btn')}</button></div></section>`;
  // SISP-32: pole & landmark directory — where the drop and box live.
  const poleFields = normalizePoleFields(customer);
  const poleSectionHtml = `<section class="profile-splitter-section" aria-label="${t('prof_pole_aria')}"><h4>${t('prof_pole_heading')}</h4><p>${escapeHtml(t('prof_pole_number', null, { value: poleFields.poleNumber || t('prof_not_recorded') }))}</p><p>${escapeHtml(t('prof_pole_box', null, { value: poleFields.boxLocationNote || t('prof_not_recorded') }))}${escapeHtml(t('prof_pole_wire', null, { value: poleFields.dropWireCoreColor || t('prof_not_recorded') }))}</p><p class="profile-pole-note">${t('prof_pole_note')}</p></section>`;
  // SISP-92: profile GPS pin — where this house actually is. Capture is
  // 1-tap from the live position (the lineman is standing at the house);
  // Open in Maps renders only when a pin exists, and Remove pin only
  // then too — no dead controls, no invented coordinates.
  const gpsPin = gpsPinPresentation(customer);
  const gpsSectionHtml = `<section class="profile-splitter-section" aria-label="${t('gpspin_section_title')}"><h4>📍 ${t('gpspin_section_title')}</h4><p>${gpsPin.hasPin ? `<strong>${escapeHtml(gpsPin.coordsLabel)}</strong>` : escapeHtml(t('gpspin_not_recorded'))}</p><div class="profile-gps-actions"><button type="button" class="secondary-button" id="profileCaptureGpsBtn">${t(gpsPin.hasPin ? 'gpspin_recapture' : 'gpspin_capture')}</button>${gpsPin.hasPin ? `<a class="secondary-button" href="${escapeHtml(gpsPin.mapsUrl)}" target="_blank" rel="noopener noreferrer">${t('gpspin_open_maps')}</a><button type="button" class="secondary-button" id="profileClearGpsBtn">${t('gpspin_clear')}</button>` : ''}</div></section>`;
  // SISP-7: profile feeder section — upstream house, feeder zone, and how
  // many downstream subscribers lose internet if this house goes down.
  const feederFields = normalizeFeederFields(customer);
  const feederUpstream = feederFields.upstreamCustomerId
    ? state.customers.find((c) => String(c.id) === String(feederFields.upstreamCustomerId)) ?? null
    : null;
  const feederDownstream = traceDownstreamImpact(state.customers, customer.id);
  const feederSectionHtml = `<section class="profile-outage-section" aria-label="${t('prof_feeder_aria')}"><h4>${t('prof_feeder_heading')}</h4><p>${escapeHtml(t('prof_feeder_fed_by', null, { name: feederUpstream ? (feederUpstream.name || t('prof_feeder_unknown')) : (feederFields.upstreamCustomerId ? t('prof_feeder_not_found') : t('prof_feeder_direct')) }))}${escapeHtml(t('prof_feeder_zone', null, { zone: feederFields.fiberZone || t('prof_not_set') }))}</p><p>${escapeHtml(feederDownstream.length === 1 ? t('prof_feeder_down_1', null, { count: feederDownstream.length }) : t('prof_feeder_down_n', null, { count: feederDownstream.length }))}${feederDownstream.length > 0 ? `${escapeHtml(t('prof_feeder_names', null, { names: feederDownstream.slice(0, 3).map((c) => c.name || t('prof_feeder_unknown')).join(', ') }))}${feederDownstream.length > 3 ? escapeHtml(t('prof_feeder_more', null, { count: feederDownstream.length - 3 })) : ''}` : ''}</p><button type="button" class="secondary-button" id="profileOutageTraceBtn">${t('prof_feeder_trace')}</button></section>`;
  // (paid = billed installments whose bill month is fully settled, FIFO),
  // plus the add-plan form. Plans are separate from the one-time
  // connection/router/fiber fields above; they only ever bill through the
  // monthly billing cycle, never from this form.
  const kistProgress = buildKistProgress(customer, calculatePaymentAllocations(state));
  const kistPlansHtml = kistProgress.plans.length === 0
    ? `<p class="profile-kist-empty">${t('prof_kist_empty')}</p>`
    : kistProgress.plans.map((plan) => `<article class="kist-plan"><div class="kist-plan-head"><strong>${escapeHtml(plan.itemTitle)}</strong><span>${escapeHtml(plan.status === 'completed' ? t('prof_kist_status_completed') : t('prof_kist_status_active'))}</span></div><div class="kist-progress-track" role="progressbar" aria-label="${escapeHtml(t('prof_kist_progress_aria', null, { title: plan.itemTitle }))}" aria-valuenow="${plan.percentPaid}" aria-valuemin="0" aria-valuemax="100"><div class="kist-progress-fill" style="width: ${plan.percentPaid}%"></div></div><p class="kist-plan-meta">${escapeHtml(t('prof_kist_paid', null, { paid: plan.monthsPaid, total: plan.totalMonths, amount: formatAmount(plan.remainingAmount) }))}</p><p class="kist-plan-detail">${escapeHtml(t('prof_kist_detail', null, { monthly: formatAmount(plan.monthlyKist), billed: plan.monthsBilled, total: plan.totalMonths, amount: formatAmount(plan.totalAmount) }))}${plan.downPayment > 0 ? escapeHtml(t('prof_kist_down', null, { amount: formatAmount(plan.downPayment) })) : ''}${plan.startDate ? escapeHtml(t('prof_kist_from', null, { date: plan.startDate })) : ''}${plan.payoffAmount !== null || plan.payoffDate ? ` · ${escapeHtml(kistSettlementPresentation(plan).settledLabel)}` : ''}</p>${plan.monthsBilled === 0 ? `<button type="button" class="secondary-button text-button danger" data-profile-kist-remove="${escapeHtml(plan.id)}">${t('prof_kist_remove')}</button>` : ''}${kistSettlementPresentation(plan).canPayoff ? `<button type="button" class="secondary-button" data-profile-kist-payoff="${escapeHtml(plan.id)}">${escapeHtml(kistSettlementPresentation(plan).payoffLabel)}</button>` : ''}</article>`).join('');
  const kistSectionHtml = `<section class="profile-kist-section" aria-label="${t('prof_kist_aria')}"><h4>${t('prof_kist_heading')}</h4><p class="profile-kist-note">${t('prof_kist_note')}</p>${kistPlansHtml}<form class="kist-add-form" novalidate><h5>${t('prof_kist_add_title')}</h5><div class="kist-add-grid"><label class="field-label full" for="profileKistItemTitle">${t('prof_kist_item_label')}</label><input id="profileKistItemTitle" type="text" maxlength="100" placeholder="${t('prof_kist_item_ph')}" required><label class="field-label full" for="profileKistTotalAmount">${t('prof_kist_total_label')}</label><input id="profileKistTotalAmount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="${t('prof_kist_total_ph')}" required><label class="field-label full" for="profileKistDownPayment">${t('prof_kist_down_label')} <span class="optional-label">${t('prof_optional')}</span></label><input id="profileKistDownPayment" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0"><label class="field-label full" for="profileKistRecordDownPayment"><input id="profileKistRecordDownPayment" type="checkbox"> ${t('prof_kist_record_down')}</label><label class="field-label full" for="profileKistDownPaymentMethod">${t('prof_kist_down_method')}</label><select id="profileKistDownPaymentMethod" class="full">${['Cash', 'Cash at Waseem Abbasi shop', 'Cash at Hassan shop', 'Cash at Balla shop', 'Easypaisa'].filter((method) => PAYMENT_METHODS.includes(method)).map((method) => `<option value="${method}">${method}</option>`).join('')}</select><label class="field-label full" for="profileKistTotalMonths">${t('prof_kist_months_label')}</label><input id="profileKistTotalMonths" type="number" min="2" max="6" step="1" inputmode="numeric" placeholder="3" required><label class="field-label full" for="profileKistMonthlyKist">${t('prof_kist_monthly_label')} <span class="optional-label">${t('prof_kist_monthly_opt')}</span></label><input id="profileKistMonthlyKist" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="${t('prof_kist_auto_ph')}"><label class="field-label full" for="profileKistStartDate">${t('prof_kist_start_label')} <span class="optional-label">${t('prof_kist_start_opt')}</span></label><input id="profileKistStartDate" type="date"></div><button type="button" class="primary-button" id="profileKistAddBtn">${t('prof_kist_add_btn')}</button></form></section>`;
  // SISP-13: per-customer MikroTik script — read-only text the
  // operator copies into WinBox Terminal; generating it never writes the
  // ledger. The password itself is never shown in the profile view, only
  // inside this copyable script (that is the point of the feature).
  const mikrotikSnippet = buildCustomerMikrotikSnippet(customer);
  const mikrotikSectionHtml = `<section class="profile-mikrotik-section" aria-label="${t('prof_mikrotik_aria')}"><h4>${t('prof_mikrotik_heading')}</h4><p class="profile-mikrotik-note">${t('prof_mikrotik_note')}</p><textarea id="profileMikrotikScript" class="mikrotik-script-box" readonly rows="10" aria-label="${t('prof_mikrotik_textarea_aria')}">${escapeHtml(mikrotikSnippet)}</textarea><button type="button" class="secondary-button" id="profileMikrotikCopyBtn">${t('prof_mikrotik_copy')}</button></section>`;
  // SISP-47: vacation-hold router snippet — shown only when a hold is
  // scheduled/active (disable snippet), its auto-resume date has passed,
  // or the customer was resumed after a recorded hold (enable snippet).
  // Pasting is the only thing that changes the router; resuming in the
  // app never silently re-enables the secret.
  const holdRouter = vacationHoldRouterPresentation(customer, { todayStr: localDate() });
  const vacationHoldSectionHtml = holdRouter.visible ? `<section class="profile-mikrotik-section profile-vacation-hold-section" aria-label="${t('prof_hold_aria')}"><h4>${t('prof_hold_heading')}</h4><p class="profile-mikrotik-note">${escapeHtml(holdRouter.statusText)}</p><p class="profile-mikrotik-note">${t('prof_hold_note')}</p><textarea id="profileVacationHoldScript" class="mikrotik-script-box" readonly rows="7" aria-label="${t('prof_hold_textarea_aria')}">${escapeHtml(holdRouter.snippet)}</textarea><button type="button" class="secondary-button" id="profileVacationHoldCopyBtn">${escapeHtml(holdRouter.copyLabel)}</button></section>` : '';
  // SISP-94: router credential vault — passwords masked by default; the
  // markup builder only receives the reveal flags, so a masked render
  // never contains the secrets at all.
  const routerCredSectionHtml = routerCredentialsSectionHtml(customer, { revealWifi: routerCredRevealed.wifi, revealAdmin: routerCredRevealed.admin });
  const profileInfoGroupsHtml = `<div class="profile-info-groups">${profileInfoGroupMarkup(t('prof_group_contact'), [[t('prof_field_phone'), phone || t('prof_not_set')], [t('prof_field_cnic'), cnic ? formatCnicDisplay(cnic) : t('prof_not_set')]])}${profileInfoGroupMarkup(t('prof_group_location'), [[t('prof_field_area'), customer.mohalla || t('prof_not_set')], [t('prof_field_zone'), customer.zone || t('prof_not_set')], [t('prof_field_address'), customer.address || t('prof_not_set'), true], [t('prof_field_notes'), customer.notes?.trim() || t('prof_not_set'), true]])}${profileInfoGroupMarkup(t('prof_group_service'), [[t('prof_field_isp'), customer.ispProvider || t('prof_not_set')], [t('prof_field_service_status'), manualServiceStatusLabel(customer.serviceStatus)], [t('prof_field_hold'), pauseSummary.detail], [t('prof_field_package'), customer.packageSpeed || t('prof_not_set')], [t('prof_field_payday'), paydaySummary.label], [t('prof_field_purchase_cost'), formatAmount(customer.monthlyPurchaseCost)], [t('prof_field_selling'), formatAmount(customer.monthlySellingAmount)]])}${profileInfoGroupMarkup(t('prof_group_connection'), [[t('prof_field_conn_start'), customer.connectionDate ? humanDate(customer.connectionDate) : t('prof_not_recorded')], [t('prof_field_conn_fee'), formatAmount(customer.connectionFee)], [t('prof_field_router'), customer.routerModel || t('prof_not_recorded')], [t('prof_field_router_price'), formatAmount(customer.routerPrice)], [t('prof_field_fiber'), customer.fiberMeters === null || customer.fiberMeters === undefined || customer.fiberMeters === '' ? t('prof_not_recorded') : t('prof_fiber_meters', null, { meters: customer.fiberMeters })], [t('prof_field_mc_cost'), formatAmount(customer.mediaConverterCost)], [t('prof_field_lineman_fee'), formatAmount(customer.linemanInstallFee)], [t('prof_field_fiber_rate'), customer.fiberPerMeterRate === null || customer.fiberPerMeterRate === undefined || customer.fiberPerMeterRate === '' ? t('prof_not_recorded') : t('prof_fiber_rate_unit', null, { amount: formatAmount(customer.fiberPerMeterRate) })], [t('prof_field_install'), installationCostProfileLine(customer)], [t('prof_field_pppoe'), customer.pppoeUsername || t('prof_not_set')], [t('prof_field_static_ip'), customer.staticIp || t('prof_not_set')], [t('prof_field_mac'), customer.macAddress || t('prof_not_set')], [t('prof_field_expiry'), customer.expiryDate ? humanDate(customer.expiryDate) : t('prof_not_recorded')], [t('prof_field_cancel_date'), customer.cancellationDate ? humanDate(customer.cancellationDate) : t('prof_not_recorded')]])}</div>`;
  // SISP-19: profile hardware custody — ownership fields on the record,
  // plus the disconnection recovery checklist once archived (archive is
  // the app's disconnect action). Fiber drop length reuses fiberMeters.
  const custodyFields = normalizeCustodyFields(customer);
  const custodyChecklist = disconnectionChecklist(customer);
  const custodyPending = custodyChecklist.filter(item => !item.recovered);
  // SISP-50: deposit settlement block inside the custody section —
  // visible only for disconnected customers holding (or having settled)
  // a security deposit. Arrears come from the canonical allocation
  // engine for this customer alone, the same balances the dues lists
  // and profile net-due read.
  const depositAllocations = calculatePaymentAllocations({ customers: [customer] });
  let depositArrearsCents = 0;
  for (const bill of customer.bills ?? []) {
    const summary = depositAllocations.forMonth(customer.id, bill.month);
    if (summary && typeof summary.balanceDueCents === 'number' && summary.balanceDueCents > 0) depositArrearsCents += summary.balanceDueCents;
  }
  const depositPres = depositSettlementPresentation(customer, depositArrearsCents / 100);
  // SISP-64: bad-debt write-off block — visible only on archived
  // (churned) customers who still owe money or already carry an active
  // write-off. Arrears reuse the same engine snapshot as the deposit
  // block above, so the amount offered for write-off is exactly the
  // collectible balance every dues surface shows.
  const badDebtPres = badDebtPresentation(customer, loadBadDebts(), depositArrearsCents / 100);
  const badDebtSectionHtml = !badDebtPres.visible ? '' : (badDebtPres.writtenOff
    ? `<section class="profile-custody-section profile-bad-debt-section" aria-label="${t('bd_aria')}"><h4>${t('bd_heading')}</h4><p class="custody-recovered">${escapeHtml(badDebtPres.writtenOffLabel)}</p>${badDebtPres.reasonLabel ? `<p>${escapeHtml(badDebtPres.reasonLabel)}</p>` : ''}<p class="profile-custody-note">${escapeHtml(badDebtPres.noteLabel)}</p></section>`
    : `<section class="profile-custody-section profile-bad-debt-section" aria-label="${t('bd_aria')}"><h4>${t('bd_heading')}</h4><p>${escapeHtml(badDebtPres.arrearsLabel)}</p><p class="profile-custody-note">${escapeHtml(badDebtPres.noteLabel)}</p><div class="form-grid"><div class="form-cell profile-bad-debt-reason"><label class="field-label full" for="profileBadDebtReason">${escapeHtml(badDebtPres.reasonLabel)}</label><input id="profileBadDebtReason" class="full" type="text" maxlength="200" placeholder="${escapeHtml(badDebtPres.reasonPlaceholder)}"></div></div><button type="button" class="primary-button" id="profileBadDebtWriteOffBtn">${escapeHtml(badDebtPres.writeOffLabel)}</button></section>`);
  const depositSettlementHtml = !depositPres.visible ? '' : (depositPres.settled
    ? `<section class="profile-custody-section profile-deposit-settlement" aria-label="${t('prof_dep_aria')}"><h4>${t('prof_dep_heading')}</h4><p class="custody-recovered">${escapeHtml(depositPres.settledLabel)}</p>${depositPres.stillDueLabel ? `<p class="custody-pending">${escapeHtml(depositPres.stillDueLabel)}</p>` : ''}<button type="button" class="secondary-button" id="profileDepositReceiptBtn">${escapeHtml(depositPres.receiptLabel)}</button></section>`
    : `<section class="profile-custody-section profile-deposit-settlement" aria-label="${t('prof_dep_aria')}"><h4>${t('prof_dep_heading')}</h4><p>${escapeHtml(depositPres.depositLabel)}${escapeHtml(depositPres.arrearsLabel)}${escapeHtml(depositPres.hardwareLabel)}</p><p><strong>${escapeHtml(depositPres.refundLabel)}</strong></p><p class="profile-custody-note">${escapeHtml(depositPres.noteLabel)}</p><button type="button" class="primary-button" id="profileDepositSettleBtn">${escapeHtml(depositPres.settleLabel)}</button></section>`);
  const custodySectionHtml = `<section class="profile-custody-section" aria-label="${t('prof_custody_aria')}"><h4>${t('prof_custody_heading')}</h4><p>${escapeHtml(t('prof_custody_router', null, { label: profileCustodyOwnershipLabel(custodyFields.routerOwnership) }))}${escapeHtml(t('prof_custody_media', null, { label: profileCustodyOwnershipLabel(custodyFields.mediaConverterOwnership) }))}</p><p>${escapeHtml(t('prof_custody_serial', null, { value: custodyFields.serialNumber || t('prof_not_recorded') }))}${escapeHtml(t('prof_custody_deposit', null, { amount: formatAmount(custodyFields.securityDeposit) }))}${escapeHtml(t('prof_custody_fiber', null, { value: customer.fiberMeters === null || customer.fiberMeters === undefined || customer.fiberMeters === '' ? t('prof_not_recorded') : t('prof_fiber_meters', null, { meters: customer.fiberMeters }) }))}</p>${!isDisconnected(customer) ? (custodyChecklist.length === 0 ? `<p class="profile-custody-note">${t('prof_custody_note_none')}</p>` : `<p class="profile-custody-note">${t('prof_custody_note_installed')}</p>`) : (custodyChecklist.length === 0 ? `<p class="profile-custody-note">${t('prof_custody_note_disconnected')}</p>` : `<div class="profile-custody-checklist" role="group" aria-label="${t('prof_custody_checklist_aria')}"><p><strong>${t('prof_custody_checklist_head')}</strong> ${t('prof_custody_checklist_sub')}</p><ul>${custodyChecklist.map(item => `<li>${escapeHtml(item.label)} — ${escapeHtml(profileCustodyOwnershipLabel(item.ownership))}${item.recovered ? ` <span class="custody-recovered">${escapeHtml(t('prof_custody_recovered', null, { date: item.recoveredAt }))}</span>` : ` <span class="custody-pending">${escapeHtml(t('prof_custody_pending'))}</span> <button type="button" class="secondary-button" data-profile-custody-recover="${escapeHtml(item.key)}">${t('prof_custody_recover')}</button>`}</li>`).join('')}</ul>${custodyPending.length > 0 ? `<button type="button" class="primary-button" id="profileCustodyRecoverAllBtn">${t('prof_custody_recover_all')}</button>` : ''}</div>`)}</section>`;
  $('#customerProfileView').innerHTML = `<div class="profile-view-heading"><h3>${t('prof_view_heading')}</h3>${customer.isFreeConnection ? `<span class="free-connection-badge">${t('prof_free_badge')}</span>` : ''}${commercialVipBadgeHtml(customer)}${prepaidUntilBadgeHtml(state, customer)}${loyaltyBadgeHtml(customer)}<div class="profile-view-actions"><details class="help-tip"><summary class="help-icon" aria-label="${t('prof_view_help_aria')}" aria-controls="customerInfoGuidance">i</summary><span id="customerInfoGuidance" class="help-tip-content" role="tooltip">${t('prof_view_help')}</span></details><button id="editProfileButton" class="text-button profile-edit-button" type="button">${t('prof_view_edit')}</button><button id="profileQrCardButton" class="secondary-button" type="button">${t('prof_view_qr')}</button>${speakDueButtonMarkup(customer.customerNumber)}</div></div>${profileInfoGroupsHtml}${phoneActions ? `<div class="profile-contact-shortcuts">${phoneActions}</div>` : ''}${phoneHint}<p class="profile-view-profit">${escapeHtml(t('prof_view_profit', null, { value: profit === null ? t('prof_not_set') : formatAmount(profit) }))}</p>${waadaSectionHtml}${complaintsSectionHtml}${ticketsSectionHtml}${downtimeSectionHtml}${referralSectionHtml}${upsellSectionHtml}${bottleneckSectionHtml}${opticalSectionHtml}${gpsSectionHtml}${poleSectionHtml}${feederSectionHtml}${kistSectionHtml}${mikrotikSectionHtml}${vacationHoldSectionHtml}${routerCredSectionHtml}${custodySectionHtml}${depositSettlementHtml}${badDebtSectionHtml}${renderRelocationTimeline(customer)}`;  $('#customerProfileView').insertAdjacentHTML('beforeend', customerLifetimeValueMarkup(lifetimeValue));  $('#customerProfileView').querySelector('#editProfileButton').addEventListener('click', () => {    profileEditMode = true;    $('#customerProfileView').hidden = true;
    $('#customerProfileForm').hidden = false;
    $('#mohallaInput').focus();
  });
  // SISP-14: QR Khata Card button on the profile.
  $('#customerProfileView').querySelector('#profileQrCardButton')?.addEventListener('click', () => openQrKhataCard(customer));
  // SISP-65: [🔊 Speak Due] on the profile heading — speaks the
  // customer's name + net due (speakCustomerDue reads the same
  // allocation-engine figures Field Mode shows); on a device with no
  // speech engine the exact text is toasted instead, never a dead end.
  $('#customerProfileView').querySelector('[data-speak-due]')?.addEventListener('click', () => {
    const { text, spoken } = speakCustomerDue(state, customer.id);
    if (!spoken && text) toast(text);
  });
  // SISP-28: house shift button on the profile timeline section.
  $('#customerProfileView').querySelector('#profileRecordRelocationBtn')?.addEventListener('click', () => {
    if (!relocationModalController) { toast('Relocation form is not ready.'); return; }
    const currentMonth = monthsForHistory(new Date())[0];
    relocationModalController.open(customer.id, customer, {
      today: localDate(),
      hasCurrentBill: (customer.bills ?? []).some(bill => bill.month === currentMonth)
    });
  });
  // SISP-3: wire the profile Waada chips (persist + re-render on every action).
  const waadaSection = $('#customerProfileView').querySelector('.profile-waada-section');
  if (waadaSection) {
    const applyProfileWaada = (updated, message) => {
      const idx = state.customers.findIndex(c => c.id === customer.id);
      if (idx >= 0) state.customers[idx] = updated;
      try { persistState(state, localStorage); } catch {}
      renderDetail();
      toast(message);
    };
    const setProfileWaada = (date) => {
      try {
        applyProfileWaada(setCustomerWaada(customer, { promiseDate: date, promiseAmount: customer.promiseAmount ?? null, promiseNote: customer.promiseNote ?? '' }), `Waada set: ${date}.`);
      } catch (err) { toast(err?.message || 'Could not set promise.'); }
    };
    waadaSection.querySelectorAll('[data-profile-waada-chip]').forEach(btn => {
      btn.addEventListener('click', () => {
        const date = computeWaadaChipDate(btn.getAttribute('data-profile-waada-chip'), getTodayDateString());
        if (!date) { toast('Could not compute promise date.'); return; }
        setProfileWaada(date);
      });
    });
    waadaSection.querySelector('#profileWaadaSetCustomBtn')?.addEventListener('click', () => {
      const input = waadaSection.querySelector('#profileWaadaCustomDate');
      const date = computeWaadaChipDate('custom', getTodayDateString(), input?.value);
      if (!date) { toast('Pick a valid date first.'); return; }
      setProfileWaada(date);
    });
    waadaSection.querySelector('#profileWaadaClearBtn')?.addEventListener('click', () => {
      applyProfileWaada(clearCustomerWaada(customer), 'Waada promise cleared.');
    });
  }
  // SISP-15: profile button opens the register pre-filtered to this customer.
  const profileComplaintBtn = $('#customerProfileView').querySelector('#profileOpenComplaintRegisterBtn');
  if (profileComplaintBtn) profileComplaintBtn.addEventListener('click', () => {
    if (complaintRegisterModalController) complaintRegisterModalController.open({ customer: String(customer.id) });
  });
  // SISP-12: profile button opens the field tickets modal pre-filtered to this customer.
  const profileTicketsBtn = $('#customerProfileView').querySelector('#profileOpenFieldTicketsBtn');
  if (profileTicketsBtn) profileTicketsBtn.addEventListener('click', () => {
    if (fieldTicketsModalController) fieldTicketsModalController.open({ customer: String(customer.id) });
  });
  // SISP-16: profile button opens the downtime analytics modal (current month).
  const profileDowntimeBtn = $('#customerProfileView').querySelector('#profileOpenDowntimeAnalyticsBtn');
  if (profileDowntimeBtn) profileDowntimeBtn.addEventListener('click', () => {
    if (downtimeAnalyticsModalController) downtimeAnalyticsModalController.open({ month: pakistanMonthNow() });
  });
  // SISP-24: profile button opens the splitter port map on this customer's box.
  const profileSplitterBtn = $('#customerProfileView').querySelector('#profileOpenSplitterMapBtn');
  if (profileSplitterBtn) profileSplitterBtn.addEventListener('click', () => {
    if (splitterMapModalController) splitterMapModalController.open({ boxId: normalizeOpticalFields(customer).splitterBoxId });
  });
  // SISP-92: capture / clear this customer's GPS pin. Capture is
  // fail-safe — any geolocation failure toasts and leaves the saved pin
  // (or absence of one) exactly as it was.
  const profileCaptureGpsBtn = $('#customerProfileView').querySelector('#profileCaptureGpsBtn');
  if (profileCaptureGpsBtn) profileCaptureGpsBtn.addEventListener('click', async () => {
    profileCaptureGpsBtn.disabled = true;
    const result = await captureCurrentPosition();
    if (!result.ok) {
      toast(t(result.reason === 'unsupported' ? 'gpspin_unsupported' : 'gpspin_failed'));
      profileCaptureGpsBtn.disabled = false;
      return;
    }
    try {
      state = updateCustomerProfile(state, customer.id, { gpsLat: result.lat, gpsLng: result.lng });
      save();
      toast(t('gpspin_saved'));
      if (!profileEditMode) renderDetail();
    } catch (error) { toast(error.message); }
  });
  const profileClearGpsBtn = $('#customerProfileView').querySelector('#profileClearGpsBtn');
  if (profileClearGpsBtn) profileClearGpsBtn.addEventListener('click', () => {
    try {
      state = updateCustomerProfile(state, customer.id, { gpsLat: '', gpsLng: '' });
      save();
      toast(t('gpspin_cleared'));
      if (!profileEditMode) renderDetail();
    } catch (error) { toast(error.message); }
  });
  // OWNER-SIGNAL: record a fresh manual signal reading from the profile
  // — appends to the history and refreshes lastRxDbm in one save.
  const profileSignalRecordBtn = $('#customerProfileView').querySelector('#profileSignalRecordBtn');
  if (profileSignalRecordBtn) profileSignalRecordBtn.addEventListener('click', () => {
    const view = $('#customerProfileView');
    try {
      const updated = appendSignalReading(customer, {
        dbm: view.querySelector('#profileSignalDbmInput')?.value ?? '',
        source: 'manual',
        note: view.querySelector('#profileSignalNoteInput')?.value ?? ''
      });
      const idx = state.customers.findIndex(c => c.id === customer.id);
      if (idx >= 0) state.customers[idx] = updated;
      try { persistState(state, localStorage); } catch {}
      renderDetail();
      toast(t('sig_saved_toast', null, { dbm: updated.lastRxDbm }));
    } catch (error) { toast(error.message || 'Signal reading could not be saved.'); }
  });
  // SISP-7: profile button traces this customer's downstream impact.
  const profileOutageTraceBtn = $('#customerProfileView').querySelector('#profileOutageTraceBtn');
  if (profileOutageTraceBtn) profileOutageTraceBtn.addEventListener('click', () => {
    if (outageImpactModalController) outageImpactModalController.open({ sourceId: String(customer.id) });
  });
  // SISP-13: copy the per-customer MikroTik snippet (read-only text).
  const profileMikrotikCopyBtn = $('#customerProfileView').querySelector('#profileMikrotikCopyBtn');
  if (profileMikrotikCopyBtn) profileMikrotikCopyBtn.addEventListener('click', async () => {
    const scriptBox = $('#customerProfileView').querySelector('#profileMikrotikScript');
    const text = scriptBox ? scriptBox.value : mikrotikSnippet;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        scriptBox?.select();
        document.execCommand('copy');
      }
      toast('MikroTik script copied.');
    } catch {
      toast('Could not copy the script — select it and copy manually.');
    }
  });
  // SISP-47: copy the vacation-hold disable/enable snippet (read-only text).
  const profileVacationHoldCopyBtn = $('#customerProfileView').querySelector('#profileVacationHoldCopyBtn');
  if (profileVacationHoldCopyBtn) profileVacationHoldCopyBtn.addEventListener('click', async () => {
    const scriptBox = $('#customerProfileView').querySelector('#profileVacationHoldScript');
    const text = scriptBox ? scriptBox.value : holdRouter.snippet;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        scriptBox?.select();
        document.execCommand('copy');
      }
      toast(t('prof_hold_copied'));
    } catch {
      toast(t('prof_hold_copy_failed'));
    }
  });
  // SISP-94: wire the router credential vault — eye toggles re-render
  // ONLY this section (the rest of the profile is untouched), copy reads
  // the secret from state on the explicit tap, and the WhatsApp button
  // opens the prefilled wa.me draft for the owner to review and send.
  const wireRouterCredSection = () => {
    const section = $('#customerProfileView').querySelector('.profile-router-cred-section');
    if (!section) return;
    section.querySelectorAll('[data-rcred-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const which = btn.getAttribute('data-rcred-toggle');
        if (which === 'wifi') routerCredRevealed.wifi = !routerCredRevealed.wifi;
        else if (which === 'admin') routerCredRevealed.admin = !routerCredRevealed.admin;
        else return;
        section.outerHTML = routerCredentialsSectionHtml(customer, { revealWifi: routerCredRevealed.wifi, revealAdmin: routerCredRevealed.admin });
        wireRouterCredSection();
      });
    });
    section.querySelectorAll('[data-rcred-copy]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const creds = routerCredentialsOf(customer);
        const value = btn.getAttribute('data-rcred-copy') === 'wifi' ? creds.wifiPassword : creds.routerAdminPassword;
        if (!value) return;
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
          } else {
            const scratch = document.createElement('textarea');
            scratch.value = value;
            document.body.appendChild(scratch);
            scratch.select();
            document.execCommand('copy');
            scratch.remove();
          }
          toast(t('rcred_copied'));
        } catch {
          toast(t('rcred_copy_failed'));
        }
      });
    });
    section.querySelector('#profileWifiWhatsappBtn')?.addEventListener('click', () => {
      const action = resolveWifiWhatsAppAction(customer);
      if (action.type === 'draft') window.open(action.draft.url, '_blank', 'noopener');
      else if (action.type === 'phone-required') toast(t('rcred_wa_phone_toast'));
      else toast(t('rcred_wa_no_details_toast'));
    });
  };
  wireRouterCredSection();
  // SISP-4 + SISP-29: wire the profile kist form (add plan + remove
  // unbilled plan + optional down-payment record + early payoff).
  // Adding a plan only records it — billing happens in the cycle. Only
  // the optional down-payment checkbox records a payment, through the
  // normal addPayment path; nothing else here touches bills or payments.
  const kistSection = $('#customerProfileView').querySelector('.profile-kist-section');
  if (kistSection) {
    const applyProfileKist = (updated, message) => {
      const idx = state.customers.findIndex(c => c.id === customer.id);
      if (idx >= 0) state.customers[idx] = updated;
      try { persistState(state, localStorage); } catch {}
      renderDetail();
      toast(message);
    };
    kistSection.querySelector('#profileKistAddBtn')?.addEventListener('click', () => {
      try {
        const plan = createInstallmentPlan({
          itemTitle: kistSection.querySelector('#profileKistItemTitle')?.value ?? '',
          totalAmount: kistSection.querySelector('#profileKistTotalAmount')?.value ?? '',
          downPayment: kistSection.querySelector('#profileKistDownPayment')?.value ?? '',
          totalMonths: kistSection.querySelector('#profileKistTotalMonths')?.value ?? '',
          monthlyKist: kistSection.querySelector('#profileKistMonthlyKist')?.value ?? '',
          startDate: kistSection.querySelector('#profileKistStartDate')?.value ?? ''
        });
        const plans = [...(customer.installmentPlans ?? []), plan];
        const customerWithPlan = { ...customer, installmentPlans: plans };
        const recordDown = kistSection.querySelector('#profileKistRecordDownPayment')?.checked === true;
        const downMethod = kistSection.querySelector('#profileKistDownPaymentMethod')?.value ?? 'Cash';
        if (recordDown && plan.downPayment > 0 && PAYMENT_METHODS.includes(downMethod)) {
          // SISP-29: put the plan in state first, then record the down
          // payment on the current month's bill through the normal payment
          // path (same as the payment form: addPayment + save + render).
          // If recording fails, the plan itself still stays saved.
          const idx = state.customers.findIndex((row) => row.id === customer.id);
          if (idx >= 0) state.customers[idx] = customerWithPlan;
          try {
            const month = pakistanMonthNow();
            const beforeIds = new Set(((state.customers[idx]?.bills ?? []).find((row) => row.month === month)?.payments ?? []).map((row) => row.id));
            state = addPayment(state, customer.id, month, { date: pakistanToday(), amount: plan.downPayment, method: downMethod });
            save();
            renderDetail();
            const paidCustomer = state.customers.find((row) => row.id === customer.id);
            const added = paidCustomer?.bills.find((row) => row.month === month)?.payments.find((row) => !beforeIds.has(row.id));
            if (added) printDownPaymentKistReceipt(paidCustomer, plan, added);
            toast(`Installment plan added: ${plan.itemTitle} (${plan.totalMonths} × ${formatAmount(plan.monthlyKist)}). Down payment ${formatAmount(plan.downPayment)} recorded (${downMethod}) with receipt.`);
          } catch (err) {
            try { persistState(state, localStorage); } catch {}
            renderDetail();
            toast(`Installment plan added, but the down payment could not be recorded: ${err?.message || 'unknown error'}. Record it from the payment form.`);
          }
          return;
        }
        applyProfileKist(customerWithPlan, `Installment plan added: ${plan.itemTitle} (${plan.totalMonths} × ${formatAmount(plan.monthlyKist)}). It will bill with the next monthly cycle.`);
      } catch (err) { toast(err?.message || 'Could not add installment plan.'); }
    });
    kistSection.querySelectorAll('[data-profile-kist-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const planId = btn.getAttribute('data-profile-kist-remove');
        const plans = (customer.installmentPlans ?? []).filter((plan) => plan.id !== planId);
        // Only unbilled plans get a remove button, so this never deletes
        // a billed installment or its history.
        applyProfileKist({ ...customer, installmentPlans: plans }, 'Installment plan removed (nothing had been billed yet).');
      });
    });
    // SISP-29: 1-click early payoff. Confirm shows the exact remaining
    // balance; on confirm the plan is settled (monthsBilled = monthsPaid =
    // totalMonths, status completed) so no future cycle bills it again.
    kistSection.querySelectorAll('[data-profile-kist-payoff]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const planId = btn.getAttribute('data-profile-kist-payoff');
        const plan = (customer.installmentPlans ?? []).find((row) => row.id === planId);
        const presentation = kistSettlementPresentation(plan);
        if (!presentation.canPayoff) return;
        const confirmed = await appConfirm({ tone:'warning', title:'Settle remaining kist early?', subject:`${plan.itemTitle} · ${formatAmount(presentation.payoffAmount)} remaining`, message:'This closes the plan now. Future monthly cycles will not bill this plan again.', confirmLabel:'Settle now' });
        if (!confirmed) return;
        const plans = settlePlanEarly(customer.installmentPlans, planId, { date: pakistanToday() });
        applyProfileKist({ ...customer, installmentPlans: plans }, `Kist settled early: ${plan.itemTitle} — remaining ${formatAmount(presentation.payoffAmount)} closed. No future cycle will bill it.`);
      });
    });
  }
  // SISP-19: wire the profile recovery checklist (persist + re-render).
  // Recovery dates are set ONLY here — never by the profile edit form.
  const custodySection = $('#customerProfileView').querySelector('.profile-custody-section');
  if (custodySection) {
    const applyProfileCustody = (beforeCustomer, updated, message) => {
      const idx = state.customers.findIndex(c => c.id === customer.id);
      if (idx >= 0) state.customers[idx] = updated;
      try { persistState(state, localStorage); } catch {}
      recordRecoveryStock(beforeCustomer, updated);
      renderDetail();
      renderDashboard();
      toast(message);
    };
    custodySection.querySelectorAll('[data-profile-custody-recover]').forEach(btn => {
      btn.addEventListener('click', () => {
        try {
          const updated = markHardwareRecovered(customer, btn.getAttribute('data-profile-custody-recover'), getTodayDateString());
          applyProfileCustody(customer, updated, 'Hardware marked recovered.');
        } catch (err) { toast(err?.message || 'Could not mark hardware recovered.'); }
      });
    });
    custodySection.querySelector('#profileCustodyRecoverAllBtn')?.addEventListener('click', () => {
      try {
        const updated = markAllHardwareRecovered(customer, getTodayDateString());
        applyProfileCustody(customer, updated, 'All hardware marked recovered.');
      } catch (err) { toast(err?.message || 'Could not mark hardware recovered.'); }
    });
  }
  // SISP-50: wire the deposit settlement block (persist + re-render).
  // The money split is recomputed from a FRESH allocation snapshot at
  // click time, never from the rendered quote, so a stale screen can
  // never settle stale arrears.
  const depositSection = $('#customerProfileView').querySelector('.profile-deposit-settlement');
  if (depositSection) {
    depositSection.querySelector('#profileDepositSettleBtn')?.addEventListener('click', () => {
      try {
        const freshAllocations = calculatePaymentAllocations({ customers: [customer] });
        let arrearsCents = 0;
        const billBalances = [];
        for (const bill of customer.bills ?? []) {
          const summary = freshAllocations.forMonth(customer.id, bill.month);
          if (summary && typeof summary.balanceDueCents === 'number' && summary.balanceDueCents > 0) {
            arrearsCents += summary.balanceDueCents;
            billBalances.push({ month: bill.month, balanceDue: summary.balanceDueCents / 100 });
          }
        }
        const updated = applyDepositSettlement(customer, arrearsCents / 100, { date: getTodayDateString(), billBalances });
        const idx = state.customers.findIndex(c => c.id === customer.id);
        if (idx >= 0) state.customers[idx] = updated;
        try { persistState(state, localStorage); } catch {}
        renderDetail();
        renderDashboard();
        toast('Security deposit settled — arrears cleared from the deposit.');
      } catch (err) { toast(err?.message || 'Could not settle the security deposit.'); }
    });
    depositSection.querySelector('#profileDepositReceiptBtn')?.addEventListener('click', () => {
      printDepositSettlementReceipt(customer.id);
    });
  }
  // SISP-64: wire the bad-debt write-off block (persist + re-render).
  // The amount is recomputed from a FRESH allocation snapshot at click
  // time, never from the rendered block, so a stale screen can never
  // write off stale arrears.
  const badDebtSection = $('#customerProfileView').querySelector('.profile-bad-debt-section');
  if (badDebtSection) {
    badDebtSection.querySelector('#profileBadDebtWriteOffBtn')?.addEventListener('click', async () => {
      try {
        const freshAllocations = calculatePaymentAllocations({ customers: [customer] });
        let arrearsCents = 0;
        const billBalances = [];
        for (const bill of customer.bills ?? []) {
          const summary = freshAllocations.forMonth(customer.id, bill.month);
          if (summary && typeof summary.balanceDueCents === 'number' && summary.balanceDueCents > 0) {
            arrearsCents += summary.balanceDueCents;
            billBalances.push({ month: bill.month, balanceDue: summary.balanceDueCents / 100 });
          }
        }
        const reason = badDebtSection.querySelector('#profileBadDebtReason')?.value ?? '';
        const confirmed = await appConfirm({ tone: 'warning', title: t('bd_confirm_title'), subject: `${formatAmount(arrearsCents / 100)} · #${customer.customerNumber} ${customer.name}`, message: t('bd_confirm_msg', null, { amount: formatAmount(arrearsCents / 100), number: customer.customerNumber, name: customer.name }), confirmLabel: t('bd_confirm_btn') });
        if (!confirmed) return;
        const result = writeOffBadDebt(loadBadDebts(), customer, billBalances, { date: getTodayDateString(), reason });
        saveBadDebts(result.entries);
        const idx = state.customers.findIndex(c => c.id === customer.id);
        if (idx >= 0) state.customers[idx] = result.customer;
        try { persistState(state, localStorage); } catch {}
        renderDetail();
        renderDashboard();
        toast(t('bd_toast_done', null, { amount: formatAmount(result.entry.amount) }));
      } catch (err) { toast(err?.message || 'Could not write off this bad debt.'); }
    });
  }
}
function renderCurrentBillSummary(customer) {
  const month = monthsForHistory(new Date())[0];
  const allocations = calculatePaymentAllocations(state);
  const summary = currentBillPresentation(customer, month, allocations);
  // The customer's advance balance (advance-payment.js is the single
  // source for this figure — the credit the next cycle will consume).
  const unusedCreditCents = advanceBalanceCents(state, customer.id, allocations);
  // SISP-43: pending billed ticket charges join the profile due summary.
  // They live on the tickets, never inside bills, so they get their own
  // stat (with the combined payable) — shown only while charges pend.
  const ticketChargesPending = billedTicketChargesPending(loadTickets(), customer.id);
  const currentStatusKey = { paid: 'prof_current_status_paid', pending: 'prof_current_status_pending', partial: 'prof_current_status_partial', 'not-set': 'prof_not_set' }[summary.status];
  $('#customerCurrentBillSummary').innerHTML = `<div class="current-bill-heading"><h3>${t('prof_current_heading', null, { month: displayMonthName(month) })}</h3><details class="help-tip"><summary class="help-icon" aria-label="${t('prof_current_help_label')}" aria-controls="currentBillGuidance">i</summary><span id="currentBillGuidance" class="help-tip-content" role="tooltip">${t('prof_current_help')}</span></details></div><div class="current-bill-grid" aria-live="polite"><article class="current-bill-stat"><span>${t('prof_current_monthly_bill')}</span><strong>${summary.billAmount === null ? t('prof_not_set') : escapeHtml(formatAmount(summary.billAmount))}</strong></article><article class="current-bill-stat"><span>${t('prof_current_received')}</span><strong>${summary.receiptCount?escapeHtml(formatAmount(summary.receivedAmount)):t('prof_current_no_receipts')}</strong></article><article class="current-bill-stat"><span>${t('prof_current_status')}</span><strong class="customer-billing-badge ${escapeHtml(summary.statusClassName)}">${escapeHtml(currentStatusKey ? t(currentStatusKey) : summary.statusLabel)}</strong></article><article class="current-bill-stat"><span>${t('prof_current_net_due')}</span><strong>${summary.balanceDueCents === null ? t('prof_not_set') : escapeHtml(formatAmount(summary.balanceDueCents / 100))}</strong></article><article class="current-bill-stat"><span>${t('prof_current_unused_credit')}</span><strong>${unusedCreditCents?escapeHtml(formatAmount(unusedCreditCents/100)):t('prof_none_recorded')}</strong></article>${ticketChargesPending > 0 ? `<article class="current-bill-stat"><span>${t('prof_current_ticket_charges')}</span><strong>${escapeHtml(formatAmount(ticketChargesPending))}</strong></article>` : ''}</div>${summary.fifo && (summary.fifo.previousArrears > 0 || summary.fifo.kistTotal > 0) ? `<div class="current-bill-grid" aria-label="${t('prof_fifo_aria')}"><article class="current-bill-stat"><span>${t('prof_fifo_arrears')}</span><strong>${escapeHtml(formatAmount(summary.fifo.remainingArrears))}</strong></article><article class="current-bill-stat"><span>${t('prof_fifo_package')}</span><strong>${escapeHtml(formatAmount(summary.fifo.remainingPackage))}</strong></article><article class="current-bill-stat"><span>${t('prof_fifo_kist')}</span><strong>${escapeHtml(formatAmount(summary.fifo.remainingKist))}</strong></article></div>` : ''}`;
}
// Owner feature (2026-10-29): Manual Baqaya profile flows. The
// section lives in the Billing tab (mounted from #manualBaqayaSection);
// entries stay readable on archived profiles but the Add/Edit/Remove
// controls render only for a live, non-FREE connection (core enforces
// the same rules again in its mutations).
let manualBaqayaDialogCustomerId = null;
function renderManualBaqayaSection(customer) {
  const section = $('#manualBaqayaSection');
  if (!section) return;
  const entries = manualBaqayaEntriesWithRemaining(customer);
  const canAdd = !customer.archived && customer.isFreeConnection !== true;
  section.hidden = entries.length === 0 && !canAdd;
  if (section.hidden) { section.innerHTML = ''; return; }
  section.innerHTML = manualBaqayaSectionMarkup(customer, { archived: !!customer.archived });
  section.querySelector('[data-add-baqaya]')?.addEventListener('click', () => openManualBaqayaDialog(customer.id));
  section.querySelectorAll('[data-edit-baqaya]').forEach((button) => button.addEventListener('click', () => openManualBaqayaDialog(customer.id, button.getAttribute('data-edit-baqaya'))));
  section.querySelectorAll('[data-remove-baqaya]').forEach((button) => button.addEventListener('click', () => removeManualBaqayaEntryFlow(customer.id, button.getAttribute('data-remove-baqaya'))));
}
function openManualBaqayaDialog(customerId, entryId = null) {
  const customer = state.customers.find((entry) => entry.id === customerId);
  if (!customer) return;
  const existing = entryId ? (customer.manualBaqaya ?? []).find((entry) => entry.id === entryId) : null;
  manualBaqayaDialogCustomerId = customerId;
  $('#manualBaqayaDialogTitle').textContent = t(existing ? 'baqaya_dialog_edit_title' : 'baqaya_dialog_add_title');
  $('#manualBaqayaEntryId').value = existing?.id ?? '';
  $('#manualBaqayaAmount').value = existing ? existing.amount : '';
  $('#manualBaqayaDate').value = existing ? existing.date : pakistanToday();
  $('#manualBaqayaDate').max = pakistanToday();
  $('#manualBaqayaNote').value = existing?.note ?? '';
  $('#manualBaqayaDialog').showModal();
}
async function removeManualBaqayaEntryFlow(customerId, entryId) {
  const customer = state.customers.find((entry) => entry.id === customerId);
  const target = (customer?.manualBaqaya ?? []).find((entry) => entry.id === entryId);
  if (!customer || !target) return;
  const confirmed = await appConfirm({ tone: 'danger', title: t('baqaya_remove'), message: t('baqaya_remove_confirm', null, { amount: formatAmount(target.amount) }), confirmLabel: t('baqaya_remove') });
  if (!confirmed) return;
  try {
    state = removeManualBaqayaEntry(state, customerId, entryId);
    save();
    toast(t('baqaya_removed'));
    renderDetail();
    renderCustomers();
  } catch (error) {
    toast(error.message, { type: 'error' });
  }
}

function renderDetail() {
  // FIRST-LOAD SPLIT: start the lazy QA chunk load on first profile open.
  ensureQaModals().catch(() => {});
  const customer = selectedCustomer();
  $('#welcomeState').hidden = !!customer;
  $('#customerDetail').hidden = !customer;
  if (!customer) return;
  // SISP-94: switching profiles re-masks the router vault.
  if (routerCredRevealedFor !== customer.id) {
    routerCredRevealed = { wifi: false, admin: false };
    routerCredRevealedFor = customer.id;
  }
  $('#customerReceiptSummary').innerHTML = profileReceiptSummaryMarkup(customer);
  $('#customerReceiptSummary').querySelector('[data-edit-customer]')?.addEventListener('click', (event) => {
    const id = event.currentTarget.getAttribute('data-edit-customer');
    if (id) editCustomerProfile(id);
  });
  // Owner feature (2026-10-29): the summary grid gains the manual
  // baqaya stat (only while baqaya is unpaid) and the Billing tab
  // renders the entries section.
  const baqayaStat = manualBaqayaStatMarkup(customer);
  if (baqayaStat) $('#customerReceiptSummary .profile-summary-grid')?.insertAdjacentHTML('beforeend', baqayaStat);
  renderManualBaqayaSection(customer);
  $('#profileAvatar').textContent = initials(customer.name);
  $('#detailCustomerNumber').textContent = t('prof_customer_number', null, { n: customer.customerNumber });
  const shownName = displayCustomerName(customer, currentAppLanguage());
  const detailNameEl = $('#detailName');
  const detailNameSubEl = $('#detailNameSub');
  detailNameEl.textContent = shownName;
  detailNameEl.setAttribute('dir', 'auto');
  if (detailNameSubEl) {
    if (currentAppLanguage() === 'ur' && shownName !== customer.name) {
      detailNameSubEl.textContent = customer.name;
      detailNameSubEl.hidden = false;
    } else {
      detailNameSubEl.textContent = '';
      detailNameSubEl.hidden = true;
    }
  }
  closeCustomerNameEditor();
  renderCurrentBillSummary(customer);
  renderCustomerProfileView(customer);
  $('#customerProfileView').hidden = profileEditMode;
  $('#customerProfileForm').hidden = !profileEditMode;
  $('#serviceStatusInput').value = customer.serviceStatus ?? 'not-set';
  // SISP-84: connection type select (legacy records read residential).
  if ($('#connectionTypeInput')) $('#connectionTypeInput').value = customer.connectionType === 'commercial_vip' ? 'commercial_vip' : 'residential';
  const serviceStatus = ['active','offline'].includes(customer.serviceStatus) ? customer.serviceStatus : 'not-set';
  const serviceStatusLabel = manualServiceStatusBareLabel(serviceStatus);
  const serviceStatusBadge = $('#profileServiceStatusBadge');
  serviceStatusBadge.className = `profile-service-status profile-service-status-${serviceStatus}`;
  serviceStatusBadge.textContent = t('prof_service_badge', null, { label: serviceStatusLabel });
  serviceStatusBadge.setAttribute('aria-label', t('prof_service_badge_aria', null, { label: serviceStatusLabel }));
  $('#archiveStateBadge').textContent = profileArchiveLabel(customer.archived, customer.archived ? (customer.archivedAt ? humanLocalDateTime(customer.archivedAt) : t('prof_archive_date_norec')) : '');
  $('#archiveCustomerButton').hidden = customer.archived;
  $('#unarchiveCustomerButton').hidden = !customer.archived;
  // SISP-8: vacation hold — edit fields + header badge (shown only while
  // a hold is active; skipped months stay visible in the profile view).
  const pauseSummary = pauseBillingSummary(customer);
  if ($('#pauseBillingCheckbox')) $('#pauseBillingCheckbox').checked = customer.paused === true;
  if ($('#prefersSmsCheckbox')) $('#prefersSmsCheckbox').checked = customer.prefersSms === true;
  // SISP-91: receipt language/channel preference selects (unset = Default).
  if ($('#preferredReceiptLangSelect')) $('#preferredReceiptLangSelect').value = customer.preferredReceiptLang ?? '';
  if ($('#preferredReceiptChannelSelect')) $('#preferredReceiptChannelSelect').value = customer.preferredReceiptChannel ?? '';
  if ($('#pauseStartDateInput')) $('#pauseStartDateInput').value = customer.pauseStartDate ?? '';
  if ($('#autoResumeDateInput')) $('#autoResumeDateInput').value = customer.autoResumeDate ?? '';
  const pauseBadge = $('#pauseStateBadge');
  if (pauseBadge) {
    pauseBadge.textContent = `⏸ ${pauseSummary.label}`;
    pauseBadge.hidden = !pauseSummary.active;
  }
  if ($('#profileNameInput')) $('#profileNameInput').value = customer.name ?? '';
  if ($('#nameUrduInput')) $('#nameUrduInput').value = customer.nameUrdu ?? '';
  $('#mohallaInput').value = customer.mohalla ?? '';
  $('#zoneInput').value = customer.zone ?? '';
  $('#addressInput').value = customer.address ?? '';
  $('#customerNotesInput').value = customer.notes ?? '';
  $('#phoneInput').value = customer.phone ?? '';
  if ($('#cnicInput')) $('#cnicInput').value = customer.cnic ?? '';
  $('#ispProviderInput').value = customer.ispProvider ?? '';
  $('#packageSpeedInput').value = customer.packageSpeed ?? '';
  $('#monthlyPurchaseCostInput').value = customer.monthlyPurchaseCost ?? '';
  $('#monthlySellingAmountInput').value = customer.monthlySellingAmount ?? '';
  $('#connectionDateInput').value = customer.connectionDate ?? '';
  $('#connectionFeeInput').value = customer.connectionFee ?? '';
  $('#routerModelInput').value = customer.routerModel ?? '';
  $('#routerPriceInput').value = customer.routerPrice ?? '';
  $('#fiberMetersInput').value = customer.fiberMeters ?? '';
  // SISP-24: optical splitter assignment + last RX reading (optional).
  $('#splitterBoxIdInput').value = customer.splitterBoxId ?? '';
  $('#splitterPortInput').value = customer.splitterPort ?? '';
  $('#oltPonPortInput').value = customer.oltPonPort ?? '';
  $('#lastRxDbmInput').value = customer.lastRxDbm ?? '';
  // SISP-32: pole & landmark directory (optional).
  if ($('#poleNumberInput')) $('#poleNumberInput').value = customer.poleNumber ?? '';
  if ($('#boxLocationNoteInput')) $('#boxLocationNoteInput').value = customer.boxLocationNote ?? '';
  if ($('#dropWireCoreColorInput')) $('#dropWireCoreColorInput').value = customer.dropWireCoreColor ?? '';
  if ($('#mediaConverterCostInput')) $('#mediaConverterCostInput').value = customer.mediaConverterCost ?? '';
  if ($('#linemanInstallFeeInput')) $('#linemanInstallFeeInput').value = customer.linemanInstallFee ?? '';
  if ($('#fiberPerMeterRateInput')) $('#fiberPerMeterRateInput').value = customer.fiberPerMeterRate ?? '';  // SISP-7: feeder link fields — upstream select excludes this customer;
  // the saved upstream stays visible even if that house was archived.
  const feederSaved = normalizeFeederFields(customer);
  const upstreamSelect = $('#upstreamCustomerInput');
  if (upstreamSelect) {
    const candidates = state.customers.filter((c) => String(c.id) !== String(customer.id));
    const savedUpstream = feederSaved.upstreamCustomerId
      ? state.customers.find((c) => String(c.id) === String(feederSaved.upstreamCustomerId)) ?? null
      : null;
    const options = [...candidates];
    if (savedUpstream && !options.some((c) => String(c.id) === String(savedUpstream.id))) options.unshift(savedUpstream);
    upstreamSelect.innerHTML = `<option value="">${t('prof_feeder_direct')}</option>` + options.filter((c) => !c.archived || (savedUpstream && String(c.id) === String(savedUpstream.id))).map((c) => `<option value="${escapeHtml(String(c.id))}"${String(c.id) === String(feederSaved.upstreamCustomerId) ? ' selected' : ''}>${escapeHtml(c.name || 'Unknown')}${c.mohalla ? ` · ${escapeHtml(c.mohalla)}` : ''}${c.archived ? t('prof_upstream_archived_suffix') : ''}</option>`).join('');
    upstreamSelect.value = feederSaved.upstreamCustomerId ?? '';
  }
  const fiberZoneSelect = $('#fiberZoneInput');
  if (fiberZoneSelect) {
    fiberZoneSelect.innerHTML = `<option value="">${t('prof_not_set')}</option>` + FIBER_ZONES.map((z) => `<option value="${escapeHtml(z)}"${z === (feederSaved.fiberZone ?? '') ? ' selected' : ''}>${escapeHtml(z)}</option>`).join('');
    fiberZoneSelect.value = feederSaved.fiberZone ?? '';
  }
  if ($('#pppoeUsernameInput')) $('#pppoeUsernameInput').value = customer.pppoeUsername ?? '';
  if ($('#pppoePasswordInput')) $('#pppoePasswordInput').value = customer.pppoePassword ?? '';
  if ($('#staticIpInput')) $('#staticIpInput').value = customer.staticIp ?? '';
  if ($('#macAddressInput')) $('#macAddressInput').value = customer.macAddress ?? '';
  // SISP-94: router credential vault fields.
  if ($('#wifiSsidInput')) $('#wifiSsidInput').value = customer.wifiSsid ?? '';
  if ($('#wifiPasswordInput')) $('#wifiPasswordInput').value = customer.wifiPassword ?? '';
  if ($('#routerAdminPortInput')) $('#routerAdminPortInput').value = customer.routerAdminPort ?? '';
  if ($('#routerAdminPasswordInput')) $('#routerAdminPasswordInput').value = customer.routerAdminPassword ?? '';
  // SISP-19: custody fields (ownership selects + serial + deposit).
  // normalizeCustodyFields guards legacy/invalid ownership values.
  const custodyEditFields = normalizeCustodyFields(customer);
  if ($('#routerOwnershipInput')) $('#routerOwnershipInput').value = custodyEditFields.routerOwnership;
  if ($('#mediaConverterOwnershipInput')) $('#mediaConverterOwnershipInput').value = custodyEditFields.mediaConverterOwnership;
  if ($('#serialNumberInput')) $('#serialNumberInput').value = customer.serialNumber ?? '';
  if ($('#securityDepositInput')) $('#securityDepositInput').value = customer.securityDeposit ?? '';
  $('#expiryDateInput').value = customer.expiryDate ?? '';
  $('#cancellationDateInput').value = customer.cancellationDate ?? '';
  $('#packageChangeStaffNameInput').value = '';
  const packageHistory = [...(customer.packageHistory ?? [])].reverse();
  $('#packageHistoryList').innerHTML = packageHistory.map(change => {
    let proRataPart = '';
    if (change.proRatedBillAmount != null) {
      const sign = (change.proRataAdjustment || 0) > 0 ? '+' : '';
      proRataPart = ` · <strong style="color:var(--brand-teal, #0e5b4d);">${t('prof_pkghist_prorata', null, { amount: Number(change.proRatedBillAmount).toLocaleString() })}</strong> ${t('prof_pkghist_prorata_adj', null, { adj: `${sign}PKR ${Number(change.proRataAdjustment || 0).toLocaleString()}` })}`;
    }
    return `<li><strong>${escapeHtml(change.date || t('prof_pkghist_date_norec'))}</strong> ${escapeHtml(t('prof_pkghist_row', null, { old: change.oldPackage || t('prof_not_set'), new: change.newPackage || t('prof_not_set'), oldRate: formatAmount(change.oldMonthlyRate), newRate: formatAmount(change.newMonthlyRate), delta: change.monthlyRecurringPriceDelta === null ? t('prof_pkghist_not_calc') : formatAmount(change.monthlyRecurringPriceDelta) }))}${proRataPart}${change.staffName ? ` · ${escapeHtml(change.staffName)}` : ''}</li>`;
  }).join('');
  $('#packageHistoryEmpty').hidden = packageHistory.length > 0;
  renderProfileMarginPreview();
  renderProfileProrataPreview();
  renderUptimePanel(customer);
  renderIncidents(customer);
  renderHistory(customer);
}
function editCustomerProfile(id, { focus } = {}) {
  if (!state.customers.some(customer => customer.id === id)) return;
  selectCustomer(id);
  activateProfileTab('info');
  const editBtn = $('#editProfileButton');
  if (editBtn && !editBtn.hidden) editBtn.click();
  if (focus === 'phone') {
    const phone = $('#phoneInput');
    phone?.focus();
    phone?.scrollIntoView({ block: 'center' });
  }
}
function selectCustomer(id, { pushHistory = true } = {}) {
  if (!state.customers.some(customer => customer.id === id)) return;
  switchView('customers', { pushHistory: false });
  selectedCustomerId = id;
  const currentCust = state.customers.find(c => c.id === id);
  mobileBreadcrumbs?.pushCrumb({
    id: `customer-${id}`,
    label: currentCust ? currentCust.name : 'Customer Detail',
    data: { customerId: id }
  });
  mobileActionSheetController?.setContext({
    customerId: id,
    customerName: currentCust ? currentCust.name : 'Customer Detail',
    balance: currentCust ? currentCust.balance : 0,
    phone: currentCust ? currentCust.phone : ''
  });
  profileEditMode = false;
  activateProfileTab('billing');
  if (appShell.classList.contains('roster-table-expanded')) {
    appShell.classList.remove('roster-table-expanded');
    const expandBtn = $('#customerTableExpandBtn');
    if (expandBtn) {
      expandBtn.textContent = '⛶ Expand';
      expandBtn.setAttribute('aria-pressed', 'false');
    }
  }
  appShell.classList.add('show-detail');
  if (pushHistory && typeof window !== 'undefined' && window.location) {
    try {
      const cust = state.customers.find(c => c.id === id);
      const displayParam = cust?.customerNumber || id;
      history.pushState({ customerId: id }, '', `#/customers/${encodeURIComponent(displayParam)}`);
      // history.pushState({ customerId: id }, '', `#customer=${encodeURIComponent(id)}`);
    } catch {}
  }
  renderCustomers();
  renderDetail();
  $('#detailPane').scrollTop = 0;
  const shellTop = appShell.getBoundingClientRect().top + window.scrollY;
  const topbarHeight = $('.topbar').getBoundingClientRect().height;
  window.scrollTo({ top:Math.max(0, shellTop - topbarHeight - 8), behavior:'smooth' });
}
function downloadTxt(filename, text) {
  const blob = new Blob([text], { type:'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}
function downloadJson(filename, text) {
  const blob = new Blob([text], { type:'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}
// #359: digital payment settings live outside the ledger state — pass them to
// the backup engine explicitly so exports carry them and restores can adopt
// them under the safe-merge rules in previewJsonBackupMerge.
// SISP-46: every backup this copy produces carries the Multi-Branch
// Merge Guard stamp, and producing it advances the guard head — the
// stamp's parent is always the exact point this copy last exported or
// applied, which is what lets another copy recognise a true descendant.
function nextBranchGuardStamp() {
  const guard = ensureBranchGuard(localStorage);
  const stamp = createBranchGuardStamp(guard, state);
  if (stamp) saveBranchGuard(recordBranchGuardExport(guard, stamp), localStorage);
  return stamp;
}
function backupExtras() {
  return { digitalPaymentsSettings: getDigitalPaymentsSettings(), shopSettlements: loadShopSettlements(), complaints: loadComplaints(), homeBudget: loadHomeBudgetExpenses(), roznamchaDays: loadRoznamchaDays(), tickets: loadTickets(), inventory: loadInventory(), loans: loadLoans(), saadVisits: loadSaadVisits(), saadPayments: loadSaadPayments(), installRequests: loadInstallRequests(), pendingWorks: loadPendingWorks() , billingGroups: loadBillingGroups(), suspensePayments: loadSuspensePayments(), commissionRules: loadCommissionRules(), upsNodes: loadUpsNodes(), referralCredits: loadReferralCredits(), fieldTools: loadFieldTools(), badDebts: loadBadDebts(), spliceClosures: loadSpliceClosures(), monthlyClosingNotes: loadMonthlyClosingNotes(), splitterBoxGps: loadSplitterBoxPins(), partnerLedger: loadPartnerLedgerEntries(), partnerSettlements: loadPartnerSettlements(), partnerSettings: loadPartnerSettings(), overheads: loadOverheads(), voidPayments: loadVoidPayments(), waTemplates: getStoredWaTemplates(), branchGuard: nextBranchGuardStamp() };
}
function backupRestoreOptions() {
  let stored = false;
  let shopStored = false;
  let complaintsStored = false;
  let roznamchaStored = false;
  let ticketsStored = false;
  let inventoryStored = false;
  let saadVisitsStored = false;
  let saadPaymentsStored = false;
  let installRequestsStored = false;
  let pendingWorksStored = false;
  let billingGroupsStored = false;
  let suspensePaymentsStored = false;
  let commissionRulesStored = false;
  let upsNodesStored = false;
  let referralCreditsStored = false;
  let spliceClosuresStored = false;
  let badDebtsStored = false;
  let partnerLedgerStored = false;
  let partnerSettlementsStored = false;
  let partnerSettingsStored = false;
  let homeBudgetStored = false;
  let loansStored = false;
  let overheadsStored = false;
  try { stored = localStorage.getItem(DIGITAL_PAYMENTS_SETTINGS_KEY) !== null; } catch { stored = false; }  try { shopStored = localStorage.getItem(SHOP_SETTLEMENTS_KEY) !== null; } catch { shopStored = false; }  try { complaintsStored = localStorage.getItem(COMPLAINTS_KEY) !== null; } catch { complaintsStored = false; }
  try { roznamchaStored = localStorage.getItem(ROZNAMCHA_KEY) !== null; } catch { roznamchaStored = false; }
  try { ticketsStored = localStorage.getItem(TICKETS_KEY) !== null; } catch { ticketsStored = false; }
  try { inventoryStored = localStorage.getItem(INVENTORY_KEY) !== null; } catch { inventoryStored = false; }
  try { saadVisitsStored = localStorage.getItem(SAAD_VISITS_KEY) !== null; } catch { saadVisitsStored = false; }
  try { saadPaymentsStored = localStorage.getItem(SAAD_PAYMENTS_KEY) !== null; } catch { saadPaymentsStored = false; }
  try { installRequestsStored = localStorage.getItem(INSTALL_REQUESTS_KEY) !== null; } catch { installRequestsStored = false; }
  try { pendingWorksStored = localStorage.getItem(PENDING_WORKS_KEY) !== null; } catch { pendingWorksStored = false; }
  try { billingGroupsStored = localStorage.getItem(GROUP_BILLING_KEY) !== null; } catch { billingGroupsStored = false; }
  try { suspensePaymentsStored = localStorage.getItem(SUSPENSE_PAYMENTS_KEY) !== null; } catch { suspensePaymentsStored = false; }
  try { commissionRulesStored = localStorage.getItem(COMMISSION_RULES_KEY) !== null; } catch { commissionRulesStored = false; }
  try { upsNodesStored = localStorage.getItem(UPS_NODES_KEY) !== null; } catch { upsNodesStored = false; }
  try { referralCreditsStored = localStorage.getItem(REFERRAL_CREDITS_KEY) !== null; } catch { referralCreditsStored = false; }
  let fieldToolsStored = false;
  try { fieldToolsStored = localStorage.getItem(FIELD_TOOLS_KEY) !== null; } catch { fieldToolsStored = false; }
  try { spliceClosuresStored = localStorage.getItem(SPLICE_CLOSURES_KEY) !== null; } catch { spliceClosuresStored = false; }
  try { badDebtsStored = localStorage.getItem(BAD_DEBTS_KEY) !== null; } catch { badDebtsStored = false; }
  let notesStored = false;
  try { notesStored = localStorage.getItem(MONTHLY_CLOSING_NOTES_KEY) !== null; } catch { notesStored = false; }
  let splitterBoxGpsStored = false;
  try { splitterBoxGpsStored = localStorage.getItem(SPLITTER_BOX_GPS_STORAGE_KEY) !== null; } catch { splitterBoxGpsStored = false; }
  try { partnerLedgerStored = localStorage.getItem(PARTNER_LEDGER_KEY) !== null; } catch { partnerLedgerStored = false; }
  try { partnerSettlementsStored = localStorage.getItem(PARTNER_SETTLEMENTS_KEY) !== null; } catch { partnerSettlementsStored = false; }
  try { partnerSettingsStored = localStorage.getItem(PARTNER_SETTINGS_KEY) !== null; } catch { partnerSettingsStored = false; }
  try { homeBudgetStored = localStorage.getItem(HOME_BUDGET_KEY) !== null; } catch { homeBudgetStored = false; }
  try { loansStored = localStorage.getItem(LOAN_KEY) !== null; } catch { loansStored = false; }
  try { overheadsStored = localStorage.getItem(OVERHEAD_KEY) !== null; } catch { overheadsStored = false; }
  let waTemplatesStored = false;
  try { waTemplatesStored = localStorage.getItem(WA_TEMPLATES_STORAGE_KEY) !== null; } catch { waTemplatesStored = false; }
  let voidPaymentsStored = false;
  try { voidPaymentsStored = localStorage.getItem(VOIDED_PAYMENTS_KEY) !== null; } catch { voidPaymentsStored = false; }
  return { currentDigitalPaymentsSettings: getDigitalPaymentsSettings(), currentDigitalPaymentsStored: stored, currentShopSettlements: loadShopSettlements(), currentShopSettlementsStored: shopStored, currentComplaints: loadComplaints(), currentComplaintsStored: complaintsStored, currentHomeBudget: loadHomeBudgetExpenses(), currentHomeBudgetStored: homeBudgetStored, currentRoznamchaDays: loadRoznamchaDays(), currentRoznamchaDaysStored: roznamchaStored, currentTickets: loadTickets(), currentTicketsStored: ticketsStored, currentInventory: loadInventory(), currentInventoryStored: inventoryStored, currentSaadVisits: loadSaadVisits(), currentSaadVisitsStored: saadVisitsStored, currentSaadPayments: loadSaadPayments(), currentSaadPaymentsStored: saadPaymentsStored, currentInstallRequests: loadInstallRequests(), currentInstallRequestsStored: installRequestsStored, currentPendingWorks: loadPendingWorks(), currentPendingWorksStored: pendingWorksStored, currentBillingGroups: loadBillingGroups(), currentBillingGroupsStored: billingGroupsStored, currentSuspensePayments: loadSuspensePayments(), currentSuspensePaymentsStored: suspensePaymentsStored, currentCommissionRules: loadCommissionRules(), currentCommissionRulesStored: commissionRulesStored, currentUpsNodes: loadUpsNodes(), currentUpsNodesStored: upsNodesStored, currentReferralCredits: loadReferralCredits(), currentBadDebts: loadBadDebts(), currentBadDebtsStored: badDebtsStored, currentSpliceClosures: loadSpliceClosures(), currentSpliceClosuresStored: spliceClosuresStored, currentReferralCreditsStored: referralCreditsStored, currentFieldTools: loadFieldTools(), currentFieldToolsStored: fieldToolsStored, currentMonthlyClosingNotes: loadMonthlyClosingNotes(), currentMonthlyClosingNotesStored: notesStored, currentSplitterBoxGps: loadSplitterBoxPins(), currentSplitterBoxGpsStored: splitterBoxGpsStored, currentPartnerLedger: loadPartnerLedgerEntries(), currentPartnerLedgerStored: partnerLedgerStored, currentPartnerSettlements: loadPartnerSettlements(), currentPartnerSettlementsStored: partnerSettlementsStored, currentPartnerSettings: loadPartnerSettings(), currentPartnerSettingsStored: partnerSettingsStored, currentLoans: loadLoans(), currentLoansStored: loansStored, currentOverheads: loadOverheads(), currentOverheadsStored: overheadsStored, currentWaTemplates: getStoredWaTemplates(), currentWaTemplatesStored: waTemplatesStored, currentVoidPayments: loadVoidPayments(), currentVoidPaymentsStored: voidPaymentsStored, currentBranchGuard: ensureBranchGuard(localStorage) };
}
function renderStorageWarning() {
  const warning = $('#storageRecoveryWarning');
  warning.hidden = persistenceBlocked || storageAvailable;
  warning.textContent = persistenceBlocked ? `Saved billing data could not be read (${readFailureMessage || 'storage error'}). The app has not overwritten it. Use a valid JSON backup and review the merge before restoring.` : !storageAvailable ? 'Browser storage is unavailable; recent edits may not survive closing this page. Download a JSON backup after storage becomes available.' : '';
  $('#downloadJsonBackupButton').disabled = persistenceBlocked;
  $('#backupNowButton').disabled = persistenceBlocked || !storageAvailable || backupOperationBusy;
}
function formatBackupSize(bytes) {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) < 0) return 'Not available';
  const value = Number(bytes);
  if (value < 1024) return `${value} bytes`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}
function formatBackupDateTime(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle:'medium', timeStyle:'short', timeZone:PAKISTAN_TIME_ZONE }).format(date)
    : 'Never';
}
function renderBackupManager({ settings, status, backups }) {
  const frequency = settings?.frequency || DEFAULT_BACKUP_FREQUENCY;
  $('#backupFrequencySelect').value = frequency;
  $('#backupFrequencySelect').disabled = backupOperationBusy;
  $('#backupLastSuccess').textContent = formatBackupDateTime(status?.lastSuccessfulAt);
  $('#backupLastSize').textContent = formatBackupSize(status?.lastSizeBytes);
  const failedAfterSuccess = status?.failureAt && (!status.lastSuccessfulAt || Date.parse(status.failureAt) > Date.parse(status.lastSuccessfulAt));
  $('#backupStatus').textContent = persistenceBlocked
    ? 'Unavailable: saved billing data could not be read. No automatic snapshot was made.'
    : !storageAvailable
      ? 'Unavailable: browser ledger storage is not writable. No automatic snapshot was made.'
      : failedAfterSuccess
        ? `Latest attempt failed: ${status.failureMessage || 'local storage error'}. Previous backups were kept.`
        : !status?.lastSuccessfulAt || isAutomaticBackupDue(status.lastSuccessfulAt, frequency, new Date())
          ? 'Automatic backup due · a new copy is made when the app is open.'
          : `Up to date · automatic checks run ${frequency}.`;
  const select = $('#savedLocalBackupSelect');
  const selectedId = select.value;
  select.replaceChildren(new Option('Choose a saved backup', ''));
  for (const backup of backups ?? []) {
    const option = new Option(`${formatBackupDateTime(backup.createdAt)} · ${formatBackupSize(backup.sizeBytes)} · ${backup.kind === 'automatic' ? 'Automatic' : backup.kind === SAFETY_SNAPSHOT_KIND ? 'Safety' : 'Manual'}`, backup.id);
    select.add(option);
  }
  if ([...(backups ?? [])].some(backup => backup.id === selectedId)) select.value = selectedId;
  $('#restoreLocalBackupButton').disabled = !select.value;
  $('#backupNowButton').disabled = persistenceBlocked || !storageAvailable || backupOperationBusy;
  renderSafetySnapshotList(backups ?? []);
  const recoveryBtn = $('#showStorageRecoveryButton');
  if (recoveryBtn) recoveryBtn.hidden = !persistenceBlocked;
}
async function refreshBackupManager() {
  try {
    const [settings, status, backups] = await Promise.all([
      localBackupStore.getSettings(), localBackupStore.getStatus(), localBackupStore.listBackups()
    ]);
    renderBackupManager({ settings, status, backups });
    updateDataSafetyUi(status);
    void renderSaveFallbackNotice();
    return { settings, status, backups };
  } catch (error) {
    $('#backupStatus').textContent = `Unavailable: ${error.message || 'app-private backup storage could not be opened'}`;
    $('#backupNowButton').disabled = persistenceBlocked || !storageAvailable || backupOperationBusy;
    $('#restoreLocalBackupButton').disabled = true;
    const recoveryBtn = $('#showStorageRecoveryButton');
    if (recoveryBtn) recoveryBtn.hidden = !persistenceBlocked;
    updateDataSafetyUi(null);
    void renderSaveFallbackNotice();
    return null;
  }
}
async function recordBackupFailure(error) {
  const message = error?.message || 'Local backup could not be saved.';
  try { await localBackupStore.recordFailure(message); } catch { /* Preserve the prior snapshot if even the small status write cannot fit. */ }
  return message;
}
async function saveLocalSnapshot(kind) {
  if (persistenceBlocked || !storageAvailable) throw new Error('Saved ledger data is unavailable or not writable. No backup was created.');
  const createdAt = new Date();
  const backupText = createJsonBackup(state, createdAt, backupExtras());
  const record = await localBackupStore.saveBackup(backupText, { kind, createdAt });
  try { localStorage.setItem(LAST_BACKUP_TIME_KEY, createdAt.toISOString()); } catch { /* ignore */ }
  updateDataSafetyUi();
  return record;
}
// Layer A — Pre-destructive-action safety snapshot. Same backup document as
// the existing local backups (so the existing checksum-gated restore review
// can read it), but kind 'safety' and updateStatus:false: a safety net must
// never disturb the automatic-backup schedule, the "last successful backup"
// display, or the off-device health record. Returns the record, or null
// when no valid ledger can be snapshotted. Rotation keeps the newest 5.
async function createSafetySnapshot() {
  if (persistenceBlocked || !storageAvailable) return null;
  try {
    const createdAt = new Date();
    const backupText = createJsonBackup(state, createdAt, backupExtras());
    const counts = countLedgerRecords(state);
    const record = await localBackupStore.saveBackup(backupText, { kind: SAFETY_SNAPSHOT_KIND, createdAt, customerCount: counts.customerCount, paymentCount: counts.paymentCount, updateStatus: false });
    try {
      const backups = await localBackupStore.listBackups();
      const stale = selectSafetySnapshotsToRotate(backups, MAX_SAFETY_SNAPSHOTS);
      for (const id of stale) { try { await localBackupStore.deleteBackup(id); } catch { /* Rotation is best-effort; a stale snapshot never blocks the new one. */ } }
    } catch { /* Rotation failure never invalidates the snapshot just saved. */ }
    return record;
  } catch { return null; }
}
// Best-effort wrapper for the three destructive hooks. A failed snapshot
// warns but NEVER blocks the operator's explicit action — the action itself
// was confirmed, and the JSON backup remains the surest copy. When the
// ledger is unreadable (recovery flow) there is nothing valid to snapshot,
// so it skips silently.
async function snapshotBeforeDestructiveAction() {
  try {
    if (persistenceBlocked || !storageAvailable) return null;
    const record = await createSafetySnapshot();
    if (!record) toast('Safety snapshot could not be saved — download a JSON backup first if this action must be reversible.', { type: 'warning', title: 'Snapshot failed' });
    return record;
  } catch { return null; }
}
// Layer A — Safety snapshots list inside the existing backup controls.
// Renders into #safetySnapshotList (index.html backup-manager section);
// Restore routes through the existing checksum-gated restore review by
// selecting the snapshot in #savedLocalBackupSelect and clicking the
// existing Review & Restore button. Never a silent overwrite.
function renderSafetySnapshotList(backups) {
  const list = $('#safetySnapshotList');
  if (!list) return;
  const safety = (backups ?? []).filter(backup => backup.kind === SAFETY_SNAPSHOT_KIND);
  list.replaceChildren();
  if (!safety.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No safety snapshots yet — one is saved automatically before a customer delete, a payment void, or a backup restore.';
    list.append(empty);
    return;
  }
  for (const backup of safety) {
    const item = document.createElement('li');
    const counts = Number.isFinite(backup.customerCount) ? ` · ${backup.customerCount} customers · ${backup.paymentCount ?? 0} payments` : '';
    const label = document.createElement('span');
    label.textContent = `${formatBackupDateTime(backup.createdAt)} · ${formatBackupSize(backup.sizeBytes)}${counts}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-button';
    button.textContent = 'Restore';
    button.addEventListener('click', () => {
      const select = $('#savedLocalBackupSelect');
      if (select) select.value = backup.id;
      const restoreBtn = $('#restoreLocalBackupButton');
      if (restoreBtn) { restoreBtn.disabled = false; restoreBtn.click(); }
    });
    item.append(label, button);
    list.append(item);
  }
}
// Layer B — Emergency-copy notice. The fallback store is read ONLY here
// (backup manager refresh), never on normal load, so it can never become
// a second ledger. The operator downloads it as a file and the record is
// cleared, so the notice cannot linger after recovery.
async function renderSaveFallbackNotice() {
  const notice = $('#saveFallbackNotice');
  if (!notice) return;
  try { pendingFallbackRecord = await saveFallbackStore.getFallback(); }
  catch { pendingFallbackRecord = null; }
  notice.hidden = !pendingFallbackRecord;
  const text = $('#saveFallbackNoticeText');
  if (text && pendingFallbackRecord) {
    text.textContent = `Emergency copy kept from a failed save (${formatBackupDateTime(pendingFallbackRecord.savedAt)}). Download it now — it is the only copy of those changes.`;
  }
}
// Layer C — Recovery screen for an unreadable saved ledger. Offered only
// when the startup load already failed (persistenceBlocked): the app never
// overwrites the unreadable data on its own and never starts from a blank
// ledger silently. Candidates are the newest local backups, checksum-ranked
// (verified first, legacy unverified with a warning, mismatches and
// unparseable texts never offered); Restore routes through the existing
// checksum-gated preview. Start fresh needs an explicit confirmation and
// only then lets a later save write a new ledger over the unreadable one.
async function showStorageRecoveryDialog() {
  const dialog = $('#storageRecoveryDialog');
  if (!dialog) return;
  const reason = (() => {
    try {
      const verdict = verifyLiveLedger(localStorage.getItem(STORAGE_KEY));
      if (verdict.status === 'empty') return 'No saved ledger was found on this device.';
      if (verdict.reason === 'malformed') return 'The saved ledger text is malformed and could not be parsed.';
      if (verdict.reason === 'structure') return 'The saved ledger has an unsupported version or structure.';
      if (verdict.reason === 'customer') return 'The saved ledger contains an invalid customer record.';
      return readFailureMessage || 'Saved data could not be read.';
    } catch { return readFailureMessage || 'Saved data could not be read.'; }
  })();
  const reasonEl = $('#storageRecoveryReason');
  if (reasonEl) reasonEl.textContent = `${reason} Nothing was overwritten. Choose a snapshot below, review a JSON backup file, or start fresh.`;
  const list = $('#storageRecoverySnapshotList');
  if (list) {
    list.replaceChildren();
    const loading = document.createElement('li');
    loading.textContent = 'Checking saved snapshots…';
    list.append(loading);
  }
  if (dialog.showModal) dialog.showModal(); else dialog.hidden = false;
  let candidates = [];
  try {
    const backups = await localBackupStore.listBackups();
    const withText = [];
    for (const meta of backups.slice(0, 10)) {
      try { const full = await localBackupStore.getBackup(meta.id); withText.push({ ...meta, backupText: full.backupText }); }
      catch { /* A snapshot that cannot be read is simply not offered. */ }
    }
    candidates = rankRecoveryCandidates(withText);
  } catch { candidates = []; }
  if (!list) return;
  list.replaceChildren();
  if (!candidates.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No valid local snapshot was found. Use "Review a JSON backup file" if you have a copy from another device.';
    list.append(empty);
    return;
  }
  for (const candidate of candidates) {
    const item = document.createElement('li');
    const counts = Number.isFinite(candidate.customerCount) ? ` · ${candidate.customerCount} customers · ${candidate.paymentCount ?? 0} payments` : '';
    const label = document.createElement('span');
    label.textContent = `${formatBackupDateTime(candidate.createdAt)} · ${candidate.kind === SAFETY_SNAPSHOT_KIND ? 'Safety snapshot' : candidate.kind === 'automatic' ? 'Automatic' : 'Manual'}${counts} · ${candidate.checksumStatus === 'verified' ? '✓ Checksum verified' : '⚠️ No checksum — older backup, review carefully'}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-button';
    button.textContent = 'Restore';
    button.addEventListener('click', () => {
      if (dialog.close) dialog.close(); else dialog.hidden = true;
      const select = $('#savedLocalBackupSelect');
      if (select) select.value = candidate.id;
      const restoreBtn = $('#restoreLocalBackupButton');
      if (restoreBtn) { restoreBtn.disabled = false; restoreBtn.click(); }
    });
    item.append(label, button);
    list.append(item);
  }
}
async function startFreshAfterRecovery() {
  const choice = await appConfirm({ tone:'danger', title:'Start fresh?', subject:'Unreadable saved data will be abandoned', message:'The saved ledger on this device could not be read, so starting fresh keeps the empty ledger and the next save will overwrite it. If you have a JSON backup from another device, use "Review a JSON backup file" instead — that is the safe way back. Only start fresh when you are sure no usable backup exists.', confirmLabel:'Start fresh anyway', cancelLabel:'Go back' });
  if (choice !== 'confirm') return;
  const dialog = $('#storageRecoveryDialog');
  if (dialog?.close) dialog.close(); else if (dialog) dialog.hidden = true;
  persistenceBlocked = false; storageAvailable = true; readFailureMessage = '';
  save();
  toast('Started fresh. The unreadable saved data was abandoned; the next save writes a new ledger.', { type:'warning', title:'Fresh start' });
}
// Layer B — Emergency fallback after a quota save failure. Stores a proper
// backup document (restorable through the existing review flow), falling
// back to the raw ledger text only if the backup build itself throws.
// Never blocks collections or billing: it only runs after a save failed.
async function saveFallbackAndWarn(serialized) {
  let backupText = null;
  let format = 'backup';
  try { backupText = createJsonBackup(state, new Date(), backupExtras()); }
  catch { backupText = serialized; format = 'ledger'; }
  try {
    await saveFallbackStore.saveFallback(backupText, { format, savedAt: new Date() });
    pendingFallbackRecord = await saveFallbackStore.getFallback().catch(() => null);
    toast('Storage is full — the latest changes were NOT saved to the ledger. An emergency copy was kept; export a JSON backup immediately.', { type: 'error', title: 'Save failed — storage full', duration: 12000, actionLabel: 'Download JSON backup', onAction: () => { $('#downloadJsonBackupButton')?.click(); } });
  } catch {
    toast('Storage is full — the latest changes were NOT saved, and the emergency copy also failed. Export a JSON backup immediately.', { type: 'error', title: 'Save failed — storage full', duration: 12000, actionLabel: 'Download JSON backup', onAction: () => { $('#downloadJsonBackupButton')?.click(); } });
  }
  void refreshBackupManager();
}
async function checkAutomaticBackup() {
  if (persistenceBlocked || !storageAvailable) return;
  const currentTime = Date.now();
  if (automaticBackupInFlight) return automaticBackupInFlight;
  if (currentTime - lastAutomaticBackupCheckAt < 60_000) return;
  lastAutomaticBackupCheckAt = currentTime;
  automaticBackupInFlight = (async () => {
    backupOperationBusy = true;
    try {
      const info = await refreshBackupManager();
      if (!info || !isAutomaticBackupDue(info.status.lastSuccessfulAt, info.settings.frequency, new Date())) return;
      $('#backupStatus').textContent = 'Automatic backup due · saving a new local copy…';
      try {
        await saveLocalSnapshot('automatic');
        await refreshBackupManager();
      } catch (error) {
        const message = await recordBackupFailure(error);
        await refreshBackupManager();
        $('#backupStatus').textContent = `Automatic backup failed: ${message}. Previous backups and ledger data were kept.`;
      }
    } catch (error) {
      $('#backupStatus').textContent = `Automatic backup check failed: ${error.message || 'local backup storage is unavailable'}`;
    } finally {
      backupOperationBusy = false;
      await refreshBackupManager();
    }
  })().finally(() => { automaticBackupInFlight = null; });
  return automaticBackupInFlight;
}
function renderBackupPreview(preview, sourceText = '') {
  pendingBackupPreview = preview;
  pendingBackupSourceText = sourceText;
  const encSection = $('#encryptedRestoreSection');
  if (encSection) encSection.hidden = true;
  const plainSection = $('#plainBackupRestoreSection');
  if (plainSection) plainSection.hidden = false;
  const { counts, conflicts } = preview;
  const summary = [`Backup created: ${preview.exportedAt || 'date not recorded'}.`, `${counts.addedCustomers} new profiles`, `${counts.mergedCustomers} matching profiles checked`, `${counts.addedBills} new bills`, `${counts.addedPayments} new actual receipts`, `${counts.addedIncidents} new complaints/outages`, `${counts.filledProfileFields} blank profile fields filled`, `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} preserved.`].join(' ');
  $('#jsonBackupPreviewSummary').textContent = `${summary} Phase 3 records: ${counts.addedInventoryItems ?? 0} inventory items, ${counts.addedInventoryMovements ?? 0} movements, ${counts.addedExpenses ?? 0} expenses, ${counts.addedSaadAttendanceDays ?? 0} Saad attendance dates, ${counts.addedUmairWorkdays ?? 0} Umair work dates.${counts.digitalPaymentsSettingsRestored ? ' Digital payment settings (Raast/Till/bank/QR) will also be restored.' : ''}${counts.shopSettlementsRestored ? ' Shop settlement records will also be restored.' : ''}${counts.voidPaymentsRestored ? ' Voided payment records will also be restored.' : ''}${counts.homeBudgetRestored ? ' Home budget records will also be restored.' : ''}${counts.waTemplatesRestored ? ' WhatsApp templates will also be restored.' : ''}`;
  // SISP-10: surface checksum verification in the preview. 'mismatch' can
  // never be applied (preview.canApply is false); 'unverified' means a
  // legacy backup without a checksum field.
  const checksumNote = $('#jsonBackupChecksumNote');
  if (checksumNote) {
    checksumNote.textContent = preview.checksumStatus === 'verified'
      ? '✓ Checksum verified — this backup arrived intact.'
      : preview.checksumStatus === 'mismatch'
        ? '⛔ Checksum mismatch — this backup was corrupted or edited in transit. It cannot be applied; export a fresh copy from the original device.'
        : '⚠️ No checksum found — this is an older backup, so integrity could not be verified. Review the preview carefully before applying.';
    checksumNote.className = `backup-checksum-note checksum-${preview.checksumStatus ?? 'unverified'}`;
  }
  const list = $('#jsonBackupConflictList');
  list.replaceChildren();
  for (const conflict of conflicts.slice(0, 25)) {
    const item = document.createElement('li');
    item.textContent = conflict.customerNumber ? `Customer #${conflict.customerNumber} ${conflict.name}: ${conflict.field}. Existing value kept.` : `${conflict.field}: existing value kept.`;
    list.append(item);
  }
  if (conflicts.length > 25) {
    const more = document.createElement('li'); more.textContent = `${conflicts.length - 25} additional conflicts are preserved in the local preview.`; list.append(more);
  }
  // SISP-46: surface the Multi-Branch Merge Guard verdict. Silent
  // verdicts (descendant / own / adopt) leave no trace; legacy and
  // unguarded backups warn; foreign and diverged lineages explain the
  // block and reveal the operator's explicit override — ticking it
  // re-computes this preview with the override armed (core.js stays
  // the only authority on canApply).
  const guardNote = $('#jsonBackupBranchGuardNote');
  const guardVerdict = preview.branchGuard;
  if (guardNote) {
    const warnKey = guardVerdict?.status === 'foreign' ? 'bkgrd_foreign_note'
      : guardVerdict?.status === 'diverged' ? 'bkgrd_diverged_note'
      : guardVerdict?.status === 'legacy' ? 'bkgrd_legacy_note'
      : guardVerdict?.status === 'unguarded' ? 'bkgrd_unguarded_note'
      : null;
    if (preview.branchGuardOverrideApplied) {
      guardNote.textContent = t('bkgrd_override_active');
      guardNote.className = 'backup-checksum-note checksum-unverified';
      guardNote.hidden = false;
    } else if (warnKey) {
      guardNote.textContent = t(warnKey);
      guardNote.className = `backup-checksum-note ${guardVerdict.blocked ? 'checksum-mismatch' : 'checksum-unverified'}`;
      guardNote.hidden = false;
    } else {
      guardNote.textContent = '';
      guardNote.hidden = true;
    }
  }
  const guardWrap = $('#branchGuardOverrideWrap');
  if (guardWrap) guardWrap.hidden = !guardVerdict?.blocked;
  const guardLabel = $('#branchGuardOverrideLabel');
  if (guardLabel) guardLabel.textContent = t('bkgrd_override_label');
  const guardCheckbox = $('#branchGuardOverrideCheckbox');
  if (guardCheckbox) guardCheckbox.checked = preview.branchGuardOverrideApplied === true;
  $('#applyJsonBackupButton').disabled = !preview.canApply;
  $('#jsonBackupDialog').showModal();
}

$('#branchGuardOverrideCheckbox')?.addEventListener('change', event => {
  if (!pendingBackupSourceText) return;
  const options = backupRestoreOptions();
  if (event.currentTarget.checked) options.branchGuardOverride = true;
  renderBackupPreview(previewJsonBackupMerge(state, pendingBackupSourceText, options), pendingBackupSourceText);
});
$('#downloadJsonBackupButton').addEventListener('click', () => {
  if (persistenceBlocked) { toast('Saved data could not be read; a backup of the blank recovery screen would be unsafe.'); return; }
  const fileStamp = localDateTime().replace(/[^0-9T]/g, '-');
  downloadJson(`shahdara-isp-billing-backup-${fileStamp}.json`, createJsonBackup(state, new Date(), backupExtras()));
  recordOffDeviceBackupExport();
  updateDataSafetyUi();
  toast('JSON backup downloaded to this device. Store it somewhere safe.');
});

async function handleShareBackupAction() {
  if (persistenceBlocked) {
    toast('Saved data could not be read; a backup of the blank recovery screen would be unsafe.');
    return;
  }
  const fileStamp = localDateTime().replace(/[^0-9T]/g, '-');
  const filename = `shahdara-isp-billing-backup-${fileStamp}.json`;
  const backupText = createJsonBackup(state, new Date(), backupExtras());

  try {
    // SISP-52: 1-tap share orchestration lives in backup-health.js — the
    // file handed to the share handler is the same checksum-stamped,
    // branch-guard-stamped export the download button produces; a completed
    // share (or the download fallback) writes the health record so the
    // Backup Health badge resets to Safe. A cancelled share records
    // nothing, and the legacy timestamp follows the health record's own.
    const result = await shareBackupOffDevice({
      backupText,
      filename,
      state,
      storage: localStorage,
      shareFile: shareJsonBackupFile,
      onExported: record => {
        try { localStorage.setItem(LAST_BACKUP_TIME_KEY, record.lastExportAt); } catch { /* ignore */ }
      }
    });
    if (result.method === 'share') {
      updateDataSafetyUi();
      toast('Backup shared successfully! Keep it safe.');
    } else if (result.method === 'download') {
      downloadJson(result.filename, result.backupText);
      updateDataSafetyUi();
      toast('JSON backup downloaded (file share fallback). Store it somewhere safe.');
    } else if (result.method === 'cancelled') {
      toast('Share cancelled.');
    }
  } catch (error) {
    toast(`Backup share failed: ${error.message}`);
  }
}

async function handleProtectStorageAction() {
  try {
    const res = await requestStoragePersistence();
    storagePersistenceInfo = res;
    updateDataSafetyUi();
    if (res.persisted) {
      toast('Storage protected! Browser will not evict your billing ledger.');
    } else if (!res.supported) {
      toast('Storage persistence API is not supported in this browser.');
    } else {
      toast('Browser kept storage as best-effort (persistence request declined).');
    }
  } catch (error) {
    toast(`Storage protection request failed: ${error.message}`);
  }
}

$('#shareJsonBackupButton')?.addEventListener('click', handleShareBackupAction);
$('#dataSafetyShareBackupBtn')?.addEventListener('click', handleShareBackupAction);
// SISP-52: the 1-tap share button inside the Backup Health panel itself.
$('#shareBackupHealthButton')?.addEventListener('click', handleShareBackupAction);
$('#requestStoragePersistenceBtn')?.addEventListener('click', handleProtectStorageAction);
$('#dataSafetyProtectStorageBtn')?.addEventListener('click', handleProtectStorageAction);

$('#restoreJsonBackupButton').addEventListener('click', () => { $('#jsonBackupFileInput').value=''; $('#jsonBackupFileInput').click(); });

// SISP-10: 1-click clipboard sync code — copy the checksum-stamped backup
// text to move the ledger to another device (desktop ↔ phone) in seconds,
// and paste a received code back in. Copying counts as an off-device export.
$('#copySyncCodeButton')?.addEventListener('click', async () => {
  if (persistenceBlocked) { toast('Saved data could not be read; a sync code of the blank recovery screen would be unsafe.'); return; }
  const backupText = createJsonBackup(state, new Date(), backupExtras());
  try {
    await navigator.clipboard.writeText(backupText);
    recordOffDeviceBackupExport();
    updateDataSafetyUi();
    toast('Sync code copied — paste it on the other device to restore.');
  } catch {
    // Clipboard API unavailable (non-secure context / denied permission):
    // fall back to a file download so the transfer still works.
    const fileStamp = localDateTime().replace(/[^0-9T]/g, '-');
    downloadJson(`shahdara-isp-billing-backup-${fileStamp}.json`, backupText);
    recordOffDeviceBackupExport();
    updateDataSafetyUi();
    toast('Clipboard unavailable — sync code downloaded as a file instead.');
  }
});

$('#importSyncCodeButton')?.addEventListener('click', () => {
  const input = $('#pasteSyncCodeText');
  const text = input?.value?.trim();
  if (!text) { toast('Paste a sync code first.'); return; }
  if (text.length > 25 * 1024 * 1024) { toast('Sync code is too large. No local data was changed.'); return; }
  try {
    const inspection = inspectBackupFileHeader(text);
    if (!inspection.valid) { toast(`${inspection.error} No local data was changed.`); return; }
    if (inspection.encrypted) { promptEncryptedRestore(text, inspection); return; }
    renderBackupPreview(previewJsonBackupMerge(state, text, backupRestoreOptions()), text);
  } catch (error) { toast(`${error.message} No local data was changed.`); }
});
$('#backupFrequencySelect').addEventListener('change', async event => {
  const frequency = event.currentTarget.value;
  try {
    await localBackupStore.setFrequency(frequency);
    await refreshBackupManager();
    toast(`Automatic backups set to ${frequency}.`);
    void checkAutomaticBackup();
  } catch (error) {
    toast(`Backup schedule was not saved: ${error.message}`);
    await refreshBackupManager();
  }
});
$('#backupNowButton').addEventListener('click', async () => {
  if (backupOperationBusy) return;
  backupOperationBusy = true;
  renderStorageWarning();
  $('#backupStatus').textContent = 'Saving a new local backup…';
  try {
    const backup = await saveLocalSnapshot('manual');
    toast(`Backup saved on this device (${formatBackupSize(backup.sizeBytes)}).`);
  } catch (error) {
    const message = await recordBackupFailure(error);
    toast(`Backup failed: ${message}`);
  } finally {
    backupOperationBusy = false;
    await refreshBackupManager();
    renderStorageWarning();
  }
});
$('#savedLocalBackupSelect').addEventListener('change', event => {
  $('#restoreLocalBackupButton').disabled = !event.currentTarget.value;
});
$('#restoreLocalBackupButton').addEventListener('click', async () => {
  const id = $('#savedLocalBackupSelect').value;
  if (!id) { toast('Choose a saved backup first.'); return; }
  try {
    const backup = await localBackupStore.getBackup(id);
    renderBackupPreview(previewJsonBackupMerge(state, backup.backupText, backupRestoreOptions()), backup.backupText);
  } catch (error) { toast(`${error.message} No local data was changed.`); }
});
// SISP-36: Khata Doctor card in the backup controls. Run is read-only;
// Auto-Repair goes through the Layer A safety snapshot first and aborts
// when no snapshot could be saved.
setupKhataDoctorCard({
  getState: () => state,
  getSettlements: () => loadShopSettlements(),
  getVoidPayments: () => loadVoidPayments(),
  getCache: () => loadKhataDoctorCache(),
  onSaveCache: (cache) => { saveKhataDoctorCache(cache); },
  onBeforeRepair: async () => {
    const record = await createSafetySnapshot();
    if (record) await refreshBackupManager();
    return record;
  },
  onRepairState: (newState) => {
    state = newState;
    save();
    renderDashboard();
  },
  onToast: (msg, opts) => toast(msg, opts)
});
// Storage safety (Layers A/B/C): recovery dialog controls, the backup
// manager's "Recovery options" button, and the emergency-copy download.
$('#showStorageRecoveryButton')?.addEventListener('click', () => { void showStorageRecoveryDialog(); });
$('#storageRecoveryCloseBtn')?.addEventListener('click', () => {
  const dialog = $('#storageRecoveryDialog');
  if (dialog?.close) dialog.close(); else if (dialog) dialog.hidden = true;
});
$('#storageRecoveryCloseBtn2')?.addEventListener('click', () => {
  const dialog = $('#storageRecoveryDialog');
  if (dialog?.close) dialog.close(); else if (dialog) dialog.hidden = true;
});
$('#storageRecoveryJsonBtn')?.addEventListener('click', () => { $('#jsonBackupFileInput')?.click(); });
$('#storageRecoveryFreshBtn')?.addEventListener('click', () => { void startFreshAfterRecovery(); });
$('#saveFallbackDownloadBtn')?.addEventListener('click', async () => {
  const record = pendingFallbackRecord ?? await saveFallbackStore.getFallback().catch(() => null);
  if (!record) { toast('No emergency copy is available.'); return; }
  const stamp = localDateTime().replace(/[^0-9T]/g, '-');
  const name = record.format === 'ledger' ? `shahdara-isp-billing-emergency-ledger-${stamp}.json` : `shahdara-isp-billing-emergency-backup-${stamp}.json`;
  downloadJson(name, record.backupText);
  try { await saveFallbackStore.clearFallback(); } catch { /* Keep the record if clearing fails; the notice stays until it clears. */ }
  pendingFallbackRecord = null;
  void renderSaveFallbackNotice();
  toast(record.format === 'ledger'
    ? 'Emergency ledger copy downloaded — it is raw ledger text, not a backup file. Keep it safe and ask for help restoring it.'
    : 'Emergency backup downloaded — review it in the backup controls before applying.');
});
$('#backupControlsToggle').addEventListener('click', event => {
  const button = event.currentTarget;
  const controls = $('#backupControls');
  const opening = controls.hidden;
  controls.hidden = !opening;
  button.setAttribute('aria-expanded', String(opening));
  const label = opening ? 'Hide backup and restore controls' : 'Show backup and restore controls';
  button.setAttribute('aria-label', label);
  button.title = label;
});
let pendingEncryptedBackupText = null;

function promptEncryptedRestore(text, inspection) {
  pendingEncryptedBackupText = text;
  pendingBackupPreview = null;
  const dialog = $('#jsonBackupDialog');
  $('#encryptedRestoreSection').hidden = false;
  $('#plainBackupRestoreSection').hidden = true;
  $('#applyJsonBackupButton').disabled = true;

  const hintBlock = $('#encryptedRestoreHintBlock');
  const hintText = $('#encryptedRestoreHintText');
  if (inspection.hint) {
    hintText.textContent = inspection.hint;
    hintBlock.hidden = false;
  } else {
    hintBlock.hidden = true;
    hintText.textContent = '';
  }

  const errEl = $('#encryptedRestoreError');
  errEl.hidden = true;
  errEl.textContent = '';

  const input = $('#encryptedRestorePassphrase');
  input.value = '';
  dialog.showModal();
  setTimeout(() => input.focus(), 50);
}

$('#unlockEncryptedRestoreBtn')?.addEventListener('click', async () => {
  const input = $('#encryptedRestorePassphrase');
  const pass = input.value;
  const errEl = $('#encryptedRestoreError');
  if (!pass) {
    errEl.textContent = 'Please enter the backup passphrase.';
    errEl.hidden = false;
    input.focus();
    return;
  }
  errEl.hidden = true;
  try {
    const decryptedText = await decryptBackupJson(pendingEncryptedBackupText, pass);
    $('#encryptedRestoreSection').hidden = true;
    $('#plainBackupRestoreSection').hidden = false;
    renderBackupPreview(previewJsonBackupMerge(state, decryptedText, backupRestoreOptions()), decryptedText);
    toast('🔐 Backup decrypted successfully! Review the safe merge preview.');
  } catch (err) {
    errEl.textContent = err.message || 'Decryption failed: incorrect passphrase.';
    errEl.hidden = false;
    input.focus();
    toast('Decryption failed: incorrect passphrase.');
  }
});

$('#jsonBackupFileInput').addEventListener('change', async event => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  if (file.size > 25 * 1024 * 1024) { toast('Backup must be smaller than 25 MB. No local data was changed.'); return; }
  try {
    const text = await file.text();
    const inspection = inspectBackupFileHeader(text);
    if (!inspection.valid) {
      toast(`${inspection.error} No local data was changed.`);
      return;
    }
    if (inspection.encrypted) {
      promptEncryptedRestore(text, inspection);
      return;
    }
    renderBackupPreview(previewJsonBackupMerge(state, text, backupRestoreOptions()), text);
  }
  catch (error) { toast(`${error.message} No local data was changed.`); }
  finally {
    event.currentTarget.value = '';
  }
});

function closeBackupDialog() {
  pendingBackupPreview = null;
  pendingEncryptedBackupText = null;
  const encSection = $('#encryptedRestoreSection');
  if (encSection) encSection.hidden = true;
  const plainSection = $('#plainBackupRestoreSection');
  if (plainSection) plainSection.hidden = false;
  $('#jsonBackupDialog').close();
}
document.querySelectorAll('[data-close-backup-dialog]').forEach(button => button.addEventListener('click', closeBackupDialog));
$('#cancelJsonBackupButton').addEventListener('click', closeBackupDialog);
$('#jsonBackupDialog')?.addEventListener('click', (e) => {
  if (e.target === $('#jsonBackupDialog')) closeBackupDialog();
});
$('#jsonBackupDialog')?.addEventListener('cancel', () => {
  pendingBackupPreview = null;
  pendingEncryptedBackupText = null;
});

// Encrypted Backup Export dialog wiring
function openEncryptedBackupDialog() {
  if (persistenceBlocked) {
    toast('Saved data could not be read; a backup of the blank recovery screen would be unsafe.');
    return;
  }
  const dialog = $('#encryptedBackupDialog');
  $('#encryptedBackupPassphrase').value = '';
  $('#encryptedBackupPassphraseConfirm').value = '';
  $('#encryptedBackupHint').value = '';
  const err = $('#encryptedBackupError');
  err.hidden = true;
  err.textContent = '';
  dialog.showModal();
  setTimeout(() => $('#encryptedBackupPassphrase').focus(), 50);
}

function closeEncryptedBackupDialog() {
  $('#encryptedBackupDialog').close();
}

$('#openExportEncryptedBackupBtn')?.addEventListener('click', openEncryptedBackupDialog);
document.querySelectorAll('[data-close-encrypted-backup-dialog]').forEach(btn => {
  btn.addEventListener('click', closeEncryptedBackupDialog);
});
$('#encryptedBackupDialog')?.addEventListener('click', (e) => {
  if (e.target === $('#encryptedBackupDialog')) closeEncryptedBackupDialog();
});

async function getValidatedEncryptedBackupPayload() {
  const pass = $('#encryptedBackupPassphrase').value;
  const confirm = $('#encryptedBackupPassphraseConfirm').value;
  const hint = $('#encryptedBackupHint').value;
  const err = $('#encryptedBackupError');
  if (!pass || pass.length < 6) {
    err.textContent = 'Passphrase must be at least 6 characters long.';
    err.hidden = false;
    $('#encryptedBackupPassphrase').focus();
    toast('Passphrase must be at least 6 characters long.');
    return null;
  }
  if (pass !== confirm) {
    err.textContent = 'Passphrases do not match. Please re-enter.';
    err.hidden = false;
    $('#encryptedBackupPassphraseConfirm').focus();
    toast('Passphrases do not match. Please re-enter.');
    return null;
  }
  err.hidden = true;
  const rawBackup = createJsonBackup(state, new Date(), backupExtras());
  const encrypted = await encryptBackupJson(rawBackup, pass, { hint });
  return encrypted;
}

$('#downloadEncryptedBackupBtn')?.addEventListener('click', async () => {
  try {
    const encrypted = await getValidatedEncryptedBackupPayload();
    if (!encrypted) return;
    const fileStamp = localDateTime().replace(/[^0-9T]/g, '-');
    const filename = `shahdara-isp-billing-encrypted-backup-${fileStamp}.json`;
    downloadJson(filename, encrypted);
    recordOffDeviceBackupExport();
    updateDataSafetyUi();
    closeEncryptedBackupDialog();
    toast('🔐 Encrypted backup downloaded! Store it safely and remember your passphrase.');
  } catch (error) {
    const err = $('#encryptedBackupError');
    err.textContent = `Encryption failed: ${error.message}`;
    err.hidden = false;
  }
});

$('#shareEncryptedBackupBtn')?.addEventListener('click', async () => {
  try {
    const encrypted = await getValidatedEncryptedBackupPayload();
    if (!encrypted) return;
    const fileStamp = localDateTime().replace(/[^0-9T]/g, '-');
    const filename = `shahdara-isp-billing-encrypted-backup-${fileStamp}.json`;
    const result = await shareJsonBackupFile({ backupText: encrypted, filename });
    if (result.method === 'share') {
      recordOffDeviceBackupExport();
      updateDataSafetyUi();
      closeEncryptedBackupDialog();
      toast('🔐 Encrypted backup shared! Select Google Drive or WhatsApp to save.');
    } else if (result.method === 'download') {
      downloadJson(result.filename, result.backupText);
      recordOffDeviceBackupExport();
      updateDataSafetyUi();
      closeEncryptedBackupDialog();
      toast('🔐 Web Share unavailable; encrypted backup downloaded instead.');
    } else if (result.method === 'cancelled') {
      toast('Share cancelled.');
    }
  } catch (error) {
    const err = $('#encryptedBackupError');
    err.textContent = `Share failed: ${error.message}`;
    err.hidden = false;
  }
});

$('#toggleExportPassphraseBtn')?.addEventListener('click', () => {
  const input = $('#encryptedBackupPassphrase');
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  $('#encryptedBackupPassphraseConfirm').type = isPass ? 'text' : 'password';
  $('#toggleExportPassphraseBtn').textContent = isPass ? '🙈' : '👁️';
});

$('#toggleRestorePassphraseBtn')?.addEventListener('click', () => {
  const input = $('#encryptedRestorePassphrase');
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  $('#toggleRestorePassphraseBtn').textContent = isPass ? '🙈' : '👁️';
});
$('#applyJsonBackupButton').addEventListener('click', async () => {
  if (!pendingBackupPreview?.canApply) return;
  await snapshotBeforeDestructiveAction();
  try {
    const restored = generateMonthlyBillsThroughCurrentMonth(pendingBackupPreview.state, new Date());
    persistState(restored, localStorage);
    state = restored; storageAvailable = true; persistenceBlocked = false; readFailureMessage = '';
    if (pendingBackupPreview.digitalPaymentsSettings) {
      saveDigitalPaymentsSettings(pendingBackupPreview.digitalPaymentsSettings);
      const ownerPhone = pendingBackupPreview.digitalPaymentsSettings.ownerPhone;
      if (ownerPhone) { try { localStorage.setItem('shahdara_owner_whatsapp_phone', ownerPhone); } catch { /* ignore */ } }
    }
    if (pendingBackupPreview.shopSettlements) {
      saveShopSettlements(pendingBackupPreview.shopSettlements);
      // SISP-68: mirror any restored partner-kept handovers into the
      // partner ledger as linked drawings, exactly once.
      recordShopPickupDrawingSync();
    }
    if (pendingBackupPreview.complaints) {
      saveComplaints(pendingBackupPreview.complaints);
    }
    if (pendingBackupPreview.homeBudget) {
      saveHomeBudgetExpenses(pendingBackupPreview.homeBudget);
    }
    if (pendingBackupPreview.waTemplates) {
      saveWaTemplates(localStorage, pendingBackupPreview.waTemplates);
    }
    if (pendingBackupPreview.roznamchaDays) {
      saveRoznamchaDays(pendingBackupPreview.roznamchaDays);
      // SISP-45: mirror the restored day ledger into Expenses as well.
      recordRoznamchaExpenseSync();
    }
    if (pendingBackupPreview.tickets) {
      saveTickets(pendingBackupPreview.tickets);
    }
    if (pendingBackupPreview.inventory) {
      saveInventory(pendingBackupPreview.inventory);
    }
    if (pendingBackupPreview.loans) {
      saveLoans(pendingBackupPreview.loans);
    }
    if (pendingBackupPreview.saadVisits) {
      saveSaadVisits(pendingBackupPreview.saadVisits);
    }
    if (pendingBackupPreview.saadPayments) {
      saveSaadPayments(pendingBackupPreview.saadPayments);
      // SISP-56: mirror the restored payouts into Expenses + Roznamcha.
      recordSaadPaymentSync();
    }
    if (pendingBackupPreview.installRequests) {
      saveInstallRequests(pendingBackupPreview.installRequests);
    }
    if (pendingBackupPreview.pendingWorks) {
      savePendingWorks(pendingBackupPreview.pendingWorks);
    }
    if (pendingBackupPreview.billingGroups) {
      saveBillingGroups(pendingBackupPreview.billingGroups);
    }
    if (pendingBackupPreview.suspensePayments) {
      saveSuspensePayments(pendingBackupPreview.suspensePayments);
    }
    if (pendingBackupPreview.commissionRules) {
      saveCommissionRules(pendingBackupPreview.commissionRules);
    }
    if (pendingBackupPreview.upsNodes) {
      saveUpsNodes(pendingBackupPreview.upsNodes);
    }
    if (pendingBackupPreview.referralCredits) {
      saveReferralCredits(pendingBackupPreview.referralCredits);
    }
    if (pendingBackupPreview.fieldTools) {
      saveFieldTools(pendingBackupPreview.fieldTools);
    }
    if (pendingBackupPreview.spliceClosures) {
      saveSpliceClosures(pendingBackupPreview.spliceClosures);
    }
    if (pendingBackupPreview.badDebts) {
      saveBadDebts(pendingBackupPreview.badDebts);
    }
    if (pendingBackupPreview.monthlyClosingNotes) {
      saveMonthlyClosingNotes(pendingBackupPreview.monthlyClosingNotes);    }
    if (pendingBackupPreview.splitterBoxGps) {
      saveSplitterBoxPins(pendingBackupPreview.splitterBoxGps);
    }
    if (pendingBackupPreview.partnerLedger) {
      savePartnerLedgerEntries(pendingBackupPreview.partnerLedger);
      // SISP-68: converge the restored ledger against the shop
      // settlements on this device (adds missing pickup drawings,
      // drops ones whose settlement is gone).
      recordShopPickupDrawingSync();
    }
    if (pendingBackupPreview.partnerSettlements) {
      savePartnerSettlements(pendingBackupPreview.partnerSettlements);
    }
    if (pendingBackupPreview.partnerSettings) {
      savePartnerSettings(pendingBackupPreview.partnerSettings);
    }
    if (pendingBackupPreview.overheads) {
      saveOverheads(pendingBackupPreview.overheads);
    }
    if (pendingBackupPreview.voidPayments) {
      saveVoidPayments(pendingBackupPreview.voidPayments);
    }
    // SISP-46: fold the applied restore into the branch guard record so
    // this copy's lineage head advances (an override-applied diverged
    // backup heals the chain) and the apply is remembered in the event
    // log. Read fresh: the pre-apply safety snapshot may itself have
    // advanced the guard via the normal export path.
    if (pendingBackupPreview.branchGuard) {
      const guardNow = ensureBranchGuard(localStorage);
      saveBranchGuard(recordBranchGuardApply(guardNow, pendingBackupPreview.branchGuard.stamp, {
        status: pendingBackupPreview.branchGuard.status,
        override: pendingBackupPreview.branchGuardOverrideApplied === true,
        resultingState: state
      }), localStorage);
    }
    closeBackupDialog(); renderStorageWarning(); renderDashboard(); renderGlobalSearch(); renderCustomers(); renderTransactions(); renderMonthlyReport(); renderDetail();
    toast('The reviewed safe merge was saved on this device. No existing conflicting values were overwritten.');
  } catch (error) { toast(`Restore could not be saved: ${error.message}`); }
});

let pendingCsvImportPreview = null;

function renderCsvImportPreview(preview) {
  pendingCsvImportPreview = preview;
  const { summary, rows } = preview;
  $('#csvImportPreviewSummary').textContent = `Spreadsheet preview: ${summary.totalRows} rows found · ${summary.addCount} new customers · ${summary.enrichCount} matching/enrichable · ${summary.conflictCount} conflicts · ${summary.errorCount} errors.`;

  const tbody = $('#csvImportPreviewRows');
  tbody.replaceChildren();

  for (const row of rows.slice(0, 100)) {
    const tr = document.createElement('tr');
    const badgeClass = `csv-badge csv-badge-${row.action}`;
    const badgeText = row.action === 'add' ? 'New' : row.action === 'enrich' ? 'Enrich' : row.action === 'conflict' ? 'Conflict' : 'Error';

    const detailText = row.errors.length > 0
      ? row.errors.join('; ')
      : (row.action === 'enrich' && row.fieldsToEnrich.length > 0)
        ? `Fills: ${row.fieldsToEnrich.join(', ')}`
        : (row.notes || 'Ready to add');

    tr.innerHTML = `
      <td>${row.rowNumber}</td>
      <td><span class="${badgeClass}">${badgeText}</span></td>
      <td><strong>${escapeHtml(row.name)}</strong></td>
      <td>${escapeHtml(row.phone || '—')}</td>
      <td>${escapeHtml(row.cnic || '—')}</td>
      <td>${escapeHtml(row.mohalla || row.zone || '—')}</td>
      <td>${escapeHtml(row.packageSpeed || '—')}</td>
      <td>${row.monthlySellingAmount !== null ? `Rs ${row.monthlySellingAmount}` : '—'}</td>
      <td>${escapeHtml(detailText)}</td>
    `;
    tbody.append(tr);
  }

  const conflictsList = $('#csvImportConflictList');
  conflictsList.replaceChildren();
  const problemRows = rows.filter(r => r.action === 'conflict' || r.action === 'error');
  for (const prob of problemRows.slice(0, 20)) {
    const li = document.createElement('li');
    li.textContent = `Row ${prob.rowNumber} (${prob.name || 'unnamed'}): ${prob.errors.join('; ')}`;
    conflictsList.append(li);
  }
  if (problemRows.length > 20) {
    const li = document.createElement('li');
    li.textContent = `${problemRows.length - 20} more errors or conflicts in spreadsheet.`;
    conflictsList.append(li);
  }

  $('#applyCsvImportButton').disabled = !preview.canApply;
  $('#csvImportDialog').showModal();
}

function closeCsvImportDialog() {
  pendingCsvImportPreview = null;
  $('#csvImportDialog').close();
}

$('#downloadCustomerCsvTemplateBtn')?.addEventListener('click', () => {
  const csv = generateSampleCustomerCsv();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shahdara_customer_import_template_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Sample customer CSV template downloaded. Fill it and import.');
});

$('#importCustomerCsvBtn')?.addEventListener('click', () => {
  const fileInput = $('#customerCsvFileInput');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
});

$('#customerCsvFileInput')?.addEventListener('change', async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    toast('CSV file must be smaller than 10 MB.');
    return;
  }
  try {
    const text = await file.text();
    const preview = parseCustomerCsvImport(text, state);
    if (preview.error) {
      toast(`CSV Import Error: ${preview.error}`);
      return;
    }
    renderCsvImportPreview(preview);
  } catch (err) {
    toast(`Failed to read CSV: ${err.message}`);
  }
});

document.querySelectorAll('[data-close-csv-dialog]').forEach(btn => btn.addEventListener('click', closeCsvImportDialog));
$('#cancelCsvImportButton')?.addEventListener('click', closeCsvImportDialog);
$('#csvImportDialog')?.addEventListener('click', (e) => {
  if (e.target === $('#csvImportDialog')) closeCsvImportDialog();
});
$('#csvImportDialog')?.addEventListener('cancel', () => {
  pendingCsvImportPreview = null;
});

$('#applyCsvImportButton')?.addEventListener('click', () => {
  if (!pendingCsvImportPreview?.canApply) return;
  try {
    const enrichExisting = $('#csvEnrichExistingCheckbox')?.checked ?? true;
    const result = applyCustomerCsvImport(state, pendingCsvImportPreview, { enrichExisting });
    const newState = generateMonthlyBillsThroughCurrentMonth(result.state, new Date());
    persistState(newState, localStorage);
    state = newState;
    storageAvailable = true;
    persistenceBlocked = false;
    readFailureMessage = '';
    closeCsvImportDialog();
    renderStorageWarning();
    renderDashboard();
    renderGlobalSearch();
    renderCustomers();
    renderTransactions();
    renderMonthlyReport();
    renderDetail();
    toast(result.summaryMessage);
  } catch (err) {
    toast(`CSV Import could not be saved: ${err.message}`);
  }
});

$('#verifyStorageIntegrityBtn')?.addEventListener('click', () => {
  const audit = verifyAllStorageKeysRoundTrip(localStorage);
  if (audit.allPassed) {
    toast(`Storage Health: All ${audit.passedKeys} offline storage keys verified healthy.`);
  } else {
    toast(`Storage Health: ${audit.passedKeys}/${audit.totalKeys} keys passed. Some keys had warnings.`);
  }
});
function onBillSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget; const data = new FormData(form);
  try {
    const packageChanged = form.dataset.packageSelectionChanged === 'true';
    state = saveBillMonth(state, selectedCustomerId, {
      month:form.dataset.month,
      dueAmount:data.get('dueAmount') || null,
      dueDate:data.get('dueDate') || null,
      status:'pending',
      packageId:packageChanged ? data.get('packageId') : '',
      clearPackageSnapshot:packageChanged && form.dataset.clearPackageSnapshot === 'true'
    });
    save(); renderDetail(); toast('Bill details saved on this device.');
  }
  catch (error) { toast(error.message); }
}
async function onPaymentSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget; const data = new FormData(form);
  const customerId = selectedCustomerId;
  const submitBtn = form.querySelector('button[type="submit"]');
  try {
    // Advance guard (owner rule): a normal payment is never recorded
    // against an already-paid bill — money received early goes through
    // the Advance payment button so it stays tagged as advance credit.
    if (normalPaymentBlockReason(state, customerId, form.dataset.month) === 'fully-paid') {
      toast(t('adv_blocked_paid'), { type: 'error', title: 'Payment not saved' });
      return;
    }
    const txnId = (data.get('transactionId') || '').trim();
    if (txnId) {
      const dup = findDuplicatePaymentReference(state, txnId);
      if (dup) {
        if (!(await duplicateTxnConfirm(txnId, dup))) { form.querySelector('[name="transactionId"]')?.focus(); return; }
      }
    }
    // Payment proof (optional): a picked screenshot is downscaled +
    // recompressed to the storable cap before it rides the payment
    // record; a pick that cannot be shrunk enough refuses the save with
    // a clear message — the ledger's storage quota is never gambled.
    let proofScreenshot;
    const proofFile = data.get('proofScreenshot');
    if (proofFile && typeof proofFile === 'object' && Number(proofFile.size) > 0) {
      try { proofScreenshot = await compressPaymentProofImage(proofFile); }
      catch { toast(t('proof_too_large'), { type: 'error', title: 'Payment not saved' }); return; }
    }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.setAttribute('aria-busy', 'true'); }
    const beforeIds = new Set((state.customers.find(c => c.id === customerId)?.bills.find(b => b.month === form.dataset.month)?.payments || []).map(p => p.id));
    const stateBeforePayment = state;
    state = addPayment(state, customerId, form.dataset.month, {
      date: data.get('date'),
      amount: data.get('amount'),
      method: data.get('method'),
      paidBy:data.get('paidBy'),
      discount: data.get('discount') || 0,
      discountReason: data.get('discountReason') || '',
      transactionId: txnId || undefined,
      senderTitle: (data.get('senderTitle') || '').trim() || undefined,
      senderDigits: (data.get('senderDigits') || '').trim() || undefined,
      screenshot: proofScreenshot
    });
    // SISP-33: FIFO payment-event effects — record the operator's kist
    // toggle choice and, when this payment fully covers the month's kist,
    // advance stored monthsPaid. Runs once per submit, before save, and
    // is a no-op for unpriced bills or an already-marked payment.
    const fifoAdded = state.customers.find(c => c.id === customerId)?.bills.find(b => b.month === form.dataset.month)?.payments.find(p => !beforeIds.has(p.id));
    if (fifoAdded) {
      state = applyFifoPaymentEventToState(state, customerId, form.dataset.month, fifoAdded.id, { prioritizeKistFirst: data.get('fifoPrioritizeKist') === 'on' });
    }
    // Auto package follow (owner feature, 2026-10-29): a payment that
    // created-and-settled an unpriced month moves the customer's package
    // to the fee taken for that month (core decides from the
    // pre-payment state; priced-bill payments never move it).
    let autoPackageNote = null;
    if (fifoAdded) {
      const followed = autoPackageFromPayment(stateBeforePayment, state, customerId, form.dataset.month, fifoAdded.id);
      state = followed.nextState;
      autoPackageNote = followed.autoPackage;
    }
    save();
    renderDetail();
    const paidCustomer = state.customers.find(c => c.id === customerId);
    const added = paidCustomer?.bills.find(b => b.month === form.dataset.month)?.payments.find(p => !beforeIds.has(p.id));
    const actions = added ? [
      { label:'Undo', onAction: () => { try { state = deletePayment(state, customerId, form.dataset.month, added.id); save(); if (selectedCustomerId === customerId) renderDetail(); toast('Payment undone. Ledger restored.', { type:'info', title:'Undone' }); } catch (err) { toast(err.message); } } },
      { label:'Receipt', onAction: () => printPaymentReceipt(customerId, form.dataset.month, added.id) }
    ] : [];
    toast(added ? `${formatAmount(added.amount)} received from #${paidCustomer.customerNumber} ${paidCustomer.name} for ${monthName(form.dataset.month)}. Payment recorded on this device.${autoPackageNote ? ` ${t('pkg_auto_set_note', null, { amount: Number(autoPackageNote.fee).toLocaleString('en-PK') })}` : ''}` : 'Payment recorded on this device.', { type:'success', title:'Payment recorded', actions });
  }
  catch (error) { toast(error.message, { type:'error', title:'Payment not saved' }); }
  finally { if (submitBtn && submitBtn.isConnected) { submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); } }
}
function correctionForm(payment, customerId, month, origin) {
  const options = PAYMENT_METHODS.map(method => `<option value="${method}" ${method === payment.method ? 'selected' : ''}>${method}</option>`).join('');
  return `<form class="payment-form editing" data-kind="correct" data-origin="${origin}" data-customer-id="${escapeHtml(customerId)}" data-month="${escapeHtml(month)}" data-payment-id="${escapeHtml(payment.id)}"><div class="form-grid"><label class="field-label full" for="edit-date-${escapeHtml(payment.id)}">Payment date</label><input id="edit-date-${escapeHtml(payment.id)}" class="full" name="date" type="date" max="${localDate()}" value="${escapeHtml(payment.date)}" required><label class="field-label full" for="edit-amount-${escapeHtml(payment.id)}">Amount received (PKR)</label><input id="edit-amount-${escapeHtml(payment.id)}" class="full" name="amount" type="number" min="0.01" step="0.01" value="${escapeHtml(payment.amount)}" required><label class="field-label full" for="edit-discount-${escapeHtml(payment.id)}">Discount / concession (PKR)</label><input id="edit-discount-${escapeHtml(payment.id)}" class="full" name="discount" type="number" min="0" step="0.01" value="${payment.discount !== undefined && payment.discount !== null ? escapeHtml(payment.discount) : '0'}" placeholder="0"><label class="field-label full" for="edit-discount-reason-${escapeHtml(payment.id)}">Discount reason (optional)</label><input id="edit-discount-reason-${escapeHtml(payment.id)}" class="full" name="discountReason" type="text" maxlength="80" value="${escapeHtml(payment.discountReason || '')}" placeholder="e.g. Owner concession, outage waiver"><label class="field-label full" for="edit-method-${escapeHtml(payment.id)}">Payment method</label><select id="edit-method-${escapeHtml(payment.id)}" class="full" name="method">${options}</select>${paidByFieldMarkup(`edit-paid-by-${payment.id}`, payment.paidBy ?? '')}<label class="field-label full" for="edit-txnid-${escapeHtml(payment.id)}">Transaction ID / Ref (optional)</label><input id="edit-txnid-${escapeHtml(payment.id)}" class="full" name="transactionId" type="text" maxlength="64" value="${escapeHtml(payment.transactionId || '')}" placeholder="e.g. 1234567890"><label class="field-label full" for="edit-sender-name-${escapeHtml(payment.id)}">Sender name (optional, digital payments)</label><input id="edit-sender-name-${escapeHtml(payment.id)}" class="full" name="senderTitle" type="text" maxlength="100" value="${escapeHtml(payment.senderTitle || '')}" placeholder="e.g. Hamza"><label class="field-label full" for="edit-sender-digits-${escapeHtml(payment.id)}">Sender account last 4 digits (optional)</label><input id="edit-sender-digits-${escapeHtml(payment.id)}" class="full" name="senderDigits" type="text" inputmode="numeric" maxlength="19" value="${escapeHtml(payment.senderDigits || '')}" placeholder="e.g. 3310"><button class="primary-button" type="submit">Save correction</button><button class="secondary-button full" type="button" data-cancel-correction>Cancel</button></div></form>`;
}
function beginCorrection(customerId, month, paymentId, origin) {
  const customer = state.customers.find(item => item.id === customerId);
  const payment = customer?.bills.find(bill => bill.month === month)?.payments.find(item => item.id === paymentId);
  if (!payment) return;
  const host = origin === 'history' ? historyContainer : transactionList;
  const row = host.querySelector(`[data-payment-row="${CSS.escape(paymentId)}"]`);
  if (!row) return;
  row.innerHTML = correctionForm(payment, customerId, month, origin);
  const form = row.querySelector('form');
  form.addEventListener('submit', onCorrectionSubmit);
  form.querySelector('[data-cancel-correction]').addEventListener('click', () => origin === 'history' ? renderDetail() : renderTransactions());
}
async function onCorrectionSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget; const data = new FormData(form);
  try {
    const txnId = (data.get('transactionId') || '').trim();
    if (txnId) {
      const dup = findDuplicatePaymentReference(state, txnId, form.dataset.paymentId);
      if (dup) {
        if (!(await duplicateTxnConfirm(txnId, dup))) return;
      }
    }
    state = correctPayment(state, form.dataset.customerId, form.dataset.month, form.dataset.paymentId, { date:data.get('date'), amount:data.get('amount'), method:data.get('method'), paidBy:data.get('paidBy'), discount:data.get('discount') || 0, discountReason:data.get('discountReason') || '', transactionId: txnId || undefined, senderTitle: (data.get('senderTitle') || '').trim(), senderDigits: (data.get('senderDigits') || '').trim() });
    save();
    if (selectedCustomerId === form.dataset.customerId) renderDetail();
    toast('Payment correction saved on this device.');
  } catch (error) { toast(error.message); }
}
async function requestDeletePayment(customerId, month, paymentId) {
  const customer = state.customers.find(item => item.id === customerId);
  const payment = customer?.bills.find(bill => bill.month === month)?.payments.find(item => item.id === paymentId);
  if (!customer || !payment) return;
  const confirmed = await appConfirm({ tone:'danger', title:'Delete this payment?', subject:`${formatAmount(payment.amount)} · ${payment.date} · #${customer.customerNumber} ${customer.name}`, message:'It will be removed from this device\'s history, totals and exports. You can undo for 5 seconds.', confirmLabel:'Delete payment', input:{ label:'Reason (optional, kept in the deletion log)', placeholder:'e.g. entered twice', maxLength:200 } });
  if (!confirmed) return;
  const reason = (document.getElementById('appConfirmInput')?.value || '').trim();
  try {
    // #298: keep what is needed to put the payment back exactly where it was.
    const bill = customer.bills.find(item => item.month === month);
    const index = bill.payments.findIndex(item => item.id === paymentId);
    const removed = JSON.parse(JSON.stringify(payment));
    state = deletePayment(state, customerId, month, paymentId);
    save();
    recordPaymentDeletion({ paymentId, customerId, customerNumber:customer.customerNumber, customerName:customer.name, month, date:payment.date, amount:payment.amount, method:payment.method, reason });
    if (selectedCustomerId === customerId) renderDetail();
    renderTransactions();
    toast(`${formatAmount(payment.amount)} from #${customer.customerNumber} ${customer.name} was removed from this device.`, { type:'success', title:'Payment deleted', duration:5000, actionLabel:'Undo', onAction:() => undoDeletePayment(customerId, month, removed, index) });
  } catch (error) { toast(error.message, { type:'error' }); }
}
// SISP-80: Owner PIN gate for the restricted money-oversight actions
// (Partner Settlement, partner share tabs, expense deletion, payment
// void). Disabled by default: with no PIN record on the device — or
// Restricted Mode OFF — requireOwnerPin resolves true immediately and
// no flow changes. The controller is set up lazily so gating works
// whichever init path ran first; if the dialog is somehow unavailable
// while the lock is ACTIVE, the gate fails closed instead of waving
// the action through.
function ensureOwnerPinGuard() {
  if (!ownerPinGuardController && typeof document !== 'undefined' && document.getElementById('ownerPinDialog')) {
    ownerPinGuardController = setupOwnerPinGuard({ onToast: (msg, opts) => toast(msg, opts) });
  }
  return ownerPinGuardController;
}
async function requireOwnerPin(action) {
  const controller = ensureOwnerPinGuard();
  if (controller) return controller.requireUnlock(action);
  return !guardDecision(loadOwnerPinRecord(), action, { sessionUnlocked: false }).blocked;
}

// SISP-34: 1-click payment void with a required reason. The dialog is
// markup in index.html (voidPaymentDialog); this controller only fills
// it, validates the reason, and persists the void with a rollback guard:
// the ledger is written first and the void log second — if the log write
// fails, the previous ledger is written back so a void never half-applies.
let pendingVoidTarget = null;
function openVoidPaymentDialog(customerId, month, paymentId) {
  // SISP-80: voiding is restricted while the Owner PIN lock is active.
  requireOwnerPin('payment-void').then(ok => { if (ok) openVoidPaymentDialogUnlocked(customerId, month, paymentId); });
}
function openVoidPaymentDialogUnlocked(customerId, month, paymentId) {
  const customer = state.customers.find(item => item.id === customerId);
  const payment = customer?.bills.find(bill => bill.month === month)?.payments.find(item => item.id === paymentId);
  if (!customer || !payment) { toast('Payment not found.'); return; }
  if (payment.voided === true) { toast('This payment is already voided.'); return; }
  const dialog = document.getElementById('voidPaymentDialog');
  if (!dialog) { toast('Void dialog is not available.'); return; }
  pendingVoidTarget = { customerId, month, paymentId };
  const summary = document.getElementById('voidPaymentSummary');
  if (summary) summary.textContent = `#${customer.customerNumber} ${customer.name} · ${formatAmount(payment.amount)} · ${humanDate(payment.date)} · ${payment.method} · bill month ${monthName(month)}`;
  const reasonInput = document.getElementById('voidPaymentReasonInput');
  if (reasonInput) reasonInput.value = '';
  if (dialog.showModal) dialog.showModal();
  else dialog.hidden = false;
  if (reasonInput) reasonInput.focus();
}
function setupVoidPaymentDialog() {
  const dialog = typeof document !== 'undefined' ? document.getElementById('voidPaymentDialog') : null;
  if (!dialog) return;
  const close = () => {
    pendingVoidTarget = null;
    if (dialog.close) dialog.close();
    else dialog.hidden = true;
  };
  const cancelBtn = document.getElementById('voidPaymentCancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', close);
  const closeBtn = document.getElementById('voidPaymentCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', close);
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
  const confirmBtn = document.getElementById('voidPaymentConfirmBtn');
  if (confirmBtn) confirmBtn.addEventListener('click', async () => {
    const target = pendingVoidTarget;
    if (!target) return;
    const reasonInput = document.getElementById('voidPaymentReasonInput');
    const reason = (reasonInput?.value || '').trim();
    if (!reason) {
      toast('Void reason is required.');
      if (reasonInput) reasonInput.focus();
      return;
    }
    await snapshotBeforeDestructiveAction();
    try {
      const { state: next, voidRecord } = voidPayment(state, target.customerId, target.month, target.paymentId, { voidReason: reason });
      const previousState = state;
      const previousLog = loadVoidPayments();
      state = next;
      save();
      if (!saveVoidPayments([...previousLog, voidRecord])) {
        state = previousState;
        save();
        toast('Void log could not be saved — nothing was changed. Check storage and try again.', { type: 'error' });
        return;
      }
      // SISP-43: a voided payment's ticket-charge settlements reopen —
      // the cash behind those charges no longer exists. A tickets write
      // failure rolls the whole void back, like the log guard above.
      let ticketChargesReopened = 0;
      const voidedPayment = previousState.customers.find(c => c.id === target.customerId)?.bills.find(b => b.month === target.month)?.payments.find(p => p.id === target.paymentId);
      if (voidedPayment && Array.isArray(voidedPayment.ticketCharges) && voidedPayment.ticketCharges.length > 0) {
        try {
          const { tickets: nextTickets, reopened } = unsettleTicketChargesForPayment(loadTickets(), voidedPayment);
          if (reopened.length > 0) saveTickets(nextTickets);
          ticketChargesReopened = reopened.length;
        } catch {
          state = previousState;
          save();
          saveVoidPayments(previousLog);
          toast('Ticket charges could not be reopened — nothing was changed. Check storage and try again.', { type: 'error' });
          return;
        }
      }
      close();
      if (selectedCustomerId === target.customerId) renderDetail();
      renderTransactions();
      toast(`Payment voided: ${formatAmount(voidRecord.amount)} restored to #${voidRecord.customerNumber} balance.${voidRecord.promiseRestored ? ' Waada promise restored.' : ''}${ticketChargesReopened > 0 ? ' Ticket charge reopened.' : ''}`, { type: 'success', title: 'Payment voided' });
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  });
}
if (typeof document !== 'undefined') setupVoidPaymentDialog();
// Advance payment: the profile's explicit path for money received before
// its bill (the ordinary payment paths refuse an already-paid bill in
// core, by the owner's rule). The dialog markup lives in index.html
// (advancePaymentDialog); this controller fills it and records through
// advance-payment.js, mirroring the ordinary payment submit's
// save/render/FIFO/toast behaviour.
let advanceDialogCustomerId = null;
// Advance month targeting: the badge names the month the money is FOR
// ("Advance · for November 2026") whenever the record carries a valid
// target; untargeted advances keep the plain badge, exactly as before.
function advanceBadgeLabel(payment) {
  const target = advancePaymentTargetMonth(payment);
  return target ? `${t('adv_badge')} · ${t('adv_target_suffix', null, { month: displayMonthName(target) })}` : t('adv_badge');
}
// SISP-61: the multi-month prepay section lives inside the advance
// dialog — same date/method/paid-by/note fields, its own months /
// start / discount inputs, and a live quote (rate read from the
// customer's plan data via prepayQuote, never free-typed).
function refreshPrepaySummary() {
  const customer = state.customers.find(c => c.id === advanceDialogCustomerId);
  const monthsSel = document.getElementById('prepayMonths');
  const startSel = document.getElementById('prepayStartMonth');
  if (!customer || !monthsSel || !startSel) return;
  const rateLine = document.getElementById('prepayRateLine');
  const summaryLine = document.getElementById('prepaySummaryLine');
  try {
    const quote = prepayQuote(customer, { months: Number(monthsSel.value), startMonth: startSel.value, discount: document.getElementById('prepayDiscount')?.value || 0 });
    if (rateLine) rateLine.textContent = t('prepay_rate_line', null, { amount: formatAmount(quote.rate) });
    if (summaryLine) summaryLine.textContent = t('prepay_summary', null, { gross: formatAmount(quote.gross), discount: formatAmount(quote.discount), net: formatAmount(quote.netPaid) });
  } catch (error) {
    if (rateLine) rateLine.textContent = '';
    if (summaryLine) summaryLine.textContent = error.message;
  }
}
function setupPrepaySection(customer) {
  const section = document.querySelector('.prepay-section');
  const monthsSel = document.getElementById('prepayMonths');
  const startSel = document.getElementById('prepayStartMonth');
  if (!monthsSel || !startSel) return;
  if (section) section.hidden = customer.isFreeConnection === true;
  const now = new Date();
  monthsSel.innerHTML = PREPAY_MONTH_OPTIONS.map(m => `<option value="${m}">${escapeHtml(t('prepay_months_option', null, { months: m }))}</option>`).join('');
  monthsSel.value = '3';
  startSel.innerHTML = advanceTargetMonthOptions(now).map(m => `<option value="${escapeHtml(m)}">${escapeHtml(displayMonthName(m))}</option>`).join('');
  startSel.value = defaultAdvanceTargetMonth(now);
  const discountInput = document.getElementById('prepayDiscount');
  if (discountInput) discountInput.value = '';
  refreshPrepaySummary();
}
function openAdvancePaymentDialog() {
  const customer = selectedCustomer();
  if (!customer) { toast('Search for a customer, then record their advance payment.'); return; }
  if (customer.archived) { toast('Archived customers cannot receive payments. Unarchive the customer first.'); return; }
  const dialog = document.getElementById('advancePaymentDialog');
  if (!dialog) { toast('Advance payment dialog is not available.'); return; }
  advanceDialogCustomerId = customer.id;
  const month = monthsForHistory(new Date())[0];
  const summary = document.getElementById('advancePaymentSummary');
  if (summary) summary.textContent = `${t('adv_summary_label')} #${customer.customerNumber} ${customer.name} · ${displayMonthName(month)}`;
  const balance = document.getElementById('advancePaymentBalance');
  if (balance) balance.textContent = t('adv_current_balance', null, { amount: formatAmount(advanceBalanceCents(state, customer.id) / 100) });
  const methodSelect = document.getElementById('advancePaymentMethod');
  if (methodSelect && methodSelect.options.length === 0) {
    methodSelect.innerHTML = PAYMENT_METHODS.map(method => `<option value="${escapeHtml(method)}">${escapeHtml(method)}</option>`).join('');
  }
  if (methodSelect) methodSelect.value = 'Cash';
  // Month targeting: the picker offers the current month onward and
  // pre-selects NEXT month (the owner's case: money arriving on 29 Oct
  // is November's). The choice is stored on the payment record.
  const targetSelect = document.getElementById('advancePaymentTargetMonth');
  if (targetSelect) {
    const now = new Date();
    targetSelect.innerHTML = advanceTargetMonthOptions(now).map(m => `<option value="${escapeHtml(m)}">${escapeHtml(displayMonthName(m))}</option>`).join('');
    targetSelect.value = defaultAdvanceTargetMonth(now);
  }
  const dateInput = document.getElementById('advancePaymentDate');
  if (dateInput) { dateInput.value = localDate(); dateInput.max = localDate(); }
  for (const id of ['advancePaymentAmount', 'advancePaymentPaidBy', 'advancePaymentNote']) {
    const input = document.getElementById(id);
    if (input) input.value = '';
  }
  const errorBox = document.getElementById('advancePaymentError');
  if (errorBox) { errorBox.hidden = true; errorBox.textContent = ''; }
  setupPrepaySection(customer);
  if (dialog.showModal) dialog.showModal();
  else dialog.hidden = false;
  document.getElementById('advancePaymentAmount')?.focus();
}
function setupAdvancePaymentDialog() {
  const dialog = typeof document !== 'undefined' ? document.getElementById('advancePaymentDialog') : null;
  if (!dialog) return;
  const close = () => {
    advanceDialogCustomerId = null;
    if (dialog.close) dialog.close();
    else dialog.hidden = true;
  };
  document.getElementById('advancePaymentCloseBtn')?.addEventListener('click', close);
  document.getElementById('advancePaymentCancelBtn')?.addEventListener('click', close);
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
  const form = document.getElementById('advancePaymentForm');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const customerId = advanceDialogCustomerId;
    if (!customerId) return;
    const data = new FormData(form);
    const errorBox = document.getElementById('advancePaymentError');
    try {
      const { nextState, payment, month } = recordAdvancePayment(state, customerId, {
        date: data.get('date'),
        amount: data.get('amount'),
        method: data.get('method'),
        paidBy: data.get('paidBy') || undefined,
        note: data.get('note') || undefined,
        targetMonth: data.get('targetMonth') || undefined
      });
      state = nextState;
      // SISP-33 parity with the ordinary profile payment submit: the FIFO
      // payment-event bookkeeping runs for advance payments too, so a
      // kist portion settled by an advance is marked exactly the same.
      state = applyFifoPaymentEventToState(state, customerId, month, payment.id, { prioritizeKistFirst: false });
      save();
      close();
      if (selectedCustomerId === customerId) renderDetail();
      renderTransactions();
      const paidCustomer = state.customers.find(c => c.id === customerId);
      toast(`${t('adv_recorded')}: ${formatAmount(payment.amount)} · #${paidCustomer.customerNumber} ${paidCustomer.name}`, { type: 'success', title: t('adv_dialog_title'), actions: [
        { label: 'Undo', onAction: () => { try { state = deletePayment(state, customerId, month, payment.id); save(); if (selectedCustomerId === customerId) renderDetail(); renderTransactions(); toast('Payment undone. Ledger restored.', { type: 'info', title: 'Undone' }); } catch (err) { toast(err.message); } } },
        { label: 'Receipt', onAction: () => printPaymentReceipt(customerId, month, payment.id) }
      ] });
    } catch (error) {
      if (errorBox) { errorBox.textContent = error.message; errorBox.hidden = false; }
      else toast(error.message, { type: 'error', title: 'Advance payment not saved' });
    }
  });
  // SISP-61: prepay section — live quote on any input change, and its
  // own save button (the cash figure is computed by recordPrepay from
  // the quote, so the shared Amount field is not used for a prepay).
  for (const id of ['prepayMonths', 'prepayStartMonth', 'prepayDiscount']) {
    document.getElementById(id)?.addEventListener('change', refreshPrepaySummary);
    document.getElementById(id)?.addEventListener('input', refreshPrepaySummary);
  }
  document.getElementById('prepaySaveBtn')?.addEventListener('click', () => {
    const customerId = advanceDialogCustomerId;
    if (!customerId) return;
    const errorBox = document.getElementById('advancePaymentError');
    const data = new FormData(form);
    try {
      const { nextState, payment, month, prepaidUntil } = recordPrepay(state, customerId, {
        months: Number(document.getElementById('prepayMonths')?.value),
        startMonth: document.getElementById('prepayStartMonth')?.value || undefined,
        discount: document.getElementById('prepayDiscount')?.value || 0,
        date: data.get('date'),
        method: data.get('method'),
        paidBy: data.get('paidBy') || undefined,
        note: data.get('note') || undefined
      });
      state = nextState;
      state = applyFifoPaymentEventToState(state, customerId, month, payment.id, { prioritizeKistFirst: false });
      save();
      close();
      if (selectedCustomerId === customerId) renderDetail();
      renderTransactions();
      const paidCustomer = state.customers.find(c => c.id === customerId);
      const untilText = prepaidUntil ? ` · ${t('prepay_until_suffix', null, { month: displayMonthName(prepaidUntil) })}` : '';
      toast(`${t('prepay_recorded')}: ${formatAmount(payment.amount)}${untilText} · #${paidCustomer.customerNumber} ${paidCustomer.name}`, { type: 'success', title: t('prepay_section_title'), actions: [
        { label: 'Undo', onAction: () => { try { state = deletePayment(state, customerId, month, payment.id); save(); if (selectedCustomerId === customerId) renderDetail(); renderTransactions(); toast('Payment undone. Ledger restored.', { type: 'info', title: 'Undone' }); } catch (err) { toast(err.message); } } },
        { label: 'Receipt', onAction: () => printPaymentReceipt(customerId, month, payment.id) }
      ] });
    } catch (error) {
      if (errorBox) { errorBox.textContent = error.message; errorBox.hidden = false; }
      else toast(error.message, { type: 'error', title: 'Prepay not saved' });
    }
  });
}
if (typeof document !== 'undefined') setupAdvancePaymentDialog();
$('#advancePaymentButton')?.addEventListener('click', openAdvancePaymentDialog);

// Payment proof viewer: read-only dialog (paymentProofDialog in
// index.html) opened from a payment row's proof thumbnail. The proof is
// audit evidence on the payment record — this viewer never edits it.
function openPaymentProofDialog(customerId, month, paymentId) {
  const customer = state.customers.find(c => c.id === customerId);
  const payment = customer?.bills.find(b => b.month === month)?.payments.find(p => p.id === paymentId);
  const dialog = document.getElementById('paymentProofDialog');
  if (!customer || !payment || typeof payment.screenshot !== 'string' || !payment.screenshot || !dialog) return;
  const img = document.getElementById('paymentProofImage');
  if (img) img.src = payment.screenshot;
  const meta = document.getElementById('paymentProofMeta');
  if (meta) meta.textContent = `#${customer.customerNumber} ${customer.name} · ${humanDate(payment.date)} · ${formatAmount(payment.amount)} · ${payment.method}${payment.voided === true ? ' · VOID' : ''}`;
  if (dialog.showModal) dialog.showModal();
  else dialog.hidden = false;
}
function setupPaymentProofDialog() {
  const dialog = typeof document !== 'undefined' ? document.getElementById('paymentProofDialog') : null;
  if (!dialog) return;
  const close = () => {
    const img = document.getElementById('paymentProofImage');
    if (img) img.src = '';
    if (dialog.close) dialog.close();
    else dialog.hidden = true;
  };
  document.getElementById('paymentProofCloseBtn')?.addEventListener('click', close);
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
}
if (typeof document !== 'undefined') setupPaymentProofDialog();

// Owner feature 2026-10-29: Advance holders dialog (opened from the Home
// "Advance Held" KPI card). Read-only: rows list every customer holding
// advance credit with the total; a row tap closes the dialog and opens
// that customer's profile (the Recent Payments card pattern).
function renderAdvanceHoldersDialog() {
  const list = document.getElementById('advanceHoldersList');
  if (!list) return;
  const summary = buildAdvanceDashboard(state, monthsForHistory()[0]);
  list.innerHTML = summary.holders.length === 0
    ? `<li class="advance-holders-empty">${escapeHtml(t('adv_hold_empty'))}</li>`
    : summary.holders.map((row) => {
      const subParts = [];
      if (row.customerNumber !== null && row.customerNumber !== undefined) subParts.push(`#${row.customerNumber}`);
      if (row.mohalla) subParts.push(row.mohalla);
      for (const target of row.targets ?? []) subParts.push(t('adv_target_suffix', null, { month: displayMonthName(target.month) }));
      return `<li class="advance-holder-item"><button type="button" class="advance-holder-row" data-adv-holder-id="${escapeHtml(row.customerId)}"><span class="advance-holder-main"><strong class="advance-holder-name" dir="auto">${escapeHtml(row.customerName)}</strong>${subParts.length ? `<span class="advance-holder-sub" dir="auto">${escapeHtml(subParts.join(' · '))}</span>` : ''}</span><strong class="advance-holder-amount">${escapeHtml(formatAmount(row.amountCents / 100))}</strong></button></li>`;
    }).join('');
  list.querySelectorAll('[data-adv-holder-id]').forEach(button => button.addEventListener('click', () => {
    const dialog = document.getElementById('advanceHoldersModal');
    if (dialog?.close) dialog.close();
    else if (dialog) dialog.hidden = true;
    selectCustomer(button.dataset.advHolderId);
  }));
  const totalEl = document.getElementById('advanceHoldersTotal');
  if (totalEl) totalEl.textContent = formatAmount(summary.heldTotalCents / 100);
}
function setupAdvanceHoldersDialog() {
  const dialog = typeof document !== 'undefined' ? document.getElementById('advanceHoldersModal') : null;
  if (!dialog) return;
  const close = () => {
    if (dialog.close) dialog.close();
    else dialog.hidden = true;
  };
  document.getElementById('closeAdvanceHoldersModalBtn')?.addEventListener('click', close);
  document.getElementById('closeAdvanceHoldersSecondaryBtn')?.addEventListener('click', close);
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
}
if (typeof document !== 'undefined') setupAdvanceHoldersDialog();
function openAdvanceHoldersDialog() {
  const dialog = document.getElementById('advanceHoldersModal');
  if (!dialog) return;
  renderAdvanceHoldersDialog();
  if (dialog.showModal) dialog.showModal();
  else dialog.hidden = false;
}
function undoDeletePayment(customerId, month, removed, index) {
  const customer = state.customers.find(item => item.id === customerId);
  const bill = customer?.bills.find(item => item.month === month);
  if (!customer || !bill) { toast('This payment can no longer be restored: its customer or bill was removed.', { type:'error' }); return; }
  if (bill.payments.some(item => item.id === removed.id)) return;
  state = { ...state, customers: state.customers.map(c => c.id !== customerId ? c : { ...c, bills: c.bills.map(b => {
    if (b.month !== month) return b;
    const payments = [...b.payments];
    payments.splice(Math.min(Math.max(index, 0), payments.length), 0, removed);
    return { ...b, payments };
  }) }) };
  save();
  markPaymentDeletionUndone(removed.id);
  if (selectedCustomerId === customerId) renderDetail();
  renderTransactions();
  renderMonthlyReport?.();
  toast(`${formatAmount(removed.amount)} payment restored for #${customer.customerNumber} ${customer.name}.`, { type:'success', title:'Delete undone' });
}
function showIncidentEditor(incident = null) {
  const form = $('#incidentForm');
  $('#incidentFormError').hidden = true;
  $('#incidentIdInput').value = incident?.id ?? '';
  $('#incidentReportedAtInput').value = incident?.reportedAt ?? localDateTime();
  $('#incidentOfflineAtInput').value = incident?.offlineAt ?? localDateTime();
  $('#incidentRestoredAtInput').value = incident?.restoredAt ?? '';
  $('#incidentNoteInput').value = incident?.note ?? '';
  $('#incidentSubmitButton').textContent = incident ? t('prof_incident_save_correction') : t('prof_incident_save');
  $('#addIncidentButton').hidden = true;
  form.hidden = false;
  form.scrollIntoView({ behavior:'smooth', block:'nearest' });
  $('#incidentReportedAtInput').focus();
}
function closeIncidentEditor() {
  $('#incidentForm').hidden = true;
  $('#addIncidentButton').hidden = false;
  $('#incidentFormError').hidden = true;
}
function onIncidentSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget; const data = new FormData(form);
  const fields = { reportedAt:data.get('reportedAt'), offlineAt:data.get('offlineAt'), restoredAt:data.get('restoredAt'), note:data.get('note') };
  try {
    if (data.get('incidentId')) state = updateIncident(state, selectedCustomerId, data.get('incidentId'), fields);
    else state = addIncident(state, selectedCustomerId, fields);
    closeIncidentEditor();
    save(); renderDetail();
    toast(data.get('incidentId') ? 'Incident correction saved with local history.' : 'Incident saved on this device.');
  } catch (error) {
    const errorBox = $('#incidentFormError');
    const incidentErrorKey = { 'Enter a valid complaint/report date and time.': 'prof_incident_err_reported', 'Enter a valid offline-start date and time.': 'prof_incident_err_offline', 'Enter a valid restored-online date and time.': 'prof_incident_err_restored', 'Restored-online time cannot be earlier than the report or offline-start time.': 'prof_incident_err_order' }[error.message];
    errorBox.textContent = incidentErrorKey ? t(incidentErrorKey) : error.message; errorBox.hidden = false;
  }
}
async function requestDeleteIncident(customerId, incidentId) {
  const customer = state.customers.find(item => item.id === customerId);
  const incident = customer?.incidents.find(item => item.id === incidentId);
  if (!customer || !incident) return;
  if (!(await appConfirm({ tone:'danger', title:`Delete this ${incident.restoredAt ? 'resolved' : 'open'} complaint?`, subject:`#${customer.customerNumber} ${customer.name}`, message:'It and its correction history will be removed from this device, its 30-day count, and customer export.', confirmLabel:'Delete complaint' }))) return;
  try { state = deleteIncident(state, customerId, incidentId); save(); if (selectedCustomerId === customerId) renderDetail(); toast('Incident deleted from this device.'); }
  catch (error) { toast(error.message); }
}

$('#customerListSearch').addEventListener('input', renderCustomers);
$('#customerSearchField')?.addEventListener('change', (event) => { customerSearchField = normalizeCustomerSearchField(event.currentTarget.value); customerCurrentPage = 1; renderCustomers(); });
$('#clearCustomerListSearch').addEventListener('click', () => { $('#customerListSearch').value = ''; renderCustomers(); $('#customerListSearch').focus(); });
$('#globalCustomerSearch').addEventListener('input', () => { renderGlobalSearch(); renderCustomers(); renderTransactions(); renderMonthlyReport(); });
$('#globalCustomerSearch').addEventListener('focus', () => { if (searchQuery().trim()) renderGlobalSearch(); });
$('#clearGlobalSearch').addEventListener('click', () => { $('#globalCustomerSearch').value = ''; renderGlobalSearch(); renderCustomers(); renderTransactions(); renderMonthlyReport(); $('#globalCustomerSearch').focus(); });
$('#showCustomersButton').addEventListener('click', () => switchView('customers'));
function openPaymentEntry(month = selectedBillingMonth) {
  const customer = selectedCustomer();
  if (!customer) {
    if (window.quickCollectModalController?.open) {
      window.quickCollectModalController.open();
      return;
    }
    $('#globalCustomerSearch').focus();
    toast('Search for a customer, then open their payment form.');
    return;
  }
  const card = historyContainer.querySelector(`[data-month-card="${CSS.escape(month)}"]`);
  if (!card) { toast('That billing month is outside the available history.'); return; }
  card.open = true;
  const form = card.querySelector('form[data-kind="payment"]');
  const amountInput = form?.querySelector('input[name="amount"]');
  if (!form || !amountInput) { toast('This archived customer has no payment form for that month.', { type: 'info' }); return; }
  const bill = customer.bills.find(item => item.month === month);
  const allocation = calculatePaymentAllocations(state).forMonth(customer.id, month);
  const hint = form.querySelector('.payment-guidance');
  amountInput.value = '';
  if (bill?.dueAmount !== null && bill?.dueAmount !== undefined && allocation?.balanceDueCents > 0) {
    const suggested = (allocation.balanceDueCents / 100).toFixed(2);
    amountInput.value = String(Number(suggested)); // 1000, not 1000.00 (#294)
    hint.textContent = `Suggested remaining balance: ${formatAmount(Number(suggested))}. Confirm the actual amount collected, enter the real payment date and method, then submit. Nothing is saved by opening this form.`;
  } else if (bill && derivedBillStatus(customer, bill, calculatePaymentAllocations(state)) === 'paid') {
    hint.textContent = 'This bill is already settled. No amount is due, and a normal payment cannot be recorded against it. To record money received early, use the Advance payment button on the profile — it tags the amount as advance credit for the next bill. Nothing is saved by opening this form.';
  } else if (!bill?.dueAmount) {
    hint.textContent = 'No bill amount is set for this month, so no remainder can be suggested. Enter only an actual collected amount, plus its real date and method. Nothing is saved until you submit.';
  } else {
    hint.textContent = 'No remaining bill balance is shown. Enter an amount only if it is an actual collected payment, plus its real date and method.';
  }
  const dateInput = form.querySelector('input[name="date"]');
  if (dateInput && !dateInput.value) dateInput.value = localDate();
  const methodSelect = form.querySelector('select[name="method"]');
  if (methodSelect && !methodSelect.value && [...methodSelect.options].some(o => o.value === 'Cash')) methodSelect.value = 'Cash';
  amountInput.scrollIntoView({ behavior:'smooth', block:'center' });
  amountInput.focus({ preventScroll:true });
}
// #300: every "+ Add Payment" (Home, Transactions, Bills, Monthly Report, menus) opens Quick Collect, even after a
// profile was opened. The old per-month ledger form is only for the profile's "back-dated entry" link.
function openAddPayment(customerId = null) {
  const qc = window.quickCollectModalController;
  if (typeof qc?.open === 'function') {
    const customer = customerId ? state.customers.find(c => c.id === customerId) : null;
    if (customer && !customer.archived) qc.open(customer.id); else qc.open();
    return;
  }
  switchView('customers');
  if (customerId) selectCustomer(customerId);
  openPaymentEntry();
}
$('#quickAddPaymentButton').addEventListener('click', () => openAddPayment());
// #294: the profile's main payment button opens the same Quick Collect sheet (today's date, Cash, amount chips,
// receipt/WhatsApp/Undo) already on this customer. The ledger month form stays for back-dated entries.
$('#currentBillPaymentShortcut').addEventListener('click', () => {
  const customer = selectedCustomer();
  const qc = window.quickCollectModalController;
  if (customer && !customer.archived && typeof qc?.open === 'function') { qc.open(customer.id); return; }
  openPaymentEntry();
});
$('#backdatedPaymentButton')?.addEventListener('click', () => openPaymentEntry());
$('#showTransactionsButton').addEventListener('click', () => { switchView('transactions'); renderTransactions(); });
$('#showReportsButton').addEventListener('click', () => { switchView('reports'); renderMonthlyReport(); });
$('#transactionDateFilter').addEventListener('input', () => { transactionCurrentPage = 1; renderTransactions(); });
$('#transactionRecencyFilter').addEventListener('change', () => { transactionCurrentPage = 1; renderTransactions(); });
$('#transactionMethodFilter').addEventListener('change', event => { transactionMethodFilter = event.currentTarget.value; transactionCurrentPage = 1; renderTransactions(); });
$('#transactionSortSelect')?.addEventListener('change', event => { transactionSortBy = event.currentTarget.value; transactionCurrentPage = 1; renderTransactions(); });
setupPaymentsList(); // #298 tap-to-expand payment rows
$('#txPrevPage').addEventListener('click', () => { if (transactionCurrentPage > 1) { transactionCurrentPage--; renderTransactions(); $('#transactionsList').scrollIntoView({ behavior:'smooth', block:'start' }); } });
$('#txNextPage').addEventListener('click', () => { transactionCurrentPage++; renderTransactions(); $('#transactionsList').scrollIntoView({ behavior:'smooth', block:'start' }); });
$('#txPageSize').addEventListener('change', event => { transactionPageSize = event.currentTarget.value === 'all' ? 'all' : Number(event.currentTarget.value); transactionCurrentPage = 1; renderTransactions(); });
$('#clearTransactionFilters').addEventListener('click', () => {
  $('#transactionRecencyFilter').value = 'all';
  $('#transactionDateFilter').value = '';
  const methodSelect = $('#transactionMethodFilter');
  if (methodSelect) methodSelect.value = 'all';
  transactionMethodFilter = 'all';
  transactionCurrentPage = 1;
  $('#globalCustomerSearch').value = '';
  const reportSearch = $('#reportCustomerSearch');
  if (reportSearch) reportSearch.value = '';
  reportSearchQuery = '';
  reportCurrentPage = 1;
  renderGlobalSearch();
  renderCustomers();
  renderTransactions();
  renderMonthlyReport();
});
$('#reportCustomerSearch').addEventListener('input', event => { reportSearchQuery = event.currentTarget.value; reportCurrentPage = 1; renderMonthlyReport(); });
$('#reportSortSelect')?.addEventListener('change', event => { reportSortBy = event.currentTarget.value; reportCurrentPage = 1; renderMonthlyReport(); });
$('#reportPrevPage').addEventListener('click', () => { if (reportCurrentPage > 1) { reportCurrentPage--; renderMonthlyReport(); $('#monthlyReportList').scrollIntoView({ behavior:'smooth', block:'start' }); } });
$('#reportNextPage').addEventListener('click', () => { reportCurrentPage++; renderMonthlyReport(); $('#monthlyReportList').scrollIntoView({ behavior:'smooth', block:'start' }); });
$('#reportPageSize').addEventListener('change', event => { reportPageSize = event.currentTarget.value === 'all' ? 'all' : Number(event.currentTarget.value); reportCurrentPage = 1; renderMonthlyReport(); });

$('#customerFilterArea')?.addEventListener('change', event => {
  customerAreaFilter = event.currentTarget.value;
  customerCurrentPage = 1;
  renderCustomers();
});
$('#customerSortSelect')?.addEventListener('change', event => {
  customerSortBy = event.currentTarget.value;
  customerCurrentPage = 1;
  renderCustomers();
});
$('#customerViewCardsBtn')?.addEventListener('click', () => {
  customerViewMode = 'cards';
  try { localStorage.setItem('shahdara_customer_view_mode', 'cards'); } catch {}
  renderCustomers();
});
$('#customerViewTableBtn')?.addEventListener('click', () => {
  customerViewMode = 'table';
  try { localStorage.setItem('shahdara_customer_view_mode', 'table'); } catch {}
  renderCustomers();
});
$('#customerTableExpandBtn')?.addEventListener('click', () => {
  const isExpanded = appShell.classList.toggle('roster-table-expanded');
  const btn = $('#customerTableExpandBtn');
  if (btn) {
    btn.textContent = isExpanded ? '🗗 Restore' : '⛶ Expand';
    btn.setAttribute('aria-pressed', isExpanded ? 'true' : 'false');
    btn.title = isExpanded ? 'Restore 2-column sidebar view' : 'Maximize Table / Full Screen Width';
  }
});
$('#exportCustomerRosterCsvBtn')?.addEventListener('click', () => {
  const activeCustomers = state.customers.filter(c => !c.archived);
  const areaFiltered = filterCustomersByArea(activeCustomers, customerAreaFilter);
  // Read the live roster query at click time (#235: `customerQuery` only exists inside renderCustomers).
  const query = customerListQuery().trim();
  const searchFiltered = query ? searchCustomers(state, query).filter(c => !c.archived && (customerAreaFilter === 'all' || (c.mohalla || c.area || '') === customerAreaFilter)) : areaFiltered;
  const statusFiltered = filterCustomersByStatus(state, {
    serviceStatus: selectedServiceFilter,
    billingStatus: selectedBillingFilter,
    month: selectedBillingMonth,
    customerQuery: query
  });
  const targetList = activeCustomers.filter(c => searchFiltered.some(sf => sf.id === c.id) && statusFiltered.some(st => st.id === c.id));
  const allocations = calculatePaymentAllocations(state);
  const sorted = sortCustomerRoster(targetList, {
    sortBy: customerSortBy,
    billingMonth: selectedBillingMonth,
    allocations
  });
  const csv = generateCustomerRosterCsv(sorted, {
    billingMonth: selectedBillingMonth,
    allocations
  });
  const filename = `shahdara-customer-roster-${selectedBillingMonth || 'all'}.csv`;
  downloadCsvFile(filename, csv);
  toast(`Exported ${sorted.length} customer records to CSV.`);
});
$('#customerRosterTableBody')?.addEventListener('click', event => {
  const btn = event.target.closest('[data-customer-id]');
  if (btn && btn.dataset.customerId) {
    selectCustomer(btn.dataset.customerId);
  }
});
$('#customerPrevPage')?.addEventListener('click', () => {
  if (customerCurrentPage > 1) {
    customerCurrentPage--;
    renderCustomers();
    const list = $('#customerList') || $('#customerTableWrap');
    if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});
$('#customerNextPage')?.addEventListener('click', () => {
  customerCurrentPage++;
  renderCustomers();
  const list = $('#customerList') || $('#customerTableWrap');
  if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#customerPageSize')?.addEventListener('change', event => {
  customerPageSize = event.currentTarget.value === 'all' ? 'all' : Number(event.currentTarget.value);
  customerCurrentPage = 1;
  renderCustomers();
});
document.querySelectorAll('[data-sort-cust]').forEach(th => {
  th.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      th.click();
    }
  });
  th.addEventListener('click', () => {
    const field = th.dataset.sortCust;
    if (customerSortBy === `${field}-asc`) {
      customerSortBy = `${field}-desc`;
    } else {
      customerSortBy = `${field}-asc`;
    }
    const select = $('#customerSortSelect');
    if (select) select.value = customerSortBy;
    customerCurrentPage = 1;
    renderCustomers();
  });
});

function setBillingMonth(month) {
  if (!monthsForHistory().includes(month)) return;
  selectedBillingMonth = month;
  $('#reportMonth').value = month;
  $('#customerFilterMonth').value = month;
  renderCustomers();
  renderMonthlyReport();
}
$('#reportMonth').addEventListener('change', event => setBillingMonth(event.currentTarget.value));
$('#customerFilterMonth').addEventListener('change', event => setBillingMonth(event.currentTarget.value));
document.querySelectorAll('[data-customer-service-filter]').forEach(button => button.addEventListener('click', () => { selectedServiceFilter = button.dataset.customerServiceFilter; customerCurrentPage = 1; renderCustomers(); }));
document.querySelectorAll('[data-customer-billing-filter]').forEach(button => button.addEventListener('click', () => { selectedBillingFilter = button.dataset.customerBillingFilter; customerCurrentPage = 1; renderCustomers(); }));
document.querySelectorAll('[data-report-filter]').forEach(button => button.addEventListener('click', () => { selectedReportFilter = button.dataset.reportFilter; reportCurrentPage = 1; renderMonthlyReport(); }));
function resetDuplicateReview() {
  $('#duplicateCustomerReview').hidden = true;
  $('#duplicateCustomerMatches').replaceChildren();
  $('#newCustomerFields').disabled = false;
  $('#addCustomerSubmit').hidden = false;
}
function renderDuplicateReview(matches) {
  $('#duplicateCustomerMatches').innerHTML = matches.map(({ customer, reasons }) => {
    const savedDetails = [
      customer.cnic || customer.customerCnic ? `CNIC: ${formatCnicDisplay(customer.cnic || customer.customerCnic)}` : '',
      customer.phone || customer.customerPhone ? `Phone: ${customer.phone || customer.customerPhone}` : '',
      customer.address || customer.customerAddress ? `Address: ${customer.address || customer.customerAddress}` : '',
      customer.mohalla ? `Mohalla / area: ${customer.mohalla}` : '',
      customer.zone ? `Zone: ${customer.zone}` : ''
    ].filter(Boolean).map(value => `<span>${escapeHtml(value)}</span>`).join('');
    const matchReasons = reasons.map(reason => `<li>${escapeHtml(reason.label)}</li>`).join('');
    return `<li class="duplicate-customer-match"><div class="duplicate-customer-match-copy"><strong>Customer #${escapeHtml(customer.customerNumber)} · ${escapeHtml(customer.name)}${customer.archived ? ' · Archived' : ''}</strong><ul class="duplicate-match-reasons">${matchReasons}</ul>${savedDetails ? `<div class="duplicate-saved-details">${savedDetails}</div>` : ''}</div><button class="secondary-button" type="button" data-open-duplicate-customer="${escapeHtml(customer.id)}">Open existing profile</button></li>`;
  }).join('');
  $('#newCustomerFields').disabled = true;
  $('#addCustomerSubmit').hidden = true;
  $('#duplicateCustomerReview').hidden = false;
  $('#editNewCustomerDetails').focus();
}
// SISP-40: fill the "Referred by" select with the existing customers
// (the referrer must already be on the list — core addCustomer validates
// the id again at save time). Keeps the current selection when possible.
function populateReferrerOptions() {
  const select = $('#newCustomerReferredBy');
  if (!select) return;
  const current = select.value;
  const options = [...(state.customers ?? [])]
    .filter((row) => row && row.id)
    .sort((a, b) => (a.customerNumber ?? 0) - (b.customerNumber ?? 0))
    .map((row) => `<option value="${escapeHtml(row.id)}">#${escapeHtml(String(row.customerNumber ?? ''))} ${escapeHtml(row.name)}</option>`)
    .join('');
  select.innerHTML = `<option value="">No referral</option>${options}`;
  if (current && [...select.options].some((option) => option.value === current)) select.value = current;
}

function saveNewCustomer(allowDuplicateName = false) {
  const details = {
    name:$('#newCustomerName').value,
    cnic:$('#newCustomerCnic') ? $('#newCustomerCnic').value.trim() : '',
    phone:$('#newCustomerPhone').value.trim(),
    address:$('#newCustomerAddress').value,
    mohalla:$('#newCustomerMohalla').value,
    zone:$('#newCustomerZone').value,
    connectionFee:$('#newCustomerConnectionFee').value,
    routerModel:$('#newCustomerRouterModel').value,
    routerPrice:$('#newCustomerRouterPrice').value,
    fiberMeters:$('#newCustomerFiberMeters').value,
    // SISP-24: optical splitter assignment + last RX reading (optional).
    splitterBoxId:$('#newCustomerSplitterBox').value,
    splitterPort:$('#newCustomerSplitterPort').value,
    oltPonPort:$('#newCustomerOltPonPort').value,
    lastRxDbm:$('#newCustomerLastRxDbm').value,
    mediaConverterCost:$('#newCustomerMediaConverterCost') ? $('#newCustomerMediaConverterCost').value : '',
    linemanInstallFee:$('#newCustomerLinemanInstallFee') ? $('#newCustomerLinemanInstallFee').value : '',
    fiberPerMeterRate:$('#newCustomerFiberPerMeterRate') ? $('#newCustomerFiberPerMeterRate').value : '',    // #293: new customers start as Active (manual status) unless the owner picks Offline / Not set.
    serviceStatus:$('#newCustomerServiceStatus')?.value || 'not-set',
    nameUrdu:$('#newCustomerNameUrdu') ? $('#newCustomerNameUrdu').value.trim() : '',
    // SISP-40: hamsaya referral link (optional existing-customer id).
    referredByCustomerId:$('#newCustomerReferredBy') ? $('#newCustomerReferredBy').value : ''
  };
  const nameValidation = validateCustomerName(details.name);
  if (!nameValidation.valid) {
    const errorBox = $('#addCustomerError');
    errorBox.textContent = nameValidation.message;
    errorBox.hidden = false;
    $('#newCustomerName').focus();
    return;
  }
  details.name = nameValidation.cleanName;
  if (details.phone) {
    const phoneVal = validatePakistanPhone(details.phone);
    if (!phoneVal.valid && !phoneVal.tip) {
      const errorBox = $('#addCustomerError');
      errorBox.textContent = phoneVal.message || 'Please enter a valid Pakistani phone number (e.g. 03001234567 or +923001234567).';
      errorBox.hidden = false;
      $('#newCustomerPhone').focus();
      return;
    }
  }
  if (details.cnic) {
    const cnicVal = validateCustomerCnic(details.cnic);
    if (!cnicVal.valid) {
      const errorBox = $('#addCustomerError');
      errorBox.textContent = cnicVal.message || 'Please enter a valid 13-digit Pakistani CNIC (e.g. 35201-1234567-1).';
      errorBox.hidden = false;
      $('#newCustomerCnic').focus();
      return;
    }
    details.cnic = cnicVal.formatted;
  }
  try {
    const matches = findPossibleDuplicateCustomers(state.customers, details);
    if (matches.length && !allowDuplicateName) {
      renderDuplicateReview(matches);
      return;
    }
    state = addCustomer(state, details.name, new Date(), { ...details, allowDuplicateName });
    // OWNER-SIGNAL: an RX reading typed on the add form is the install
    // measurement — journal it as the customer's first history entry.
    const justAdded = state.customers.at(-1);
    if (justAdded && justAdded.lastRxDbm !== null && justAdded.lastRxDbm !== undefined) {
      state.customers[state.customers.length - 1] = appendSignalReading(justAdded, { dbm: justAdded.lastRxDbm, source: 'install' });
    }
    $('#globalCustomerSearch').value = '';
    save();
    const addedCustomer = state.customers.at(-1);
    customerDraftController?.clear();
    const customerNotice = $('#newCustomerDraftNotice');
    if (customerNotice) customerNotice.hidden = true;
    $('#addCustomerDialog').close();
    selectCustomer(addedCustomer.id);
    toast(`Customer #${addedCustomer.customerNumber} added as a separate record.`);
  } catch (error) {
    resetDuplicateReview();
    const errorBox = $('#addCustomerError'); errorBox.textContent = error.message; errorBox.hidden = false;
  }
}
$('#addCustomerButton').addEventListener('click', () => {
  if (customerDraftController?.getDraft()) {
    customerDraftController.restore();
    const customerNotice = $('#newCustomerDraftNotice');
    if (customerNotice) customerNotice.hidden = false;
  } else {
    $('#addCustomerForm').reset();
    const customerNotice = $('#newCustomerDraftNotice');
    if (customerNotice) customerNotice.hidden = true;
  }
  $('#addCustomerError').hidden = true;
  resetDuplicateReview();
  populateReferrerOptions();
  $('#addCustomerDialog').showModal();
  $('#newCustomerName').focus();
});
$('#addCustomerForm').addEventListener('submit', event => { event.preventDefault(); saveNewCustomer(false); });
$('#continueNewCustomerAnyway').addEventListener('click', () => saveNewCustomer(true));
$('#editNewCustomerDetails').addEventListener('click', () => {
  resetDuplicateReview();
  $('#newCustomerName').focus();
});
$('#duplicateCustomerMatches').addEventListener('click', event => {
  const button = event.target.closest('[data-open-duplicate-customer]');
  if (!button) return;
  const customerId = button.dataset.openDuplicateCustomer;
  if (!state.customers.some(customer => customer.id === customerId)) return;
  $('#addCustomerDialog').close();
  selectCustomer(customerId);
});
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => $('#addCustomerDialog').close()));
$('#addCustomerDialog')?.addEventListener('click', (e) => {
  if (e.target === $('#addCustomerDialog')) $('#addCustomerDialog').close();
});
// Owner feature (2026-10-29): Manual Baqaya dialog wiring. Core
// mutations enforce the guards (FREE/archived/settled-entry locks);
// the dialog just collects amount + date + optional note and reports.
document.querySelectorAll('#manualBaqayaDialog [data-close-dialog]').forEach(button => button.addEventListener('click', () => $('#manualBaqayaDialog').close()));
$('#manualBaqayaDialog')?.addEventListener('click', (e) => {
  if (e.target === $('#manualBaqayaDialog')) $('#manualBaqayaDialog').close();
});
$('#manualBaqayaForm').addEventListener('submit', event => {
  event.preventDefault();
  const customerId = manualBaqayaDialogCustomerId;
  if (!customerId) return;
  const entryId = $('#manualBaqayaEntryId').value || null;
  const fields = {
    amount: Number($('#manualBaqayaAmount').value),
    date: $('#manualBaqayaDate').value,
    note: $('#manualBaqayaNote').value
  };
  try {
    state = entryId
      ? updateManualBaqayaEntry(state, customerId, entryId, fields)
      : addManualBaqayaEntry(state, customerId, fields);
    save();
    $('#manualBaqayaDialog').close();
    toast(t('baqaya_saved'));
    renderDetail();
    renderCustomers();
  } catch (error) {
    toast(error.message, { type: 'error' });
  }
});
$('#saveMohallaButton').addEventListener('click', async () => {
  if (!selectedCustomer()) return;
  const current = selectedCustomer();
  const phoneVal = $('#phoneInput').value.trim();
  const cnicVal = $('#cnicInput') ? $('#cnicInput').value.trim() : '';

  if (phoneVal) {
    const checkPhone = validatePakistanPhone(phoneVal);
    if (!checkPhone.valid && !checkPhone.tip) {
      toast(checkPhone.message || 'Invalid Pakistani phone number.');
      $('#phoneInput').focus();
      return;
    }
  }

  let formattedCnic = cnicVal;
  if (cnicVal) {
    const checkCnic = validateCustomerCnic(cnicVal);
    if (!checkCnic.valid) {
      toast(checkCnic.message || 'Invalid CNIC (13 digits required).');
      $('#cnicInput').focus();
      return;
    }
    formattedCnic = checkCnic.formatted;
  }

  if (phoneVal || formattedCnic) {
    const matches = findPossibleDuplicateCustomers(state.customers, {
      customerId: current.id,
      phone: phoneVal,
      cnic: formattedCnic
    });
    const exactDuplicates = matches.filter(m => m.reasons.some(r => (r.field === 'phone' || r.field === 'cnic') && r.type === 'exact'));
    if (exactDuplicates.length > 0) {
      const dup = exactDuplicates[0];
      const reasonLabel = dup.reasons.find(r => (r.field === 'cnic' || r.field === 'phone') && r.type === 'exact')?.label || 'matches another customer';
      const confirmed = await appConfirm({ tone:'warning', title:'Possible duplicate customer', subject:`#${dup.customer.customerNumber} ${dup.customer.name}`, message:`This ${reasonLabel} matches that existing customer. Save anyway?`, confirmLabel:'Save anyway' });
      if (!confirmed) return;
    }
  }

  // SISP-74: warn before saving when a NEWLY assigned MAC address or
  // hardware serial already belongs to another active customer (core
  // hard-blocks duplicate PPPoE usernames / static IPs inside
  // updateCustomerProfile; MAC / serial are operator's choice — the save
  // proceeds only on an explicit "Save anyway").
  const identityWarnings = findIdentityConflicts(state.customers, {
    pppoeUsername: $('#pppoeUsernameInput') ? $('#pppoeUsernameInput').value : (current.pppoeUsername ?? ''),
    staticIp: $('#staticIpInput') ? $('#staticIpInput').value : (current.staticIp ?? ''),
    macAddress: $('#macAddressInput') ? $('#macAddressInput').value : (current.macAddress ?? ''),
    serialNumber: $('#serialNumberInput') ? $('#serialNumberInput').value : (current.serialNumber ?? '')
  }, { excludeCustomerId: current.id, previous: current }).filter(conflict => conflict.severity === 'warn');
  if (identityWarnings.length) {
    const conflict = identityWarnings[0];
    const confirmed = await appConfirm({ tone:'warning', title: t('idguard_warn_title'), subject: `#${conflict.customerNumber} ${conflict.customerName}`, message: t('idguard_warn_message', null, { label: conflict.label, value: conflict.value }), confirmLabel: t('idguard_save_anyway'), cancelLabel: t('idguard_cancel') });
    if (!confirmed) return;
  }

  const currentCustomer = selectedCustomer();
  const oldRate = Number(currentCustomer?.monthlySellingAmount) || 0;
  const newRate = Number($('#monthlySellingAmountInput').value) || 0;
  const oldPlan = currentCustomer?.packageSpeed || '';
  const newPlan = $('#packageSpeedInput').value || '';
  const planChanged = Boolean(oldPlan && newPlan && oldPlan !== newPlan);
  const rateChanged = Boolean(oldRate > 0 && newRate > 0 && oldRate !== newRate);

  let proRataAdjustment = null;
  let proRatedBillAmount = null;
  let voucherId = null;

  if ((planChanged || rateChanged) && oldRate > 0 && newRate > 0) {
    const today = new Date();
    const todayStr = dateKey(today);
    const proration = calculatePlanMigrationProration(oldRate, newRate, todayStr);
    proRataAdjustment = proration.netAdjustment;
    proRatedBillAmount = proration.proRatedCurrentBill;

    const shouldSaveVoucher = $('#saveProrataVoucherCheckbox')?.checked ?? true;
    if (shouldSaveVoucher && proration.netAdjustment !== 0) {
      try {
        const store = typeof localStorage !== 'undefined' ? localStorage : null;
        const adjVoucher = buildAdjustmentVoucherData({
          customer: currentCustomer,
          category: 'prorated_package_change',
          amount: Math.abs(proration.netAdjustment),
          reason: `Mid-cycle package transition: ${oldPlan} (PKR ${oldRate}) → ${newPlan} (PKR ${newRate}). Pro-rated current-bill: PKR ${proration.proRatedCurrentBill.toLocaleString()} (Day ${proration.effectiveDay}/${proration.daysInMonth}).`,
          authorizedBy: $('#packageChangeStaffNameInput').value || 'Staff Operator',
          date: todayStr
        });
        saveAdjustmentVoucher(store, adjVoucher);
        voucherId = adjVoucher.voucherNumber || adjVoucher.id;
      } catch (e) {
        console.error('Failed to save adjustment voucher:', e);
      }
    }
  }

  try {
    state = updateCustomerProfile(state, selectedCustomerId, {
      ...($('#profileNameInput') ? { name: $('#profileNameInput').value } : {}),
      ...($('#nameUrduInput') ? { nameUrdu: $('#nameUrduInput').value } : {}),
      mohalla:$('#mohallaInput').value, zone:$('#zoneInput').value, address:$('#addressInput').value, notes:$('#customerNotesInput').value, phone:phoneVal,
      cnic: formattedCnic,
      ispProvider:$('#ispProviderInput').value,
      serviceStatus:$('#serviceStatusInput').value,
      // SISP-84: connection type (residential / commercial_vip SLA tag).
      ...($('#connectionTypeInput') ? { connectionType: $('#connectionTypeInput').value } : {}),
      packageSpeed:$('#packageSpeedInput').value, monthlyPurchaseCost:$('#monthlyPurchaseCostInput').value,
      monthlySellingAmount:$('#monthlySellingAmountInput').value, connectionDate:$('#connectionDateInput').value,
      connectionFee:$('#connectionFeeInput').value, routerModel:$('#routerModelInput').value,
      routerPrice:$('#routerPriceInput').value, fiberMeters:$('#fiberMetersInput').value,
      // SISP-24: optical splitter assignment + last RX reading (optional).
      splitterBoxId:$('#splitterBoxIdInput').value, splitterPort:$('#splitterPortInput').value,
      oltPonPort:$('#oltPonPortInput').value, lastRxDbm:$('#lastRxDbmInput').value,
      // SISP-32: pole & landmark directory (optional).
      ...($('#poleNumberInput') ? { poleNumber: $('#poleNumberInput').value } : {}),
      ...($('#boxLocationNoteInput') ? { boxLocationNote: $('#boxLocationNoteInput').value } : {}),
      ...($('#dropWireCoreColorInput') ? { dropWireCoreColor: $('#dropWireCoreColorInput').value } : {}),
      ...($('#mediaConverterCostInput') ? { mediaConverterCost: $('#mediaConverterCostInput').value } : {}),
      ...($('#linemanInstallFeeInput') ? { linemanInstallFee: $('#linemanInstallFeeInput').value } : {}),
      ...($('#fiberPerMeterRateInput') ? { fiberPerMeterRate: $('#fiberPerMeterRateInput').value } : {}),      upstreamCustomerId:$('#upstreamCustomerInput') ? $('#upstreamCustomerInput').value : '',
      fiberZone:$('#fiberZoneInput') ? $('#fiberZoneInput').value : '',
      ...($('#pppoeUsernameInput') ? { pppoeUsername: $('#pppoeUsernameInput').value } : {}),
      ...($('#pppoePasswordInput') ? { pppoePassword: $('#pppoePasswordInput').value } : {}),
      ...($('#staticIpInput') ? { staticIp: $('#staticIpInput').value } : {}),
      ...($('#macAddressInput') ? { macAddress: $('#macAddressInput').value } : {}),
      // SISP-94: router credential vault fields.
      ...($('#wifiSsidInput') ? { wifiSsid: $('#wifiSsidInput').value } : {}),
      ...($('#wifiPasswordInput') ? { wifiPassword: $('#wifiPasswordInput').value } : {}),
      ...($('#routerAdminPortInput') ? { routerAdminPort: $('#routerAdminPortInput').value } : {}),
      ...($('#routerAdminPasswordInput') ? { routerAdminPassword: $('#routerAdminPasswordInput').value } : {}),
      // SISP-19: custody fields (recovery dates are never saved from here).
      routerOwnership:$('#routerOwnershipInput')?.value ?? '', mediaConverterOwnership:$('#mediaConverterOwnershipInput')?.value ?? '',
      serialNumber:$('#serialNumberInput')?.value ?? '', securityDeposit:$('#securityDepositInput')?.value ?? '',
      expiryDate:$('#expiryDateInput').value, cancellationDate:$('#cancellationDateInput').value,
      // SISP-8: vacation hold (validation errors surface as a toast).
      paused: $('#pauseBillingCheckbox')?.checked === true,
      // SISP-76: SMS-first contact preference.
      prefersSms: $('#prefersSmsCheckbox')?.checked === true,
      // SISP-91: receipt language/channel preferences. Setting an
      // explicit channel here syncs prefersSms in core (channel 'sms'
      // -> true, any other channel -> false); '' clears the channel.
      preferredReceiptLang: $('#preferredReceiptLangSelect')?.value || '',
      preferredReceiptChannel: $('#preferredReceiptChannelSelect')?.value || '',
      pauseStartDate: $('#pauseStartDateInput')?.value || '',
      autoResumeDate: $('#autoResumeDateInput')?.value || '',
      packageChangeStaffName:$('#packageChangeStaffNameInput').value,
      proRataAdjustment, proRatedBillAmount, voucherId
    });
    // OWNER-SIGNAL: a CHANGED Last RX value saved from this form is a
    // fresh manual measurement — journal it into the signal history so
    // lastRxDbm and the history can never disagree. Re-saving the same
    // value journals nothing, and clearing the field journals nothing
    // (an erased value is not a measurement).
    const previousRxDbm = currentCustomer?.lastRxDbm ?? null;
    const savedCustomer = state.customers.find(c => c.id === selectedCustomerId);
    const rxChanged = savedCustomer && savedCustomer.lastRxDbm !== null && savedCustomer.lastRxDbm !== undefined
      && (previousRxDbm === null || Number(savedCustomer.lastRxDbm) !== Number(previousRxDbm));
    if (rxChanged) {
      const savedIdx = state.customers.findIndex(c => c.id === selectedCustomerId);
      if (savedIdx >= 0) state.customers[savedIdx] = appendSignalReading(savedCustomer, { dbm: savedCustomer.lastRxDbm, source: 'manual' });
    }
    profileEditMode = false;
    save(); renderDetail();
    if (splitterMapModalController) splitterMapModalController.refresh();
    if (proRataAdjustment !== null) {
      toast(`Customer profile and mid-month pro-rata adjustment (PKR ${proRataAdjustment >= 0 ? '+' : ''}${proRataAdjustment.toLocaleString()}) saved.`);
    } else {
      toast('Customer profile saved on this device.');
    }
  } catch (error) { toast(error.message); }
});
$('#cancelProfileEditButton').addEventListener('click', () => { profileEditMode = false; renderDetail(); });
$('#monthlyPurchaseCostInput').addEventListener('input', renderProfileMarginPreview);
$('#monthlySellingAmountInput').addEventListener('input', () => {
  renderProfileMarginPreview();
  renderProfileProrataPreview();
});
$('#packageSpeedInput').addEventListener('input', renderProfileProrataPreview);
$('#packageSpeedInput').addEventListener('change', renderProfileProrataPreview);

function renderProfileProrataPreview() {
  const customer = selectedCustomer();
  const container = $('#packageChangeProrataPreview');
  if (!container) return;
  if (!customer) {
    container.hidden = true;
    return;
  }
  const currentPlan = customer.packageSpeed || '';
  const currentRate = Number(customer.monthlySellingAmount) || 0;
  const newPlan = $('#packageSpeedInput')?.value?.trim() || '';
  const newRate = Number($('#monthlySellingAmountInput')?.value) || 0;

  const planChanged = Boolean(currentPlan && newPlan && currentPlan !== newPlan);
  const rateChanged = Boolean(currentRate > 0 && newRate > 0 && currentRate !== newRate);

  if ((planChanged || rateChanged) && currentRate > 0 && newRate > 0) {
    const today = new Date();
    const todayStr = dateKey(today);
    const proration = calculatePlanMigrationProration(currentRate, newRate, todayStr);

    container.hidden = false;
    const badge = $('#prorataPreviewDeltaBadge');
    if (badge) {
      const isUp = proration.netAdjustment > 0;
      badge.textContent = t('prof_prorata_badge', null, { adj: `${proration.netAdjustment > 0 ? '+' : ''}PKR ${proration.netAdjustment.toLocaleString()}`, direction: isUp ? t('prof_prorata_up') : (proration.netAdjustment < 0 ? t('prof_prorata_down') : t('prof_prorata_lateral')) });
      badge.className = `sim-delta-badge ${isUp ? 'badge-success' : (proration.netAdjustment < 0 ? 'badge-warning' : 'badge-info')}`;
    }
    const breakdown = $('#prorataPreviewDaysBreakdown');
    if (breakdown) {
      breakdown.innerHTML = `
        <span>${t('prof_prorata_days', null, { day: proration.effectiveDay, total: proration.daysInMonth, elapsed: proration.daysElapsed, oldAmount: (proration.oldPlanCostElapsed || (currentRate - proration.oldPlanCredit)).toLocaleString(), remaining: proration.daysRemaining, newAmount: proration.newPlanCharge.toLocaleString() })}</span>
      `;
    }
    const calcBill = $('#prorataCalculatedBill');
    if (calcBill) {
      calcBill.textContent = `PKR ${proration.proRatedCurrentBill.toLocaleString()}`;
    }
    const netAdj = $('#prorataNetAdjustment');
    if (netAdj) {
      const sign = proration.netAdjustment > 0 ? '+' : '';
      netAdj.textContent = `${sign}PKR ${proration.netAdjustment.toLocaleString()}`;
      netAdj.style.color = proration.netAdjustment > 0 ? '#b91c1c' : (proration.netAdjustment < 0 ? '#047857' : 'inherit');
    }
  } else {
    container.hidden = true;
  }
}
async function restoreCustomer(customerId) {
  try {
    state = unarchiveCustomer(state, customerId, new Date());
    save();
    // SISP-64 reconnection guard: if this customer still carries an
    // active bad-debt write-off, offer the one-shot restore of the
    // written-off balance into active arrears. Declining keeps the
    // write-off in place (it can still be restored on a later
    // unarchive only while it stays active — the register entry is
    // never silently dropped).
    const badDebtEntries = loadBadDebts();
    const activeEntry = activeBadDebtFor(badDebtEntries, customerId);
    if (activeEntry) {
      const restoredCustomer = state.customers.find(c => c.id === customerId);
      const confirmed = await appConfirm({ tone: 'warning', title: t('bd_restore_title'), subject: `${formatAmount(activeEntry.amount)} · #${activeEntry.customerNumber ?? restoredCustomer?.customerNumber ?? ''} ${restoredCustomer?.name ?? ''}`, message: t('bd_restore_msg', null, { amount: formatAmount(activeEntry.amount), date: activeEntry.writeOffDate }), confirmLabel: t('bd_restore_btn') });
      if (confirmed && restoredCustomer) {
        try {
          const restored = restoreBadDebt(badDebtEntries, restoredCustomer, { date: getTodayDateString() });
          saveBadDebts(restored.entries);
          state = { ...state, customers: state.customers.map(c => c.id === customerId ? restored.customer : c) };
          save();
          toast(t('bd_toast_restored', null, { amount: formatAmount(restored.restoredAmount) }));
        } catch (err) { toast(err?.message || 'Could not restore the written-off balance.'); }
      }
    }
    if (selectedCustomerId === customerId) renderDetail();
    toast('Customer unarchived. Billing resumes from the current or next eligible month; archived months are not backfilled.');
  } catch (error) { toast(error.message); }
}
function archiveSelectedCustomer(customer) {
  try {
    state = archiveCustomer(state, customer.id, new Date()); save(); renderDetail();
    toast('Customer archived. Existing history remains available.', { type:'success', title:`#${customer.customerNumber} ${customer.name} archived`, actionLabel:'Undo', onAction: () => restoreCustomer(customer.id) });
    // SISP-19: archiving IS disconnection — surface the recovery list
    // immediately when ISP-owned hardware is now pending.
    const archived = state.customers.find(c => c.id === customer.id);
    const pendingCount = archived ? pendingHardwareRecovery([archived]).reduce((sum, entry) => sum + entry.items.length, 0) : 0;
    if (pendingCount > 0) toast(`${pendingCount} ISP-owned item${pendingCount === 1 ? '' : 's'} pending hardware recovery — see Pending Hardware Recovery.`);
  }
  catch (error) { toast(error.message); }
}
$('#archiveCustomerButton').addEventListener('click', async () => {
  const customer = selectedCustomer();
  if (!customer || !(await appConfirm({ tone:'warning', icon:'🗄', title:'Archive this customer?', subject:`#${customer.customerNumber} ${customer.name}`, message:'Existing bills, receipts, complaints, customer number and unused credit stay on this device; no new monthly bills will be generated while archived.', confirmLabel:'Archive' }))) return;
  archiveSelectedCustomer(customer);
});
$('#unarchiveCustomerButton').addEventListener('click', () => { const customer = selectedCustomer(); if (customer) restoreCustomer(customer.id); });

// Inline customer rename (profile header): Edit name swaps the heading for
// an input with Save name / Cancel; the change goes through
// updateCustomerProfile so validation and persistence match the profile form.
function closeCustomerNameEditor(focusEditButton = false) {
  const editor = $('#customerNameEditor');
  if (editor) editor.hidden = true;
  const editBtn = $('#editCustomerNameBtn');
  if (editBtn) editBtn.hidden = false;
  const error = $('#customerNameEditError');
  if (error) { error.hidden = true; error.textContent = ''; }
  if (focusEditButton) editBtn?.focus();
}
$('#editCustomerNameBtn')?.addEventListener('click', () => {
  const customer = selectedCustomer();
  if (!customer) return;
  const editor = $('#customerNameEditor');
  const input = $('#customerNameInput');
  if (!editor || !input) return;
  input.value = customer.name ?? '';
  editor.hidden = false;
  $('#editCustomerNameBtn').hidden = true;
  const error = $('#customerNameEditError');
  if (error) { error.hidden = true; error.textContent = ''; }
  input.focus();
  input.select();
});
$('#cancelCustomerNameBtn')?.addEventListener('click', () => closeCustomerNameEditor(true));
$('#customerNameInput')?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); $('#saveCustomerNameBtn')?.click(); }
  if (event.key === 'Escape') { event.preventDefault(); closeCustomerNameEditor(true); }
});
$('#saveCustomerNameBtn')?.addEventListener('click', () => {
  const customer = selectedCustomer();
  const input = $('#customerNameInput');
  if (!customer || !input) return;
  const newName = input.value.trim();
  const error = $('#customerNameEditError');
  const showError = (message) => {
    if (error) { error.textContent = message; error.hidden = false; }
    input.focus();
  };
  if (!newName) { showError(t('prof_name_empty')); return; }
  if (newName === customer.name) { closeCustomerNameEditor(); return; }
  try {
    state = updateCustomerProfile(state, customer.id, { name: newName });
    save();
    closeCustomerNameEditor();
    renderDetail();
    renderCustomers();
    toast(`Customer name updated to “${newName}”.`);
  } catch (err) {
    showError(err?.message || t('prof_name_save_fail'));
  }
});
$('#deleteCustomerButton').addEventListener('click', async () => {
  const customer = selectedCustomer();
  if (!customer) return;
  const choice = await appConfirm({ tone:'danger', title:'Delete this customer?', subject:`#${customer.customerNumber} ${customer.name}`, message:'All bills, receipts, unused prepaid credit, contact/package data and complaint history are removed from this device. You can undo for a few seconds; after that, restore the safety snapshot saved just before deleting (in the backup controls), or a JSON backup. Archive keeps the history instead.', confirmLabel:'Delete customer', altLabel: customer.archived ? '' : 'Archive instead' });
  if (choice === 'alt') { archiveSelectedCustomer(customer); return; }
  if (choice !== 'confirm' || selectedCustomer()?.id !== customer.id) return;
  await snapshotBeforeDestructiveAction();
  // Soft delete for the undo window: keep the exact record and its position so Undo restores it as it was.
  const index = state.customers.findIndex(item => item.id === customer.id);
  const removed = state.customers[index];
  state = deleteCustomer(state, customer.id); selectedCustomerId = null; appShell.classList.remove('show-detail'); save(); renderDetail();
  toast('Customer deleted from this device.', { type:'success', title:`#${customer.customerNumber} ${customer.name} deleted`, duration:5000, actionLabel:'Undo', onAction: () => {
    if (state.customers.some(item => item.id === removed.id)) return;
    const customers = [...state.customers];
    customers.splice(Math.min(index, customers.length), 0, removed);
    state = { ...state, customers };
    save();
    selectCustomer(removed.id);
    toast(`#${removed.customerNumber} ${removed.name} restored with all bills and payments.`, { type:'success', title:'Delete undone' });
  } });
});
$('#uptimeMonthSelect')?.addEventListener('change', (event) => {
  selectedUptimeMonth = event.target.value;
  const customer = selectedCustomer();
  if (customer) renderUptimePanel(customer);
});
$('#addIncidentButton')?.addEventListener('click', () => showIncidentEditor());
$('#incidentForm')?.addEventListener('submit', onIncidentSubmit);
$('#cancelIncidentEditButton')?.addEventListener('click', () => { closeIncidentEditor(); renderDetail(); });
$('#customerExportButton').addEventListener('click', () => { const customer = selectedCustomer(); if (customer) downloadTxt(`customer-${customer.customerNumber}-billing-history.txt`, exportCustomerHistory(state, customer.id)); });
$('#exportAllButton').addEventListener('click', () => downloadTxt('shahdara-isp-payment-details.txt', exportAllPayments(state)));
$('#backButton').addEventListener('click', () => {
  appShell.classList.remove('show-detail');
  if (typeof window !== 'undefined' && window.location && window.location.hash.startsWith('#customer')) {
    try {
      history.pushState({ view: 'customers' }, '', '#customers');
    } catch {
      window.location.hash = '#customers';
    }
  }
  const selectedBtn = selectedCustomerId ? document.querySelector(`[data-customer-id="${CSS.escape(selectedCustomerId)}"]`) : null;
  if (selectedBtn) selectedBtn.focus?.();
});
window.addEventListener('resize', () => { if (window.innerWidth > 620) appShell.classList.remove('show-detail'); });
window.addEventListener('focus', () => { checkMonthlyBilling(); void checkAutomaticBackup(); });
window.addEventListener('pageshow', () => { checkMonthlyBilling(); void checkAutomaticBackup(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkMonthlyBilling(); void checkAutomaticBackup(); } });
window.setInterval(checkMonthlyBilling, 60_000);
// Live status-session counters: ONE shared per-minute ticker for the
// whole app (the customers list and the profile are shown/hidden, not
// unmounted, so a per-view interval would only multiply timers). It
// pauses while the tab is hidden and rewrites only the counter
// nodes' text — never a list re-render.
function tickLiveSessionCounters() {
  if (typeof document === 'undefined' || document.hidden) return;
  refreshLiveSessionCounters(document, {
    getCustomer: id => state.customers.find(customer => customer.id === id),
    formatText: customer => liveSessionText(customer)
  });
}
window.setInterval(tickLiveSessionCounters, 60_000);

populateReportMonths();
renderStorageWarning();
renderDashboard();
renderGlobalSearch();
renderCustomers();
renderTransactions();
renderMonthlyReport();
renderDetail();
if (!storageAvailable) toast('Browser storage is unavailable. Entries may not persist.');
void checkAutomaticBackup();

function initTheme() {
  const toggles = document.querySelectorAll('#themeToggle, #drawerThemeToggleBtn, .theme-toggle');
  if (!toggles.length) return;
  const getTheme = () => document.documentElement.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('shahdara_theme', theme); } catch {}
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0c1412' : '#0e5b4d');
    toggles.forEach(toggle => {
      toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      toggle.setAttribute('title', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    });
  };
  toggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const next = getTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  });
  applyTheme(getTheme());
}
initTheme();

navDrawer = setupNavigationDrawer({
  onNavigate: target => {
    if (target === 'home') {
      window.screenRouter?.go('home');
    } else if (target === 'bills') {
      window.screenRouter?.go('bills');
    } else if (target === 'backup' || target === 'settings') {
      window.screenRouter?.go('backup');
    } else if (target === 'field-tools' || target === 'tools') {
      window.screenRouter?.go('field-tools');
    } else if (target === 'assistant') {
      window.screenRouter?.go('assistant');
    } else if (target === 'alerts') {
      window.screenRouter?.go('alerts');
    } else if (target === 'recovery') {
      window.screenRouter?.go('recovery');
    } else if (['customers', 'transactions', 'reports', 'analytics', 'inventory', 'expenses', 'homeBudget', 'loans', 'waTemplates'].includes(target)) {
      switchView(target);
      if (target === 'transactions') renderTransactions();
      else if (target === 'reports') renderMonthlyReport();
      else if (target === 'analytics') renderAnalytics();
      else if (target === 'inventory') renderInventory();
      else if (target === 'expenses') renderExpenses();
      else if (target === 'homeBudget') renderHomeBudget();
      else if (target === 'loans') renderLoans();
      else if (target === 'waTemplates') renderWaTemplates();
      else if (target === 'customers') renderCustomers();
    }
  },
  onBackup: () => {
    window.screenRouter?.go('backup');
  }
});

setupSidebarRailToggle();
setupScrollToTop();
updateNavigationBadges(state);
setupNetworkStatusIndicator({ onToast: toast });
setupKeyboardShortcuts({
  onNavigate: target => {
    if (['customers', 'transactions', 'reports', 'analytics', 'inventory', 'expenses', 'homeBudget', 'loans', 'waTemplates'].includes(target)) {
      switchView(target);
      if (target === 'transactions') renderTransactions();
      else if (target === 'reports') renderMonthlyReport();
      else if (target === 'analytics') renderAnalytics();
      else if (target === 'inventory') renderInventory();
      else if (target === 'expenses') renderExpenses();
      else if (target === 'homeBudget') renderHomeBudget();
      else if (target === 'loans') renderLoans();
      else if (target === 'waTemplates') renderWaTemplates();
      else if (target === 'customers') renderCustomers();
    } else if (target === 'backup') {
      const toggle = $('#backupControlsToggle');
      if (toggle) toggle.click();
      const panel = $('#backupControls');
      if (panel && !panel.hidden) panel.scrollIntoView({ behavior: 'smooth' });
    }
  },
  onToggleTheme: () => {
    $('#themeToggle')?.click();
  },
  onToggleDrawer: () => {
    $('#navDrawerToggle')?.click();
  },
  onToggleRail: () => {
    $('#sidebarRailToggle')?.click();
  },
  onSearchFocus: () => {
    const s = $('#globalCustomerSearch');
    if (s) {
      s.focus();
      s.select?.();
    }
  },
  onQuickCollect: () => {
    window.quickCollectModalController?.open();
  },
  onFastSearch: () => {
    window.fastCustomerSearchController?.open();
  },
  onPendingActions: () => {
    window.pendingActionsController?.open();
  },
  onCollectionRounds: () => {
    $('#quickActionTileRounds')?.click();
  },
  onToggleLanguage: () => {
    $('#languageToggleBtn')?.click();
  },
  onTopDefaulters: () => {
    $('#quickActionTopDefaulters')?.click();
  },
  onToast: toast
});
mobileActionSheetController = setupMobileActionSheet({
  onAction: (action, context) => {
    if (action === 'customer-payment') {
      if (context && context.customerId) selectCustomer(context.customerId);
      openAddPayment(context?.customerId || null); // #300
    } else if (action === 'customer-whatsapp') {
      if (context && context.customerId) {
        selectCustomer(context.customerId);
      }
      $('#detailWhatsAppReminder')?.click();
    } else if (action === 'customer-receipt') {
      if (context && context.customerId) {
        selectCustomer(context.customerId);
      }
      const pdfBtn = $('#downloadInvoicePdfBtn') || $('#printInvoiceBtn');
      if (pdfBtn) pdfBtn.click();
    } else if (action === 'add-payment') {
      const btn = $('#quickAddPaymentButton') || $('#quickActionReceivePayment');
      if (btn) btn.click();
    } else if (action === 'add-customer') {
      const btn = $('#quickActionAddCustomer') || $('#addCustomerButton');
      if (btn) btn.click();
    } else if (action === 'field-enrollment') {
      customerEnrollmentWizard?.open();
    } else if (action === 'field-diagnostics') {
      fieldDiagnosticsModalController?.open();
    } else if (action === 'field-route') {
      fieldRouteSheetController?.open();
    } else if (action === 'work-orders') {
      fieldWorkOrderSheetController?.open();
    } else if (action === 'record-expense') {
      switchView('expenses');
      renderExpenses();
      $('#expenseAmount')?.focus();
    } else if (action === 'stock-movement') {
      switchView('inventory');
      renderInventory();
      $('#movementItemId')?.focus();
    } else if (action === 'toggle-theme') {
      $('#themeToggle')?.click();
    } else if (action === 'keyboard-help') {
      $('#shortcutsHelpButton')?.click();
    } else if (action === 'command-palette') {
      $('#commandPaletteTrigger')?.click();
    } else if (action === 'opm-tester') {
      mobileOpmTestingModalController?.open();
    } else if (action === 'vfl-tracer') {
      mobileVflModalController?.open();
    } else if (action === 'fiber-probe') {
      mobileFiberProbeModalController?.open();
    } else if (action === 'splitter-tree') {
      mobileSplitterTreeModalController?.open();
    } else if (action === 'macro-bend') {
      mobileMacroBendModalController?.open();
    } else if (action === 'optical-attenuator' || action === 'attenuator') {
      mobileAttenuatorModalController?.open();
    } else if (action === 'optical-return-loss' || action === 'orl') {
      mobileOrlModalController?.open();
    }
  },
  onToast: toast
});

const commandPalette = setupCommandPalette({
  onNavigate: target => {
    if (['customers', 'transactions', 'reports', 'analytics', 'inventory', 'expenses', 'homeBudget', 'loans', 'waTemplates'].includes(target)) {
      switchView(target);
      if (target === 'transactions') renderTransactions();
      else if (target === 'reports') renderMonthlyReport();
      else if (target === 'analytics') renderAnalytics();
      else if (target === 'inventory') renderInventory();
      else if (target === 'expenses') renderExpenses();
      else if (target === 'homeBudget') renderHomeBudget();
      else if (target === 'loans') renderLoans();
      else if (target === 'waTemplates') renderWaTemplates();
      else if (target === 'customers') renderCustomers();
    } else if (target === 'dashboard') {
      switchView('customers');
      renderCustomers();
      const db = $('#billingDashboard');
      if (db) db.scrollIntoView({ behavior: 'smooth' });
    }
  },
  onAction: action => {
    if (action === 'add-payment') {
      const btn = $('#quickAddPaymentButton') || $('#quickActionReceivePayment');
      if (btn) btn.click();
    } else if (action === 'add-customer') {
      const btn = $('#quickActionAddCustomer') || $('#addCustomerButton');
      if (btn) btn.click();
    } else if (action === 'add-expense') {
      switchView('expenses');
      renderExpenses();
      $('#expenseAmount')?.focus();
    }
  },
  onToggleTheme: () => {
    $('#themeToggle')?.click();
  },
  onToggleRail: () => {
    $('#sidebarRailToggle')?.click();
  },
  getState: () => state,
  onSelectCustomer: customer => {
    if (customer && customer.id) {
      switchView('customers');
      renderCustomers();
      selectCustomer(customer.id);
    }
  }
});

const drawerPaletteBtn = $('#navDrawerCommandPaletteBtn');
if (drawerPaletteBtn) {
  drawerPaletteBtn.addEventListener('click', () => {
    const drawer = $('#navDrawer');
    const backdrop = $('#navDrawerBackdrop');
    if (drawer) drawer.classList.remove('is-open');
    if (backdrop) backdrop.classList.remove('is-open');
    document.body?.classList?.remove('drawer-open');
    commandPalette.open();
  });
}

setupPullToRefresh({
  containerSelector: '#customerPane',
  indicatorSelector: '#pullToRefreshIndicator',
  onRefresh: async () => {
    // Re-render ONLY — a pull refresh saves nothing, so it stays silent.
    // This callback used to toast a "ledger updated" message (which the
    // toast system titles 'Saved'), and because #customerPane itself never
    // scrolls — the inner .customer-list scrolls on desktop, the window on
    // mobile — the handler's scrollTop guard never tripped, so ordinary
    // downward drags (scrolling back to the top, overscroll) kept firing a
    // false "Saved" toast during plain browsing (owner report 2026-10-30).
    // The indicator text + haptic remain the gesture's feedback.
    renderCustomers();
    renderDashboard();
  }
});

setupSwipeNavigation({
  container: document.getElementById('main') || document.body,
  views: ['customers', 'transactions', 'reports', 'analytics', 'inventory', 'expenses', 'homeBudget', 'loans', 'waTemplates'],
  onNavigate: (target) => {
    switchView(target);
    if (target === 'transactions') renderTransactions();
    else if (target === 'reports') renderMonthlyReport();
    else if (target === 'analytics') renderAnalytics();
    else if (target === 'inventory') renderInventory();
    else if (target === 'expenses') renderExpenses();
    else if (target === 'homeBudget') renderHomeBudget();
    else if (target === 'loans') renderLoans();
      else if (target === 'waTemplates') renderWaTemplates();
    else if (target === 'customers') renderCustomers();
  }
});

// Mobile bottom nav haptic feedback
document.querySelectorAll('.mobile-bottom-nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    triggerHaptic('light');
  });
});

// Setup Offline Queue Inspector Modal
const queueModalController = setupOfflineQueueModal({
  storage: localStorage,
  onSync: (res) => {
    if (res && res.processedCount > 0) {
      try {
        state = readState(localStorage);
        renderCustomers();
        renderDashboard();
      } catch (err) {
        console.error('Failed to reload state after offline sync:', err);
      }
    }
  },
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Offline Resilience & Sync Banner
setupOfflineSyncBanner({
  storage: localStorage,
  onOpenQueue: () => queueModalController.open(),
  onSyncProcessed: (res) => {
    if (res && res.processedCount > 0) {
      try {
        state = readState(localStorage);
        renderCustomers();
        renderDashboard();
      } catch (err) {
        console.error('Failed to reload state after offline sync:', err);
      }
    }
  },
  onToast: (msg, opts) => toast(msg, opts)
});

// Start Offline Payment Receipt & Transaction Auto-Retry Engine with Exponential Backoff
startOfflineQueueAutoRetryEngine({
  storage: localStorage,
  onQueueUpdated: () => {
    queueModalController?.render();
  },
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Mobile Field Technician Customer Enrollment Swipe Wizard
customerEnrollmentWizard = setupCustomerEnrollmentWizard({
  storage: localStorage,
  onComplete: (details) => {
    try {
      // The wizard's initial status goes through addCustomer (not a
      // post-hoc field write) so core.js stamps the first entry of
      // the customer's service-status history at creation — every
      // other status path already records one via updateCustomerProfile,
      // and the live status counter / uptime summary read that history.
      const wizardServiceStatus = String(details.serviceStatus ?? '').toLowerCase();
      state = addCustomer(state, details.name, new Date(details.startDate || Date.now()), {
        phone: details.phone,
        address: details.address,
        mohalla: details.mohalla,
        zone: details.area,
        ...(['active', 'offline', 'not-set'].includes(wizardServiceStatus) ? { serviceStatus: wizardServiceStatus } : {}),
        allowDuplicateName: true
      });
      const addedCustomer = state.customers.at(-1);
      if (addedCustomer) {
        if (details.packageSpeed) {
          addedCustomer.packageSpeed = details.packageSpeed;
        }
        if (details.monthlyRate) {
          addedCustomer.monthlySellingAmount = Number(details.monthlyRate);
        }
        save();
        renderCustomers();
        selectCustomer(addedCustomer.id);
        toast(`Field enrollment complete: ${addedCustomer.name} enrolled (#${addedCustomer.customerNumber}).`);
      }
    } catch (err) {
      toast(err?.message || 'Failed to complete field enrollment');
    }
  },
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Field Technician Connectivity Diagnostics Suite
let fieldDiagnosticsModalController = setupFieldDiagnosticsModal({
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Technician Field Collection Route Sheet & Mobile Dispatcher
export let fieldRouteSheetController = setupFieldRouteSheet({
  getState: () => state,
  onNavigateCustomer: (customerId) => {
    switchView('customers');
    selectCustomer(customerId);
  },
  onCollectPayment: (customerId) => {
    if (window.quickCollectModalController?.selectAndOpen) {
      window.quickCollectModalController.selectAndOpen(customerId);
    } else {
      switchView('customers');
      selectCustomer(customerId);
      const btn = $('#quickAddPaymentButton') || $('#quickActionReceivePayment') || $('#currentBillPaymentShortcut');
      if (btn) btn.click();
    }
  },
  onQuickProfile: (customerId) => {
    if (window.mobileQuickProfileController?.open) {
      window.mobileQuickProfileController.open(customerId);
    } else {
      switchView('customers');
      selectCustomer(customerId);
    }
  },
  onToast: (msg, opts) => toast(msg, opts),
  storage: typeof localStorage !== 'undefined' ? localStorage : null
});

// Setup Technician Field Work Orders & Customer Service Dispatch Sheet
let fieldWorkOrderSheetController = setupFieldWorkOrderSheet({
  getState: () => state,
  onNavigateCustomer: (customerId) => {
    switchView('customers');
    selectCustomer(customerId);
  },
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Mobile Offline Sync Conflict Resolver & Reconciler
let syncConflictModalController = setupSyncConflictModal({
  getState: () => state,
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onNavigateCustomer: (customerId) => {
    switchView('customers');
    selectCustomer(customerId);
  },
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Mobile Field Diagnostic Optical Signal Loss Map & Heatmap
let opticalSignalMapModalController = setupOpticalSignalMapModal({
  getState: () => state,
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onNavigateCustomer: (customerId) => {
    switchView('customers');
    selectCustomer(customerId);
  },
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Mobile Technician Vehicle Inventory Transfer Modal
let vehicleTransferModalController = setupVehicleTransferModal({
  getState: () => state,
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Aerial Fiber Pole Catenary Sag & Weather Hazard Field Inspection Modal
let aerialAlertsModalController = setupAerialAlertsModal({
  getState: () => state,
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onFilterArea: (area) => {
    switchView('customers');
    const areaFilter = $('#customerAreaFilter');
    if (areaFilter) {
      areaFilter.value = area;
      areaFilter.dispatchEvent(new Event('change'));
    }
  },
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Field Technician Optical Event OTDR Trace Inspector Modal
let mobileOtdrTraceModalController = setupMobileOtdrTraceModal({
  state,
  getState: () => state,
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onFilterArea: (area) => {
    switchView('customers');
    const areaFilter = $('#customerAreaFilter');
    if (areaFilter) {
      areaFilter.value = area;
      areaFilter.dispatchEvent(new Event('change'));
    }
  },
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Field Technician GPS Breadcrumbs & Geofence Suite
let mobileGpsBreadcrumbsModalController = setupMobileGpsBreadcrumbsModal({
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Field Technician Optical Power Meter (OPM) Testing Suite
let mobileOpmTestingModalController = setupMobileOpmTestingModal({
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts),
  onFilterArea: (area) => {
    switchView('customers');
    const areaFilter = $('#customerAreaFilter');
    if (areaFilter) {
      areaFilter.value = area;
      areaFilter.dispatchEvent(new Event('change'));
    }
  }
});

// Setup Field Technician Visual Fault Locator (VFL) Laser & Fiber Core Tracer
let mobileVflModalController = setupMobileVflModal({
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts),
  onFilterArea: (area) => {
    switchView('customers');
    const areaFilter = $('#customerAreaFilter');
    if (areaFilter) {
      areaFilter.value = area;
      areaFilter.dispatchEvent(new Event('change'));
    }
  }
});

// Setup Field Technician Optical Fiber Fusion Splice Joint Audit Sheet
let mobileFusionSpliceModalController = setupMobileFusionSpliceModal({
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts),
  onFilterArea: (area) => {
    switchView('customers');
    const areaFilter = $('#customerAreaFilter');
    if (areaFilter) {
      areaFilter.value = area;
      areaFilter.dispatchEvent(new Event('change'));
    }
  }
});

// Setup Field Technician In-Home Wi-Fi Coverage & Channel Assistant
let mobileWifiSurveyModalController = setupMobileWifiSurveyModal({
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts),
  onFilterArea: (area) => {
    switchView('customers');
    const areaFilter = $('#customerAreaFilter');
    if (areaFilter) {
      areaFilter.value = area;
      areaFilter.dispatchEvent(new Event('change'));
    }
  }
});

// Setup Field Technician Optical Link Budget & Splitter Attenuation Assistant
let mobileOpticalBudgetModalController = setupMobileOpticalBudgetModal({
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Field Technician Fiber Access Terminal (FAT / FDT) Port Allocation Matrix
let mobileFdtAllocationModalController = setupMobileFdtAllocationModal({
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Field Technician GPON ONU / ONT Optical BOSA Diagnostics Monitor
let mobileOntDiagnosticsModalController = setupMobileOntDiagnosticsModal({
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Field Technician Optical Fiber Inspection Probe & Connector End-Face Scope
let mobileFiberProbeModalController = setupMobileFiberProbeModal({
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Field Technician Fiber Splitter Tree & Cascaded PON Topology Analyzer
let mobileSplitterTreeModalController = setupMobileSplitterTreeModal({
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Field Technician Optical Fiber Patch Cord & Drop Cable Macro-Bend Curvature Assistant
let mobileMacroBendModalController = setupMobileMacroBendModal({
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Field Technician Optical Power Attenuation, VOA Tuning & Receiver Overload Protection Assistant
let mobileAttenuatorModalController = setupMobileAttenuatorModal({
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Field Technician Optical Return Loss (ORL) & Back-Reflection Assistant
let mobileOrlModalController = setupMobileOrlModal({
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Field Technician Optical Fiber Cleaver Blade Wear & Angle Analyzer
let mobileCleaverModalController = setupMobileCleaverModal(state, {
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Field Technician Tier-1 Optical Loss Test Set (OLTS) Certification Assistant (Lazy loaded for low-end phone performance)
let mobileOltsModalController = createLazyModalController(() => setupMobileOltsModal(state, {
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
}));

// Setup Field Optical Live Fiber Traffic Identifier & Tone Detector Assistant
let mobileFiberIdentifierModalController = createLazyModalController(() => setupMobileFiberIdentifierModal(state, {
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
}));

// Setup Field MPO/MTP Multi-Fiber Push-On Ribbon Trunk Polarity & Pinning Assistant
let mobileMpoModalController = createLazyModalController(() => setupMobileMpoModal(state, {
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
}));

// Setup Field Optical Fiber Mechanical Fast Connector Assistant
let mobileFastConnectorModalController = createLazyModalController(() => setupMobileFastConnectorModal(state, {
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
}));

// Setup Field OTDR Launch Cable & Pulse Suppression Assistant
let mobileOtdrLaunchModalController = createLazyModalController(() => setupMobileOtdrLaunchModal(state, {
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
}));

// Setup Field Bare Fiber Adapter (BFA) & Temporary Splice Assistant
let mobileBareFiberAdapterModalController = createLazyModalController(() => setupMobileBareFiberAdapterModal(state, {
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
}));

// Setup Field Stabilized Light Source (SLS) & Modulated Tone Generator Assistant
let mobileSlsToneModalController = createLazyModalController(() => setupMobileSlsToneModal(state, {
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
}));

// Setup Field Optical Fiber Talk Set (FOTS) & Laser Voice Communicator Assistant
let mobileFiberTalksetModalController = createLazyModalController(() => setupMobileFiberTalksetModal(state, {
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
}));

// Setup Field CWDM / DWDM Optical Channel Grid & Spectrum Allocation Assistant
let mobileWdmSpectrumModalController = createLazyModalController(() => setupMobileWdmSpectrumModal(state, {
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
}));

// Setup Field Optical Drop Cable Mid-Span Buffer Tube Slitter Assistant
let mobileMidspanAccessModalController = createLazyModalController(() => setupMobileMidspanAccessModal(state, {
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
}));

// Setup Field Optical Continuous Power Logging & Fiber Flapping Detector Assistant
let mobilePowerLoggerModalController = createLazyModalController(() => setupMobilePowerLoggerModal(state, {
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
}));

// Setup Field Optical Fiber Drop Cable Tensile Pull & Clamping Retention Assistant
let mobileDropRetentionModalController = createLazyModalController(() => setupMobileDropRetentionModal(state, {
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
}));

// Setup Field Optical Reference Test Cords (TRC) & Zero-Loss Baseline Referencing Assistant
let mobileRefJumpersModalController = createLazyModalController(() => setupMobileRefJumpersModal(state, {
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
}));

// Setup Field Mass Fusion Ribbon Fiber De-Ribbonizer & Single-Core Breakout Assistant
let mobileRibbonSeparatorModalController = createLazyModalController(() => setupMobileRibbonSeparatorModal(state, {
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
}));

// Setup Field Mechanical Splice & Index Matching Gel Restoration Assistant
let mobileMechanicalSpliceModalController = createLazyModalController(() => setupMobileMechanicalSpliceModal(state, {
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
}));

// Setup Field Fiber Microscope VIP Surface Analysis Assistant
let mobileFiberMicroscopeModalController = createLazyModalController(() => setupMobileFiberMicroscopeModal({
  doc: document,
  onToast: (msg, opts) => toast(msg, opts)
}));

// Setup Field Optical Connector Cleaning & Sanitation Assistant
let mobileConnectorCleaningModalController = createLazyModalController(() => setupMobileConnectorCleaningModal({
  doc: document,
  onToast: (msg, opts) => toast(msg, opts)
}));

// Setup Field OTDR Dead Zone & Pulse Width Calibration Assistant
let mobileOtdrDeadzoneModalController = createLazyModalController(() => setupMobileOtdrDeadzoneModal({
  doc: document,
  onToast: (msg, opts) => toast(msg, opts)
}));

// Setup Field Optical Fiber Buffer Tube Mid-Span Stripper & Shaving Gauge Assistant
deferLowPriorityInit(() => setupMobileTubeShavingModal(), { delay: 1500 });

// Setup 2-Tap Quick Collect Mobile Field Flow (agent2 - shahdara-mobile-nav)
window.quickCollectModalController = setupQuickCollectModal({
  getState: () => state,
  onSaveState: (nextState) => {
    state = nextState;
    save();
    renderDetail();
    renderTransactions();
    renderMonthlyReport();
    updateNavigationBadges(state);
    if (typeof fieldRouteSheetController?.recalculate === 'function') {
      fieldRouteSheetController.recalculate();
    }
  },
  onToast: (msg, opts) => toast(msg, opts),
  onSelectCustomer: (customerId) => {
    selectedCustomerId = customerId;
    renderDetail();
  },
  // #297 "Add phone": open this customer's profile in edit mode with the phone field focused.
  onEditCustomer: (customerId, { focus } = {}) => editCustomerProfile(customerId, { focus })
});
// Setup SISP-5 1-Thumb Field Collection Mode (header toggle + full-screen overlay).
window.fieldModeController = setupFieldMode({
  getState: () => state,
  onSaveState: (nextState) => {
    state = nextState;
    save();
    renderDetail();
    renderTransactions();
    renderMonthlyReport();
    updateNavigationBadges(state);
  },
  onToast: (msg, opts) => toast(msg, opts),
  // SISP-31: 1-tap 58mm slip on field-mode receipt cards, reusing the
  // existing thermal receipt path (same format the profile history buttons use).
  onPrint58mm: (receipt) => printPaymentReceipt(receipt.customerId, receipt.month, receipt.paymentId, { format: 'thermal-58' }),
  // SISP-41: 1-tap stamped PNG receipt on field-mode receipt cards, reusing
  // the existing SISP-6 path (same downloadPngReceipt the profile history buttons use).
  onPngReceipt: (receipt) => downloadPngReceipt(receipt.customerId, receipt.month, receipt.paymentId),
  // SISP-76: 1-tap native SMS slip on field-mode receipt cards for
  // keypad / non-WhatsApp customers ('' hides the button entirely).
  onSmsSlipUrl: (receipt) => buildSmsReceiptUrl({
    phone: receipt.phone || '',
    customerName: receipt.customerName || '',
    amount: receipt.amount,
    balanceDue: receipt.newTotalDues ?? receipt.payableRemaining ?? null,
    receiptNumber: receipt.receiptNumber || ''
  }).url
});
// Setup Mobile Customer Quick Profile Sheet & WhatsApp Delivery (agent2 - shahdara-mobile-nav)
window.mobileQuickProfileController = setupMobileQuickProfileModal({
  getState: () => state,
  onCollect: (customerId) => {
    if (window.quickCollectModalController?.selectAndOpen) {
      window.quickCollectModalController.selectAndOpen(customerId);
    }
  },
  onNavigate: (customerId) => {
    switchView('customers');
    selectCustomer(customerId);
  },
  onToast: (msg, opts) => toast(msg, opts)
});
// Setup Fast Customer Search Sheet & Recent Accounts (agent2 - shahdara-mobile-nav)
window.fastCustomerSearchController = setupFastCustomerSearchModal({
  getState: () => state,
  onSelectCustomer: (customerId) => {
    switchView('customers');
    selectCustomer(customerId);
  },
  onOpenQuickCollect: (customerId) => {
    // #354: the search action is labelled "Collect / Set Fee" — for a
    // customer with no monthly fee there is nothing to collect yet, so
    // open the Set monthly bill editor first (the same dialog the
    // Customers-list "Bill not set" chip opens) instead of Quick Collect
    // with Full/Monthly/50% chips all worth Rs 0.
    const customer = state.customers.find(c => c.id === customerId);
    if (customer && !customerHasMonthlyFee(customer) && typeof window.openInlineBillEditor === 'function') {
      window.openInlineBillEditor(customerId);
      return;
    }
    if (window.quickCollectModalController?.open) {
      window.quickCollectModalController.open(customerId);
    }
  },
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup Bilingual English / Urdu (اردو) Interface & RTL Layout (agent2 - shahdara-mobile-nav)
window.languageController = setupLanguageToggle({
  onToast: (msg, opts) => toast(msg, opts)
});

// Profile UI polish: customer names are rendered by app code (not the
// visible-text dictionary), so re-render them when the language changes.
window.addEventListener('shahdara:language-change', () => {
  renderDetail();
  renderCustomers();
  renderDashboard();
  renderMonthlyReport();
});

// Setup Pending Actions Center & Collection Promises Suite (agent2 - shahdara-mobile-nav)
window.pendingActionsController = setupPendingActionsModal({
  getState: () => state,
  onStateChange: () => {
    updateNavigationBadges(state);
  },
  toast: (msg) => toast(msg)
});

const topbarPendingBtn = $('#topbarPendingActionsBtn');
if (topbarPendingBtn) {
  topbarPendingBtn.addEventListener('click', () => {
    window.pendingActionsController?.open();
  });
}

const navPendingBtn = $('#navPendingActionsBtn');
if (navPendingBtn) {
  navPendingBtn.addEventListener('click', () => {
    const drawer = $('#navDrawer');
    if (drawer && drawer.classList.contains('is-open')) {
      const closeDrawerBtn = $('#navDrawerClose');
      if (closeDrawerBtn) closeDrawerBtn.click();
      else drawer.classList.remove('is-open');
    }
    window.pendingActionsController?.open();
  });
}

const closePendingSecondaryBtn = $('#closePendingActionsSecondaryBtn');
if (closePendingSecondaryBtn) {
  closePendingSecondaryBtn.addEventListener('click', () => {
    window.pendingActionsController?.close();
  });
}

// Setup Digital Payments & QR Settings Modal (agent4 - shahdara-polish-qa)
window.digitalPaymentsSettingsController = initDigitalPaymentsSettingsModal({
  onSave: () => {
    toast('✓ Digital payment receiving settings saved.');
  }
});

// Setup PWA Install Prompt & Low-End Phone Speed Engine (agent2 - shahdara-mobile-nav)
window.pwaInstallController = setupPwaInstallPrompt({
  doc: document,
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onToast: (msg, opts) => toast(msg, opts)
});

// Setup PWA Status & Offline Health Modal (agent2 - shahdara-mobile-nav)
window.pwaStatusController = setupPwaStatusModal({
  doc: document,
  onToast: (msg, opts) => toast(msg, opts),
  onTriggerInstall: () => window.pwaInstallController?.triggerInstall(),
  onQuickCollect: () => window.quickCollectModalController?.open(),
  onAddCustomer: () => {
    switchView('customers');
    const addBtn = $('#addCustomerButton') || $('#quickActionAddCustomer');
    if (addBtn) addBtn.click();
  },
  onTodayDues: () => {
    switchView('customers');
    const pendingFilter = document.querySelector('[data-customer-billing-filter="pending"]');
    if (pendingFilter) pendingFilter.click();
  }
});

const navDrawerPwaStatusBtn = $('#navDrawerPwaStatusBtn');
if (navDrawerPwaStatusBtn) {
  navDrawerPwaStatusBtn.addEventListener('click', () => {
    const drawer = $('#navDrawer');
    if (drawer && drawer.classList.contains('is-open')) {
      const closeBtn = $('#navDrawerClose');
      if (closeBtn) closeBtn.click();
      else drawer.classList.remove('is-open');
    }
    window.pwaStatusController?.open();
  });
}

const mobileMorePwaStatusBtn = $('#mobileMorePwaStatusBtn');
if (mobileMorePwaStatusBtn) {
  mobileMorePwaStatusBtn.addEventListener('click', () => {
    const moreMenu = $('#mobileMoreMenu');
    if (moreMenu) moreMenu.hidden = true;
    window.pwaStatusController?.open();
  });
}

// Setup PWA Shortcuts URL handler (#quick-collect, #add-customer, #today-dues)
setupPwaShortcuts({
  onQuickCollect: (customerId) => window.quickCollectModalController?.open(customerId),
  onAddCustomer: () => {
    switchView('customers');
    const addBtn = $('#addCustomerButton') || $('#quickActionAddCustomer');
    if (addBtn) addBtn.click();
  },
  onTodayDues: () => {
    switchView('customers');
    const pendingFilter = document.querySelector('[data-customer-billing-filter="pending"]');
    if (pendingFilter) pendingFilter.click();
  },
  onCollectionRounds: () => {
    fieldRouteSheetController?.open?.();
  },
  onPendingActions: () => {
    window.pendingActionsController?.open?.();
  },
  onFastSearch: () => {
    window.fastCustomerSearchController?.open?.();
  },
  onPwaStatus: () => {
    window.pwaStatusController?.open?.();
  },
  toast: (msg) => toast(msg)
});

// Setup Floating Mobile Speed Dial / Quick Action Dock

setupMobileSpeedDial({
  onSearchRoster: () => {
    if (window.fastCustomerSearchController?.open) {
      window.fastCustomerSearchController.open();
    } else {
      switchView('customers');
      const search = $('#globalCustomerSearch') || $('#customerListSearch');
      if (search) {
        search.focus();
        search.select?.();
      }
    }
  },
  onRecordPayment: () => {
    const btn = $('#quickAddPaymentButton') || $('#quickActionReceivePayment') || $('#currentBillPaymentShortcut');
    if (btn) btn.click();
    else {
      switchView('customers');
      toast('Select a customer to record payment');
    }
  },
  onAddCustomer: () => {
    const btn = $('#quickActionAddCustomer') || $('#addCustomerButton');
    if (btn) btn.click();
  },
  onFieldEnrollment: () => {
    customerEnrollmentWizard?.open();
  },
  onFieldDiagnostics: () => {
    fieldDiagnosticsModalController?.open();
  },
  onFieldRouteSheet: () => {
    fieldRouteSheetController?.open();
  },
  onWorkOrders: () => {
    fieldWorkOrderSheetController?.open();
  },
  onReminders: () => {
    let cust = selectedCustomerId ? state.customers.find(c => c.id === selectedCustomerId) : null;
    if (!cust) {
      cust = state.customers.find(c => !c.archived && Array.isArray(c.bills) && c.bills.some(b => Number(b.dueAmount || 0) > Number(b.paidAmount || 0)));
      if (!cust) {
        cust = state.customers.find(c => !c.archived) || state.customers[0];
      }
    }
    if (cust) {
      selectCustomer(cust.id);
      switchView('customers');
      openPaymentReminderModal(cust);
    } else {
      switchView('customers');
      toast('Select a customer to send WhatsApp payment reminders');
    }
  },
  onScrollTop: () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

// Setup Interactive Mobile Breadcrumbs Trail
mobileBreadcrumbs = setupMobileBreadcrumbs({
  onNavigate: (viewId, data) => {
    if (['customers', 'transactions', 'reports', 'analytics', 'inventory', 'expenses', 'homeBudget', 'loans', 'waTemplates'].includes(viewId)) {
      switchView(viewId);
      if (viewId === 'customers') renderCustomers();
      else if (viewId === 'transactions') renderTransactions();
      else if (viewId === 'reports') renderMonthlyReport();
      else if (viewId === 'analytics') renderAnalytics();
      else if (viewId === 'inventory') renderInventory();
      else if (viewId === 'expenses') renderExpenses();
      else if (viewId === 'homeBudget') renderHomeBudget();
      else if (viewId === 'loans') renderLoans();
      else if (viewId === 'waTemplates') renderWaTemplates();
    } else if (viewId === 'home') {
      if (typeof window !== 'undefined' && window.location) {
        window.location.hash = '#/home';
      }
      const homeTab = document.querySelector('[data-nav-target="home"]');
      if (homeTab) {
        homeTab.click();
      }
    } else if (data?.customerId) {
      selectCustomer(data.customerId);
    }
  }
});

// Setup Mobile Bottom Navigation Sliding Tab Indicator
tabSlider = setupTabSliderIndicator({
  containerSelector: '.mobile-bottom-nav'
});

document.addEventListener('click', event => {
  const menu = $('#mobileMoreMenu');
  const moreBtn = $('#mobileMoreButton');
  if (menu && !menu.hidden && !menu.contains(event.target) && !moreBtn?.contains(event.target)) {
    menu.hidden = true;
    moreBtn?.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    const menu = $('#mobileMoreMenu');
    if (menu && !menu.hidden) {
      menu.hidden = true;
      const moreBtn = $('#mobileMoreButton');
      if (moreBtn) {
        moreBtn.setAttribute('aria-expanded', 'false');
        moreBtn.focus?.();
      }
      return;
    }
    if (appShell.classList.contains('show-detail') && window.innerWidth <= 620) {
      appShell.classList.remove('show-detail');
      if (typeof window !== 'undefined' && window.location && window.location.hash.startsWith('#customer')) {
        try { history.pushState({ view: 'customers' }, '', '#customers'); } catch { window.location.hash = '#customers'; }
      }
      const selectedBtn = selectedCustomerId ? document.querySelector(`[data-customer-id="${CSS.escape(selectedCustomerId)}"]`) : null;
      if (selectedBtn) selectedBtn.focus?.();
      return;
    }
    const activeModals = [
      $('#accountStatementModal'),
      $('#paymentReminderModal'),
      $('#batchReceiptModal'),
      $('#customerLedgerAuditModal'),
      $('#customerBillInvoiceModal'),
      $('#wadaFollowupModal'),
      $('#reminderStagesModal')
    ];
    for (const m of activeModals) {
      if (m && (m.open || m.hasAttribute('open'))) {
        if (m.close) m.close();
        else m.removeAttribute('open');
        return;
      }
    }
  }
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    event.preventDefault();
    const search = $('#globalCustomerSearch');
    if (search) {
      search.focus();
      search.select();
    }
  }
});

function phase3Cell(value) { return escapeHtml(value ?? ''); }
function phase3Money(value) { return value === null || value === undefined ? 'Not set' : formatAmount(value); }
function readableStock(items, category) {
  const filtered=items.filter(item=>item.category===category&&item.hasMovements);
  if(!filtered.length) return 'Not recorded';
  const totals=new Map(); for(const item of filtered) totals.set(item.unit,(totals.get(item.unit)??0)+item.available);
  return [...totals].map(([unit,amount])=>`${new Intl.NumberFormat('en-PK',{maximumFractionDigits:2}).format(amount)} ${unit}`).join(' · ');
}
function shortMonth(month) { return new Intl.DateTimeFormat('en',{month:'short',timeZone:'UTC'}).format(new Date(`${month}-01T00:00:00Z`)); }
function chartAxis(value,isMoney) {
  const rounded=Math.round(value); const text=new Intl.NumberFormat('en-PK',{maximumFractionDigits:0}).format(rounded);
  return isMoney ? `PKR ${text}` : text;
}
function twoSeriesSvg(rows,{first,second,firstLabel,secondLabel,title,isMoney=false}={}) {
  const values=rows.flatMap(row=>[row[first],row[second]]).filter(value=>Number.isFinite(value));
  if(!values.length) return '';
  const width=720,height=220,left=76,right=12,top=14,bottom=38,plotWidth=width-left-right,plotHeight=height-top-bottom;
  const maximum=Math.max(...values,1),groupWidth=plotWidth/Math.max(rows.length,1),barWidth=Math.min(20,groupWidth*.25);
  const ticks=[0,maximum/2,maximum];
  const grid=ticks.map(tick=>{const y=top+plotHeight-(tick/maximum)*plotHeight;return `<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}" class="chart-grid-line"/><text x="${left-7}" y="${y+4}" text-anchor="end" class="chart-axis-label">${phase3Cell(chartAxis(tick,isMoney))}</text>`;}).join('');
  const bars=rows.map((row,index)=>{
    const center=left+groupWidth*(index+.5),monthLabel=phase3Cell(shortMonth(row.month));
    const makeBar=(key,offset,klass,label)=>{const value=row[key];if(!Number.isFinite(value))return '';const h=Math.max(value>0?1:0,(value/maximum)*plotHeight),y=top+plotHeight-h,x=center+offset-barWidth/2;return `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="3" class="${klass}"><title>${phase3Cell(label)} · ${monthLabel}: ${phase3Cell(isMoney?formatAmount(value):value)}</title></rect>`;};
    return `${makeBar(first,-barWidth*.55,'chart-bar-first',firstLabel)}${makeBar(second,barWidth*.55,'chart-bar-second',secondLabel)}<text x="${center}" y="${height-12}" text-anchor="middle" class="chart-month-label">${monthLabel}</text>`;
  }).join('');
  const description=rows.map(row=>`${row.month}: ${firstLabel} ${Number.isFinite(row[first])?row[first]:'not recorded'}, ${secondLabel} ${Number.isFinite(row[second])?row[second]:'not recorded'}`).join('; ');
  return `<svg class="phase3-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${phase3Cell(title)}"><title>${phase3Cell(title)}</title><desc>${phase3Cell(description)}</desc>${grid}${bars}</svg>`;
}
function oneSeriesSvg(rows,{key,label,title,isMoney=false}={}) {
  const values=rows.map(row=>row[key]).filter(value=>Number.isFinite(value)); if(!values.length)return '';
  const width=720,height=220,left=76,right=12,top=14,bottom=38,plotWidth=width-left-right,plotHeight=height-top-bottom,maximum=Math.max(...values,1),groupWidth=plotWidth/Math.max(rows.length,1),barWidth=Math.min(30,groupWidth*.42);
  const grid=[0,maximum/2,maximum].map(tick=>{const y=top+plotHeight-(tick/maximum)*plotHeight;return `<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}" class="chart-grid-line"/><text x="${left-7}" y="${y+4}" text-anchor="end" class="chart-axis-label">${phase3Cell(chartAxis(tick,isMoney))}</text>`;}).join('');
  const bars=rows.map((row,index)=>{const value=row[key],center=left+groupWidth*(index+.5),h=Math.max(value>0?1:0,(value/maximum)*plotHeight),y=top+plotHeight-h;return `${Number.isFinite(value)?`<rect x="${center-barWidth/2}" y="${y}" width="${barWidth}" height="${h}" rx="3" class="chart-bar-first"><title>${phase3Cell(label)} · ${phase3Cell(row.month)}: ${phase3Cell(isMoney?formatAmount(value):value)}</title></rect>`:''}<text x="${center}" y="${height-12}" text-anchor="middle" class="chart-month-label">${phase3Cell(shortMonth(row.month))}</text>`;}).join('');
  const description=rows.map(row=>`${row.month}: ${Number.isFinite(row[key])?row[key]:'not recorded'}`).join('; ');
  return `<svg class="phase3-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${phase3Cell(title)}"><title>${phase3Cell(title)}</title><desc>${phase3Cell(description)}</desc>${grid}${bars}</svg>`;
}
function signedOneSeriesSvg(rows,{key,label,title,isMoney=false}={}) {
  const values=rows.map(row=>row[key]).filter(value=>Number.isFinite(value));if(!values.length)return '';
  const width=720,height=220,left=76,right=12,top=14,bottom=38,plotWidth=width-left-right,plotHeight=height-top-bottom,low=Math.min(0,...values),high=Math.max(0,...values),span=Math.max(1,high-low),groupWidth=plotWidth/Math.max(rows.length,1),barWidth=Math.min(30,groupWidth*.42),zeroY=top+(high/span)*plotHeight;
  const ticks=[high,0,low].filter((value,index,array)=>array.indexOf(value)===index),grid=ticks.map(value=>{const y=top+((high-value)/span)*plotHeight;return `<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}" class="chart-grid-line"/><text x="${left-7}" y="${y+4}" text-anchor="end" class="chart-axis-label">${phase3Cell(chartAxis(value,isMoney))}</text>`;}).join('');
  const bars=rows.map((row,index)=>{const value=row[key],center=left+groupWidth*(index+.5),valueY=top+((high-value)/span)*plotHeight,y=Math.min(zeroY,valueY),h=Math.max(1,Math.abs(zeroY-valueY));return `${Number.isFinite(value)?`<rect x="${center-barWidth/2}" y="${y}" width="${barWidth}" height="${h}" rx="3" class="${value<0?'chart-bar-negative':'chart-bar-first'}"><title>${phase3Cell(label)} · ${phase3Cell(row.month)}: ${phase3Cell(isMoney?formatAmount(value):value)}</title></rect>`:''}<text x="${center}" y="${height-12}" text-anchor="middle" class="chart-month-label">${phase3Cell(shortMonth(row.month))}</text>`;}).join('');
  const description=rows.map(row=>`${row.month}: ${Number.isFinite(row[key])?row[key]:'not recorded'}`).join('; ');
  return `<svg class="phase3-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${phase3Cell(title)}"><title>${phase3Cell(title)}</title><desc>${phase3Cell(description)}</desc>${grid}${bars}</svg>`;
}
function categoryBarsSvg(rows,{title,isMoney=true}={}) {
  const values=rows.filter(row=>Number.isFinite(row.value));if(!values.length)return '';
  const width=720,left=176,right=94,top=18,rowHeight=34,bottom=16,height=Math.max(130,top+values.length*rowHeight+bottom),plotWidth=width-left-right,maximum=Math.max(...values.map(row=>row.value),1),barHeight=15;
  const grid=[0,.5,1].map(ratio=>{const x=left+plotWidth*ratio;return `<line x1="${x}" y1="${top-5}" x2="${x}" y2="${height-bottom+1}" class="chart-grid-line"/><text x="${x}" y="${height-2}" text-anchor="middle" class="chart-axis-label">${phase3Cell(chartAxis(maximum*ratio,isMoney))}</text>`;}).join('');
  const bars=values.map((row,index)=>{const y=top+index*rowHeight,label=String(row.label??''),short=label.length>26?`${label.slice(0,24)}…`:label,barWidth=Math.max(row.value>0?2:0,row.value/maximum*plotWidth),display=isMoney?formatAmount(row.value):String(row.value);return `<text x="${left-9}" y="${y+barHeight-2}" text-anchor="end" class="chart-axis-label">${phase3Cell(short)}</text><rect x="${left}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" class="chart-bar-first"><title>${phase3Cell(label)}: ${phase3Cell(display)}</title></rect><text x="${width-right+7}" y="${y+barHeight-2}" class="chart-axis-label">${phase3Cell(display)}</text>`;}).join('');
  const description=values.map(row=>`${row.label}: ${row.value}`).join('; ');
  return `<svg class="phase3-chart-svg category-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${phase3Cell(title)}"><title>${phase3Cell(title)}</title><desc>${phase3Cell(description)}</desc>${grid}${bars}</svg>`;
}
function prepareAreaIntelFilters(data) {
  const month=$('#areaIntelMonth'),from=$('#areaIntelFrom'),to=$('#areaIntelTo');if(!month||!from||!to)return;
  const history=monthsForHistory(new Date()),oldMonth=month.value,hadDates=Boolean(from.value&&to.value);
  month.innerHTML=`<option value="">Custom date range</option>${history.map(value=>`<option value="${value}">${escapeHtml(monthName(value))}</option>`).join('')}`;
  month.value=history.includes(oldMonth)?oldMonth:hadDates?'':data.currentMonth;
  from.max=data.asOf;to.max=data.asOf;
  if(!hadDates){from.value=`${data.currentMonth}-01`;to.value=data.asOf;}
}
let areaSortKey = null;
let areaSortAsc = true;
let areaSearchQuery = '';

function areaIntelMetric(label, display, missing, title) {
  const titleAttr = title ? ` title="${phase3Cell(title)}"` : '';
  if (missing) return `<div class="area-intel-metric"><span>${label}</span><span class="area-intel-missing"${titleAttr}>${phase3Cell(display)}</span></div>`;
  return `<div class="area-intel-metric"><span>${label}</span><strong${titleAttr}>${phase3Cell(display)}</strong></div>`;
}
function areaIntelSectionMetrics(row) {
  const amountOrMissing = value => value === null ? null : formatAmount(value);
  return [
    areaIntelMetric('Customers · current roster', String(row.totalCustomers), false),
    areaIntelMetric('Active customers', row.activeCustomers === null ? 'Not recorded for this historical date' : String(row.activeCustomers), row.activeCustomers === null, row.activeCustomerSource),
    areaIntelMetric('Monthly billing', amountOrMissing(row.billedAmount), row.billedAmount === null),
    areaIntelMetric('Collected', amountOrMissing(row.collectedAmount), row.collectedAmount === null),
    areaIntelMetric('Outstanding', amountOrMissing(row.outstanding), row.outstanding === null),
    areaIntelMetric('Collection rate', row.collectionRate === null ? 'Not set' : `${row.collectionRate}%`, row.collectionRate === null),
    areaIntelMetric('Average customer value', amountOrMissing(row.averageCustomerValue), row.averageCustomerValue === null),
    areaIntelMetric('Expenses', amountOrMissing(row.expenses), row.expenses === null, row.expensesSource),
    areaIntelMetric('Estimated profit', amountOrMissing(row.estimatedProfit), row.estimatedProfit === null, row.estimatedProfitBasis),
  ].join('');
}
function areaIntelNoZoneNote(count) {
  return count ? `<p class="area-intel-no-zone">Without a zone: ${count} customer${count === 1 ? '' : 's'}</p>` : '';
}
function areaIntelCardSection(section) {
  const level = section.level === 'unassigned' ? 'Unassigned' : section.level;
  const name = phase3Cell(section.label.replace(/^(?:Area|Mohalla|Zone):\s*/, ''));
  return `<section class="area-intel-section"><h5><span class="area-intel-level">${phase3Cell(level)}</span> ${name}</h5><div class="area-intel-metrics">${areaIntelSectionMetrics(section.row)}</div>${areaIntelNoZoneNote(section.withoutZoneCustomers)}${section.children.map(areaIntelCardSection).join('')}</section>`;
}
function renderAreaIntelligenceCardsHtml(areaRows) {
  return groupAreaIntelligenceCards(areaRows).map(group => {
    const rootName = phase3Cell((group.root ? group.root.label : group.rootArea).replace(/^(?:Area|Mohalla|Zone):\s*/, ''));
    const rootLevel = group.root ? (group.root.level === 'unassigned' ? 'Unassigned' : group.root.level) : 'Area';
    const rootBody = group.root ? `<div class="area-intel-metrics">${areaIntelSectionMetrics(group.root.row)}</div>${areaIntelNoZoneNote(group.root.withoutZoneCustomers)}${group.root.children.map(areaIntelCardSection).join('')}` : '';
    return `<article class="area-intel-card"><header class="area-intel-card-header"><span class="area-intel-level">${phase3Cell(rootLevel)}</span><h4>${rootName}</h4></header>${rootBody}${areaIntelNoZoneNote(group.orphanWithoutZoneCustomers)}${group.children.map(areaIntelCardSection).join('')}</article>`;
  }).join('');
}
function renderAreaSummaryCardsHtml(cards) {
  return (cards ?? []).map(card => `<article class="area-intel-card"><header class="area-intel-card-header"><span class="area-intel-level">${phase3Cell(card.level)}</span><h4>${phase3Cell(card.label)}</h4></header><p class="area-intel-no-zone">${phase3Cell(card.context)}</p><div class="area-intel-metrics">${card.metrics.map(metric => `<div class="area-intel-metric"><span>${phase3Cell(metric.label)}</span><strong>${phase3Cell(metric.value)}</strong></div>`).join('')}</div></article>`).join('');
}
function renderAreaIntelligence() {
  const from=$('#areaIntelFrom')?.value,to=$('#areaIntelTo')?.value,table=$('#areaIntelligenceTable');if(!table)return;
  const areaChart=$('#areaRevenueChart'),zoneChart=$('#areaZoneRevenueChart'),packageChart=$('#packageRevenueChart'),basis=$('#areaIntelBasis');
  try {
    const referenceDate=new Date(),area=buildAreaIntelligence(state,{startDate:from,endDate:to},referenceDate),packages=buildPackageRevenue(state,{startDate:from,endDate:to},referenceDate);
    const namedAreas=area.rows.filter(row=>row.level==='area'&&row.billedAmount!==null).map(row=>({label:row.area.replace(/^Area:\s*/,''),value:row.billedAmount})).sort((a,b)=>b.value-a.value);
    const zones=area.rows.filter(row=>row.level==='zone'&&row.billedAmount!==null).map(row=>({label:`${row.parentArea.replace(/^(?:Area|Mohalla):\s*/,'')} · ${row.area.replace(/^Zone:\s*/, '')}`,value:row.billedAmount})).sort((a,b)=>b.value-a.value);
    areaChart.innerHTML=namedAreas.length?categoryBarsSvg(namedAreas,{title:`Service-month revenue by area, ${from} to ${to}`}):'<p class="empty-state">No saved priced bill snapshots for named areas in this range.</p>';
    zoneChart.innerHTML=zones.length?categoryBarsSvg(zones,{title:`Service-month revenue by zone, ${from} to ${to}`}):'<p class="empty-state">No saved priced bill snapshots for named zones in this range.</p>';
    packageChart.innerHTML=packages.rows.length?categoryBarsSvg(packages.rows.map(row=>({label:row.package,value:row.revenue})),{title:`Service-month revenue by recorded package, ${from} to ${to}`}):'<p class="empty-state">No positive priced bill snapshots in the selected service months.</p>';
    let areaRows = [...area.rows];
    if (areaSortKey) {
      areaRows.sort((a, b) => {
        let cmp = 0;
        if (areaSortKey === 'area') {
          cmp = (a.area || '').localeCompare(b.area || '');
        } else if (areaSortKey === 'totalCustomers') {
          cmp = (a.totalCustomers || 0) - (b.totalCustomers || 0);
        } else if (areaSortKey === 'activeCustomers') {
          const vA = a.activeCustomers === null ? -1 : a.activeCustomers;
          const vB = b.activeCustomers === null ? -1 : b.activeCustomers;
          cmp = vA - vB;
        } else if (areaSortKey === 'billedAmount') {
          const vA = a.billedAmount === null ? -1 : a.billedAmount;
          const vB = b.billedAmount === null ? -1 : b.billedAmount;
          cmp = vA - vB;
        } else if (areaSortKey === 'collectedAmount') {
          const vA = a.collectedAmount === null ? -1 : a.collectedAmount;
          const vB = b.collectedAmount === null ? -1 : b.collectedAmount;
          cmp = vA - vB;
        } else if (areaSortKey === 'outstanding') {
          const vA = a.outstanding === null ? -1 : a.outstanding;
          const vB = b.outstanding === null ? -1 : b.outstanding;
          cmp = vA - vB;
        } else if (areaSortKey === 'collectionRate') {
          const vA = a.collectionRate === null ? -1 : a.collectionRate;
          const vB = b.collectionRate === null ? -1 : b.collectionRate;
          cmp = vA - vB;
        } else if (areaSortKey === 'averageCustomerValue') {
          const vA = a.averageCustomerValue === null ? -1 : a.averageCustomerValue;
          const vB = b.averageCustomerValue === null ? -1 : b.averageCustomerValue;
          cmp = vA - vB;
        } else if (areaSortKey === 'expenses') {
          const vA = a.expenses === null ? -1 : a.expenses;
          const vB = b.expenses === null ? -1 : b.expenses;
          cmp = vA - vB;
        } else if (areaSortKey === 'estimatedProfit') {
          const vA = a.estimatedProfit === null ? -Infinity : a.estimatedProfit;
          const vB = b.estimatedProfit === null ? -Infinity : b.estimatedProfit;
          cmp = vA - vB;
        }
        return areaSortAsc ? cmp : -cmp;
      });
    }

    if (areaSearchQuery.trim()) {
      const q = areaSearchQuery.trim().toLowerCase();
      areaRows = areaRows.filter(row => {
        const areaStr = (row.area || '').toLowerCase();
        const parentStr = (row.parentArea || '').toLowerCase();
        return areaStr.includes(q) || parentStr.includes(q);
      });
    }

    const countBadge = $('#areaIntelRowCount');
    if (countBadge) {
      if (areaSearchQuery.trim()) {
        countBadge.textContent = `Showing ${areaRows.length} of ${area.rows.length}`;
      } else {
        countBadge.textContent = `${area.rows.length} area/zone rows`;
      }
    }

    document.querySelectorAll('[data-sort-area]').forEach(th => {
      const key = th.dataset.sortArea;
      const indicator = th.querySelector('.sort-indicator');
      if (areaSortKey === key) {
        th.setAttribute('aria-sort', areaSortAsc ? 'ascending' : 'descending');
        if (indicator) indicator.textContent = areaSortAsc ? ' ↑' : ' ↓';
      } else {
        th.removeAttribute('aria-sort');
        if (indicator) indicator.textContent = '';
      }
    });

    table.innerHTML=areaRows.map(row=>{
      const label=`${row.area}`;const active=row.activeCustomers===null?'Not recorded for this historical date':String(row.activeCustomers);
      const amountOrMissing=value=>value===null?'Not recorded':formatAmount(value);
      return `<tr class="area-row-${phase3Cell(row.level)}"><th scope="row"><span class="location-summary-label location-summary-${phase3Cell(row.level)}" style="--summary-depth:${row.depth}"><span class="location-summary-type">${phase3Cell(row.level==='unassigned'?'Unassigned':row.level)}</span><span class="location-summary-value">${phase3Cell(label.replace(/^(?:Area|Mohalla|Zone):\s*/,''))}</span></span></th><td>${row.totalCustomers}</td><td title="${phase3Cell(row.activeCustomerSource)}">${phase3Cell(active)}</td><td>${phase3Cell(amountOrMissing(row.billedAmount))}</td><td>${phase3Cell(amountOrMissing(row.collectedAmount))}</td><td>${phase3Cell(amountOrMissing(row.outstanding))}</td><td>${row.collectionRate===null?'Not set':`${row.collectionRate}%`}</td><td>${phase3Cell(amountOrMissing(row.averageCustomerValue))}</td><td title="${phase3Cell(row.expensesSource)}">${phase3Cell(amountOrMissing(row.expenses))}</td><td title="${phase3Cell(row.estimatedProfitBasis)}">${phase3Cell(amountOrMissing(row.estimatedProfit))}</td></tr>`;
    }).join('');

    const intelCards = $('#areaIntelligenceCards'); if (intelCards) intelCards.innerHTML = renderAreaIntelligenceCardsHtml(areaRows);

    const emptyEl = $('#areaIntelligenceEmpty');
    if (emptyEl) {
      emptyEl.hidden = areaRows.length > 0;
      if (areaRows.length === 0 && areaSearchQuery.trim()) {
        emptyEl.innerHTML = `No areas or zones match "${phase3Cell(areaSearchQuery.trim())}". <button id="resetAreaIntelFiltersBtn" class="secondary-button btn-sm" type="button" style="margin-left: 8px;">Reset filter</button>`;
        $('#resetAreaIntelFiltersBtn')?.addEventListener('click', () => {
          const searchInp = $('#areaIntelSearch');
          if (searchInp) searchInp.value = '';
          areaSearchQuery = '';
          renderAreaIntelligence();
        });
      } else {
        emptyEl.textContent = 'No area / zone values or matching financial records are saved for this selection.';
      }
    }

    basis.textContent=`${from} to ${to}. ${area.basis.customers} ${area.basis.activeCustomers} ${area.basis.billing} ${area.basis.collection} ${area.basis.outstanding} ${area.basis.collectionRate} ${area.basis.averageCustomerValue} ${area.basis.expenses} ${area.basis.profit}${area.unallocatedExpenseCount?` ${area.unallocatedExpenseCount} expense record(s) in this range have no location tag.`:''} ${packages.basis}`;
  } catch(error) {
    table.replaceChildren();
    const intelCards = $('#areaIntelligenceCards'); if (intelCards) intelCards.replaceChildren();
    const emptyEl = $('#areaIntelligenceEmpty');
    if (emptyEl) {
      emptyEl.hidden=false;
      emptyEl.textContent=error.message;
    }
    for(const host of [areaChart,zoneChart,packageChart])host.innerHTML=`<p class="empty-state">${phase3Cell(error.message)}</p>`;
    basis.textContent='Select a valid date range to calculate the local area and package summaries.';
  }
}
function renderAnalytics() {
  const data=buildPhase3Analytics(state,new Date());
  prepareAreaIntelFilters(data);
  $('#analyticsPeriodNote').textContent=`Last six Pakistan local months through ${data.asOf} · ${monthName(data.currentMonth)} is partial.`;
  $('#forecastAmount').textContent=data.forecast.customersIncluded?formatAmount(data.forecast.amount):'Not set';
  $('#forecastDetail').textContent=data.forecast.customersIncluded?`${data.forecast.customersIncluded} configured subscriptions · ${data.forecast.missingPrice} eligible profiles missing a next-month price · offline status does not exclude a subscriber`:'No confirmed active subscription rates for next month.';
  const currentRevenueCount=data.revenueCollection.find(row=>row.month===data.currentMonth)?.billCount??0;
  $('#analyticsBilledRevenue').textContent=currentRevenueCount?formatAmount(data.currentBilledRevenue):'No bill entries';
  $('#analyticsBilledDetail').textContent=currentRevenueCount?`${currentRevenueCount} current-month bill price snapshots · service month, not cash`:'No current service-month bill price snapshots recorded.';
  $('#analyticsOutstanding').textContent=data.totalBills?formatAmount(data.currentOutstanding):'No bill entries';
  $('#analyticsOutstandingDetail').textContent=data.totalBills?`Current outstanding using saved bills, receipts, and sequential credit · as of ${data.asOf} PKT`:'No bill entries; no outstanding amount is inferred.';
  const currentArpu=data.currentServiceMonthArpu;
  $('#analyticsArpu').textContent=currentArpu.arpu===null?'Not set':formatAmount(currentArpu.arpu);
  $('#analyticsArpuDetail').textContent=`${currentArpu.billedRevenue===null?'No bill snapshots':formatAmount(currentArpu.billedRevenue)} ÷ ${currentArpu.activeSubscriptions} active configured subscriptions · Offline included · ${currentArpu.excludedSubscriptions} excluded`;
  const online=data.onlineOffline;
  $('#analyticsOnlinePercent').textContent=online.onlinePercent===null?'Not set':`${online.onlinePercent}%`;
  $('#analyticsOnlineDetail').textContent=`${online.online} Active ÷ ${online.denominator} Active + Offline · ${online.notSet} Not set excluded`;
  const monthGrowth=data.growth.find(row=>row.month===data.currentMonth);
  $('#analyticsNewConnections').textContent=data.hasConnectionDates?(monthGrowth?.newConnections??0):'Not set';
  $('#analyticsNewConnectionDetail').textContent=data.hasConnectionDates?'Recorded connection dates only; Offline is not churn.':'No real connection dates have been entered.';
  const revenueSvg=twoSeriesSvg(data.revenueCollection,{first:'billedRevenue',second:'cashCollection',firstLabel:'Billed revenue',secondLabel:'Cash collection',title:'Billed revenue by service month compared with actual cash received by date',isMoney:true});
  $('#revenueCollectionChart').innerHTML=data.hasRevenueRecords?revenueSvg:'<p class="empty-state">No bill or payment entries in this six-month window.</p>';
  const outstandingRows=data.monthEndOutstanding.map(row=>({month:row.month,outstanding:row.billCount?row.total:null}));
  $('#outstandingChart').innerHTML=data.totalBills?oneSeriesSvg(outstandingRows,{key:'outstanding',label:'Outstanding snapshot through month-end',title:'Historical outstanding balance snapshots at PKT month-end',isMoney:true}):'<p class="empty-state">No bill entries; historical outstanding snapshots are unavailable.</p>';
  const growthRows=data.growth.map(row=>({month:row.month,newConnections:row.newConnections,cumulative:row.cumulativeKnownActive}));
  $('#growthChart').innerHTML=data.hasConnectionDates?twoSeriesSvg(growthRows,{first:'newConnections',second:'cumulative',firstLabel:'New connections',secondLabel:'Dated active count',title:'Recorded new connections and cumulative active customers with known connection dates'}):'<p class="empty-state">No recorded connection dates in the six-month period.</p>';
  const incomeSvg=twoSeriesSvg(data.incomeExpense,{first:'income',second:'expenses',firstLabel:'Cash income',secondLabel:'Recorded expense',title:'Actual cash receipts compared with dated actual expenses',isMoney:true});
  $('#incomeExpenseChart').innerHTML=data.hasIncomeRecords||data.hasExpenseRecords?incomeSvg:'<p class="empty-state">No payment receipts or expense entries in this six-month window.</p>';
  const expenseRows=data.incomeExpense.map(row=>({month:row.month,expenses:row.expenseCount?row.expenses:null}));
  $('#expenseTrendChart').innerHTML=data.hasExpenseRecords?oneSeriesSvg(expenseRows,{key:'expenses',label:'Recorded expenses',title:'Dated actual expense trend',isMoney:true}):'<p class="empty-state">No actual expense entries in this six-month window.</p>';
  const profitRows=data.incomeExpense.map(row=>({month:row.month,profit:row.incomeCount||row.expenseCount?(row.income??0)-(row.expenses??0):null}));
  $('#profitTrendChart').innerHTML=data.hasIncomeRecords||data.hasExpenseRecords?signedOneSeriesSvg(profitRows,{key:'profit',label:'Cash profit',title:'Receipt-date collection minus actual dated expenses',isMoney:true}):'<p class="empty-state">No receipts or expense entries to calculate cash profit.</p>';
  renderAreaIntelligence();
  const incomeLegend=$('#incomeLegend'); if(incomeLegend)incomeLegend.textContent=data.hasIncomeRecords?'Cash income':'Cash income · no entries';
  const expenseLegend=$('#expenseLegend'); if(expenseLegend)expenseLegend.textContent=data.hasExpenseRecords?'Recorded expense':'Expense · no entries';
  const denominator=online.denominator,onlineWidth=denominator?online.online/denominator*100:0,offlineWidth=denominator?online.offline/denominator*100:0;
  $('#onlineSnapshot').innerHTML=`<div class="online-snapshot-rail" role="img" aria-label="Manual status snapshot: ${online.online} active, ${online.offline} offline, ${online.notSet} not set"><span class="online-segment" style="width:${onlineWidth}%"></span><span class="offline-segment" style="width:${offlineWidth}%"></span></div><div class="online-snapshot-values"><span><i class="legend-online"></i>Active ${online.online}</span><span><i class="legend-offline"></i>Offline ${online.offline}</span><span>Not set ${online.notSet}</span><strong>${online.onlinePercent===null?'Online % not set':`${online.onlinePercent}% (${online.online}/${denominator})`}</strong></div>`;
  $('#areaSummaryTable').innerHTML=data.areaRows.map(row=>{
    const level=row.level==='mohalla'?'Mohalla':row.level==='zone'?'Zone':'Area';
    const value=row.area==='Zone not set'?'Not set':row.area.replace(/^(?:Area|Mohalla|Zone):\s*/,'');
    const location=`<span class="location-summary-label location-summary-${row.level}" style="--summary-depth:${row.depth}"><span class="location-summary-type">${level}</span><span class="location-summary-value">${phase3Cell(value)}</span></span>`;
    const context=row.parentArea?` within ${row.parentArea}`:' roll-up';
    return `<tr class="summary-row summary-row-${row.level}"><th scope="row" aria-label="${phase3Cell(`${row.area}${context}`)}">${location}<span class="sr-only">${phase3Cell(context)}</span></th><td>${row.customerCount}</td><td>${row.activeCustomers}</td><td>${row.hasBilledRevenue?phase3Cell(formatAmount(row.billedRevenue)):'No bill snapshots'}</td><td>${row.hasBillHistory?phase3Cell(formatAmount(row.outstanding)):'No bill entries'}</td><td>${row.excludedSubscriptions}</td><td>${row.onlinePercent===null?`Not set (${row.online}/${row.onlineDenominator})`:`${row.onlinePercent}% (${row.online}/${row.onlineDenominator})`}</td><td>${row.complaints}</td><td>${data.hasConnectionDates?row.newConnections:'Not set'}</td><td>${row.arpu===null?'Not set':`<strong class="summary-arpu">${phase3Cell(formatAmount(row.arpu))}</strong>`}</td></tr>`;
  }).join('');
  const summaryCards=$('#areaSummaryCards'); if(summaryCards)summaryCards.innerHTML=renderAreaSummaryCardsHtml(buildAreaSummaryCards(data.areaRows,data.hasConnectionDates,formatAmount));
  const namedAreas=data.areaRows.some(row=>row.level==='area');
  $('#areaSummaryEmpty').hidden=namedAreas;
  const unassigned=data.unassignedArea;
  $('#areaSummaryUnassigned').textContent=`Area not set: ${unassigned.profiles} profile${unassigned.profiles===1?'':'s'} (${unassigned.activeConfiguredSubscriptions} active configured; ${unassigned.withZone} with a zone, ${unassigned.withoutZone} without). ${unassigned.namedAreaProfilesWithoutZone} assigned profile${unassigned.namedAreaProfilesWithoutZone===1?'':'s'} have no zone. Profiles without an area are excluded from named-area rows.`;
  latestAnalyticsData = data;
  renderPackageSummaryTable();
  const configuredPackages=data.packageRows.some(row=>row.packageKey!=='__package_not_set__');
  $('#packageSummaryEmpty').hidden=configuredPackages;
  $('#networkIssuesList').innerHTML=data.incidentCount?data.networkIssues.map(row=>`<li><span>${phase3Cell(monthName(row.month))}</span><strong>${row.count} recorded incident${row.count===1?'':'s'}</strong></li>`).join(''):`<li class="empty-state">No complaint or outage records have been entered.</li>`;
  $('#analyticsEmptyNotice').textContent=data.growthCumulativeIsPartial?`${data.knownUndatedConnections} customer profiles have no connection date; cumulative growth is therefore date-known only and is not a total historical customer count.`:'Historical summaries include only recorded local bills, receipts, dates, statuses, and incidents.';
}
let packageSortKey = null;
let packageSortAsc = true;
let latestAnalyticsData = null;

function renderPackageSummaryTable() {
  if (!latestAnalyticsData) return;
  const table = $('#packageSummaryTable');
  if (!table) return;
  let rows = [...latestAnalyticsData.packageRows];
  if (packageSortKey) {
    rows.sort((a, b) => {
      let cmp = 0;
      if (packageSortKey === 'package') {
        cmp = (a.package || '').localeCompare(b.package || '');
      } else if (packageSortKey === 'customers') {
        cmp = (a.customers || 0) - (b.customers || 0);
      } else if (packageSortKey === 'activeCustomers') {
        cmp = (a.activeCustomers || 0) - (b.activeCustomers || 0);
      } else if (packageSortKey === 'billedRevenue') {
        const vA = a.hasBilledRevenue ? (a.billedRevenue || 0) : -1;
        const vB = b.hasBilledRevenue ? (b.billedRevenue || 0) : -1;
        cmp = vA - vB;
      } else if (packageSortKey === 'outstanding') {
        const vA = a.hasBillHistory ? (a.outstanding || 0) : -1;
        const vB = b.hasBillHistory ? (b.outstanding || 0) : -1;
        cmp = vA - vB;
      } else if (packageSortKey === 'excludedSubscriptions') {
        cmp = (a.excludedSubscriptions || 0) - (b.excludedSubscriptions || 0);
      } else if (packageSortKey === 'newSubscriptions') {
        cmp = (a.newSubscriptions || 0) - (b.newSubscriptions || 0);
      } else if (packageSortKey === 'expired') {
        cmp = (a.expired || 0) - (b.expired || 0);
      } else if (packageSortKey === 'churn') {
        cmp = (a.churn || 0) - (b.churn || 0);
      } else if (packageSortKey === 'arpu') {
        const vA = a.arpu === null ? -1 : a.arpu;
        const vB = b.arpu === null ? -1 : b.arpu;
        cmp = vA - vB;
      }
      return packageSortAsc ? cmp : -cmp;
    });
  }

  document.querySelectorAll('[data-sort-pkgsum]').forEach(th => {
    const key = th.dataset.sortPkgsum;
    const indicator = th.querySelector('.sort-indicator');
    if (packageSortKey === key) {
      th.setAttribute('aria-sort', packageSortAsc ? 'ascending' : 'descending');
      if (indicator) indicator.textContent = packageSortAsc ? ' ↑' : ' ↓';
    } else {
      th.removeAttribute('aria-sort');
      if (indicator) indicator.textContent = '';
    }
  });

  table.innerHTML = rows.map(row => `<tr class="summary-row summary-row-package"><th scope="row">${phase3Cell(row.package)}</th><td>${row.customers}</td><td>${row.activeCustomers}</td><td>${row.hasBilledRevenue ? phase3Cell(formatAmount(row.billedRevenue)) : 'No bill snapshots'}</td><td>${row.hasBillHistory ? phase3Cell(formatAmount(row.outstanding)) : 'No bill entries'}</td><td>${row.excludedSubscriptions}</td><td>${row.newSubscriptions}</td><td>${row.expired}</td><td>${row.churn}</td><td>${row.arpu === null ? 'Not set' : `<strong class="summary-arpu">${phase3Cell(formatAmount(row.arpu))}</strong>`}</td></tr>`).join('');
}
let inventorySortKey = 'name';
let inventorySortAsc = true;
let inventoryCategoryFilter = 'all';
let inventoryStockFilter = 'all';
let inventorySearchQuery = '';

let loanSearchQuery = '', loanDirectionFilter = 'all';
function renderLoans() {
  const entries = loadLoans();
  const totals = loanGrandTotals(entries);
  const summaries = loanPersonSummaries(entries);
  const metric = (id, value) => { const node = $(`#${id}`); if (node) node.textContent = value; };
  metric('loanTotalDena', totals.entryCount ? formatAmount(totals.dena) : 'No loans recorded');
  metric('loanTotalLena', totals.entryCount ? formatAmount(totals.lena) : 'No loans recorded');
  metric('loanNetPosition', totals.entryCount ? (totals.net > 0 ? `${formatAmount(totals.net)} to receive` : totals.net < 0 ? `${formatAmount(-totals.net)} to pay` : 'Settled') : 'No loans recorded');
  metric('loanOpenPeople', totals.entryCount ? `${totals.outstandingPersonCount} of ${totals.personCount}` : 'No loans recorded');
  const options = $('#loanPersonOptions'); if (options) options.innerHTML = summaries.map(person => `<option value="${escapeHtml(person.name)}"></option>`).join('');
  const filtered = filterLoanPersons(summaries, { query: loanSearchQuery, direction: loanDirectionFilter });
  const cards = $('#loanPersonCards');
  if (cards) cards.innerHTML = filtered.map(person => {
    const netLabel = person.net > 0 ? `${formatAmount(person.net)} to receive` : person.net < 0 ? `${formatAmount(-person.net)} to pay` : 'Settled';
    const entriesHtml = person.entries.map(entry => `<div class="area-intel-metric"><span>${escapeHtml(entry.date || 'No date')} · ${entry.kind === 'repayment' ? 'Repayment' : 'Loan'} · ${entry.direction === 'dena' ? 'Dena hai' : 'Lena hai'}${entry.note ? ` · ${escapeHtml(entry.note)}` : ''}</span><strong>${escapeHtml(formatAmount(entry.amount))} <button type="button" class="secondary-button btn-sm" data-delete-loan-entry="${escapeHtml(entry.id)}" aria-label="Delete this loan entry">Delete</button></strong></div>`).join('');
    const repayButtons = `${person.dena > 0 ? `<button type="button" class="secondary-button btn-sm" data-loan-repay-person="${escapeHtml(person.name)}" data-loan-repay-direction="dena">Repay dena</button>` : ''}${person.lena > 0 ? `<button type="button" class="secondary-button btn-sm" data-loan-repay-person="${escapeHtml(person.name)}" data-loan-repay-direction="lena">Collect lena</button>` : ''}`;
    return `<article class="area-intel-card"><header class="area-intel-card-header"><h4>${escapeHtml(person.name)}</h4></header>${person.phone ? `<p class="area-intel-no-zone">${escapeHtml(person.phone)}</p>` : ''}<div class="area-intel-metrics"><div class="area-intel-metric"><span>Dena hai</span><strong>${escapeHtml(formatAmount(person.dena))}</strong></div><div class="area-intel-metric"><span>Lena hai</span><strong>${escapeHtml(formatAmount(person.lena))}</strong></div><div class="area-intel-metric"><span>Net</span><strong>${escapeHtml(netLabel)}</strong></div>${entriesHtml}</div>${repayButtons ? `<div class="area-intel-section"><div class="area-intel-header-actions">${repayButtons}</div></div>` : ''}</article>`;
  }).join('');
  const empty = $('#loanEmpty'); if (empty) empty.hidden = entries.length > 0;
  const filterEmpty = $('#loanFilterEmpty'); if (filterEmpty) filterEmpty.hidden = !(entries.length > 0 && filtered.length === 0);
  const count = $('#loanPersonCount'); if (count) count.textContent = `${filtered.length} of ${summaries.length} people`;
  cards?.querySelectorAll('[data-delete-loan-entry]').forEach(button => button.addEventListener('click', async () => {
    const current = loadLoans();
    const entry = current.find(row => row.id === button.dataset.deleteLoanEntry);
    if (!entry) return;
    if (!await appConfirm({ tone: 'danger', title: 'Delete this loan entry?', subject: `${entry.person} · ${entry.direction === 'dena' ? 'Dena hai' : 'Lena hai'} · ${formatAmount(entry.amount)} · ${entry.date}`, message: 'This will change this person’s loan balances.', confirmLabel: 'Delete entry' })) return;
    try { saveLoans(deleteLoanEntry(current, entry.id)); renderLoans(); toast('Loan entry deleted from this device.', { type: 'success', title: 'Deleted' }); } catch (error) { toast(error.message, { type: 'error' }); }
  }));
  cards?.querySelectorAll('[data-loan-repay-person]').forEach(button => button.addEventListener('click', () => {
    const personInput = $('#loanPerson'); if (personInput) personInput.value = button.dataset.loanRepayPerson || '';
    const directionInput = $('#loanDirection'); if (directionInput) directionInput.value = button.dataset.loanRepayDirection || '';
    const kindInput = $('#loanKind'); if (kindInput) kindInput.value = 'repayment';
    const form = $('#loanForm'); if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const amountInput = $('#loanAmount'); if (amountInput) amountInput.focus();
  }));
}
function renderInventory() {
  const summary=inventorySummary(state),items=summary.items;
  const metric=(id,value)=>{const node=$(`#${id}`);if(node)node.textContent=value;};
  metric('inventoryTotalStock',summary.hasMovements?`${items.filter(item=>item.hasMovements).length} item types`:'Not set');
  metric('inventoryOnuStock',readableStock(items,'ONU'));metric('inventoryRouterStock',readableStock(items,'Router'));metric('inventoryFiberStock',readableStock(items,'Fiber cable'));metric('inventoryConnectorStock',readableStock(items,'Connector'));metric('inventoryAdapterStock',readableStock(items,'Adapter / power supply'));
  metric('inventoryLowStock',summary.hasMovements?String(summary.lowStockItems):'Not set');metric('inventoryInstalled',summary.hasMovements?String(summary.installed):'Not set');metric('inventoryDamaged',summary.hasMovements?String(summary.damaged):'Not set');metric('inventoryReturned',summary.hasMovements?String(summary.returned):'Not set');
  metric('inventoryValue',summary.hasMovements?formatAmount(summary.availableValue):'Not set');

  const allItems = items;
  const filteredItems = allItems.filter(item => {
    if (inventoryCategoryFilter !== 'all' && item.category !== inventoryCategoryFilter) return false;
    if (inventoryStockFilter !== 'all') {
      if (inventoryStockFilter === 'low') {
        if (!item.hasMovements || item.available > item.minimumStock) return false;
      } else if (inventoryStockFilter === 'out') {
        if (!item.hasMovements || item.available > 0) return false;
      } else if (inventoryStockFilter === 'in') {
        if (!item.hasMovements || item.available <= item.minimumStock) return false;
      } else if (inventoryStockFilter === 'unrecorded') {
        if (item.hasMovements) return false;
      }
    }
    if (inventorySearchQuery) {
      const q = inventorySearchQuery.toLowerCase();
      const name = (item.name || '').toLowerCase();
      const cat = (item.category || '').toLowerCase();
      const notes = (item.notes || '').toLowerCase();
      if (!name.includes(q) && !cat.includes(q) && !notes.includes(q)) return false;
    }
    return true;
  });

  filteredItems.sort((a, b) => {
    let cmp = 0;
    if (inventorySortKey === 'name') {
      cmp = (a.name || '').localeCompare(b.name || '');
    } else if (inventorySortKey === 'category') {
      cmp = (a.category || '').localeCompare(b.category || '');
    } else if (inventorySortKey === 'available') {
      const avA = a.hasMovements ? (a.available || 0) : -1;
      const avB = b.hasMovements ? (b.available || 0) : -1;
      cmp = avA - avB;
    } else if (inventorySortKey === 'unitCost') {
      const cA = a.unitCost !== null && a.unitCost !== undefined ? Number(a.unitCost) : -1;
      const cB = b.unitCost !== null && b.unitCost !== undefined ? Number(b.unitCost) : -1;
      cmp = cA - cB;
    } else if (inventorySortKey === 'value') {
      const vA = a.hasMovements && a.value !== null ? Number(a.value) : -1;
      const vB = b.hasMovements && b.value !== null ? Number(b.value) : -1;
      cmp = vA - vB;
    }
    return inventorySortAsc ? cmp : -cmp;
  });

  const countEl = $('#inventoryTableCount');
  if (countEl) {
    if (inventoryCategoryFilter !== 'all' || inventoryStockFilter !== 'all' || inventorySearchQuery) {
      countEl.textContent = `Showing ${filteredItems.length} of ${allItems.length} items`;
    } else {
      countEl.textContent = allItems.length ? `${allItems.length} item definitions` : '';
    }
  }

  document.querySelectorAll('[data-sort-inventory]').forEach(th => {
    const key = th.dataset.sortInventory;
    const indicator = th.querySelector('.sort-indicator');
    if (inventorySortKey === key) {
      th.setAttribute('aria-sort', inventorySortAsc ? 'ascending' : 'descending');
      if (indicator) indicator.textContent = inventorySortAsc ? ' ↑' : ' ↓';
    } else {
      th.removeAttribute('aria-sort');
      if (indicator) indicator.textContent = '';
    }
  });

  const itemsTable=$('#inventoryItemsTable');
  const itemCards=$('#inventoryItemCards');
  // Inventory redesign (2026-10-29): ONE status computation shared by the
  // desktop table row and the phone card — same thresholds and pill markup
  // as before (unrecorded / out at 0 / low at or below minimum / in stock),
  // matching the stock-level filter semantics above. Presentation only.
  const inventoryItemStatus=(item)=>{
    if (!item.hasMovements) return {pill:'<span class="stock-status-pill pill-muted">Unrecorded</span>',level:'unrecorded'};
    if (item.available <= 0) return {pill:'<span class="stock-status-pill pill-danger">Out of stock</span>',level:'out'};
    if (item.available <= item.minimumStock) return {pill:'<span class="stock-status-pill pill-warning">Low stock</span>',level:'low'};
    return {pill:'<span class="stock-status-pill pill-success">In stock</span>',level:'in'};
  };
  itemsTable.innerHTML=filteredItems.map(item=>{
    const statusPill = inventoryItemStatus(item).pill;
    const formattedAvail = item.hasMovements ? new Intl.NumberFormat('en-PK',{maximumFractionDigits:2}).format(item.available) : 'Not recorded';
    return `<tr><th scope="row">${phase3Cell(item.name)}</th><td>${phase3Cell(item.category)}</td><td><div class="stock-avail-cell"><span class="stock-qty">${formattedAvail}</span> ${statusPill}</div></td><td>${phase3Cell(item.unit)}</td><td>${new Intl.NumberFormat('en-PK',{maximumFractionDigits:2}).format(item.minimumStock)}</td><td>${item.unitCost===null||item.unitCost===undefined?'Not set':phase3Cell(formatAmount(item.unitCost))}</td><td>${item.hasMovements&&item.value!==null?phase3Cell(formatAmount(item.value)):'Not set'}</td><td>${item.hasMovements?`${item.installed} / ${item.damaged} / ${item.returned}`:'Not recorded'}</td><td class="inventory-actions"><button type="button" class="edit-payment" data-edit-inventory="${phase3Cell(item.id)}">Edit</button></td></tr>`;
  }).join('');
  if(itemCards){
    itemCards.innerHTML=filteredItems.map(item=>{
      const status=inventoryItemStatus(item);
      const formattedAvail = item.hasMovements ? new Intl.NumberFormat('en-PK',{maximumFractionDigits:2}).format(item.available) : 'Not recorded';
      const levelClass=status.level==='out'?' inventory-item-card--out':status.level==='low'?' inventory-item-card--low':'';
      return `<article class="area-intel-card inventory-item-card${levelClass}"><header class="area-intel-card-header"><h4>${phase3Cell(item.name)}</h4><span class="inventory-item-chip">${phase3Cell(item.category)}</span></header><div class="inventory-item-figure"><span class="inventory-item-figure-qty">${formattedAvail}</span>${item.hasMovements?`<span class="inventory-item-figure-unit">${phase3Cell(item.unit)} available</span>`:''}${status.pill}</div><div class="area-intel-metrics"><div class="area-intel-metric"><span>Minimum</span><strong>${new Intl.NumberFormat('en-PK',{maximumFractionDigits:2}).format(item.minimumStock)} ${phase3Cell(item.unit)}</strong></div><div class="area-intel-metric"><span>Unit cost</span><strong>${item.unitCost===null||item.unitCost===undefined?'Not set':phase3Cell(formatAmount(item.unitCost))}</strong></div><div class="area-intel-metric"><span>Available value</span><strong>${item.hasMovements&&item.value!==null?phase3Cell(formatAmount(item.value)):'Not set'}</strong></div><div class="area-intel-metric"><span>Installed / damaged / returned</span><strong>${item.hasMovements?`${item.installed} / ${item.damaged} / ${item.returned}`:'Not recorded'}</strong></div></div>${item.notes?`<p class="area-intel-no-zone">${phase3Cell(item.notes)}</p>`:''}<div class="inventory-item-card-actions"><button type="button" class="edit-payment" data-edit-inventory="${phase3Cell(item.id)}">Edit</button></div></article>`;
    }).join('');
  }
  $('#inventoryItemsEmpty').hidden=allItems.length>0;
  const filterEmpty = $('#inventoryItemsFilterEmpty');
  if (filterEmpty) filterEmpty.hidden = !(allItems.length > 0 && filteredItems.length === 0);
  const itemSelect=$('#movementItemId'),selected=itemSelect.value;
  itemSelect.innerHTML='<option value="">Choose item</option>'+items.map(item=>`<option value="${phase3Cell(item.id)}">${phase3Cell(item.name)} · ${phase3Cell(item.category)} (${phase3Cell(item.unit)})</option>`).join('');
  if(items.some(item=>item.id===selected))itemSelect.value=selected;
  const customerSelect=$('#movementCustomerId'),selectedCustomer=customerSelect.value;
  customerSelect.innerHTML='<option value="">Not assigned</option>'+state.customers.map(customer=>`<option value="${phase3Cell(customer.id)}">#${customer.customerNumber} ${phase3Cell(customer.name)}</option>`).join('');
  if(state.customers.some(customer=>customer.id===selectedCustomer))customerSelect.value=selectedCustomer;
  $('#inventoryMovementTable').innerHTML=summary.movements.map(row=>{const customer=state.customers.find(item=>item.id===row.customerId);const assignment=customer?`#${customer.customerNumber} ${phase3Cell(customer.name)}`:row.customerNameSnapshot?`#${phase3Cell(row.customerNumberSnapshot)} ${phase3Cell(row.customerNameSnapshot)} (profile removed)`: 'Not assigned';const action=({receive:'Receive / purchase',install:'Install / issue',issue:'Install / issue',return:'Return',damage:'Damage',correction:'Correction'})[row.type]??row.type;return `<tr><td>${phase3Cell(row.date)}</td><th scope="row">${phase3Cell(row.itemName)}</th><td>${phase3Cell(action)}</td><td>${new Intl.NumberFormat('en-PK',{maximumFractionDigits:2}).format(row.quantity)} ${phase3Cell(row.unit)}</td><td>${phase3Cell(row.fromState||'External')} → ${phase3Cell(row.toState||'Removed')}</td><td>${assignment}</td><td>${phase3Cell(row.notes||'Not recorded')}</td><td class="inventory-actions"><button type="button" class="delete-incident" data-delete-movement="${phase3Cell(row.id)}">Delete</button></td></tr>`;}).join('');
  $('#inventoryMovementsEmpty').hidden=summary.movements.length>0;
  const movDate=$('#movementDate');
  if(movDate&&!movDate.value) movDate.value=new Date(Date.now()+5*3600*1000).toISOString().slice(0,10);
  const bindInventoryEditButtons=(root)=>{root?.querySelectorAll('[data-edit-inventory]').forEach(button=>button.addEventListener('click',()=>{const item=items.find(row=>row.id===button.dataset.editInventory);if(!item)return;$('#inventoryItemId').value=item.id;$('#inventoryName').value=item.name;$('#inventoryCategory').value=item.category;$('#inventoryUnit').value=item.unit;$('#inventoryMinimum').value=item.minimumStock;$('#inventoryUnitCost').value=item.unitCost??'';$('#inventoryCreatedDate').value=item.createdDate??'';$('#inventoryNotes').value=item.notes??'';$('#inventoryItemSubmit').textContent='Save item changes';$('#inventoryItemCancel').hidden=false;$('#inventoryItemForm').scrollIntoView({behavior:'smooth',block:'center'});}));};
  bindInventoryEditButtons(itemsTable);
  bindInventoryEditButtons(itemCards);
  $('#inventoryMovementTable').querySelectorAll('[data-delete-movement]').forEach(button=>button.addEventListener('click',async()=>{const movement=summary.movements.find(row=>row.id===button.dataset.deleteMovement);if(!movement)return;if(!await appConfirm({tone:'danger',title:'Delete this stock movement?',subject:`${movement.type} · ${movement.quantity} ${movement.unit} · ${movement.date}`,message:'This may change all current inventory balances.',confirmLabel:'Delete movement'}))return;try{state=deleteStockMovement(state,movement.id);save();toast('Stock movement deleted from this device.',{type:'success',title:'Deleted'});}catch(error){toast(error.message,{type:'error'});}}));
  updateNavigationBadges(state);
}
let expenseSortKey = 'date';
let expenseSortAsc = false;
let expenseMonthFilter = 'all';
let expenseCategoryFilter = 'all';
let expenseSearchQuery = '';
let expenseActiveTab = 'ledger';
let nasirShareMonth = '';
let aqibShareMonth = '';

function syncExpenseTabs() {
  const tabs = { ledger: '#expenseTabLedger', nasir: '#expenseTabNasir', aqib: '#expenseTabAqib', settlement: '#expenseTabSettlement', overheads: '#expenseTabOverheads' };
  const panels = { ledger: '#expensesLedgerPanel', nasir: '#nasirSharePanel', aqib: '#aqibSharePanel', settlement: '#partnerSettlementPanel', overheads: '#overheadsPanel' };
  for (const [key, sel] of Object.entries(tabs)) { const btn = $(sel); if (btn) btn.setAttribute('aria-selected', String(key === expenseActiveTab)); }
  for (const [key, sel] of Object.entries(panels)) { const panel = $(sel); if (panel) panel.hidden = key !== expenseActiveTab; }
}
function partnerShareLine(label, value) { return `<div class="partner-share-row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`; }
function renderPartnerShare(key) {
  const name = key === 'nasir' ? 'Nasir' : 'Aqib';
  const monthSelect = $(key === 'nasir' ? '#nasirShareMonth' : '#aqibShareMonth');
  const host = $(key === 'nasir' ? '#nasirShareContent' : '#aqibShareContent');
  if (!monthSelect || !host) return;
  const report = buildPartnerShareReport(state, key === 'nasir' ? nasirShareMonth : aqibShareMonth, new Date());
  if (key === 'nasir') nasirShareMonth = report.month; else aqibShareMonth = report.month;
  const monthsKey = report.months.join(',');
  if (monthSelect.dataset.months !== monthsKey) {
    monthSelect.innerHTML = report.months.map(month => `<option value="${month}">${escapeHtml(monthName(month))}</option>`).join('');
    monthSelect.dataset.months = monthsKey;
  }
  monthSelect.value = report.month;
  const s = report.summary, prev = report.previousMonth, total = report.allTime;
  const profitLabel = s.profit >= 0 ? 'Profit (bachat)' : 'Loss';
  const profitClass = s.profit >= 0 ? 'partner-share-profit' : 'partner-share-loss';
  const shareNote = s.profit > 0 ? '50% of this month’s profit' : (s.profit === 0 ? 'No profit, no share this month' : 'No share on a loss month — the loss is shown above');
  const breakdown = s.categoryBreakdown.length
    ? s.categoryBreakdown.map(row => partnerShareLine(`${row.category} · ${row.count} entr${row.count === 1 ? 'y' : 'ies'}`, formatAmount(row.amount))).join('')
    : '<p class="phase3-note">No expenses recorded this month.</p>';
  const history = report.history.map(row => {
    const rowProfit = row.profit >= 0 ? `Profit ${formatAmount(row.profit)}` : `Loss ${formatAmount(-row.profit)}`;
    return `<div class="partner-share-history-row"><strong>${escapeHtml(monthName(row.month))}</strong><small>Revenue ${formatAmount(row.revenue)} · Expenses ${formatAmount(row.expenses)} · ${rowProfit} · ${name}’s share ${formatAmount(row.share)}</small></div>`;
  }).join('');
  host.innerHTML = `<div class="partner-share-grid">`
    + `<article class="phase3-metric"><span>Total revenue · ${escapeHtml(monthName(report.month))}</span><strong>${escapeHtml(formatAmount(s.revenue))}</strong><small>${s.receiptCount} bill collection receipt${s.receiptCount === 1 ? '' : 's'}</small></article>`
    + `<article class="phase3-metric"><span>Total expenses · ${escapeHtml(monthName(report.month))}</span><strong>${escapeHtml(formatAmount(s.expenses))}</strong><small>${s.expenseCount} recorded expense entr${s.expenseCount === 1 ? 'y' : 'ies'} · every category</small></article>`
    + `<article class="phase3-metric"><span>${profitLabel}</span><strong class="${profitClass}">${escapeHtml(formatAmount(s.profit))}</strong><small>Revenue − expenses</small></article>`
    + `<article class="phase3-metric"><span>${name}’s share (50%)</span><strong>${escapeHtml(formatAmount(s.share))}</strong><small>${shareNote}</small></article></div>`
    + `<p class="phase3-note">${escapeHtml(report.basis)}</p>`
    + `<h4>Expense breakdown · ${escapeHtml(monthName(report.month))}</h4><div>${breakdown}</div>`
    + `<h4>Previous month · ${escapeHtml(monthName(prev.month))}</h4><div>`
    + partnerShareLine('Revenue', formatAmount(prev.revenue)) + partnerShareLine('Expenses', formatAmount(prev.expenses))
    + partnerShareLine(prev.profit >= 0 ? 'Profit' : 'Loss', formatAmount(prev.profit)) + partnerShareLine(`${name}’s share`, formatAmount(prev.share)) + `</div>`
    + `<h4>All time so far</h4><div>`
    + partnerShareLine('Total revenue', formatAmount(total.revenue)) + partnerShareLine('Total expenses', formatAmount(total.expenses))
    + partnerShareLine(total.profit >= 0 ? 'Total profit' : 'Total loss', formatAmount(total.profit)) + partnerShareLine(`Total ${name} share paid out so far`, formatAmount(total.share)) + `</div>`
    + `<h4>Monthly history</h4><div class="partner-share-history">${history}</div>`;
}

let partnerSettlementMonth = '';
let partnerLedgerEditId = '';

function partnerSettlementRow(label, value) { return `<div class="partner-settlement-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`; }

// SISP-22: reconciliation tab. Profit/share come from buildPartnerShareReport
// via buildPartnerSettlementReport; this function only renders and saves
// ledger entries / slips, never bills, receipts or expenses.
function renderPartnerSettlement() {
  const monthSelect = $('#partnerSettlementMonth');
  const host = $('#partnerSettlementContent');
  if (!monthSelect || !host) return;
  const entries = loadPartnerLedgerEntries();
  const settlements = loadPartnerSettlements();
  // SISP-73: the persisted Installation CapEx toggle decides whether the
  // month's net installation subsidy is deducted before the 50/50 split.
  const report = buildPartnerSettlementReport(state, partnerSettlementMonth, entries, new Date(), { includeInstallationCapexInSplit: loadPartnerSettings().includeInstallationCapexInSplit });
  partnerSettlementMonth = report.month;
  const monthsKey = report.months.join(',');
  if (monthSelect.dataset.months !== monthsKey) {
    monthSelect.innerHTML = report.months.map(month => `<option value="${month}">${escapeHtml(monthName(month))}</option>`).join('');
    monthSelect.dataset.months = monthsKey;
  }
  monthSelect.value = report.month;
  const slip = settlementForMonth(settlements, report.month);
  const cards = report.perPartner.map(row => {
    const detail = row.isReceivable
      ? `<div class="partner-settlement-row partner-settlement-receivable"><span>Receivable — ${escapeHtml(row.partner)} owes the business</span><strong>${escapeHtml(formatAmount(row.receivableAmount))}</strong></div>`
      : `<div class="partner-settlement-row"><span>Net payout</span><strong>${escapeHtml(formatAmount(row.netPayout))}</strong></div>`;
    return `<article class="partner-settlement-card"><h4>${escapeHtml(row.partner)}</h4>`
      + partnerSettlementRow('Share (50% of profit)', formatAmount(row.share))
      + partnerSettlementRow(`Out-of-pocket purchases (${row.capitalCount})`, formatAmount(row.capital))
      + partnerSettlementRow(`Mid-month drawings (${row.drawingCount})`, formatAmount(row.drawings))
      + detail + `</article>`;
  }).join('');
  const profitLabel = report.profit >= 0 ? 'Net profit' : 'Net loss';
  // SISP-73: installation CapEx block — the toggle itself plus, when the
  // month had new installations, the net surplus/subsidy position and
  // (toggle ON) the distributable profit the shares came from.
  const capex = report.installationCapex;
  const capexBlock = `<div class="partner-capex-block"><label class="partner-capex-toggle"><input type="checkbox" id="partnerCapexToggle"${capex.included ? ' checked' : ''}> ${escapeHtml(t('capex_toggle_label'))}</label>`
    + (capex.installCount > 0
      ? partnerSettlementRow(capex.net >= 0 ? t('capex_net_surplus') : t('capex_net_subsidy'), `${formatAmount(Math.abs(capex.net))} · ${t('capex_install_count', null, { count: capex.installCount })}`)
        + (capex.hasPartial ? `<p class="phase3-note">${escapeHtml(t('capex_partial_note'))}</p>` : '')
        + (capex.included
          ? partnerSettlementRow(t('capex_distributable_profit'), formatAmount(report.distributableProfit))
          : `<p class="phase3-note">${escapeHtml(t('capex_tracked_separately'))}</p>`)
      : '')
    + `</div>`;
  host.innerHTML = `<div class="partner-share-grid">`
    + `<article class="phase3-metric"><span>Total revenue · ${escapeHtml(monthName(report.month))}</span><strong>${escapeHtml(formatAmount(report.revenue))}</strong><small>${report.receiptCount} bill collection receipt${report.receiptCount === 1 ? '' : 's'}</small></article>`
    + `<article class="phase3-metric"><span>Total expenses · ${escapeHtml(monthName(report.month))}</span><strong>${escapeHtml(formatAmount(report.expenses))}</strong><small>${report.expenseCount} recorded expense entr${report.expenseCount === 1 ? 'y' : 'ies'}</small></article>`
    + `<article class="phase3-metric"><span>${profitLabel}</span><strong>${escapeHtml(formatAmount(report.profit))}</strong><small>Revenue − expenses</small></article>`
    + `<article class="phase3-metric"><span>Each partner share (50%)</span><strong>${escapeHtml(formatAmount(report.share))}</strong><small>${report.profit > 0 ? '50% of this month’s profit' : 'No share on a loss / zero month'}</small></article></div>`
    + capexBlock
    + `<div class="partner-settlement-cards">${cards}</div>`
    + `<p class="phase3-note">${escapeHtml(report.basis)}</p>`;
  const capexToggle = $('#partnerCapexToggle');
  if (capexToggle) capexToggle.addEventListener('change', () => {
    savePartnerSettings({ includeInstallationCapexInSplit: capexToggle.checked });
    toast(t(capexToggle.checked ? 'capex_toggle_on' : 'capex_toggle_off'));
    renderPartnerSettlement();
  });
  const statusEl = $('#partnerSettlementStatus');
  if (statusEl) {
    statusEl.textContent = slip
      ? (slip.status === 'reopened'
        ? `Saved slip for ${monthName(report.month)} was re-opened — confirm again to lock the current figures.`
        : `Saved slip for ${monthName(report.month)} is confirmed. Confirm again to replace it with the current figures.`)
      : `No saved slip for ${monthName(report.month)} yet — confirm below to lock these figures.`;
  }
  const waLink = $('#partnerSettlementWhatsAppLink');
  if (waLink) waLink.href = partnerSettlementWhatsAppUrl(generatePartnerSettlementWhatsAppText(report, slip));
  const reopenBtn = $('#partnerSettlementReopenBtn');
  if (reopenBtn) reopenBtn.disabled = !slip;
  const table = $('#partnerLedgerTable');
  const emptyEl = $('#partnerLedgerEmpty');
  if (table) {
    table.innerHTML = report.entries.map(row => {
      // SISP-68: shop-pickup drawings are owned by the SISP-1 settlement
      // record (convergent mirror) — badged and locked here like the
      // SISP-45/56 synced expense rows; edit them via the shop handover.
      const pickup = isShopPickupEntry(row);
      const noteCell = `${escapeHtml(row.note || '—')}${pickup ? ` <span class="partner-ledger-pickup-badge">${escapeHtml(t('partner_shop_pickup_badge'))}</span>` : ''}`;
      const actions = pickup
        ? '<span class="partner-ledger-pickup-locked">Synced from shop handover</span>'
        : `<button class="text-button" type="button" data-edit-partner-ledger="${escapeHtml(row.id)}">Edit</button> <button class="text-button" type="button" data-delete-partner-ledger="${escapeHtml(row.id)}">Delete</button>`;
      return `<tr><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.partner)}</td><td>${escapeHtml(row.type === 'drawing' ? 'Drawing — cash taken' : 'Capital — out-of-pocket')}</td><td>${escapeHtml(formatAmount(row.amount))}</td><td>${noteCell}</td><td>${actions}</td></tr>`;
    }).join('');
    table.querySelectorAll('[data-edit-partner-ledger]').forEach(button => button.addEventListener('click', () => {
      const entry = loadPartnerLedgerEntries().find(row => row.id === button.dataset.editPartnerLedger);
      if (!entry) return;
      partnerLedgerEditId = entry.id;
      $('#partnerLedgerId').value = entry.id;
      $('#partnerLedgerPartner').value = entry.partner;
      $('#partnerLedgerType').value = entry.type;
      $('#partnerLedgerAmount').value = entry.amount;
      $('#partnerLedgerDate').value = entry.date;
      $('#partnerLedgerNote').value = entry.note || '';
      $('#partnerLedgerSubmit').textContent = 'Save movement changes';
      $('#partnerLedgerCancel').hidden = false;
      $('#partnerLedgerForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
    table.querySelectorAll('[data-delete-partner-ledger]').forEach(button => button.addEventListener('click', async () => {
      const entry = loadPartnerLedgerEntries().find(row => row.id === button.dataset.deletePartnerLedger);
      if (!entry) return;
      if (!await appConfirm({ tone: 'danger', title: 'Delete this partner movement?', subject: `${entry.partner} · ${entry.type} · ${formatAmount(entry.amount)} · ${entry.date}`, message: 'The month’s reconciliation will be recomputed without it. Bills, receipts and expenses are untouched.', confirmLabel: 'Delete' })) return;
      savePartnerLedgerEntries(deletePartnerLedgerEntry(loadPartnerLedgerEntries(), entry.id));
      toast('Partner movement deleted from this device.');
      renderPartnerSettlement();
    }));
  }
  if (emptyEl) emptyEl.hidden = report.entries.length > 0;
  const dateInput = $('#partnerLedgerDate');
  if (dateInput && !dateInput.value && !partnerLedgerEditId) dateInput.value = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}
/* SISP-25 — WhatsApp Templates: Template Studio + 1-tap Campaign Queue.
   Templates live under sisp_wa_templates_v1 (never in the business ledger).
   The campaign steps unpaid customers one by one; Send & Next opens the
   WhatsApp draft and only then stamps lastRemindedAt on the customer. */
let overheadsMonth = '';
function renderOverheads() {
  const monthSelect = $('#overheadsMonth');
  const host = $('#overheadsTemplates');
  const postingsHost = $('#overheadsPostings');
  const summaryHost = $('#overheadsShareSummary');
  const statusEl = $('#overheadsStatus');
  if (!monthSelect || !host) return;
  const report = buildPartnerShareReport(state, overheadsMonth, new Date());
  overheadsMonth = report.month;
  const monthsKey = report.months.join(',');
  if (monthSelect.dataset.months !== monthsKey) {
    monthSelect.innerHTML = report.months.map(month => `<option value="${escapeHtml(month)}">${escapeHtml(monthName(month))}</option>`).join('');
    monthSelect.dataset.months = monthsKey;
  }
  monthSelect.value = report.month;
  const data = loadOverheads();
  const templates = resolveOverheadTemplates(data);
  const todayPkt = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  const defaultDate = report.month === todayPkt.slice(0, 7) ? todayPkt : `${report.month}-01`;
  host.innerHTML = templates.map(template => {
    const live = overheadPostingFor(data, state, template.id, report.month);
    const amountValue = template.defaultAmount === null || template.defaultAmount === undefined ? '' : template.defaultAmount;
    return `<div class="overheads-template-row"><div class="overheads-template-info"><strong>${escapeHtml(template.label)}</strong><small>Posts as ${escapeHtml(template.category)}</small>${live ? `<small class="overheads-posted">Posted \u2713 ${escapeHtml(formatAmount(live.amount))} on ${escapeHtml(live.date)}</small>` : ''}</div>`
      + `<label>Amount (PKR)<input type="number" min="0.01" step="0.01" inputmode="decimal" data-overhead-amount="${escapeHtml(template.id)}" value="${escapeHtml(String(amountValue))}" placeholder="Enter actual amount"></label>`
      + `<label>Date (PKT)<input type="date" data-overhead-date="${escapeHtml(template.id)}" value="${escapeHtml(defaultDate)}"></label>`
      + `<button class="primary-button" type="button" data-overhead-post="${escapeHtml(template.id)}" ${live ? 'disabled' : ''}>${live ? 'Posted' : 'Post to expense ledger'}</button></div>`;
  }).join('');
  host.querySelectorAll('[data-overhead-post]').forEach(button => button.addEventListener('click', () => {
    const templateId = button.dataset.overheadPost;
    const amountInput = host.querySelector(`[data-overhead-amount="${templateId}"]`);
    const dateInput = host.querySelector(`[data-overhead-date="${templateId}"]`);
    try {
      const result = postOverhead(state, loadOverheads(), templateId, { amount: amountInput?.value, date: dateInput?.value });
      state = result.state;
      save();
      saveOverheads(result.overheads);
      renderOverheads();
      renderDashboard();
      toast('Overhead posted to the expense ledger on this device.');
    } catch (error) { toast(error.message); }
  }));
  const saveDefaultsBtn = $('#overheadsSaveDefaultsBtn');
  if (saveDefaultsBtn && !saveDefaultsBtn.dataset.wired) {
    saveDefaultsBtn.dataset.wired = 'true';
    saveDefaultsBtn.addEventListener('click', () => {
      try {
        let next = loadOverheads();
        host.querySelectorAll('[data-overhead-amount]').forEach(input => {
          const templateId = input.dataset.overheadAmount;
          next = updateOverheadDefault(next, templateId, input.value === '' ? null : input.value);
        });
        saveOverheads(next);
        toast('Default overhead amounts saved on this device.');
        renderOverheads();
      } catch (error) { toast(error.message); }
    });
  }
  const expenseIds = new Set((state.expenses ?? []).map(row => row.id));
  const postings = [...data.postings].sort((a, b) => b.date.localeCompare(a.date) || b.month.localeCompare(a.month));
  if (postingsHost) {
    postingsHost.innerHTML = postings.length === 0 ? '' : postings.map(posting => {
      const template = templates.find(row => row.id === posting.templateId);
      const stale = !expenseIds.has(posting.expenseId);
      return `<div class="overheads-posting-row"><strong>${escapeHtml(template?.label ?? 'Unknown overhead')}</strong><span>${escapeHtml(monthName(posting.month))} · ${escapeHtml(formatAmount(posting.amount))} · ${escapeHtml(posting.date)}</span>${stale ? '<small class="overheads-stale">Expense deleted from the ledger — posting no longer counts</small>' : ''}${posting.note ? `<small>${escapeHtml(posting.note)}</small>` : ''}</div>`;
    }).join('');
  }
  const postingsEmpty = $('#overheadsPostingsEmpty');
  if (postingsEmpty) postingsEmpty.hidden = postings.length > 0;
  if (summaryHost) {
    const s = report.summary;
    summaryHost.innerHTML = `<article class="phase3-metric"><span>Revenue · ${escapeHtml(monthName(report.month))}</span><strong>${escapeHtml(formatAmount(s.revenue))}</strong><small>${s.receiptCount} receipt${s.receiptCount === 1 ? '' : 's'}</small></article>`
      + `<article class="phase3-metric"><span>Expenses · ${escapeHtml(monthName(report.month))}</span><strong>${escapeHtml(formatAmount(s.expenses))}</strong><small>${s.expenseCount} recorded entr${s.expenseCount === 1 ? 'y' : 'ies'} · every category</small></article>`
      + `<article class="phase3-metric"><span>${s.profit >= 0 ? 'Profit' : 'Loss'}</span><strong>${escapeHtml(formatAmount(s.profit))}</strong><small>Revenue \u2212 expenses</small></article>`
      + `<article class="phase3-metric"><span>Nasir share (50%)</span><strong>${escapeHtml(formatAmount(s.share))}</strong><small>${s.profit > 0 ? '50% of profit' : 'No share on a zero/loss month'}</small></article>`
      + `<article class="phase3-metric"><span>Aqib share (50%)</span><strong>${escapeHtml(formatAmount(s.share))}</strong><small>${s.profit > 0 ? '50% of profit' : 'No share on a zero/loss month'}</small></article>`;
  }
  if (statusEl) {
    const due = bandwidthDueStatus(state, data, new Date());
    statusEl.textContent = due.due
      ? `Upstream bandwidth bill for ${monthName(due.month)} is not yet paid — post it above so profit and partner shares stay true.`
      : `Upstream bandwidth bill for ${monthName(due.month)} is paid${due.paidVia === 'expense' ? ' (recorded directly in the expense ledger)' : ''}.`;
  }
}

let waStudioLang = {};
let waCampaign = null;
let waCampaignSent = 0;
const waTierLabel = tier => tier === 'broken' ? 'Broken waada' : tier === 'promised' ? 'Promised waada' : tier === 'active' ? 'No waada' : '—';
function waStudioVariant(id) { return waStudioLang[id] || 'roman'; }
function waRenderStudio() {
  const host = $('#waStudioCards');
  if (!host) return;
  const templates = getWaTemplates();
  host.innerHTML = templates.map(template => {
    const variant = waStudioVariant(template.id);
    const body = variant === 'urdu' ? template.urdu : template.roman;
    return `<article class="table-card wa-template-card"><div class="table-heading"><div><p class="eyebrow">${escapeHtml(WA_TEMPLATE_LABELS[template.id])}</p><h3>${escapeHtml(WA_TEMPLATE_LABELS[template.id])}</h3></div></div>`
      + `<p class="phase3-note">${escapeHtml(WA_TEMPLATE_DESCRIPTIONS[template.id])}</p>`
      + `<div class="table-filter-toolbar" role="group" aria-label="Template language"><button type="button" class="secondary-button" data-wa-lang="roman" data-wa-id="${template.id}" ${variant === 'roman' ? 'disabled' : ''}>Roman Urdu</button>`
      + `<button type="button" class="secondary-button" data-wa-lang="urdu" data-wa-id="${template.id}" ${variant === 'urdu' ? 'disabled' : ''}>اردو</button></div>`
      + `<textarea id="waTemplateText-${template.id}" rows="4" maxlength="1000" aria-label="${escapeHtml(WA_TEMPLATE_LABELS[template.id])} text">${escapeHtml(body)}</textarea>`
      + `<p class="phase3-note">Placeholders: ${WA_PLACEHOLDER_KEYS.map(key => `{${key}}`).join(' ')}</p>`
      + `<div class="form-actions"><button type="button" class="primary-button" data-wa-save="${template.id}">Save template</button></div></article>`;
  }).join('');
  host.querySelectorAll('[data-wa-lang]').forEach(btn => btn.addEventListener('click', () => {
    waStudioLang[btn.dataset.waId] = btn.dataset.waLang;
    waRenderStudio();
  }));
  host.querySelectorAll('[data-wa-save]').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.waSave;
    const value = $(`#waTemplateText-${id}`)?.value ?? '';
    updateWaTemplate(localStorage, id, { [waStudioVariant(id)]: value });
    toast(`${WA_TEMPLATE_LABELS[id]} template saved.`);
    waRenderStudio();
  }));
}
function waCampaignCardHtml() {
  if (!waCampaign) return '<p class="empty-state">Start a campaign below to step through unpaid customers one by one.</p>';
  if (waCampaign.index >= waCampaign.items.length) {
    return `<p class="empty-state">Campaign complete — ${waCampaignSent} reminder${waCampaignSent === 1 ? '' : 's'} sent.</p>`;
  }
  const item = waCampaign.items[waCampaign.index];
  const templates = getWaTemplates();
  const message = renderWaTemplateFor(templates, waCampaign.templateId, item.customer, { totalDue: item.balance }, waCampaign.variant);
  return `<article class="table-card"><div class="table-heading"><div><p class="eyebrow">CUSTOMER ${waCampaign.index + 1} OF ${waCampaign.items.length}</p><h3>${escapeHtml(item.customerName)}</h3></div></div>`
    + `<p class="phase3-note">Phone: ${escapeHtml(item.phone || 'Not recorded')} · Zone: ${escapeHtml(item.zone || 'Not set')} · ${waTierLabel(item.waadaTier)}${item.promiseDate ? ` (${escapeHtml(item.promiseDate)})` : ''} · Balance: ${formatAmount(item.balance)}${item.lastRemindedAt ? ` · Last reminded: ${escapeHtml(item.lastRemindedAt)}` : ''}</p>`
    + `<p class="phase3-note" style="white-space:pre-wrap">${escapeHtml(message)}</p>`
    + `<div class="form-actions"><button type="button" class="primary-button" id="waCampaignSendNext">Send &amp; Next</button><button type="button" class="secondary-button" id="waCampaignSkip">Skip</button></div></article>`;
}
function waRenderCampaignCurrent() {
  const progress = $('#waCampaignProgress');
  if (progress) progress.textContent = !waCampaign ? '' : (waCampaign.index >= waCampaign.items.length ? `Done — ${waCampaignSent} sent of ${waCampaign.items.length}` : `Customer ${waCampaign.index + 1} of ${waCampaign.items.length} · ${waCampaignSent} sent`);
  const host = $('#waCampaignCard');
  if (host) {
    host.innerHTML = waCampaignCardHtml();
    const send = $('#waCampaignSendNext');
    if (send) send.addEventListener('click', () => {
      const item = waCampaign.items[waCampaign.index];
      const message = renderWaTemplateFor(getWaTemplates(), waCampaign.templateId, item.customer, { totalDue: item.balance }, waCampaign.variant);
      const res = formatWhatsAppUrl(item.customer.phone || '', message);
      if (!res.validPhone || !res.url) { toast(`Phone missing or invalid for ${item.customerName}. Not marked as reminded.`); return; }
      window.open(res.url, '_blank');
      state = markCustomerLastReminded(state, item.customerId, getTodayDateString());
      const fresh = state.customers.find(c => String(c.id) === String(item.customerId));
      if (fresh) recordReminderDispatched({ customer: fresh, templateType: 'due', dueAmount: item.balance, customNote: `Campaign template: ${waCampaign.templateId}` });
      try { persistState(state, localStorage); } catch {}
      waCampaignSent++;
      waCampaign.index++;
      waRenderCampaignCurrent();
    });
    const skip = $('#waCampaignSkip');
    if (skip) skip.addEventListener('click', () => { waCampaign.index++; waRenderCampaignCurrent(); });
  }
}
function renderWaTemplates() {
  const zoneSelect = $('#waCampaignZone');
  if (zoneSelect) {
    const zones = [...new Set((state.customers || []).filter(c => !c.archived).map(c => String(c.zone ?? '').trim()).filter(Boolean))].sort();
    const current = zoneSelect.value || 'all';
    zoneSelect.innerHTML = '<option value="all">All zones</option>' + zones.map(zone => `<option value="${escapeHtml(zone)}">${escapeHtml(zone)}</option>`).join('');
    zoneSelect.value = zones.includes(current) ? current : 'all';
  }
  const templateSelect = $('#waCampaignTemplate');
  if (templateSelect && !templateSelect.dataset.waFilled) {
    templateSelect.dataset.waFilled = 'true';
    templateSelect.innerHTML = Object.keys(WA_TEMPLATE_LABELS).map(id => `<option value="${id}" ${id === 'politeReminder' ? 'selected' : ''}>${escapeHtml(WA_TEMPLATE_LABELS[id])}</option>`).join('');
  }
  waRenderStudio();
  waRenderCampaignCurrent();
  const start = $('#waCampaignStart');
  if (start && !start.dataset.waWired) {
    start.dataset.waWired = 'true';
    start.addEventListener('click', () => {
      const queue = buildCampaignQueue(state, {
        zone: $('#waCampaignZone')?.value || 'all',
        waadaTier: $('#waCampaignTier')?.value || 'all',
        todayString: getTodayDateString()
      });
      waCampaign = { items: queue.items, index: 0, templateId: $('#waCampaignTemplate')?.value || 'politeReminder', variant: $('#waCampaignLang')?.value || 'roman' };
      waCampaignSent = 0;
      if (!queue.items.length) toast('No unpaid customers match these filters.');
      waRenderCampaignCurrent();
    });
  }
}

/* Home Budget — personal household ledger. Kept fully apart from the business
   expense ledger: own storage key (sisp_home_budget_v1), own section, and no
   business code ever reads it, so home spending cannot touch profit or
   partner shares. */
let homeBudgetMonthFilter = 'all';
let homeBudgetCategoryFilter = 'all';
let homeBudgetSearchQuery = '';
function homeBudgetSelectedCategory() {
  const select = $('#homeBudgetCategory');
  if (!select) return '';
  if (select.value === '__custom__') return $('#homeBudgetCustomCategory')?.value.trim() ?? '';
  return select.value;
}
function clearHomeBudgetInlineErrors() {
  for (const id of ['homeBudgetDateError', 'homeBudgetAmountError', 'homeBudgetCategoryError', 'homeBudgetCustomCategoryError', 'homeBudgetNotesError']) {
    const el = $(`#${id}`);
    if (el) el.hidden = true;
  }
}
function showHomeBudgetInlineError(id, message) {
  const el = $(`#${id}`);
  if (el) { el.textContent = message; el.hidden = false; }
}
function resetHomeBudgetForm() {
  const form = $('#homeBudgetForm');
  if (form) form.reset();
  const idInput = $('#homeBudgetId');
  if (idInput) idInput.value = '';
  const submit = $('#homeBudgetSubmit');
  if (submit) submit.textContent = 'Record home expense';
  const cancel = $('#homeBudgetCancel');
  if (cancel) cancel.hidden = true;
  const customLabel = $('#homeBudgetCustomCategoryLabel');
  if (customLabel) customLabel.hidden = true;
  clearHomeBudgetInlineErrors();
}
function renderHomeBudget() {
  const entries = loadHomeBudgetExpenses();
  const summary = summarizeHomeBudget(entries);
  const allTimeEl = $('#homeBudgetAllTimeTotal');
  if (allTimeEl) allTimeEl.textContent = formatAmount(summary.allTimeTotal);
  const allTimeHelp = $('#homeBudgetAllTimeHelp');
  if (allTimeHelp) allTimeHelp.textContent = summary.count ? `${summary.count} ${summary.count === 1 ? 'entry' : 'entries'} · all months` : 'No home entries recorded';
  const monthRow = homeBudgetMonthFilter === 'all' ? null : summary.months.find(row => row.month === homeBudgetMonthFilter);
  const monthTotalEl = $('#homeBudgetMonthTotal');
  if (monthTotalEl) monthTotalEl.textContent = formatAmount(homeBudgetMonthFilter === 'all' ? summary.allTimeTotal : (monthRow?.total ?? 0));
  const monthHelp = $('#homeBudgetMonthHelp');
  if (monthHelp) monthHelp.textContent = homeBudgetMonthFilter === 'all' ? 'All months' : monthName(homeBudgetMonthFilter);
  const countEl = $('#homeBudgetEntryCount');
  if (countEl) countEl.textContent = String(summary.count);
  const countHelp = $('#homeBudgetEntryHelp');
  if (countHelp) countHelp.textContent = summary.count ? `${summary.count} ${summary.count === 1 ? 'entry' : 'entries'} recorded` : 'No home entries recorded';
  const monthFilter = $('#homeBudgetMonthFilter');
  if (monthFilter) {
    const months = homeBudgetMonths(entries);
    if (!months.includes(homeBudgetMonthFilter)) homeBudgetMonthFilter = 'all';
    monthFilter.innerHTML = '<option value="all">All months</option>' + months.map(month => `<option value="${escapeHtml(month)}"${month === homeBudgetMonthFilter ? ' selected' : ''}>${escapeHtml(monthName(month))}</option>`).join('');
    monthFilter.value = homeBudgetMonthFilter;
  }
  const categoryFilter = $('#homeBudgetCategoryFilter');
  if (categoryFilter) {
    const customs = homeBudgetCategories(entries).filter(category => !HOME_BUDGET_CATEGORIES.includes(category));
    const options = [...HOME_BUDGET_CATEGORIES, ...customs];
    if (homeBudgetCategoryFilter !== 'all' && !options.includes(homeBudgetCategoryFilter)) homeBudgetCategoryFilter = 'all';
    categoryFilter.innerHTML = '<option value="all">All categories</option>' + options.map(category => `<option value="${escapeHtml(category)}"${category === homeBudgetCategoryFilter ? ' selected' : ''}>${escapeHtml(category)}</option>`).join('');
    categoryFilter.value = homeBudgetCategoryFilter;
  }
  const monthTotalsEl = $('#homeBudgetMonthTotals');
  if (monthTotalsEl) {
    monthTotalsEl.innerHTML = summary.months.map(row => `<li class="home-budget-month-row"><span>${escapeHtml(monthName(row.month))} · ${row.count} ${row.count === 1 ? 'entry' : 'entries'}</span><strong>${escapeHtml(formatAmount(row.total))}</strong></li>`).join('');
  }
  const monthTotalsEmpty = $('#homeBudgetMonthTotalsEmpty');
  if (monthTotalsEmpty) monthTotalsEmpty.hidden = summary.months.length > 0;
  const filtered = filterHomeBudget(entries, { month: homeBudgetMonthFilter, category: homeBudgetCategoryFilter, query: homeBudgetSearchQuery });
  const sorted = sortHomeBudgetEntries(filtered);
  const listEl = $('#homeBudgetList');
  if (listEl) {
    listEl.innerHTML = sorted.map(entry => `<li class="home-budget-item"><div class="home-budget-item-head"><span class="home-budget-item-category">${escapeHtml(entry.category)}</span><strong class="home-budget-item-amount">${escapeHtml(formatAmount(entry.amount))}</strong></div><div class="home-budget-item-date">${escapeHtml(entry.date)}</div>${entry.notes ? `<p class="home-budget-item-notes">${escapeHtml(entry.notes)}</p>` : ''}<div class="home-budget-item-actions"><button class="secondary-button btn-sm" type="button" data-edit-home-budget="${escapeHtml(entry.id)}">Edit</button><button class="secondary-button btn-sm" type="button" data-delete-home-budget="${escapeHtml(entry.id)}">Delete</button></div></li>`).join('');
    listEl.querySelectorAll('[data-edit-home-budget]').forEach(button => button.addEventListener('click', () => {
      const row = entries.find(entry => entry.id === button.dataset.editHomeBudget);
      if (!row) return;
      const idInput = $('#homeBudgetId');
      if (idInput) idInput.value = row.id;
      const dateInput = $('#homeBudgetDate');
      if (dateInput) dateInput.value = row.date;
      const amountInput = $('#homeBudgetAmount');
      if (amountInput) amountInput.value = String(row.amount);
      const categorySelect = $('#homeBudgetCategory');
      const customLabel = $('#homeBudgetCustomCategoryLabel');
      const customInput = $('#homeBudgetCustomCategory');
      if (HOME_BUDGET_CATEGORIES.includes(row.category)) {
        if (categorySelect) categorySelect.value = row.category;
        if (customLabel) customLabel.hidden = true;
        if (customInput) customInput.value = '';
      } else {
        if (categorySelect) categorySelect.value = '__custom__';
        if (customLabel) customLabel.hidden = false;
        if (customInput) customInput.value = row.category;
      }
      const notesInput = $('#homeBudgetNotes');
      if (notesInput) notesInput.value = row.notes ?? '';
      const submit = $('#homeBudgetSubmit');
      if (submit) submit.textContent = 'Save correction';
      const cancel = $('#homeBudgetCancel');
      if (cancel) cancel.hidden = false;
      clearHomeBudgetInlineErrors();
      $('#homeBudgetForm')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
    listEl.querySelectorAll('[data-delete-home-budget]').forEach(button => button.addEventListener('click', async () => {
      const row = entries.find(entry => entry.id === button.dataset.deleteHomeBudget);
      if (!row) return;
      if (!await appConfirm({ tone: 'danger', title: 'Delete this home expense?', subject: `${formatAmount(row.amount)} · ${row.category} · ${row.date}`, message: 'It will be removed from this device\'s home budget only. Business records are never touched.', confirmLabel: 'Delete home expense' })) return;
      try {
        saveHomeBudgetExpenses(deleteHomeBudgetExpense(loadHomeBudgetExpenses(), row.id));
        toast('Home expense entry deleted from this device.');
        renderHomeBudget();
      } catch (error) {
        toast(error.message);
      }
    }));
  }
  const emptyEl = $('#homeBudgetEmpty');
  if (emptyEl) emptyEl.hidden = entries.length > 0;
  const filterEmptyEl = $('#homeBudgetFilterEmpty');
  if (filterEmptyEl) filterEmptyEl.hidden = entries.length === 0 || sorted.length > 0;
  const countEl2 = $('#homeBudgetCount');
  if (countEl2) countEl2.textContent = entries.length ? `${sorted.length} of ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} shown` : '';
  const dateInput = $('#homeBudgetDate');
  const idInput = $('#homeBudgetId');
  if (dateInput && !dateInput.value && !(idInput?.value)) dateInput.value = pakistanDateNow();
}
$('#homeBudgetCategory')?.addEventListener('change', event => {
  const customLabel = $('#homeBudgetCustomCategoryLabel');
  if (customLabel) customLabel.hidden = event.currentTarget.value !== '__custom__';
});
$('#homeBudgetForm')?.addEventListener('submit', event => {
  event.preventDefault();
  clearHomeBudgetInlineErrors();
  const date = $('#homeBudgetDate')?.value.trim() ?? '';
  const amountRaw = $('#homeBudgetAmount')?.value.trim() ?? '';
  const amount = Number(amountRaw);
  const category = homeBudgetSelectedCategory();
  let valid = true;
  if (!date) { showHomeBudgetInlineError('homeBudgetDateError', 'Pick a date for the home expense.'); valid = false; }
  if (!amountRaw || !Number.isFinite(amount) || amount <= 0) { showHomeBudgetInlineError('homeBudgetAmountError', 'Enter an amount above zero.'); valid = false; }
  if (!category) {
    if ($('#homeBudgetCategory')?.value === '__custom__') showHomeBudgetInlineError('homeBudgetCustomCategoryError', 'Type a category for the home expense.');
    else showHomeBudgetInlineError('homeBudgetCategoryError', 'Pick or type a category for the home expense.');
    valid = false;
  }
  if (!valid) { toast('Please correct the highlighted form errors.'); return; }
  const fields = { date, amount, category, notes: $('#homeBudgetNotes')?.value ?? '' };
  try {
    const id = $('#homeBudgetId')?.value;
    const current = loadHomeBudgetExpenses();
    saveHomeBudgetExpenses(id ? updateHomeBudgetExpense(current, id, fields) : addHomeBudgetExpense(current, fields));
    resetHomeBudgetForm();
    renderHomeBudget();
    toast(id ? 'Home expense correction saved on this device.' : 'Home expense recorded on this device.');
  } catch (error) {
    toast(error.message);
  }
});
$('#homeBudgetCancel')?.addEventListener('click', resetHomeBudgetForm);
$('#homeBudgetMonthFilter')?.addEventListener('change', event => { homeBudgetMonthFilter = event.currentTarget.value; renderHomeBudget(); });
$('#homeBudgetCategoryFilter')?.addEventListener('change', event => { homeBudgetCategoryFilter = event.currentTarget.value; renderHomeBudget(); });
$('#homeBudgetSearchInput')?.addEventListener('input', event => { homeBudgetSearchQuery = event.currentTarget.value.trim(); renderHomeBudget(); });
const resetHomeBudgetFiltersHandler = () => {
  homeBudgetMonthFilter = 'all';
  homeBudgetCategoryFilter = 'all';
  homeBudgetSearchQuery = '';
  const searchInput = $('#homeBudgetSearchInput');
  if (searchInput) searchInput.value = '';
  renderHomeBudget();
};
$('#homeBudgetClearFilters')?.addEventListener('click', resetHomeBudgetFiltersHandler);
$('#homeBudgetResetFiltersBtn')?.addEventListener('click', resetHomeBudgetFiltersHandler);function renderExpenses() {
  const payrollMonths=monthsForHistory();
  if(!payrollMonths.includes(selectedPayrollMonth))selectedPayrollMonth=payrollMonths[0];
  const payrollMonthSelect=$('#payrollMonth');
  if(!payrollMonthSelect.options.length)payrollMonthSelect.innerHTML=payrollMonths.map(month=>`<option value="${month}">${escapeHtml(monthName(month))}</option>`).join('');
  payrollMonthSelect.value=selectedPayrollMonth;
  const payroll=buildPayrollSummary(state,selectedPayrollMonth);
  $('#saadMonthlySalary').textContent=formatAmount(payroll.saadMonthlySalary);
  $('#saadEligibleCustomerCount').textContent=String(payroll.eligibleActivePaidCustomerCount);
  $('#saadSalaryDetail').textContent=`PKR ${payroll.saadBaseMonthlySalary.toLocaleString('en-PK')} base + PKR 200 × ${payroll.eligibleActivePaidCustomerCount} eligible customer${payroll.eligibleActivePaidCustomerCount===1?'':'s'}. Only post-${PAYROLL_RULES_EFFECTIVE_DATE} additions with current Active status, not archived, and a fully settled ${monthName(selectedPayrollMonth)} bill count.`;
  $('#saadAttendanceCount').textContent=payroll.attendanceDayCount?`${payroll.attendanceDayCount} unique day${payroll.attendanceDayCount===1?'':'s'}`:'No attendance entries';
  $('#umairWorkdayExpense').textContent=payroll.umairWorkdayCount?formatAmount(payroll.umairMonthlyExpense):'No workday entries';
  $('#umairWorkdayDetail').textContent=payroll.umairWorkdayCount?`${payroll.umairWorkdayCount} logged date${payroll.umairWorkdayCount===1?'':'s'} × PKR ${UMAIR_PER_LOGGED_WORKDAY.toLocaleString('en-PK')}`:'No recorded workdays; no amount is assumed.';
  $('#saadAttendanceList').innerHTML=payroll.attendanceDays.map(date=>`<li><time datetime="${date}">${date}</time><button type="button" class="delete-incident" data-remove-attendance="${date}">Remove</button></li>`).join('');
  $('#saadAttendanceEmpty').hidden=payroll.attendanceDays.length>0;
  $('#umairWorkdaysList').innerHTML=payroll.umairWorkdays.map(date=>`<li><time datetime="${date}">${date}</time><button type="button" class="delete-incident" data-remove-workday="${date}">Remove</button></li>`).join('');
  $('#umairWorkdaysEmpty').hidden=payroll.umairWorkdays.length>0;
  $('#saadAttendanceList').querySelectorAll('[data-remove-attendance]').forEach(button=>button.addEventListener('click',async()=>{const date=button.dataset.removeAttendance;if(!await appConfirm({tone:'danger',title:'Remove this attendance day?',subject:`Saad · ${date}`,message:"Removes Saad's manually logged attendance day from this device.",confirmLabel:'Remove day'}))return;try{state=removeSaadAttendanceDay(state,date);save();toast('Attendance date removed from this device.');}catch(error){toast(error.message);}}));
  $('#umairWorkdaysList').querySelectorAll('[data-remove-workday]').forEach(button=>button.addEventListener('click',async()=>{const date=button.dataset.removeWorkday;if(!await appConfirm({tone:'danger',title:'Remove this workday?',subject:`Umair · ${date}`,message:"Removes Umair's manually logged workday (PKR 1,000) from this device.",confirmLabel:'Remove workday'}))return;try{state=removeUmairWorkday(state,date);save();toast('Workday removed from this device.');}catch(error){toast(error.message);}}));
  const allRows=[...(state.expenses??[])];
  $('#expenseEntryCount').textContent=allRows.length?String(allRows.length):'No entries';
  $('#expenseEntryHelp').textContent=allRows.length?'Actual dated expenses recorded on this device.':'No expense entries recorded; not an assertion that spending was zero.';
  const current=buildPhase3Analytics(state,new Date()).currentMonth,monthRows=allRows.filter(row=>row.date.slice(0,7)===current);
  $('#expenseCurrentMonthTotal').textContent=monthRows.length?formatAmount(monthRows.reduce((sum,row)=>sum+Number(row.amount),0)):'No entries';

  const expenseMonths=[...new Set([...payrollMonths,...allRows.map(r=>r.date?r.date.slice(0,7):'')].filter(Boolean))].sort().reverse();
  const expenseMonthSelect=$('#expenseMonthFilter');
  if(expenseMonthSelect){
    const currentVal=expenseMonthFilter;
    expenseMonthSelect.innerHTML='<option value="all">All months</option>'+expenseMonths.map(month=>`<option value="${month}">${escapeHtml(monthName(month))}</option>`).join('');
    expenseMonthSelect.value=expenseMonths.includes(currentVal)?currentVal:'all';
    expenseMonthFilter=expenseMonthSelect.value;
  }

  const expenseAreaSelect=$('#expenseArea');
  if(expenseAreaSelect){
    const curVal=expenseAreaSelect.value;
    const areas=typeof getUniqueCustomerAreas==='function'?getUniqueCustomerAreas(state.customers||[]):[];
    const options=['<option value="">General / Unallocated</option>'].concat(areas.map(a=>`<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`));
    expenseAreaSelect.innerHTML=options.join('');
    if(curVal&&areas.includes(curVal))expenseAreaSelect.value=curVal;
  }

  const filteredRows = filterExpenseRows(allRows, {
    month: expenseMonthFilter,
    category: expenseCategoryFilter,
    query: expenseSearchQuery
  });

  const filteredTotal = filteredRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const filteredTotalEl = $('#expenseFilteredTotal');
  if (filteredTotalEl) filteredTotalEl.textContent = formatAmount(filteredTotal);
  const filteredHelpEl = $('#expenseFilteredHelp');
  if (filteredHelpEl) {
    const hasFilter = expenseMonthFilter !== 'all' || expenseCategoryFilter !== 'all' || Boolean(expenseSearchQuery);
    if (hasFilter) {
      filteredHelpEl.textContent = `${filteredRows.length} of ${allRows.length} entries matching filters`;
    } else {
      filteredHelpEl.textContent = allRows.length ? `${allRows.length} total entries` : 'No expense entries recorded';
    }
  }

  const categoryTotals = buildExpenseCategoryTotals(filteredRows);
  const categoryTotalsBody = $('#expenseCategoryTotalsBody');
  if (categoryTotalsBody) {
    const totalRow = `<tr><th scope="row">Total</th><td>${filteredRows.length}</td><td>${phase3Cell(formatAmount(filteredTotal))}</td></tr>`;
    categoryTotalsBody.innerHTML = categoryTotals.length
      ? categoryTotals.map(entry => `<tr><th scope="row">${phase3Cell(entry.category)}</th><td>${entry.count}</td><td>${phase3Cell(formatAmount(entry.total))}</td></tr>`).join('') + totalRow
      : `<tr><td colspan="3">No expenses match the current filters.</td></tr>`;
  }

  const sortedRows = sortExpenseRows(filteredRows, expenseSortKey, expenseSortAsc);

  $('#expenseTable').innerHTML = sortedRows.map(row => {
    // SISP-45: rows mirrored from the roznamcha carry roznamchaEntryId.
    // The roznamcha is their source of truth, so they show a provenance
    // badge and a hint instead of Edit/Delete — changing them here
    // would be overwritten by the next sync pass anyway.
    // SISP-56: rows mirrored from the Saad Visit Log carry saadPaymentId
    // and get the same treatment, with their own badge and hint.
    const synced = typeof row.roznamchaEntryId === 'string' && row.roznamchaEntryId !== '';
    const saadSynced = typeof row.saadPaymentId === 'string' && row.saadPaymentId !== '';
    const notesCell = `${phase3Cell(row.notes || 'Not recorded')}${synced ? ` <span class="expense-roznamcha-badge">${escapeHtml(t('exp_roznamcha_badge'))}</span>` : ''}${saadSynced ? ` <span class="expense-roznamcha-badge">${escapeHtml(t('exp_saad_badge'))}</span>` : ''}`;
    const actionsCell = (synced || saadSynced)
      ? `<span class="expense-roznamcha-hint">${escapeHtml(t(synced ? 'exp_roznamcha_synced_hint' : 'exp_saad_synced_hint'))}</span>`
      : `<button type="button" class="edit-payment" data-edit-expense="${phase3Cell(row.id)}">Edit</button> <button type="button" class="delete-incident" data-delete-expense="${phase3Cell(row.id)}">Delete</button>`;
    return `<tr><td>${phase3Cell(row.date)}</td><th scope="row">${phase3Cell(row.category)}</th><td>${phase3Cell(formatAmount(row.amount))}</td><td>${row.area ? `<span class="expense-area-badge">${escapeHtml(row.area)}</span>` : '<span class="expense-area-unallocated">Unallocated</span>'}</td><td>${notesCell}</td><td class="expense-actions">${actionsCell}</td></tr>`;
  }).join('');
  $('#expensesEmpty').hidden = allRows.length > 0;
  const filterEmpty = $('#expensesFilterEmpty');
  if (filterEmpty) filterEmpty.hidden = allRows.length === 0 || sortedRows.length > 0;
  const countBadge = $('#expenseTableCount');
  if (countBadge) {
    if (!allRows.length) {
      countBadge.textContent = '';
      countBadge.hidden = true;
    } else {
      countBadge.hidden = false;
      if (filteredRows.length === allRows.length) countBadge.textContent = `${allRows.length} expense${allRows.length === 1 ? '' : 's'}`;
      else countBadge.textContent = `Showing ${filteredRows.length} of ${allRows.length} expenses`;
    }
  }

  document.querySelectorAll('[data-sort-expense]').forEach(th => {
    const key = th.dataset.sortExpense;
    const isCurrent = key === expenseSortKey;
    th.setAttribute('aria-sort', isCurrent ? (expenseSortAsc ? 'ascending' : 'descending') : 'none');
    const indicator = th.querySelector('.sort-indicator');
    if (indicator) indicator.textContent = isCurrent ? (expenseSortAsc ? '▲' : '▼') : '⇅';
  });

  $('#expenseTable').querySelectorAll('[data-edit-expense]').forEach(button=>button.addEventListener('click',()=>{
    const row=allRows.find(item=>item.id===button.dataset.editExpense);
    if(!row)return;
    $('#expenseId').value=row.id;
    $('#expenseDate').value=row.date;
    $('#expenseAmount').value=row.amount;
    $('#expenseCategory').value=row.category;
    if($('#expenseArea'))$('#expenseArea').value=row.area??'';
    $('#expenseNotes').value=row.notes??'';
    $('#expenseSubmit').textContent='Save expense correction';
    $('#expenseCancel').hidden=false;
    clearExpenseInlineErrors();
    const notice=$('#expensePayrollPrefillNotice');if(notice)notice.hidden=true;
    $('#expenseForm').scrollIntoView({behavior:'smooth',block:'center'});
  }));
  $('#expenseTable').querySelectorAll('[data-delete-expense]').forEach(button=>button.addEventListener('click',async()=>{
    const row=allRows.find(item=>item.id===button.dataset.deleteExpense);
    if(!row)return;
    // SISP-80: expense deletion is restricted while the Owner PIN lock is active.
    if(!await requireOwnerPin('expense-delete'))return;
    const areaNote=row.area?` [${row.area}]`:'';
    if(!await appConfirm({tone:'danger',title:'Delete this expense?',subject:`${formatAmount(row.amount)} · ${row.category}${areaNote} · ${row.date}`,message:'It will be removed from this device\'s expense ledger, totals and exports.',confirmLabel:'Delete expense'}))return;
    try{
      state=deleteExpense(state,row.id);
      save();
      toast('Expense entry deleted from this device.');
    }catch(error){
      toast(error.message);
    }
  }));
  updateNavigationBadges(state);
  syncExpenseTabs();
  if (expenseActiveTab === 'nasir' || expenseActiveTab === 'aqib') renderPartnerShare(expenseActiveTab);
  if (expenseActiveTab === 'settlement') renderPartnerSettlement();
  if (expenseActiveTab === 'overheads') renderOverheads();
}
function renderPhase3() { renderAnalytics();renderInventory();renderExpenses();renderHomeBudget(); }
function resetInventoryForm() { $('#inventoryItemForm').reset();$('#inventoryItemId').value='';$('#inventoryMinimum').value='0';$('#inventoryItemSubmit').textContent='Save item definition';$('#inventoryItemCancel').hidden=true; }

function clearExpenseInlineErrors() {
  ['expenseDateError', 'expenseAmountError', 'expenseCategoryError', 'expenseAreaError', 'expenseNotesError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.hidden = true; }
  });
}

function showExpenseInlineErrors(errors) {
  clearExpenseInlineErrors();
  let firstEl = null;
  if (errors.date) {
    const el = document.getElementById('expenseDateError');
    if (el) { el.textContent = errors.date; el.hidden = false; }
    if (!firstEl) firstEl = document.getElementById('expenseDate');
  }
  if (errors.amount) {
    const el = document.getElementById('expenseAmountError');
    if (el) { el.textContent = errors.amount; el.hidden = false; }
    if (!firstEl) firstEl = document.getElementById('expenseAmount');
  }
  if (errors.category) {
    const el = document.getElementById('expenseCategoryError');
    if (el) { el.textContent = errors.category; el.hidden = false; }
    if (!firstEl) firstEl = document.getElementById('expenseCategory');
  }
  if (errors.area) {
    const el = document.getElementById('expenseAreaError');
    if (el) { el.textContent = errors.area; el.hidden = false; }
    if (!firstEl) firstEl = document.getElementById('expenseArea');
  }
  if (errors.notes) {
    const el = document.getElementById('expenseNotesError');
    if (el) { el.textContent = errors.notes; el.hidden = false; }
    if (!firstEl) firstEl = document.getElementById('expenseNotes');
  }
  if (firstEl && typeof firstEl.focus === 'function') firstEl.focus();
}

function resetExpenseForm() {
  $('#expenseForm').reset();
  $('#expenseId').value='';
  if($('#expenseArea'))$('#expenseArea').value='';
  $('#expenseSubmit').textContent='Record actual expense';
  $('#expenseCancel').hidden=true;
  const expNotice=$('#expenseDraftNotice');
  if(expNotice)expNotice.hidden=true;
  const prefillNotice=$('#expensePayrollPrefillNotice');
  if(prefillNotice)prefillNotice.hidden=true;
  clearExpenseInlineErrors();
}
$('#inventoryItemForm').addEventListener('submit',event=>{event.preventDefault();const data=new FormData(event.currentTarget),fields={name:data.get('name'),category:data.get('category'),unit:data.get('unit'),minimumStock:data.get('minimumStock'),unitCost:data.get('unitCost')||null,createdDate:data.get('createdDate')||null,notes:data.get('notes')};try{const id=data.get('itemId');state=id?updateInventoryItem(state,id,fields):addInventoryItem(state,fields);save();resetInventoryForm();toast(id?'Inventory item updated on this device.':'Item definition saved; no stock was added.');}catch(error){toast(error.message);}});
$('#inventoryItemCancel').addEventListener('click',resetInventoryForm);
$('#inventoryMovementForm').addEventListener('submit',event=>{event.preventDefault();const data=new FormData(event.currentTarget),fields={itemId:data.get('itemId'),type:data.get('type'),quantity:data.get('quantity'),date:data.get('date'),fromState:data.get('fromState'),toState:data.get('toState'),customerId:data.get('customerId'),notes:data.get('notes')};try{state=addStockMovement(state,fields);save();event.currentTarget.reset();const movDate=$('#movementDate');if(movDate)movDate.value=new Date(Date.now()+5*3600*1000).toISOString().slice(0,10);toast('Actual stock movement recorded on this device.');}catch(error){toast(error.message);}});
$('#loanForm').addEventListener('submit',event=>{event.preventDefault();const data=new FormData(event.currentTarget),fields={person:data.get('person'),phone:data.get('phone'),direction:data.get('direction'),kind:data.get('kind'),amount:data.get('amount'),date:data.get('date'),note:data.get('note')};try{saveLoans(addLoanEntry(loadLoans(),fields));event.currentTarget.reset();const loanDate=$('#loanDate');if(loanDate)loanDate.value=new Date(Date.now()+5*3600*1000).toISOString().slice(0,10);renderLoans();toast('Loan entry saved on this device.');}catch(error){toast(error.message);}});
$('#loanSearchInput').addEventListener('input',event=>{loanSearchQuery=event.currentTarget.value;renderLoans();});
$('#loanDirectionFilter').addEventListener('change',event=>{loanDirectionFilter=event.currentTarget.value;renderLoans();});
$('#clearLoanFilters').addEventListener('click',()=>{loanSearchQuery='';loanDirectionFilter='all';const q=$('#loanSearchInput');if(q)q.value='';const d=$('#loanDirectionFilter');if(d)d.value='all';renderLoans();});
$('#expenseForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  const rawFields={
    date:data.get('date'),
    amount:data.get('amount'),
    category:data.get('category'),
    area:data.get('area')||'',
    notes:data.get('notes')
  };
  const val=validateExpenseFormFields(rawFields);
  if(!val.valid){
    showExpenseInlineErrors(val.errors);
    const firstMsg=Object.values(val.errors)[0];
    toast(firstMsg||'Please correct the highlighted form errors.');
    return;
  }
  clearExpenseInlineErrors();
  const fields=val.cleanFields;
  try{
    const id=data.get('expenseId'),previous=id?state.expenses.find(row=>row.id===id):null;
    // SISP-45: a roznamcha-synced expense is never edited here — the
    // roznamcha owns it and the next sync pass would restore its values.
    if(previous?.roznamchaEntryId){toast(t('exp_roznamcha_edit_blocked_toast'));return;}
    // SISP-56: same for a Saad-Visit-Log-synced expense — the payment
    // record owns it and the next sync pass would restore its values.
    if(previous?.saadPaymentId){toast(t('exp_saad_edit_blocked_toast'));return;}
    if(previous&&!await appConfirm({tone:'warning',title:'Save this expense correction?',subject:`${formatAmount(previous.amount)} ${previous.category} · ${previous.date}`,message:`Change it to ${formatAmount(Number(fields.amount))} ${fields.category} on ${fields.date}.`,confirmLabel:'Save correction'}))return;
    state=id?updateExpense(state,id,fields):addExpense(state,fields);
    save();
    expenseDraftController?.clear();
    resetExpenseForm();
    toast(id?'Expense correction saved on this device.':'Actual expense recorded on this device.');
  }catch(error){
    toast(error.message);
  }
});
$('#expenseCancel').addEventListener('click',resetExpenseForm);
document.querySelectorAll('[data-sort-expense]').forEach(th=>{
  const toggle=()=>{
    const key=th.dataset.sortExpense;
    if(expenseSortKey===key){
      expenseSortAsc=!expenseSortAsc;
    }else{
      expenseSortKey=key;
      expenseSortAsc=(key==='category');
    }
    renderExpenses();
  };
  th.addEventListener('click',toggle);
  th.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){
      e.preventDefault();
      toggle();
    }
  });
});
$('#expenseMonthFilter')?.addEventListener('change',e=>{
  expenseMonthFilter=e.currentTarget.value;
  renderExpenses();
});
$('#expenseCategoryFilter')?.addEventListener('change',e=>{
  expenseCategoryFilter=e.currentTarget.value;
  renderExpenses();
});
$('#expenseSearchInput')?.addEventListener('input',e=>{
  expenseSearchQuery=e.currentTarget.value.trim();
  renderExpenses();
});
const resetExpenseFiltersHandler = () => {
  expenseMonthFilter = 'all';
  expenseCategoryFilter = 'all';
  expenseSearchQuery = '';
  const mSel = $('#expenseMonthFilter'); if (mSel) mSel.value = 'all';
  const cat = $('#expenseCategoryFilter'); if (cat) cat.value = 'all';
  const inp = $('#expenseSearchInput'); if (inp) inp.value = '';
  renderExpenses();
};
$('#clearExpenseFilters')?.addEventListener('click', resetExpenseFiltersHandler);
$('#resetExpenseFiltersInlineBtn')?.addEventListener('click', resetExpenseFiltersHandler);
document.querySelectorAll('[data-sort-inventory]').forEach(th=>{
  const toggle=()=>{
    const key=th.dataset.sortInventory;
    if(inventorySortKey===key){
      inventorySortAsc=!inventorySortAsc;
    }else{
      inventorySortKey=key;
      inventorySortAsc=(key==='name'||key==='category');
    }
    renderInventory();
  };
  th.addEventListener('click',toggle);
  th.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){
      e.preventDefault();
      toggle();
    }
  });
});
$('#inventoryCategoryFilter')?.addEventListener('change',e=>{
  inventoryCategoryFilter=e.currentTarget.value;
  renderInventory();
});
$('#inventoryStockFilter')?.addEventListener('change',e=>{
  inventoryStockFilter=e.currentTarget.value;
  renderInventory();
});
$('#inventorySearchInput')?.addEventListener('input',e=>{
  inventorySearchQuery=e.currentTarget.value.trim();
  renderInventory();
});
$('#clearInventoryFilters')?.addEventListener('click',()=>{
  inventoryCategoryFilter='all';
  inventoryStockFilter='all';
  inventorySearchQuery='';
  const cat=$('#inventoryCategoryFilter');if(cat)cat.value='all';
  const stk=$('#inventoryStockFilter');if(stk)stk.value='all';
  const inp=$('#inventorySearchInput');if(inp)inp.value='';
  renderInventory();
});
document.querySelectorAll('[data-sort-area]').forEach(th=>{
  const toggle=()=>{
    const key=th.dataset.sortArea;
    if(areaSortKey===key){
      areaSortAsc=!areaSortAsc;
    }else{
      areaSortKey=key;
      areaSortAsc=(key==='area');
    }
    renderAreaIntelligence();
  };
  th.addEventListener('click',toggle);
  th.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){
      e.preventDefault();
      toggle();
    }
  });
});
document.querySelectorAll('[data-sort-pkgsum]').forEach(th => {
  const toggle = () => {
    const key = th.dataset.sortPkgsum;
    if (packageSortKey === key) {
      packageSortAsc = !packageSortAsc;
    } else {
      packageSortKey = key;
      packageSortAsc = (key === 'package');
    }
    renderPackageSummaryTable();
  };
  th.addEventListener('click', toggle);
  th.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
});
function wirePhoneValidationHelper(inputId,hintId){
  const input=$(inputId);
  const hint=$(hintId);
  if(!input||!hint)return;
  const update=()=>{
    const val=input.value;
    const res=validatePakistanPhone(val);
    if(res.empty){
      hint.textContent='';
      hint.className='phone-validation-hint';
      input.removeAttribute('aria-invalid');
    }else if(res.valid){
      hint.textContent=res.message;
      hint.className='phone-validation-hint '+(res.tip?'tip':'valid');
      input.removeAttribute('aria-invalid');
    }else{
      hint.textContent=res.message;
      hint.className='phone-validation-hint '+(res.tip?'tip':'invalid');
      if(!res.tip)input.setAttribute('aria-invalid','true');
      else input.removeAttribute('aria-invalid');
    }
  };
  input.addEventListener('input',update);
}
wirePhoneValidationHelper('#phoneInput','#phoneValidationHint');
wirePhoneValidationHelper('#newCustomerPhone','#newCustomerPhoneHint');
const profilePhoneEl = $('#phoneInput');
if (profilePhoneEl) wirePhoneInputMask(profilePhoneEl);
const newCustPhoneEl = $('#newCustomerPhone');
if (newCustPhoneEl) wirePhoneInputMask(newCustPhoneEl);

function wireCnicValidationHelper(inputId,hintId){
  const input=$(inputId);
  const hint=$(hintId);
  if(!input||!hint)return;
  const update=()=>{
    const val=input.value;
    const res=validateCustomerCnic(val);
    if(res.empty){
      hint.textContent='';
      hint.className='cnic-validation-hint';
      input.removeAttribute('aria-invalid');
    }else if(res.valid){
      hint.textContent=res.message;
      hint.className='cnic-validation-hint '+(res.tip?'tip':'valid');
      input.removeAttribute('aria-invalid');
    }else{
      hint.textContent=res.message;
      hint.className='cnic-validation-hint '+(res.tip?'tip':'invalid');
      if(!res.tip)input.setAttribute('aria-invalid','true');
      else input.removeAttribute('aria-invalid');
    }
  };
  input.addEventListener('input',update);
}
function wireCnicInputMask(inputEl){
  if(!inputEl)return;
  inputEl.addEventListener('input',()=>{
    const raw=inputEl.value;
    const digits=raw.replace(/\D/g,'').slice(0,13);
    let formatted=digits;
    if(digits.length>12){
      formatted=`${digits.slice(0,5)}-${digits.slice(5,12)}-${digits.slice(12)}`;
    }else if(digits.length>5){
      formatted=`${digits.slice(0,5)}-${digits.slice(5)}`;
    }
    if(formatted!==raw&&raw.length>=formatted.length-1){
      inputEl.value=formatted;
    }
  });
}
wireCnicValidationHelper('#cnicInput','#cnicValidationHint');
wireCnicValidationHelper('#newCustomerCnic','#newCustomerCnicHint');
const profileCnicEl = $('#cnicInput');
if (profileCnicEl) wireCnicInputMask(profileCnicEl);
const newCustCnicEl = $('#newCustomerCnic');
if (newCustCnicEl) wireCnicInputMask(newCustCnicEl);
['#monthlySellingAmountInput','#monthlyPurchaseCostInput','#expenseAmount','#movementQuantity','#inventoryMinimum','#inventoryUnitCost'].forEach(sel=>{
  const node=$(sel);
  if(!node)return;
  node.addEventListener('input',()=>{
    const val=node.value;
    if(val!==''&&Number(val)<0){
      node.setAttribute('aria-invalid','true');
    }else{
      node.removeAttribute('aria-invalid');
    }
  });
});
$('#saadAttendanceForm').addEventListener('submit',event=>{
  event.preventDefault();
  let date=new FormData(event.currentTarget).get('date');
  const errEl=$('#saadAttendanceError');
  const res=validateStaffAttendanceDate(date,state.saadAttendanceDays??[],'Saad attendance date');
  if(!res.valid){
    if(errEl){errEl.textContent=res.error;errEl.hidden=false;}
    toast(res.error);
    return;
  }
  date=res.date;
  if(errEl){errEl.textContent='';errEl.hidden=true;}
  try{
    state=addSaadAttendanceDay(state,date);
    save();
    event.currentTarget.reset();
    toast('Saad attendance day recorded on this device.');
  }catch(error){
    toast(error.message);
  }
});

$('#umairWorkdayForm').addEventListener('submit',event=>{
  event.preventDefault();
  let date=new FormData(event.currentTarget).get('date');
  const errEl=$('#umairWorkdayError');
  const res=validateStaffAttendanceDate(date,state.umairWorkdays??[],'Umair workday date');
  if(!res.valid){
    if(errEl){errEl.textContent=res.error;errEl.hidden=false;}
    toast(res.error);
    return;
  }
  date=res.date;
  if(errEl){errEl.textContent='';errEl.hidden=true;}
  try{
    state=addUmairWorkday(state,date);
    save();
    event.currentTarget.reset();
    toast('Umair workday recorded on this device.');
  }catch(error){
    toast(error.message);
  }
});

$('#logSaadTodayBtn')?.addEventListener('click',()=>{
  const input=$('#saadAttendanceDate');
  if(input){
    input.value=localDate();
    input.focus();
    const errEl=$('#saadAttendanceError');
    if(errEl){errEl.textContent='';errEl.hidden=true;}
  }
});

$('#logUmairTodayBtn')?.addEventListener('click',()=>{
  const input=$('#umairWorkdayDate');
  if(input){
    input.value=localDate();
    input.focus();
    const errEl=$('#umairWorkdayError');
    if(errEl){errEl.textContent='';errEl.hidden=true;}
  }
});

$('#recordSaadSalaryExpenseBtn')?.addEventListener('click',()=>{
  const prefill=buildPayrollExpensePrefill('saad',state,selectedPayrollMonth);
  $('#expenseId').value='';
  $('#expenseDate').value=prefill.date;
  $('#expenseAmount').value=prefill.amount;
  $('#expenseCategory').value=prefill.category;
  if($('#expenseArea'))$('#expenseArea').value=prefill.area||'';
  $('#expenseNotes').value=prefill.notes;
  $('#expenseSubmit').textContent='Record actual expense';
  $('#expenseCancel').hidden=false;
  clearExpenseInlineErrors();
  const notice = $('#expensePayrollPrefillNotice');
  const prefillText = $('#expensePayrollPrefillText');
  if (notice) {
    if (prefillText) {
      prefillText.textContent = `Prefilled from ${monthName(selectedPayrollMonth)} payroll for Saad: PKR ${Number(prefill.amount).toLocaleString('en-PK')}. Click "Record actual expense" below to post into the ledger.`;
    }
    notice.hidden = false;
  }
  const form=$('#expenseForm');
  if(form){
    form.scrollIntoView({behavior:'smooth',block:'center'});
    form.classList.add('prefilled-pulse');
    setTimeout(()=>form.classList.remove('prefilled-pulse'),1500);
  }
  toast(`Prefilled ${monthName(selectedPayrollMonth)} salary for Saad (${formatAmount(Number(prefill.amount))})`);
});

$('#recordUmairSalaryExpenseBtn')?.addEventListener('click',()=>{
  const prefill=buildPayrollExpensePrefill('umair',state,selectedPayrollMonth);
  if(!(Number(prefill.amount)>0)){
    // No logged workdays for the selected month means there is no payout
    // to record; prefilling PKR 0 only fails later at submit. Say so now.
    toast(`No logged workdays for ${monthName(selectedPayrollMonth)} — log a workday first; there is no payout to record.`);
    return;
  }
  $('#expenseId').value='';
  $('#expenseDate').value=prefill.date;
  $('#expenseAmount').value=prefill.amount;
  $('#expenseCategory').value=prefill.category;
  if($('#expenseArea'))$('#expenseArea').value=prefill.area||'';
  $('#expenseNotes').value=prefill.notes;
  $('#expenseSubmit').textContent='Record actual expense';
  $('#expenseCancel').hidden=false;
  clearExpenseInlineErrors();
  const notice = $('#expensePayrollPrefillNotice');
  const prefillText = $('#expensePayrollPrefillText');
  if (notice) {
    if (prefillText) {
      prefillText.textContent = `Prefilled from ${monthName(selectedPayrollMonth)} payroll for Umair: PKR ${Number(prefill.amount).toLocaleString('en-PK')}. Click "Record actual expense" below to post into the ledger.`;
    }
    notice.hidden = false;
  }
  const form=$('#expenseForm');
  if(form){
    form.scrollIntoView({behavior:'smooth',block:'center'});
    form.classList.add('prefilled-pulse');
    setTimeout(()=>form.classList.remove('prefilled-pulse'),1500);
  }
  toast(`Prefilled ${monthName(selectedPayrollMonth)} payout for Umair (${formatAmount(Number(prefill.amount))})`);
});

$('#dismissExpensePayrollNoticeBtn')?.addEventListener('click', () => {
  const notice = $('#expensePayrollPrefillNotice');
  if (notice) notice.hidden = true;
});

$('#payrollMonth').addEventListener('change',event=>{if(!monthsForHistory().includes(event.currentTarget.value))return;selectedPayrollMonth=event.currentTarget.value;renderExpenses();});
[['ledger','#expenseTabLedger'],['nasir','#expenseTabNasir'],['aqib','#expenseTabAqib'],['settlement','#expenseTabSettlement'],['overheads','#expenseTabOverheads']].forEach(([key,sel])=>{$(sel)?.addEventListener('click',async()=>{const pinAction=key==='settlement'?'partner-settlement':(key==='nasir'||key==='aqib')?'partner-shares':null;if(pinAction&&!await requireOwnerPin(pinAction))return;expenseActiveTab=key;syncExpenseTabs();if(key==='settlement')renderPartnerSettlement();else if(key==='overheads')renderOverheads();else if(key!=='ledger')renderPartnerShare(key);});});
$('#nasirShareMonth')?.addEventListener('change',event=>{nasirShareMonth=event.currentTarget.value;renderPartnerShare('nasir');});
$('#aqibShareMonth')?.addEventListener('change',event=>{aqibShareMonth=event.currentTarget.value;renderPartnerShare('aqib');});
$('#partnerSettlementMonth')?.addEventListener('change',event=>{partnerSettlementMonth=event.currentTarget.value;renderPartnerSettlement();});
$('#overheadsMonth')?.addEventListener('change',event=>{overheadsMonth=event.currentTarget.value;renderOverheads();});
$('#partnerLedgerForm')?.addEventListener('submit',event=>{
  event.preventDefault();
  try {
    const entry = cleanPartnerLedgerEntry({
      partner: $('#partnerLedgerPartner').value,
      type: $('#partnerLedgerType').value,
      amount: $('#partnerLedgerAmount').value,
      date: $('#partnerLedgerDate').value,
      note: $('#partnerLedgerNote').value
    }, partnerLedgerEditId || null);
    savePartnerLedgerEntries(upsertPartnerLedgerEntry(loadPartnerLedgerEntries(), entry));
    partnerLedgerEditId = '';
    $('#partnerLedgerForm').reset();
    $('#partnerLedgerId').value = '';
    $('#partnerLedgerSubmit').textContent = 'Record movement';
    $('#partnerLedgerCancel').hidden = true;
    toast('Partner movement recorded on this device.');
    renderPartnerSettlement();
  } catch (error) { toast(error.message, { type: 'error' }); }
});
$('#partnerLedgerCancel')?.addEventListener('click',()=>{
  partnerLedgerEditId = '';
  $('#partnerLedgerForm').reset();
  $('#partnerLedgerId').value = '';
  $('#partnerLedgerSubmit').textContent = 'Record movement';
  $('#partnerLedgerCancel').hidden = true;
});
$('#partnerSettlementConfirmBtn')?.addEventListener('click',()=>{
  try {
    const report = buildPartnerSettlementReport(state, partnerSettlementMonth, loadPartnerLedgerEntries(), new Date(), { includeInstallationCapexInSplit: loadPartnerSettings().includeInstallationCapexInSplit });
    const slip = createPartnerSettlement(report);
    savePartnerSettlements(upsertPartnerSettlement(loadPartnerSettlements(), slip));
    toast(`Settlement slip confirmed for ${monthName(report.month)}. Bills, receipts and expenses were not changed.`);
    renderPartnerSettlement();
  } catch (error) { toast(error.message, { type: 'error' }); }
});
$('#partnerSettlementReopenBtn')?.addEventListener('click',()=>{
  try {
    savePartnerSettlements(reopenPartnerSettlement(loadPartnerSettlements(), partnerSettlementMonth));
    toast('Saved settlement slip re-opened. Confirm again to lock new figures.');
    renderPartnerSettlement();
  } catch (error) { toast(error.message, { type: 'error' }); }
});
$('#showAnalyticsButton').addEventListener('click',()=>{switchView('analytics');renderAnalytics();});
$('#areaIntelMonth').addEventListener('change',event=>{
  const month=event.currentTarget.value;if(!month){renderAnalytics();return;}
  const [year,number]=month.split('-').map(Number),lastDay=new Date(Date.UTC(year,number,0)).getUTCDate();
  $('#areaIntelFrom').value=`${month}-01`;$('#areaIntelTo').value=month===localDate().slice(0,7)?localDate():`${month}-${String(lastDay).padStart(2,'0')}`;renderAnalytics();
});
['#areaIntelFrom','#areaIntelTo'].forEach(selector=>$(selector).addEventListener('change',()=>{if($('#areaIntelMonth').value)$('#areaIntelMonth').value='';renderAnalytics();}));
$('#areaIntelSearch')?.addEventListener('input', e => {
  areaSearchQuery = e.target.value || '';
  renderAreaIntelligence();
});
$('#exportAreaIntelCsvBtn')?.addEventListener('click', () => {
  try {
    const from = $('#areaIntelFrom')?.value || '';
    const to = $('#areaIntelTo')?.value || '';
    const area = buildAreaIntelligence(state, { startDate: from, endDate: to }, new Date());
    let exportRows = [...area.rows];
    if (areaSearchQuery.trim()) {
      const q = areaSearchQuery.trim().toLowerCase();
      exportRows = exportRows.filter(row => (row.area || '').toLowerCase().includes(q) || (row.parentArea || '').toLowerCase().includes(q));
    }
    const csv = generateAreaIntelligenceCsv(exportRows, { from, to });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shahdara-area-intelligence-${from}-to-${to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Exported Area Intelligence CSV.');
  } catch (err) {
    toast(err.message || 'Error exporting CSV.');
  }
});
$('#exportPackageSummaryCsvBtn')?.addEventListener('click', () => {
  try {
    const data = latestAnalyticsData || buildPhase3Analytics(state, new Date());
    const csv = generatePackageSummaryCsv(data.packageRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shahdara-package-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Exported Package Summary CSV.');
  } catch (err) {
    toast(err.message || 'Error exporting CSV.');
  }
});
$('#exportAreaSummaryCsvBtn')?.addEventListener('click', () => {
  try {
    const data = latestAnalyticsData || buildPhase3Analytics(state, new Date());
    const csv = generateAreaSummaryCsv(data.areaRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shahdara-area-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Exported Location Summary CSV.');
  } catch (err) {
    toast(err.message || 'Error exporting CSV.');
  }
});
$('#showInventoryButton').addEventListener('click',()=>{switchView('inventory');renderInventory();});
$('#showExpensesButton').addEventListener('click',()=>{expenseActiveTab='ledger';switchView('expenses');renderExpenses();});
$('#showHomeBudgetButton').addEventListener('click',()=>{switchView('homeBudget');renderHomeBudget();});
$('#showLoansButton').addEventListener('click',()=>{switchView('loans');renderLoans();});
$('#showWaTemplatesButton').addEventListener('click',()=>{switchView('waTemplates');renderWaTemplates();});
renderPhase3();
refreshOwnerCenter = setupOwnerCenter({getState:()=>state,formatAmount,monthName,monthsForHistory,openCustomer:selectCustomer,switchView,renderMonthlyReport,renderAnalytics,renderInventory,renderExpenses,renderLoans}).refresh;

// Phase 12 · Form draft auto-save and restoration
customerDraftController = wireFormDraftAutosave($('#addCustomerForm'), 'addCustomerForm', {
  storage: localStorage,
  onRestore: () => {
    const notice = $('#newCustomerDraftNotice');
    if (notice) notice.hidden = false;
  },
  onClear: () => {
    const notice = $('#newCustomerDraftNotice');
    if (notice) notice.hidden = true;
  }
});
$('#discardNewCustomerDraftBtn')?.addEventListener('click', () => {
  customerDraftController?.clear();
  $('#addCustomerForm')?.reset();
  const notice = $('#newCustomerDraftNotice');
  if (notice) notice.hidden = true;
  $('#newCustomerName')?.focus();
});

expenseDraftController = wireFormDraftAutosave($('#expenseForm'), 'expenseForm', {
  storage: localStorage,
  onRestore: () => {
    const notice = $('#expenseDraftNotice');
    if (notice) notice.hidden = false;
  },
  onClear: () => {
    const notice = $('#expenseDraftNotice');
    if (notice) notice.hidden = true;
  }
});
$('#discardExpenseDraftBtn')?.addEventListener('click', () => {
  expenseDraftController?.clear();
  resetExpenseForm();
  const notice = $('#expenseDraftNotice');
  if (notice) notice.hidden = true;
});
if (expenseDraftController?.getDraft()) {
  expenseDraftController.restore();
}

// Phase 12 · CSV exports
$('#exportTransactionsCsvBtn')?.addEventListener('click', () => {
  const date = $('#transactionDateFilter')?.value;
  const recencyValue = $('#transactionRecencyFilter')?.value;
  const recencyDays = recencyValue === 'all' ? null : Number(recencyValue);
  let txs = listTransactions(state, { customerQuery: searchQuery(), date, recencyDays });
  if (transactionMethodFilter !== 'all') {
    txs = txs.filter(tx => String(tx.method || '').toLowerCase() === transactionMethodFilter.toLowerCase());
  }
  const headers = [
    { key: 'customerNumber', label: 'Customer #' },
    { key: 'customerName', label: 'Customer Name' },
    { key: 'date', label: 'Payment Date' },
    { key: 'month', label: 'Billing Month' },
    { key: 'amount', label: 'Amount (PKR)' },
    { key: 'method', label: 'Payment Method' },
    { key: 'status', label: 'Billing Status' },
    { key: 'notes', label: 'Notes' }
  ];
  const csv = generateCsvContent(headers, txs);
  const filename = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsvFile(filename, csv);
  toast(`Exported ${txs.length} transactions to CSV.`);
});

$('#exportExpensesCsvBtn')?.addEventListener('click', () => {
  const allRows = state.expenses || [];
  const hasFilter = expenseMonthFilter !== 'all' || expenseCategoryFilter !== 'all' || Boolean(expenseSearchQuery);
  const expenses = filterExpenseRows(allRows, {
    month: expenseMonthFilter,
    category: expenseCategoryFilter,
    query: expenseSearchQuery
  });
  const csv = generateExpensesCsv(expenses);
  const filename = `shahdara-expenses-${hasFilter ? 'filtered' : 'all'}-${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsvFile(filename, csv);
  toast(`Exported ${expenses.length} expense ${expenses.length === 1 ? 'entry' : 'entries'} to CSV.`);
});

$('#exportInventoryCsvBtn')?.addEventListener('click', () => {
  const summary = inventorySummary(state);
  const allSummaryItems = summary.items || [];
  const hasActiveFilter = inventoryCategoryFilter !== 'all' || inventoryStockFilter !== 'all' || Boolean(inventorySearchQuery);
  const sourceItems = hasActiveFilter ? allSummaryItems.filter(item => {
    if (inventoryCategoryFilter !== 'all' && item.category !== inventoryCategoryFilter) return false;
    if (inventoryStockFilter !== 'all') {
      if (inventoryStockFilter === 'low') {
        if (!item.hasMovements || item.available > item.minimumStock) return false;
      } else if (inventoryStockFilter === 'out') {
        if (!item.hasMovements || item.available > 0) return false;
      } else if (inventoryStockFilter === 'in') {
        if (!item.hasMovements || item.available <= item.minimumStock) return false;
      } else if (inventoryStockFilter === 'unrecorded') {
        if (item.hasMovements) return false;
      }
    }
    if (inventorySearchQuery) {
      const q = inventorySearchQuery.toLowerCase();
      const name = (item.name || '').toLowerCase();
      const cat = (item.category || '').toLowerCase();
      const notes = (item.notes || '').toLowerCase();
      if (!name.includes(q) && !cat.includes(q) && !notes.includes(q)) return false;
    }
    return true;
  }) : allSummaryItems;

  const rows = sourceItems.map(item => {
    let stockStatus = 'Not recorded';
    if (item.hasMovements) {
      if (item.available <= 0) stockStatus = 'Out of stock';
      else if (item.available <= item.minimumStock) stockStatus = 'Low stock';
      else stockStatus = 'In stock';
    }
    return {
      name: item.name,
      category: item.category,
      available: item.hasMovements ? item.available : 'Not recorded',
      unit: item.unit,
      minimumStock: item.minimumStock,
      unitCost: item.unitCost ?? '',
      value: item.hasMovements && item.value !== null ? item.value : '',
      installed: item.hasMovements ? item.installed : 0,
      damaged: item.hasMovements ? item.damaged : 0,
      returned: item.hasMovements ? item.returned : 0,
      status: stockStatus,
      notes: item.notes || ''
    };
  });

  const headers = [
    { key: 'name', label: 'Item Name' },
    { key: 'category', label: 'Category' },
    { key: 'available', label: 'Available Stock' },
    { key: 'unit', label: 'Unit' },
    { key: 'minimumStock', label: 'Minimum Stock' },
    { key: 'unitCost', label: 'Unit Cost (PKR)' },
    { key: 'value', label: 'Available Value (PKR)' },
    { key: 'installed', label: 'Installed Quantity' },
    { key: 'damaged', label: 'Damaged Quantity' },
    { key: 'returned', label: 'Returned Quantity' },
    { key: 'status', label: 'Stock Status' },
    { key: 'notes', label: 'Notes' }
  ];
  const csv = generateCsvContent(headers, rows);
  const filename = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsvFile(filename, csv);
  toast(`Exported ${rows.length} inventory item${rows.length === 1 ? '' : 's'} to CSV.`);
});

$('#exportMonthlyReportCsvBtn')?.addEventListener('click', () => {
  const month = selectedBillingMonth;
  const query = reportSearchQuery.trim() || searchQuery();
  const rows = buildMonthlyReport(state, { month, statusFilter: selectedReportFilter, customerQuery: query });
  const headers = [
    { key: 'customerNumber', label: 'Customer #' },
    { key: 'name', label: 'Customer Name' },
    { key: 'mohalla', label: 'Mohalla' },
    { key: 'phone', label: 'Phone' },
    { key: 'billAmount', label: 'Bill Due (PKR)' },
    { key: 'amountReceived', label: 'Paid (PKR)' },
    { key: 'balanceDue', label: 'Balance (PKR)' },
    { key: 'status', label: 'Status' }
  ];
  const csv = generateCsvContent(headers, rows);
  const filename = `monthly-report-${month}.csv`;
  downloadCsvFile(filename, csv);
  toast(`Exported ${rows.length} report rows for ${month} to CSV.`);
});

$('#billingRegisterPeriod')?.addEventListener('change', event => {
  billingRegisterPeriod = normalizeBillingRegisterPeriod(event.target.value);
  renderBillingRegister();
});

document.querySelectorAll('[data-register-status]').forEach(button => {
  button.addEventListener('click', () => {
    billingRegisterStatus = normalizeBillingRegisterStatus(button.dataset.registerStatus);
    renderBillingRegister();
  });
});

// Register CSV: exactly the visible (period + status) rows, with the house
// filtered-view NOTE row and `_filtered` filename.
$('#billingRegisterDownloadBtn')?.addEventListener('click', () => {
  const register = buildBillingRegister(state, {
    period: billingRegisterPeriod,
    status: billingRegisterStatus,
    currentMonth: monthsForHistory()[0]
  });
  const note = billingRegisterCsvNote(register, {
    periodLabel: t(`bill_reg_period_${register.period}`),
    statusLabel: t(`bill_reg_status_${register.status}`)
  });
  const noteRow = { reference: note, customer: '', mobile: '', package: '', month: '', billAmount: '', paidAmount: '', status: '' };
  const csv = generateCsvContent(BILLING_REGISTER_CSV_HEADERS, [noteRow, ...billingRegisterCsvRows(register)]);
  downloadCsvFile(billingRegisterCsvFilename(register), csv);
  toast(t('bill_reg_exported', null, { count: register.rows.length }));
});

// Phase 12 · Monthly Batch Receipt Sheet
function renderBatchReceipts() {
  const month = $('#batchReceiptMonthSelect')?.value || selectedBillingMonth;
  const filter = $('#batchReceiptFilterSelect')?.value || 'all';
  const html = generateBatchReceiptHtml(state.customers, month, state, { filter });
  const container = $('#batchReceiptPreviewContainer') || $('#batchReceiptContainer');
  if (container) container.innerHTML = html;
}

const batchReceiptModal = $('#batchReceiptModal');
const closeBatchReceiptModal = () => {
  if (batchReceiptModal?.close) batchReceiptModal.close();
  else batchReceiptModal?.removeAttribute('open');
};

// #287 Bills screen actions: the shared reports view shows this bar only on
// the Monthly Bills screen (see data-report-screen CSS in styles.css).
$('#generateBillsBtn')?.addEventListener('click', () => {
  checkMonthlyBilling();
  const month = monthsForHistory()[0];
  const count = state.customers.filter(customer => !customer.archived && (customer.bills ?? []).some(bill => bill.month === month)).length;
  const note = $('#billsActionsNote');
  if (note) note.textContent = t('bill_generate_note', null, { month: displayMonthName(month), key: month, count });
  toast(t('bill_generate_toast', null, { month: displayMonthName(month), count }));
});
$('#billsInvoicesBtn')?.addEventListener('click', () => { $('#batchReceiptPrintBtn')?.click(); });
$('#unbilledCustomersBtn')?.addEventListener('click', () => {
  selectedReportFilter = 'not-set';
  reportCurrentPage = 1;
  renderMonthlyReport();
  $('#monthlyReportList')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
});

$('#batchReceiptPrintBtn')?.addEventListener('click', () => {
  const monthSelect = $('#batchReceiptMonthSelect');
  if (monthSelect) {
    const months = monthsForHistory();
    monthSelect.innerHTML = months.map(m => `<option value="${m}" ${m === selectedBillingMonth ? 'selected' : ''}>${monthName(m)} (${m})</option>`).join('');
  }
  renderBatchReceipts();
  if (batchReceiptModal?.showModal) batchReceiptModal.showModal();
  else batchReceiptModal?.setAttribute('open', '');
});

$('#batchReceiptMonthSelect')?.addEventListener('change', renderBatchReceipts);
$('#batchReceiptFilterSelect')?.addEventListener('change', renderBatchReceipts);
$('#closeBatchReceiptModal')?.addEventListener('click', closeBatchReceiptModal);
$('#batchReceiptModalCloseBtn')?.addEventListener('click', closeBatchReceiptModal);
batchReceiptModal?.addEventListener('click', (e) => {
  if (e.target === batchReceiptModal) closeBatchReceiptModal();
});
$('#triggerBatchPrintBtn')?.addEventListener('click', () => {
  document.body.classList.add('printing-batch');
  requestAnimationFrame(() => {
    try {
      window.print();
    } catch {
      toast('Printing is not supported in this browser.');
    } finally {
      document.body.classList.remove('printing-batch');
    }
  });
});

// Batch slip direct WhatsApp reminder dispatch
const batchPreviewContainer = $('#batchReceiptPreviewContainer') || $('#batchReceiptContainer');
batchPreviewContainer?.addEventListener('click', (e) => {
  const btn = e.target.closest('.batch-slip-wa-btn');
  if (!btn) return;
  const custId = btn.getAttribute('data-cust-id');
  const month = btn.getAttribute('data-month') || selectedBillingMonth;
  const customer = state.customers.find(c => c.id === custId);
  if (!customer) return;

  const bill = Array.isArray(customer.bills) ? customer.bills.find(b => b.month === month) : null;
  const dueAmount = Number(bill?.dueAmount || customer.monthlyPrice || customer.packagePrice || 0);
  const paidAmount = Number(bill?.paidAmount || 0);
  const balance = Math.max(0, dueAmount - paidAmount);
  const dueDate = bill?.dueDate || (customer.customDueDate ? `${customer.customDueDate}th of month` : '5th of month');

  const msg = buildPaymentReminderMessage({
    customer,
    templateType: balance > dueAmount ? 'overdue' : 'due',
    billingData: {
      month,
      billAmount: dueAmount,
      balance,
      dueDate,
      packageName: customer.package || customer.packageSpeed || 'Standard Plan'
    }
  });

  // SISP-71 bridge: a due (not overdue) batch slip is a bill notice — a
  // customized Template Studio "Bill Generated" template replaces the
  // built-in wording; an untouched studio keeps the message above.
  const waMsg = balance > dueAmount
    ? msg
    : (buildReceiptBillNoticeMessage(customer, { totalDue: balance }, getWaTemplates()) ?? msg);

  const phoneRes = formatWhatsAppUrl(customer.phone || '', waMsg);
  if (phoneRes.validPhone && phoneRes.url) {
    window.open(phoneRes.url, '_blank');
    toast(`Opening WhatsApp reminder draft for ${customer.name}...`);
  } else {
    openPaymentReminderModal(customer);
    toast(`Phone missing or invalid for ${customer.name}. Opening reminder modal.`);
  }
});

// Bulk Reminders button in Monthly Report view: opens batch slips filtered to pending
$('#bulkReminderDispatchBtn')?.addEventListener('click', () => {
  const monthSelect = $('#batchReceiptMonthSelect');
  if (monthSelect) {
    const months = monthsForHistory();
    monthSelect.innerHTML = months.map(m => `<option value="${m}" ${m === selectedBillingMonth ? 'selected' : ''}>${monthName(m)} (${m})</option>`).join('');
  }
  const filterSelect = $('#batchReceiptFilterSelect');
  if (filterSelect) filterSelect.value = 'pending';
  renderBatchReceipts();
  if (batchReceiptModal?.showModal) batchReceiptModal.showModal();
  else batchReceiptModal?.setAttribute('open', '');
  toast(t('bill_remind_toast'));
});

let currentStatementData = null;
// View-only statement filters: they hide rows on screen (and in print, which
// prints what you see) but never change currentStatementData. CSV and
// WhatsApp exports now follow the visible view: unfiltered they export the
// full statement exactly as before; filtered they export only the visible
// rows and say so. Running balances are never recomputed anywhere here.
let statementFilters = { type: 'all', month: 'all', method: 'all', sort: 'date-asc', query: '' };
// Last rendered (filtered + sorted) rows, so a clicked row resolves to the
// exact event shown on screen. Rebuilt on every renderStatementView call.
let lastStatementVisibleEvents = [];
// Event currently shown in the statement detail dialog (for Schedule Promise).
let currentStatementDetailEvent = null;

function statementFiltersActive() {
  return statementFilters.type !== 'all' || statementFilters.month !== 'all' || statementFilters.method !== 'all' || statementFilters.query.trim() !== '';
}

function statementTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function renderStatementView() {
  if (!currentStatementData) return;
  const preview = $('#statementPreviewContainer');
  if (!preview) return;
  const filtered = filterStatementEvents(currentStatementData.events, statementFilters);
  const visible = sortStatementEvents(filtered, statementFilters.sort);
  lastStatementVisibleEvents = visible;
  // Blocks (subtotals / aging / trend) always render; view.events is only
  // overridden when the view actually differs from the full statement, so
  // an unfiltered empty ledger still shows its own empty message.
  const view = {
    monthSubtotals: statementMonthSubtotals(visible),
    aging: statementAging(currentStatementData.events, currentStatementData.currentBalance, statementTodayStr()),
    trendSvg: statementTrendSvg(visible)
  };
  if (visible.length === 0) view.trendNote = 'No entries to chart.';
  else if (visible.length === 1) view.trendNote = 'Only one entry — the trend needs more history.';
  if (statementFiltersActive() || statementFilters.sort !== 'date-asc') {
    view.events = visible;
  }
  if (statementFiltersActive()) {
    const filteredCharges = visible.reduce((sum, ev) => sum + (ev.charge || 0), 0);
    const filteredCredits = visible.reduce((sum, ev) => sum + (ev.credit || 0), 0);
    view.filterNote = `Showing ${visible.length} of ${currentStatementData.events.length} entries · Filtered charges PKR ${filteredCharges.toLocaleString()} · Filtered credits PKR ${filteredCredits.toLocaleString()} · CSV / WhatsApp exports cover only the visible entries.`;
  }
  preview.innerHTML = generateCustomerStatementHtml(currentStatementData, view);
}

function refreshStatementMonthOptions() {
  const monthSelect = $('#statementMonthFilter');
  if (!monthSelect || !currentStatementData) return;
  const months = statementFilterMonths(currentStatementData.events);
  const previous = monthSelect.value;
  monthSelect.innerHTML = '<option value="all" selected>All months</option>' + months.map(m => `<option value="${m}">${monthName(m)} (${m})</option>`).join('');
  if (months.includes(previous)) {
    monthSelect.value = previous;
  } else {
    monthSelect.value = 'all';
    statementFilters.month = 'all';
  }
}

function refreshStatementMethodOptions() {
  const methodSelect = $('#statementMethodFilter');
  if (!methodSelect || !currentStatementData) return;
  const methods = statementFilterMethods(currentStatementData.events);
  const previous = methodSelect.value;
  methodSelect.innerHTML = '<option value="all" selected>All methods</option>' + methods.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  if (methods.includes(previous)) {
    methodSelect.value = previous;
  } else {
    methodSelect.value = 'all';
    statementFilters.method = 'all';
  }
}

function renderAccountStatement(range = 'all') {
  if (!selectedCustomerId) return;
  const customer = state.customers.find(c => c.id === selectedCustomerId);
  if (!customer) return;

  currentStatementData = formatCustomerStatement(customer, {
    range,
    storage: typeof localStorage !== 'undefined' ? localStorage : null
  });
  refreshStatementMonthOptions();
  refreshStatementMethodOptions();
  renderStatementView();
}

const statementModal = $('#accountStatementModal');
const openStatementBtn = $('#openAccountStatementBtn');
const closeStatementBtn = $('#closeStatementModalBtn');
const statementRangeSelect = $('#statementRangeSelect');
const printStatementBtn = $('#printStatementBtn');
const printStatement58Btn = $('#printStatement58Btn');
const downloadStatementCsvBtn = $('#downloadStatementCsvBtn');
const shareStatementWhatsAppBtn = $('#shareStatementWhatsAppBtn');

if (openStatementBtn && statementModal) {
  openStatementBtn.addEventListener('click', () => {
    if (!selectedCustomerId) {
      toast('Please select a customer first.');
      return;
    }
    if (statementRangeSelect) statementRangeSelect.value = 'all';
    statementFilters = { type: 'all', month: 'all', method: 'all', sort: 'date-asc', query: '' };
    const statementTypeFilterEl = $('#statementTypeFilter');
    const statementMonthFilterEl = $('#statementMonthFilter');
    const statementMethodFilterEl = $('#statementMethodFilter');
    const statementSortSelectEl = $('#statementSortSelect');
    const statementSearchInputEl = $('#statementSearchInput');
    if (statementTypeFilterEl) statementTypeFilterEl.value = 'all';
    if (statementMonthFilterEl) statementMonthFilterEl.value = 'all';
    if (statementMethodFilterEl) statementMethodFilterEl.value = 'all';
    if (statementSortSelectEl) statementSortSelectEl.value = 'date-asc';
    if (statementSearchInputEl) statementSearchInputEl.value = '';
    renderAccountStatement('all');
    if (statementModal.showModal) statementModal.showModal();
    else statementModal.setAttribute('open', '');
  });
}

if (closeStatementBtn && statementModal) {
  closeStatementBtn.addEventListener('click', () => {
    if (statementModal.close) statementModal.close();
    else statementModal.removeAttribute('open');
  });
}

if (statementModal) {
  statementModal.addEventListener('click', (e) => {
    if (e.target === statementModal) {
      if (statementModal.close) statementModal.close();
      else statementModal.removeAttribute('open');
    }
  });
}

if (statementRangeSelect) {
  statementRangeSelect.addEventListener('change', () => {
    renderAccountStatement(statementRangeSelect.value);
  });
}

const statementTypeFilter = $('#statementTypeFilter');
const statementMonthFilter = $('#statementMonthFilter');
const statementMethodFilter = $('#statementMethodFilter');
const statementSortSelect = $('#statementSortSelect');
const statementSearchInput = $('#statementSearchInput');
const clearStatementFiltersBtn = $('#clearStatementFilters');

if (statementTypeFilter) {
  statementTypeFilter.addEventListener('change', () => {
    statementFilters.type = statementTypeFilter.value;
    renderStatementView();
  });
}

if (statementMonthFilter) {
  statementMonthFilter.addEventListener('change', () => {
    statementFilters.month = statementMonthFilter.value;
    renderStatementView();
  });
}

if (statementMethodFilter) {
  statementMethodFilter.addEventListener('change', () => {
    statementFilters.method = statementMethodFilter.value;
    renderStatementView();
  });
}

if (statementSortSelect) {
  statementSortSelect.addEventListener('change', () => {
    statementFilters.sort = statementSortSelect.value;
    renderStatementView();
  });
}

if (statementSearchInput) {
  statementSearchInput.addEventListener('input', () => {
    statementFilters.query = statementSearchInput.value;
    renderStatementView();
  });
}

if (clearStatementFiltersBtn) {
  clearStatementFiltersBtn.addEventListener('click', () => {
    statementFilters = { type: 'all', month: 'all', method: 'all', sort: 'date-asc', query: '' };
    if (statementTypeFilter) statementTypeFilter.value = 'all';
    if (statementMonthFilter) statementMonthFilter.value = 'all';
    if (statementMethodFilter) statementMethodFilter.value = 'all';
    if (statementSortSelect) statementSortSelect.value = 'date-asc';
    if (statementSearchInput) statementSearchInput.value = '';
    renderStatementView();
  });
}

// Statement row detail: clicking a row opens a read-only detail view of that
// exact event (resolved via lastStatementVisibleEvents, the rows on screen).
const statementPreviewContainer = $('#statementPreviewContainer');
const statementEventDetailModal = $('#statementEventDetailModal');
const statementEventDetailBody = $('#statementEventDetailBody');
const closeStatementDetailBtn = $('#closeStatementDetailBtn');
const statementDetailSchedulePromiseBtn = $('#statementDetailSchedulePromiseBtn');

function openStatementEventDetail(index) {
  const ev = lastStatementVisibleEvents[index];
  if (!ev || !statementEventDetailModal || !statementEventDetailBody) return;
  currentStatementDetailEvent = ev;
  const amount = ev.charge > 0 ? ev.charge : ev.credit;
  const amountLabel = ev.charge > 0 ? 'Charge' : 'Credit';
  const overdueDays = ev.type === 'bill' && (ev.charge || 0) > 0 ? statementDaysOverdue(ev.date, statementTodayStr()) : 0;
  statementEventDetailBody.innerHTML = `
    <dl class="statement-detail-list">
      <div><dt>Date</dt><dd>${escapeHtml(ev.date)}</dd></div>
      <div><dt>Type</dt><dd>${escapeHtml(ev.type)}</dd></div>
      <div><dt>Description</dt><dd>${escapeHtml(ev.description)}${overdueDays > 0 ? ` <span class="statement-overdue-badge">⏰ ${overdueDays}d overdue</span>` : ''}</dd></div>
      <div><dt>Reference</dt><dd>${escapeHtml(ev.ref || '—')}</dd></div>
      <div><dt>Method</dt><dd>${escapeHtml(ev.method || '—')}</dd></div>
      <div><dt>Billing month</dt><dd>${escapeHtml(ev.month || '—')}</dd></div>
      <div><dt>${amountLabel}</dt><dd>PKR ${Number(amount || 0).toLocaleString()}</dd></div>
      <div><dt>Running balance</dt><dd>PKR ${Number(ev.runningBalance || 0).toLocaleString()}</dd></div>
    </dl>`;
  if (statementDetailSchedulePromiseBtn) {
    statementDetailSchedulePromiseBtn.hidden = overdueDays <= 0;
  }
  if (statementEventDetailModal.showModal) statementEventDetailModal.showModal();
  else statementEventDetailModal.setAttribute('open', '');
}

if (statementPreviewContainer) {
  statementPreviewContainer.addEventListener('click', (e) => {
    const row = e.target.closest ? e.target.closest('tr[data-statement-row]') : null;
    if (!row) return;
    openStatementEventDetail(Number(row.dataset.statementRow));
  });
  statementPreviewContainer.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest ? e.target.closest('tr[data-statement-row]') : null;
    if (!row) return;
    e.preventDefault();
    openStatementEventDetail(Number(row.dataset.statementRow));
  });
}

if (closeStatementDetailBtn && statementEventDetailModal) {
  closeStatementDetailBtn.addEventListener('click', () => {
    if (statementEventDetailModal.close) statementEventDetailModal.close();
    else statementEventDetailModal.removeAttribute('open');
  });
}

if (statementEventDetailModal) {
  statementEventDetailModal.addEventListener('click', (e) => {
    if (e.target === statementEventDetailModal) {
      if (statementEventDetailModal.close) statementEventDetailModal.close();
      else statementEventDetailModal.removeAttribute('open');
    }
  });
}

// From a statement detail view, an overdue bill can seed the EXISTING
// collection-promise form: the pending-actions modal opens, its own toggle
// reveals the form (defaulting the date to tomorrow, PKT) and renders the
// customer options, then the customer, amount and a note are prefilled. No
// data is written until the user submits that form themselves.
if (statementDetailSchedulePromiseBtn) {
  statementDetailSchedulePromiseBtn.addEventListener('click', () => {
    const ev = currentStatementDetailEvent;
    if (!ev || !currentStatementData?.customer) return;
    if (statementEventDetailModal?.close) statementEventDetailModal.close();
    else statementEventDetailModal?.removeAttribute('open');
    window.pendingActionsController?.open();
    setTimeout(() => {
      // The form's own toggle renders the customer options and defaults the
      // date to tomorrow (PKT); only click it when the form is hidden, so a
      // form left open from before is not accidentally closed.
      const formContainer = document.getElementById('pendingPromiseFormContainer');
      if (formContainer && formContainer.hidden) {
        document.getElementById('toggleSchedulePromiseFormBtn')?.click();
      }
      const customerSelect = document.getElementById('promiseCustomerSelect');
      if (customerSelect) customerSelect.value = currentStatementData.customer.id;
      const amountInput = document.getElementById('promiseAmountInput');
      if (amountInput) amountInput.value = String(ev.charge || 0);
      const noteInput = document.getElementById('promiseNoteInput');
      if (noteInput && !noteInput.value) noteInput.value = ev.month ? `Statement bill ${ev.month}` : 'Statement bill';
      const dateInput = document.getElementById('promiseDateInput');
      if (dateInput && !dateInput.value) {
        const tomorrowPkt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
        tomorrowPkt.setDate(tomorrowPkt.getDate() + 1);
        const pad = (n) => String(n).padStart(2, '0');
        dateInput.value = `${tomorrowPkt.getFullYear()}-${pad(tomorrowPkt.getMonth() + 1)}-${pad(tomorrowPkt.getDate())}`;
      }
    }, 0);
  });
}

if (printStatementBtn) {
  printStatementBtn.addEventListener('click', () => {
    document.body.classList.add('printing-statement');
    requestAnimationFrame(() => {
      try {
        window.print();
      } catch {
        toast('Printing is not supported in this browser.');
      } finally {
        document.body.classList.remove('printing-statement');
      }
    });
  });
}

if (printStatement58Btn) {
  printStatement58Btn.addEventListener('click', () => {
    document.body.classList.add('printing-statement', 'printing-statement-58');
    requestAnimationFrame(() => {
      try {
        window.print();
      } catch {
        toast('Printing is not supported in this browser.');
      } finally {
        document.body.classList.remove('printing-statement', 'printing-statement-58');
      }
    });
  });
}

if (downloadStatementCsvBtn) {
  downloadStatementCsvBtn.addEventListener('click', () => {
    if (currentStatementData) {
      // Exports follow the visible view: unfiltered they carry the full
      // statement exactly as before; filtered they carry only the rows on
      // screen, with a NOTE row saying so.
      const exportView = statementFiltersActive() ? { events: lastStatementVisibleEvents } : {};
      downloadCustomerStatementCsv(currentStatementData, undefined, exportView);
      toast(statementFiltersActive() ? 'Filtered statement CSV downloaded (visible entries only).' : 'Customer statement CSV downloaded.');
    }
  });
}

if (shareStatementWhatsAppBtn) {
  shareStatementWhatsAppBtn.addEventListener('click', async () => {
    if (!currentStatementData || !currentStatementData.customer) {
      toast('No customer statement data to share.');
      return;
    }
    const exportView = statementFiltersActive() ? { events: lastStatementVisibleEvents } : {};
    const text = formatCustomerStatementWhatsApp(currentStatementData, exportView);
    const phone = currentStatementData.customer.phone || '';
    const phoneRes = formatWhatsAppUrl(phone, text);
    if (phoneRes.validPhone && phoneRes.url) {
      window.open(phoneRes.url, '_blank');
      toast(`Opening WhatsApp statement draft for ${currentStatementData.customer.name}...`);
    } else {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        toast('No phone number saved for this customer. The statement summary was copied to the clipboard instead.', { type: 'warning', title: 'No phone number' });
      } catch {
        toast('Unable to copy statement to clipboard.');
      }
    }
  });
}

// Payment Reminder Modal & WhatsApp Dispatcher (Issue #222)
const reminderModal = $('#paymentReminderModal');
const openReminderBtn = $('#openReminderModalBtn');
const closeReminderBtn = $('#closeReminderModalBtn');
const reminderTemplateSelect = $('#reminderTemplateSelect');
const reminderMessageText = $('#reminderMessageText');
const reminderCustomerSummary = $('#reminderCustomerSummary');
const reminderCharCount = $('#reminderCharCount');
const reminderPhoneNotice = $('#reminderPhoneNotice');
const sendWhatsAppReminderBtn = $('#sendWhatsAppReminderBtn');
const sendSmsReminderBtn = $('#sendSmsReminderBtn');
const copyReminderTextBtn = $('#copyReminderTextBtn');
const printReminderSlipBtn = $('#printReminderSlipBtn');

// Reminder Queue Controls
const reminderQueueBar = $('#reminderQueueBar');
const reminderQueueBadge = $('#reminderQueueBadge');
const reminderQueueStagePill = $('#reminderQueueStagePill');
const reminderQueuePrevBtn = $('#reminderQueuePrevBtn');
const reminderQueueNextBtn = $('#reminderQueueNextBtn');
const reminderQueueSkipBtn = $('#reminderQueueSkipBtn');

// Inline Promise-to-Pay Fieldset in Reminder Modal
const reminderRecordPromiseToggleBtn = $('#reminderRecordPromiseToggleBtn');
const reminderInlinePromiseFieldset = $('#reminderInlinePromiseFieldset');
const reminderPromiseDateInput = $('#reminderPromiseDateInput');
const reminderPromiseAmountInput = $('#reminderPromiseAmountInput');
const reminderPromiseNoteInput = $('#reminderPromiseNoteInput');
const saveReminderPromiseBtn = $('#saveReminderPromiseBtn');
const cancelReminderPromiseBtn = $('#cancelReminderPromiseBtn');

// Reminder History
const reminderCustomerHistoryList = $('#reminderCustomerHistoryList');

// Wada / Promise-to-Pay Modal Elements
const wadaModal = $('#wadaFollowupModal');
const closeWadaModalBtn = $('#closeWadaModalBtn');
const closeWadaModalFooterBtn = $('#closeWadaModalFooterBtn');
const openCustomerPromiseBtn = $('#openCustomerPromiseBtn');
const openRemindersFromWadaBtn = $('#openRemindersFromWadaBtn');
const wadaTodayCountBadge = $('#wadaTodayCountBadge');
const wadaBrokenCountBadge = $('#wadaBrokenCountBadge');
const wadaUpcomingCountBadge = $('#wadaUpcomingCountBadge');
const wadaTotalPromisedAmount = $('#wadaTotalPromisedAmount');
const wadaListContainer = $('#wadaListContainer');
const wadaTabs = [
  { id: 'wadaTabToday', key: 'today' },
  { id: 'wadaTabBroken', key: 'broken' },
  { id: 'wadaTabUpcoming', key: 'upcoming' },
  { id: 'wadaTabFulfilled', key: 'fulfilled' },
  { id: 'wadaTabAll', key: 'all' }
];

// Reminder Stages Modal Elements
const reminderStagesModal = $('#reminderStagesModal');
const closeReminderStagesModalBtn = $('#closeReminderStagesModalBtn');
const cancelReminderStagesBtn = $('#cancelReminderStagesBtn');
const resetReminderStagesBtn = $('#resetReminderStagesBtn');
const saveReminderStagesBtn = $('#saveReminderStagesBtn');
const reminderStagesTableBody = $('#reminderStagesTableBody');

// Queue traversal & modal state
let currentReminderCustomer = null;
let currentReminderQueue = null;
let currentReminderIndex = 0;
let currentWadaActiveTab = 'today';

function renderReminderCustomerHistory(customerId) {
  if (!reminderCustomerHistoryList) return;
  if (!customerId) {
    reminderCustomerHistoryList.innerHTML = '<p class="reminder-empty-note">No recent reminders recorded for this customer.</p>';
    return;
  }
  const history = getCustomerReminderHistory(customerId);
  if (!history || history.length === 0) {
    reminderCustomerHistoryList.innerHTML = '<p class="reminder-empty-note">No recent reminders recorded for this customer.</p>';
    return;
  }
  const itemsHtml = history.slice(0, 4).map(h => {
    const methodIcon = h.method === 'whatsapp' ? '💬 WhatsApp' : h.method === 'copied' ? '📋 Copied' : '🖨️ Slip';
    const amountStr = h.dueAmount ? `PKR ${Number(h.dueAmount).toLocaleString()}` : '';
    return `
      <div class="reminder-history-item">
        <span><strong>${escapeHtml(h.stageLabel || h.templateType || 'Reminder')}</strong> (${formatDisplayDate(h.date)})</span>
        <span>${methodIcon} ${amountStr ? `· <em>${amountStr}</em>` : ''}</span>
      </div>
    `;
  }).join('');
  reminderCustomerHistoryList.innerHTML = itemsHtml;
}

function renderReminderContent() {
  if (!currentReminderCustomer) return;
  const c = currentReminderCustomer;
  const month = monthsForHistory(new Date())[0];
  const allocations = calculatePaymentAllocations(state);
  const summary = currentBillPresentation(c, month, allocations);
  const balance = summary.balanceDueCents !== null ? (summary.balanceDueCents / 100) : 0;
  const billAmount = summary.amount !== null && summary.amount !== undefined ? Number(summary.amount) : 0;
  const dueDate = c.customDueDate ? `${c.customDueDate}th of month` : '5th of month';

  // Queue traversal status
  if (currentReminderQueue && currentReminderQueue.length > 0) {
    if (reminderQueueBar) reminderQueueBar.hidden = false;
    if (reminderQueueBadge) {
      reminderQueueBadge.textContent = `Queue: ${currentReminderIndex + 1} of ${currentReminderQueue.length}`;
    }
    const currentQueueItem = currentReminderQueue[currentReminderIndex];
    if (reminderQueueStagePill) {
      reminderQueueStagePill.textContent = currentQueueItem?.stageLabel || 'Due Reminder';
    }
    if (reminderQueuePrevBtn) reminderQueuePrevBtn.disabled = currentReminderIndex <= 0;
    if (reminderQueueNextBtn) reminderQueueNextBtn.disabled = currentReminderIndex >= currentReminderQueue.length - 1;
    if (currentQueueItem?.templateType && reminderTemplateSelect) {
      reminderTemplateSelect.value = currentQueueItem.templateType;
    }
  } else {
    if (reminderQueueBar) reminderQueueBar.hidden = true;
  }

  const billingData = {
    month,
    billAmount,
    balance,
    dueDate,
    paidAmount: summary.receivedAmount || 0,
    paymentDate: new Date().toISOString().slice(0, 10),
    packageName: c.package || 'Standard Package'
  };

  const templateType = reminderTemplateSelect?.value || 'due';
  const msg = buildPaymentReminderMessage({
    customer: c,
    templateType,
    billingData
  });

  // SISP-71 bridge: customized Template Studio templates fill the draft
  // for the Payment Received acknowledgement and the polite due reminder;
  // every other type — and any untouched template — keeps the built-in
  // wording above. The operator can still edit the draft before sending.
  const waBridgedMsg = templateType === 'payment'
    ? (buildReceiptPaymentReceivedMessage(c, { amount: billingData.paidAmount ?? null }, getWaTemplates()) ?? msg)
    : templateType === 'due'
      ? (renderCustomWaTemplate(getWaTemplates(), 'politeReminder', c, { totalDue: balance }, 'roman') ?? msg)
      : msg;

  if (reminderMessageText) {
    reminderMessageText.value = waBridgedMsg;
  }
  updateReminderCharCount();

  if (reminderCustomerSummary) {
    reminderCustomerSummary.innerHTML = `
      <div class="reminder-cust-left">
        <span class="reminder-cust-name">${escapeHtml(c.name)} (#${c.customerNumber})</span>
        <span class="reminder-cust-sub">${escapeHtml(c.area || c.mohalla || 'Area unassigned')} · Phone: ${escapeHtml(c.phone || 'Not recorded')}</span>
      </div>
      <div class="reminder-cust-right">
        <span class="reminder-due-tag">Total Balance</span>
        <strong class="reminder-due-val">PKR ${Number(balance).toLocaleString()}</strong>
      </div>
    `;
  }

  const phoneRes = formatWhatsAppUrl(c.phone || '');
  if (reminderPhoneNotice) {
    if (phoneRes.validPhone) {
      reminderPhoneNotice.textContent = `WhatsApp: ${phoneRes.formattedPhone}`;
      reminderPhoneNotice.style.color = '#10b981';
    } else {
      reminderPhoneNotice.textContent = 'Phone number missing or invalid format';
      reminderPhoneNotice.style.color = '#f59e0b';
    }
  }

  // SISP-76: SMS slip for the same reminder — shown only when the
  // number can take an SMS; a prefersSms customer gets the SMS action
  // emphasised first in the actions row.
  if (sendSmsReminderBtn) {
    const sms = buildSmsReminderUrl({ phone: c.phone || '', customerName: c.name || '', balanceDue: balance > 0 ? balance : null, dueText: dueDate });
    if (sms.valid) {
      sendSmsReminderBtn.href = sms.url;
      sendSmsReminderBtn.hidden = false;
      // An SMS-preference customer gets the SMS action first in the row.
      const actionsRow = sendSmsReminderBtn.parentElement;
      if (actionsRow && sendWhatsAppReminderBtn) {
        actionsRow.insertBefore(sendSmsReminderBtn, customerPrefersSms(c) ? sendWhatsAppReminderBtn : sendWhatsAppReminderBtn.nextSibling);
      }
    } else {
      sendSmsReminderBtn.hidden = true;
      sendSmsReminderBtn.removeAttribute('href');
    }
  }

  renderReminderCustomerHistory(c.id);

  // Hide inline promise form and reset values for this customer
  if (reminderInlinePromiseFieldset) {
    reminderInlinePromiseFieldset.hidden = true;
  }
  if (reminderPromiseAmountInput) {
    reminderPromiseAmountInput.value = Math.max(0, Math.round(balance));
  }
  if (reminderPromiseDateInput) {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 3);
    reminderPromiseDateInput.value = nextDate.toISOString().slice(0, 10);
  }
  if (reminderPromiseNoteInput) {
    reminderPromiseNoteInput.value = '';
  }
}

function updateReminderCharCount() {
  if (!reminderCharCount || !reminderMessageText) return;
  const len = reminderMessageText.value.length;
  reminderCharCount.textContent = `${len} characters`;
}

export function openPaymentReminderModal(cust, options = {}) {
  const emptyState = $('#reminderQueueEmptyState');
  const modalBody = document.querySelector('.reminder-modal-body');

  if (options.isEmptyQueue || (!cust && options.isEmpty)) {
    currentReminderCustomer = null;
    currentReminderQueue = null;
    currentReminderIndex = 0;

    if (emptyState) emptyState.hidden = false;
    if (reminderQueueBar) reminderQueueBar.hidden = true;
    if (modalBody) modalBody.hidden = true;

    const countBadge = $('#reminderQueueOverdueCountBadge');
    if (countBadge) {
      const overdueCount = Number.isInteger(options.overdueCount)
        ? options.overdueCount
        : (state?.customers || []).filter(c => !c.archived && getCustomerOutstandingDues(c, state, getTodayDateString().slice(0, 7)) > 0).length;
      countBadge.textContent = `${overdueCount} accounts with balance`;
    }

    if (reminderModal?.showModal) reminderModal.showModal();
    else reminderModal?.setAttribute('open', '');
    return;
  }

  if (emptyState) emptyState.hidden = true;
  if (modalBody) modalBody.hidden = false;

  if (!cust) return;
  currentReminderCustomer = cust;

  if (options.queue && Array.isArray(options.queue)) {
    currentReminderQueue = options.queue;
    currentReminderIndex = Number.isInteger(options.index) ? options.index : 0;
  } else {
    currentReminderQueue = null;
    currentReminderIndex = 0;
  }

  if (options.template && reminderTemplateSelect) {
    reminderTemplateSelect.value = options.template;
  } else if (!currentReminderQueue && reminderTemplateSelect) {
    reminderTemplateSelect.value = 'due';
  }

  renderReminderContent();
  if (reminderModal?.showModal) reminderModal.showModal();
  else reminderModal?.setAttribute('open', '');
}

const reminderEmptyCloseBtn = $('#reminderEmptyCloseBtn');
if (reminderEmptyCloseBtn && !reminderEmptyCloseBtn.dataset.wired) {
  reminderEmptyCloseBtn.dataset.wired = 'true';
  reminderEmptyCloseBtn.addEventListener('click', () => {
    if (reminderModal?.close) reminderModal.close();
    else reminderModal?.removeAttribute('open');
  });
}

const reminderEmptyOpenDuesRecoveryBtn = $('#reminderEmptyOpenDuesRecoveryBtn');
if (reminderEmptyOpenDuesRecoveryBtn && !reminderEmptyOpenDuesRecoveryBtn.dataset.wired) {
  reminderEmptyOpenDuesRecoveryBtn.dataset.wired = 'true';
  reminderEmptyOpenDuesRecoveryBtn.addEventListener('click', () => {
    if (reminderModal?.close) reminderModal.close();
    else reminderModal?.removeAttribute('open');
    if (typeof window !== 'undefined' && window.location) {
      window.location.hash = '#/recovery';
    }
  });
}

if (openReminderBtn && reminderModal) {
  openReminderBtn.addEventListener('click', () => {
    if (!selectedCustomerId) {
      toast('Please select a customer first.');
      return;
    }
    const cust = state.customers.find(c => c.id === selectedCustomerId);
    if (!cust) return;
    openPaymentReminderModal(cust);
  });
}

if (closeReminderBtn && reminderModal) {
  closeReminderBtn.addEventListener('click', () => {
    if (reminderModal.close) reminderModal.close();
    else reminderModal.removeAttribute('open');
  });
}

if (reminderModal) {
  reminderModal.addEventListener('click', (e) => {
    if (e.target === reminderModal) {
      if (reminderModal.close) reminderModal.close();
      else reminderModal.removeAttribute('open');
    }
  });
}

if (reminderTemplateSelect) {
  reminderTemplateSelect.addEventListener('change', renderReminderContent);
}

if (reminderMessageText) {
  reminderMessageText.addEventListener('input', updateReminderCharCount);
}

// Queue Traversal Buttons
if (reminderQueueNextBtn) {
  reminderQueueNextBtn.addEventListener('click', () => {
    if (!currentReminderQueue || currentReminderIndex >= currentReminderQueue.length - 1) return;
    currentReminderIndex++;
    const nextItem = currentReminderQueue[currentReminderIndex];
    if (nextItem?.customer) {
      openPaymentReminderModal(nextItem.customer, { queue: currentReminderQueue, index: currentReminderIndex });
    }
  });
}

if (reminderQueuePrevBtn) {
  reminderQueuePrevBtn.addEventListener('click', () => {
    if (!currentReminderQueue || currentReminderIndex <= 0) return;
    currentReminderIndex--;
    const prevItem = currentReminderQueue[currentReminderIndex];
    if (prevItem?.customer) {
      openPaymentReminderModal(prevItem.customer, { queue: currentReminderQueue, index: currentReminderIndex });
    }
  });
}

if (reminderQueueSkipBtn) {
  reminderQueueSkipBtn.addEventListener('click', () => {
    if (!currentReminderQueue) return;
    if (currentReminderIndex < currentReminderQueue.length - 1) {
      currentReminderIndex++;
      const nextItem = currentReminderQueue[currentReminderIndex];
      if (nextItem?.customer) {
        openPaymentReminderModal(nextItem.customer, { queue: currentReminderQueue, index: currentReminderIndex });
      }
    } else {
      toast('End of reminder queue reached.');
      if (reminderModal.close) reminderModal.close();
      else reminderModal.removeAttribute('open');
    }
  });
}

// Inline Promise-to-Pay Toggle & Save
if (reminderRecordPromiseToggleBtn && reminderInlinePromiseFieldset) {
  reminderRecordPromiseToggleBtn.addEventListener('click', () => {
    reminderInlinePromiseFieldset.hidden = !reminderInlinePromiseFieldset.hidden;
    if (!reminderInlinePromiseFieldset.hidden && reminderPromiseDateInput) {
      reminderPromiseDateInput.focus();
    }
  });
}

if (cancelReminderPromiseBtn && reminderInlinePromiseFieldset) {
  cancelReminderPromiseBtn.addEventListener('click', () => {
    reminderInlinePromiseFieldset.hidden = true;
  });
}

if (saveReminderPromiseBtn) {
  saveReminderPromiseBtn.addEventListener('click', () => {
    if (!currentReminderCustomer) return;
    const promisedDate = reminderPromiseDateInput?.value;
    if (!promisedDate) {
      toast('Please choose a promised commitment date.');
      reminderPromiseDateInput?.focus();
      return;
    }
    const promisedAmount = Number(reminderPromiseAmountInput?.value || 0);
    const note = reminderPromiseNoteInput?.value || '';

    recordCustomerPromise({
      customerId: currentReminderCustomer.id,
      customerNumber: currentReminderCustomer.customerNumber,
      customerName: currentReminderCustomer.name,
      phone: currentReminderCustomer.phone,
      area: currentReminderCustomer.area,
      promisedDate,
      promisedAmount,
      note
    });

    toast(`Promise-to-Pay recorded for ${formatDisplayDate(promisedDate)} (PKR ${promisedAmount.toLocaleString()})`);
    if (reminderInlinePromiseFieldset) reminderInlinePromiseFieldset.hidden = true;
  });
}

if (sendWhatsAppReminderBtn) {
  sendWhatsAppReminderBtn.addEventListener('click', () => {
    if (!currentReminderCustomer) return;
    const phone = currentReminderCustomer.phone || '';
    const text = reminderMessageText?.value || '';
    const wa = formatWhatsAppUrl(phone, text);
    if (!wa.validPhone) {
      toast('Invalid or missing Pakistani phone number. Please update customer phone first.');
      return;
    }

    const currentMonth = monthsForHistory(new Date())[0];
    const balance = getCustomerOutstandingDues(currentReminderCustomer, state, currentMonth);

    recordReminderDispatched({
      customer: currentReminderCustomer,
      templateType: reminderTemplateSelect?.value || 'due',
      method: 'whatsapp',
      dueAmount: balance,
      month: currentMonth
    });

    renderReminderCustomerHistory(currentReminderCustomer.id);
    window.open(wa.url, '_blank', 'noopener,noreferrer');
    toast(`Opening WhatsApp for ${wa.formattedPhone}...`);
  });
}

if (copyReminderTextBtn) {
  copyReminderTextBtn.addEventListener('click', async () => {
    const text = reminderMessageText?.value || '';
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      if (currentReminderCustomer) {
        const currentMonth = monthsForHistory(new Date())[0];
        const balance = getCustomerOutstandingDues(currentReminderCustomer, state, currentMonth);
        recordReminderDispatched({
          customer: currentReminderCustomer,
          templateType: reminderTemplateSelect?.value || 'due',
          method: 'copied',
          dueAmount: balance,
          month: currentMonth
        });
        renderReminderCustomerHistory(currentReminderCustomer.id);
      }
      toast('Reminder message copied to clipboard.');
    } catch {
      toast('Unable to copy to clipboard.');
    }
  });
}

if (printReminderSlipBtn) {
  printReminderSlipBtn.addEventListener('click', () => {
    if (!currentReminderCustomer) return;
    const c = currentReminderCustomer;
    const month = monthsForHistory(new Date())[0];
    const allocations = calculatePaymentAllocations(state);
    const summary = currentBillPresentation(c, month, allocations);
    const balance = summary.balanceDueCents !== null ? (summary.balanceDueCents / 100) : 0;
    const billAmount = summary.amount !== null && summary.amount !== undefined ? Number(summary.amount) : 0;
    const dueDate = c.customDueDate ? `${c.customDueDate}th of month` : '5th of month';

    recordReminderDispatched({
      customer: c,
      templateType: reminderTemplateSelect?.value || 'due',
      method: 'printed',
      dueAmount: balance,
      month
    });
    renderReminderCustomerHistory(c.id);

    const slipHtml = generatePaymentReminderSlipHtml({
      customer: c,
      templateType: reminderTemplateSelect?.value || 'due',
      billingData: {
        month,
        billAmount,
        balance,
        dueDate
      }
    });

    const printArea = $('#receiptPrintArea');
    if (printArea) {
      printArea.innerHTML = slipHtml;
      printArea.hidden = false;
      document.body.classList.add('printing-reminder');
      requestAnimationFrame(() => {
        try {
          window.print();
        } catch {
          toast('Printing is not supported in this browser.');
        } finally {
          document.body.classList.remove('printing-reminder');
          printArea.hidden = true;
          printArea.innerHTML = '';
        }
      });
    }
  });
}

// ==========================================================================
// WADA / PROMISE-TO-PAY FOLLOW-UP MODAL (Issue #222)
// ==========================================================================

export function renderWadaList() {
  if (!wadaModal || !wadaListContainer) return;
  const followup = getPromiseToPayFollowupList(state);

  // Update summary KPIs
  if (wadaTodayCountBadge) wadaTodayCountBadge.textContent = String(followup.summary.todayCount);
  if (wadaBrokenCountBadge) wadaBrokenCountBadge.textContent = String(followup.summary.brokenCount);
  if (wadaUpcomingCountBadge) wadaUpcomingCountBadge.textContent = String(followup.summary.upcomingCount);
  if (wadaTotalPromisedAmount) wadaTotalPromisedAmount.textContent = `PKR ${followup.summary.totalPromisedAmount.toLocaleString()}`;

  // Update tab highlights
  wadaTabs.forEach(t => {
    const btn = $(`#${t.id}`);
    if (btn) {
      const isActive = t.key === currentWadaActiveTab;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
  });

  const list = followup[currentWadaActiveTab] || [];
  if (list.length === 0) {
    wadaListContainer.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--muted, #64748b);">
        <p style="margin: 0; font-size: 13.5px; font-weight: 600;">No payment promises found in this category.</p>
        <p style="margin: 4px 0 0; font-size: 12px;">Use the '🤝 Wada / Promise' button in Customer Profile or Payment Reminders to record payment commitments.</p>
      </div>
    `;
    return;
  }

  const itemsHtml = list.map(p => {
    const isBroken = p.isBroken;
    const isToday = p.isToday;
    const isFulfilled = p.status === 'fulfilled';
    const badgeClass = isFulfilled ? 'wada-badge-fulfilled' : isBroken ? 'wada-badge-broken' : isToday ? 'wada-badge-today' : 'wada-badge-upcoming';
    const badgeLabel = isFulfilled ? '✓ Fulfilled' : isBroken ? `⚠️ Broken (${p.diffDays}d late)` : isToday ? '📅 Due Today' : `Upcoming (${formatDisplayDate(p.promisedDate)})`;
    const custNum = p.customerNumber != null ? `#${p.customerNumber}` : '';

    return `
      <div class="wada-card ${isBroken ? 'is-broken' : ''} ${isToday ? 'is-today' : ''} ${isFulfilled ? 'is-fulfilled' : ''}" data-promise-id="${escapeHtml(p.id)}">
        <div class="wada-card-header">
          <div>
            <div class="wada-cust-name">${escapeHtml(p.customerName)} ${custNum ? `<span style="font-weight: 500; font-size: 12px; color: var(--muted, #71817c);">${custNum}</span>` : ''}</div>
            <div class="wada-cust-sub">${escapeHtml(p.area || 'Shahdara')} · ${escapeHtml(p.phone || 'No phone')}</div>
          </div>
          <span class="wada-badge ${badgeClass}">${badgeLabel}</span>
        </div>
        <div class="wada-card-body">
          <div>
            <span class="wada-amount-pill">Promised: PKR ${Number(p.promisedAmount || 0).toLocaleString()}</span>
            ${p.currentBalance > 0 ? `<span style="margin-left: 8px; font-size: 11px; color: var(--muted, #71817c);">(Outstanding Dues: PKR ${p.currentBalance.toLocaleString()})</span>` : ''}
          </div>
          ${p.note ? `<div class="wada-card-note">“${escapeHtml(p.note)}”</div>` : ''}
        </div>
        <div class="wada-actions">
          ${!isFulfilled && p.phone ? `
            <button class="primary-button whatsapp-button wada-btn" type="button" data-action="whatsapp" data-promise-id="${escapeHtml(p.id)}">💬 WhatsApp Follow-up</button>
          ` : ''}
          ${!isFulfilled ? `
            <button class="secondary-button wada-btn" type="button" data-action="collect" data-customer-id="${escapeHtml(p.customerId)}">💵 Quick Collect</button>
            <button class="secondary-button wada-btn" type="button" data-action="reschedule" data-promise-id="${escapeHtml(p.id)}">🔄 Reschedule</button>
            <button class="secondary-button wada-btn" type="button" data-action="fulfill" data-promise-id="${escapeHtml(p.id)}">✓ Fulfill</button>
            <button class="secondary-button wada-btn text-button danger" type="button" data-action="cancel" data-promise-id="${escapeHtml(p.id)}">✕ Cancel</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  wadaListContainer.innerHTML = itemsHtml;
}

export function openWadaFollowupModal(options = {}) {
  if (options.tab && ['today', 'broken', 'upcoming', 'fulfilled', 'all'].includes(options.tab)) {
    currentWadaActiveTab = options.tab;
  }
  renderWadaList();
  if (wadaModal?.showModal) wadaModal.showModal();
  else wadaModal?.setAttribute('open', '');
}

export function closeWadaFollowupModal() {
  if (wadaModal?.close) wadaModal.close();
  else wadaModal?.removeAttribute('open');
}

// Wada Tab Clicks
wadaTabs.forEach(t => {
  const btn = $(`#${t.id}`);
  if (btn) {
    btn.addEventListener('click', () => {
      currentWadaActiveTab = t.key;
      renderWadaList();
    });
  }
});

if (closeWadaModalBtn) closeWadaModalBtn.addEventListener('click', closeWadaFollowupModal);
if (closeWadaModalFooterBtn) closeWadaModalFooterBtn.addEventListener('click', closeWadaFollowupModal);

if (wadaModal) {
  wadaModal.addEventListener('click', (e) => {
    if (e.target === wadaModal) closeWadaFollowupModal();
  });
}

// Wada List Action Delegates
if (wadaListContainer) {
  wadaListContainer.addEventListener('click', (e) => {
    const target = e.target.closest('button[data-action]');
    if (!target) return;
    const action = target.getAttribute('data-action');
    const promiseId = target.getAttribute('data-promise-id');
    const customerId = target.getAttribute('data-customer-id');

    const promises = getCollectionPromises();
    const p = promises.find(item => item.id === promiseId);

    if (action === 'whatsapp' && p) {
      const msg = formatPromiseFollowupWhatsApp(p);
      const wa = formatWhatsAppUrl(p.phone || '', msg);
      if (!wa.validPhone) {
        toast('Customer phone number is invalid or missing.');
        return;
      }
      window.open(wa.url, '_blank', 'noopener,noreferrer');
      toast(`Opening WhatsApp follow-up for ${wa.formattedPhone}...`);
    } else if (action === 'collect') {
      closeWadaFollowupModal();
      if (window.quickCollectModalController?.selectAndOpen) {
        window.quickCollectModalController.selectAndOpen(customerId);
      } else if (window.quickCollectModalController?.open) {
        window.quickCollectModalController.open(customerId);
      }
    } else if (action === 'fulfill' && promiseId) {
      markPromiseFulfilled(promiseId);
      toast('Promise-to-pay marked as fulfilled.');
      renderWadaList();
    } else if (action === 'reschedule' && promiseId) {
      const nextDate = prompt('Enter new commitment date (YYYY-MM-DD):', getTodayDateString());
      if (nextDate && /^\d{4}-\d{2}-\d{2}$/.test(nextDate.trim())) {
        reschedulePromise(promiseId, nextDate.trim());
        toast(`Wada commitment rescheduled to ${formatDisplayDate(nextDate.trim())}.`);
        renderWadaList();
      }
    } else if (action === 'cancel' && promiseId) {
      cancelPromise(promiseId, 'Cancelled by operator');
      toast('Wada commitment cancelled.');
      renderWadaList();
    }
  });
}

// Open Reminders Queue from Wada Modal
if (openRemindersFromWadaBtn) {
  openRemindersFromWadaBtn.addEventListener('click', () => {
    closeWadaFollowupModal();
    const queueData = getRemindersTodayQueue(state);
    if (!queueData.queue || queueData.queue.length === 0) {
      openPaymentReminderModal(null, {
        isEmptyQueue: true,
        overdueCount: queueData.overdueCustomersCount
      });
      return;
    }
    openPaymentReminderModal(queueData.queue[0].customer, {
      queue: queueData.queue,
      index: 0
    });
  });
}

// Customer Profile Wada Button
if (openCustomerPromiseBtn) {
  openCustomerPromiseBtn.addEventListener('click', () => {
    if (!selectedCustomerId) {
      toast('Please select a customer first.');
      return;
    }
    const cust = state.customers.find(c => c.id === selectedCustomerId);
    if (!cust) return;
    openPaymentReminderModal(cust);
    if (reminderInlinePromiseFieldset) {
      reminderInlinePromiseFieldset.hidden = false;
      reminderPromiseDateInput?.focus();
    }
  });
}

// ==========================================================================
// REMINDER STAGES CONFIGURATION MODAL (Issue #222)
// ==========================================================================

export function renderReminderStagesTable() {
  if (!reminderStagesTableBody) return;
  const stages = getReminderStagesSettings();

  const rowsHtml = stages.map(s => {
    return `
      <tr data-stage-id="${escapeHtml(s.id)}" style="border-bottom: 1px solid var(--line, #e2ece7);">
        <td style="padding: 8px 4px; text-align: center;">
          <input type="checkbox" class="stage-enabled-input" ${s.enabled !== false ? 'checked' : ''} aria-label="Enable stage ${escapeHtml(s.label)}">
        </td>
        <td style="padding: 8px;">
          <input type="text" class="stage-label-input" value="${escapeHtml(s.label)}" style="width: 100%; min-width: 130px;">
        </td>
        <td style="padding: 8px;">
          <input type="number" class="stage-offset-input" value="${Number(s.offsetDays)}" style="width: 70px;">
        </td>
        <td style="padding: 8px;">
          <select class="stage-template-input">
            <option value="due" ${s.template === 'due' ? 'selected' : ''}>📅 Due</option>
            <option value="overdue" ${s.template === 'overdue' ? 'selected' : ''}>⏳ Overdue</option>
            <option value="disconnection" ${s.template === 'disconnection' ? 'selected' : ''}>⚠️ Disconnection</option>
          </select>
        </td>
        <td style="padding: 8px; font-size: 11.5px; color: var(--muted, #64748b);">
          ${escapeHtml(s.description || '')}
        </td>
      </tr>
    `;
  }).join('');

  reminderStagesTableBody.innerHTML = rowsHtml;
}

export function openReminderStagesModal() {
  renderReminderStagesTable();
  if (reminderStagesModal?.showModal) reminderStagesModal.showModal();
  else reminderStagesModal?.setAttribute('open', '');
}

export function closeReminderStagesModal() {
  if (reminderStagesModal?.close) reminderStagesModal.close();
  else reminderStagesModal?.removeAttribute('open');
}

if (closeReminderStagesModalBtn) closeReminderStagesModalBtn.addEventListener('click', closeReminderStagesModal);
if (cancelReminderStagesBtn) cancelReminderStagesBtn.addEventListener('click', closeReminderStagesModal);

if (reminderStagesModal) {
  reminderStagesModal.addEventListener('click', (e) => {
    if (e.target === reminderStagesModal) closeReminderStagesModal();
  });
}

if (resetReminderStagesBtn) {
  resetReminderStagesBtn.addEventListener('click', () => {
    resetReminderStagesSettings();
    renderReminderStagesTable();
    toast('Reminder stages reset to system defaults.');
  });
}

if (saveReminderStagesBtn && reminderStagesTableBody) {
  saveReminderStagesBtn.addEventListener('click', () => {
    const rows = reminderStagesTableBody.querySelectorAll('tr[data-stage-id]');
    const newStages = [];
    rows.forEach(tr => {
      const id = tr.getAttribute('data-stage-id');
      const enabled = tr.querySelector('.stage-enabled-input')?.checked ?? true;
      const label = tr.querySelector('.stage-label-input')?.value?.trim() || 'Reminder Stage';
      const offsetDays = parseInt(tr.querySelector('.stage-offset-input')?.value || '0', 10);
      const template = tr.querySelector('.stage-template-input')?.value || 'due';
      newStages.push({
        id,
        enabled,
        label,
        offsetDays: isNaN(offsetDays) ? 0 : offsetDays,
        template,
        description: `${offsetDays >= 0 ? '+' + offsetDays : offsetDays} days from due date`
      });
    });

    saveReminderStagesSettings(newStages);
    toast('Reminder stages saved successfully.');
    closeReminderStagesModal();
  });
}

// ==========================================================================
// CUSTOMER MONTHLY BILL INVOICE MODAL & ACTIONS
// ==========================================================================
let currentInvoiceCustomer = null;
const openInvoiceBtn = $('#openBillInvoiceBtn');
const invoiceModal = $('#customerBillInvoiceModal');
const closeInvoiceBtn = $('#closeBillInvoiceModalBtn');
const invoiceMonthSelect = $('#invoiceMonthSelect');
const invoiceFormatSelect = $('#invoiceFormatSelect');
const invoiceCustomNote = $('#invoiceCustomNote');
const printInvoiceBtn = $('#printBillInvoiceBtn');
const sendWhatsAppInvoiceBtn = $('#sendWhatsAppInvoiceBtn');
const copyInvoiceTextBtn = $('#copyInvoiceTextBtn');
const downloadInvoiceHtmlBtn = $('#downloadInvoiceHtmlBtn');
const invoicePreviewContainer = $('#billInvoicePreviewContainer');

export function renderBillInvoiceContent() {
  if (!currentInvoiceCustomer || !invoicePreviewContainer) return;
  const month = invoiceMonthSelect?.value || null;
  const format = invoiceFormatSelect?.value || 'standard';
  const customNote = invoiceCustomNote?.value || '';
  const data = buildCustomerBillInvoiceData(currentInvoiceCustomer, month);
  const html = generateBillInvoiceHtml(data, { format, customNote });
  invoicePreviewContainer.innerHTML = html;
}

export function openCustomerBillInvoiceModal(cust) {
  if (!cust) return;
  currentInvoiceCustomer = cust;

  // Populate available months in invoiceMonthSelect
  if (invoiceMonthSelect) {
    invoiceMonthSelect.innerHTML = '';
    const bills = Array.isArray(cust.bills) ? cust.bills : [];
    const months = [...new Set(bills.map(b => b.month).filter(Boolean))].sort().reverse();
    const currentMonth = monthsForHistory(new Date())[0];
    if (!months.includes(currentMonth)) {
      months.unshift(currentMonth);
    }
    months.forEach((m, idx) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = `${m}${idx === 0 ? ' (Current / Latest)' : ''}`;
      invoiceMonthSelect.appendChild(opt);
    });
    if (months.length > 0) invoiceMonthSelect.value = months[0];
  }

  if (invoiceFormatSelect) invoiceFormatSelect.value = 'standard';
  if (invoiceCustomNote) invoiceCustomNote.value = '';

  renderBillInvoiceContent();

  if (invoiceModal?.showModal) invoiceModal.showModal();
  else invoiceModal?.setAttribute('open', '');
}

if (openInvoiceBtn && invoiceModal) {
  openInvoiceBtn.addEventListener('click', () => {
    if (!selectedCustomerId) {
      toast('Please select a customer first.');
      return;
    }
    const cust = state.customers.find(c => c.id === selectedCustomerId);
    if (!cust) return;
    openCustomerBillInvoiceModal(cust);
  });
}

if (closeInvoiceBtn && invoiceModal) {
  closeInvoiceBtn.addEventListener('click', () => {
    if (invoiceModal.close) invoiceModal.close();
    else invoiceModal.removeAttribute('open');
  });
}

if (invoiceModal) {
  invoiceModal.addEventListener('click', (e) => {
    if (e.target === invoiceModal) {
      if (invoiceModal.close) invoiceModal.close();
      else invoiceModal.removeAttribute('open');
    }
  });
}

if (invoiceMonthSelect) {
  invoiceMonthSelect.addEventListener('change', renderBillInvoiceContent);
}

if (invoiceFormatSelect) {
  invoiceFormatSelect.addEventListener('change', renderBillInvoiceContent);
}

if (invoiceCustomNote) {
  invoiceCustomNote.addEventListener('input', renderBillInvoiceContent);
}

if (printInvoiceBtn) {
  printInvoiceBtn.addEventListener('click', () => {
    if (!currentInvoiceCustomer) return;
    document.body.classList.add('printing-invoice');
    requestAnimationFrame(() => {
      try {
        window.print();
      } catch {
        toast('Printing is not supported in this browser.');
      } finally {
        document.body.classList.remove('printing-invoice');
      }
    });
  });
}

if (sendWhatsAppInvoiceBtn) {
  sendWhatsAppInvoiceBtn.addEventListener('click', () => {
    if (!currentInvoiceCustomer) return;
    const month = invoiceMonthSelect?.value || null;
    const customNote = invoiceCustomNote?.value || '';
    const data = buildCustomerBillInvoiceData(currentInvoiceCustomer, month);
    const text = buildWhatsAppBillInvoiceText(data, customNote);
    const wa = formatWhatsAppUrl(data.phone, text);
    if (!wa.validPhone) {
      toast('Invalid or missing Pakistani phone number. Please update customer phone first.');
      return;
    }
    window.open(wa.url, '_blank', 'noopener,noreferrer');
    toast(`Opening WhatsApp for ${wa.formattedPhone}...`);
  });
}

if (copyInvoiceTextBtn) {
  copyInvoiceTextBtn.addEventListener('click', async () => {
    if (!currentInvoiceCustomer) return;
    const month = invoiceMonthSelect?.value || null;
    const customNote = invoiceCustomNote?.value || '';
    const data = buildCustomerBillInvoiceData(currentInvoiceCustomer, month);
    const text = buildWhatsAppBillInvoiceText(data, customNote);
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      toast('Bill invoice message copied to clipboard.');
    } catch {
      toast('Unable to copy to clipboard.');
    }
  });
}

if (downloadInvoiceHtmlBtn) {
  downloadInvoiceHtmlBtn.addEventListener('click', () => {
    if (!currentInvoiceCustomer) return;
    const month = invoiceMonthSelect?.value || null;
    const format = invoiceFormatSelect?.value || 'standard';
    const customNote = invoiceCustomNote?.value || '';
    const data = buildCustomerBillInvoiceData(currentInvoiceCustomer, month);
    const standaloneHtml = generateStandaloneInvoiceDocument(data, { format, customNote });
    const filename = `Invoice_${data.customerNumber || data.id}_${data.month || 'slip'}.html`;
    downloadHtmlFile(filename, standaloneHtml);
    toast(`Downloaded invoice: ${filename}`);
  });
}

// ==========================================================================
// CUSTOMER LEDGER RECONCILIATION & AUDIT MODAL (agent3 - shahdara-forms-qa)
// ==========================================================================
let currentAuditCustomer = null;
let currentAuditResult = null;
const openLedgerAuditBtn = $('#openLedgerAuditBtn');
const ledgerAuditModal = $('#customerLedgerAuditModal');
const closeLedgerAuditModalBtn = $('#closeLedgerAuditModalBtn');
const auditStatusPill = $('#auditStatusPill');
const auditTotalBilledVal = $('#auditTotalBilledVal');
const auditTotalPaidVal = $('#auditTotalPaidVal');
const auditOutstandingVal = $('#auditOutstandingVal');
const auditUnappliedCreditVal = $('#auditUnappliedCreditVal');
const auditDiscrepancyBox = $('#auditDiscrepancyBox');
const auditDiscrepancyCleanMsg = $('#auditDiscrepancyCleanMsg');
const auditDiscrepancyList = $('#auditDiscrepancyList');
const auditTableBody = $('#auditTableBody');
const printLedgerAuditBtn = $('#printLedgerAuditBtn');
const copyLedgerAuditReportBtn = $('#copyLedgerAuditReportBtn');
const exportLedgerAuditCsvBtn = $('#exportLedgerAuditCsvBtn');

export function renderLedgerAuditModal(customer) {
  if (!customer) return;
  currentAuditCustomer = customer;
  currentAuditResult = reconcileCustomerLedger(customer, state);

  if (auditStatusPill) {
    auditStatusPill.className = `audit-status-badge ${currentAuditResult.statusClass}`;
    auditStatusPill.textContent = currentAuditResult.statusLabel;
  }
  if (auditTotalBilledVal) {
    auditTotalBilledVal.textContent = `PKR ${Number(currentAuditResult.totalBilled).toLocaleString()}`;
  }
  if (auditTotalPaidVal) {
    auditTotalPaidVal.textContent = `PKR ${Number(currentAuditResult.totalPaid).toLocaleString()}`;
  }
  if (auditOutstandingVal) {
    auditOutstandingVal.textContent = `PKR ${Number(currentAuditResult.netOutstanding).toLocaleString()}`;
  }
  if (auditUnappliedCreditVal) {
    auditUnappliedCreditVal.textContent = `PKR ${Number(currentAuditResult.unappliedCredit).toLocaleString()}`;
  }

  if (auditDiscrepancyBox && auditDiscrepancyList && auditDiscrepancyCleanMsg) {
    const hasIssues = currentAuditResult.discrepancies.length > 0;
    auditDiscrepancyBox.classList.toggle('has-discrepancies', hasIssues);
    auditDiscrepancyCleanMsg.hidden = hasIssues;
    auditDiscrepancyList.hidden = !hasIssues;
    auditDiscrepancyList.innerHTML = '';

    if (hasIssues) {
      currentAuditResult.discrepancies.forEach(d => {
        const li = document.createElement('li');
        li.className = `audit-discrepancy-item ${d.severity}`;
        li.textContent = `[${d.severity.toUpperCase()}] ${d.message}`;
        auditDiscrepancyList.appendChild(li);
      });
    }
  }

  if (auditTableBody) {
    auditTableBody.innerHTML = '';
    if (currentAuditResult.auditRows.length > 0) {
      currentAuditResult.auditRows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(r.monthLabel || r.month)}</td>
          <td>${escapeHtml(r.dueDate)}</td>
          <td class="text-right">PKR ${Number(r.billedAmount).toLocaleString()}</td>
          <td class="text-right">PKR ${Number(r.paidAmount).toLocaleString()}</td>
          <td class="text-right font-bold">PKR ${Number(r.balanceAmount).toLocaleString()}</td>
          <td class="text-center"><span class="audit-status-tag ${(r.status || '').toLowerCase()}">${escapeHtml(r.status)}</span></td>
        `;
        auditTableBody.appendChild(tr);
      });
    } else {
      auditTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No billing history found for this subscriber.</td></tr>';
    }
  }
}

if (openLedgerAuditBtn && ledgerAuditModal) {
  openLedgerAuditBtn.addEventListener('click', () => {
    if (!selectedCustomerId) {
      toast('Please select a customer first.');
      return;
    }
    const cust = state.customers.find(c => c.id === selectedCustomerId);
    if (!cust) return;
    renderLedgerAuditModal(cust);
    if (ledgerAuditModal.showModal) ledgerAuditModal.showModal();
    else ledgerAuditModal.setAttribute('open', '');
  });
}

if (closeLedgerAuditModalBtn && ledgerAuditModal) {
  closeLedgerAuditModalBtn.addEventListener('click', () => {
    if (ledgerAuditModal.close) ledgerAuditModal.close();
    else ledgerAuditModal.removeAttribute('open');
  });
}

if (ledgerAuditModal) {
  ledgerAuditModal.addEventListener('click', (e) => {
    if (e.target === ledgerAuditModal) {
      if (ledgerAuditModal.close) ledgerAuditModal.close();
      else ledgerAuditModal.removeAttribute('open');
    }
  });
}

if (printLedgerAuditBtn) {
  printLedgerAuditBtn.addEventListener('click', () => {
    if (!currentAuditCustomer) return;
    document.body.classList.add('printing-audit');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-audit');
    }, 500);
  });
}

if (copyLedgerAuditReportBtn) {
  copyLedgerAuditReportBtn.addEventListener('click', async () => {
    if (!currentAuditCustomer || !currentAuditResult) return;
    const reportText = generateLedgerAuditReport(currentAuditResult, currentAuditCustomer);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(reportText);
      }
      toast('Audit report copied to clipboard.');
    } catch {
      toast('Unable to copy audit report to clipboard.');
    }
  });
}

if (exportLedgerAuditCsvBtn) {
  exportLedgerAuditCsvBtn.addEventListener('click', () => {
    if (!currentAuditCustomer || !currentAuditResult) return;
    const csv = generateLedgerAuditCsv(currentAuditResult, currentAuditCustomer);
    const filename = `Ledger_Audit_${currentAuditCustomer.customerNumber || currentAuditCustomer.id}_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsvFile(filename, csv);
    toast(`Exported ledger audit: ${filename}`);
  });
}

// Setup Daily Cash Register & Day-End Closing (Roshnamcha)
export let dailyRegisterController;
// FIRST-LOAD SPLIT (2026-10-28): QA-certification modal setups used to run in
// the boot block, which pulled ~1.09 MB of qa-* code into the static
// first-load graph. They now run here, once, on first profile open (see the
// renderDetail hook) or first interaction (see the boot-block listeners) —
// whichever comes first — via the lazy chunk in lazy-qa.js. Every call below
// is verbatim from the old boot block (same args, same guards), plus a
// !controller guard so a retried load never double-wires a modal. QA open
// buttons keep working during the load window: thermal-pattern buttons call
// dialog.showModal() directly (setup wires the internals in place), and
// controller?.open() buttons no-op until setup lands, then work on the next
// tap. The two window.* exposures move here too (they were boot-time before).
let qaModalsPromise = null;
function ensureQaModals() {
  if (!qaModalsPromise) {
    qaModalsPromise = loadQaSetups().then((qa) => {
  const adssModal = $('#adssSagTensionModal');
  const openAdssSagTensionBtn = $('#openAdssSagTensionBtn');
  if (adssModal && !customerAdssSagTensionModalController) { customerAdssSagTensionModalController = qa.setupAdssSagTensionModal({
      state,
      dialogElement: adssModal,
      triggerButton: openAdssSagTensionBtn,
      onToast: (msg, opts) => toast(msg, opts)
    }); }

  const armoredModal = $('#armoredCableCrushModal');
  const openArmoredCableCrushBtn = $('#openArmoredCableCrushBtn');
  if (armoredModal && !customerArmoredCableCrushModalController) { customerArmoredCableCrushModalController = qa.setupArmoredCableCrushModal({
      state,
      dialogElement: armoredModal,
      triggerButton: openArmoredCableCrushBtn,
      onToast: (msg, opts) => toast(msg, opts)
    }); }

  if (!customerBendLossModalController) { customerBendLossModalController = qa.setupBendLossCertModal({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts),
    getCustomerData: () => (selectedCustomerId ? state.customers.find(c => c.id === selectedCustomerId) : null)
  }); }

  if (!customerBidirectionalOtdrModalController) { customerBidirectionalOtdrModalController = qa.setupBidirectionalOtdrModal({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts),
    getCustomerData: () => (selectedCustomerId ? state.customers.find(c => c.id === selectedCustomerId) : null)
  }); }

  if (!billingCorrectnessModalController) { billingCorrectnessModalController = qa.setupBillingCorrectnessModal({
    getState: () => state,
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  }); }

  const jettingModal = $('#cableJettingModal');
  const openCableJettingBtn = $('#openCableJettingBtn');
  if (jettingModal && !customerCableJettingModalController) { customerCableJettingModalController = qa.setupCableJettingModal({
      state,
      dialogElement: jettingModal,
      triggerButton: openCableJettingBtn,
      onToast: (msg, opts) => toast(msg, opts)
    }); }

  const conduitPullingModal = $('#conduitPullingModal');
  const openConduitPullingBtn = $('#openConduitPullingBtn');
  if (conduitPullingModal && !customerConduitPullingModalController) { customerConduitPullingModalController = qa.setupConduitPullingModal({
      state,
      dialogElement: conduitPullingModal,
      triggerButton: openConduitPullingBtn,
      onToast: (msg, opts) => toast(msg, opts)
    }); }

  if (!customerDdmiCertModalController) { customerDdmiCertModalController = qa.setupDdmiCertModal({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  }); }

  if (!customerDispersionModalController) { customerDispersionModalController = qa.setupDispersionCertModal({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  }); }

  const fastModal = $('#fastConnectorQaModal');
  const openFastConnectorQaBtn = $('#openFastConnectorQaBtn');
  if (fastModal && !customerFastConnectorQaModalController) { customerFastConnectorQaModalController = qa.setupFastConnectorQaModal({
      state,
      dialogElement: fastModal,
      triggerButton: openFastConnectorQaBtn,
      onToast: (msg, opts) => toast(msg, opts)
    }); }

  if (!customerFerruleGeometryModalController) { customerFerruleGeometryModalController = qa.setupFerruleGeometryModal({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  }); }

  const cleaveModal = $('#fiberCleaveQualityModal');
  const openFiberCleaveQualityBtn = $('#openFiberCleaveQualityBtn');
  if (cleaveModal && !customerFiberCleaveQualityModalController) { customerFiberCleaveQualityModalController = qa.setupFiberCleaveQualityModal({
      dialogElement: cleaveModal,
      triggerButton: openFiberCleaveQualityBtn,
      storage: typeof localStorage !== 'undefined' ? localStorage : null,
      onToast: (msg, opts) => toast(msg, opts)
    }); }

  const foscSealModal = $('#foscSealModal');
  const openFoscSealBtn = $('#openFoscSealBtn');
  if (foscSealModal && !customerFoscSealModalController) { customerFoscSealModalController = qa.setupFoscSealModal({
      state,
      dialogElement: foscSealModal,
      triggerButton: openFoscSealBtn,
      onToast: (msg, opts) => toast(msg, opts)
    }); }

  if (!customerFusionArcQaModalController) { customerFusionArcQaModalController = qa.setupFusionArcQaModal({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  }); }

  if (!lateFeeModalController) { lateFeeModalController = qa.setupLateFeeModal({
    getState: () => state,
    updateState: (newState) => {
      state = newState;
      save();
      renderDetail();
      renderCustomers();
      renderDashboard();
    },
    toast: (msg) => toast(msg)
  }); }

  if (!customerOrlCertModalController) { customerOrlCertModalController = qa.setupOrlCertModal({
    getState: () => state,
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  }); }

  if (!customerOtdrDeadzoneModalController) { customerOtdrDeadzoneModalController = qa.setupOtdrDeadzoneModal({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  }); }

  const ghostModal = $('#otdrGhostArtifactModal');
  const openOtdrGhostArtifactBtn = $('#openOtdrGhostArtifactBtn');
  if (ghostModal && !customerOtdrGhostArtifactModalController) { customerOtdrGhostArtifactModalController = qa.setupOtdrGhostArtifactModal({
      dialogElement: ghostModal,
      triggerButton: openOtdrGhostArtifactBtn,
      storage: typeof localStorage !== 'undefined' ? localStorage : null,
      onToast: (msg, opts) => toast(msg, opts)
    }); }

  const ribbonModal = $('#ribbonSpliceQaModal');
  const openRibbonSpliceQaBtn = $('#openRibbonSpliceQaBtn');
  if (ribbonModal && !customerRibbonSpliceQaModalController) { customerRibbonSpliceQaModalController = qa.setupRibbonSpliceQaModal({
      state,
      dialogElement: ribbonModal,
      triggerButton: openRibbonSpliceQaBtn,
      onToast: (msg, opts) => toast(msg, opts)
    }); }

  const spectralAttenuationModal = $('#spectralAttenuationModal');
  const openSpectralAttenuationBtn = $('#openSpectralAttenuationBtn');
  if (spectralAttenuationModal && !customerSpectralAttenuationModalController) { customerSpectralAttenuationModalController = qa.setupSpectralAttenuationModal({
      state,
      dialogElement: spectralAttenuationModal,
      triggerButton: openSpectralAttenuationBtn,
      onToast: (msg, opts) => toast(msg, opts)
    }); }

  const spliceModal = $('#spliceMfdOffsetModal');
  const openSpliceMfdOffsetBtn = $('#openSpliceMfdOffsetBtn');
  if (spliceModal && !customerSpliceMfdOffsetModalController) { customerSpliceMfdOffsetModalController = qa.setupSpliceMfdOffsetModal({
      dialogElement: spliceModal,
      triggerButton: openSpliceMfdOffsetBtn,
      storage: typeof localStorage !== 'undefined' ? localStorage : null,
      onToast: (msg, opts) => toast(msg, opts)
    }); }

  const sleeveModal = $('#spliceSleeveCureModal');
  const openSpliceSleeveCureBtn = $('#openSpliceSleeveCureBtn');
  if (sleeveModal && !customerSpliceSleeveCureModalController) { customerSpliceSleeveCureModalController = qa.setupSpliceSleeveCureModal({
      dialogElement: sleeveModal,
      triggerButton: openSpliceSleeveCureBtn,
      storage: typeof localStorage !== 'undefined' ? localStorage : null,
      onToast: (msg, opts) => toast(msg, opts)
    }); }

  if (!customerSplitterQaModalController) { customerSplitterQaModalController = qa.setupSplitterQaModal({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  }); }

  if (!customerStripForceQaModalController) { customerStripForceQaModalController = qa.setupStripForceQaModal({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  }); }

  const thermalCyclingModal = $('#thermalCyclingModal');
  const openThermalCyclingBtn = $('#openThermalCyclingBtn');
  if (thermalCyclingModal && !customerThermalCyclingModalController) { customerThermalCyclingModalController = qa.setupThermalCyclingModal({
      state,
      dialogElement: thermalCyclingModal,
      triggerButton: openThermalCyclingBtn,
      onToast: (msg, opts) => toast(msg, opts)
    }); }

  const tubeSlittingModal = $('#tubeSlittingAccessModal');
  const openTubeSlittingAccessBtn = $('#openTubeSlittingAccessBtn');
  if (tubeSlittingModal && !customerTubeSlittingModalController) { customerTubeSlittingModalController = qa.setupTubeSlittingAccessModal({
      state,
      dialogElement: tubeSlittingModal,
      triggerButton: openTubeSlittingAccessBtn,
      onToast: (msg, opts) => toast(msg, opts)
    }); }
          return true;
    }).catch((err) => {
      qaModalsPromise = null;
      toast('QA certificates could not be loaded — try opening the profile again.');
      throw err;
    });
  }
  return qaModalsPromise;
}

if (typeof document !== 'undefined') {
  // FIRST-LOAD SPLIT: also start the QA chunk load on first interaction, so it
  // is usually ready by the time any QA feature is opened. Never before paint.
  const startQaLoad = () => { ensureQaModals().catch(() => {}); };
  document.addEventListener('pointerdown', startQaLoad, { once: true, passive: true });
  document.addEventListener('keydown', startQaLoad, { once: true, passive: true });
  dailyRegisterController = setupDailyRegisterModal({
    getState: () => state,
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  });

  const dailyCashRegisterModal = $('#dailyCashRegisterModal');
  if (dailyCashRegisterModal) {
    dailyCashRegisterModal.addEventListener('click', (e) => {
      if (e.target === dailyCashRegisterModal) {
        if (dailyCashRegisterModal.close) dailyCashRegisterModal.close();
        else dailyCashRegisterModal.removeAttribute('open');
      }
    });
  }
}

// Setup Customer Ledger Adjustment & Outage Voucher Modal Controller
export let customerAdjustmentModalController;
export let customerServiceContractModalController;
export let customerDisputeModalController;
export let customerKycComplianceModalController;
export let customerEquipmentRetrievalModalController;
export let customerSpliceInspectionModalController;
export let customerPlanMigrationModalController;
export let customerOpticalAcceptanceModalController;
export let customerDropSafetyModalController;
export let customerEthernetCertModalController;
export let customerOrlCertModalController;
export let customerDdmiCertModalController;
export let customerDispersionModalController;
export let customerBendLossModalController;
export let customerBidirectionalOtdrModalController;
export let customerOtdrDeadzoneModalController;
export let customerSplitterQaModalController;
export let customerFerruleGeometryModalController;
export let customerFusionArcQaModalController;
export let customerStripForceQaModalController;
export let customerSpliceMfdOffsetModalController;
export let customerSpliceSleeveCureModalController;
export let customerFiberCleaveQualityModalController;
export let customerOtdrGhostArtifactModalController;
export let customerRibbonSpliceQaModalController;
export let customerFastConnectorQaModalController;
export let customerAdssSagTensionModalController;
export let customerArmoredCableCrushModalController;
export let customerCableJettingModalController;
export let customerTubeSlittingModalController;
export let customerConduitPullingModalController;
export let customerSpectralAttenuationModalController;
export let customerFoscSealModalController;
export let customerThermalCyclingModalController;
export let billingCorrectnessModalController;
export let dataIntegrityModalController;
if (typeof document !== 'undefined') {
  collectionTargetController = setupCollectionTargetModal(state);
  duesAgingController = setupDuesAgingModal(state, {
    onFilterCustomer: (customerId) => {
      selectCustomer(customerId);
      switchView('customers');
    },
    onToast: (msg, opts) => toast(msg, opts)
  });
  topDefaultersModalController = setupTopDefaultersModal(() => state, {
    onFilterCustomer: (customerId) => {
      selectCustomer(customerId);
      switchView('customers');
    },
    onToast: (msg, opts) => toast(msg, opts),
    onWaadaChange: () => { try { persistState(state, localStorage); } catch {} }
  });
  zoneSheetDialogController = setupZoneSheetDialog(() => state, {
    onToast: (msg, opts) => toast(msg, opts)
  });
  expenseVoucherDialogController = setupExpenseVoucherDialog(() => state, {
    getPartnerEntries: () => loadPartnerLedgerEntries(),
    onToast: (msg, opts) => toast(msg, opts)
  });
  bulkTariffDialogController = setupBulkTariffDialog(() => state, {
    onUpdateState: (newState) => {
      state = newState;
      save();
    },
    onToast: (msg, opts) => toast(msg, opts)
  });
  ownerPinGuardController = setupOwnerPinGuard({
    onToast: (msg, opts) => toast(msg, opts)
  });
  multiMonthMatrixController = setupMultiMonthMatrix(() => state, {
    getComplaints: () => loadComplaints()
  });
  if (multiMonthMatrixController) multiMonthMatrixController.refresh();
  areaCollectionsModalController = setupAreaCollectionsModal(() => state, {
    onFilterCustomerArea: (areaName) => {
      const search = $('#globalCustomerSearch');
      if (search) {
        search.value = areaName;
        renderGlobalSearch();
      }
      switchView('customers');
    },
    onToast: (msg, opts) => toast(msg, opts)
  });
  packageRevenueModalController = setupPackageRevenueModal(() => state, {
    onFilterPackageCustomers: (pkgLabel) => {
      const search = $('#globalCustomerSearch');
      if (search) {
        search.value = pkgLabel;
        renderGlobalSearch();
      }
      switchView('customers');
    },
    onToast: (msg, opts) => toast(msg, opts)
  });
  pnlModalController = setupPnlModal(() => state, {
    onToast: (msg, opts) => toast(msg, opts)
  });
  momGrowthModalController = setupMomGrowthModal(() => state, {
    onToast: (msg, opts) => toast(msg, opts)
  });
  dailyClosingModalController = setupDailyClosingModal(() => state, {
    onToast: (msg, opts) => toast(msg, opts)
  });
  shopSettlementModalController = setupShopSettlementModal(() => state, {
    onUpdateState: (newState) => {
      state = newState;
      save();
    },
    onToast: (msg, opts) => toast(msg, opts)
  });
  commissionModalController = setupCommissionModal(() => state, {
    onUpdateState: (newState) => {
      state = newState;
      save();
    },
    onToast: (msg, opts) => toast(msg, opts)
  });
  billingCycleModalController = setupBillingCycleModal(() => state, {
    onUpdateState: (newState) => {
      state = newState;
      save();
    },
    onToast: (msg, opts) => toast(msg, opts)
  });
  complaintRegisterModalController = setupComplaintRegisterModal(() => state, {
    onComplaintsChanged: () => {
      recordComplaintTicketSync('complaint');
      recordTicketStockBridge();
      renderDashboard();
      renderDetail();
      if (downtimeAnalyticsModalController) downtimeAnalyticsModalController.refresh();
      if (monthlyComplaintReportModalController) monthlyComplaintReportModalController.refresh();
    },
    // SISP-44: the register card shows the linked ticket (or the
    // 1-click assign controls) via complaint-ticket-sync.js.
    getTicketLink: (complaintId) => linkedTicketSummary(loadTickets(), complaintId),
    onAssignTicket: (complaintId, technician) => {
      const result = assignTicketForComplaint(loadComplaints(), loadTickets(), complaintId, { technician });
      if (result.created) {
        saveTickets(result.tickets);
        if (fieldTicketsModalController) fieldTicketsModalController.refresh();
      }
      return { ticket: result.ticket, created: result.created };
    },
    // SISP-49: the card's daisy-chain banner launches the SISP-7 bulk
    // WhatsApp outage notifications for the complaint's downstream
    // homes — open the outage tool prefilled with the feeder customer.
    onLaunchOutageAlerts: (customerId) => {
      if (outageImpactModalController) outageImpactModalController.open({ sourceId: String(customerId) });
    },
    onToast: (msg, opts) => toast(msg, opts)
  });
  fieldTicketsModalController = setupFieldTicketsModal(() => state, {
    onTicketsChanged: () => {
      recordComplaintTicketSync('ticket');
      recordTicketStockBridge();
      renderDashboard();
      renderDetail();
    },
    // SISP-56: the ticket card's 1-click action opens the Saad Visit
    // Log pre-filled from the resolved ticket; the logged-ticket list
    // (visits' ticketId links) drives the button's logged state.
    listLoggedVisitTicketIds: () => loadSaadVisits().map((v) => v.ticketId).filter(Boolean),
    // OWNER-SIGNAL: a before/after signal saved on a ticket is a fresh
    // measurement — journal it into that customer's signal history
    // (which also refreshes their lastRxDbm) under the ticket's id.
    onTicketSignal: (ticket, phase) => {
      const dbm = phase === 'before' ? ticket.signalBeforeDbm : ticket.signalAfterDbm;
      if (dbm === null || dbm === undefined) return;
      const idx = state.customers.findIndex(c => String(c.id) === String(ticket.customerId));
      if (idx < 0) return;
      state.customers[idx] = appendSignalReading(state.customers[idx], {
        dbm,
        source: phase === 'before' ? 'complaint-before' : 'complaint-after',
        complaintId: ticket.id
      });
      save();
      renderDashboard();
      renderDetail();
    },
    onLogSaadVisit: (ticket) => {
      const prefill = buildVisitPrefillFromTicket(ticket, state.customers || []);
      if (prefill && saadVisitsModalController) saadVisitsModalController.open(prefill);
    },
    onToast: (msg, opts) => toast(msg, opts)
  });
  // SISP-44: converge any linked complaint/ticket pairs recorded before
  // the sync existed, then SISP-42: one bridge pass at startup so
  // deductions left pending by an earlier shortfall (or staged before
  // this wiring existed) land in the stock book without waiting for the
  // next ticket edit.
  recordComplaintTicketSync();
  recordTicketStockBridge();
  // SISP-45: one expense-sync pass at startup so roznamcha outflows
  // recorded before this wiring existed (or restored with the day
  // ledger) are mirrored into the Expenses ledger exactly once.
  recordRoznamchaExpenseSync();
  // SISP-56: one Saad-payment sync pass at startup so payouts recorded
  // before this wiring existed (or restored) mirror into Expenses and
  // the Roznamcha exactly once.
  recordSaadPaymentSync();
  // SISP-68: one shop-pickup sync pass at startup so partner-kept shop
  // handovers recorded before this wiring existed (or restored) mirror
  // into the partner ledger as drawings exactly once.
  recordShopPickupDrawingSync();
  downtimeAnalyticsModalController = setupDowntimeAnalyticsModal(() => state, {
    onToast: (msg, opts) => toast(msg, opts)
  });
  splitterMapModalController = setupSplitterMapModal(() => state, {
    // SISP-66: the weak-port list's 1-click button creates the SISP-12
    // attenuation ticket through the normal ticket store (deduped while
    // an unresolved ticket for the same box + port exists).
    onCreateAttenuationTicket: (payload) => {
      const result = createAttenuationTicket(loadTickets(), payload);
      if (result.created) {
        saveTickets(result.tickets);
        if (fieldTicketsModalController) fieldTicketsModalController.refresh();
        renderDashboard();
      }
      return result;
    },
    onToast: (msg, opts) => toast(msg, opts)
  });
  // OWNER-SIGNAL: per-mohalla average signal view (read-only).
  areaSignalModalController = setupAreaSignalModal(() => state, {
    onToast: (msg, opts) => toast(msg, opts)
  });
  spliceClosureModalController = setupSpliceClosureModal(() => state, {
    onToast: (msg, opts) => toast(msg, opts),
    onConfirm: (opts) => appConfirm(opts)
  });
  monthlyComplaintReportModalController = setupMonthlyComplaintReportModal(() => state, {
    onToast: (msg, opts) => toast(msg, opts)
  });
  roznamchaModalController = setupRoznamchaModal(() => state, {
    onChanged: () => { recordRoznamchaExpenseSync(); recordSaadPaymentSync(); renderDashboard(); },
    onToast: (msg, opts) => toast(msg, opts)
  });
  inventoryBookModalController = setupInventoryBookModal(() => state, {
    onInventoryChanged: () => {
      // SISP-42: fresh stock may unblock a pending ticket deduction.
      recordTicketStockBridge();
      renderDashboard();
    },
    onToast: (msg, opts) => toast(msg, opts)
  });
  outageImpactModalController = setupOutageImpactModal(() => state, {
    onToast: (msg, opts) => toast(msg, opts)
  });
  saadVisitsModalController = setupSaadVisitsModal(() => state, {
    onVisitsChanged: () => { recordSaadPaymentSync(); renderDashboard(); },
    onToast: (msg, opts) => toast(msg, opts),
    listTicketIds: () => loadTickets().map((t) => t.id),
    onConfirm: (opts) => appConfirm(opts)
  });
  installTrackerModalController = setupInstallTrackerModal(() => state, {
    onRequestsChanged: () => renderDashboard(),
    onToast: (msg, opts) => toast(msg, opts),
    onConfirm: (opts) => appConfirm(opts),
    // SISP-57: completion pipeline — live stock context for the plan,
    // and the executor that creates/links the customer + deducts stock.
    getInstallStockContext: () => ({ movements: loadInventory(), inventoryItemIds: INVENTORY_ITEM_IDS }),
    onCompleteInstall: (plan) => completeInstallRequest(plan)
  });
  pendingWorksModalController = setupPendingWorksModal(() => state, {
    onWorksChanged: () => renderDashboard(),
    onToast: (msg, opts) => toast(msg, opts),
    onConfirm: (opts) => appConfirm(opts)
  });
  // SISP-28: house shift / relocation modal (state op in core.js).
  relocationModalController = setupRelocationModal({
    onSubmit: (customerId, input) => {
      const fresh = state.customers.find(c => c.id === customerId);
      if (!fresh) throw new Error('That customer was not found.');
      state = recordCustomerRelocation(state, customerId, input);
      try { persistState(state, localStorage); } catch {}
      renderDetail();
      renderDashboard();
    },
    onToast: (msg, opts) => toast(msg, opts)
  });
  // SISP-32: pole & landmark directory + zone lineman cheat-sheet.
  poleLandmarkModalController = setupPoleLandmarkModal(() => state, {
    onToast: (msg, opts) => toast(msg, opts)
  });
  // SISP-88: the group Waada chip reuses the SISP-3 Waada chip dialog,
  // created lazily so it exists only when a partial collection leaves a
  // member owing.
  let groupWaadaDialog = null;
  // SISP-35: group billing modal — collect reuses quick collection per
  // member, then persists exactly like a single quick collection.
  groupBillingModalController = setupGroupBillingModal(() => state, {
    onGroupsChanged: () => renderDashboard(),
    onToast: (msg, opts) => toast(msg, opts),
    onConfirm: (opts) => appConfirm(opts),
    getAllocations: (liveState) => calculatePaymentAllocations(liveState),
    currentMonth: () => monthsForHistory(new Date())[0],
    onCollectGroup: (group, { date, method }) => {
      const month = monthsForHistory(new Date())[0];
      const result = collectGroupFull(state, group, {
        date, method, month,
        allocations: calculatePaymentAllocations(state),
        execute: executeQuickCollection
      });
      if (result.collected) {
        state = result.nextState;
        save();
        renderDetail();
        renderTransactions();
        renderMonthlyReport();
      }
      return { ...result, receipt: buildGroupReceipt({ ...result, date, method }) };
    },
    // SISP-88: partial group collection — the waterfall settles members
    // in stored group order through the same quick-collection path, then
    // persists exactly like a full group collection.
    onCollectGroupPartial: (group, { date, method, amountReceived }) => {
      const month = monthsForHistory(new Date())[0];
      const result = collectGroupPartial(state, group, {
        date, method, amountReceived, month,
        allocations: calculatePaymentAllocations(state),
        execute: executeQuickCollection
      });
      if (result.collected) {
        state = result.nextState;
        save();
        renderDetail();
        renderTransactions();
        renderMonthlyReport();
      }
      return { ...result, receipt: buildGroupReceipt({ ...result, date, method }) };
    },
    // SISP-88: a Waada chip for a still-owing member opens the SISP-3
    // Waada chip dialog; applying a chip persists like every other
    // waada write (replace the customer record, save, re-render).
    onGroupWaada: (customerId) => {
      if (!groupWaadaDialog) {
        groupWaadaDialog = setupWaadaChipDialog({
          getCustomer: (id) => (state.customers || []).find((c) => c.id === id) || null,
          onApply: (updated) => {
            const idx = state.customers.findIndex((c) => c.id === updated.id);
            if (idx >= 0) state.customers[idx] = updated;
            save();
            renderDetail();
          },
          onToast: (msg, opts) => toast(msg, opts)
        });
      }
      if (groupWaadaDialog) groupWaadaDialog.open(customerId);
      else toast('Waada dialog is not available.');
    }
  });
  // SISP-39: lineman monthly scorecard — read-only aggregation over
  // tickets, the complaint register, roznamcha and the payment ledger.
  linemanScorecardModalController = setupLinemanScorecardModal(() => state);
  // SISP-48: QR Khata camera scanner — a scanned/pasted payload is routed
  // exactly like the SISP-14 load-time deep link (select the customer,
  // then Quick Collect for action=pay). Invalid or unknown codes never
  // reach this callback: the scanner shows a safe toast instead.
  qrScannerModalController = setupQrScannerModal(() => state, {
    onToast: (msg, opts) => toast(msg, opts),
    onOpenCustomer: (customer, action) => {
      selectCustomer(customer.id, { pushHistory: false });
      if (action === 'pay' && window.quickCollectModalController?.selectAndOpen) {
        window.quickCollectModalController.selectAndOpen(customer.id);
      }
    }
  });
  $('#qrScanTopbarBtn')?.addEventListener('click', () => qrScannerModalController?.open());
  $('#fieldModeScanQrBtn')?.addEventListener('click', () => qrScannerModalController?.open());
  // SISP-83: receipt verification lookup — the operator types the VER
  // code (or receipt number) printed on a paper receipt; the pure
  // lookup in receipt-verifier.js recomputes codes from the saved
  // ledger. generateReceiptNumber is injected as the ref deriver so
  // payments without a stored receiptNumber resolve exactly like
  // buildPaymentReceipt resolves them (no module cycle).
  receiptVerifyModalController = setupReceiptVerifyModal(() => state, {
    onToast: (msg, opts) => toast(msg, opts),
    deriveReceiptNumber: generateReceiptNumber
  });
  $('#openReceiptVerifyModalBtn')?.addEventListener('click', () => receiptVerifyModalController?.open());
  // SISP-37: suspense (unidentified) wallet payment register — claim
  // reuses quick collection, then persists exactly like a single quick
  // collection; the register entry is marked claimed, never deleted.
  suspensePaymentsModalController = setupSuspensePaymentsModal(() => state, {
    onEntriesChanged: () => renderDashboard(),
    onToast: (msg, opts) => toast(msg, opts),
    onConfirm: (opts) => appConfirm(opts),
    currentMonth: () => monthsForHistory(new Date())[0],
    onClaim: (entry, { customerId, month }) => {
      const result = claimSuspensePayment(state, loadSuspensePayments(), entry.suspenseId, {
        customerId,
        month,
        date: entry.date,
        execute: executeQuickCollection
      });
      state = result.nextState;
      saveSuspensePayments(result.entries);
      save();
      renderDetail();
      renderTransactions();
      renderMonthlyReport();
      renderDashboard();
      const customer = state.customers.find(c => String(c.id) === String(customerId));
      return {
        ...result,
        receipt: buildSuspenseReceipt({
          entry: result.entry,
          customerName: customer?.name ?? result.entry.claimedCustomerName,
          customerNumber: customer?.customerNumber ?? '',
          month,
          receiptNumber: result.paymentReceipt?.receiptNumber ?? ''
        })
      };
    }
  });
  // SISP-82: field tool custody register — records live in their own
  // localStorage key (sisp_field_tools_v1); every change re-renders the
  // dashboard card.
  toolCustodyModalController = setupToolCustodyModal({
    onEntriesChanged: () => renderDashboard(),
    onToast: (msg, opts) => toast(msg, opts),
    onConfirm: (opts) => appConfirm(opts)
  });
  // SISP-62: power backup monitor (head-end / feeder UPS registry +
  // WAPDA outage timer). The depletion logger writes through the existing
  // SISP-15 complaint register API — an AREA_OUTAGE entry whose
  // reportedAt is the moment the battery actually ran out, even when
  // the app was closed at that moment and only notices on this tick.
  const logPowerDepletionComplaint = (node, depletedAtMs) => {
    const complaints = loadComplaints();
    const zone = node.fedZones.length ? node.fedZones.join(', ') : node.name;
    const complaint = createComplaint({
      customerId: AREA_OUTAGE_CUSTOMER_ID,
      areaOutage: true,
      zone,
      issueCategory: 'WAPDA / Power Outage',
      reportedAt: pakistanDateTimeNow(new Date(depletedAtMs)),
      resolutionNote: `Auto-logged by the Power Backup monitor: the UPS battery for ${node.name} ran out during a WAPDA outage (rated backup ${node.ratedBatteryHours}h, WAPDA still off).`
    }, complaints);
    saveComplaints([...complaints, complaint]);
    return complaint.id;
  };
  const runPowerBackupDepletionCheck = () => {
    try {
      const nodes = loadUpsNodes();
      if (!nodes.some((node) => node.outage)) return;
      const result = checkUpsNodeDepletions(nodes, new Date(), logPowerDepletionComplaint);
      if (result.logged.length) {
        saveUpsNodes(result.nodes);
        result.logged.forEach((entry) => toast(t('pwr_toast_depleted', null, { name: entry.name }), { type: 'error' }));
      }
      renderPowerBackupDashboard(new Date());
      if (powerBackupModalController) powerBackupModalController.refresh();
    } catch {}
  };
  powerBackupModalController = setupPowerBackupModal(() => state, {
    onNodesChanged: () => renderDashboard(),
    onToast: (msg, opts) => toast(msg, opts),
    onConfirm: (opts) => appConfirm(opts),
    getZones: () => [...DEFAULT_MOHALLAS, ...collectComplaintZones(state)],
    logAreaOutage: logPowerDepletionComplaint
  });
  runPowerBackupDepletionCheck();
  setInterval(runPowerBackupDepletionCheck, 30000);
  // SISP-19: pending hardware recovery modal (derived list, no new store).
  const hardwareRecoveryModal = $('#hardwareRecoveryModal');
  const hardwareRecoveryList = $('#hardwareRecoveryList');
  const renderHardwareRecoveryList = () => {
    if (!hardwareRecoveryList) return;
    const pending = pendingHardwareRecovery(state.customers);
    if (pending.length === 0) {
      hardwareRecoveryList.innerHTML = '<p class="hardware-recovery-empty">Nothing pending — no disconnected customer holds unrecovered ISP-owned hardware.</p>';
      return;
    }
    hardwareRecoveryList.innerHTML = pending.map(({ customer, items }) => `<article class="hardware-recovery-entry"><div class="hardware-recovery-head"><strong>${escapeHtml(customer.name)} (#${escapeHtml(String(customer.customerNumber))})</strong><span>${escapeHtml(customer.mohalla || 'Area not set')}</span></div><ul>${items.map(item => `<li>${escapeHtml(item.label)} — ${escapeHtml(item.ownershipLabel)} <button type="button" class="secondary-button" data-hardware-recover="${escapeHtml(customer.id)}:${escapeHtml(item.key)}">Mark recovered</button></li>`).join('')}</ul><div class="hardware-recovery-actions"><button type="button" class="secondary-button" data-hardware-recover-all="${escapeHtml(customer.id)}">Mark all recovered</button><button type="button" class="secondary-button" data-hardware-open-customer="${escapeHtml(customer.id)}">Open customer</button></div></article>`).join('');
  };
  const openHardwareRecoveryModal = () => {
    renderHardwareRecoveryList();
    if (hardwareRecoveryModal && typeof hardwareRecoveryModal.showModal === 'function') hardwareRecoveryModal.showModal();
  };
  $('#hardwareRecoveryCloseBtn')?.addEventListener('click', () => hardwareRecoveryModal?.close());
  $('#openHardwareRecoveryModalBtn')?.addEventListener('click', openHardwareRecoveryModal);
  hardwareRecoveryList?.addEventListener('click', (event) => {
    const recoverBtn = event.target.closest('[data-hardware-recover]');
    const recoverAllBtn = event.target.closest('[data-hardware-recover-all]');
    const openBtn = event.target.closest('[data-hardware-open-customer]');
    const applyRecovery = (beforeCustomer, updated, message) => {
      const idx = state.customers.findIndex(c => c.id === updated.id);
      if (idx >= 0) state.customers[idx] = updated;
      try { persistState(state, localStorage); } catch {}
      recordRecoveryStock(beforeCustomer, updated);
      renderHardwareRecoveryList();
      renderDashboard();
      renderDetail();
      toast(message);
    };
    if (recoverBtn) {
      const [customerId, itemKey] = String(recoverBtn.getAttribute('data-hardware-recover')).split(':');
      const customer = state.customers.find(c => c.id === customerId);
      if (!customer) return;
      try { applyRecovery(customer, markHardwareRecovered(customer, itemKey, getTodayDateString()), 'Hardware marked recovered.'); }
      catch (err) { toast(err?.message || 'Could not mark hardware recovered.'); }
    } else if (recoverAllBtn) {
      const customer = state.customers.find(c => c.id === recoverAllBtn.getAttribute('data-hardware-recover-all'));
      if (!customer) return;
      try { applyRecovery(customer, markAllHardwareRecovered(customer, getTodayDateString()), 'All hardware marked recovered.'); }
      catch (err) { toast(err?.message || 'Could not mark hardware recovered.'); }
    } else if (openBtn) {
      hardwareRecoveryModal?.close();
      switchView('customers');
      selectCustomer(openBtn.getAttribute('data-hardware-open-customer'));
    }
  });

  ownerKhataModalController = setupOwnerKhataModal(() => state, {
    onToast: (msg, opts) => toast(msg, opts)
  });
  // SISP-21: Digital Wallet Ledger modal (breakdown + verification toggles + duplicates).
  walletLedgerModalController = (() => {
    const dialog = document.getElementById('walletLedgerModal');
    if (!dialog) return null;
    const $ = (id) => dialog.querySelector(`#${id}`);
    let month = pakistanMonthNow();
    let methodFilter = 'All';
    let verificationFilter = 'All';

    function render() {
      const report = buildWalletReconciliation(state.customers, month, loadShopSettlements());
      const summaryEl = $('walletLedgerSummaryLine');
      if (summaryEl) {
        summaryEl.textContent = report.digitalCount === 0
          ? `No digital wallet payments in ${month}.`
          : `${report.digitalCount} digital payments · ${formatAmount(report.digitalTotal)} · ${report.pendingVerification.length} pending verification${report.duplicateGroups.length ? ` · ${report.duplicateGroups.length} duplicate TID group${report.duplicateGroups.length === 1 ? '' : 's'}` : ''}`;
      }
      const breakdownEl = $('walletLedgerBreakdown');
      if (breakdownEl) {
        const rows = DIGITAL_BREAKDOWN_METHODS.map((label) => {
          const line = report.byWallet[label] || { amount: 0, count: 0, verifiedCount: 0, pendingCount: 0 };
          return `<article class="wallet-ledger-line"><p><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatAmount(line.amount))}</strong></p><p><span>Payments</span><strong>${line.count} · ${line.verifiedCount} verified · ${line.pendingCount} pending</strong></p></article>`;
        }).join('');
        breakdownEl.innerHTML = rows + `<article class="wallet-ledger-line"><p><span>Cash</span><strong>${escapeHtml(formatAmount(report.cash.amount))}</strong></p><p><span>Payments</span><strong>${report.cash.count}</strong></p></article><article class="wallet-ledger-line"><p><span>Shop handovers</span><strong>${escapeHtml(formatAmount(report.shopHandovers.amount))}</strong></p><p><span>Settlements</span><strong>${report.shopHandovers.count}</strong></p></article>`;
      }
      const dupEl = $('walletLedgerDuplicates');
      if (dupEl) {
        dupEl.innerHTML = report.duplicateGroups.length === 0
          ? '<p class="wallet-ledger-empty">No duplicate TIDs in this month.</p>'
          : report.duplicateGroups.map((group) => `<article class="wallet-ledger-dup"><p><strong>⚠️ Duplicate TID ${escapeHtml(group.displayTid)}</strong></p><ul>${group.payments.map((p) => `<li>#${escapeHtml(String(p.customerNumber))} ${escapeHtml(p.customerName)} · ${escapeHtml(p.date)} · ${escapeHtml(formatAmount(p.amount))} · ${escapeHtml(p.method)}</li>`).join('')}</ul><p class="wallet-ledger-note">The same TID is logged more than once. Correct or delete the extra payment from the customer profile — do not log it again.</p></article>`).join('');
      }
      const listEl = $('walletLedgerPaymentList');
      if (listEl) {
        const rows = report.payments.filter((p) => (methodFilter === 'All' || p.method === methodFilter) && (verificationFilter === 'All' || (verificationFilter === 'Verified' ? p.walletVerified : !p.walletVerified)));
        listEl.innerHTML = rows.length === 0
          ? '<p class="wallet-ledger-empty">No digital payments match these filters.</p>'
          : rows.map((p) => `<article class="wallet-ledger-payment"><p><span>#${escapeHtml(String(p.customerNumber))} ${escapeHtml(p.customerName)}</span><strong>${escapeHtml(formatAmount(p.amount))}</strong></p><p><span>${escapeHtml(p.date)} · ${escapeHtml(p.method)}${p.transactionId ? ` · TID ${escapeHtml(p.transactionId)}` : ''}${p.senderLabel ? ` · ${escapeHtml(t('spay_sender_row', null, { label: p.senderLabel }))}` : ''}</span><span class="wallet-ledger-badge ${p.walletVerified ? 'verified' : 'pending'}">${escapeHtml(walletVerificationLabel(p))}</span></p><button type="button" class="secondary-button" data-wallet-toggle="${escapeHtml(p.customerId)}|${escapeHtml(p.billMonth)}|${escapeHtml(p.paymentId)}|${p.walletVerified ? 'pending' : 'verified'}">${p.walletVerified ? 'Mark pending' : 'Mark verified ✓'}</button></article>`).join('');
      }
    }

    const monthInput = $('walletLedgerMonth');
    if (monthInput) {
      monthInput.value = month;
      monthInput.addEventListener('change', () => { month = monthInput.value || pakistanMonthNow(); render(); });
    }
    const methodSelect = $('walletLedgerMethodFilter');
    if (methodSelect) methodSelect.addEventListener('change', () => { methodFilter = methodSelect.value; render(); });
    const verificationSelect = $('walletLedgerVerificationFilter');
    if (verificationSelect) verificationSelect.addEventListener('change', () => { verificationFilter = verificationSelect.value; render(); });
    const closeBtn = $('walletLedgerCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
    const openBtn = document.getElementById('openWalletLedgerModalBtn');
    if (openBtn) openBtn.addEventListener('click', () => {
      month = pakistanMonthNow();
      if (monthInput) monthInput.value = month;
      render();
      dialog.showModal();
    });
    const copyBtn = $('walletLedgerCopyBtn');
    if (copyBtn) copyBtn.addEventListener('click', async () => {
      const report = buildWalletReconciliation(state.customers, month, loadShopSettlements());
      const text = walletReconciliationSummaryText(report);
      try { await navigator.clipboard.writeText(text); toast('Wallet summary copied.'); }
      catch { toast('Could not copy — select the summary text manually.'); }
    });
    const listEl = $('walletLedgerPaymentList');
    if (listEl) listEl.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-wallet-toggle]');
      if (!btn) return;
      const [customerId, billMonth, paymentId, target] = btn.dataset.walletToggle.split('|');
      try {
        state = setPaymentWalletVerified(state, customerId, billMonth, paymentId, target === 'verified');
        save();
        renderDashboard();
        render();
        if (selectedCustomerId === customerId) renderDetail();
        toast(target === 'verified' ? 'Marked verified in statement.' : 'Marked pending verification.');
      } catch (error) { toast(error.message); }
    });

    return { open(prefilter = {}) {
      if (/^\d{4}-\d{2}$/.test(String(prefilter.month || ''))) month = String(prefilter.month);
      if (monthInput) monthInput.value = month;
      render();
      dialog.showModal();
    }, refresh: render };
  })();
  worklistsModalController = setupWorklistsModal(() => state, {    onUpdateState: (newState) => {
      state = newState;
      save();
      renderDetail();
      renderCustomers();
      renderDashboard();
    },
    onFilterCustomer: (customerId) => {
      selectCustomer(customerId);
      switchView('customers');
    },
    onToast: (msg, opts) => toast(msg, opts)
  });
  staffPerformanceModalController = setupStaffPerformanceModal(() => state, {
    onToast: (msg, opts) => toast(msg, opts)
  });
  
  
  dataIntegrityModalController = setupDataIntegrityModal({
    getState: () => state,
    updateState: (newState) => {
      state = newState;
      save();
      renderDetail();
      renderCustomers();
      renderDashboard();
    },
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  });

  customerAdjustmentModalController = setupAdjustmentVoucherModal({
    modalId: 'customerAdjustmentModal',
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts),
    onVoucherIssued: () => {
      if (selectedCustomerId) {
        renderCustomerDetail();
        renderCustomers();
      }
    }
  });

  const openAdjustmentBtn = $('#openAdjustmentModalBtn');
  if (openAdjustmentBtn) {
    openAdjustmentBtn.addEventListener('click', () => {
      if (!selectedCustomerId) {
        toast('Please select a customer first.');
        return;
      }
      const cust = state.customers.find(c => c.id === selectedCustomerId);
      if (!cust) return;
      customerAdjustmentModalController?.open(cust);
    });
  }

  customerServiceContractModalController = setupServiceContractModal({
    getState: () => state,
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts),
    onContractCreated: () => {
      if (selectedCustomerId) {
        renderCustomerDetail();
        renderCustomers();
      }
    }
  });

  const openContractBtn = $('#openServiceContractBtn');
  if (openContractBtn) {
    openContractBtn.addEventListener('click', () => {
      if (!selectedCustomerId) {
        toast('Please select a customer first.');
        return;
      }
      const cust = state.customers.find(c => c.id === selectedCustomerId);
      if (!cust) return;
      customerServiceContractModalController?.open(cust);
    });
  }

  customerDisputeModalController = setupDisputeClaimModal({
    getState: () => state,
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts),
    onApplyLedgerCredit: (claim) => {
      if (selectedCustomerId) {
        renderCustomerDetail();
        renderCustomers();
      }
    }
  });

  // #301: form-validation.js (agent3 lane) calls a bare triggerHaptic() in the Dispute dialog without importing it,
  // which threw a ReferenceError before showModal(). Expose app.js's imported helper as a global so the bare
  // reference resolves; the proper import is tracked for the agent3 lane.
  if (typeof globalThis.triggerHaptic !== 'function') globalThis.triggerHaptic = triggerHaptic;
  const openDisputeBtn = $('#openDisputeClaimBtn');
  if (openDisputeBtn) {
    openDisputeBtn.addEventListener('click', () => {
      if (!selectedCustomerId) {
        toast('Please select a customer first.');
        return;
      }
      const cust = state.customers.find(c => c.id === selectedCustomerId);
      if (!cust) return;
      try { customerDisputeModalController?.open(cust); }
      catch (error) { console.warn('Dispute dialog failed to open', error); toast('The Dispute form could not open. Please reload and try again.', { type: 'error' }); }
    });
  }

  customerKycComplianceModalController = setupKycComplianceModal({
    getState: () => state,
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts),
    onNavigateCustomer: (cid) => {
      switchView('customers');
      selectCustomer(cid);
    }
  });

  const openKycAuditBtn = $('#openKycAuditBtn');
  if (openKycAuditBtn) {
    openKycAuditBtn.addEventListener('click', () => {
      customerKycComplianceModalController?.open();
    });
  }

  customerEquipmentRetrievalModalController = setupEquipmentRetrievalModal({
    getState: () => state,
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts),
    onNavigateCustomer: (cid) => {
      switchView('customers');
      selectCustomer(cid);
    },
    onEquipmentRetrieved: () => {
      if (selectedCustomerId) {
        renderCustomerDetail();
        renderCustomers();
      }
    }
  });

  const openEquipmentRetrievalBtn = $('#openEquipmentRetrievalBtn');
  if (openEquipmentRetrievalBtn) {
    openEquipmentRetrievalBtn.addEventListener('click', () => {
      const cust = selectedCustomerId ? state.customers.find(c => c.id === selectedCustomerId) : null;
      customerEquipmentRetrievalModalController?.open(cust);
    });
  }

  customerSpliceInspectionModalController = setupSpliceInspectionModal({
    getState: () => state,
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  });

  const openSpliceInspectionBtn = $('#openSpliceInspectionBtn');
  if (openSpliceInspectionBtn) {
    openSpliceInspectionBtn.addEventListener('click', () => {
      customerSpliceInspectionModalController?.open();
    });
  }

  customerPlanMigrationModalController = setupPlanMigrationModal({
    getState: () => state,
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts),
    onMigrationSaved: (record) => {
      if (selectedCustomerId && state?.customers) {
        const cust = state.customers.find(c => c.id === selectedCustomerId);
        if (cust && record && record.customerId === cust.id) {
          cust.package = record.targetPlan;
          cust.plan = record.targetPlan;
          cust.monthlyFee = record.targetRate;
          const store = typeof localStorage !== 'undefined' ? localStorage : null;
          let voucherNum = record.id;
          if (record.netAdjustment !== 0) {
            try {
              const adjVoucher = buildAdjustmentVoucherData({
                customer: cust,
                category: 'prorated_package_change',
                amount: Math.abs(record.netAdjustment),
                reason: `Mid-cycle plan migration: ${record.currentPlan} → ${record.targetPlan}. Pro-rated current-bill: PKR ${(record.proration?.proRatedCurrentBill || record.proRatedBillAmount || 0).toLocaleString()} (Net adj: ${record.netAdjustment >= 0 ? '+' : '-'}PKR ${Math.abs(record.netAdjustment).toLocaleString()}).`,
                authorizedBy: record.authorizedBy || 'NOC Operator',
                date: record.effectiveDate
              });
              saveAdjustmentVoucher(store, adjVoucher);
              voucherNum = adjVoucher.voucherNumber || adjVoucher.id;
            } catch (e) {
              console.error('Failed to save adjustment voucher:', e);
            }
          }

          state = updateCustomerProfile(state, cust.id, {
            packageSpeed: record.targetPlan,
            monthlySellingAmount: record.targetRate,
            packageChangeStaffName: record.authorizedBy || 'NOC Operator',
            proRataAdjustment: record.netAdjustment,
            proRatedBillAmount: record.proration?.proRatedCurrentBill || record.proRatedBillAmount,
            voucherId: voucherNum
          }, new Date(record.effectiveDate));

          save();
          renderDetail();
        }
      }
    }
  });

  const openPlanMigrationBtn = $('#openPlanMigrationBtn');
  if (openPlanMigrationBtn) {
    openPlanMigrationBtn.addEventListener('click', () => {
      const cust = selectedCustomerId ? state.customers.find(c => c.id === selectedCustomerId) : null;
      customerPlanMigrationModalController?.open(cust);
    });
  }

  customerOpticalAcceptanceModalController = setupOpticalAcceptanceModal({
    getState: () => state,
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  });

  const openOpticalAcceptanceBtn = $('#openOpticalAcceptanceBtn');
  if (openOpticalAcceptanceBtn) {
    openOpticalAcceptanceBtn.addEventListener('click', () => {
      const cust = selectedCustomerId ? state.customers.find(c => c.id === selectedCustomerId) : null;
      customerOpticalAcceptanceModalController?.open(cust);
    });
  }

  customerDropSafetyModalController = setupDropSafetyInspectionModal({
    getState: () => state,
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  });

  const openDropInspectionBtn = $('#openDropInspectionBtn');
  if (openDropInspectionBtn) {
    openDropInspectionBtn.addEventListener('click', () => {
      const cust = selectedCustomerId ? state.customers.find(c => c.id === selectedCustomerId) : null;
      customerDropSafetyModalController?.open(cust);
    });
  }

  customerEthernetCertModalController = setupEthernetCertModal({
    getState: () => state,
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  });

  const openEthernetCertBtn = $('#openEthernetCertBtn');
  if (openEthernetCertBtn) {
    openEthernetCertBtn.addEventListener('click', () => {
      const cust = selectedCustomerId ? state.customers.find(c => c.id === selectedCustomerId) : null;
      customerEthernetCertModalController?.open(cust);
    });
  }

  

  const openOrlCertBtn = $('#openOrlCertBtn');
  if (openOrlCertBtn) {
    openOrlCertBtn.addEventListener('click', () => {
      const cust = selectedCustomerId ? state.customers.find(c => c.id === selectedCustomerId) : null;
      customerOrlCertModalController?.open(cust);
    });
  }

  

  const openDdmiCertBtn = $('#openDdmiCertBtn');
  if (openDdmiCertBtn) {
    openDdmiCertBtn.addEventListener('click', () => {
      const cust = selectedCustomerId ? state.customers.find(c => c.id === selectedCustomerId) : null;
      if (cust && customerDdmiCertModalController) {
        customerDdmiCertModalController.setReading({
          customerName: cust.name || 'Muhammad Aslam',
          customerId: cust.id || 'CUST-001',
          area: cust.area || 'Shahdara Town'
        });
      }
      customerDdmiCertModalController?.open();
    });
  }

  

  const openDispersionCertBtn = $('#openDispersionCertBtn');
  if (openDispersionCertBtn) {
    openDispersionCertBtn.addEventListener('click', () => {
      const cust = selectedCustomerId ? state.customers.find(c => c.id === selectedCustomerId) : null;
      if (cust && customerDispersionModalController) {
        customerDispersionModalController.setReading({
          feederRouteName: `Shahdara Trunk Span (${cust.area || 'Shahdara Town'})`,
          destinationNode: `${cust.name || 'Subscriber Node'} Drop Demarcation`
        });
      }
      customerDispersionModalController?.open();
    });
  }

  

  const openBendLossCertBtn = $('#openBendLossCertBtn');
  if (openBendLossCertBtn) {
    openBendLossCertBtn.addEventListener('click', () => {
      const cust = selectedCustomerId ? state.customers.find(c => c.id === selectedCustomerId) : null;
      if (cust && customerBendLossModalController) {
        customerBendLossModalController.setReading({
          fiberType: 'G657A2',
          radiusMm: 15.0,
          turnsCount: 2
        });
      }
      customerBendLossModalController?.open(cust);
    });
  }

  

  const openBidirectionalOtdrBtn = $('#openBidirectionalOtdrBtn');
  if (openBidirectionalOtdrBtn) {
    openBidirectionalOtdrBtn.addEventListener('click', () => {
      const cust = selectedCustomerId ? state.customers.find(c => c.id === selectedCustomerId) : null;
      if (cust && customerBidirectionalOtdrModalController) {
        customerBidirectionalOtdrModalController.setReading({
          routeName: `Shahdara Trunk Span (${cust.area || 'Baradari Trunk'})`,
          terminusNode: `${cust.name || 'Demarcation'} FAT Port`
        });
      }
      customerBidirectionalOtdrModalController?.open(cust);
    });
  }

  

  const openOtdrDeadzoneBtn = $('#openOtdrDeadzoneBtn');
  if (openOtdrDeadzoneBtn) {
    openOtdrDeadzoneBtn.addEventListener('click', () => {
      const modal = $('#otdrDeadzoneModal');
      if (modal) {
        if (typeof modal.showModal === 'function') {
          modal.showModal();
        } else {
          modal.setAttribute('open', '');
        }
        customerOtdrDeadzoneModalController?.recalculate();
        customerOtdrDeadzoneModalController?.renderHistory();
      }
    });
  }

  

  const openSplitterQaBtn = $('#openSplitterQaBtn');
  if (openSplitterQaBtn) {
    openSplitterQaBtn.addEventListener('click', () => {
      const modal = $('#splitterQaModal');
      if (modal) {
        if (typeof modal.showModal === 'function') {
          modal.showModal();
        } else {
          modal.setAttribute('open', '');
        }
        customerSplitterQaModalController?.recalculate();
      }
    });
  }

  

  const openFerruleGeometryBtn = $('#openFerruleGeometryBtn');
  if (openFerruleGeometryBtn) {
    openFerruleGeometryBtn.addEventListener('click', () => {
      const modal = $('#ferruleGeometryModal');
      if (modal) {
        if (typeof modal.showModal === 'function') {
          modal.showModal();
        } else {
          modal.setAttribute('open', '');
        }
        customerFerruleGeometryModalController?.recalculate();
      }
    });
  }

  

  const openFusionArcQaBtn = $('#openFusionArcQaBtn');
  if (openFusionArcQaBtn) {
    openFusionArcQaBtn.addEventListener('click', () => {
      const modal = $('#fusionArcQaModal');
      if (modal) {
        if (typeof modal.showModal === 'function') {
          modal.showModal();
        } else {
          modal.setAttribute('open', '');
        }
        if (state.selectedCustomerId) {
          const c = state.customers.find(cust => cust.id === state.selectedCustomerId);
          if (c) customerFusionArcQaModalController?.populateCustomer(c);
        }
        customerFusionArcQaModalController?.recalculate();
      }
    });
  }

  

  const openStripForceQaBtn = $('#openStripForceQaBtn');
  if (openStripForceQaBtn) {
    openStripForceQaBtn.addEventListener('click', () => {
      const modal = $('#stripForceQaModal');
      if (modal) {
        if (typeof modal.showModal === 'function') {
          modal.showModal();
        } else {
          modal.setAttribute('open', '');
        }
        if (state.selectedCustomerId) {
          const c = state.customers.find(cust => cust.id === state.selectedCustomerId);
          if (c) customerStripForceQaModalController?.populateCustomer(c);
        }
        customerStripForceQaModalController?.recalculate();
      }
    });
  }

  const spliceModal = $('#spliceMfdOffsetModal');
  const openSpliceMfdOffsetBtn = $('#openSpliceMfdOffsetBtn');

  if (openSpliceMfdOffsetBtn) {
    openSpliceMfdOffsetBtn.addEventListener('click', () => {
      if (spliceModal) {
        if (state.selectedCustomerId) {
          const c = state.customers.find(cust => cust.id === state.selectedCustomerId);
          if (c) customerSpliceMfdOffsetModalController?.populateCustomer(c);
        }
        customerSpliceMfdOffsetModalController?.recalculate();
      }
    });
  }

  const sleeveModal = $('#spliceSleeveCureModal');
  const openSpliceSleeveCureBtn = $('#openSpliceSleeveCureBtn');

  if (openSpliceSleeveCureBtn) {
    openSpliceSleeveCureBtn.addEventListener('click', () => {
      if (sleeveModal) {
        if (state.selectedCustomerId) {
          const c = state.customers.find(cust => cust.id === state.selectedCustomerId);
          if (c) customerSpliceSleeveCureModalController?.populateCustomer(c);
        }
        customerSpliceSleeveCureModalController?.recalculate();
      }
    });
  }

  const cleaveModal = $('#fiberCleaveQualityModal');
  const openFiberCleaveQualityBtn = $('#openFiberCleaveQualityBtn');

  if (openFiberCleaveQualityBtn) {
    openFiberCleaveQualityBtn.addEventListener('click', () => {
      if (cleaveModal) {
        if (state.selectedCustomerId) {
          const c = state.customers.find(cust => cust.id === state.selectedCustomerId);
          if (c) customerFiberCleaveQualityModalController?.populateCustomer(c);
        }
        customerFiberCleaveQualityModalController?.recalculate();
      }
    });
  }

  const ghostModal = $('#otdrGhostArtifactModal');
  const openOtdrGhostArtifactBtn = $('#openOtdrGhostArtifactBtn');

  if (openOtdrGhostArtifactBtn) {
    openOtdrGhostArtifactBtn.addEventListener('click', () => {
      if (ghostModal) {
        if (state.selectedCustomerId) {
          const c = state.customers.find(cust => cust.id === state.selectedCustomerId);
          if (c) customerOtdrGhostArtifactModalController?.populateCustomer(c);
        }
        customerOtdrGhostArtifactModalController?.recalculate();
      }
    });
  }

  const ribbonModal = $('#ribbonSpliceQaModal');
  const openRibbonSpliceQaBtn = $('#openRibbonSpliceQaBtn');

  if (openRibbonSpliceQaBtn) {
    openRibbonSpliceQaBtn.addEventListener('click', () => {
      if (ribbonModal) {
        if (state.selectedCustomerId) {
          const c = state.customers.find(cust => cust.id === state.selectedCustomerId);
          if (c) {
            const routeInput = $('#ribbonSpliceRouteInput');
            if (routeInput) routeInput.value = `${c.name || 'Subscriber'} Premises Drop Ribbon - ${c.area || 'Shahdara'}`;
          }
        }
        ribbonModal.showModal();
      }
    });
  }

  const fastModal = $('#fastConnectorQaModal');
  const openFastConnectorQaBtn = $('#openFastConnectorQaBtn');

  if (openFastConnectorQaBtn) {
    openFastConnectorQaBtn.addEventListener('click', () => {
      if (fastModal) {
        if (state.selectedCustomerId) {
          const c = state.customers.find(cust => cust.id === state.selectedCustomerId);
          if (c) {
            const custInput = $('#fastConnectorCustInput');
            if (custInput) custInput.value = c.name || 'Subscriber';
            const routeInput = $('#fastConnectorRouteInput');
            if (routeInput) routeInput.value = `${c.area || 'Shahdara'} Drop FAT to ONT Demarcation`;
          }
        }
        fastModal.showModal();
      }
    });
  }

  const adssModal = $('#adssSagTensionModal');
  const openAdssSagTensionBtn = $('#openAdssSagTensionBtn');

  if (openAdssSagTensionBtn) {
    openAdssSagTensionBtn.addEventListener('click', () => {
      if (adssModal) {
        if (state.selectedCustomerId) {
          const c = state.customers.find(cust => cust.id === state.selectedCustomerId);
          if (c) {
            const custInput = $('#adssCustInput');
            if (custInput) custInput.value = c.name || 'Subscriber';
            const routeInput = $('#adssRouteInput');
            if (routeInput) routeInput.value = `${c.area || 'Shahdara'} Aerial Drop Span to Demarcation`;
          }
        }
        adssModal.showModal();
      }
    });
  }

  const armoredModal = $('#armoredCableCrushModal');
  const openArmoredCableCrushBtn = $('#openArmoredCableCrushBtn');

  if (openArmoredCableCrushBtn) {
    openArmoredCableCrushBtn.addEventListener('click', () => {
      if (armoredModal) {
        if (state.selectedCustomerId) {
          const c = state.customers.find(cust => cust.id === state.selectedCustomerId);
          if (c) {
            const custInput = $('#armoredCustInput');
            if (custInput) custInput.value = c.name || 'Subscriber';
            const routeInput = $('#armoredRouteInput');
            if (routeInput) routeInput.value = `${c.area || 'Shahdara'} Trench Route to Demarcation`;
          }
        }
        armoredModal.showModal();
      }
    });
  }

  const jettingModal = $('#cableJettingModal');
  const openCableJettingBtn = $('#openCableJettingBtn');

  if (openCableJettingBtn) {
    openCableJettingBtn.addEventListener('click', () => {
      if (jettingModal) {
        if (state.selectedCustomerId) {
          const c = state.customers.find(cust => cust.id === state.selectedCustomerId);
          if (c) {
            const custInput = $('#jettingCustInput');
            if (custInput) custInput.value = c.name || 'Subscriber';
            const routeInput = $('#jettingRouteInput');
            if (routeInput) routeInput.value = `${c.area || 'Shahdara'} Microduct Span to Demarcation`;
          }
        }
        jettingModal.showModal();
      }
    });
  const tubeSlittingModal = $('#tubeSlittingAccessModal');
  const openTubeSlittingAccessBtn = $('#openTubeSlittingAccessBtn');

  if (openTubeSlittingAccessBtn) {
    openTubeSlittingAccessBtn.addEventListener('click', () => {
      if (tubeSlittingModal) {
        if (state.selectedCustomerId) {
          const c = state.customers.find(cust => cust.id === state.selectedCustomerId);
          if (c) {
            const custInput = $('#slittingCustInput');
            if (custInput) custInput.value = c.name || 'Subscriber';
            const routeInput = $('#slittingRouteInput');
            if (routeInput) routeInput.value = `${c.area || 'Shahdara'} FOSC Closure (Mid-Span Tap)`;
          }
        }
        tubeSlittingModal.showModal();
      }
    });
  }

  const conduitPullingModal = $('#conduitPullingModal');
  const openConduitPullingBtn = $('#openConduitPullingBtn');

  if (openConduitPullingBtn) {
    openConduitPullingBtn.addEventListener('click', () => {
      if (conduitPullingModal) {
        if (state.selectedCustomerId) {
          const c = state.customers.find(cust => cust.id === state.selectedCustomerId);
          if (c) {
            const custInput = $('#cndSubscriberInput');
            if (custInput) custInput.value = c.name || 'Subscriber';
            const routeInput = $('#cndRouteInput');
            if (routeInput) routeInput.value = `${c.area || 'Shahdara'} Building Riser Conduit to Unit`;
          }
        }
        conduitPullingModal.showModal();
      }
    });
  }

  const spectralAttenuationModal = $('#spectralAttenuationModal');
  const openSpectralAttenuationBtn = $('#openSpectralAttenuationBtn');

  if (openSpectralAttenuationBtn) {
    openSpectralAttenuationBtn.addEventListener('click', () => {
      if (spectralAttenuationModal) {
        if (state.selectedCustomerId) {
          const c = state.customers.find(cust => cust.id === state.selectedCustomerId);
          if (c) {
            const custInput = $('#sptSubscriberInput');
            if (custInput) custInput.value = `${c.name || 'Subscriber'} Optical Link`;
            const routeInput = $('#sptRouteInput');
            if (routeInput) routeInput.value = `${c.area || 'Shahdara'} Feeder to Demarcation`;
          }
        }
        spectralAttenuationModal.showModal();
      }
    });
  }

  const foscSealModal = $('#foscSealModal');
  const openFoscSealBtn = $('#openFoscSealBtn');

  if (openFoscSealBtn) {
    openFoscSealBtn.addEventListener('click', () => {
      if (foscSealModal) {
        if (state.selectedCustomerId) {
          const c = state.customers.find(cust => cust.id === state.selectedCustomerId);
          if (c) {
            const custInput = $('#foscSubscriberInput');
            if (custInput) custInput.value = `${c.name || 'Shahdara'} Enclosure Splice`;
            const routeInput = $('#foscRouteInput');
            if (routeInput) routeInput.value = `${c.area || 'Shahdara'} Distribution Ring Joint`;
          }
        }
        foscSealModal.showModal();
      }
    });
  }

  const thermalCyclingModal = $('#thermalCyclingModal');
  const openThermalCyclingBtn = $('#openThermalCyclingBtn');

  if (openThermalCyclingBtn) {
    openThermalCyclingBtn.addEventListener('click', () => {
      if (thermalCyclingModal) {
        if (state.selectedCustomerId) {
          const c = state.customers.find(cust => cust.id === state.selectedCustomerId);
          if (c) {
            const custInput = $('#thmSubscriberInput');
            if (custInput) custInput.value = `${c.name || 'Shahdara'} Feeder Span`;
            const routeInput = $('#thmRouteInput');
            if (routeInput) routeInput.value = `${c.area || 'Shahdara'} Route Distribution Cable`;
          }
        }
        thermalCyclingModal.showModal();
      }
    });
  }

  const billingCorrectnessModal = $('#billingCorrectnessModal');

  const dataIntegrityModal = $('#dataIntegrityModal');
  if (dataIntegrityModal && !dataIntegrityModalController) {
    dataIntegrityModalController = setupDataIntegrityModal({
      getState: () => state,
      updateState: (newState) => {
        state = newState;
        save();
        renderDetail();
        renderCustomers();
        renderDashboard();
      },
      storage: typeof localStorage !== 'undefined' ? localStorage : null,
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

  const targetModal = $('#collectionTargetModal');
  if (targetModal && !collectionTargetController) {
    collectionTargetController = setupCollectionTargetModal(state);
  }

  const duesAgingModal = $('#duesAgingModal');
  if (duesAgingModal && !duesAgingController) {
    duesAgingController = setupDuesAgingModal(state, {
      onFilterCustomer: (customerId) => {
        selectCustomer(customerId);
        switchView('customers');
      },
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

  const topDefaultersModal = $('#topDefaultersModal');
  if (topDefaultersModal && !topDefaultersModalController) {
    topDefaultersModalController = setupTopDefaultersModal(() => state, {
      onFilterCustomer: (customerId) => {
        selectCustomer(customerId);
        switchView('customers');
      },
      onToast: (msg, opts) => toast(msg, opts),
      onWaadaChange: () => { try { persistState(state, localStorage); } catch {} }
    });
  }

  const zoneSheetDialog = $('#zoneSheetDialog');
  if (zoneSheetDialog && !zoneSheetDialogController) {
    zoneSheetDialogController = setupZoneSheetDialog(() => state, {
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

  const expenseVoucherDialog = $('#expenseVoucherDialog');
  if (expenseVoucherDialog && !expenseVoucherDialogController) {
    expenseVoucherDialogController = setupExpenseVoucherDialog(() => state, {
      getPartnerEntries: () => loadPartnerLedgerEntries(),
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

  const ownerPinDialog = $('#ownerPinDialog');
  if (ownerPinDialog && !ownerPinGuardController) {
    ownerPinGuardController = setupOwnerPinGuard({
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

  if (!multiMonthMatrixController) {
    multiMonthMatrixController = setupMultiMonthMatrix(() => state, {
      getComplaints: () => loadComplaints()
    });
    if (multiMonthMatrixController) multiMonthMatrixController.refresh();
  }

  const areaCollectionsModal = $('#areaCollectionsModal');
  if (areaCollectionsModal && !areaCollectionsModalController) {
    areaCollectionsModalController = setupAreaCollectionsModal(() => state, {
      onFilterCustomerArea: (areaName) => {
        const search = $('#globalCustomerSearch');
        if (search) {
          search.value = areaName;
          renderGlobalSearch();
        }
        switchView('customers');
      },
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

  const packageRevenueModal = $('#packageRevenueModal');
  if (packageRevenueModal && !packageRevenueModalController) {
    packageRevenueModalController = setupPackageRevenueModal(() => state, {
      onFilterPackageCustomers: (pkgLabel) => {
        const search = $('#globalCustomerSearch');
        if (search) {
          search.value = pkgLabel;
          renderGlobalSearch();
        }
        switchView('customers');
      },
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

  const pnlModal = $('#pnlModal');
  if (pnlModal && !pnlModalController) {
    pnlModalController = setupPnlModal(() => state, {
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

  const momGrowthModal = $('#momGrowthModal');
  if (momGrowthModal && !momGrowthModalController) {
    momGrowthModalController = setupMomGrowthModal(() => state, {
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

  const dailyClosingModal = $('#dailyClosingModal');
  if (dailyClosingModal && !dailyClosingModalController) {
    dailyClosingModalController = setupDailyClosingModal(() => state, {
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

  const shopSettlementModal = $('#shopSettlementModal');
  if (shopSettlementModal && !shopSettlementModalController) {
    shopSettlementModalController = setupShopSettlementModal(() => state, {
      onUpdateState: (newState) => {
        state = newState;
        save();
      },
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

  const commissionModal = $('#commissionModal');
  if (commissionModal && !commissionModalController) {
    commissionModalController = setupCommissionModal(() => state, {
      onUpdateState: (newState) => {
        state = newState;
        save();
      },
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

  const billingCycleModal = $('#billingCycleModal');
  if (billingCycleModal && !billingCycleModalController) {
    billingCycleModalController = setupBillingCycleModal(() => state, {
      onUpdateState: (newState) => {
        state = newState;
        save();
      },
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

  const workListModal = $('#workListModal');
  if (workListModal && !worklistsModalController) {
    worklistsModalController = setupWorklistsModal(() => state, {
      onUpdateState: (newState) => {
        state = newState;
        save();
        renderDetail();
        renderCustomers();
        renderDashboard();
      },
      onFilterCustomer: (customerId) => {
        selectCustomer(customerId);
        switchView('customers');
      },
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

  const staffPerfModal = $('#staffPerformanceModal');
  if (staffPerfModal && !staffPerformanceModalController) {
    staffPerformanceModalController = setupStaffPerformanceModal(() => state, {
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

  const lateFeeModal = $('#lateFeeManagerModal');

  const openCorrectnessBtn = $('#openBillingCorrectnessBtn');
  if (openCorrectnessBtn && !openCorrectnessBtn.dataset.wired) {
    openCorrectnessBtn.dataset.wired = 'true';
    openCorrectnessBtn.addEventListener('click', () => {
      ensureQaModals().then(() => { billingCorrectnessModalController?.open(); }).catch(() => {});
    });
  }
  const mobileMoreCorrectnessBtn = $('#mobileMoreBillingCorrectnessBtn');
  if (mobileMoreCorrectnessBtn && !mobileMoreCorrectnessBtn.dataset.wired) {
    mobileMoreCorrectnessBtn.dataset.wired = 'true';
    mobileMoreCorrectnessBtn.addEventListener('click', () => {
      const moreMenu = $('#mobileMoreMenu');
      if (moreMenu) moreMenu.hidden = true;
      ensureQaModals().then(() => { billingCorrectnessModalController?.open(); }).catch(() => {});
    });
  }
  const mobileMoreTargetBtn = $('#mobileMoreCollectionTargetBtn');
  if (mobileMoreTargetBtn && !mobileMoreTargetBtn.dataset.wired) {
    mobileMoreTargetBtn.dataset.wired = 'true';
    mobileMoreTargetBtn.addEventListener('click', () => {
      const moreMenu = $('#mobileMoreMenu');
      if (moreMenu) moreMenu.hidden = true;
      collectionTargetController?.open();
    });
  }

  // Reminders Queue Today Button from Mobile More Menu
  const mobileMoreRemindersQueueBtn = $('#mobileMoreRemindersQueueBtn');
  if (mobileMoreRemindersQueueBtn && !mobileMoreRemindersQueueBtn.dataset.wired) {
    mobileMoreRemindersQueueBtn.dataset.wired = 'true';
    mobileMoreRemindersQueueBtn.addEventListener('click', () => {
      const moreMenu = $('#mobileMoreMenu');
      if (moreMenu) moreMenu.hidden = true;
      const res = getRemindersTodayQueue(state);
      if (!res.queue || res.queue.length === 0) {
        openPaymentReminderModal(null, {
          isEmptyQueue: true,
          overdueCount: res.overdueCustomersCount
        });
        return;
      }
      openPaymentReminderModal(res.queue[0].customer, {
        queue: res.queue,
        index: 0
      });
    });
  }

  // Update Reminders Queue Nav Badge on More button
  const mobileMoreButtonEl = $('#mobileMoreButton');
  if (mobileMoreButtonEl && !mobileMoreButtonEl.dataset.remindersBadgeWired) {
    mobileMoreButtonEl.dataset.remindersBadgeWired = 'true';
    mobileMoreButtonEl.addEventListener('click', () => {
      try {
        updateRemindersQueueNavBadge(state);
      } catch {}
    });
  }
  try {
    updateRemindersQueueNavBadge(state);
  } catch {}

  // Wada / Promise-to-Pay Follow-up List Button from Mobile More Menu
  const mobileMoreWadaListBtn = $('#mobileMoreWadaListBtn');
  if (mobileMoreWadaListBtn && !mobileMoreWadaListBtn.dataset.wired) {
    mobileMoreWadaListBtn.dataset.wired = 'true';
    mobileMoreWadaListBtn.addEventListener('click', () => {
      const moreMenu = $('#mobileMoreMenu');
      if (moreMenu) moreMenu.hidden = true;
      openWadaFollowupModal();
    });
  }

  // Reminder Stages Configuration Button from Mobile More Menu
  const mobileMoreReminderStagesBtn = $('#mobileMoreReminderStagesBtn');
  if (mobileMoreReminderStagesBtn && !mobileMoreReminderStagesBtn.dataset.wired) {
    mobileMoreReminderStagesBtn.dataset.wired = 'true';
    mobileMoreReminderStagesBtn.addEventListener('click', () => {
      const moreMenu = $('#mobileMoreMenu');
      if (moreMenu) moreMenu.hidden = true;
      openReminderStagesModal();
    });
  }

  if (typeof window !== 'undefined') {
    window.billingCorrectnessModalController = billingCorrectnessModalController;
    window.dataIntegrityModalController = dataIntegrityModalController;
    window.collectionTargetController = collectionTargetController;
    window.duesAgingController = duesAgingController;
    window.topDefaultersModalController = topDefaultersModalController;
    window.zoneSheetDialogController = zoneSheetDialogController;
    window.expenseVoucherDialogController = expenseVoucherDialogController;
    window.ownerPinGuardController = ownerPinGuardController;
    window.areaCollectionsModalController = areaCollectionsModalController;
    window.packageRevenueModalController = packageRevenueModalController;
    window.pnlModalController = pnlModalController;
    window.momGrowthModalController = momGrowthModalController;
    window.dailyClosingModalController = dailyClosingModalController;
    window.shopSettlementModalController = shopSettlementModalController;
    window.lateFeeModalController = lateFeeModalController;
    window.worklistsModalController = worklistsModalController;
    window.staffPerformanceModalController = staffPerformanceModalController;
    window.openWadaFollowupModal = openWadaFollowupModal;
    window.openReminderStagesModal = openReminderStagesModal;
    window.openPaymentReminderModal = openPaymentReminderModal;
  }
  void refreshStorageSafetyInfo();
}

// SISP-14: QR Khata Card modal — printable wallet card + scannable deep link.
// The QR encodes only the deep link (id + route), never financial data.
function openQrKhataCard(customer) {
  const dialog = $('#qrKhataCardModal');
  if (!dialog || !customer) return;
  const model = buildKhataCardModel(customer, { baseUrl: resolveQrBaseUrl(window.location?.href) });
  if (!model) return;
  $('#qrKhataCardName').textContent = model.customerName;
  $('#qrKhataCardConnection').textContent = `Connection ID: ${model.connectionLabel}`;
  $('#qrKhataCardRate').textContent = model.monthlyPackageRate === null
    ? 'Package rate: Not set'
    : `Package rate: ${formatAmount(model.monthlyPackageRate)}/month${model.packageSpeed ? ` · ${model.packageSpeed}` : ''}`;
  const areaEl = $('#qrKhataCardArea');
  areaEl.textContent = model.areaZone || '';
  areaEl.hidden = !model.areaZone;
  $('#qrKhataCardShops').textContent = `Pay at: ${model.shops.join(' · ')}`;
  const linkEl = $('#qrKhataCardLink');
  linkEl.textContent = model.deepLink;
  linkEl.href = model.deepLink;
  const canvas = $('#qrKhataCardCanvas');
  const fallback = $('#qrKhataCardFallback');
  let qrDataUrl = null;
  try {
    drawQrToCanvas(canvas, encodeQrMatrix(model.deepLink), { modulePx: 5, margin: 4 });
    canvas.hidden = false;
    fallback.hidden = true;
    qrDataUrl = canvas.toDataURL('image/png');
  } catch {
    canvas.hidden = true;
    fallback.hidden = false;
  }
  const pngBtn = $('#qrKhataCardPngBtn');
  pngBtn.disabled = !qrDataUrl;
  pngBtn.onclick = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `khata-card-${model.connectionLabel.replace(/[^A-Za-z0-9_-]/g, '') || 'customer'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  $('#qrKhataCardPrintBtn').onclick = () => {
    const win = window.open('', '_blank');
    if (!win) {
      toast('Print window blocked — allow pop-ups for this site and try again.');
      return;
    }
    win.document.write(buildKhataCardPrintHtml(model, qrDataUrl));
    win.document.close();
    win.focus();
    win.print();
  };
  $('#qrKhataCardCopyBtn').onclick = async () => {
    try {
      await navigator.clipboard.writeText(model.deepLink);
      toast('Khata link copied.');
    } catch {
      toast('Copy failed — long-press the link to copy it.');
    }
  };
  $('#closeQrKhataCardModalBtn').onclick = () => dialog.close();
  dialog.showModal();
}

// SISP-14: shop-counter QR deep link (?customer=[id]&action=pay) on app load.
// action=pay opens the payment modal; anything else opens the profile. An
// unknown id shows a toast and never leaks another customer's data. The query
// is stripped after handling so a refresh does not re-open the payment modal.
function handleCustomerDeepLink() {
  if (typeof window === 'undefined' || !window.location) return;
  const parsed = parseCustomerDeepLink(window.location.search || '');
  if (!parsed) return;
  const target = resolveDeepLinkCustomer(state.customers, parsed.customerId);
  try {
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState(null, '', url.toString());
  } catch {}
  if (!target) {
    toast('Customer not found for this QR link.');
    return;
  }
  selectCustomer(target.id, { pushHistory: false });
  if (parsed.action === 'pay' && window.quickCollectModalController?.selectAndOpen) {
    window.quickCollectModalController.selectAndOpen(target.id);
  }
}

function handleRouteFromHash() {
  if (typeof window === 'undefined' || !window.location) return;
  const raw = (window.location.hash || '').replace(/^#\/?/, '').trim();
  if (!raw || raw === 'home') {
    mobileBreadcrumbs?.resetBreadcrumbs();
    return;
  }
  if (raw.startsWith('customer=')) {
    const cid = decodeURIComponent(raw.slice('customer='.length));
    if (state.customers.some(c => c.id === cid)) {
      selectCustomer(cid, { pushHistory: false });
      return;
    }
  }
  if (raw.startsWith('customers/') || raw.startsWith('customer/')) {
    const prefix = raw.startsWith('customers/') ? 'customers/' : 'customer/';
    const cid = decodeURIComponent(raw.slice(prefix.length).split(/[?#]/)[0].trim());
    if (cid) {
      const target = state.customers.find(c => c.id === cid || String(c.customerNumber) === cid || c.id === 'cust-' + cid);
      if (target) {
        selectCustomer(target.id, { pushHistory: false });
        return;
      }
    }
  }
  if (['quick-collect', 'add-customer', 'today-dues', 'dues', 'collection-rounds', 'pending-actions', 'fast-search', 'pwa-status'].includes(raw)) {
    return;
  }
  const validViews = ['customers', 'transactions', 'reports', 'analytics', 'inventory', 'expenses', 'homeBudget', 'loans', 'waTemplates'];
  if (validViews.includes(raw)) {
    switchView(raw, { pushHistory: false });
    if (raw === 'transactions') renderTransactions();
    else if (raw === 'reports') renderMonthlyReport();
    else if (raw === 'analytics') renderAnalytics();
    else if (raw === 'inventory') renderInventory();
    else if (raw === 'expenses') renderExpenses();
    else if (raw === 'homeBudget') renderHomeBudget();
    else if (raw === 'loans') renderLoans();
    else if (raw === 'customers') renderCustomers();
  }
}

window.addEventListener('popstate', event => {
  if (event.state?.customerId) {
    selectCustomer(event.state.customerId, { pushHistory: false });
  } else {
    if (appShell.classList.contains('show-detail')) {
      appShell.classList.remove('show-detail');
    }
    handleRouteFromHash();
  }
});
window.addEventListener('hashchange', handleRouteFromHash);
if (typeof window !== 'undefined' && window.location?.hash) {
  handleRouteFromHash();
}
// SISP-14: shop-counter QR deep link (?customer=[id]&action=pay) on app load.
handleCustomerDeepLink();
}

// Storage safety Layer C: if the startup load already failed, the recovery
// screen opens on top of the seed-state screen (nothing was overwritten).
// Healthy loads are untouched: persistenceBlocked is false, so this is a
// no-op with no prompt and no delay.
if (persistenceBlocked && typeof document !== 'undefined') { void showStorageRecoveryDialog(); }
