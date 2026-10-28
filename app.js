import {
  INITIAL_NAMES, PAYMENT_METHODS, MONTH_LIMIT, readState, persistState, monthsForHistory, generateMonthlyBillsThroughCurrentMonth,
  addCustomer, deleteCustomer, archiveCustomer, unarchiveCustomer, updateCustomerProfile, saveBillMonth, addPayment, correctPayment,
  deletePayment, recordedAmount, customerPackageProfit, calculateDashboard, searchCustomers, filterCustomersByStatus, derivedBillStatus,
  listTransactions, buildMonthlyReport, effectiveBillStatus, calculatePaymentAllocations, buildPayrollSummary, addIncident, updateIncident,
  deleteIncident, countCustomerIncidentsLast30Days, exportAllPayments, exportCustomerHistory, formatPKR, createJsonBackup, previewJsonBackupMerge, PAKISTAN_TIME_ZONE, autoClosePreviousMonth, buildMonthlyClosingSnapshot,
  summarizeCustomerReceipts, summarizeCustomerTenure, applyLateFeeToBill, waiveLateFeeFromBill,
  calculateMethodCollectionTotals, findDuplicatePaymentReference,
  buildNewCustomerReport, filterNewCustomerMonths, newCustomerQuickRanges
} from './core.js?v=1.10.0';
import { initDigitalPaymentsSettingsModal, getDigitalPaymentsSettings, saveDigitalPaymentsSettings, DIGITAL_PAYMENTS_SETTINGS_KEY } from './digital-payments-settings.js?v=1.10.0';
import { setupHomeTodaySection } from './home-today.js?v=1.10.0';
import {
  EXPENSE_CATEGORIES, INVENTORY_STATES, PAYROLL_RULES_EFFECTIVE_DATE, UMAIR_PER_LOGGED_WORKDAY,
  addInventoryItem, updateInventoryItem, addStockMovement, deleteStockMovement, addSaadAttendanceDay, removeSaadAttendanceDay,
  addUmairWorkday, removeUmairWorkday, inventorySummary, addExpense, updateExpense, deleteExpense, buildPhase3Analytics, buildAreaIntelligence, buildPackageRevenue, areaLabel, buildPartnerShareReport, groupAreaIntelligenceCards, buildAreaSummaryCards
} from './phase3.js?v=1.10.0';
import { manualServiceStatusLabel, profileArchiveLabel } from './profile-labels.js?v=1.10.0';
import { currentBillPresentation, contactActionTargets, buildGlobalLedgerSearch, resolveReceiptWhatsAppAction, pauseBillingSummary } from './profile-ui.js?v=1.10.0';
import { buildKistProgress, createInstallmentPlan } from './installment-plan.js?v=1.10.0';
import { PACKAGE_TERMS_NOTE, RECEIPT_URDU_NOTE, buildPaymentReceipt, generatePaymentReceiptHtml } from './receipt.js?v=1.10.0';
import { generateReceiptPNG, shareOrDownloadPng } from './png-receipt.js?v=1.10.0';
import { buildKhataCardModel, buildKhataCardPrintHtml, drawQrToCanvas, encodeQrMatrix, parseCustomerDeepLink, resolveDeepLinkCustomer, resolveQrBaseUrl } from './qr-card.js';
import { thermalPrinter, buildEscPosReceipt, escPosFieldsFromPaymentReceipt, isWebBluetoothAvailable } from './thermal-printer.js?v=1.0.0';
import { customerHasMonthlyFee } from './nav-quick-collect.js';
import { setupFieldMode } from './field-mode.js?v=1.10.0';
import { BILL_PACKAGES, billPackageById, validateBillPackageSnapshot } from './package-catalog.js?v=1.10.0';
import { groupByDay, dayHeaderText, billMonthDiffers, methodSlug, pktDateKey, recordPaymentDeletion, markPaymentDeletionUndone, setupPaymentsList } from './payments-list.js?v=1.10.0';
import { buildCustomerHealthScore, buildCustomerPaymentBehavior, buildCustomerLifetimeValue } from './owner-insights.js?v=1.10.0';
import { setupOwnerCenter } from './owner-ui.js?v=1.10.0';
import {
  createLocalBackupStore, isAutomaticBackupDue, DEFAULT_BACKUP_FREQUENCY,
  calculateBackupAge, checkStoragePersistence, requestStoragePersistence,
  getStorageEstimateInfo, shareJsonBackupFile, LAST_BACKUP_TIME_KEY, STORAGE_PERSISTENCE_KEY,
  encryptBackupJson, decryptBackupJson, isEncryptedBackupPayload
} from './backup-store.js?v=1.10.0';
import { parseCustomerCsvImport, applyCustomerCsvImport, generateSampleCustomerCsv, verifyAllStorageKeysRoundTrip, inspectBackupFileHeader } from './qa-backup-csv-import.js?v=1.10.0';
import { BACKUP_HEALTH_KEY, assessBackupHealth, countAllPayments, countPaymentsAfterDate } from './backup-health.js?v=1.10.0';
import { findPossibleDuplicateCustomers } from './duplicate-detection.js?v=1.10.0';
import { calculateDashboardKpis, calculateCollectionVelocity, setupDashboardQuickActions, renderDashboardCharts, setupDashboardBriefingButton, setupDashboardBriefingModal, setupAreaDrilldownModal, setupCustomerHealthActions, setupChurnRiskModal, setupAreaHeatmapEvents, setupDailyClosingCard } from './dashboard.js?v=1.10.0';
import { setupNavigationDrawer, updateNavigationBadges, setupSidebarRailToggle, setupScrollToTop, setupNetworkStatusIndicator, setupKeyboardShortcuts, setupMobileActionSheet, triggerHaptic, setupPullToRefresh, setupCommandPalette, setupSwipeNavigation, setupOfflineSyncBanner, setupMobileSpeedDial, setupOfflineQueueModal, setupMobileBreadcrumbs, setupTabSliderIndicator, setupCustomerEnrollmentWizard, startOfflineQueueAutoRetryEngine, setupFieldDiagnosticsModal, setupFieldRouteSheet, setupFieldWorkOrderSheet, setupSyncConflictModal, setupOpticalSignalMapModal, setupVehicleTransferModal, setupAerialAlertsModal, setupMobileOtdrTraceModal, setupMobileGpsBreadcrumbsModal, setupMobileOpmTestingModal, setupMobileVflModal, setupMobileFusionSpliceModal, setupMobileWifiSurveyModal, setupMobileOpticalBudgetModal, setupMobileFdtAllocationModal, setupMobileOntDiagnosticsModal, setupMobileFiberProbeModal, setupMobileSplitterTreeModal, setupMobileMacroBendModal, setupMobileAttenuatorModal, setupMobileOrlModal, setupMobileCleaverModal, setupMobileOltsModal, setupMobileFiberIdentifierModal, setupMobileMpoModal, setupMobileFastConnectorModal, setupMobileOtdrLaunchModal, setupMobileBareFiberAdapterModal, setupMobileSlsToneModal, setupMobileFiberTalksetModal, setupMobileWdmSpectrumModal, setupMobileMidspanAccessModal, setupMobilePowerLoggerModal, setupMobileDropRetentionModal, setupMobileRefJumpersModal, setupMobileRibbonSeparatorModal, setupMobileMechanicalSpliceModal, setupMobileFiberMicroscopeModal, setupMobileConnectorCleaningModal, setupMobileOtdrDeadzoneModal, setupMobileTubeShavingModal, setupQuickCollectModal, setupFastCustomerSearchModal, setupMobileQuickProfileModal, setupLanguageToggle, setupPendingActionsModal, setupPwaInstallPrompt, setupPwaStatusModal, setupPwaShortcuts, createLazyModalController, deferLowPriorityInit } from './nav.js?v=1.10.0';




import {
  validatePakistanPhone, validateCustomerCnic, formatCnicDisplay, validatePositiveAmount, validateCustomerName, validateTransactionDate, paginateRows, calculateTransactionSummary,
  sortCustomerRoster, filterCustomersByArea, getUniqueCustomerAreas, sortMonthlyReportRows, sortTransactionsList, renderCustomerTableRowMarkup,
  generateCustomerRosterCsv, renderCustomerTableEmptyMarkup,
  saveFormDraft, loadFormDraft, clearFormDraft, wireFormDraftAutosave, generateCsvContent, downloadCsvFile, generateBatchReceiptHtml,
  maskPakistanPhone, wirePhoneInputMask, formatCustomerStatement, formatCustomerStatementWhatsApp, generateCustomerStatementHtml, downloadCustomerStatementCsv, filterStatementEvents, statementFilterMonths, statementFilterMethods, sortStatementEvents, statementMonthSubtotals, statementAging, statementTrendSvg, statementDaysOverdue,
  formatWhatsAppUrl, buildPaymentReminderMessage, generatePaymentReminderSlipHtml,
  buildCustomerBillInvoiceData, generateBillInvoiceHtml, buildWhatsAppBillInvoiceText,
  generateStandaloneInvoiceDocument, downloadHtmlFile,
  reconcileCustomerLedger, generateLedgerAuditReport, generateLedgerAuditCsv, generateLedgerAuditPrintHtml,
  calculateDenominationTotal, buildDailyRegisterData, formatDailyRegisterWhatsAppText, generateDailyRegisterCsv, generateDailyRegisterPrintHtml, setupDailyRegisterModal,
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
  setupOrlCertModal,
  setupDdmiCertModal,
  setupDispersionCertModal,
  setupBendLossCertModal,
  setupBidirectionalOtdrModal,
  setupOtdrDeadzoneModal,
  setupSplitterQaModal,
  setupFerruleGeometryModal,
  setupFusionArcQaModal,
  setupStripForceQaModal,
  setupSpliceMfdOffsetModal,
  setupSpliceSleeveCureModal,
  setupFiberCleaveQualityModal,
  setupOtdrGhostArtifactModal,
  setupRibbonSpliceQaModal,
  setupFastConnectorQaModal,
  setupAdssSagTensionModal,
  setupArmoredCableCrushModal,
  setupCableJettingModal,
  setupTubeSlittingAccessModal,
  setupConduitPullingModal,
  setupSpectralAttenuationModal,
  setupFoscSealModal,
  setupThermalCyclingModal,
  setupBillingCorrectnessModal,
  calculatePlanMigrationProration,
  buildAdjustmentVoucherData,
  saveAdjustmentVoucher,
  setupLateFeeModal,
  getLateFeeConfig,
  isBillOverdue,
  generateAreaIntelligenceCsv,
  generatePackageSummaryCsv,
  generateAreaSummaryCsv,
  validateExpenseFormFields,
  buildPayrollExpensePrefill,
  validateStaffAttendanceDate,
  filterExpenseRows,
  sortExpenseRows,
  generateExpensesCsv
} from './form-validation.js?v=1.10.0';
import { setupCollectionTargetModal } from './dashboard-collection-target.js';
import { setupDuesAgingModal } from './dashboard-dues-aging.js';
import { setupTopDefaultersModal } from './dashboard-top-defaulters.js';
import { setupAreaCollectionsModal } from './dashboard-area-collections.js';
import { setupPackageRevenueModal } from './dashboard-package-revenue.js';
import { setupPnlModal } from './dashboard-pnl.js';
import { setupMomGrowthModal } from './dashboard-mom-growth.js';
import { setupDailyClosingModal } from './dashboard-daily-closing.js';
import { SHOP_SETTLEMENTS_KEY, buildShopSummaries, loadShopSettlements, saveShopSettlements, setupShopSettlementModal } from './shop-settlement.js';
import { computeWaadaChipDate, setCustomerWaada, clearCustomerWaada, waadaBadgeLabel } from './waada-queue.js';
import { displayCustomerName, currentAppLanguage } from './urdu-names.js';
import { buildArrearsBreakdown, loadBillingCycles, setupBillingCycleModal } from './billing-cycle.js';
import { calculateInstallationCost } from './installation-cost.js?v=1.10.0';
import { AREA_OUTAGE_CUSTOMER_ID, COMPLAINTS_KEY, buildComplaintSummary, complaintCustomerLabel, formatDowntimeHours, loadComplaints, pakistanMonthNow, saveComplaints, setupComplaintRegisterModal } from './complaint-register.js';
import { TICKETS_KEY, billedTicketChargesPending, buildTicketSummary, hasRecurringFaultWarning, loadTickets, saveTickets, setupFieldTicketsModal, ticketFaultLabel, ticketsForCustomer } from './complaint-tickets.js';
import { buildCustomerDowntimeSummary, buildMonthlyDowntimeAnalytics, setupDowntimeAnalyticsModal } from './downtime-analytics.js';
import { buildMonthlyComplaintReport, setupMonthlyComplaintReportModal } from './monthly-complaint-report.js';
import { ROZNAMCHA_KEY, buildRoznamchaDay, loadRoznamchaDays, pakistanToday, saveRoznamchaDays, setupRoznamchaModal } from './roznamcha.js';
import { INVENTORY_KEY, computeStock, loadInventory, saveInventory, setupInventoryBookModal } from './inventory-book.js';
import { FIBER_ZONES, buildOutageQueue, normalizeFeederFields, setupOutageImpactModal, summarizeFeederNetwork, traceDownstreamImpact } from './outage-impact.js';
import { SAAD_PAYMENTS_KEY, SAAD_VISITS_KEY, buildMonthlySaadSummary, formatHours, visitHours, loadSaadPayments, loadSaadVisits, saveSaadPayments, saveSaadVisits, setupSaadVisitsModal, visitTypeLabel, visitWhereLabel } from './saad-visits.js';
import { INSTALL_REQUESTS_KEY, buildMonthlyInstallSummary, installTrackerToday, loadInstallRequests, saveInstallRequests, setupInstallTrackerModal } from './install-tracker.js';
import { PENDING_WORKS_KEY, countActiveCustomers, loadPendingWorks, pendingWorksSummary, savePendingWorks, setupPendingWorksModal } from './pending-works.js';
import { buildCustomerMikrotikSnippet } from './mikrotik-generator.js';
import { setupWorklistsModal, calculateDisconnectReconnectWorklists } from './dashboard-worklists.js';
import { setupStaffPerformanceModal } from './dashboard-staff-performance.js';
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
  formatDisplayDate
} from './reminder-queue.js?v=1.10.0';




const $ = selector => document.querySelector(selector);
const appShell = $('.app-shell');
const customerList = $('#customerList');
const historyContainer = $('#historyContainer');
const transactionList = $('#transactionsList');
const reportList = $('#monthlyReportList');
let storageAvailable = true;
let persistenceBlocked = false;
let readFailureMessage = '';
export let collectionTargetController = null;
export let duesAgingController = null;
export let topDefaultersModalController = null;
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
export let monthlyComplaintReportModalController = null;
export let roznamchaModalController = null;
export let inventoryBookModalController = null;
export let outageImpactModalController = null;
export let saadVisitsModalController = null;
export let installTrackerModalController = null;
export let pendingWorksModalController = null;
export let lateFeeModalController = null;
export let worklistsModalController = null;
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
    customers:INITIAL_NAMES.map((name, index) => ({ id:`seed-${String(index + 1).padStart(3, '0')}`, customerNumber:index + 1, name, mohalla:'', zone:'', address:'', phone:'', ispProvider:'', serviceStatus:'not-set', packageSpeed:'', monthlyPurchaseCost:null, monthlySellingAmount:null, monthlyPriceSchedule:[], billingStartMonth:null, connectionDate:null, expiryDate:null, cancellationDate:null, packageHistory:[], archived:false, archivedAt:null, bills:[], incidents:[] })), inventoryItems:[], inventoryMovements:[], expenses:[],saadAttendanceDays:[],umairWorkdays:[]
  };
}
state = generateMonthlyBillsThroughCurrentMonth(state, new Date());
if (!persistenceBlocked) state = autoClosePreviousMonth(state, new Date());
if (storageAvailable) { try { persistState(state, localStorage); } catch { storageAvailable = false; } }
let selectedCustomerId = null;
let navDrawer = null;
let mobileBreadcrumbs = null;
let tabSlider = null;
let customerEnrollmentWizard = null;
let mobileActionSheetController = null;
let profileEditMode = false;
let selectedProfileTab = 'billing';
let selectedReportFilter = 'all';
let selectedServiceFilter = 'all';
let selectedBillingFilter = 'all';
let selectedBillingMonth = monthsForHistory()[0];
// New-customers panel state (customer ledger): a quick view or one chosen month.
let newCustomersView = 'thisMonth';
let newCustomersMonth = '';
let selectedPayrollMonth = monthsForHistory()[0];
let pendingBackupPreview = null;
let toastTimer;
let refreshOwnerCenter = () => {};
let customerDraftController = null;
let expenseDraftController = null;
const localBackupStore = createLocalBackupStore();
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
  const nowIso = new Date().toISOString();
  try { localStorage.setItem(LAST_BACKUP_TIME_KEY, nowIso); } catch { /* ignore */ }
  try { localStorage.setItem(BACKUP_HEALTH_KEY, JSON.stringify({ lastExportAt: nowIso, paymentCountAtExport: countAllPayments(state) })); } catch { /* ignore */ }
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
  return `<label class="field-label full" for="${id}">Paid by (optional)</label><input id="${id}" class="full" name="paidBy" type="text" maxlength="100" autocomplete="off" placeholder="Leave blank if not specified" value="${escapeHtml(value)}">`;
}
function paymentPayerMarkup(payment) {
  const paidBy = String(payment?.paidBy ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, 100);
  return paidBy ? ` · Paid by: ${escapeHtml(paidBy)}` : '';
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
    billing:['#customerReceiptSummary','.ledger-heading','.history-retention-note','#customerEmptyNote','#historyContainer'],
    info:['.customer-meta','.package-history-section'],
    complaints:['.incident-section']
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
  try { persistState(state, localStorage); storageAvailable = true; }
  catch { storageAvailable = false; toast('Could not save. Check browser storage is available.'); }
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
function renderDashboard() {
  const referenceDate = new Date();
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
    if (valueEl) valueEl.textContent = shopSummaries.length === 0 ? 'No shop collections' : formatAmount(totalUnsettled);
    const periodEl = $('#dashboardShopSettlementPeriod');
    if (periodEl) periodEl.textContent = shopSummaries.length === 0 ? 'Unsettled cash sitting at shops' : `${shopSummaries.length} shop${shopSummaries.length === 1 ? '' : 's'} · ${pendingCount} pending receipt${pendingCount === 1 ? '' : 's'}`;
    shopSummaryEl.innerHTML = shopSummaries.length === 0
      ? ''
      : shopSummaries.map((s) => `<p><span>${escapeHtml(s.shop)}</span><strong>${escapeHtml(formatAmount(s.unsettled))}</strong><small> · ${escapeHtml(formatAmount(s.collectedThisMonth))} this month · last handover ${escapeHtml(s.lastHandoverDate || 'never')}</small></p>`).join('');
  }
  // SISP-2: monthly billing cycle card (last run + open the cycle modal).
  const cycleSummaryEl = $('#billingCycleSummary');
  if (cycleSummaryEl) {
    const cycles = loadBillingCycles();
    const latest = cycles[0] || null;
    const valueEl = $('#dashboardBillingCycleValue');
    const periodEl = $('#dashboardBillingCyclePeriod');
    if (valueEl) valueEl.textContent = latest ? `${monthName(latest.month)} cycled` : 'No cycle run yet';
    if (periodEl) periodEl.textContent = latest ? `${latest.totals.billedCount} bills · ${formatAmount(latest.totals.netExpectedCollection)} net expected` : 'Run a monthly cycle with arrears & advance';
    cycleSummaryEl.innerHTML = latest
      ? `<p><span>${escapeHtml(monthName(latest.month))}</span><strong>${escapeHtml(formatAmount(latest.totals.totalBilled))} billed</strong><small> · ${escapeHtml(formatAmount(latest.totals.totalArrears))} arrears carried · ${escapeHtml(latest.ranAt || '')}</small></p>`
      : '';
  }
  // SISP-15: complaint register card (open faults + this-month downtime).
  const complaintSummaryEl = $('#complaintRegisterSummary');
  if (complaintSummaryEl) {
    const summary = buildComplaintSummary(loadComplaints(), referenceDate);
    const valueEl = $('#dashboardComplaintValue');
    const periodEl = $('#dashboardComplaintPeriod');
    if (valueEl) valueEl.textContent = summary.total === 0 ? 'No complaints' : `${summary.open} open · ${summary.inProgress} in progress`;
    if (periodEl) periodEl.textContent = summary.total === 0 ? 'Open faults and resolution downtime' : `${summary.resolved} resolved · ${summary.thisMonthCount} this month · ${summary.thisMonthDowntime} h downtime`;
    complaintSummaryEl.innerHTML = summary.total === 0
      ? ''
      : `<p><span>Open now</span><strong>${escapeHtml(String(summary.open))}</strong><small> · ${escapeHtml(String(summary.inProgress))} in progress · ${escapeHtml(String(summary.resolved))} resolved</small></p>`;
  }
  // SISP-12: field tickets card (open worklist + pending ticket charges).
  const ticketSummaryEl = $('#fieldTicketsSummary');
  if (ticketSummaryEl) {
    const summary = buildTicketSummary(loadTickets());
    const valueEl = $('#dashboardFieldTicketsValue');
    const periodEl = $('#dashboardFieldTicketsPeriod');
    if (valueEl) valueEl.textContent = summary.total === 0 ? 'No field tickets' : `${summary.open} open · ${summary.inProgress} in progress`;
    if (periodEl) periodEl.textContent = summary.total === 0 ? 'Lineman worklist and material use' : `${summary.resolved} resolved · PKR ${summary.pendingCharges} pending ticket charges`;
    ticketSummaryEl.innerHTML = summary.total === 0
      ? ''
      : `<p><span>Open now</span><strong>${escapeHtml(String(summary.open))}</strong><small> · ${escapeHtml(String(summary.inProgress))} in progress · ${escapeHtml(String(summary.resolved))} resolved</small></p>`;
  }
  // SISP-16: downtime analytics card (this-month customer + network downtime).
  const downtimeSummaryEl = $('#downtimeAnalyticsSummary');
  if (downtimeSummaryEl) {
    const analytics = buildMonthlyDowntimeAnalytics(loadComplaints(), pakistanMonthNow(referenceDate));
    const valueEl = $('#dashboardDowntimeValue');
    const periodEl = $('#dashboardDowntimePeriod');
    if (valueEl) valueEl.textContent = analytics.totalComplaints === 0 ? 'No downtime' : `${analytics.totalDowntime} h downtime`;
    if (periodEl) periodEl.textContent = analytics.totalComplaints === 0 ? 'Per-customer and network outage hours' : `${analytics.totalComplaints} complaints · ${analytics.perCustomer.length} customers affected`;
    downtimeSummaryEl.innerHTML = analytics.totalComplaints === 0
      ? ''
      : `<p><span>Top customer</span><strong>${escapeHtml(analytics.perCustomer.length ? `${analytics.perCustomer[0].customerName} · ${analytics.perCustomer[0].totalDowntime} h` : '—')}</strong><small> · ${escapeHtml(String(analytics.areaOutageComplaints))} zone-wide faults · ${escapeHtml(String(analytics.areaOutageDowntime))} h</small></p>`;
  }
  // SISP-17: monthly complaint report card (this-month 4-part report totals).
  const monthlyReportSummaryEl = $('#monthlyComplaintReportSummary');
  if (monthlyReportSummaryEl) {
    const report = buildMonthlyComplaintReport(loadComplaints(), pakistanMonthNow(referenceDate));
    const valueEl = $('#dashboardMonthlyReportValue');
    const periodEl = $('#dashboardMonthlyReportPeriod');
    if (valueEl) valueEl.textContent = report.summary.totalComplaints === 0 ? 'No complaints' : `${report.summary.totalComplaints} complaints · ${report.summary.totalDowntime} h net off`;
    if (periodEl) periodEl.textContent = report.summary.totalComplaints === 0 ? '4-part monthly report: summary, customers, causes, full log' : `${report.summary.resolvedCount} resolved · ${report.summary.pendingCount} pending · ${report.summary.fiberCutHours} h Fiber Cut`;
    monthlyReportSummaryEl.innerHTML = report.summary.totalComplaints === 0
      ? ''
      : `<p><span>Top customer</span><strong>${escapeHtml(report.perCustomer.length ? `${report.perCustomer[0].customerName} · ${report.perCustomer[0].complaintCount} complaints` : '—')}</strong></p>`;
  }
  // SISP-11: roznamcha card (today's cash drawer).
  const roznamchaSummaryEl = $('#roznamchaSummary');
  if (roznamchaSummaryEl) {
    const today = pakistanToday();
    const day = buildRoznamchaDay(state, loadRoznamchaDays(), today, loadShopSettlements());
    const valueEl = $('#dashboardRoznamchaValue');
    const periodEl = $('#dashboardRoznamchaPeriod');
    if (valueEl) valueEl.textContent = day.closed ? `Closed · ${formatAmount(day.closingBalance)}` : `${formatAmount(day.expectedClosing)} expected`;
    if (periodEl) periodEl.textContent = day.closed ? `Farq ${formatAmount(day.discrepancy)}` : `Cash in ${formatAmount(day.totalIn)} · petty out ${formatAmount(day.outTotal)}`;
    roznamchaSummaryEl.innerHTML = `<p><span>Opening</span><strong>${escapeHtml(formatAmount(day.openingBalance))}</strong><small> · ${escapeHtml(String(day.cashPayments.length))} cash payments · ${escapeHtml(String(day.handovers.length))} shop handovers</small></p>`;
  }
  // SISP-18: stock book card (live available stock + low-stock count).
  const inventorySummaryEl = $('#inventoryBookSummary');
  if (inventorySummaryEl) {
    const movements = loadInventory();
    const stock = computeStock(movements);
    const lowItems = stock.filter((row) => row.isLow);
    const valueEl = $('#dashboardInventoryValue');
    const periodEl = $('#dashboardInventoryPeriod');
    if (valueEl) valueEl.textContent = movements.length === 0 ? 'No stock recorded' : `${lowItems.length} low-stock item${lowItems.length === 1 ? '' : 's'}`;
    if (periodEl) periodEl.textContent = movements.length === 0 ? 'Fiber, routers, converters & field stock' : `${movements.length} movement${movements.length === 1 ? '' : 's'} recorded`;
    const fiberRow = stock.find((row) => row.id === 'fiber-2core');
    inventorySummaryEl.innerHTML = movements.length === 0
      ? ''
      : `<p><span>Fiber left</span><strong>${escapeHtml(String(fiberRow ? fiberRow.available : 0))} m</strong><small> · ${escapeHtml(String(lowItems.length))} low-stock item${lowItems.length === 1 ? '' : 's'}</small></p>`;
  }
  // SISP-7: feeder outage card (linked customers + longest downstream chain).
  const outageSummaryEl = $('#outageImpactSummary');
  if (outageSummaryEl) {
    const feeder = summarizeFeederNetwork(state.customers);
    const outageValueEl = $('#dashboardOutageValue');
    const outagePeriodEl = $('#dashboardOutagePeriod');
    if (outageValueEl) outageValueEl.textContent = feeder.linkedCount === 0 ? 'No feeder links' : `${feeder.linkedCount} feeder-linked`;
    if (outagePeriodEl) outagePeriodEl.textContent = feeder.maxDownstream === 0 ? 'Link customers to feeders to trace outages' : `Longest chain: ${feeder.maxDownstream} downstream at risk`;
    outageSummaryEl.innerHTML = feeder.maxSource
      ? `<p><span>Longest chain</span><strong>${escapeHtml(feeder.maxSource.name || 'Unknown')} · ${feeder.maxDownstream} downstream</strong></p>`
      : '';
  }
  // Saad visit log: this-month visits, days present and hours worked.
  const saadSummaryEl = $('#saadVisitsSummary');
  if (saadSummaryEl) {
    const summary = buildMonthlySaadSummary(loadSaadVisits(), loadSaadPayments(), pakistanMonthNow(referenceDate));
    const valueEl = $('#dashboardSaadVisitsValue');
    const periodEl = $('#dashboardSaadVisitsPeriod');
    if (valueEl) valueEl.textContent = summary.visits.length === 0 ? 'No visits yet' : `${summary.visits.length} visit${summary.visits.length === 1 ? '' : 's'} · ${summary.dayCount} day${summary.dayCount === 1 ? '' : 's'}`;
    if (periodEl) periodEl.textContent = summary.visits.length === 0 ? 'Saad field visits, hours & payments' : `${formatHours(summary.totalHours)} hours worked · ${summary.grandTotal} PKR paid`;
    saadSummaryEl.innerHTML = summary.visits.length === 0
      ? ''
      : `<p><span>Latest</span><strong>${escapeHtml(summary.visits[summary.visits.length - 1].date)} · ${escapeHtml(visitWhereLabel(summary.visits[summary.visits.length - 1]))} · ${escapeHtml(formatHours(visitHours(summary.visits[summary.visits.length - 1])))} h</strong></p>`;
  }
  // Installation tracker: this-month requests / installed / pending / total delay days.
  const installSummaryEl = $('#installTrackerSummary');
  if (installSummaryEl) {
    const installSummary = buildMonthlyInstallSummary(loadInstallRequests(), pakistanMonthNow(referenceDate), installTrackerToday(referenceDate));
    const installValueEl = $('#dashboardInstallTrackerValue');
    const installPeriodEl = $('#dashboardInstallTrackerPeriod');
    if (installValueEl) installValueEl.textContent = installSummary.requestCount === 0 ? 'No requests yet' : `${installSummary.requestCount} request${installSummary.requestCount === 1 ? '' : 's'} · ${installSummary.installedCount} installed`;
    if (installPeriodEl) installPeriodEl.textContent = installSummary.requestCount === 0 ? 'New connection requests & install delays' : `${installSummary.pendingCount} pending · ${installSummary.totalDelayDays} total delay days`;
    installSummaryEl.innerHTML = installSummary.requestCount === 0
      ? ''
      : `<p><span>Latest</span><strong>${escapeHtml(installSummary.requests[installSummary.requests.length - 1].requestDate)} · ${escapeHtml(installSummary.requests[installSummary.requests.length - 1].requesterName)} · ${escapeHtml(String(installSummary.requests[installSummary.requests.length - 1].amountPaid))} PKR</strong></p>`;
  }
  // Pending works: due reminders + nearest threshold progress.
  const pendingWorksSummaryEl = $('#pendingWorksSummary');
  if (pendingWorksSummaryEl) {
    const pendingSummary = pendingWorksSummary(loadPendingWorks(), countActiveCustomers(state.customers));
    const pendingValueEl = $('#dashboardPendingWorksValue');
    const pendingPeriodEl = $('#dashboardPendingWorksPeriod');
    if (pendingValueEl) pendingValueEl.textContent = pendingSummary.pendingCount === 0 ? 'Nothing pending' : pendingSummary.dueCount > 0 ? `${pendingSummary.dueCount} due now` : `${pendingSummary.pendingCount} pending`;
    if (pendingPeriodEl) pendingPeriodEl.textContent = pendingSummary.nearestLabel ? `Nearest: ${pendingSummary.nearestLabel}` : 'Owner notes & reminders';
    pendingWorksSummaryEl.innerHTML = pendingSummary.dueItems.length === 0
      ? ''
      : `<p><span>⚠️ Due</span><strong>${escapeHtml(pendingSummary.dueItems.map((item) => item.note).join(' · '))}</strong></p>`;
  }
  $('#serviceCountActive').textContent = totals.activeServiceCount;
  $('#serviceCountOffline').textContent = totals.offlineServiceCount;
  $('#serviceCountNotSet').textContent = totals.unsetServiceCount;
  document.querySelector('[data-customer-service-filter="active"]').setAttribute('aria-label',`Active ${totals.activeServiceCount} — Filter by manual service status (${totals.activeServiceCount} unarchived)`);
  document.querySelector('[data-customer-service-filter="offline"]').setAttribute('aria-label',`Offline ${totals.offlineServiceCount} — Filter by manual service status (${totals.offlineServiceCount} unarchived)`);
  document.querySelector('[data-customer-service-filter="not-set"]').setAttribute('aria-label',`Not set ${totals.unsetServiceCount} — Filter by manual service status (${totals.unsetServiceCount} unarchived)`);
  $('#serviceStateCountsAnnouncement').textContent = `Manual service counts, excluding archived profiles: Active ${totals.activeServiceCount} · Offline ${totals.offlineServiceCount} · Not set ${totals.unsetServiceCount}`;
  $('#dashboardTotalCollection').textContent = retainedPayments.length ? formatAmount(totals.totalCollection) : 'No payment entries';
  $('#dashboardTotalDue').textContent = retainedBills.length === 0 ? 'No bill entries' : pricedRetainedBills.length ? formatAmount(totals.totalDue) : 'Not set';
  $('#dashboardTodayCollection').textContent = todayPayments ? formatAmount(totals.todayCollection) : 'No payment entries';
  $('#dashboardCurrentExpenses').textContent = currentCash.expenseCount ? formatAmount(currentCash.expenses) : 'No entries';
  $('#dashboardCurrentExpensesPeriod').textContent = `Actual dated expenses · ${monthName(totals.currentMonth)}`;
  $('#dashboardCashProfit').textContent = currentCash.paymentCount || currentCash.expenseCount ? formatAmount(currentCash.profit) : 'No recorded activity';
  $('#dashboardCashProfitPeriod').textContent = `${formatAmount(currentCash.collection)} actual receipts − ${formatAmount(currentCash.expenses)} recorded expenses`;
  $('#dashboardPreviousCollection').textContent = previousMonthPayments ? formatAmount(totals.previousMonthCollection) : 'No payment entries';
  $('#dashboardCurrentMonthDue').textContent = currentBills.length === 0 ? 'No bill entries' : pricedCurrentBills.length ? formatAmount(totals.currentMonthDue) : 'Not set';
  $('#dashboardPendingCredit').textContent = allPayments.length ? formatAmount(totals.pendingCredit) : 'No credit entries';
  $('#dashboardExpectedProfit').textContent = profilesWithProfit ? formatAmount(totals.expectedMonthlyPackageProfit) : 'Not set';
  $('#dashboardProviderCost').textContent = profilesWithCost ? formatAmount(totals.expectedMonthlyProviderCost) : 'Not set';
  $('#dashboardCustomerPeriod').textContent = `${totals.archivedCustomers} archived · ${totals.totalCustomers} unarchived profiles; service state is manual`;
  $('#dashboardProviderCostPeriod').textContent = profilesWithCost ? 'Expected recurring monthly cost · not cash paid' : 'No provider-cost entries · not cash paid';
  $('#providerCostBreakdownList').innerHTML = totals.providerCostBreakdown.map(group => `<li><span class="provider-breakdown-name">${escapeHtml(group.provider)}</span><strong>${escapeHtml(formatAmount(group.expectedMonthlyCost))}</strong><span class="provider-breakdown-meta">${group.profilesWithCost} cost${group.profilesWithCost === 1 ? '' : 's'} entered · ${group.profilesMissingCost} missing</span></li>`).join('');
  $('#providerCostBreakdownEmpty').hidden = totals.providerCostBreakdown.length > 0;
  $('#dashboardTotalCollectionPeriod').textContent = retainedPayments.length ? `Actual recorded payments · last ${MONTH_LIMIT} retained billing months` : 'No actual payment entries in the retained history';
  $('#dashboardTotalDuePeriod').textContent = retainedBills.length ? `Known outstanding bills · retained ${MONTH_LIMIT}-month history` : 'No bills have been recorded in the retained history';
  $('#dashboardTodayPeriod').textContent = `Actual payments dated today · ${totals.today}`;
  $('#dashboardPreviousPeriod').textContent = `Actual payment dates in ${monthName(totals.previousMonth)}`;
  $('#dashboardCurrentDuePeriod').textContent = `Current billing month · ${monthName(totals.currentMonth)}${currentBills.length ? '' : ' · no bill entries'}`;
  $('#dashboardExpectedProfitPeriod').textContent = 'Selling amount − provider cost · expected margin, not collected cash profit';
  const notes = [];
  if (totals.customersMissingSellingAmount) notes.push(`Selling amount unset for ${plural(totals.customersMissingSellingAmount, 'customer')}; no monthly bills are generated until a price is entered.`);
  if (totals.unpricedBillCount) notes.push(`${plural(totals.unpricedBillCount, 'pending bill')} without a recorded amount are excluded from due totals.`);
  if (totals.incompleteProfitProfiles) notes.push(`Profit not set for ${plural(totals.incompleteProfitProfiles, 'profile')} missing a selling amount or provider cost; excluded from expected package profit.`);
  if (totals.customersMissingProviderCost) notes.push(`Provider cost not set for ${plural(totals.customersMissingProviderCost, 'active profile')}; excluded from expected monthly provider cost.`);
  $('#dashboardExcludedAmounts').textContent = notes.length ? notes.join(' ') : 'Dues use each saved month’s bill snapshot after receipts and carry-forward credit; credits are not new cash.';

  const kpis = calculateDashboardKpis(state, referenceDate);
  const activeSubscribersEl = $('#dashboardActiveCustomers');
  if (activeSubscribersEl) {
    activeSubscribersEl.textContent = `${kpis.activeSubscribers} (${kpis.activePercent}%)`;
    $('#dashboardActiveCustomersPeriod').textContent = `${kpis.offlineSubscribers} offline · ${kpis.unsetSubscribers} not set`;
  }
  const billStatusEl = $('#dashboardMonthBillStatus');
  if (billStatusEl) {
    if (kpis.totalCurrentMonthBills === 0) {
      billStatusEl.textContent = 'No bill entries';
      $('#dashboardMonthBillStatusPeriod').textContent = 'No bills recorded for current month';
    } else {
      billStatusEl.textContent = `${kpis.paidBillsCount} paid · ${kpis.unpaidBillsCount} unpaid`;
      $('#dashboardMonthBillStatusPeriod').textContent = `${kpis.partialBillsCount} partial · ${kpis.totalCurrentMonthBills} total bills in ${monthName(totals.currentMonth)}`;
    }
  }
  const billedRevenueEl = $('#dashboardCurrentMonthBilled');
  if (billedRevenueEl) {
    billedRevenueEl.textContent = kpis.currentMonthBilled > 0 ? formatAmount(kpis.currentMonthBilled) : 'No bill entries';
    $('#dashboardCurrentMonthBilledPeriod').textContent = kpis.collectionRate !== null ? `Collection rate ${kpis.collectionRate}% of billed amount` : `Priced snapshots · ${monthName(totals.currentMonth)}`;
  }
  const monthCollectionEl = $('#dashboardCurrentMonthCollection');
  if (monthCollectionEl) {
    monthCollectionEl.textContent = currentCash.paymentCount ? formatAmount(kpis.currentMonthCollection) : 'No payment entries';
    $('#dashboardCurrentMonthCollectionPeriod').textContent = `${currentCash.paymentCount} receipt${currentCash.paymentCount === 1 ? '' : 's'} dated in ${monthName(totals.currentMonth)}`;
  }
  const newConnEl = $('#dashboardNewConnections');
  if (newConnEl) {
    newConnEl.textContent = String(kpis.newConnectionsCount);
    $('#dashboardNewConnectionsPeriod').textContent = `Recorded in ${monthName(totals.currentMonth)}`;
  }
  const velocity = calculateCollectionVelocity(state, referenceDate);
  const velocityValEl = $('#dashboardCollectionVelocity');
  if (velocityValEl) {
    velocityValEl.textContent = `${formatAmount(velocity.dailyRunRate)} / day`;
    $('#dashboardCollectionVelocityPeriod').textContent = velocity.projectedRate !== null
      ? `Projected: ${formatAmount(velocity.projectedMonthEnd)} (${velocity.projectedRate}% of billed) · ${velocity.daysRemaining} days left`
      : `Day ${velocity.currentDay} of ${velocity.daysInMonth} · ${velocity.daysRemaining} days remaining`;
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
    if (discAmtEl) discAmtEl.textContent = `${formatAmount(wData.kpis.toDisconnectTotalAmount)} dues (> ${wData.rules.disconnectOverdueDays}d)`;
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
      kpiRateSub.textContent = kpis.collectionRate !== null ? `${kpis.collectionRate}% collected` : '0% collected';
    }
  }
  const kpiDuesEl = $('#kpiTotalDue');
  if (kpiDuesEl) {
    kpiDuesEl.textContent = retainedBills.length === 0 ? 'PKR 0' : pricedRetainedBills.length ? formatAmount(totals.totalDue) : 'Not set';
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
    kpiDefaultersEl.textContent = `${defaultersCount} customer${defaultersCount === 1 ? '' : 's'}`;
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
  const monthLabel = tenure.serviceMonths === 1 ? '1 calendar month' : `${tenure.serviceMonths} calendar months`;
  if (tenure.status === 'current') return { primary:monthLabel, detail:`Connected since ${humanDate(tenure.connectionDate)}` };
  if (tenure.status === 'ended') return { primary:monthLabel, detail:`Service ended ${humanDate(tenure.endDate)}` };
  if (tenure.status === 'future') return { primary:'Not started', detail:`Recorded connection date ${humanDate(tenure.connectionDate)}` };
  if (tenure.status === 'end-date-unknown') return { primary:'End date not recorded', detail:`Connected since ${humanDate(tenure.connectionDate)} · duration unavailable` };
  if (tenure.status === 'date-review') return { primary:'Check connection dates', detail:`Saved end date ${humanDate(tenure.endDate)} is before connection` };
  return { primary:'Not recorded', detail:tenure.profileAddedOn ? `Profile added ${humanDate(tenure.profileAddedOn)} · ISP start not recorded` : 'Connection date not recorded' };
}
function profileReceiptSummaryMarkup(customer) {
  const receipts = summarizeCustomerReceipts(customer);
  const tenure = tenurePresentation(customer);
  const allocations = calculatePaymentAllocations(state);
  const behavior = buildCustomerPaymentBehavior(state, customer, new Date(), allocations);
  const health = behavior?.health;
  const pendingCreditCents = [...allocations.byPaymentId.values()].filter(row => row.customerId === customer.id).reduce((sum,row) => sum + (row.unappliedCreditCents ?? 0), 0);
  const receiptRows = receipts.monthly.map(row => `<li class="receipt-month-row"><span>${escapeHtml(monthName(row.month))}</span><strong>${escapeHtml(formatAmount(row.amount))}</strong><small>${plural(row.receiptCount, 'receipt')}</small></li>`).join('');
  const lastPayment = behavior?.receipts[0] ?? null;
  const scoreText = health?.score === null || health?.score === undefined ? 'Insufficient history' : `${health.score}/100 · ${health.category}`;
  const scoreReasons = (health?.reasons ?? []).map(reason => `<li>${escapeHtml(reason)}</li>`).join('');
  const behaviorCards = behavior ? `<article class="profile-summary-stat"><span>Outstanding · all saved bills</span><strong>${escapeHtml(formatAmount(behavior.totalOutstanding))}</strong><small>Credit is tracked separately.</small></article><article class="profile-summary-stat"><span>Unused advance / credit</span><strong>${pendingCreditCents ? escapeHtml(formatAmount(pendingCreditCents / 100)) : 'None recorded'}</strong><small>Prepaid receipt balance not yet applied.</small></article><article class="profile-summary-stat"><span>Average monthly actual payment</span><strong>${behavior.averageMonthlyPayment===null?'Not calculable':escapeHtml(formatAmount(behavior.averageMonthlyPayment))}</strong><small>${escapeHtml(behavior.averageMonthlyPaymentBasis)}</small></article><article class="profile-summary-stat"><span>Average settlement delay</span><strong>${behavior.averagePaymentDelayDays===null?'Not recorded':`${behavior.averagePaymentDelayDays} days`}</strong><small>${behavior.delaySampleCount} saved due-date/settlement pair(s).</small></article><article class="profile-summary-stat"><span>Payment range</span><strong>${behavior.highestPayment===null?'Not recorded':`${escapeHtml(formatAmount(behavior.lowestPayment))}–${escapeHtml(formatAmount(behavior.highestPayment))}`}</strong><small>Lowest to highest actual receipt.</small></article><article class="profile-summary-stat"><span>Late / partial payments</span><strong>${behavior.latePaymentCount} / ${behavior.partialPaymentCount}</strong><small>${behavior.totalPayments} actual receipt(s) in history.</small></article><article class="profile-summary-stat"><span>Payment consistency</span><strong>${behavior.paymentConsistency===null?'Insufficient history':`${behavior.paymentConsistency}%`}</strong><small>${behavior.consistencySettledMonths}/${behavior.consistencyBillMonths} completed priced months settled.</small></article><article class="profile-summary-stat"><span>Last payment</span><strong>${lastPayment?escapeHtml(formatAmount(lastPayment.amount)):'Not recorded'}</strong><small>${lastPayment?`${escapeHtml(humanDate(lastPayment.date))} · actual receipt`: 'No actual receipts recorded.'}</small></article>` : '';
  return `<section class="customer-receipt-summary" aria-label="Customer 360: receipts, credit, payment behavior and health"><div class="profile-summary-grid"><article class="profile-summary-stat profile-summary-receipts"><span>Total actually received</span><strong>${receipts.receiptCount ? escapeHtml(formatAmount(receipts.total)) : 'No receipts recorded'}</strong><small>${receipts.receiptCount ? `${plural(receipts.receiptCount, 'recorded receipt')} · across all saved months` : 'Bills and charges are not counted as receipts.'}</small></article><article class="profile-summary-stat profile-summary-tenure"><span>Time with ISP</span><strong>${escapeHtml(tenure.primary)}</strong><small>${escapeHtml(tenure.detail)}</small></article>${behaviorCards}</div><section class="customer-health-summary" aria-label="Customer health score"><strong>Health: ${escapeHtml(scoreText)}</strong><details><summary>Why this score / history basis</summary><ul>${scoreReasons || '<li>No score reasons are available.</li>'}</ul></details></section><div class="receipt-month-history"><div class="receipt-month-heading"><strong>Receipts by payment month</strong><span>Grouped by actual payment date · bill amounts excluded</span></div>${receiptRows ? `<ul class="receipt-month-list" aria-label="Actual receipts by payment month">${receiptRows}</ul>` : '<p class="receipt-month-empty">No actual receipt entries have been recorded.</p>'}</div></section>`;
}
function customerCardMarkup(customer, archived = false, allocations = calculatePaymentAllocations(state)) {
  const receipts = summarizeCustomerReceipts(customer);
  const tenure = tenurePresentation(customer);
  const monthBill = (customer.bills ?? []).find(bill => bill.month === selectedBillingMonth);
  const billing = statusPresentation(customer, monthBill);
  const isFeeSet = customer.monthlySellingAmount !== null && customer.monthlySellingAmount !== undefined && Number(customer.monthlySellingAmount) > 0;
  const chipText = isFeeSet
    ? (billing.value === 'not-set' ? `Rs ${customer.monthlySellingAmount}/mo` : `${billing.label} · Rs ${customer.monthlySellingAmount}/mo`)
    : (billing.value === 'not-set' ? 'Bill not set' : `${billing.label}`);
  const billingLabel = `${monthName(selectedBillingMonth)} bill: ${chipText}`;
  const manualStatus = manualServiceStatusLabel(customer.serviceStatus);
  const health = buildCustomerHealthScore(state, customer, new Date(), allocations);
  const healthLabel = health?.score === null || !health ? 'Health · insufficient history' : `Health · ${health.score}/100 · ${health.category}`;
  const healthReasons = (health?.reasons ?? []).map(reason => `<li>${escapeHtml(reason)}</li>`).join('');
  const receiptValue = receipts.receiptCount ? formatAmount(receipts.total) : 'No receipts';
  const receiptCount = receipts.receiptCount ? plural(receipts.receiptCount, 'recorded receipt') : 'No payment entries';
  const openLabel = `Open customer profile for #${customer.customerNumber}, ${customer.name}. Total actual receipts: ${receiptValue}. ${healthLabel}. Time with ISP: ${tenure.primary}. ${tenure.detail}.`;
  const serviceButtons = ['active','offline','not-set'].map(status => {
    const label = ({ active:'Active', offline:'Offline', 'not-set':'Not set' })[status];
    const selected = status === customer.serviceStatus;
    return `<button class="service-choice service-choice-${status} ${selected ? 'is-selected' : ''}" type="button" data-set-service="${escapeHtml(customer.id)}" data-service-status="${status}" aria-pressed="${selected}" aria-label="Set customer ${customer.customerNumber} manual service status to ${label}">${label}</button>`;
  }).join('');
  return `<li class="customer-item ${archived ? 'archived-customer-item' : ''}"><button class="customer-select customer-profile-card-open" type="button" data-customer-id="${escapeHtml(customer.id)}" aria-current="${customer.id === selectedCustomerId}" title="${escapeHtml(openLabel)}"><span class="customer-card-heading"><span class="avatar" aria-hidden="true">${escapeHtml(initials(customer.name))}</span><span class="customer-copy"><span class="customer-number-line">#${customer.customerNumber}${archived ? ' · Archived' : ''}</span><span class="customer-name" dir="auto">${escapeHtml(displayCustomerName(customer, currentAppLanguage()))}</span></span><span class="customer-manual-state">${escapeHtml(manualStatus)}</span></span><span class="customer-card-stats"><span class="customer-card-stat"><span>Actually received</span><strong>${escapeHtml(receiptValue)}</strong><small>${escapeHtml(receiptCount)}</small></span><span class="customer-card-stat"><span>Time with ISP</span><strong>${escapeHtml(tenure.primary)}</strong><small>${escapeHtml(tenure.detail)}</small></span></span><span class="customer-card-package">${escapeHtml(customer.packageSpeed || 'Package not set')}</span><span class="customer-health-badge health-${escapeHtml((health?.category??'unknown').toLowerCase().replaceAll(' ','-'))}">${escapeHtml(healthLabel)}</span><span class="customer-card-open-hint">Open full profile and monthly billing history <span aria-hidden="true">→</span></span></button><details class="customer-health-reasons"><summary>Health reasons</summary><ul>${healthReasons || '<li>Not enough completed priced months for an automatic score.</li>'}</ul></details><div class="customer-card-controls"><span role="button" tabindex="0" class="customer-billing-badge ${billing.className} ${isFeeSet ? 'has-fee' : 'no-fee'}" data-inline-bill-edit="${escapeHtml(customer.id)}" data-bill-unset="${!isFeeSet}" aria-label="${escapeHtml(chipText)} — Billing status for ${escapeHtml(monthName(selectedBillingMonth))}: ${billing.label}. Click to ${isFeeSet ? 'edit' : 'set'} monthly bill inline.">${escapeHtml(chipText)}</span><div class="service-choice-group" role="group" aria-label="Manual service status for customer ${customer.customerNumber}, ${escapeHtml(customer.name)}">${serviceButtons}</div></div>${archived ? `<button class="archived-unarchive-button" type="button" data-unarchive-customer="${escapeHtml(customer.id)}">Unarchive</button>` : ''}</li>`;
}
let customerCurrentPage = 1;
let customerPageSize = 15;
let customerSortBy = 'number-asc';
let customerAreaFilter = 'all';
let customerViewMode = (typeof localStorage !== 'undefined' && localStorage.getItem('shahdara_customer_view_mode')) || 'cards';

// New-customers panel (customer ledger): view-only monthly join counts and
// onboarding totals over saved customers. Join months come from
// buildNewCustomerReport; this function never rewrites any saved value.
function renderNewCustomersPanel() {
  const mount = $('#newCustomersPanel');
  if (!mount) return;
  const report = buildNewCustomerReport(state.customers, new Date());
  const ranges = newCustomerQuickRanges(new Date());
  let shown = [];
  let heading = '';
  if (newCustomersView === 'month' && newCustomersMonth) {
    shown = report.months.filter(entry => entry.month === newCustomersMonth);
    heading = monthName(newCustomersMonth);
  } else {
    if (!ranges[newCustomersView]) newCustomersView = 'thisMonth';
    const range = ranges[newCustomersView];
    shown = filterNewCustomerMonths(report.months, range.start, range.end);
    heading = range.start === range.end
      ? `${range.label} · ${monthName(range.start)}`
      : `${range.label} · ${monthName(range.start)} – ${monthName(range.end)}`;
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
    if (customer.connectionFee !== null && customer.connectionFee !== undefined && Number(customer.connectionFee) > 0) onboarding.push(`Fee ${formatAmount(customer.connectionFee)}`);
    if (String(customer.routerModel ?? '').trim()) onboarding.push(`Router ${escapeHtml(customer.routerModel)}${customer.routerPrice !== null && customer.routerPrice !== undefined && Number(customer.routerPrice) > 0 ? ` (${formatAmount(customer.routerPrice)})` : ''}`);
    if (customer.fiberMeters !== null && customer.fiberMeters !== undefined && Number(customer.fiberMeters) > 0) onboarding.push(`${customer.fiberMeters} m fiber`);
    // SISP-23: per-installation subsidy/surplus badge on the ledger row.
    const installCost = calculateInstallationCost(customer);
    if (installCost.status === 'surplus') onboarding.push(`Install: net surplus ${formatAmount(installCost.net)}`);
    else if (installCost.status === 'subsidy') onboarding.push(`Install: ISP subsidy ${formatAmount(installCost.subsidy)}${installCost.breakEvenMonths !== null ? ` · break-even ${installCost.breakEvenMonths} bill${installCost.breakEvenMonths === 1 ? '' : 's'}` : ''}`);
    else if (installCost.status === 'break-even') onboarding.push('Install: break-even');
    else if (installCost.status === 'unknown') onboarding.push(`Install cost ${formatAmount(installCost.totalCost)} · fee not recorded`);
    return `<li><button class="new-customer-row" type="button" data-customer-id="${escapeHtml(customer.id)}"><span class="new-customer-name">#${escapeHtml(customer.customerNumber)} ${escapeHtml(customer.name)}</span><span class="new-customer-meta">${escapeHtml(customer.mohalla || 'Area not set')} · joined ${escapeHtml(entry.month)}</span><span class="new-customer-onb">${onboarding.length ? onboarding.join(' · ') : 'Onboarding details not recorded'}</span></button></li>`;
  })).join('');
  const monthOptions = report.months.map(entry => `<option value="${escapeHtml(entry.month)}"${entry.month === newCustomersMonth ? ' selected' : ''}>${escapeHtml(monthName(entry.month))} (${entry.totals.count})</option>`).join('');
  mount.innerHTML = `<div class="new-customers-head"><div><p class="eyebrow">NEW CUSTOMERS</p><h3>New customers by month</h3></div><p class="new-customers-heading">${escapeHtml(heading)}</p></div>`
    + `<div class="new-customers-controls" role="group" aria-label="New-customer quick views">`
    + Object.entries(ranges).map(([key, range]) => `<button class="customer-filter-button" type="button" data-newcust-view="${key}" aria-pressed="${newCustomersView === key ? 'true' : 'false'}">${range.label}</button>`).join('')
    + `<label class="new-customers-month" for="newCustomersMonthSelect">Month <select id="newCustomersMonthSelect"><option value="">Choose a month…</option>${monthOptions}</select></label></div>`
    + `<div class="new-customers-totals" role="status"><span><strong>${totals.count}</strong> new customers</span><span>Connection fees <strong>${formatAmount(totals.connectionFees)}</strong></span><span><strong>${totals.routersIssued}</strong> routers · <strong>${formatAmount(totals.routerTotal)}</strong></span><span>Fiber <strong>${totals.fiberMeters} m</strong></span></div>`
    + (rows ? `<ul class="new-customers-list">${rows}</ul>` : `<p class="new-customers-empty">No new customers in this view.</p>`)
    + `<p class="new-customers-note">Join counts include customers archived later.${report.undatedCount ? ` ${report.undatedCount} customer${report.undatedCount === 1 ? '' : 's'} have no join date (added before dates were recorded) and are not counted in any month.` : ''}</p>`;
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
    const areas = getUniqueCustomerAreas(state.customers.filter(c => !c.archived));
    const currentVal = customerAreaFilter;
    areaSelect.innerHTML = '<option value="all">All areas</option>' + areas.map(a => `<option value="${escapeHtml(a)}"${a === currentVal ? ' selected' : ''}>${escapeHtml(a)}</option>`).join('');
    if (!areas.includes(currentVal) && currentVal !== 'all') {
      customerAreaFilter = 'all';
      areaSelect.value = 'all';
    } else {
      areaSelect.value = customerAreaFilter;
    }
  }

  const sortSelect = $('#customerSortSelect');
  if (sortSelect) sortSelect.value = customerSortBy;

  let filtered = filterCustomersByStatus(state, { serviceStatus:selectedServiceFilter, billingStatus:selectedBillingFilter, month:selectedBillingMonth, customerQuery });
  if (customerAreaFilter !== 'all') {
    filtered = filterCustomersByArea(filtered, customerAreaFilter);
  }

  let active = filtered.filter(customer => !customer.archived);
  let archived = filtered.filter(customer => customer.archived);

  // Apply Sorting
  active = sortCustomerRoster(active, { sortBy: customerSortBy, billingMonth: selectedBillingMonth, allocations: healthAllocations });
  archived = sortCustomerRoster(archived, { sortBy: customerSortBy, billingMonth: selectedBillingMonth, allocations: healthAllocations });

  const searched = searchCustomers(state, customerQuery);
  const activeTotal = searched.filter(customer => !customer.archived).length;
  const archivedTotal = searched.filter(customer => customer.archived).length;

  // Pagination for Active Roster
  const paged = paginateRows(active, customerCurrentPage, customerPageSize);
  customerCurrentPage = paged.page;

  const pagNav = $('#customerPagination');
  if (pagNav) {
    pagNav.hidden = active.length === 0;
    const pageInfo = $('#customerPageInfo');
    if (pageInfo) pageInfo.textContent = `Page ${paged.page} of ${paged.totalPages} (${active.length} total)`;
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
    emptySearch.textContent = customerQuery.trim() || customerAreaFilter !== 'all' ? 'No matching customers.' : 'No customers match these service and billing filters.';
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
  const views = { customers:['customersView','showCustomersButton'], transactions:['transactionsView','showTransactionsButton'], reports:['billingReportsView','showReportsButton'], analytics:['analyticsView','showAnalyticsButton'], inventory:['inventoryView','showInventoryButton'], expenses:['expensesView','showExpensesButton'] };
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
    paid:{ label:'Paid', className:'status-received', value },
    pending:{ label:'Pending', className:'status-pending', value },
    partial:{ label:'Partial', className:'status-partial', value },
    'not-set':{ label:'Not set', className:'status-empty', value }
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
function receiptWhatsAppActionMarkup(customer, receipt, { askLabel = null } = {}) {
  const action = resolveReceiptWhatsAppAction(customer, receipt);
  if (action.type === 'phone-required') {
    // #298: in the payments list the button says "WhatsApp receipt" and asks for the number only when tapped.
    const label = askLabel || (action.hasSavedPhone ? 'Update WhatsApp number' : 'Add WhatsApp number');
    return `<button class="receipt-phone-help" type="button" data-edit-receipt-phone="${escapeHtml(customer.id)}" aria-label="${label} for customer #${escapeHtml(customer.customerNumber)} ${escapeHtml(customer.name)} before preparing this receipt" title="Use this customer's full international number including country code.">${label}</button>`;
  }
  if (action.type !== 'draft') return '<span class="whatsapp-receipt-unavailable">Receipt draft unavailable for this customer.</span>';
  return `<span class="receipt-whatsapp-action-wrap"><a class="receipt-whatsapp-action" href="${escapeHtml(action.draft.url)}" target="_blank" rel="noopener noreferrer" aria-label="Review WhatsApp receipt draft for customer #${escapeHtml(customer.customerNumber)} ${escapeHtml(customer.name)}; an internet connection is required to open WhatsApp; it will not send automatically" title="Draft prepared locally; internet is required to open WhatsApp.">WhatsApp receipt</a><small class="receipt-network-note">Internet required to open WhatsApp.</small></span>`;
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
  return `<details class="bill-audit"><summary>Bill amount corrections (${changes.length})</summary><ol>${items}</ol></details>`;
}
function billPackageSelectorMarkup(bill, month) {
  const savedPlan = validateBillPackageSnapshot(bill?.packageSnapshot);
  const options = BILL_PACKAGES.map(plan => `<option value="${plan.id}" ${savedPlan?.packageId === plan.id ? 'selected' : ''}>${escapeHtml(plan.label)} — ${escapeHtml(formatAmount(plan.price))} / month</option>`).join('');
  return `<label class="field-label full" for="package-${month}">Monthly package <span class="optional-label">Optional · six preset rates</span></label><select id="package-${month}" class="full" name="packageId" data-bill-package aria-describedby="package-help-${month}"><option value="" ${savedPlan ? '' : 'selected'}>No preset package — enter amount manually</option>${options}</select><p id="package-help-${month}" class="field-help full">A preset stores its exact label, speed, nominal price, type and applicable cap on this bill only. It does not change the customer profile or future recurring rate. Actual payments stay separate; older bills are never inferred or backfilled.</p>`;
}
function renderHistory(customer) {
  const monthList = monthsForHistory();
  const byMonth = new Map(customer.bills.map(bill => [bill.month, bill]));
  const allocations = calculatePaymentAllocations(state);
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
    const displayAmount = effectiveAmount === null || effectiveAmount === undefined ? 'Not recorded' : formatAmount(effectiveAmount);
    const monthAllocation = allocations.forMonth(customer.id, month);
    const balanceDue = monthAllocation?.balanceDueCents === null || monthAllocation?.balanceDueCents === undefined ? 'Not set' : formatAmount(monthAllocation.balanceDueCents / 100);
    const creditApplied = formatAmount((monthAllocation?.creditAppliedCents ?? 0) / 100);
    const activeHistoryMonths = new Set(monthList);
    const creditSourceMarkup = (monthAllocation?.creditSources ?? []).map(source => {
      const aged = !activeHistoryMonths.has(source.originMonth);
      const sourceControls = aged ? `<span class="carry-source-actions"><button class="edit-payment" type="button" data-edit-payment="${escapeHtml(source.paymentId)}" data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(source.originMonth)}" aria-label="Edit aged credit source receipt dated ${escapeHtml(source.paymentDate)}">Edit source receipt</button><button class="delete-payment" type="button" data-delete-payment="${escapeHtml(source.paymentId)}" data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(source.originMonth)}" aria-label="Delete aged credit source receipt dated ${escapeHtml(source.paymentDate)}">Delete source receipt</button></span>` : '';
      return `<div class="carry-credit-source" ${aged ? `data-payment-row="${escapeHtml(source.paymentId)}"` : ''}><span>From ${escapeHtml(monthName(source.originMonth))} receipt dated ${escapeHtml(humanDate(source.paymentDate))} · ${escapeHtml(source.method)} · original receipt ${escapeHtml(formatAmount(source.receiptAmount))} · applied here ${escapeHtml(formatAmount(source.amountCents / 100))}</span>${sourceControls}</div>`;
    }).join('');
    const generatedNote = bill?.generated && bill.priceSnapshot !== null && bill.priceSnapshot !== undefined ? `<p class="bill-snapshot-note">Auto-generated from the saved selling price: ${escapeHtml(formatAmount(bill.priceSnapshot))}. This month’s snapshot stays unchanged if the price is edited later.</p>` : '';
    const payments = (bill?.payments ?? []).map(payment => {
      const allocation = paymentAllocationMarkup(allocations.byPaymentId.get(payment.id));
      const receiptData = buildPaymentReceipt(customer, bill, payment);
      const discountMarkup = (payment.discount && Number(payment.discount) > 0) ? ` <span class="discount-badge-applied">-${formatAmount(payment.discount)} discount${payment.discountReason ? ` (${escapeHtml(payment.discountReason)})` : ''}</span>` : '';
      return `<li class="payment-row" data-payment-row="${escapeHtml(payment.id)}"><span class="payment-main"><span class="payment-amount">${escapeHtml(formatAmount(payment.amount))} actual receipt${discountMarkup}</span><span class="payment-meta">${escapeHtml(humanDate(payment.date))} · ${escapeHtml(payment.method)}${paymentPayerMarkup(payment)}</span>${allocation}</span><span class="payment-actions">${receiptWhatsAppActionMarkup(customer, { customerId:customer.id, date:payment.date, amount:payment.amount, method:payment.method, paidBy:payment.paidBy, month, paymentId:payment.id, billStatus:receiptData.status === 'PAID' ? 'paid' : receiptData.status === 'PARTIAL' ? 'partial' : null, billAmount:receiptData.nominalPrice, balanceDueCents:receiptData.balanceDueCents, billDueDate:bill?.dueDate ?? null, arrearsBreakdown:buildArrearsBreakdown(customer, bill) })}<button class="print-receipt-button" type="button" data-print-receipt data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(month)}" data-payment-id="${escapeHtml(payment.id)}" aria-label="Print receipt for customer ${customer.customerNumber}, payment dated ${escapeHtml(payment.date)}">Print receipt</button><button class="print-receipt-button thermal-receipt-button" type="button" data-print-thermal-receipt data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(month)}" data-payment-id="${escapeHtml(payment.id)}" aria-label="Print 80mm thermal slip for customer ${customer.customerNumber}">80mm slip</button><button class="print-receipt-button thermal58-receipt-button" type="button" data-print-thermal58-receipt data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(month)}" data-payment-id="${escapeHtml(payment.id)}" aria-label="Print 58mm thermal slip for customer ${customer.customerNumber}">58mm slip</button><button class="print-receipt-button png-receipt-button" type="button" data-png-receipt data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(month)}" data-payment-id="${escapeHtml(payment.id)}" aria-label="Download or share PNG receipt for customer ${customer.customerNumber}">PNG receipt</button>${bluetoothReceiptButtonMarkup(customer.id, month, payment.id, customer.customerNumber)}<button class="edit-payment" type="button" data-edit-payment="${escapeHtml(payment.id)}" data-customer-id="${escapeHtml(customer.id)}" data-month="${month}" aria-label="Edit payment for customer ${customer.customerNumber}">Edit</button><button class="delete-payment" type="button" data-delete-payment="${escapeHtml(payment.id)}" data-customer-id="${escapeHtml(customer.id)}" data-month="${month}" aria-label="Delete payment for customer ${customer.customerNumber}">Delete</button></span></li>`;
    }).join('');
    const statusValue = status.value;
    const due = bill?.dueAmount ?? '';
    const hasPartial = statusValue === 'partial';
    const lateFeeMarkup = bill?.lateFee ? `<span class="month-summary-wide">Late fee surcharge (PKR): <strong class="late-fee-badge-applied">+${formatAmount(bill.lateFee)}</strong> <small>(${escapeHtml(bill.lateFeeReason || 'Owner surcharge')})</small> <button type="button" class="waive-late-fee-btn" data-waive-late-fee data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(month)}" title="Waive late fee">Waive</button></span>` : '';
    const overdueEligible = bill && bill.dueDate && isBillOverdue(bill).isOverdue && (monthAllocation?.balanceDueCents ?? 0) > 0 && !bill.lateFee;
    const applyFeeBtnMarkup = overdueEligible ? `<span class="month-summary-wide"><button type="button" class="apply-late-fee-btn" data-apply-late-fee data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(month)}" title="Apply owner configured late fee">Apply Late Fee (+PKR ${getLateFeeConfig().defaultAmount})</button></span>` : '';
    const summaryMarkup = !bill ? '<p class="empty-month">No billing details recorded for this month.</p>' : `<div class="month-summary"><span class="month-summary-stat">Status: <strong>${status.label}</strong></span><span class="month-summary-stat">Optional due date (PKT): <strong>${bill.dueDate ? escapeHtml(humanDate(bill.dueDate)) : 'Not set · no due-date rule or penalty applied'}</strong></span><span class="month-summary-stat">Actual receipts (PKR cash): <strong>${formatAmount(received)}</strong></span><span class="month-summary-stat">Carry-in credit (PKR, not new cash): <strong>${creditApplied}</strong></span>${creditSourceMarkup}<span class="month-summary-stat">Bill amount (PKR): <strong>${escapeHtml(displayAmount)}</strong></span>${lateFeeMarkup}${applyFeeBtnMarkup}<span class="month-summary-stat">Balance due (PKR): <strong>${escapeHtml(balanceDue)}</strong></span>${monthAllocation?.excessGeneratedCents ? `<span class="month-summary-stat">Credit from this month’s receipts (PKR): <strong>${formatAmount(monthAllocation.excessGeneratedCents / 100)}</strong></span>` : ''}${monthAllocation?.creditForwardedCents ? `<span class="month-summary-stat">Credit applied to later bills (PKR): <strong>${formatAmount(monthAllocation.creditForwardedCents / 100)}</strong></span>` : ''}${monthAllocation?.pendingCreditCents ? `<span class="month-summary-stat">Credit waiting for the next generated bill (PKR): <strong>${formatAmount(monthAllocation.pendingCreditCents / 100)}</strong></span>` : ''}${hasPartial ? '<span class="month-status status-pending month-summary-wide">Partial payment / credit</span>' : ''}</div>${generatedNote}${billAmountAuditMarkup(bill)}`;
    const amountRequired = bill ? '' : 'required';
    const amountLabel = bill ? 'Optional' : 'Required to create a bill';
    const amountPlaceholder = bill ? 'Leave blank only if not known' : 'Enter confirmed amount in PKR';
    const savedPackage = validateBillPackageSnapshot(bill?.packageSnapshot);
    const packageSelector = billPackageSelectorMarkup(bill, month);
    const archivedWithoutBill = customer.archived && !bill;
    const formsMarkup = archivedWithoutBill ? '<p class="notice">Archived customers do not receive new monthly bills or payments. Unarchive this customer to resume billing.</p>' : `<div class="month-forms"><form class="form-card bill-form" data-kind="bill" data-month="${month}"><h4>${bill ? 'Update bill details' : 'Record confirmed bill details'}</h4><div class="form-grid">${packageSelector}<div class="form-cell"><label class="field-label full" for="due-${month}">Bill amount (PKR) <span class="optional-label">${amountLabel}</span></label><input id="due-${month}" class="full" name="dueAmount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="${amountPlaceholder}" value="${escapeHtml(due)}" ${amountRequired} ${savedPackage ? 'readonly' : ''}></div><div class="form-cell"><label class="field-label full" for="due-date-${month}">Optional due date (Pakistan local date)</label><input id="due-date-${month}" class="full" name="dueDate" type="date" value="${escapeHtml(bill?.dueDate ?? '')}"></div><p class="field-help full">No due-date rule or late fees are applied automatically.</p><button class="primary-button" type="submit">${bill ? 'Save bill details' : 'Record this month'}</button></div></form><form class="form-card payment-form" data-kind="payment" data-month="${month}"><h4>Record an actual payment</h4><p class="field-help payment-guidance" id="payment-guidance-${month}" role="status">Enter the actual collected amount, payment date and method. Nothing is saved until you submit this form.</p><div class="form-grid"><div class="form-cell"><label class="field-label full" for="amount-${month}">Amount received (PKR)</label><input id="amount-${month}" class="full" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Enter actual amount" required></div><div class="form-cell"><label class="field-label full" for="method-${month}">Payment method</label><select id="method-${month}" class="full" name="method" required><option value="">Choose a method</option>${PAYMENT_METHODS.map(method => `<option value="${method}">${method}</option>`).join('')}</select></div><div class="form-cell">${paidByFieldMarkup(`paid-by-${month}`)}</div><div class="form-cell"><label class="field-label full" for="date-${month}">Payment date (Pakistan local date)</label><input id="date-${month}" class="full" name="date" type="date" max="${localDate()}" required></div><div class="form-cell"><label class="field-label full" for="txnid-${month}">Transaction ID / Ref (for digital payments) <span class="optional-label">Optional</span></label><input id="txnid-${month}" class="full" name="transactionId" type="text" maxlength="64" placeholder="e.g. 1234567890 (Raast / JazzCash / Easypaisa)"></div><div class="form-cell"><label class="field-label full" for="discount-${month}">Discount / Concession (PKR) <span class="optional-label">Optional · waives balance</span></label><input id="discount-${month}" class="full" name="discount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0 (No discount)"></div><label class="field-label full" for="discount-reason-${month}">Discount reason <span class="optional-label">Optional</span></label><input id="discount-reason-${month}" class="full" name="discountReason" type="text" maxlength="100" placeholder="e.g. Loyalty concession, Outage credit"><button class="primary-button" type="submit">Record actual payment</button></div></form></div>`;
    return `<details class="month-card" data-month-card="${month}" ${isOpen ? 'open' : ''}><summary><span class="month-label">${escapeHtml(monthName(month))}</span><span class="history-count">${bill ? `${bill.payments?.length ?? 0} payment${bill.payments?.length === 1 ? '' : 's'}` : ''}</span><span class="month-status ${status.className}">${status.label}</span></summary><div class="month-body">${summaryMarkup}${formsMarkup}<ul class="payment-list" aria-label="Payments for ${escapeHtml(monthName(month))}">${payments}</ul></div></details>`;
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
    return `${header}<li class="transaction-card tx-compact" data-payment-row="${pid}"><button class="tx-row" type="button" aria-expanded="false" aria-controls="${detailsId}" aria-label="#${transaction.customerNumber} ${escapeHtml(transaction.customerName)}, ${escapeHtml(formatAmount(transaction.amount))}, ${escapeHtml(transaction.method)}, ${escapeHtml(humanDate(transaction.date))}, ${statusText}. Show details and actions"><span class="tx-avatar" aria-hidden="true">${escapeHtml(initials(transaction.customerName))}</span><span class="tx-main"><span class="transaction-customer"><span class="transaction-customer-number">#${transaction.customerNumber}</span>${escapeHtml(transaction.customerName)}</span><span class="tx-sub"><span class="tx-method-chip tx-method-${methodSlug(transaction.method)}">${escapeHtml(transaction.method)}</span><span class="tx-date">${escapeHtml(humanDate(transaction.date))}</span></span></span><span class="tx-side"><strong class="transaction-amount">${escapeHtml(formatAmount(transaction.amount))}</strong><span class="report-status report-status-${transaction.status} tx-status-chip">${statusText}</span></span><span class="tx-chevron" aria-hidden="true">▾</span></button><div class="tx-details" id="${detailsId}" hidden><div class="transaction-data"><p class="transaction-meta">Actual payment date: ${escapeHtml(humanDate(transaction.date))} · Method: ${escapeHtml(transaction.method)}${paymentPayerMarkup(transaction)}</p><p class="transaction-context">${context}</p>${paymentAllocationMarkup(transaction.allocation)}</div><div class="transaction-actions">${receiptWhatsAppActionMarkup(customer, { ...transaction, billStatus:receiptBillStatus, billAmount:receiptData?.nominalPrice ?? null, balanceDueCents:receiptData?.balanceDueCents ?? null, arrearsBreakdown:buildArrearsBreakdown(customer, (customer.bills ?? []).find((bill) => bill.month === transaction.month)) }, { askLabel:'WhatsApp receipt' })}<button class="print-receipt-button" type="button" data-print-receipt data-customer-id="${escapeHtml(transaction.customerId)}" data-month="${escapeHtml(transaction.month)}" data-payment-id="${pid}" aria-label="Print receipt for customer ${transaction.customerNumber}, payment dated ${escapeHtml(transaction.date)}">🖨 Print receipt</button><button class="print-receipt-button thermal-receipt-button" type="button" data-print-thermal-receipt data-customer-id="${escapeHtml(transaction.customerId)}" data-month="${escapeHtml(transaction.month)}" data-payment-id="${pid}" aria-label="Print 80mm thermal slip for customer ${transaction.customerNumber}">80mm slip</button><button class="print-receipt-button thermal58-receipt-button" type="button" data-print-thermal58-receipt data-customer-id="${escapeHtml(transaction.customerId)}" data-month="${escapeHtml(transaction.month)}" data-payment-id="${pid}" aria-label="Print 58mm thermal slip for customer ${transaction.customerNumber}">58mm slip</button>${bluetoothReceiptButtonMarkup(transaction.customerId, transaction.month, pid, transaction.customerNumber)}<button class="edit-payment" type="button" data-transaction-edit="${pid}" data-customer-id="${escapeHtml(transaction.customerId)}" data-month="${escapeHtml(transaction.month)}">✎ Edit</button><button class="delete-payment" type="button" data-transaction-delete="${pid}" data-customer-id="${escapeHtml(transaction.customerId)}" data-month="${escapeHtml(transaction.month)}">🗑 Delete</button></div></div></li>`;
  }).join('');
  transactionList.querySelectorAll('[data-transaction-edit]').forEach(button => button.addEventListener('click', () => beginCorrection(button.dataset.customerId, button.dataset.month, button.dataset.transactionEdit, 'transactions')));
  transactionList.querySelectorAll('[data-transaction-delete]').forEach(button => button.addEventListener('click', () => requestDeletePayment(button.dataset.customerId, button.dataset.month, button.dataset.transactionDelete)));
  transactionList.querySelectorAll('[data-print-receipt]').forEach(button => button.addEventListener('click', () => printPaymentReceipt(button.dataset.customerId, button.dataset.month, button.dataset.paymentId)));
  transactionList.querySelectorAll('[data-print-thermal-receipt]').forEach(button => button.addEventListener('click', () => printPaymentReceipt(button.dataset.customerId, button.dataset.month, button.dataset.paymentId, { isThermal: true })));
  transactionList.querySelectorAll('[data-print-thermal58-receipt]').forEach(button => button.addEventListener('click', () => printPaymentReceipt(button.dataset.customerId, button.dataset.month, button.dataset.paymentId, { format: 'thermal-58' })));
  transactionList.querySelectorAll('[data-print-bluetooth-receipt]').forEach(button => button.addEventListener('click', () => printBluetoothReceipt(button.dataset.customerId, button.dataset.month, button.dataset.paymentId)));
  bindReceiptPhoneActions(transactionList);
}
function reportStatusLabel(status) { return ({ paid:'Paid', pending:'Pending', unpaid:'Pending', partial:'Partial', 'not-set':'Not set' })[status] ?? 'Not set'; }
function renderMonthlyReport() {
  const month = selectedBillingMonth;
  const query = reportSearchQuery.trim() || searchQuery();
  const rows = buildMonthlyReport(state, { month, statusFilter:selectedReportFilter, customerQuery:query });
  $('#monthlyReportCount').textContent = `${rows.length} ${rows.length === 1 ? 'customer' : 'customers'} · ${monthName(month)}`;
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
    if (methodTotals.Cash > 0) chips.push(`<span class="method-chip cash">Cash: ${formatAmount(methodTotals.Cash)}</span>`);
    if (methodTotals.JazzCash > 0) chips.push(`<span class="method-chip jazzcash">JazzCash: ${formatAmount(methodTotals.JazzCash)}</span>`);
    if (methodTotals.Easypaisa > 0) chips.push(`<span class="method-chip easypaisa">Easypaisa: ${formatAmount(methodTotals.Easypaisa)}</span>`);
    if (methodTotals.Raast > 0) chips.push(`<span class="method-chip raast">⚡ Raast: ${formatAmount(methodTotals.Raast)}</span>`);
    if (methodTotals.Bank > 0) chips.push(`<span class="method-chip bank">🏦 Bank: ${formatAmount(methodTotals.Bank)}</span>`);
    if (methodTotals.other > 0) chips.push(`<span class="method-chip other">Other: ${formatAmount(methodTotals.other)}</span>`);
    methodBreakdownEl.innerHTML = chips.length > 0
      ? `<span class="method-breakdown-title">By method:</span> ${chips.join(' ')}`
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
    if (pageInfo) pageInfo.textContent = `Page ${paged.page} of ${paged.totalPages} (${rows.length} total)`;
    const prevBtn = $('#reportPrevPage');
    if (prevBtn) prevBtn.disabled = paged.page <= 1;
    const nextBtn = $('#reportNextPage');
    if (nextBtn) nextBtn.disabled = paged.page >= paged.totalPages;
  }

  reportList.innerHTML = paged.items.map(row => {
    const monthlySale = row.monthlySellingAmount === null || row.monthlySellingAmount === undefined ? 'Not set' : formatAmount(row.monthlySellingAmount);
    const billAmount = row.billAmount === null ? 'Not set' : formatAmount(row.billAmount);
    const due = row.balanceDue === null ? 'Not set' : formatAmount(row.balanceDue);
    const speed = row.packageSpeed || 'Not set';
    const provider = row.ispProvider || 'Not set';
    const dueDate = row.dueDate ? humanDate(row.dueDate) : 'Not set · no due-date rule or penalty';
    const creditSources = row.creditSources.map(source => `${monthName(source.originMonth)} receipt ${humanDate(source.paymentDate)} (${source.method}, ${formatAmount(source.receiptAmount)}): ${formatAmount(source.amountCents / 100)} applied`).join('; ');
    const pendingSources = row.pendingCreditSources.map(source => `${monthName(source.originMonth)} receipt ${humanDate(source.paymentDate)} (${source.method}, original ${formatAmount(source.receiptAmount)}): ${formatAmount(source.amountCents / 100)} still available`).join('; ');
    const creditSummary = `Applied to bill ${formatAmount(row.creditApplied)} · forwarded from selected bill ${formatAmount(row.creditForwarded)} · customer-wide unused prepaid balance ${formatAmount(row.creditPending)} (not cash; valid indefinitely)${creditSources ? ` · Applied sources: ${creditSources}` : ''}${pendingSources ? ` · Waiting sources: ${pendingSources}` : ''}`;
    const serviceLabel = ({ active:'Active', offline:'Offline', 'not-set':'Not set' })[row.serviceStatus] ?? 'Not set';
    return `<li class="report-row"><div class="report-customer"><span class="customer-number-line">#${row.customerNumber}${row.archived ? ' · Archived' : ''}</span><div class="report-customer-name">${escapeHtml(row.customerName)}</div><span class="report-cell-label">Service (manual): ${serviceLabel} · Package / speed: ${escapeHtml(speed)} · ISP/provider: ${escapeHtml(provider)}</span></div><div class="report-cell"><span class="report-cell-label">Monthly sale (PKR)</span><span class="report-cell-value">${escapeHtml(monthlySale)}</span></div><div class="report-cell"><span class="report-cell-label">${escapeHtml(monthName(row.month))} bill (PKR)</span><span class="report-cell-value">${escapeHtml(billAmount)}</span></div><div class="report-cell"><span class="report-cell-label">Optional due date (PKT)</span><span class="report-cell-value">${escapeHtml(dueDate)}</span></div><div class="report-cell"><span class="report-cell-label">Actual amount received (PKR)</span><span class="report-cell-value">${escapeHtml(formatAmount(row.amountReceived))}</span></div><div class="report-cell"><span class="report-cell-label">Balance due (PKR)</span><span class="report-cell-value">${escapeHtml(due)}</span></div><div class="report-cell report-credit-cell"><span class="report-cell-label">Auto-credit (PKR, not cash)</span><span class="report-credit-value">${escapeHtml(creditSummary)}</span></div><div class="report-cell report-status-cell"><span class="report-cell-label">Billing status</span><span class="report-status report-status-${row.status}">${reportStatusLabel(row.status)}</span></div></li>`;
  }).join('');
  document.querySelectorAll('[data-report-filter]').forEach(button => button.setAttribute('aria-pressed', button.dataset.reportFilter === selectedReportFilter ? 'true' : 'false'));
}
function populateReportMonths() {
  const months = monthsForHistory();
  const options = months.map(month => `<option value="${month}">${escapeHtml(monthName(month))}</option>`).join('');
  $('#reportMonth').innerHTML = options;
  $('#customerFilterMonth').innerHTML = options;
  $('#reportMonth').value = selectedBillingMonth;
  $('#customerFilterMonth').value = selectedBillingMonth;
}
function renderProfileMarginPreview() {
  const sellingText = $('#monthlySellingAmountInput').value.trim();
  const costText = $('#monthlyPurchaseCostInput').value.trim();
  const preview = $('#customerProfitPreview');
  if (!sellingText || !costText) { preview.textContent = 'Expected monthly package profit: Not set until both monthly amounts are entered.'; return; }
  const selling = Number(sellingText); const cost = Number(costText);
  if (!Number.isFinite(selling) || selling <= 0 || !Number.isFinite(cost) || cost < 0) { preview.textContent = 'Enter a selling amount above zero and a provider cost of zero or more.'; return; }
  preview.textContent = `Expected monthly package profit: ${formatAmount(selling - cost)} · expected margin, not collected cash profit.`;
}
function incidentAuditMarkup(incident) {
  const corrections = incident.corrections ?? [];
  if (!corrections.length) return '';
  const items = corrections.map(correction => `<li><strong>${escapeHtml(humanLocalDateTime(correction.recordedAt))}</strong><br>Previous report: ${escapeHtml(humanLocalDateTime(correction.previous.reportedAt))} · offline start: ${escapeHtml(humanLocalDateTime(correction.previous.offlineAt))} · restored: ${escapeHtml(humanLocalDateTime(correction.previous.restoredAt))}<br>Previous note: ${escapeHtml(correction.previous.note || 'Not recorded')}</li>`).join('');
  return `<details class="incident-audit"><summary>Correction history (${corrections.length})</summary><ol>${items}</ol></details>`;
}
function renderIncidents(customer) {
  const incidents = [...(customer.incidents ?? [])].sort((a,b) => b.reportedAt.localeCompare(a.reportedAt) || a.id.localeCompare(b.id));
  $('#incidentCount30Days').textContent = countCustomerIncidentsLast30Days(state, customer.id, new Date());
  $('#incidentEmptyNote').hidden = incidents.length > 0;
  $('#incidentList').innerHTML = incidents.map(incident => {
    const resolved = Boolean(incident.restoredAt);
    return `<li class="incident-card"><div class="incident-card-head"><span class="incident-card-state ${resolved ? 'incident-resolved' : 'incident-open'}">${resolved ? 'Resolved' : 'Open'}</span><span class="incident-reported">Reported ${escapeHtml(humanLocalDateTime(incident.reportedAt))}</span></div><dl class="incident-times"><div><dt>Offline since</dt><dd>${escapeHtml(humanLocalDateTime(incident.offlineAt))}</dd></div><div><dt>Restored online</dt><dd>${escapeHtml(humanLocalDateTime(incident.restoredAt))}</dd></div></dl><p class="incident-note">${escapeHtml(incident.note || 'No complaint or resolution note recorded.')}</p>${incidentAuditMarkup(incident)}<div class="incident-actions"><button class="edit-incident secondary-button" type="button" data-edit-incident="${escapeHtml(incident.id)}">Edit</button><button class="delete-incident" type="button" data-delete-incident="${escapeHtml(incident.id)}">Delete</button></div></li>`;
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
    ? tenure.status==='future'?'Future connection date':tenure.status==='date-review'?'Date review required':tenure.status==='end-date-unknown'?'End date not recorded':'Not recorded'
    : `${tenure.serviceMonths} calendar month${tenure.serviceMonths===1?'':'s'}`;
  const tenureBasis=tenure.connectionDate
    ? `Saved connection date: ${tenure.connectionDate}${tenure.endDate?` · ended ${tenure.endDate}`:''}.`
    : 'Only the saved connection date is used; profile creation and first payment are not substituted.';
  const monthlyRevenue=lifetime.averageMonthlyRevenue===null?'Insufficient history':`${formatAmount(lifetime.averageMonthlyRevenue)} / month`;
  const delay=lifetime.averagePaymentDelayDays===null?'Not available':`${lifetime.averagePaymentDelayDays} day${lifetime.averagePaymentDelayDays===1?'':'s'} after due date`;
  const delayBasis=lifetime.paymentDelaySampleCount
    ? `Average nonnegative days after saved due dates across ${lifetime.paymentDelaySampleCount} fully settled priced bill${lifetime.paymentDelaySampleCount===1?'':'s'}; early/on-time settlements count as 0 days late.`
    : 'No fully settled priced bills with recorded due dates.';
  const future=lifetime.estimatedFutureValue===null?'Insufficient history':formatAmount(lifetime.estimatedFutureValue);
  return `<section class="customer-lifetime-value" aria-labelledby="customerLifetimeValueHeading"><h3 id="customerLifetimeValueHeading">Customer lifetime value (CLV)</h3><dl class="customer-lifetime-grid"><div><dt>Historical revenue collected</dt><dd>${escapeHtml(formatAmount(lifetime.totalHistoricalRevenue))}</dd><dd class="customer-lifetime-basis">${lifetime.receiptCount} valid local receipt${lifetime.receiptCount===1?'':'s'}; actual receipts only.</dd></div><div><dt>Customer tenure</dt><dd>${escapeHtml(tenureLabel)}</dd><dd class="customer-lifetime-basis">${escapeHtml(tenureBasis)}</dd></div><div><dt>Average monthly revenue</dt><dd>${escapeHtml(monthlyRevenue)}</dd><dd class="customer-lifetime-basis">${escapeHtml(lifetime.averageMonthlyRevenueBasis)}</dd></div><div><dt>Average payment delay</dt><dd>${escapeHtml(delay)}</dd><dd class="customer-lifetime-basis">${escapeHtml(delayBasis)}</dd></div><div class="customer-lifetime-estimate"><dt>Estimated future value · next 12 months</dt><dd>${escapeHtml(future)}</dd><dd class="customer-lifetime-basis">${escapeHtml(lifetime.estimatedFutureValueBasis)}</dd></div></dl><p class="customer-lifetime-note">The future value is an estimate, not collected cash or a guarantee. It extrapolates the saved receipt average; it does not model customer loss, costs or future price changes.</p></section>`;
}
// SISP-23: one-line installation profitability summary for the profile
// Connection group. Plain text (the field renderer escapes it); the
// partial-cost note matters because a subsidy computed without a fiber
// rate is only a lower bound, never the final number.
function installationCostProfileLine(customer) {
  const cost = calculateInstallationCost(customer);
  if (cost.status === 'not-recorded') return 'Not recorded';
  const costText = `Cost ${formatAmount(cost.totalCost)}${cost.totalIsPartial ? ' (partial — fiber rate not set)' : ''}`;
  if (cost.status === 'unknown') return `${costText} · connection fee not recorded`;
  if (cost.status === 'surplus') return `Net surplus ${formatAmount(cost.net)} · ${costText}`;
  if (cost.status === 'break-even') return `Break-even · ${costText}`;
  const breakEven = cost.breakEvenMonths === null
    ? 'break-even not computable (monthly amount not set)'
    : `break-even in ${cost.breakEvenMonths} monthly bill${cost.breakEvenMonths === 1 ? '' : 's'}`;
  return `ISP Hardware Subsidy ${formatAmount(cost.subsidy)} · ${costText} · ${breakEven}`;
}

function renderCustomerProfileView(customer) {
  const phone = String(customer.phone ?? '').trim();
  const cnic = String(customer.cnic ?? '').trim();
  const phoneTargets = contactActionTargets(phone);
  const phoneActions = phoneTargets ? `<span class="profile-contact-actions" aria-label="Contact shortcuts"><a class="secondary-button" href="${escapeHtml(phoneTargets.tel)}">Call</a>${phoneTargets.whatsapp ? `<a class="secondary-button" href="${escapeHtml(phoneTargets.whatsapp)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ''}</span>` : '';
  const phoneHint = phoneTargets?.whatsapp ? '' : '<p class="profile-contact-note">Save a full international number including its country code (for example, +923001234567) to enable WhatsApp receipt drafts. No country code is guessed.</p>';
  const profit = customerPackageProfit(customer);
  const lifetimeValue = buildCustomerLifetimeValue(state, customer, new Date());
  // SISP-3: profile Waada chips — one-tap promise dates on the customer record.
  const waadaToday = getTodayDateString();
  const waadaLabel = customer.promiseDate ? waadaBadgeLabel(customer, waadaToday) : null;
  const waadaBadge = waadaLabel ? `<span class="wada-badge ${customer.promiseDate < waadaToday ? 'wada-badge-broken waada-pulse' : 'wada-badge-upcoming'}">${escapeHtml(waadaLabel)}</span>` : '';
  const waadaSectionHtml = `<section class="profile-waada-section" aria-label="Waada promise"><h4>🤝 Waada Tareekh — Promise to Pay</h4><p class="profile-waada-current">${customer.promiseDate ? `Promise: <strong>${escapeHtml(customer.promiseDate)}</strong>${customer.promiseAmount ? ` · PKR ${Number(customer.promiseAmount).toLocaleString()}` : ''}${customer.promiseNote ? ` · “${escapeHtml(customer.promiseNote)}”` : ''} ${waadaBadge}` : 'No promise set.'}</p><div class="waada-chip-row" role="group" aria-label="Quick-set promise date"><button type="button" class="secondary-button waada-chip-btn" data-profile-waada-chip="plus2">+2 Days</button><button type="button" class="secondary-button waada-chip-btn" data-profile-waada-chip="plus5">+5 Days</button><button type="button" class="secondary-button waada-chip-btn" data-profile-waada-chip="tenth">10th of Month</button></div><div class="waada-chip-custom"><label for="profileWaadaCustomDate">Custom Date</label><input id="profileWaadaCustomDate" type="date" aria-label="Custom promise date"><button type="button" class="primary-button" id="profileWaadaSetCustomBtn">Set Date</button><button type="button" class="secondary-button text-button danger" id="profileWaadaClearBtn">Clear Promise</button></div></section>`;
  // SISP-15: profile complaint history — this customer's register entries only.
  const customerComplaints = loadComplaints().filter((c) => String(c.customerId) === String(customer.id)).sort((a, b) => String(b.reportedAt || '').localeCompare(String(a.reportedAt || '')));
  const complaintsSectionHtml = `<section class="profile-complaints-section" aria-label="Complaint history"><h4>🛠️ Complaint history</h4>${customerComplaints.length === 0 ? '<p class="profile-complaints-empty">No complaints recorded for this customer.</p>' : `<ul class="profile-complaints-list">${customerComplaints.map((c) => `<li><span><strong>${escapeHtml(c.id)}</strong> · ${escapeHtml(c.issueCategory)} · ${escapeHtml(c.status)}</span><span>Reported ${escapeHtml(c.reportedAt || 'not recorded')} · downtime ${escapeHtml(formatDowntimeHours(c.downtimeHours))}</span></li>`).join('')}</ul>`}<button type="button" class="secondary-button" id="profileOpenComplaintRegisterBtn">Open complaint register</button></section>`;
  // SISP-12: profile field tickets — this customer's worklist only, plus
  // pending ticket charges and the recurring-fault warning badge. Charges
  // live on the tickets, never inside bills or the billing cycle.
  const customerTickets = ticketsForCustomer(loadTickets(), customer.id);
  const ticketPending = billedTicketChargesPending(loadTickets(), customer.id);
  const recurringWarning = hasRecurringFaultWarning(loadTickets(), customer.id);
  const ticketsSectionHtml = `<section class="profile-tickets-section" aria-label="Field tickets"><h4>🔧 Field tickets — Lineman worklist</h4>${recurringWarning ? '<p class="profile-tickets-warning">⚠️ Recurring fault: 3 or more tickets in the last 60 days for this customer.</p>' : ''}<p class="profile-tickets-charges">Pending ticket charges: <strong>${escapeHtml(formatAmount(ticketPending))}</strong>${ticketPending > 0 ? ' · billed field work not yet marked paid' : ''}</p>${customerTickets.length === 0 ? '<p class="profile-tickets-empty">No field tickets recorded for this customer.</p>' : `<ul class="profile-tickets-list">${customerTickets.map((t) => `<li><span><strong>${escapeHtml(t.id)}</strong> · ${escapeHtml(ticketFaultLabel(t))} · ${escapeHtml(t.status)}</span><span>Lineman ${escapeHtml(t.technician || 'not set')} · ${escapeHtml(t.priority)}${t.billingType === 'billed' ? ` · Billed PKR ${t.billedAmount}${t.chargePaid ? ' · Paid' : ' · Unpaid'}` : ' · Free'}</span></li>`).join('')}</ul>`}<button type="button" class="secondary-button" id="profileOpenFieldTicketsBtn">Open field tickets</button></section>`;
  // SISP-16: profile downtime summary — this month + all time for this customer.
  const downtimeMonth = buildCustomerDowntimeSummary(loadComplaints(), customer.id, pakistanMonthNow());
  const downtimeAll = buildCustomerDowntimeSummary(loadComplaints(), customer.id, '');
  const downtimeSectionHtml = `<section class="profile-downtime-section" aria-label="Downtime analytics"><h4>📉 Downtime analytics</h4><p>This month: <strong>${escapeHtml(String(downtimeMonth.complaintCount))} complaint${downtimeMonth.complaintCount === 1 ? '' : 's'} · ${escapeHtml(String(downtimeMonth.totalDowntime))} h offline</strong>${downtimeMonth.primaryIssueTag ? ` · main issue ${escapeHtml(downtimeMonth.primaryIssueTag)}` : ''}</p><p>All time: <strong>${escapeHtml(String(downtimeAll.complaintCount))} complaint${downtimeAll.complaintCount === 1 ? '' : 's'} · ${escapeHtml(String(downtimeAll.totalDowntime))} h offline</strong>${downtimeAll.primaryIssueTag ? ` · main issue ${escapeHtml(downtimeAll.primaryIssueTag)}` : ''}</p><button type="button" class="secondary-button" id="profileOpenDowntimeAnalyticsBtn">Open downtime analytics</button></section>`;
  // SISP-7: profile feeder section — upstream house, feeder zone, and how
  // many downstream subscribers lose internet if this house goes down.
  const feederFields = normalizeFeederFields(customer);
  const feederUpstream = feederFields.upstreamCustomerId
    ? state.customers.find((c) => String(c.id) === String(feederFields.upstreamCustomerId)) ?? null
    : null;
  const feederDownstream = traceDownstreamImpact(state.customers, customer.id);
  const feederSectionHtml = `<section class="profile-outage-section" aria-label="Feeder and outage impact"><h4>⚡ Feeder &amp; outage impact</h4><p>Fed by: <strong>${escapeHtml(feederUpstream ? (feederUpstream.name || 'Unknown') : (feederFields.upstreamCustomerId ? 'Upstream not found' : 'Direct feed — no upstream house'))}</strong> · Feeder zone: <strong>${escapeHtml(feederFields.fiberZone || 'Not set')}</strong></p><p>Downstream at risk: <strong>${feederDownstream.length} subscriber${feederDownstream.length === 1 ? '' : 's'}</strong>${feederDownstream.length > 0 ? ` — ${escapeHtml(feederDownstream.slice(0, 3).map((c) => c.name || 'Unknown').join(', '))}${feederDownstream.length > 3 ? ` +${feederDownstream.length - 3} more` : ''}` : ''}</p><button type="button" class="secondary-button" id="profileOutageTraceBtn">⚡ Trace Downstream Impact</button></section>`;
  // (paid = billed installments whose bill month is fully settled, FIFO),
  // plus the add-plan form. Plans are separate from the one-time
  // connection/router/fiber fields above; they only ever bill through the
  // monthly billing cycle, never from this form.
  const kistProgress = buildKistProgress(customer, calculatePaymentAllocations(state));
  const kistPlansHtml = kistProgress.plans.length === 0
    ? '<p class="profile-kist-empty">No installments set up for this customer.</p>'
    : kistProgress.plans.map((plan) => `<article class="kist-plan"><div class="kist-plan-head"><strong>${escapeHtml(plan.itemTitle)}</strong><span>${escapeHtml(plan.statusLabel)}</span></div><div class="kist-progress-track" role="progressbar" aria-label="${escapeHtml(plan.itemTitle)} progress" aria-valuenow="${plan.percentPaid}" aria-valuemin="0" aria-valuemax="100"><div class="kist-progress-fill" style="width: ${plan.percentPaid}%"></div></div><p class="kist-plan-meta">Paid ${plan.monthsPaid}/${plan.totalMonths} Installments • ${escapeHtml(formatAmount(plan.remainingAmount))} Remaining</p><p class="kist-plan-detail">Monthly kist ${escapeHtml(formatAmount(plan.monthlyKist))} · Billed ${plan.monthsBilled}/${plan.totalMonths} · Total ${escapeHtml(formatAmount(plan.totalAmount))}${plan.downPayment > 0 ? ` · Down payment ${escapeHtml(formatAmount(plan.downPayment))}` : ''}${plan.startDate ? ` · From ${escapeHtml(plan.startDate)}` : ''}</p>${plan.monthsBilled === 0 ? `<button type="button" class="secondary-button text-button danger" data-profile-kist-remove="${escapeHtml(plan.id)}">Remove plan</button>` : ''}</article>`).join('');
  const kistSectionHtml = `<section class="profile-kist-section" aria-label="Installments (Kist)"><h4>💳 Kist / Installments — Hardware &amp; Wire</h4><p class="profile-kist-note">Installments are added to the monthly bill automatically when the billing cycle runs — never from here. Paid counts installments whose bill month is fully settled.</p>${kistPlansHtml}<form class="kist-add-form" novalidate><h5>Add installment plan</h5><div class="kist-add-grid"><label class="field-label full" for="profileKistItemTitle">Item (router / ONU / fiber wire)</label><input id="profileKistItemTitle" type="text" maxlength="100" placeholder="e.g. Tenda F3 Router + 120m Fiber" required><label class="field-label full" for="profileKistTotalAmount">Total amount (PKR)</label><input id="profileKistTotalAmount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="e.g. 3000" required><label class="field-label full" for="profileKistDownPayment">Down payment (PKR) <span class="optional-label">Optional</span></label><input id="profileKistDownPayment" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0"><label class="field-label full" for="profileKistTotalMonths">Months (2–6)</label><input id="profileKistTotalMonths" type="number" min="2" max="6" step="1" inputmode="numeric" placeholder="3" required><label class="field-label full" for="profileKistMonthlyKist">Monthly kist (PKR) <span class="optional-label">Optional · auto-split if blank</span></label><input id="profileKistMonthlyKist" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Auto"><label class="field-label full" for="profileKistStartDate">Start date <span class="optional-label">Optional · first cycle on/after this date</span></label><input id="profileKistStartDate" type="date"></div><button type="button" class="primary-button" id="profileKistAddBtn">Add installment plan</button></form></section>`;
  // SISP-13: per-customer MikroTik script — read-only text the
  // operator copies into WinBox Terminal; generating it never writes the
  // ledger. The password itself is never shown in the profile view, only
  // inside this copyable script (that is the point of the feature).
  const mikrotikSnippet = buildCustomerMikrotikSnippet(customer);
  const mikrotikSectionHtml = `<section class="profile-mikrotik-section" aria-label="MikroTik script"><h4>📡 MikroTik script</h4><p class="profile-mikrotik-note">Copy into WinBox Terminal. Read-only — this never changes bills or customer records. PPPoE username, password, static IP and MAC come from the profile edit form.</p><textarea id="profileMikrotikScript" class="mikrotik-script-box" readonly rows="10" aria-label="MikroTik script for this customer">${escapeHtml(mikrotikSnippet)}</textarea><button type="button" class="secondary-button" id="profileMikrotikCopyBtn">📋 Copy MikroTik script</button></section>`;
  const profileInfoGroupsHtml = `<div class="profile-info-groups">${profileInfoGroupMarkup('Contact', [['Phone / WhatsApp number', phone || 'Not set'], ['CNIC (National ID)', cnic ? formatCnicDisplay(cnic) : 'Not set']])}${profileInfoGroupMarkup('Location', [['Area / mohalla', customer.mohalla || 'Not set'], ['Zone', customer.zone || 'Not set'], ['Address', customer.address || 'Not set', true], ['Notes', customer.notes?.trim() || 'Not set', true]])}${profileInfoGroupMarkup('Service', [['ISP / provider', customer.ispProvider || 'Not set'], ['Service status', manualServiceStatusLabel(customer.serviceStatus)], ['Vacation hold', pauseSummary.detail], ['Package / speed', customer.packageSpeed || 'Not set'], ['Monthly provider purchase cost', formatAmount(customer.monthlyPurchaseCost)], ['Monthly selling amount', formatAmount(customer.monthlySellingAmount)]])}${profileInfoGroupMarkup('Connection', [['Connection / subscription start', customer.connectionDate ? humanDate(customer.connectionDate) : 'Not recorded'], ['Connection fee', formatAmount(customer.connectionFee)], ['Router installed', customer.routerModel || 'Not recorded'], ['Router price', formatAmount(customer.routerPrice)], ['Fiber wire used', customer.fiberMeters === null || customer.fiberMeters === undefined || customer.fiberMeters === '' ? 'Not recorded' : `${customer.fiberMeters} m`], ['Media converter cost', formatAmount(customer.mediaConverterCost)], ['Lineman install fee', formatAmount(customer.linemanInstallFee)], ['Fiber rate per meter', customer.fiberPerMeterRate === null || customer.fiberPerMeterRate === undefined || customer.fiberPerMeterRate === '' ? 'Not recorded' : `${formatAmount(customer.fiberPerMeterRate)} / m`], ['Installation cost & profitability', installationCostProfileLine(customer)], ['PPPoE username', customer.pppoeUsername || 'Not set'], ['Static IP', customer.staticIp || 'Not set'], ['MAC address', customer.macAddress || 'Not set'], ['Expiry / end date', customer.expiryDate ? humanDate(customer.expiryDate) : 'Not recorded'], ['Cancellation date', customer.cancellationDate ? humanDate(customer.cancellationDate) : 'Not recorded']])}</div>`;
  $('#customerProfileView').innerHTML = `<div class="profile-view-heading"><h3>Customer information</h3><div class="profile-view-actions"><details class="help-tip"><summary class="help-icon" aria-label="Customer information guidance" aria-controls="customerInfoGuidance">i</summary><span id="customerInfoGuidance" class="help-tip-content" role="tooltip">Area / mohalla is the parent location and an optional zone is summarized beneath it. Service status is manually set and separate from billing; it is not monitored. Phone shortcuts open only the device dialer or WhatsApp composer, and never send a message. Receipt drafts contain only this customer’s saved receipt details. All profile values shown here come from saved fields.</span></details><button id="editProfileButton" class="text-button profile-edit-button" type="button">Edit</button><button id="profileQrCardButton" class="secondary-button" type="button">QR Khata Card</button></div></div>${profileInfoGroupsHtml}${phoneActions ? `<div class="profile-contact-shortcuts">${phoneActions}</div>` : ''}${phoneHint}<p class="profile-view-profit">Expected monthly package profit: <strong>${escapeHtml(profit === null ? 'Not set' : formatAmount(profit))}</strong></p>${waadaSectionHtml}${complaintsSectionHtml}${ticketsSectionHtml}${downtimeSectionHtml}${feederSectionHtml}${kistSectionHtml}${mikrotikSectionHtml}`;
  $('#customerProfileView').insertAdjacentHTML('beforeend', customerLifetimeValueMarkup(lifetimeValue));
  $('#customerProfileView').querySelector('#editProfileButton').addEventListener('click', () => {
    profileEditMode = true;
    $('#customerProfileView').hidden = true;
    $('#customerProfileForm').hidden = false;
    $('#mohallaInput').focus();
  });
  // SISP-14: QR Khata Card button on the profile.
  $('#customerProfileView').querySelector('#profileQrCardButton')?.addEventListener('click', () => openQrKhataCard(customer));
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
  // SISP-4: wire the profile kist form (add plan + remove unbilled plan).
  // Adding a plan only records it — billing happens in the cycle, so this
  // handler never touches bills, amounts or payments.
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
        applyProfileKist({ ...customer, installmentPlans: plans }, `Installment plan added: ${plan.itemTitle} (${plan.totalMonths} × ${formatAmount(plan.monthlyKist)}). It will bill with the next monthly cycle.`);
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
  }
}
function renderCurrentBillSummary(customer) {
  const month = monthsForHistory(new Date())[0];
  const allocations = calculatePaymentAllocations(state);
  const summary = currentBillPresentation(customer, month, allocations);
  const unusedCreditCents = [...allocations.byPaymentId.values()].filter(row => row.customerId === customer.id).reduce((sum,row) => sum + (row.unappliedCreditCents ?? 0), 0);
  $('#customerCurrentBillSummary').innerHTML = `<div class="current-bill-heading"><h3>Current billing · ${escapeHtml(monthName(month))}</h3><details class="help-tip"><summary class="help-icon" aria-label="Current bill and balance guidance" aria-controls="currentBillGuidance">i</summary><span id="currentBillGuidance" class="help-tip-content" role="tooltip">Bill amount is the saved bill for this month. Paid, Partial, Pending, or Not set is derived from saved receipts and carried credit. Net due is the existing calculated balance; no bill or amount is invented.</span></details></div><div class="current-bill-grid" aria-live="polite"><article class="current-bill-stat"><span>Monthly bill</span><strong>${escapeHtml(summary.billAmountLabel)}</strong></article><article class="current-bill-stat"><span>Actual cash received on bill</span><strong>${summary.receiptCount?escapeHtml(formatAmount(summary.receivedAmount)):'No receipts'}</strong></article><article class="current-bill-stat"><span>Billing status</span><strong class="customer-billing-badge ${escapeHtml(summary.statusClassName)}">${escapeHtml(summary.statusLabel)}</strong></article><article class="current-bill-stat"><span>Net due balance</span><strong>${escapeHtml(summary.balanceDueLabel)}</strong></article><article class="current-bill-stat"><span>Unused advance credit</span><strong>${unusedCreditCents?escapeHtml(formatAmount(unusedCreditCents/100)):'None recorded'}</strong></article></div>`;
}
function renderDetail() {
  const customer = selectedCustomer();
  $('#welcomeState').hidden = !!customer;
  $('#customerDetail').hidden = !customer;
  if (!customer) return;
  $('#customerReceiptSummary').innerHTML = profileReceiptSummaryMarkup(customer);
  $('#profileAvatar').textContent = initials(customer.name);
  $('#detailCustomerNumber').textContent = `Customer #${customer.customerNumber}`;
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
  const serviceStatus = ['active','offline'].includes(customer.serviceStatus) ? customer.serviceStatus : 'not-set';
  const serviceStatusLabel = manualServiceStatusLabel(serviceStatus).replace('Service status: ', '');
  const serviceStatusBadge = $('#profileServiceStatusBadge');
  serviceStatusBadge.className = `profile-service-status profile-service-status-${serviceStatus}`;
  serviceStatusBadge.textContent = `Service · ${serviceStatusLabel}`;
  serviceStatusBadge.setAttribute('aria-label', `Manual service status: ${serviceStatusLabel}; not monitored`);
  $('#archiveStateBadge').textContent = profileArchiveLabel(customer.archived, customer.archived ? (customer.archivedAt ? humanLocalDateTime(customer.archivedAt) : 'date not recorded') : '');
  $('#archiveCustomerButton').hidden = customer.archived;
  $('#unarchiveCustomerButton').hidden = !customer.archived;
  // SISP-8: vacation hold — edit fields + header badge (shown only while
  // a hold is active; skipped months stay visible in the profile view).
  const pauseSummary = pauseBillingSummary(customer);
  if ($('#pauseBillingCheckbox')) $('#pauseBillingCheckbox').checked = customer.paused === true;
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
  if ($('#mediaConverterCostInput')) $('#mediaConverterCostInput').value = customer.mediaConverterCost ?? '';
  if ($('#linemanInstallFeeInput')) $('#linemanInstallFeeInput').value = customer.linemanInstallFee ?? '';
  if ($('#fiberPerMeterRateInput')) $('#fiberPerMeterRateInput').value = customer.fiberPerMeterRate ?? '';
  // SISP-7: feeder link fields — upstream select excludes this customer;
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
    upstreamSelect.innerHTML = '<option value="">Direct feed — no upstream house</option>' + options.filter((c) => !c.archived || (savedUpstream && String(c.id) === String(savedUpstream.id))).map((c) => `<option value="${escapeHtml(String(c.id))}"${String(c.id) === String(feederSaved.upstreamCustomerId) ? ' selected' : ''}>${escapeHtml(c.name || 'Unknown')}${c.mohalla ? ` · ${escapeHtml(c.mohalla)}` : ''}${c.archived ? ' (archived)' : ''}</option>`).join('');
    upstreamSelect.value = feederSaved.upstreamCustomerId ?? '';
  }
  const fiberZoneSelect = $('#fiberZoneInput');
  if (fiberZoneSelect) {
    fiberZoneSelect.innerHTML = '<option value="">Not set</option>' + FIBER_ZONES.map((z) => `<option value="${escapeHtml(z)}"${z === (feederSaved.fiberZone ?? '') ? ' selected' : ''}>${escapeHtml(z)}</option>`).join('');
    fiberZoneSelect.value = feederSaved.fiberZone ?? '';
  }
  if ($('#pppoeUsernameInput')) $('#pppoeUsernameInput').value = customer.pppoeUsername ?? '';
  if ($('#pppoePasswordInput')) $('#pppoePasswordInput').value = customer.pppoePassword ?? '';
  if ($('#staticIpInput')) $('#staticIpInput').value = customer.staticIp ?? '';
  if ($('#macAddressInput')) $('#macAddressInput').value = customer.macAddress ?? '';
  $('#expiryDateInput').value = customer.expiryDate ?? '';
  $('#cancellationDateInput').value = customer.cancellationDate ?? '';
  $('#packageChangeStaffNameInput').value = '';
  const packageHistory = [...(customer.packageHistory ?? [])].reverse();
  $('#packageHistoryList').innerHTML = packageHistory.map(change => {
    let proRataPart = '';
    if (change.proRatedBillAmount != null) {
      const sign = (change.proRataAdjustment || 0) > 0 ? '+' : '';
      proRataPart = ` · <strong style="color:var(--brand-teal, #0e5b4d);">Pro-rata: PKR ${Number(change.proRatedBillAmount).toLocaleString()}</strong> (${sign}PKR ${Number(change.proRataAdjustment || 0).toLocaleString()})`;
    }
    return `<li><strong>${escapeHtml(change.date || 'Date not recorded')}</strong> · ${escapeHtml(change.oldPackage || 'Not set')} → ${escapeHtml(change.newPackage || 'Not set')} · Rate ${escapeHtml(formatAmount(change.oldMonthlyRate))} → ${escapeHtml(formatAmount(change.newMonthlyRate))} · monthly delta ${escapeHtml(change.monthlyRecurringPriceDelta === null ? 'Not calculable' : formatAmount(change.monthlyRecurringPriceDelta))}${proRataPart}${change.staffName ? ` · ${escapeHtml(change.staffName)}` : ''}</li>`;
  }).join('');
  $('#packageHistoryEmpty').hidden = packageHistory.length > 0;
  renderProfileMarginPreview();
  renderProfileProrataPreview();
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
function backupExtras() {
  return { digitalPaymentsSettings: getDigitalPaymentsSettings(), shopSettlements: loadShopSettlements(), complaints: loadComplaints(), roznamchaDays: loadRoznamchaDays(), tickets: loadTickets(), inventory: loadInventory(), saadVisits: loadSaadVisits(), saadPayments: loadSaadPayments(), installRequests: loadInstallRequests(), pendingWorks: loadPendingWorks() };
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
  try { stored = localStorage.getItem(DIGITAL_PAYMENTS_SETTINGS_KEY) !== null; } catch { stored = false; }
  try { shopStored = localStorage.getItem(SHOP_SETTLEMENTS_KEY) !== null; } catch { shopStored = false; }
  try { complaintsStored = localStorage.getItem(COMPLAINTS_KEY) !== null; } catch { complaintsStored = false; }
  try { roznamchaStored = localStorage.getItem(ROZNAMCHA_KEY) !== null; } catch { roznamchaStored = false; }
  try { ticketsStored = localStorage.getItem(TICKETS_KEY) !== null; } catch { ticketsStored = false; }
  try { inventoryStored = localStorage.getItem(INVENTORY_KEY) !== null; } catch { inventoryStored = false; }
  try { saadVisitsStored = localStorage.getItem(SAAD_VISITS_KEY) !== null; } catch { saadVisitsStored = false; }
  try { saadPaymentsStored = localStorage.getItem(SAAD_PAYMENTS_KEY) !== null; } catch { saadPaymentsStored = false; }
  try { installRequestsStored = localStorage.getItem(INSTALL_REQUESTS_KEY) !== null; } catch { installRequestsStored = false; }
  try { pendingWorksStored = localStorage.getItem(PENDING_WORKS_KEY) !== null; } catch { pendingWorksStored = false; }
  return { currentDigitalPaymentsSettings: getDigitalPaymentsSettings(), currentDigitalPaymentsStored: stored, currentShopSettlements: loadShopSettlements(), currentShopSettlementsStored: shopStored, currentComplaints: loadComplaints(), currentComplaintsStored: complaintsStored, currentRoznamchaDays: loadRoznamchaDays(), currentRoznamchaDaysStored: roznamchaStored, currentTickets: loadTickets(), currentTicketsStored: ticketsStored, currentInventory: loadInventory(), currentInventoryStored: inventoryStored, currentSaadVisits: loadSaadVisits(), currentSaadVisitsStored: saadVisitsStored, currentSaadPayments: loadSaadPayments(), currentSaadPaymentsStored: saadPaymentsStored, currentInstallRequests: loadInstallRequests(), currentInstallRequestsStored: installRequestsStored, currentPendingWorks: loadPendingWorks(), currentPendingWorksStored: pendingWorksStored };
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
    const option = new Option(`${formatBackupDateTime(backup.createdAt)} · ${formatBackupSize(backup.sizeBytes)} · ${backup.kind === 'automatic' ? 'Automatic' : 'Manual'}`, backup.id);
    select.add(option);
  }
  if ([...(backups ?? [])].some(backup => backup.id === selectedId)) select.value = selectedId;
  $('#restoreLocalBackupButton').disabled = !select.value;
  $('#backupNowButton').disabled = persistenceBlocked || !storageAvailable || backupOperationBusy;
}
async function refreshBackupManager() {
  try {
    const [settings, status, backups] = await Promise.all([
      localBackupStore.getSettings(), localBackupStore.getStatus(), localBackupStore.listBackups()
    ]);
    renderBackupManager({ settings, status, backups });
    updateDataSafetyUi(status);
    return { settings, status, backups };
  } catch (error) {
    $('#backupStatus').textContent = `Unavailable: ${error.message || 'app-private backup storage could not be opened'}`;
    $('#backupNowButton').disabled = persistenceBlocked || !storageAvailable || backupOperationBusy;
    $('#restoreLocalBackupButton').disabled = true;
    updateDataSafetyUi(null);
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
function renderBackupPreview(preview) {
  pendingBackupPreview = preview;
  const encSection = $('#encryptedRestoreSection');
  if (encSection) encSection.hidden = true;
  const plainSection = $('#plainBackupRestoreSection');
  if (plainSection) plainSection.hidden = false;
  const { counts, conflicts } = preview;
  const summary = [`Backup created: ${preview.exportedAt || 'date not recorded'}.`, `${counts.addedCustomers} new profiles`, `${counts.mergedCustomers} matching profiles checked`, `${counts.addedBills} new bills`, `${counts.addedPayments} new actual receipts`, `${counts.addedIncidents} new complaints/outages`, `${counts.filledProfileFields} blank profile fields filled`, `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} preserved.`].join(' ');
  $('#jsonBackupPreviewSummary').textContent = `${summary} Phase 3 records: ${counts.addedInventoryItems ?? 0} inventory items, ${counts.addedInventoryMovements ?? 0} movements, ${counts.addedExpenses ?? 0} expenses, ${counts.addedSaadAttendanceDays ?? 0} Saad attendance dates, ${counts.addedUmairWorkdays ?? 0} Umair work dates.${counts.digitalPaymentsSettingsRestored ? ' Digital payment settings (Raast/Till/bank/QR) will also be restored.' : ''}${counts.shopSettlementsRestored ? ' Shop settlement records will also be restored.' : ''}`;
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
  $('#applyJsonBackupButton').disabled = !preview.canApply;
  $('#jsonBackupDialog').showModal();
}
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
    const result = await shareJsonBackupFile({ backupText, filename });
    if (result.method === 'share') {
      recordOffDeviceBackupExport();
      updateDataSafetyUi();
      toast('Backup shared successfully! Keep it safe.');
    } else if (result.method === 'download') {
      downloadJson(result.filename, result.backupText);
      recordOffDeviceBackupExport();
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
    renderBackupPreview(previewJsonBackupMerge(state, text, backupRestoreOptions()));
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
    renderBackupPreview(previewJsonBackupMerge(state, backup.backupText, backupRestoreOptions()));
  } catch (error) { toast(`${error.message} No local data was changed.`); }
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
    renderBackupPreview(previewJsonBackupMerge(state, decryptedText, backupRestoreOptions()));
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
    renderBackupPreview(previewJsonBackupMerge(state, text, backupRestoreOptions()));
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
$('#applyJsonBackupButton').addEventListener('click', () => {
  if (!pendingBackupPreview?.canApply) return;
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
    }
    if (pendingBackupPreview.complaints) {
      saveComplaints(pendingBackupPreview.complaints);
    }
    if (pendingBackupPreview.roznamchaDays) {
      saveRoznamchaDays(pendingBackupPreview.roznamchaDays);
    }
    if (pendingBackupPreview.tickets) {
      saveTickets(pendingBackupPreview.tickets);
    }
    if (pendingBackupPreview.inventory) {
      saveInventory(pendingBackupPreview.inventory);
    }
    if (pendingBackupPreview.saadVisits) {
      saveSaadVisits(pendingBackupPreview.saadVisits);
    }
    if (pendingBackupPreview.saadPayments) {
      saveSaadPayments(pendingBackupPreview.saadPayments);
    }
    if (pendingBackupPreview.installRequests) {
      saveInstallRequests(pendingBackupPreview.installRequests);
    }
    if (pendingBackupPreview.pendingWorks) {
      savePendingWorks(pendingBackupPreview.pendingWorks);
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
    const txnId = (data.get('transactionId') || '').trim();
    if (txnId) {
      const dup = findDuplicatePaymentReference(state, txnId);
      if (dup) {
        if (!(await duplicateTxnConfirm(txnId, dup))) { form.querySelector('[name="transactionId"]')?.focus(); return; }
      }
    }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.setAttribute('aria-busy', 'true'); }
    const beforeIds = new Set((state.customers.find(c => c.id === customerId)?.bills.find(b => b.month === form.dataset.month)?.payments || []).map(p => p.id));
    state = addPayment(state, customerId, form.dataset.month, {
      date: data.get('date'),
      amount: data.get('amount'),
      method: data.get('method'),
      paidBy:data.get('paidBy'),
      discount: data.get('discount') || 0,
      discountReason: data.get('discountReason') || '',
      transactionId: txnId || undefined
    });
    save();
    renderDetail();
    const paidCustomer = state.customers.find(c => c.id === customerId);
    const added = paidCustomer?.bills.find(b => b.month === form.dataset.month)?.payments.find(p => !beforeIds.has(p.id));
    const actions = added ? [
      { label:'Undo', onAction: () => { try { state = deletePayment(state, customerId, form.dataset.month, added.id); save(); if (selectedCustomerId === customerId) renderDetail(); toast('Payment undone. Ledger restored.', { type:'info', title:'Undone' }); } catch (err) { toast(err.message); } } },
      { label:'Receipt', onAction: () => printPaymentReceipt(customerId, form.dataset.month, added.id) }
    ] : [];
    toast(added ? `${formatAmount(added.amount)} received from #${paidCustomer.customerNumber} ${paidCustomer.name} for ${monthName(form.dataset.month)}. Payment recorded on this device.` : 'Payment recorded on this device.', { type:'success', title:'Payment recorded', actions });
  }
  catch (error) { toast(error.message, { type:'error', title:'Payment not saved' }); }
  finally { if (submitBtn && submitBtn.isConnected) { submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); } }
}
function correctionForm(payment, customerId, month, origin) {
  const options = PAYMENT_METHODS.map(method => `<option value="${method}" ${method === payment.method ? 'selected' : ''}>${method}</option>`).join('');
  return `<form class="payment-form editing" data-kind="correct" data-origin="${origin}" data-customer-id="${escapeHtml(customerId)}" data-month="${escapeHtml(month)}" data-payment-id="${escapeHtml(payment.id)}"><div class="form-grid"><label class="field-label full" for="edit-date-${escapeHtml(payment.id)}">Payment date</label><input id="edit-date-${escapeHtml(payment.id)}" class="full" name="date" type="date" max="${localDate()}" value="${escapeHtml(payment.date)}" required><label class="field-label full" for="edit-amount-${escapeHtml(payment.id)}">Amount received (PKR)</label><input id="edit-amount-${escapeHtml(payment.id)}" class="full" name="amount" type="number" min="0.01" step="0.01" value="${escapeHtml(payment.amount)}" required><label class="field-label full" for="edit-discount-${escapeHtml(payment.id)}">Discount / concession (PKR)</label><input id="edit-discount-${escapeHtml(payment.id)}" class="full" name="discount" type="number" min="0" step="0.01" value="${payment.discount !== undefined && payment.discount !== null ? escapeHtml(payment.discount) : '0'}" placeholder="0"><label class="field-label full" for="edit-discount-reason-${escapeHtml(payment.id)}">Discount reason (optional)</label><input id="edit-discount-reason-${escapeHtml(payment.id)}" class="full" name="discountReason" type="text" maxlength="80" value="${escapeHtml(payment.discountReason || '')}" placeholder="e.g. Owner concession, outage waiver"><label class="field-label full" for="edit-method-${escapeHtml(payment.id)}">Payment method</label><select id="edit-method-${escapeHtml(payment.id)}" class="full" name="method">${options}</select>${paidByFieldMarkup(`edit-paid-by-${payment.id}`, payment.paidBy ?? '')}<label class="field-label full" for="edit-txnid-${escapeHtml(payment.id)}">Transaction ID / Ref (optional)</label><input id="edit-txnid-${escapeHtml(payment.id)}" class="full" name="transactionId" type="text" maxlength="64" value="${escapeHtml(payment.transactionId || '')}" placeholder="e.g. 1234567890"><button class="primary-button" type="submit">Save correction</button><button class="secondary-button full" type="button" data-cancel-correction>Cancel</button></div></form>`;
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
    state = correctPayment(state, form.dataset.customerId, form.dataset.month, form.dataset.paymentId, { date:data.get('date'), amount:data.get('amount'), method:data.get('method'), paidBy:data.get('paidBy'), discount:data.get('discount') || 0, discountReason:data.get('discountReason') || '', transactionId: txnId || undefined });
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
  $('#incidentSubmitButton').textContent = incident ? 'Save correction' : 'Save incident';
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
    const errorBox = $('#incidentFormError'); errorBox.textContent = error.message; errorBox.hidden = false;
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
    hint.textContent = 'This bill is already settled. No amount is due; enter an amount only if an actual additional prepayment is being collected. Nothing is saved until you submit.';
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
    mediaConverterCost:$('#newCustomerMediaConverterCost') ? $('#newCustomerMediaConverterCost').value : '',
    linemanInstallFee:$('#newCustomerLinemanInstallFee') ? $('#newCustomerLinemanInstallFee').value : '',
    fiberPerMeterRate:$('#newCustomerFiberPerMeterRate') ? $('#newCustomerFiberPerMeterRate').value : '',
    // #293: new customers start as Active (manual status) unless the owner picks Offline / Not set.
    serviceStatus:$('#newCustomerServiceStatus')?.value || 'not-set',
    nameUrdu:$('#newCustomerNameUrdu') ? $('#newCustomerNameUrdu').value.trim() : ''
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
      packageSpeed:$('#packageSpeedInput').value, monthlyPurchaseCost:$('#monthlyPurchaseCostInput').value,
      monthlySellingAmount:$('#monthlySellingAmountInput').value, connectionDate:$('#connectionDateInput').value,
      connectionFee:$('#connectionFeeInput').value, routerModel:$('#routerModelInput').value,
      routerPrice:$('#routerPriceInput').value, fiberMeters:$('#fiberMetersInput').value,
      ...($('#mediaConverterCostInput') ? { mediaConverterCost: $('#mediaConverterCostInput').value } : {}),
      ...($('#linemanInstallFeeInput') ? { linemanInstallFee: $('#linemanInstallFeeInput').value } : {}),
      ...($('#fiberPerMeterRateInput') ? { fiberPerMeterRate: $('#fiberPerMeterRateInput').value } : {}),
      upstreamCustomerId:$('#upstreamCustomerInput') ? $('#upstreamCustomerInput').value : '',
      fiberZone:$('#fiberZoneInput') ? $('#fiberZoneInput').value : '',
      ...($('#pppoeUsernameInput') ? { pppoeUsername: $('#pppoeUsernameInput').value } : {}),
      ...($('#pppoePasswordInput') ? { pppoePassword: $('#pppoePasswordInput').value } : {}),
      ...($('#staticIpInput') ? { staticIp: $('#staticIpInput').value } : {}),
      ...($('#macAddressInput') ? { macAddress: $('#macAddressInput').value } : {}),
      expiryDate:$('#expiryDateInput').value, cancellationDate:$('#cancellationDateInput').value,
      // SISP-8: vacation hold (validation errors surface as a toast).
      paused: $('#pauseBillingCheckbox')?.checked === true,
      pauseStartDate: $('#pauseStartDateInput')?.value || '',
      autoResumeDate: $('#autoResumeDateInput')?.value || '',
      packageChangeStaffName:$('#packageChangeStaffNameInput').value,
      proRataAdjustment, proRatedBillAmount, voucherId
    });
    profileEditMode = false;
    save(); renderDetail();
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
      badge.textContent = `${proration.netAdjustment > 0 ? '+' : ''}PKR ${proration.netAdjustment.toLocaleString()} (${isUp ? 'UPGRADE' : (proration.netAdjustment < 0 ? 'DOWNGRADE' : 'LATERAL')})`;
      badge.className = `sim-delta-badge ${isUp ? 'badge-success' : (proration.netAdjustment < 0 ? 'badge-warning' : 'badge-info')}`;
    }
    const breakdown = $('#prorataPreviewDaysBreakdown');
    if (breakdown) {
      breakdown.innerHTML = `
        <span>Day ${proration.effectiveDay} of ${proration.daysInMonth} · ${proration.daysElapsed} days on old rate (PKR ${(proration.oldPlanCostElapsed || (currentRate - proration.oldPlanCredit)).toLocaleString()}) + ${proration.daysRemaining} days on new rate (PKR ${proration.newPlanCharge.toLocaleString()})</span>
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
function restoreCustomer(customerId) {
  try {
    state = unarchiveCustomer(state, customerId, new Date());
    save();
    if (selectedCustomerId === customerId) renderDetail();
    toast('Customer unarchived. Billing resumes from the current or next eligible month; archived months are not backfilled.');
  } catch (error) { toast(error.message); }
}
function archiveSelectedCustomer(customer) {
  try { state = archiveCustomer(state, customer.id, new Date()); save(); renderDetail(); toast('Customer archived. Existing history remains available.', { type:'success', title:`#${customer.customerNumber} ${customer.name} archived`, actionLabel:'Undo', onAction: () => restoreCustomer(customer.id) }); }
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
  if (!newName) { showError('Customer name cannot be empty.'); return; }
  if (newName === customer.name) { closeCustomerNameEditor(); return; }
  try {
    state = updateCustomerProfile(state, customer.id, { name: newName });
    save();
    closeCustomerNameEditor();
    renderDetail();
    renderCustomers();
    toast(`Customer name updated to “${newName}”.`);
  } catch (err) {
    showError(err?.message || 'Could not save the name.');
  }
});
$('#deleteCustomerButton').addEventListener('click', async () => {
  const customer = selectedCustomer();
  if (!customer) return;
  const choice = await appConfirm({ tone:'danger', title:'Delete this customer?', subject:`#${customer.customerNumber} ${customer.name}`, message:'All bills, receipts, unused prepaid credit, contact/package data and complaint history are removed from this device. You can undo for a few seconds; after that only a JSON backup can bring it back. Archive keeps the history instead.', confirmLabel:'Delete customer', altLabel: customer.archived ? '' : 'Archive instead' });
  if (choice === 'alt') { archiveSelectedCustomer(customer); return; }
  if (choice !== 'confirm' || selectedCustomer()?.id !== customer.id) return;
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
$('#addIncidentButton').addEventListener('click', () => showIncidentEditor());
$('#incidentForm').addEventListener('submit', onIncidentSubmit);
$('#cancelIncidentEditButton').addEventListener('click', () => { closeIncidentEditor(); renderDetail(); });
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
    } else if (['customers', 'transactions', 'reports', 'analytics', 'inventory', 'expenses'].includes(target)) {
      switchView(target);
      if (target === 'transactions') renderTransactions();
      else if (target === 'reports') renderMonthlyReport();
      else if (target === 'analytics') renderAnalytics();
      else if (target === 'inventory') renderInventory();
      else if (target === 'expenses') renderExpenses();
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
    if (['customers', 'transactions', 'reports', 'analytics', 'inventory', 'expenses'].includes(target)) {
      switchView(target);
      if (target === 'transactions') renderTransactions();
      else if (target === 'reports') renderMonthlyReport();
      else if (target === 'analytics') renderAnalytics();
      else if (target === 'inventory') renderInventory();
      else if (target === 'expenses') renderExpenses();
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
    if (['customers', 'transactions', 'reports', 'analytics', 'inventory', 'expenses'].includes(target)) {
      switchView(target);
      if (target === 'transactions') renderTransactions();
      else if (target === 'reports') renderMonthlyReport();
      else if (target === 'analytics') renderAnalytics();
      else if (target === 'inventory') renderInventory();
      else if (target === 'expenses') renderExpenses();
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
    renderCustomers();
    renderDashboard();
    toast('Customer ledger updated');
  }
});

setupSwipeNavigation({
  container: document.getElementById('main') || document.body,
  views: ['customers', 'transactions', 'reports', 'analytics', 'inventory', 'expenses'],
  onNavigate: (target) => {
    switchView(target);
    if (target === 'transactions') renderTransactions();
    else if (target === 'reports') renderMonthlyReport();
    else if (target === 'analytics') renderAnalytics();
    else if (target === 'inventory') renderInventory();
    else if (target === 'expenses') renderExpenses();
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
      state = addCustomer(state, details.name, new Date(details.startDate || Date.now()), {
        phone: details.phone,
        address: details.address,
        mohalla: details.mohalla,
        zone: details.area,
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
        if (details.serviceStatus) {
          addedCustomer.serviceStatus = String(details.serviceStatus).toLowerCase();
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
  onToast: (msg, opts) => toast(msg, opts)
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
    if (['customers', 'transactions', 'reports', 'analytics', 'inventory', 'expenses'].includes(viewId)) {
      switchView(viewId);
      if (viewId === 'customers') renderCustomers();
      else if (viewId === 'transactions') renderTransactions();
      else if (viewId === 'reports') renderMonthlyReport();
      else if (viewId === 'analytics') renderAnalytics();
      else if (viewId === 'inventory') renderInventory();
      else if (viewId === 'expenses') renderExpenses();
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
  itemsTable.innerHTML=filteredItems.map(item=>{
    let statusPill = '';
    if (!item.hasMovements) {
      statusPill = '<span class="stock-status-pill pill-muted">Unrecorded</span>';
    } else if (item.available <= 0) {
      statusPill = '<span class="stock-status-pill pill-danger">Out of stock</span>';
    } else if (item.available <= item.minimumStock) {
      statusPill = '<span class="stock-status-pill pill-warning">Low stock</span>';
    } else {
      statusPill = '<span class="stock-status-pill pill-success">In stock</span>';
    }
    const formattedAvail = item.hasMovements ? new Intl.NumberFormat('en-PK',{maximumFractionDigits:2}).format(item.available) : 'Not recorded';
    return `<tr><th scope="row">${phase3Cell(item.name)}</th><td>${phase3Cell(item.category)}</td><td><div class="stock-avail-cell"><span class="stock-qty">${formattedAvail}</span> ${statusPill}</div></td><td>${phase3Cell(item.unit)}</td><td>${new Intl.NumberFormat('en-PK',{maximumFractionDigits:2}).format(item.minimumStock)}</td><td>${item.unitCost===null||item.unitCost===undefined?'Not set':phase3Cell(formatAmount(item.unitCost))}</td><td>${item.hasMovements&&item.value!==null?phase3Cell(formatAmount(item.value)):'Not set'}</td><td>${item.hasMovements?`${item.installed} / ${item.damaged} / ${item.returned}`:'Not recorded'}</td><td class="inventory-actions"><button type="button" class="edit-payment" data-edit-inventory="${phase3Cell(item.id)}">Edit</button></td></tr>`;
  }).join('');
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
  itemsTable.querySelectorAll('[data-edit-inventory]').forEach(button=>button.addEventListener('click',()=>{const item=items.find(row=>row.id===button.dataset.editInventory);if(!item)return;$('#inventoryItemId').value=item.id;$('#inventoryName').value=item.name;$('#inventoryCategory').value=item.category;$('#inventoryUnit').value=item.unit;$('#inventoryMinimum').value=item.minimumStock;$('#inventoryUnitCost').value=item.unitCost??'';$('#inventoryCreatedDate').value=item.createdDate??'';$('#inventoryNotes').value=item.notes??'';$('#inventoryItemSubmit').textContent='Save item changes';$('#inventoryItemCancel').hidden=false;$('#inventoryItemForm').scrollIntoView({behavior:'smooth',block:'center'});}));
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
  const tabs = { ledger: '#expenseTabLedger', nasir: '#expenseTabNasir', aqib: '#expenseTabAqib' };
  const panels = { ledger: '#expensesLedgerPanel', nasir: '#nasirSharePanel', aqib: '#aqibSharePanel' };
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

function renderExpenses() {
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

  const sortedRows = sortExpenseRows(filteredRows, expenseSortKey, expenseSortAsc);

  $('#expenseTable').innerHTML = sortedRows.map(row => `<tr><td>${phase3Cell(row.date)}</td><th scope="row">${phase3Cell(row.category)}</th><td>${phase3Cell(formatAmount(row.amount))}</td><td>${row.area ? `<span class="expense-area-badge">${escapeHtml(row.area)}</span>` : '<span class="expense-area-unallocated">Unallocated</span>'}</td><td>${phase3Cell(row.notes || 'Not recorded')}</td><td class="expense-actions"><button type="button" class="edit-payment" data-edit-expense="${phase3Cell(row.id)}">Edit</button> <button type="button" class="delete-incident" data-delete-expense="${phase3Cell(row.id)}">Delete</button></td></tr>`).join('');
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
}
function renderPhase3() { renderAnalytics();renderInventory();renderExpenses(); }
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
[['ledger','#expenseTabLedger'],['nasir','#expenseTabNasir'],['aqib','#expenseTabAqib']].forEach(([key,sel])=>{$(sel)?.addEventListener('click',()=>{expenseActiveTab=key;syncExpenseTabs();if(key!=='ledger')renderPartnerShare(key);});});
$('#nasirShareMonth')?.addEventListener('change',event=>{nasirShareMonth=event.currentTarget.value;renderPartnerShare('nasir');});
$('#aqibShareMonth')?.addEventListener('change',event=>{aqibShareMonth=event.currentTarget.value;renderPartnerShare('aqib');});
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
renderPhase3();
refreshOwnerCenter = setupOwnerCenter({getState:()=>state,formatAmount,monthName,monthsForHistory,openCustomer:selectCustomer,switchView,renderMonthlyReport,renderAnalytics,renderInventory,renderExpenses}).refresh;

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
  if (note) note.textContent = `Bills for ${monthName(month)} (${month}) are generated and up to date for ${count} customer(s). New bills use each customer's saved package price; nothing is guessed.`;
  toast(`Bills for ${monthName(month)} are up to date (${count} customers).`);
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

  const phoneRes = formatWhatsAppUrl(customer.phone || '', msg);
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
  toast('Displaying pending customer slips. Tap "WhatsApp Reminder" on each slip to dispatch.');
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

  if (reminderMessageText) {
    reminderMessageText.value = msg;
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
if (typeof document !== 'undefined') {
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
  billingCycleModalController = setupBillingCycleModal(() => state, {
    onUpdateState: (newState) => {
      state = newState;
      save();
    },
    onToast: (msg, opts) => toast(msg, opts)
  });
  complaintRegisterModalController = setupComplaintRegisterModal(() => state, {
    onComplaintsChanged: () => {
      renderDashboard();
      renderDetail();
      if (downtimeAnalyticsModalController) downtimeAnalyticsModalController.refresh();
      if (monthlyComplaintReportModalController) monthlyComplaintReportModalController.refresh();
    },
    onToast: (msg, opts) => toast(msg, opts)
  });
  fieldTicketsModalController = setupFieldTicketsModal(() => state, {
    onTicketsChanged: () => {
      renderDashboard();
      renderDetail();
    },
    onToast: (msg, opts) => toast(msg, opts)
  });
  downtimeAnalyticsModalController = setupDowntimeAnalyticsModal(() => state, {
    onToast: (msg, opts) => toast(msg, opts)
  });
  monthlyComplaintReportModalController = setupMonthlyComplaintReportModal(() => state, {
    onToast: (msg, opts) => toast(msg, opts)
  });
  roznamchaModalController = setupRoznamchaModal(() => state, {
    onChanged: () => { renderDashboard(); },
    onToast: (msg, opts) => toast(msg, opts)
  });
  inventoryBookModalController = setupInventoryBookModal(() => state, {
    onInventoryChanged: () => renderDashboard(),
    onToast: (msg, opts) => toast(msg, opts)
  });
  outageImpactModalController = setupOutageImpactModal(() => state, {
    onToast: (msg, opts) => toast(msg, opts)
  });
  saadVisitsModalController = setupSaadVisitsModal(() => state, {
    onVisitsChanged: () => renderDashboard(),
    onToast: (msg, opts) => toast(msg, opts),
    listTicketIds: () => loadTickets().map((t) => t.id)
  });
  installTrackerModalController = setupInstallTrackerModal(() => state, {
    onRequestsChanged: () => renderDashboard(),
    onToast: (msg, opts) => toast(msg, opts)
  });
  pendingWorksModalController = setupPendingWorksModal(() => state, {
    onWorksChanged: () => renderDashboard(),
    onToast: (msg, opts) => toast(msg, opts),
    onConfirm: (opts) => appConfirm(opts)
  });
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
  staffPerformanceModalController = setupStaffPerformanceModal(() => state, {
    onToast: (msg, opts) => toast(msg, opts)
  });
  billingCorrectnessModalController = setupBillingCorrectnessModal({
    getState: () => state,
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  });
  lateFeeModalController = setupLateFeeModal({
    getState: () => state,
    updateState: (newState) => {
      state = newState;
      save();
      renderDetail();
      renderCustomers();
      renderDashboard();
    },
    toast: (msg) => toast(msg)
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

  customerOrlCertModalController = setupOrlCertModal({
    getState: () => state,
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  });

  const openOrlCertBtn = $('#openOrlCertBtn');
  if (openOrlCertBtn) {
    openOrlCertBtn.addEventListener('click', () => {
      const cust = selectedCustomerId ? state.customers.find(c => c.id === selectedCustomerId) : null;
      customerOrlCertModalController?.open(cust);
    });
  }

  customerDdmiCertModalController = setupDdmiCertModal({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  });

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

  customerDispersionModalController = setupDispersionCertModal({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  });

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

  customerBendLossModalController = setupBendLossCertModal({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts),
    getCustomerData: () => (selectedCustomerId ? state.customers.find(c => c.id === selectedCustomerId) : null)
  });

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

  customerBidirectionalOtdrModalController = setupBidirectionalOtdrModal({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts),
    getCustomerData: () => (selectedCustomerId ? state.customers.find(c => c.id === selectedCustomerId) : null)
  });

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

  customerOtdrDeadzoneModalController = setupOtdrDeadzoneModal({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  });

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

  customerSplitterQaModalController = setupSplitterQaModal({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  });

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

  customerFerruleGeometryModalController = setupFerruleGeometryModal({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  });

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

  customerFusionArcQaModalController = setupFusionArcQaModal({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  });

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

  customerStripForceQaModalController = setupStripForceQaModal({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    onToast: (msg, opts) => toast(msg, opts)
  });

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
  if (spliceModal) {
    customerSpliceMfdOffsetModalController = setupSpliceMfdOffsetModal({
      dialogElement: spliceModal,
      triggerButton: openSpliceMfdOffsetBtn,
      storage: typeof localStorage !== 'undefined' ? localStorage : null,
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

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
  if (sleeveModal) {
    customerSpliceSleeveCureModalController = setupSpliceSleeveCureModal({
      dialogElement: sleeveModal,
      triggerButton: openSpliceSleeveCureBtn,
      storage: typeof localStorage !== 'undefined' ? localStorage : null,
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

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
  if (cleaveModal) {
    customerFiberCleaveQualityModalController = setupFiberCleaveQualityModal({
      dialogElement: cleaveModal,
      triggerButton: openFiberCleaveQualityBtn,
      storage: typeof localStorage !== 'undefined' ? localStorage : null,
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

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
  if (ghostModal) {
    customerOtdrGhostArtifactModalController = setupOtdrGhostArtifactModal({
      dialogElement: ghostModal,
      triggerButton: openOtdrGhostArtifactBtn,
      storage: typeof localStorage !== 'undefined' ? localStorage : null,
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

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
  if (ribbonModal) {
    customerRibbonSpliceQaModalController = setupRibbonSpliceQaModal({
      state,
      dialogElement: ribbonModal,
      triggerButton: openRibbonSpliceQaBtn,
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

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
  if (fastModal) {
    customerFastConnectorQaModalController = setupFastConnectorQaModal({
      state,
      dialogElement: fastModal,
      triggerButton: openFastConnectorQaBtn,
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

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
  if (adssModal) {
    customerAdssSagTensionModalController = setupAdssSagTensionModal({
      state,
      dialogElement: adssModal,
      triggerButton: openAdssSagTensionBtn,
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

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
  if (armoredModal) {
    customerArmoredCableCrushModalController = setupArmoredCableCrushModal({
      state,
      dialogElement: armoredModal,
      triggerButton: openArmoredCableCrushBtn,
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

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
  if (jettingModal) {
    customerCableJettingModalController = setupCableJettingModal({
      state,
      dialogElement: jettingModal,
      triggerButton: openCableJettingBtn,
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

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
  if (tubeSlittingModal) {
    customerTubeSlittingModalController = setupTubeSlittingAccessModal({
      state,
      dialogElement: tubeSlittingModal,
      triggerButton: openTubeSlittingAccessBtn,
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

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
  if (conduitPullingModal) {
    customerConduitPullingModalController = setupConduitPullingModal({
      state,
      dialogElement: conduitPullingModal,
      triggerButton: openConduitPullingBtn,
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

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
  if (spectralAttenuationModal) {
    customerSpectralAttenuationModalController = setupSpectralAttenuationModal({
      state,
      dialogElement: spectralAttenuationModal,
      triggerButton: openSpectralAttenuationBtn,
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

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
  if (foscSealModal) {
    customerFoscSealModalController = setupFoscSealModal({
      state,
      dialogElement: foscSealModal,
      triggerButton: openFoscSealBtn,
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

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
  if (thermalCyclingModal) {
    customerThermalCyclingModalController = setupThermalCyclingModal({
      state,
      dialogElement: thermalCyclingModal,
      triggerButton: openThermalCyclingBtn,
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

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
  if (billingCorrectnessModal && !billingCorrectnessModalController) {
    billingCorrectnessModalController = setupBillingCorrectnessModal({
      getState: () => state,
      storage: typeof localStorage !== 'undefined' ? localStorage : null,
      onToast: (msg, opts) => toast(msg, opts)
    });
  }

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
  if (lateFeeModal && !lateFeeModalController) {
    lateFeeModalController = setupLateFeeModal({
      getState: () => state,
      updateState: (newState) => {
        state = newState;
        save();
        renderDetail();
        renderCustomers();
        renderDashboard();
      },
      toast: (msg) => toast(msg)
    });
  }

  const openCorrectnessBtn = $('#openBillingCorrectnessBtn');
  if (openCorrectnessBtn && !openCorrectnessBtn.dataset.wired) {
    openCorrectnessBtn.dataset.wired = 'true';
    openCorrectnessBtn.addEventListener('click', () => {
      billingCorrectnessModalController?.open();
    });
  }
  const mobileMoreCorrectnessBtn = $('#mobileMoreBillingCorrectnessBtn');
  if (mobileMoreCorrectnessBtn && !mobileMoreCorrectnessBtn.dataset.wired) {
    mobileMoreCorrectnessBtn.dataset.wired = 'true';
    mobileMoreCorrectnessBtn.addEventListener('click', () => {
      const moreMenu = $('#mobileMoreMenu');
      if (moreMenu) moreMenu.hidden = true;
      billingCorrectnessModalController?.open();
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
  const validViews = ['customers', 'transactions', 'reports', 'analytics', 'inventory', 'expenses'];
  if (validViews.includes(raw)) {
    switchView(raw, { pushHistory: false });
    if (raw === 'transactions') renderTransactions();
    else if (raw === 'reports') renderMonthlyReport();
    else if (raw === 'analytics') renderAnalytics();
    else if (raw === 'inventory') renderInventory();
    else if (raw === 'expenses') renderExpenses();
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
