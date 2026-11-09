/**
 * nav-quick-collect.js - 2-Tap Quick Collect Mobile Field Flow (agent2 - shahdara-mobile-nav)
 *
 * Designed for field collection rounds and on-the-spot subscriber billing in Shahdara:
 * 1. Tap 1: Open collection from bottom nav -> fast searchable customer picker prioritizing accounts with dues.
 * 2. Tap 2: Tap customer -> opens sheet prefilled with remaining balance, today's PKT date, and last-used payment method.
 * 3. Confirm: Creates immutable payment receipt via addPayment() from core.js.
 * 4. Success: Displays receipt card with instant 1-tap WhatsApp receipt dispatch, print slip, and next-customer collection loop.
 */

import {
  addPayment,
  applyConcessionToBill,
  deletePayment,
  calculatePaymentAllocations,
  derivedBillStatus,
  monthsForHistory,
  formatPKR,
  PAYMENT_METHODS,
  isDigitalPaymentMethod,
  isCashPaymentMethod,
  findDuplicatePaymentReference,
  removeConcessionFromBill,
  waiveLateFeeFromBill,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
  saveBillMonth,
  autoPackageFromPayment,
  autoPackageRollbackOf,
  rollbackAutoPackage,
  manualBaqayaOutstandingCents,
  planManualBaqayaSettlement,
  paymentSenderLabel,
  prepayTermsOf,
  whatsappPhoneFor,
  listTransactions
} from './core.js';
import { looseChangeChipsMarkup, looseChangeCreditCents } from './loose-change-credit.js';
import { BILL_PACKAGES, billPackageById, billPackageByLabel, validateBillPackageSnapshot } from './package-catalog.js';
import { salesTaxCentsForPrice, salesTaxCentsOfBill } from './package-sales-tax.js';
import { packageSuccessMessage, packageSuccessMessageOrDefault } from './package-success-message.js';
import { handlingNoteAlertHtml, handlingNoteForCustomer } from './handling-note.js';
import { openPromisesForCustomer, promisePaymentLinkSelectOptions } from './promise-payment-link.js';
import { dailyEntrySummary, dailyEntrySummaryText } from './daily-entry-summary.js';
import { quickCollectRoundTotals, quickCollectRoundTotalsText } from './quick-collect-round-totals.js';
import { dailyTargetProgress, dailyTargetProgressHtml } from './daily-target-progress.js';
import { quickCollectEndOfDaySummary, quickCollectEndOfDaySummaryHtml } from './quick-collect-end-of-day-summary.js';
import {
  quickAddCustomer,
  quickAddFormFieldsHtml,
  quickAddCustomerSummaryText,
} from './quick-collect-new-customer-quick-add.js';
import { getDayTarget } from './day-target.js';
import { standingInstructionLineHtml, standingInstructionForCustomer } from './standing-instruction-note.js';
import { packagePriceForCustomer, resolveQuickAmount, packageChipLabel } from './quick-amount-buttons.js';
import {
  quickCollectOneScreenDraft,
  quickCollectOneScreenHtml,
  quickCollectOneScreenDuesText
} from './quick-collect-one-screen.js';
import { oneScreenQuickAmountFigures, oneScreenQuickAmountButtonsHtml } from './one-screen-quick-amounts.js';
import { addPaymentDuesFigures, addPaymentDuesButtonsHtml } from './add-payment-dues-buttons.js';
import { repeatPaymentFormTarget, repeatPaymentHtml } from './repeat-payment.js';
import {
  namePrefixLookupHtml,
  namePrefixLookupMatches
} from './name-prefix-lookup.js';
import { pickerDuesTextForMatches } from './picker-dues.js';
import {
  findCustomersByLastFourDigits,
  lastFourDigitsHtml
} from './last-four-digits-search.js';
import {
  filterQuickCollectByMohalla,
  quickCollectMohallaFilterKey,
  quickCollectMohallaFilterOptionsHtml,
  quickCollectMohallaFilterSummaryText,
  resolveQuickCollectMohallaFilter
} from './quick-collect-mohalla-filter.js';
import { amountKeypadApplyKey, amountKeypadHtml } from './quick-collect-amount-keypad.js';
import {
  recentQuickPickEntries,
  recentQuickPickHtml
} from './recent-quick-pick.js';
import { rememberedPaymentMethod } from './remembered-method.js';
import { cashChangeLineText } from './cash-change-calculator.js';
import { splitTotalLineText } from './split-total.js';
import {
  createDoubleTapSaveGuard,
  doubleTapSaveGuardKey,
  doubleTapSaveGuardTryStart,
  doubleTapSaveGuardFinish,
  doubleTapSaveGuardIsSaving,
  doubleTapSaveGuardSetDisabled
} from './double-tap-save-guard.js';
import { bigWalletMethodIsOtherMethod } from './big-wallet-method-buttons.js';
import { pendingClearanceFlagForMethod, pendingClearanceFlagForReceipt, pendingClearanceEntryFlagForMethod } from './pending-clearance-flag.js';
import { DEFAULT_MOHALLAS, canonicalMohalla } from './phase3.js';
import { billKistTotal } from './installment-plan.js';
import { buildSameNameIndex, sameNameBadgeHtml } from './name-disambiguator.js';
import { isBillingPaused } from './pause-billing.js';
import { loadComplaints } from './complaint-register.js';
import {
  billedTicketChargesPending,
  loadTickets,
  pendingTicketChargeLines,
  planTicketChargeSettlement,
  saveTickets,
  settleTicketCharges,
  unsettleTicketChargesForPayment
} from './complaint-tickets.js';
import {
  addonChargesPending,
  pendingAddonChargeLines,
  planAddonChargeSettlement,
  settleAddonCharges,
  unsettleAddonChargesForPayment
} from './speed-addon.js';
import { buildConcessionSuggestion, buildUptimeConcessionSuggestion, concessionBadgeText, roundedConcessionSuggestion } from './concession-helper.js?v=1.11.0';
import { planLateFeeWaiver, lateFeeWaiverRefusal, waivedLateFeeStampFor, lateFeeWaiverOf, restoreWaivedLateFee } from './late-fee-waiver.js';
import { normalPaymentBlockReason, advanceTargetMonthOptions, defaultAdvanceTargetMonth } from './advance-payment.js';
import { findRecentDuplicate, duplicatePaymentBypassKey, askDuplicatePayment } from './duplicate-payment-guard.js';
import { buildMonthlyUptime, splitMinutes } from './uptime-tracking.js';
import { computePaymentDateChip, isFuturePaymentDate } from './backdated-payment-helper.js';
import {
  setCustomerWaada,
  clearCustomerWaada,
  isValidWaadaDate,
  computeRemainderWaada,
  remainderWaadaChipDates,
  remainderWaadaOf,
  remainderWaadaPreviousOf,
  isRemainderWaadaCurrent,
  REMAINDER_WAADA_NOTE
} from './waada-queue.js';
import { sanitizeReceiptLang, receiptLangPreference } from './receipt-preferences.js';
import { ensureUrduFont, t } from './nav-language.js';
import { buildReceiptPaymentHistory } from './receipt.js';
import {
  getDigitalPaymentsSettings,
  hasConfiguredDigitalPayments,
  formatDigitalPaymentReceiptNote,
  formatDigitalPaymentWhatsAppText
} from './digital-payments-settings.js';
import { getReceiptFooter, buildReceiptFooterLines, buildReceiptFooterText } from './receipt-footer-studio.js';
import { receiptTermsNoteHtml, receiptTermsNoteText } from './receipt-terms.js';
import { oldestOpenBillPrefill, transactionPrefillLineHtml } from './transaction-prefill.js';
import { duesAmountDefault } from './dues-amount-default.js';
import { amountInWords, amountInWordsLineText } from './amount-in-words.js';
import { nextReceiptNumberFor, nextReceiptNumberLineText } from './next-receipt-number.js';
import { normalizeCollectionPlace } from './collection-place-note.js';
import { normalizeSaveConfirmationSummary, saveConfirmationSummaryHtml, saveConfirmationSummaryKey } from './save-confirmation-summary.js';
import { receiptPreviewFor, receiptPreviewHtml } from './receipt-preview.js';
import { successNextStepsFromReceipt, successNextStepsHtml, successNextStepsNextDueDate } from './success-next-steps.js';
import { receiptShareDraftFor, receiptShareDraftHtml } from './receipt-share-draft.js';
import { stillOwesCents, stillOwesLine, stillOwesLineHtml } from './quick-collect-still-owes.js';
import { bigNameConfirmLine, bigNameConfirmLineHtml } from './quick-collect-big-name-confirm.js';
import {
  secondConnectionStep,
  secondConnectionStepHtml,
  secondConnectionSummaryText,
  secondConnectionTotalCents,
  secondConnectionValidAmountCents,
} from './quick-collect-second-connection.js';
import { QUICK_COLLECT_REVERSAL_UNDO_WINDOW_MS, QUICK_COLLECT_REVERSAL_UNDO_REASON, quickCollectReversalUndoAllowed, quickCollectReversalUndoSecondsLeft, quickCollectReversalUndoButtonText, quickCollectReversalUndoIsPlainPayment, quickCollectReversalUndoFields } from './quick-collect-reversal-undo.js';
import { offlineSavedBadge, offlineSavedBadgeHtml, offlineSavedBadgeLatestTime } from './offline-saved-badge.js';
import { settlementPreview, settlementPreviewMarkup } from './partial-settlement-preview.js';
import { overpaymentExtraCents } from './overpayment-choice.js';
import { requiresLargeCashApproval, LARGE_CASH_DEFAULT_THRESHOLD_CENTS } from './large-cash-approval.js';
import { underpaymentWarning, underpaymentWarningLineText } from './underpayment-warning.js';
import { openSuspensionFor, suspendedWarningLineText } from './suspended-warning.js';
import { formatWhatsAppUrl } from './form-validation.js';
import { contributorSnapshotFor, subContributorsOf } from './shared-router-contributors.js';
import { thermalPrinter, buildEscPosReceipt, isWebBluetoothAvailable } from './thermal-printer.js?v=1.11.0';
import {
  isReceiptShared,
  markReceiptShared,
  renderReceiptSharedBadgeHtml
} from './nav-quick-profile.js';
// Plan 5 (Plan 1-100): every field receipt created here starts with a
// delivery entry in status 'generated'; dispatch still goes through
// markReceiptShared, and receipt-delivery.js bridges that record to
// a 'sent' entry, so delivery tracking never touches receipt money.
import { createReceiptDelivery } from './receipt-delivery.js';
import {
  executeSplitTenderCollection,
  formatSplitTenderWhatsAppText,
  renderSplitReceiptCardHtml
} from './split-tender-collect.js';
import {
  announcePaymentSuccess,
  trapModalFocus
} from './nav-accessibility.js';
import { resolveShopCollector, shopCollectorMethods } from './shop-settlement.js';

export const QUICK_COLLECT_STORAGE_KEY = 'shahdara_quick_collect_last_used_v1';
export const QUICK_COLLECT_AUDIT_KEY = 'shahdara_quick_collect_audits_v1';

// ------------------------------------------------------ Payment proof image --
// Owner feature (2026-10-29): a payment can carry ONE proof screenshot —
// the wallet receipt image the customer sent, attached by the operator at
// save time and kept on the payment record (payment.screenshot). The
// ledger lives in localStorage under the storage-safety quota guard
// (SAVE_SIZE_WARN_BYTES = 4 MB), so a raw 1-4 MB phone screenshot must
// NEVER be stored as picked: every proof is downscaled + recompressed
// here first, and the stored data URL is capped at
// PAYMENT_PROOF_MAX_DATA_URL_LENGTH characters (~200 KB — small enough
// that many proofs fit before the guard warns, and comfortably inside
// the 350,000-char outer sanitize ceiling validatePayment applies to
// records that arrived by any path). The ladder tries the full 1024 px
// size first, steps JPEG quality down, then the dimension down, until
// the data URL fits; if nothing fits it refuses with a 'proof-too-large'
// coded error and nothing is stored. Receipt PNGs are generated, never
// stored — this is the only image the ledger keeps.
export const PAYMENT_PROOF_MAX_DIMENSION = 1024;
export const PAYMENT_PROOF_MAX_DATA_URL_LENGTH = 200_000;
export const PAYMENT_PROOF_DIMENSION_STEPS = [1024, 832, 640, 512];
export const PAYMENT_PROOF_QUALITY_STEPS = [0.82, 0.7, 0.58, 0.46, 0.34];

/** Pure: fit (width, height) inside maxDimension on the longest side; never upscales. */
export function planPaymentProofSize(width, height, maxDimension = PAYMENT_PROOF_MAX_DIMENSION) {
  const w = Number(width);
  const h = Number(height);
  const max = Number(maxDimension);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0 || !Number.isFinite(max) || max <= 0) return null;
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** Pure: the stored-proof shape rule — an image data URL within the storage cap. */
export function isPaymentProofDataUrl(value, maxLength = PAYMENT_PROOF_MAX_DATA_URL_LENGTH) {
  return typeof value === 'string' && value.startsWith('data:image/') && value.length <= maxLength;
}

function proofTooLargeError() {
  const error = new Error('Payment proof image could not be shrunk enough to store safely.');
  error.code = 'proof-too-large';
  return error;
}

// Browser defaults for the compression pipeline, behind injectable deps
// so the ladder itself is unit-testable in Node with fakes (no DOM).
async function decodeProofImageDefault(source) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(source); } catch { /* fall through to <img> decode */ }
  }
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
    return img;
  } finally { URL.revokeObjectURL(url); }
}
function drawProofCanvasDefault(image, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(image, 0, 0, width, height);
  return canvas;
}
function encodeProofJpegDefault(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Could not encode payment proof image.')); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read payment proof image.'));
      reader.readAsDataURL(blob);
    }, 'image/jpeg', quality);
  });
}

/**
 * Downscale + recompress a picked image into a storable proof data URL
 * (the cap ladder above). Resolves with a string accepted by
 * isPaymentProofDataUrl; rejects with a 'proof-too-large' coded error
 * when even the smallest ladder step cannot fit the cap.
 */
export async function compressPaymentProofImage(source, deps = {}) {
  const decodeImage = deps.decodeImage ?? decodeProofImageDefault;
  const drawCanvas = deps.drawCanvas ?? drawProofCanvasDefault;
  const encodeJpeg = deps.encodeJpeg ?? encodeProofJpegDefault;
  const image = await decodeImage(source);
  const srcWidth = Number(image?.width ?? image?.naturalWidth);
  const srcHeight = Number(image?.height ?? image?.naturalHeight);
  try {
    for (const maxDimension of PAYMENT_PROOF_DIMENSION_STEPS) {
      const plan = planPaymentProofSize(srcWidth, srcHeight, maxDimension);
      if (!plan) break;
      const canvas = drawCanvas(image, plan.width, plan.height);
      for (const quality of PAYMENT_PROOF_QUALITY_STEPS) {
        const dataUrl = await encodeJpeg(canvas, quality);
        if (isPaymentProofDataUrl(dataUrl)) return dataUrl;
      }
    }
  } finally {
    if (typeof image?.close === 'function') { try { image.close(); } catch { /* already released */ } }
  }
  throw proofTooLargeError();
}

/**
 * Returns current date formatted as YYYY-MM-DD in Pakistan Standard Time (PKT).
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function getPakistanLocalDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Helper to escape HTML characters in strings for safe rendering.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Retrieves unarchived customers formatted for quick field collection.
 * Sorted with largest dues first for fast field recovery.
 *
 * @param {Object} state - Billing state
 * @param {string} [query=''] - Search term (matches name, number, phone, area, mohalla)
 * @param {('all-dues'|'high-dues'|'all')} [filterType='all-dues']
 * @param {Date} [referenceDate=new Date()]
 * @returns {Array<Object>}
 */
export function getPendingCollectionCustomers(state, query = '', filterType = 'all-dues', referenceDate = new Date()) {
  if (!state || !Array.isArray(state.customers)) return [];
  const allocations = calculatePaymentAllocations(state);
  const currentMonth = monthsForHistory(referenceDate)[0];
  const normalizedQuery = String(query ?? '').normalize('NFKC').trim().toLowerCase();

  const list = [];
  for (const customer of state.customers) {
    if (customer.archived) continue;

    let totalDuesCents = 0;
    let earliestUnpaidMonth = null;
    let currentMonthBalanceCents = 0;
    const bills = [...(customer.bills ?? [])].sort((a, b) => a.month.localeCompare(b.month));

    for (const bill of bills) {
      const summary = allocations.forMonth(customer.id, bill.month);
      const balance = summary?.balanceDueCents;
      if (typeof balance === 'number' && balance > 0) {
        totalDuesCents += balance;
        if (!earliestUnpaidMonth) {
          earliestUnpaidMonth = bill.month;
        }
      }
      if (bill.month === currentMonth && typeof balance === 'number') {
        currentMonthBalanceCents = balance;
      }
    }

    const targetMonth = earliestUnpaidMonth || currentMonth;
    const targetSummary = allocations.forMonth(customer.id, targetMonth);
    const targetDueCents = targetSummary?.balanceDueCents ?? 0;

    let lastMethod = 'Cash';
    let lastPaidBy = '';
    const allPayments = bills.flatMap(b => b.payments ?? []).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    if (allPayments.length > 0) {
      const lastP = allPayments[allPayments.length - 1];
      if (lastP.method && PAYMENT_METHODS.includes(lastP.method)) {
        lastMethod = lastP.method;
      }
      if (lastP.paidBy) {
        lastPaidBy = lastP.paidBy;
      }
    }

    // Owner feature (2026-10-29): the entry's total dues are the SHARED
    // total — engine bill dues plus unpaid manual baqaya — so the
    // picker, Field Mode and Bulk Collect all show (and collect) the
    // baqaya with the bills. The bill-only figure stays on the entry
    // for surfaces that split the two.
    const manualBaqayaDueCents = manualBaqayaOutstandingCents(customer);
    const totalDues = Math.max(0, (totalDuesCents + manualBaqayaDueCents) / 100);
    const targetDue = Math.max(0, targetDueCents / 100);

    // Apply filter criteria
    if (filterType === 'all-dues' && totalDues <= 0) continue;
    if (filterType === 'high-dues' && totalDues < 2000) continue;

    // Apply search query
    if (normalizedQuery) {
      const numStr = String(customer.customerNumber ?? '');
      const match =
        customer.name.toLowerCase().includes(normalizedQuery) ||
        numStr.includes(normalizedQuery) ||
        `#${numStr}`.includes(normalizedQuery) ||
        (customer.phone && customer.phone.toLowerCase().includes(normalizedQuery)) ||
        (customer.area && customer.area.toLowerCase().includes(normalizedQuery)) ||
        (customer.mohalla && customer.mohalla.toLowerCase().includes(normalizedQuery)) ||
        (customer.address && customer.address.toLowerCase().includes(normalizedQuery));
      if (!match) continue;
    }

    list.push({
      id: customer.id,
      customerNumber: customer.customerNumber,
      name: customer.name,
      phone: customer.phone || '',
      area: customer.mohalla || customer.area || 'Unassigned',
      mohalla: customer.mohalla || '',
      address: customer.address || '',
      serviceStatus: customer.serviceStatus || 'not-set',
      totalDues,
      billDues: Math.max(0, totalDuesCents / 100),
      manualBaqayaDue: manualBaqayaDueCents / 100,
      targetMonth,
      targetDue,
      currentMonthBalance: Math.max(0, currentMonthBalanceCents / 100),
      lastPaymentMethod: lastMethod,
      lastPaidBy,
      billsCount: bills.length
    });
  }

  // Sort: highest total dues first, then customer number ascending
  list.sort((a, b) => {
    if (b.totalDues !== a.totalDues) {
      return b.totalDues - a.totalDues;
    }
    return a.customerNumber - b.customerNumber;
  });

  return list;
}

/**
 * Computes default prefilled values for a 2-tap payment collection sheet.
 *
 * @param {Object} state
 * @param {string} customerId
 * @param {Date} [referenceDate=new Date()]
 * @returns {Object}
 */
export function getCustomerPaymentDefaults(state, customerId, referenceDate = new Date(), tickets = null) {
  if (!state || !Array.isArray(state.customers)) {
    throw new Error('State must contain customers list.');
  }
  const customer = state.customers.find(c => c.id === customerId);
  if (!customer) {
    throw new Error(`Customer ${customerId} not found.`);
  }
  if (customer.archived) {
    throw new Error('Archived customers cannot receive payments. Unarchive the customer first.');
  }

  const allocations = calculatePaymentAllocations(state);
  const currentMonth = monthsForHistory(referenceDate)[0];
  const bills = [...(customer.bills ?? [])].sort((a, b) => a.month.localeCompare(b.month));

  // Plan 376: the transaction entry pre-fill — the customer's oldest
  // open bill, its amount and its month — names the oldest bill under
  // the field. It comes from the allocation engine's own figures, so
  // the named amount is the amount still open on that bill.
  // (Plan 429 / Plan 522: the offered starting amount itself is the
  // customer's full dues, read below — the pre-fill is the reference,
  // not the amount.)
  const prefill = oldestOpenBillPrefill(customer, allocations);
  const earliestUnpaidMonth = prefill ? prefill.month : null;
  const targetDue = prefill ? prefill.amount : 0;

  let totalDuesCents = 0;
  let currentMonthBalanceCents = 0;
  for (const bill of bills) {
    const summary = allocations.forMonth(customer.id, bill.month);
    const balance = summary?.balanceDueCents;
    if (typeof balance === 'number' && balance > 0) {
      totalDuesCents += balance;
    }
    if (bill.month === currentMonth && typeof balance === 'number') {
      currentMonthBalanceCents = balance;
    }
  }

  const targetMonth = earliestUnpaidMonth || currentMonth;
  const totalDues = Math.max(0, totalDuesCents / 100);
  // Polish #11: the target bill's package + tax, read-only — the
  // collection screen shows the bill's own figures, so it can never
  // disagree with the bill. Null when the target bill carries no
  // package snapshot / no tax.
  const targetBill = bills.find(b => b.month === targetMonth) ?? null;
  const targetBillSalesTaxCents = salesTaxCentsOfBill(targetBill);
  const targetBillSnapshot = validateBillPackageSnapshot(targetBill?.packageSnapshot);
  const targetBillPackage = targetBillSnapshot ? { label: targetBillSnapshot.label, price: targetBillSnapshot.nominalPrice } : null;

  // Plan 429: the amount defaults to the customer's FULL current dues
  // — every open bill plus unpaid manual baqaya, the same shared total
  // the picker shows — filled in as soon as the customer is chosen.
  // The oldest-bill pre-fill still names its bill under the field; it
  // is no longer the amount. A customer with no dues defaults to
  // nothing: the default is null and the field starts blank.
  // (The baqaya figure is read here, before the charge lines below,
  // because the default needs it; the payable total still adds it in
  // below, exactly as before.)
  const manualBaqayaPendingCents = manualBaqayaOutstandingCents(customer);
  const duesDefault = duesAmountDefault(customer, allocations, manualBaqayaPendingCents);
  let suggestedAmount = duesDefault !== null ? duesDefault : 0;
  // Plan 376: a customer with no open bill offers nothing — the
  // package price is never offered as a bill figure. (The monthly
  // selling amount used to be the last fallback here; an advance for
  // a fully-paid customer is typed by the operator instead, with the
  // Advance tag still pre-ticked below.)

  // Plan 431: the remembered method — the method of the customer's last
  // payment, pre-selected on the Quick Collect screen. A customer with
  // no past payment remembers nothing: defaultMethod is null and the
  // form pre-selects nothing (the operator picks; the save path still
  // records Cash when nothing is chosen, exactly as before). The
  // device-wide last-used fallback is gone from here — it was not
  // per-customer memory. (The save path still writes the device's
  // last-used method; the split-tender snapshot still reads it.)
  const lastMethod = rememberedPaymentMethod(customer, PAYMENT_METHODS);
  let lastPaidBy = '';
  const allPayments = bills.flatMap(b => b.payments ?? []).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  if (allPayments.length > 0) {
    const lastP = allPayments[allPayments.length - 1];
    if (lastP.paidBy) {
      lastPaidBy = lastP.paidBy;
    }
  }

  // SISP-43: pending billed ticket charges (SISP-12) join the payable.
  // Tickets live outside the ledger state, so the caller passes the
  // current ticket list; without one the defaults stay bill-only,
  // exactly as before. When charges are pending, the 1-tap suggested
  // amount is the FULL payable (bill dues + charges) so one collection
  // settles both — the spec scenario: 3,000 bill + 500 charge = 3,500.
  const ticketChargeLines = Array.isArray(tickets) ? pendingTicketChargeLines(tickets, customerId) : [];
  const ticketChargesPendingCents = ticketChargeLines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0);
  const ticketChargesPending = ticketChargesPendingCents / 100;
  // SISP-106: pending speed-boost add-on fees (logged on the customer
  // record) join the payable the same way — but only on this surface,
  // which is the charge-settling one (the caller passes the ticket
  // list); without it the defaults stay bill + ticket only, exactly as
  // before, so Field Mode / bulk collect never see boost charges.
  const addonChargeLines = Array.isArray(tickets) ? pendingAddonChargeLines(customer) : [];
  const addonChargesPendingCents = addonChargeLines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0);
  const addonChargesPendingTotal = addonChargesPendingCents / 100;
  // Owner feature (2026-10-29): unpaid manual baqaya joins the payable
  // the same way — it lives on the customer record, so no caller list
  // is needed. The suggested amount covers it too, so one collection
  // settles bills + baqaya (executeQuickCollection stamps the split).
  // (The cents figure itself is read above, where the Plan 429
  // default needs it.)
  const manualBaqayaPending = manualBaqayaPendingCents / 100;
  const payableTotal = (totalDuesCents + ticketChargesPendingCents + addonChargesPendingCents + manualBaqayaPendingCents) / 100;
  if ((ticketChargesPending > 0 || addonChargesPendingTotal > 0 || manualBaqayaPending > 0) && payableTotal > 0) {

    suggestedAmount = payableTotal;
  }

  return {
    customer,
    customerId: customer.id,
    customerNumber: customer.customerNumber,
    name: customer.name,
    phone: customer.phone || '',
    area: customer.mohalla || customer.area || 'Unassigned',
    targetMonth,
    suggestedAmount,
    balanceDue: targetDue,
    prefill,
    targetBillSalesTaxCents,
    targetBillPackage,
    currentMonthBalance: Math.max(0, currentMonthBalanceCents / 100),
    totalDues,
    ticketChargeLines,
    ticketChargesPending,
    addonChargeLines,
    addonChargesPending: addonChargesPendingTotal,
    manualBaqayaPending,

    payableTotal,
    todayDate: getPakistanLocalDate(referenceDate),
    defaultMethod: lastMethod,
    lastPaidBy
  };
}

/**
 * Polish #13: after a package change (or its Undo) reopens the form,
 * the amount field must end up at the operator's figure, not silently
 * back at the new prefill. The reopen always re-prefills from the new
 * dues, so the caller captures the field's value and the suggested
 * amount it was holding BEFORE the reopen and asks this helper what
 * to pass to openCustomerCollectionForm:
 *  - the captured figure differs from the old suggested amount, so
 *    the operator had entered/selected it — carry it over verbatim
 *    (the operator's explicit entry always wins over a re-prefill);
 *  - it equals the old suggested amount, so the field still held the
 *    old prefill — follow the new bill instead: the current month's
 *    balance after the change (balanceDue). A typed figure that
 *    happens to equal the old prefill exactly is treated as untouched
 *    here — the package change implies the new bill, and the operator
 *    can re-type;
 *  - balanceDue is null (bill skipped — free connection or a
 *    billing-paused month, where the new price applies from the next
 *    billed month) — no override, the fresh prefill stands.
 * Pure: decides only, writes nothing. The Undo path passes balanceDue
 * null: on the restored state the fresh prefill IS the old prefill, so
 * an untouched field needs no override there.
 *
 * @param {string} capturedValue - amount field's value before the reopen
 * @param {number|null} oldSuggestedAmount - suggestedAmount before the reopen
 * @param {number|null} balanceDue - current month's balance after the change
 * @returns {{ amountOverride?: string|number }} options for openCustomerCollectionForm
 */
export function packageChangeAmountOptions(capturedValue, oldSuggestedAmount, balanceDue) {
  const capturedNumber = Number(capturedValue);
  const wasTouched = !(Number.isFinite(capturedNumber) && capturedNumber === oldSuggestedAmount);
  if (wasTouched) return { amountOverride: capturedValue };
  if (typeof balanceDue === 'number') return { amountOverride: balanceDue };
  return {};
}

/**
 * Owner feature (2026-10-29): change a customer's package from inside the
 * Quick Collect payment step — e.g. the customer was on the PKR 1,000
 * package last month and takes the PKR 2,000 package this month. The plan
 * changes from the CURRENT month onward and that month's bill is (re)made
 * at the new package in the same action, so the collector never leaves
 * the sheet and never retypes anything.
 *
 * This invents no parallel machinery — every step is an existing path:
 *  - the plan change itself goes through core updateCustomerProfile, the
 *    exact profile path: packageSpeed + monthlySellingAmount are updated,
 *    a packageHistory audit entry is appended (old/new package + rates,
 *    staff "Quick Collect") and the price schedule is written with the
 *    profile's own effective-month rule (current month when no bill
 *    exists yet, next month when one does);
 *  - a MISSING current-month bill is then created by
 *    generateMonthlyBillsThroughCurrentMonth, which prices it from that
 *    schedule — the new package;
 *  - an EXISTING current-month bill is repriced to the new package
 *    through core saveBillMonth, the profile bill editor's own write
 *    (its amountHistory records previous → new amount). Only the package
 *    portion moves: any kist already riding the bill (SISP-4) is
 *    preserved on top of the new fee. Payments already recorded stay
 *    recorded — calculatePaymentAllocations remains the single source of
 *    truth for what is now due (paid 1,000 toward a bill that becomes
 *    2,000 leaves 1,000 due; a downgrade past what was paid leaves the
 *    excess as pending credit, exactly as the engine already rules).
 *
 * Standing rules hold: a FREE connection (isFreeConnection) records the
 * plan change but NEVER gets a bill or dues from it, and a billing-paused
 * current month (SISP-8) is never billed — the new package applies from
 * the next billed month instead.
 *
 * Returns { nextState, changed, reason?, customerId, package, month,
 * bill, billRepriced, billCreated, billSkipped, balanceDue } where
 * balanceDue is the current month's balance after the change, read from
 * the allocation engine (null when the month has no priced bill).
 * Picking the package the customer is already on (same label AND same
 * fee) is a no-op: changed=false, reason 'same-package', state returned
 * untouched (same reference).
 */
export function changeCustomerPackage(state, customerId, packageId, referenceDate = new Date()) {
  const plan = billPackageById(packageId);
  if (!plan) throw new Error('Choose one of the available packages.');
  const customer = state?.customers?.find(c => c.id === customerId);
  if (!customer) throw new Error('Customer not found.');
  if (customer.archived) throw new Error('Archived customers cannot change package. Unarchive the customer first.');

  const centsOf = (value) => Math.round(Number(value || 0) * 100);
  const month = getPakistanLocalDate(referenceDate).slice(0, 7);
  const currentFee = customer.monthlySellingAmount;
  const currentFeeCents = currentFee === null || currentFee === undefined || currentFee === ''
    ? null
    : centsOf(currentFee);
  if ((customer.packageSpeed ?? '') === plan.label && currentFeeCents === centsOf(plan.price)) {
    return { nextState: state, changed: false, reason: 'same-package', customerId, package: plan, month };
  }

  let next = updateCustomerProfile(state, customerId, {
    packageSpeed: plan.label,
    monthlySellingAmount: plan.price,
    packageChangeStaffName: 'Quick Collect'
  }, referenceDate);

  let updated = next.customers.find(c => c.id === customerId);
  let bill = (updated.bills ?? []).find(b => b.month === month) ?? null;
  let billRepriced = false;
  let billCreated = false;
  let billSkipped = null;
  if (updated.isFreeConnection === true) {
    billSkipped = 'free-connection';
  } else if (isBillingPaused(updated, month)) {
    billSkipped = 'paused';
  }

  if (!billSkipped) {
    if (bill) {
      // Reprice the package portion only — kist already billed into this
      // month (SISP-4) is an installment obligation, not package price,
      // so it rides on top of the new fee unchanged. With no kist, the
      // package id goes along so the bill gains the package snapshot,
      // exactly as the profile bill editor records it; with kist,
      // saveBillMonth must take the explicit total (a package id would
      // make it prefer the catalogue price and drop the kist).
      const kistCents = centsOf(billKistTotal(bill));
      const targetCents = centsOf(plan.price) + kistCents;
      const alreadyPriced = bill.dueAmount !== null && bill.dueAmount !== undefined && bill.dueAmount !== ''
        && centsOf(bill.dueAmount) === targetCents;
      if (!alreadyPriced) {
        // Polish #11: a bill that already carries sales tax keeps its
        // tax on the new package — recomputed at 19.5% of the new
        // price — so the recorded tax always matches the price
        // actually billed. A bill with no tax gains none here. With
        // kist the explicit total must carry the recorded tax too,
        // because the kist branch cannot pass a package id (see above)
        // and the recorded tax is the old package's — the snapshot
        // itself stays stale in that branch, exactly as before.
        const hadTaxCents = salesTaxCentsOfBill(bill);
        const newTaxCents = hadTaxCents !== null ? salesTaxCentsForPrice(plan.price) : null;
        next = kistCents > 0
          ? saveBillMonth(next, customerId, { month, dueAmount: (targetCents + (hadTaxCents ?? 0)) / 100, status: 'pending' }, referenceDate)
          : saveBillMonth(next, customerId, { month, dueAmount: plan.price, status: 'pending', packageId: plan.id, ...(newTaxCents !== null ? { salesTaxCents: newTaxCents } : {}) }, referenceDate);
        billRepriced = true;
      }
    } else {
      next = generateMonthlyBillsThroughCurrentMonth(next, referenceDate);
      billCreated = true;
    }
    updated = next.customers.find(c => c.id === customerId);
    bill = (updated.bills ?? []).find(b => b.month === month) ?? null;
    if (billCreated && !bill) billCreated = false;
  }

  const allocations = calculatePaymentAllocations(next);
  const summary = allocations.forMonth(customerId, month);
  return {
    nextState: next,
    changed: true,
    customerId,
    package: plan,
    month,
    bill,
    billRepriced,
    billCreated,
    billSkipped,
    balanceDue: summary && typeof summary.balanceDueCents === 'number' ? summary.balanceDueCents / 100 : null
  };
}

/**
 * Executes confirmed quick collection and creates the immutable receipt record.
 *
 * @param {Object} state
 * @param {Object} fields - { customerId, month, amount, date, method, paidBy }
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ nextState: Object, receipt: Object }}
 */
export function executeQuickCollection(state, {
  customerId,
  month,
  amount,
  date,
  method,
  paidBy,
  collectedBy,
  collectionPlace,
  collectionMohalla,
  urduNote,
  crossPayment,
  overpaymentChoice,
  overpaymentDuesCents,
  excessCashNote,
  excessCashDuesCents,
  largeCashApproval,
  largeCashThresholdCents,
  categoryTag,
  promiseLink,
  transactionId,
  senderTitle,
  senderDigits,
  referenceOverrideReason,
  screenshot,
  strictDigitalReference,
  enforceDigitalReference,
  tickets,
  kind,
  advanceTargetMonth,
  paidByContributorId,
  remainderWaadaDate,
  waiveLateFee,
  // Plan 449: the connection this payment is recorded against — the
  // second connection of a two-connection customer, named on the
  // payment and its receipt so the pair of payments in one visit
  // says which connection each belongs to.
  connection
}, referenceDate = new Date()) {
  if (!customerId) throw new Error('Customer ID is required.');
  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    throw new Error('Enter a valid collected amount greater than zero.');
  }

  const customer = state?.customers?.find(c => c.id === customerId);
  if (!customer) {
    throw new Error(`Customer ${customerId} not found.`);
  }
  if (customer.archived) {
    throw new Error('Archived customers cannot receive payments. Unarchive the customer first.');
  }

  const pDate = date || getPakistanLocalDate(referenceDate);
  const targetMonth = month || monthsForHistory(referenceDate)[0];
  const pMethod = method || 'Cash';
  if (!PAYMENT_METHODS.includes(pMethod)) {
    throw new Error(`Choose a valid payment method from: ${PAYMENT_METHODS.join(', ')}`);
  }

  const isDigital = isDigitalPaymentMethod(pMethod);
  const cleanTxnId = String(transactionId ?? '').trim().slice(0, 64);
  const cleanReason = String(referenceOverrideReason ?? '').trim().slice(0, 100);

  if ((strictDigitalReference || enforceDigitalReference) && isDigital && !cleanTxnId && !cleanReason) {
    throw new Error('Transaction ID / last 6 digits is required for digital payments (or provide an override reason).');
  }

  // Save last used method preference to device storage
  try {
    localStorage.setItem(QUICK_COLLECT_STORAGE_KEY, pMethod);
  } catch {
    // Ignore storage issues
  }

  // SISP-43: when the caller supplies the ticket list, the part of the
  // collection that exceeds the customer's total bill dues settles
  // pending billed ticket charges — whole charges, oldest first. The
  // settled lines are stamped onto the payment itself (core keeps that
  // portion out of bill allocation), so the cash has exactly one ledger
  // record and the tickets are marked paid against it below.
  // Owner feature (2026-10-29): unpaid manual baqaya settles from the
  // SAME remainder, BEFORE ticket charges take from it — the owner's
  // model is oldest dues first, and a baqaya entry is by definition an
  // old due. FIFO date order, partial settlement of the last entry
  // reached allowed; the settled lines are stamped onto the payment
  // (payment.manualBaqayaSettlements), core keeps that portion out of
  // bill allocation, the remaining baqaya is always derived from the
  // stamps, and a void therefore restores it exactly. Advance-tagged
  // collections never settle baqaya (advance money is pre-payment
  // credit by definition).
  let settledTicketLines = [];
  let settledBaqayaLines = [];
  let settledAddonLines = [];
  {

    const preAllocations = calculatePaymentAllocations(state);
    let preDuesCents = 0;
    for (const b of (customer.bills ?? [])) {
      const s = preAllocations.forMonth(customerId, b.month);
      if (s?.balanceDueCents && s.balanceDueCents > 0) preDuesCents += s.balanceDueCents;
    }
    let remainderCents = Math.max(0, Math.round(numAmount * 100) - preDuesCents);
    if (kind !== 'advance') {
      const baqayaPlan = planManualBaqayaSettlement(customer, remainderCents);
      settledBaqayaLines = baqayaPlan.lines;
      remainderCents -= baqayaPlan.totalCents;
    }
    if (Array.isArray(tickets)) {
      settledTicketLines = planTicketChargeSettlement(tickets, customerId, remainderCents).lines;
      // SISP-106: pending boost fees settle from what the ticket plan
      // left of the remainder — whole fees, oldest first, same rule.
      const ticketSettledCents = settledTicketLines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0);
      settledAddonLines = planAddonChargeSettlement(customer, Math.max(0, remainderCents - ticketSettledCents)).lines;
    }

  }

  // SISP-158: the "Paid by / kis ne diya" pick resolves HERE, at record
  // time, into the { id, name } snapshot that rides the payment — so a
  // later contributor edit or removal never rewrites who paid. An id
  // that names no current contributor (or no pick at all) leaves the
  // payment untagged, attributing it to the main customer.
  const contributorStamp = contributorSnapshotFor(customer, paidByContributorId);
  // SISP-101: the 1-click late-fee waiver. The gate is planned from the
  // PRE-payment allocation summary of the target bill (the full-
  // principal rule lives in late-fee-waiver.js); a waiver that fails
  // the gate refuses the whole collection, so a ticked box can never
  // silently record an ordinary payment. The deduction lands on the
  // BILL via core's waiveLateFeeFromBill BEFORE the payment is
  // recorded: the allocation engine reads bill.lateFee, so it settles
  // this payment against the fee-free bill exactly once (and a full
  // settlement still clears the Waada promise inside addPayment, as
  // before). The payment itself carries the audit pair
  // (lateFeeWaived + waivedAmount) and the reversal stamp of the bill's
  // pre-waiver fee fields — voiding or undoing the payment restores
  // exactly that fee. An advance collection can never carry a waiver:
  // its money is tagged for a future month, not for this bill.
  let waiverPlan = null;
  let waiverStamp = null;
  if (waiveLateFee) {
    if (kind === 'advance') {
      throw new Error('A late fee cannot be waived on an advance collection. Collect against the bill it settles instead.');
    }
    const waiverBill = customer.bills?.find(b => b.month === targetMonth);
    const waiverSummary = calculatePaymentAllocations(state).forMonth(customerId, targetMonth);
    waiverPlan = planLateFeeWaiver({
      bill: waiverBill,
      balanceDueCents: waiverSummary?.balanceDueCents,
      lateFeeCents: waiverSummary?.lateFeeCents,
      paymentAmountCents: Math.round(numAmount * 100)
    });
    if (!waiverPlan.eligible) throw new Error(lateFeeWaiverRefusal(waiverPlan));
    waiverStamp = waivedLateFeeStampFor(waiverBill);
    if (!waiverStamp) throw new Error('This bill has no late fee to waive.');
  }
  const collectBaseState = waiverPlan
    ? waiveLateFeeFromBill(state, customerId, targetMonth, { reason: 'Late fee waived on full payment (Quick Collect)' }, referenceDate)
    : state;

  // Create immutable payment entry through core function. An explicit
  // kind:'advance' tags the collection as advance credit (the only way
  // core accepts money against an already-paid bill); anything else
  // stays an ordinary untagged payment, exactly as before.
  const beforePaymentIds = new Set((customer.bills?.find(b => b.month === targetMonth)?.payments ?? []).map(p => p.id));
  let nextState = addPayment(collectBaseState, customerId, targetMonth, {
    date: pDate,
    amount: numAmount,
    method: pMethod,
    kind: kind === 'advance' ? 'advance' : undefined,
    // Advance month targeting: the month the money is FOR, chosen on
    // the sheet. Only an advance collection carries it; core's
    // validatePayment sanitizes it (strict 'YYYY-MM', advance-only).
    targetMonth: kind === 'advance' ? advanceTargetMonth : undefined,
    paidBy: paidBy ? String(paidBy).trim() : undefined,
    // Plan 379: the collection note rides the payment — who collected
    // it, where it was taken, and in which mohalla. Core's
    // validatePayment sanitizes the three fields (caps, place fold),
    // so a collection without a note stores nothing extra.
    collectedBy: collectedBy ? String(collectedBy).trim() : undefined,
    collectionPlace: normalizeCollectionPlace(collectionPlace) || undefined,
    collectionMohalla: collectionMohalla ? String(collectionMohalla).trim() : undefined,
    // Plan 449: the connection rides the payment — core's
    // validatePayment sanitizes it (one line, capped at 60), so a
    // collection without one stores nothing extra.
    connection: connection ? String(connection).trim() : undefined,
    // Plan 389: the Urdu-script note rides the payment — one optional
    // note, written in Urdu script and shown exactly as written.
    // Core's validatePayment sanitizes it (one line, capped at 200),
    // so a collection without a note stores nothing extra.
    urduNote: urduNote ? String(urduNote).trim() : undefined,
    // Plan 393: the cross-payment note rides the payment — who paid
    // for this customer's account, and their relationship in plain
    // words. Core's validatePayment sanitizes it (payer name and
    // relationship capped, payer link kept only as an id), so a
    // normal payment stores nothing extra.
    crossPayment: crossPayment ?? undefined,
    // Plan 386: the overpayment choice rides the payment — the
    // operator's explicit advance-or-credit choice for the extra
    // over the dues, recorded with the transaction. Core's
    // validatePayment enforces the amount-above-dues rule (the dues
    // ride along for that check only and are never stored), so a
    // choice on a payment that does not exceed the dues stores
    // nothing; the choice applies nothing automatically.
    overpaymentChoice: overpaymentChoice || undefined,
    overpaymentDuesCents: Number.isFinite(Number(overpaymentDuesCents)) ? Math.round(Number(overpaymentDuesCents)) : undefined,
    // Plan 395: the excess cash note rides the payment — the extra
    // over the dues and its stated purpose in plain words. Core's
    // validatePayment enforces the amount-above-dues rule (the dues
    // ride along for that check only and are never stored), so a note
    // on a payment that does not exceed the dues stores nothing; the
    // note applies nothing automatically.
    excessCashNote: excessCashNote || undefined,
    excessCashDuesCents: Number.isFinite(Number(excessCashDuesCents)) ? Math.round(Number(excessCashDuesCents)) : undefined,
    // Plan 397: the large-cash approval rides the payment — the
    // owner's initials or name that approved a cash payment above
    // the operator-set threshold. Core's validatePayment enforces
    // the threshold rule (the threshold rides along for that check
    // only and is never stored), so a payment below the threshold
    // stores nothing; the approval applies nothing by itself.
    largeCashApproval: largeCashApproval || undefined,
    largeCashThresholdCents: Number.isFinite(Number(largeCashThresholdCents)) ? Math.round(Number(largeCashThresholdCents)) : undefined,
    // Plan 398: the category tag rides the payment — the kind of
    // transaction in plain words, set at entry and used only for
    // filtering. Core's validatePayment sanitizes it (only the four
    // meaningful tags are stored), so a collection without a tag
    // stores nothing extra.
    categoryTag: categoryTag || undefined,
    // Plan 399: the promise-payment link rides the payment — the
    // promise this payment fulfils. Core's validatePayment
    // sanitizes it (a link needs a promise id and a strict date,
    // dated by the payment day), so a collection without a link
    // stores nothing extra.
    promiseLink: promiseLink || undefined,
    paidByContributor: contributorStamp ?? undefined,
    transactionId: cleanTxnId || undefined,
    // SISP-63: sender proof metadata rides alongside the TID; core's
    // validatePayment sanitizes it and keeps it for digital methods
    // only, so a cash collection never stores sender fields.
    senderTitle: senderTitle ? String(senderTitle).trim() : undefined,
    senderDigits: senderDigits ? String(senderDigits).trim() : undefined,
    referenceOverrideReason: cleanReason || undefined,
    screenshot: (typeof screenshot === 'string' && screenshot.startsWith('data:image/')) ? screenshot : undefined,
    // SISP-101: the waiver audit pair + reversal stamp (core's
    // validatePayment keeps them only as a complete, sane triple).
    ...(waiverPlan ? { lateFeeWaived: true, waivedAmount: waiverPlan.waivedAmountCents / 100, waivedLateFee: waiverStamp } : {}),
    ticketCharges: settledTicketLines.length > 0 ? settledTicketLines : undefined,
    addonCharges: settledAddonLines.length > 0 ? settledAddonLines : undefined,
    manualBaqayaSettlements: settledBaqayaLines.length > 0 ? settledBaqayaLines : undefined

  }, referenceDate);

  // Auto package follow (owner feature, 2026-10-29): when this collect
  // created-and-settled a month that was not priced yet, the fee taken
  // for the month becomes the customer's package (core decides from the
  // pre-payment state; a payment toward an already-priced bill and an
  // advance-tagged collection never move the package).
  let autoPackage = null;
  if (kind !== 'advance') {
    const addedPayment = nextState.customers.find(c => c.id === customerId)?.bills?.find(b => b.month === targetMonth)?.payments?.find(p => !beforePaymentIds.has(p.id));
    if (addedPayment) {
      const followed = autoPackageFromPayment(state, nextState, customerId, targetMonth, addedPayment.id, referenceDate);
      nextState = followed.nextState;
      autoPackage = followed.autoPackage;
    }
  }

  // Compute updated balance & allocations
  const newAllocations = calculatePaymentAllocations(nextState);
  const updatedCustomer = nextState.customers.find(c => c.id === customerId);
  const updatedMonthSummary = newAllocations.forMonth(customerId, targetMonth);
  const newBalanceDue = updatedMonthSummary?.balanceDueCents ? Math.max(0, updatedMonthSummary.balanceDueCents / 100) : 0;

  let newTotalDuesCents = 0;
  for (const b of (updatedCustomer?.bills ?? [])) {
    const s = newAllocations.forMonth(customerId, b.month);
    if (s?.balanceDueCents && s.balanceDueCents > 0) {
      newTotalDuesCents += s.balanceDueCents;
    }
  }
  const newTotalDues = Math.max(0, newTotalDuesCents / 100);

  // Resolve receipt identifier
  const targetBill = updatedCustomer?.bills?.find(b => b.month === targetMonth);
  const newPayment = targetBill?.payments?.[targetBill.payments.length - 1];
  const paymentId = newPayment?.id || `qc-${Date.now()}`;
  const receiptNumber = `RCPT-${customer.customerNumber}-${targetMonth.replace('-', '')}-${String(targetBill?.payments?.length || 1).padStart(2, '0')}`;

  // SISP-43: mark the settled tickets paid against this payment (the
  // caller persists nextTickets) and recompute the overall payable —
  // bill dues plus any ticket charges still pending afterwards.
  let nextTickets;
  let ticketChargesPendingAfter = 0;
  if (Array.isArray(tickets)) {
    if (settledTicketLines.length > 0) {
      nextTickets = settleTicketCharges(tickets, settledTicketLines, paymentId, referenceDate);
    }
    ticketChargesPendingAfter = billedTicketChargesPending(nextTickets ?? tickets, customerId);
  }
  const ticketChargesTotal = settledTicketLines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0) / 100;

  // SISP-106: mark the settled boosts paid against this payment. The
  // boost log rides the customer record, so the settlement lands in
  // nextState itself (no side store to persist) and the pending-after
  // figure is read back off the settled customer.
  let addonChargesPendingAfter = 0;
  if (Array.isArray(tickets)) {
    if (settledAddonLines.length > 0) {
      const settledCustomer = settleAddonCharges(updatedCustomer, settledAddonLines, paymentId, pDate);
      nextState = { ...nextState, customers: nextState.customers.map(c => (c.id === customerId ? settledCustomer : c)) };
    }
    const pendingCustomer = nextState.customers.find(c => c.id === customerId) ?? updatedCustomer;
    addonChargesPendingAfter = pendingCustomer ? addonChargesPending(pendingCustomer) : 0;
  }
  const addonChargesTotal = settledAddonLines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0) / 100;
  const manualBaqayaSettledTotal = settledBaqayaLines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0) / 100;
  const manualBaqayaPendingAfter = manualBaqayaOutstandingCents(updatedCustomer) / 100;
  const payableRemaining = Math.round((newTotalDues + ticketChargesPendingAfter + addonChargesPendingAfter + manualBaqayaPendingAfter) * 100) / 100;


  // SISP-116: the derived advance credit THIS collection generated —
  // the "khula paisa" kept when the tendered notes exceeded the dues.
  // Read from the allocation engine's own ledger row for this payment
  // (unappliedCreditCents — the exact figure advanceBalanceCents sums
  // and Field Mode shows as waiting credit). It is never stamped on
  // the payment record, so a manually typed overpayment reports the
  // identical figure, the Khata Doctor agrees by construction, and
  // voiding the payment removes the credit exactly. Advance-tagged
  // collections and SISP-61 prepays report 0: their credit is already
  // labelled by their own flows (a prepay's leftover also carries its
  // discount coverage, printed by its own receipt lines).
  let advanceCreditGenerated = 0;
  if (kind !== 'advance' && newPayment && !prepayTermsOf(newPayment)) {
    const ledger = newAllocations.byPaymentId.get(paymentId);
    if (ledger && !ledger.billUnpriced) {
      advanceCreditGenerated = looseChangeCreditCents(ledger) / 100;
    }
  }

  // SISP-126: Remainder Waada. When the caller passes a chip date AND this
  // collection still leaves a payable remainder, the promise for the rest
  // is written HERE — inside the same nextState the caller persists with
  // the payment — through the real SISP-3 setter (setCustomerWaada), with
  // promiseAmount = the engine's own payable remainder. The payment
  // carries a remainderWaada stamp (plus the promise it replaced, for the
  // void/undo restore paths), mirroring SISP-34's clearedWaada stamp. If
  // anything above threw, no state was saved at all, so a waada can never
  // exist without its payment; with no chip date (or nothing left due)
  // nothing is written — the promise is strictly opt-in per chip tap.
  let remainderWaada = null;
  const cleanRemainderWaadaDate = typeof remainderWaadaDate === 'string' && isValidWaadaDate(remainderWaadaDate.trim())
    ? remainderWaadaDate.trim()
    : null;
  if (cleanRemainderWaadaDate && payableRemaining > 0 && newPayment) {
    const custNow = nextState.customers.find(c => c.id === customerId);
    if (custNow) {
      const previousWaada = (typeof custNow.promiseDate === 'string' && custNow.promiseDate.trim() !== '')
        ? {
          promiseDate: custNow.promiseDate,
          promiseAmount: custNow.promiseAmount ?? null,
          promiseNote: custNow.promiseNote ?? ''
        }
        : null;
      const stamp = {
        promiseDate: cleanRemainderWaadaDate,
        promiseAmount: payableRemaining,
        ...(previousWaada ? { previousWaada } : {})
      };
      let waadaed = setCustomerWaada(custNow, {
        promiseDate: cleanRemainderWaadaDate,
        promiseAmount: payableRemaining,
        promiseNote: REMAINDER_WAADA_NOTE
      });
      waadaed = {
        ...waadaed,
        bills: (waadaed.bills ?? []).map(b => b.month !== targetMonth ? b : {
          ...b,
          payments: (b.payments ?? []).map(p => p.id === paymentId ? { ...p, remainderWaada: stamp } : p)
        })
      };
      nextState = { ...nextState, customers: nextState.customers.map(c => c.id === customerId ? waadaed : c) };
      remainderWaada = { promiseDate: cleanRemainderWaadaDate, promiseAmount: payableRemaining };
    }
  }

  // SISP-128: "Last 3 Payments" mini-history for the WhatsApp draft —
  // derived from the PRE-payment customer record, so every payment on it
  // is by construction before the one just recorded (the new payment is
  // never inside its own history block). Derived display data only.
  const previousPayments = buildReceiptPaymentHistory(customer);

  const receipt = {
    success: true,
    paymentId,
    receiptNumber,
    previousPayments,
    customerId: customer.id,
    customerNumber: customer.customerNumber,
    customerName: customer.name,
    phone: customer.phone || '',
    // Polish 4: the receipt shows the profile area — the mohalla first,
    // the legacy area field only as a fallback — so an area saved from
    // the success screen shows here on the next collection too.
    area: customer.mohalla || customer.area || 'Unassigned',
    month: targetMonth,
    date: pDate,
    amount: numAmount,
    method: pMethod,
    paidBy: paidBy ? String(paidBy).trim() : '',
    paidByContributor: contributorStamp,
    transactionId: cleanTxnId,
    // SISP-63: read back from the STORED payment so the receipt shows
    // exactly what validatePayment kept (sanitized, digital-only).
    senderTitle: newPayment?.senderTitle || '',
    // Plan 449: read back from the STORED payment the same way, so
    // the second connection's receipt names its connection — the
    // pair of receipts in one visit says which connection each
    // belongs to. An ordinary payment carries none and reads ''.
    connection: newPayment?.connection || '',
    senderDigits: newPayment?.senderDigits || '',
    senderLabel: paymentSenderLabel(newPayment),
    referenceOverrideReason: cleanReason,
    screenshot: (typeof screenshot === 'string' && screenshot.startsWith('data:image/')) ? screenshot : '',
    isDigital,
    newBalanceDue,
    newTotalDues,
    // Polish #11: the sales tax recorded on the target month's bill,
    // in integer cents (null when untaxed) — the WhatsApp draft and
    // the share-draft match check read it from here.
    salesTaxCents: salesTaxCentsOfBill(targetBill),
    ticketCharges: settledTicketLines,
    ticketChargesTotal,
    ticketChargesPending: ticketChargesPendingAfter,
    addonCharges: settledAddonLines,
    addonChargesTotal,
    addonChargesPending: addonChargesPendingAfter,
    payableRemaining,
    remainderWaada,
    advanceCreditGenerated,
    isSettled: newTotalDues <= 0 && ticketChargesPendingAfter <= 0 && addonChargesPendingAfter <= 0,
    // SISP-101: the late fee this collection waived (false / 0 on every
    // ordinary collection, so its receipts render exactly as before).
    lateFeeWaived: waiverPlan !== null,
    waivedAmount: waiverPlan ? waiverPlan.waivedAmountCents / 100 : 0,
    manualBaqayaSettlements: settledBaqayaLines,
    manualBaqayaSettledTotal,
    manualBaqayaPending: manualBaqayaPendingAfter,
    payableRemaining,
    isSettled: newTotalDues <= 0 && ticketChargesPendingAfter <= 0 && addonChargesPendingAfter <= 0 && manualBaqayaPendingAfter <= 0,

    packageAutoSet: autoPackage,
    // Plan 5 (Plan 1-100): delivery tracking only — the receipt's
    // money fields above are untouched by this entry.
    delivery: createReceiptDelivery({ receiptRef: receiptNumber, paymentId, channel: 'whatsapp' }),
    collectedAt: new Date().toISOString()
  };

  // Persist quick collection audit log
  try {
    const audits = JSON.parse(localStorage.getItem(QUICK_COLLECT_AUDIT_KEY) || '[]');
    audits.unshift(receipt);
    localStorage.setItem(QUICK_COLLECT_AUDIT_KEY, JSON.stringify(audits.slice(0, 100)));
  } catch {
    // Ignore storage issues
  }

  return { nextState, receipt, nextTickets };
}

/**
 * SISP-126: the one-line remainder-waada receipt text —
 * "Baqi Rs. X • Waada: YYYY-MM-DD" — or null when the receipt carries no
 * remainder waada. Accepts either an executeQuickCollection receipt
 * (receipt.remainderWaada) or a stored payment (payment.remainderWaada
 * stamp); the stamp is always read through the validating reader, so a
 * receipt without a real waada stays byte-identical (null here).
 */
export function formatRemainderWaadaLine(source) {
  const stamp = remainderWaadaOf({ remainderWaada: source?.remainderWaada });
  if (!stamp) return null;
  return `Baqi Rs. ${stamp.promiseAmount.toLocaleString('en-PK')} • Waada: ${stamp.promiseDate}`;
}

/**
/**
 * Builds the WhatsApp payment receipt draft. Default (no saved
 * preference) is the bilingual (Urdu & English) draft, byte-identical
 * to the pre-SISP-91 text. SISP-91: when the customer carries a saved
 * receipt language (preferredReceiptLang — callers pass it via
 * options.lang or receipt.receiptLang), the draft renders in that one
 * language instead: Urdu script, Roman Urdu, or English only. The
 * saved preference wins over the UI language.
 *
 * @param {Object} receipt
 * @param {Object} [options]
 * @param {string} [options.lang] - 'urdu' | 'roman' | 'english'
 * @returns {{ text: string, url: string }}
 */
const QC_RECEIPT_TEXT = Object.freeze({
  bilingual: {
    title: 'PAYMENT RECEIPT / ادائیگی کی رسید',
    receiptNo: 'Receipt No', date: 'Date', customer: 'Customer', phone: 'Phone', area: 'Area',
    billingMonth: 'Billing Month', amountReceived: 'Amount Received',
    ticketCharge: (ticketId) => `Murammat / Material Charge (${ticketId})`,
    baqaya: (entryId) => `Manual Baqaya / دستی بقایا (${entryId})`,
    method: 'Payment Method', txnId: 'Transaction ID / Ref', sender: 'Sender / بھیجنے والا',
    refNote: 'Ref Note', paidBy: 'Paid By', remaining: 'Remaining Balance', status: 'Status',
    statusPaid: 'مکمل ادا شدہ (PAID IN FULL)', statusPartial: 'جزوی ادائیگی (PARTIAL)',
    thanks: 'Shukriya! Thank you for your prompt payment.',
    ops: 'Shahdara NOC & Field Billing Operations'
  },
  urdu: {
    title: 'ادائیگی کی رسید',
    receiptNo: 'رسید نمبر', date: 'تاریخ', customer: 'صارف', phone: 'فون', area: 'علاقہ',
    billingMonth: 'بل کا مہینہ', amountReceived: 'موصولہ رقم',
    ticketCharge: (ticketId) => `مرمت / سامان چارج (${ticketId})`,
    baqaya: (entryId) => `دستی بقایا (${entryId})`,
    method: 'طریقہ ادائیگی', txnId: 'ٹرانزیکشن نمبر', sender: 'بھیجنے والا',
    refNote: 'حوالہ نوٹ', paidBy: 'ادا کنندہ', remaining: 'باقی بقایا', status: 'کیفیت',
    statusPaid: 'مکمل ادا شدہ', statusPartial: 'جزوی ادائیگی',
    thanks: 'شکریہ! بروقت ادائیگی کا شکریہ۔',
    ops: 'شاہدرہ این او سی و فیلڈ بلنگ آپریشنز'
  },
  roman: {
    title: 'ADAIGI KI RASEED',
    receiptNo: 'Raseed No', date: 'Tareekh', customer: 'Customer', phone: 'Phone', area: 'Ilaqa',
    billingMonth: 'Bill ka maheena', amountReceived: 'Wasool shuda raqam',
    ticketCharge: (ticketId) => `Murammat / Material Charge (${ticketId})`,
    baqaya: (entryId) => `Manual Baqaya (${entryId})`,
    method: 'Adaigi ka tareeqa', txnId: 'Transaction ID / Ref', sender: 'Sender',
    refNote: 'Ref Note', paidBy: 'Ada karne wala', remaining: 'Baqi baqaya', status: 'Status',
    statusPaid: 'Mukammal ada shuda (PAID IN FULL)', statusPartial: 'Juzwi adaigi (PARTIAL)',
    thanks: 'Shukriya! Waqt par adaigi ka shukriya.',
    ops: 'Shahdara NOC & Field Billing Operations'
  },
  english: {
    title: 'PAYMENT RECEIPT',
    receiptNo: 'Receipt No', date: 'Date', customer: 'Customer', phone: 'Phone', area: 'Area',
    billingMonth: 'Billing Month', amountReceived: 'Amount Received',
    ticketCharge: (ticketId) => `Repair / Material Charge (${ticketId})`,
    baqaya: (entryId) => `Manual Balance (${entryId})`,
    method: 'Payment Method', txnId: 'Transaction ID / Ref', sender: 'Sender',
    refNote: 'Ref Note', paidBy: 'Paid By', remaining: 'Remaining Balance', status: 'Status',
    statusPaid: 'PAID IN FULL', statusPartial: 'PARTIAL',
    thanks: 'Thank you for your prompt payment.',
    ops: 'Shahdara NOC & Field Billing Operations'
  }
});

export function formatQuickCollectWhatsAppReceipt(receipt, options = {}) {
  const { whatsappPhone = '' } = options;
  const amountStr = Number(receipt.amount).toLocaleString('en-PK');
  const remainingPayable = receipt.payableRemaining ?? receipt.newTotalDues ?? receipt.newBalanceDue ?? 0;
  const balanceStr = Number(remainingPayable).toLocaleString('en-PK');
  const L = QC_RECEIPT_TEXT[sanitizeReceiptLang(options.lang ?? receipt?.receiptLang)] ?? QC_RECEIPT_TEXT.bilingual;
  const statusText = (remainingPayable <= 0) ? L.statusPaid : L.statusPartial;
  // SISP-43: settled ticket charges print as their own receipt lines.
  const ticketChargeLines = (Array.isArray(receipt.ticketCharges) ? receipt.ticketCharges : [])
    .map(line => `🔧 *${L.ticketCharge(line.ticketId)}:* PKR ${Number(line.amount).toLocaleString('en-PK')}`);
  // SISP-106: settled boost fees print as their own receipt lines too.
  const addonChargeLines = (Array.isArray(receipt.addonCharges) ? receipt.addonCharges : [])
    .map(line => `⚡ *Speed Boost / سپیڈ بوسٹ (${line.boostId}):* PKR ${Number(line.amount).toLocaleString('en-PK')}`);
  // Owner feature (2026-10-29): manual baqaya settled by this payment
  // prints as its own receipt lines too (bilingual, like the charges).
  const baqayaLines = (Array.isArray(receipt.manualBaqayaSettlements) ? receipt.manualBaqayaSettlements : [])
    .map(line => `🧾 *${L.baqaya(line.entryId)}:* PKR ${Number(line.amount).toLocaleString('en-PK')}`);
  // Polish #11: the sales tax recorded on the bill, printed as its
  // own line like the ticket / boost / baqaya lines. An untaxed
  // receipt shows no line, never PKR 0.
  const salesTaxLines = (Number(receipt.salesTaxCents) > 0)
    ? [`🧾 *Sales tax / سیلز ٹیکس (19.5%):* PKR ${Number(receipt.salesTaxCents / 100).toLocaleString('en-PK')}`]
    : [];
  // Polish #11: the package this payment just moved the profile to
  // (the follow note), when it fired.
  const autoPackage = receipt?.packageAutoSet;
  const autoPackageLines = (autoPackage && typeof autoPackage === 'object' && Number.isFinite(Number(autoPackage.fee)) && Number(autoPackage.fee) > 0)
    ? [`📦 *Package updated / پیکیج اپڈیٹ:* ${typeof autoPackage.packageLabel === 'string' && autoPackage.packageLabel.trim() !== '' ? `${autoPackage.packageLabel.trim()} — ` : ''}PKR ${Number(autoPackage.fee).toLocaleString('en-PK')}`]
    : [];

  // SISP-126: the remainder waada line, only when one was set with this payment.
  const remainderWaadaLine = formatRemainderWaadaLine(receipt);
  // SISP-128: "Last 3 Payments" mini-history — body content above the
  // thank-you lines; absent/empty = the draft is exactly as before.
  const historyLines = (Array.isArray(receipt.previousPayments) ? receipt.previousPayments : [])
    .filter((row) => row && typeof row === 'object')
    .map((row) => `• ${[row.date, `PKR ${Number(row.amount).toLocaleString('en-PK')}`, row.method, row.receiptLabel].filter(Boolean).join(' · ')}`);
  const historyBlock = historyLines.length
    ? [`📜 *${t('rcpt_hist_heading', 'en')} / ${t('rcpt_hist_heading', 'ur')}:*`, ...historyLines, ``]
    : [];

  const lines = [
    `*SHAHDARA FIBER NETWORK & ISP BILLING*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `*${L.title}*`,
    ``,
    `🧾 *${L.receiptNo}:* ${receipt.receiptNumber}`,
    `📅 *${L.date}:* ${receipt.date}`,
    `👤 *${L.customer}:* ${receipt.customerName} (#${receipt.customerNumber})`,
    receipt.phone ? `📱 *${L.phone}:* ${receipt.phone}` : null,
    `📍 *${L.area}:* ${receipt.area}`,
    `🗓️ *${L.billingMonth}:* ${receipt.month}`,
    ``,
    `💵 *${L.amountReceived}:* PKR ${amountStr}`,
    ...(Number(receipt.advanceCreditGenerated) > 0 ? [`🪙 *Change Kept as Advance Credit / بقایا ایڈوانس کریڈٹ:* PKR ${Number(receipt.advanceCreditGenerated).toLocaleString('en-PK')}`] : []),
    ...(Number(receipt.waivedAmount) > 0 ? [`🎟️ *${t('lfw_whatsapp', null, { amount: `PKR ${Number(receipt.waivedAmount).toLocaleString('en-PK')}` })}*`] : []),
    ...ticketChargeLines,
    ...addonChargeLines,
    ...baqayaLines,
    ...salesTaxLines,
    ...autoPackageLines,
    `💳 *${L.method}:* ${receipt.method}`,
    receipt.transactionId ? `🔢 *${L.txnId}:* ${receipt.transactionId}` : null,
    receipt.senderLabel ? `👤 *${L.sender}:* ${receipt.senderLabel}` : null,
    receipt.referenceOverrideReason ? `📝 *${L.refNote}:* ${receipt.referenceOverrideReason}` : null,
    receipt.paidBy ? `✍️ *${L.paidBy}:* ${receipt.paidBy}` : null,

    ``,
    `⚖️ *${L.remaining}:* PKR ${balanceStr}`,
    remainderWaadaLine ? `🤝 *${remainderWaadaLine}*` : null,
    `📌 *${L.status}:* ${statusText}`,
    ``,
    ...historyBlock,
    L.thanks,
    L.ops,
    formatDigitalPaymentReceiptNote(getDigitalPaymentsSettings()) ? `ℹ️ ${formatDigitalPaymentReceiptNote(getDigitalPaymentsSettings())}` : null,
    // Receipt polish 7: the terms phrase + support line ride every
    // WhatsApp receipt draft, ahead of the owner-configured footer
    // so the footer still closes the draft verbatim.
    '',
    receiptTermsNoteText(),
    // SISP-96: owner-configured receipt footer (ONE builder in
    // receipt-footer-studio.js), verbatim above the closing divider.
    // Empty string when unconfigured -> filtered out, draft unchanged.
    buildReceiptFooterText(getReceiptFooter()) || null,
    `━━━━━━━━━━━━━━━━━━━━━━━━`
  ];

  const text = lines.filter(Boolean).join('\n');
  // SISP-118: the draft URL targets the customer's WhatsApp number when
  // the caller resolved one; the receipt's recorded phone stays the
  // display/record number (the printed "Phone:" line above is unchanged).
  const wa = formatWhatsAppUrl(whatsappPhone || receipt.phone, text);
  return { text, url: wa.url || '', validPhone: wa.validPhone, formattedPhone: wa.formattedPhone };
}

/**
 * Generates an image Blob for the payment receipt using offscreen canvas.
 * Falls back to null if Canvas is not supported.
 *
 * @param {Object} receipt
 * @returns {Promise<Blob|null>}
 */
export async function generateReceiptImageBlob(receipt) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  if (!canvas || typeof canvas.getContext !== 'function') return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  canvas.width = 600;
  canvas.height = 540;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 600, 540);

  // Top header banner
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 600, 90);

  // Brand title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
  ctx.fillText('SHAHDARA FIBER NETWORK', 30, 40);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  ctx.fillText('OFFICIAL PAYMENT RECEIPT / ادائیگی کی رسید', 30, 68);

  // Receipt Number & Date
  ctx.fillStyle = '#64748b';
  ctx.font = '13px monospace';
  ctx.fillText(`Receipt: ${receipt.receiptNumber || 'RCPT'}`, 30, 125);
  ctx.fillText(`Date: ${receipt.date || ''}`, 420, 125);

  // Divider
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 140);
  ctx.lineTo(570, 140);
  ctx.stroke();

  // Customer info
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  ctx.fillText(receipt.customerName || 'Subscriber', 30, 175);

  ctx.fillStyle = '#64748b';
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Account #${receipt.customerNumber || ''} · ${receipt.area || 'Shahdara'}${receipt.phone ? ' · ' + receipt.phone : ''}`, 30, 202);

  // Amount box
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(30, 225, 540, 90);
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(30, 225, 540, 90);

  ctx.fillStyle = '#64748b';
  ctx.font = '13px system-ui, -apple-system, sans-serif';
  ctx.fillText('AMOUNT RECEIVED / وصول شدہ رقم', 50, 255);

  ctx.fillStyle = '#059669';
  ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
  ctx.fillText(`PKR ${Number(receipt.amount || 0).toLocaleString('en-PK')}`, 50, 295);

  // Grid details
  ctx.fillStyle = '#64748b';
  ctx.font = '13px system-ui, -apple-system, sans-serif';
  ctx.fillText('Payment Method', 30, 350);
  ctx.fillText('Billing Month', 230, 350);
  ctx.fillText('Remaining Balance', 420, 350);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
  ctx.fillText(receipt.method || 'Cash', 30, 375);
  ctx.fillText(receipt.month || '-', 230, 375);

  const balColor = (receipt.newTotalDues <= 0) ? '#059669' : '#dc2626';
  ctx.fillStyle = balColor;
  ctx.fillText(`PKR ${Number(receipt.newTotalDues || 0).toLocaleString('en-PK')}`, 420, 375);

  // Status badge line
  ctx.fillStyle = '#64748b';
  ctx.font = 'italic 13px system-ui, -apple-system, sans-serif';
  ctx.fillText(receipt.newTotalDues <= 0 ? '✓ Bill settled in full (مکمل ادا شدہ)' : '⏳ Partial payment recorded (جزوی ادائیگی)', 30, 420);
  if (receipt.transactionId) {
    ctx.fillStyle = '#475569';
    ctx.font = '13px monospace';
    ctx.fillText(`Txn ID: ${receipt.transactionId}`, 30, 442);
    if (receipt.paidBy) {
      ctx.font = 'italic 13px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Paid by: ${receipt.paidBy}`, 320, 442);
    }
  } else if (receipt.paidBy) {
    ctx.fillText(`Paid by: ${receipt.paidBy}`, 30, 442);
  }

  // Footer divider
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(30, 465);
  ctx.lineTo(570, 465);
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.fillText('Shahdara ISP Billing & NOC Operations · Computer generated receipt · Shukriya!', 30, 495);

  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    } catch {
      resolve(null);
    }
  });
}


/**
 * Generates customer picker list markup.
 *
 * @param {Array<Object>} customers
 * @param {string|null} [activeCustomerId=null]
 * @returns {string}
 */
/**
 * Empty state shown when nobody has a pending balance: never an empty, broken-looking list.
 * The button switches the picker to the "All" filter (paid customers included).
 *
 * @returns {string}
 */
export function customerHasMonthlyFee(customer) {
  const positive = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0;
  if (positive(customer?.monthlySellingAmount)) return true;
  return (customer?.monthlyPriceSchedule ?? []).some(entry => positive(entry?.amount));
}

/** Active customers with no package / monthly fee, so no bill can be generated for them (#248). */
export function countCustomersWithoutFee(state) {
  return (state?.customers ?? []).filter(c => !c.archived && !customerHasMonthlyFee(c)).length;
}

/**
 * Empty state when nobody owes anything AND customers have no package/fee yet (#248): explain why
 * the list is empty and offer to set packages / generate this month's bills.
 */
export function renderQuickCollectNeedsSetupHtml(withoutFee, { showAll = true } = {}) {
  return `
      <div class="qc-empty-state qc-needs-setup" role="status">
        <span class="qc-empty-icon" aria-hidden="true">🧾</span>
        <h4>No pending dues</h4>
        <p><strong data-qc-no-fee-count>${Number(withoutFee)}</strong> customer${withoutFee === 1 ? ' has' : 's have'} no package / monthly fee yet, so no bill is due. Set a package to generate bills.</p>
        <div class="qc-setup-actions">
          <button type="button" class="primary-button" data-qc-setup-packages>Set packages &amp; monthly fee</button>
          <button type="button" class="secondary-button" data-qc-generate-bills>Generate this month's bills</button>
          ${showAll ? '<button type="button" class="secondary-button qc-show-all-btn" data-qc-show-all>Sab customers dikhayein · Show all</button>' : ''}
        </div>
      </div>
    `;
}

export function renderQuickCollectAllCollectedHtml() {
  return `
      <div class="qc-empty-state qc-all-collected" role="status">
        <span class="qc-empty-icon" aria-hidden="true">✅</span>
        <h4>Sab ka bill wusool ho gaya</h4>
        <p>No pending dues right now — every customer's bill is collected.</p>
        <button type="button" class="secondary-button qc-show-all-btn" data-qc-show-all>Sab customers dikhayein · Show all</button>
      </div>
    `;
}

/**
 * Picker contents for a filter: pending (default) lists only customers with an unpaid balance
 * (partially paid customers stay, with their remaining amount); "all" also shows paid ones.
 *
 * @param {Object} state
 * @param {string} query
 * @param {('all-dues'|'high-dues'|'all')} filterType
 * @param {string|null} [activeCustomerId]
 * @param {string} [mohallaFilter=''] - Plan 446: chosen mohalla;
 *   blank means the full list, a mohalla lists exactly its
 *   customers, in name order, with dues shown.
 * @returns {{ html: string, customers: Array<Object>, allCollected: boolean, needsSetup: boolean, withoutFee: number }}
 */
export function renderQuickCollectPickerHtml(state, query = '', filterType = 'all-dues', activeCustomerId = null, mohallaFilter = '') {
  const customers = filterQuickCollectByMohalla(getPendingCollectionCustomers(state, query, filterType), mohallaFilter);
  const allCollected = customers.length === 0
    && filterType !== 'all'
    && !String(query ?? '').trim()
    && !quickCollectMohallaFilterKey(mohallaFilter)
    && getPendingCollectionCustomers(state, '', 'all-dues').length === 0;
  const withoutFee = allCollected ? countCustomersWithoutFee(state) : 0;
  const needsSetup = allCollected && withoutFee > 0;
  // SISP-77: same-name badges are computed against the FULL ledger (a
  // namesake with no dues still makes this pick ambiguous), then handed
  // to the list renderer keyed by customer id.
  const nameIndex = buildSameNameIndex(state?.customers);
  const byId = new Map((state?.customers ?? []).map((customer) => [customer.id, customer]));
  const sameNameBadges = new Map(customers.map((entry) => [entry.id, sameNameBadgeHtml(state, byId.get(entry.id), new Date(), nameIndex)]));
  return {
    customers,
    allCollected,
    needsSetup,
    withoutFee,
    html: needsSetup
      ? renderQuickCollectNeedsSetupHtml(withoutFee)
      : allCollected ? renderQuickCollectAllCollectedHtml() : renderQuickCollectCustomerListHtml(customers, activeCustomerId, sameNameBadges)
  };
}

export function renderQuickCollectCustomerListHtml(customers, activeCustomerId = null, sameNameBadges = null) {
  if (!customers || customers.length === 0) {
    return `
      <div class="qc-empty-state" role="status">
        <span class="qc-empty-icon" aria-hidden="true">🔍</span>
        <h4>No matching accounts found</h4>
        <p>Try searching by customer name, 3-digit phone, or clear filters.</p>
      </div>
    `;
  }

  return customers.map(c => {
    const isSelected = c.id === activeCustomerId;
    const hasDues = c.totalDues > 0;
    const dueClass = hasDues ? 'qc-has-dues' : 'qc-settled';
    const dueLabel = hasDues
      ? `<strong class="qc-due-val">PKR ${c.totalDues.toLocaleString('en-PK')}</strong><span class="qc-due-tag">DUE</span>`
      : `<strong class="qc-due-val qc-val-settled">PKR 0</strong><span class="qc-settled-tag">SETTLED</span>`;

    return `
      <button type="button"
              class="qc-customer-card ${dueClass} ${isSelected ? 'is-selected' : ''}"
              data-customer-id="${escapeHtml(c.id)}"
              aria-label="Pick ${escapeHtml(c.name)} with dues PKR ${c.totalDues}">
        <div class="qc-card-left">
          <span class="qc-cust-num">#${escapeHtml(String(c.customerNumber))}</span>
          <div class="qc-cust-info">
            <span class="qc-cust-name">${escapeHtml(c.name)}</span>
            ${sameNameBadges?.get(c.id) ?? ''}
            <span class="qc-cust-meta">${escapeHtml(c.area)}${c.phone ? ' · ' + escapeHtml(c.phone) : ''}</span>
          </div>
        </div>
        <div class="qc-card-right">
          ${dueLabel}
        </div>
      </button>
    `;
  }).join('');
}

/**
 * Polish 4: the Area / Location select for the success screen receipt.
 * Options are the app's own mohalla list (owner-provided standard
 * spellings), shown with their readable labels; the receipt's current
 * area is kept as an option when it is not one of them, so the current
 * value is never lost, and 'Unassigned' is the placeholder option.
 *
 * @param {string} currentArea
 * @param {string[]} [areaOptions]
 * @returns {string}
 */
export function quickCollectAreaSelectHtml(currentArea, areaOptions = DEFAULT_MOHALLAS) {
  const seen = new Set();
  const options = [{ value: '', label: 'Unassigned' }];
  const push = (value, label) => {
    const key = String(value ?? '').trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    options.push({ value: String(value).trim(), label });
  };
  const current = String(currentArea ?? '').trim();
  const currentCanon = current && current.toLowerCase() !== 'unassigned' ? canonicalMohalla(current) : null;
  if (currentCanon) push(currentCanon.stored, currentCanon.label);
  for (const name of (Array.isArray(areaOptions) ? areaOptions : [])) {
    const canon = canonicalMohalla(name);
    if (canon) push(canon.stored, canon.label);
  }
  const selectedValue = currentCanon ? currentCanon.stored : '';
  const selectedKey = selectedValue.toLowerCase();
  return `<select id="quickCollectAreaSelect" class="qc-input qc-area-select" data-qc-area-select aria-label="Area / Location">${options.map((o) => `<option value="${escapeHtml(o.value)}"${o.value.toLowerCase() === selectedKey ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select>`;
}

/**
 * Generates receipt confirmation card markup for the success screen.
 *
 * @param {Object} receipt
 * @returns {string}
 */
export function renderQuickCollectReceiptCardHtml(receipt) {
  const remainingPayable = receipt.payableRemaining ?? receipt.newTotalDues;
  const shared = isReceiptShared(receipt.id);
  const sharedBadge = renderReceiptSharedBadgeHtml(Boolean(shared?.shared), shared);
  // SISP-43: ticket charges settled by this receipt, one row per ticket.
  const ticketChargeRows = (Array.isArray(receipt.ticketCharges) ? receipt.ticketCharges : []).map(line => `
        <div class="qc-receipt-item full-width">
          <span class="qc-meta-label">Murammat / Material Charge (${escapeHtml(line.ticketId)})</span>
          <strong class="qc-meta-val">PKR ${Number(line.amount).toLocaleString('en-PK')}</strong>
        </div>`).join('');
  // SISP-106: boost fees settled by this receipt, one row per boost.
  const addonChargeRows = (Array.isArray(receipt.addonCharges) ? receipt.addonCharges : []).map(line => `
        <div class="qc-receipt-item full-width">
          <span class="qc-meta-label">Speed Boost / سپیڈ بوسٹ (${escapeHtml(line.boostId)})</span>
          <strong class="qc-meta-val">PKR ${Number(line.amount).toLocaleString('en-PK')}</strong>
        </div>`).join('');
  // Owner feature (2026-10-29): manual baqaya settled by this receipt,
  // one row per entry.
  const baqayaRows = (Array.isArray(receipt.manualBaqayaSettlements) ? receipt.manualBaqayaSettlements : []).map(line => `
        <div class="qc-receipt-item full-width">
          <span class="qc-meta-label">${escapeHtml(t('baqaya_receipt_line', null, { id: line.entryId }))}</span>

          <strong class="qc-meta-val">PKR ${Number(line.amount).toLocaleString('en-PK')}</strong>
        </div>`).join('');
  return `
    <div class="qc-receipt-card" role="region" aria-label="Payment Receipt Slip">
      <div class="qc-receipt-header">
        <!-- Polish 21 (Req 6): the settle/partial badge moved out of the
             card header into the merged status section
             (renderSettleStatusBadge) — the header keeps only the shared
             badge + the receipt id, on one line. -->
        ${sharedBadge}
        <span class="qc-receipt-id">${escapeHtml(receipt.receiptNumber)}</span>
      </div>

      <div class="qc-receipt-amount-row">
        <span class="qc-receipt-label">Amount Collected</span>
        <strong class="qc-receipt-amount">PKR ${Number(receipt.amount).toLocaleString('en-PK')}</strong>
      </div>

      <div class="qc-receipt-grid">
        <div class="qc-receipt-item">
          <span class="qc-meta-label">Customer</span>
          <strong class="qc-meta-val">${escapeHtml(receipt.customerName)} (#${escapeHtml(String(receipt.customerNumber))})</strong>
        </div>
        ${receipt.connection ? `
        <div class="qc-receipt-item">
          <span class="qc-meta-label">Connection</span>
          <strong class="qc-meta-val">${escapeHtml(receipt.connection)}</strong>
        </div>` : ''}
        <div class="qc-receipt-item">
          <span class="qc-meta-label">Date &amp; Method</span>
          <strong class="qc-meta-val">${escapeHtml(receipt.date)} · ${escapeHtml(receipt.method)}</strong>
        </div>
        <div class="qc-receipt-item">
          <span class="qc-meta-label">Area / Location</span>
          ${quickCollectAreaSelectHtml(receipt.area)}
        </div>
        <div class="qc-receipt-item">
          <span class="qc-meta-label">Remaining Balance</span>
          <strong class="qc-meta-val ${remainingPayable > 0 ? 'has-balance' : 'zero-balance'}">
            PKR ${Number(remainingPayable).toLocaleString('en-PK')}
          </strong>
        </div>
        ${ticketChargeRows}
        ${formatRemainderWaadaLine(receipt) ? `
        <div class="qc-receipt-item full-width">
          <span class="qc-meta-label">${escapeHtml(t('remwaada_receipt_label'))}</span>
          <strong class="qc-meta-val">🤝 ${escapeHtml(formatRemainderWaadaLine(receipt))}</strong>
        </div>` : ''}
        ${Number(receipt.advanceCreditGenerated) > 0 ? `
        <div class="qc-receipt-item full-width">
          <span class="qc-meta-label">🪙 ${escapeHtml(t('khula_credit_row'))}</span>
          <strong class="qc-meta-val">PKR ${Number(receipt.advanceCreditGenerated).toLocaleString('en-PK')}</strong>
        </div>` : ''}
        ${addonChargeRows}
        ${Number(receipt.waivedAmount) > 0 ? `
        <div class="qc-receipt-item full-width">
          <span class="qc-meta-label">Late Fee</span>
          <strong class="qc-meta-val">🎟️ ${escapeHtml(t('lfw_card', null, { amount: `PKR ${Number(receipt.waivedAmount).toLocaleString('en-PK')}` }))}</strong>
        </div>` : ''}
        ${baqayaRows}

        ${receipt.packageAutoSet ? `
        <div class="qc-receipt-item full-width">
          <span class="qc-meta-label">Package</span>
          <strong class="qc-meta-val">📦 ${escapeHtml(t('pkg_auto_set_note', null, { amount: Number(receipt.packageAutoSet.fee).toLocaleString('en-PK') }))}</strong>
        </div>` : ''}
        ${receipt.transactionId ? `
        <div class="qc-receipt-item full-width" data-qc-receipt-txnid>
          <span class="qc-meta-label">Transaction ID / Ref</span>
          <strong class="qc-meta-val"><code class="qc-txnid-code">${escapeHtml(receipt.transactionId)}</code></strong>
        </div>` : ''}
        ${receipt.senderLabel ? `
        <div class="qc-receipt-item full-width" data-qc-receipt-sender>
          <span class="qc-meta-label">${escapeHtml(t('spay_sender_name_label'))}</span>
          <strong class="qc-meta-val">${escapeHtml(receipt.senderLabel)}</strong>
        </div>` : ''}
        ${receipt.referenceOverrideReason ? `
        <div class="qc-receipt-item full-width">
          <span class="qc-meta-label">Ref Note / Override</span>
          <strong class="qc-meta-val">${escapeHtml(receipt.referenceOverrideReason)}</strong>
        </div>` : ''}
        ${receipt.screenshot ? `
        <div class="qc-receipt-item full-width">
          <span class="qc-meta-label">Attached Screenshot</span>
          <img src="${escapeHtml(receipt.screenshot)}" alt="Payment proof" style="max-height:80px; border-radius:6px; margin-top:4px; display:block;">
        </div>` : ''}
        ${receipt.paidBy ? `
        <div class="qc-receipt-item full-width">
          <span class="qc-meta-label">Paid By / Note</span>
          <strong class="qc-meta-val">${escapeHtml(receipt.paidBy)}</strong>
        </div>` : ''}
      </div>
      ${receiptTermsNoteHtml({ contactActions: true }).replace('class="receipt-urdu-notice"', 'class="receipt-urdu-notice qc-urdu-nastaliq qc-urdu-gradient"')}
    </div>
  `;
}

/**
 * OWNER-CASH-SHOP (2026-10-31): the Quick Collect "Cash received at"
 * choices. First is Owner Office — cash handed over at the owner's own
 * office, recorded as plain 'Cash' and selected by default whenever the
 * form opens or Cash is (re)selected. Then one choice per DISTINCT
 * canonical shop collector derived from PAYMENT_METHODS through
 * shop-settlement's shopCollectorMethods — never a hardcoded list, so a
 * future "Cash at X shop" method surfaces as its own chip automatically.
 * Each shop choice carries the exact method string the save records.
 */
export function quickCollectShopChoices() {
  return [
    { key: 'office', shop: null, method: 'Cash', labelKey: 'cashshop_owner_office', label: null },
    ...shopCollectorMethods(PAYMENT_METHODS).map(({ shop, method }) => ({
      key: `shop:${shop}`,
      shop,
      method,
      labelKey: null,
      label: shop
    }))
  ];
}

/**
 * Sets up and manages the Quick Collect Modal Dialog controller.
 *
 * @param {Object} options
 * @param {Function} options.getState
 * @param {Function} options.onSaveState
 * @param {Function} options.onToast
 * @param {Function} [options.onSelectCustomer]
 * @param {Function} [options.onCollected] - SISP-187: called exactly once after a payment is actually saved in the submit flow (never on cancel, dismiss or undo).
 * @returns {Object} Controller with { open, close, selectAndOpen, openOneScreen, isOpen, getState, commitState, refresh }
 */
export function setupQuickCollectModal({
  getState,
  onSaveState,
  onToast,
  onSelectCustomer,
  onEditCustomer,
  onCollected,
  loadHandlingNotes,
  loadCollectionPromises,
  // Plan 449: the host's billing-link loader, read fresh whenever
  // the second-connection step renders — a customer with an active
  // link offers the other connection after the first payment. The
  // option is optional: without it the step simply never shows.
  loadBillingLinks
}) {
  const modal = document.getElementById('quickCollectModal');
  if (!modal) {
    return {
      open: () => {},
      close: () => {},
      selectAndOpen: () => {},
      openOneScreen: () => {},
      isOpen: () => false,
      getState: () => getState(),
      commitState: (nextState) => { if (typeof onSaveState === 'function') onSaveState(nextState); },
      refresh: () => {}
    };
  }

  // Elements
  const closeBtn = document.getElementById('closeQuickCollectModalBtn');
  const stepPick = document.getElementById('quickCollectStepPick');
  const stepForm = document.getElementById('quickCollectStepForm');
  const stepSuccess = document.getElementById('quickCollectStepSuccess');
  // Plan 382: the save confirmation step between the form and the
  // success screen (null when the host page predates it).
  const stepConfirm = document.getElementById('quickCollectStepConfirm');
  // Plan 426: the one-screen payment step — customer, amount, method,
  // save on one screen (null when the host page predates it).
  const stepOneScreen = document.getElementById('quickCollectStepOneScreen');
  const openOneScreenBtn = document.getElementById('quickCollectOpenOneScreenBtn');

  const searchInput = document.getElementById('quickCollectSearchInput');
  const searchClearBtn = document.getElementById('quickCollectSearchClearBtn');
  // Plan 427: the live name-prefix lookup list (null when the host
  // page predates it) — matching customers appear after two or more
  // letters, in name order, with name and mohalla.
  const namePrefixList = document.getElementById('nplNamePrefixList');
  // Plan 441: the last-four-digits lookup list (null when the host
  // page predates it) — four typed digits list every customer
  // whose number ends with them, in name order, with name and mohalla.
  const lastFourList = document.getElementById('lfdLastFourList');
  // Plan 446: the mohalla filter select and its plain-words count
  // line on the picker step (null when the host page predates
  // them) — one mohalla narrows the list to its customers with
  // dues, in name order; clearing it returns the full list.
  const mohallaFilterSelect = document.getElementById('mhfMohallaFilter');
  const mohallaFilterSummary = document.getElementById('mhfMohallaFilterSummary');
  // Plan 428: the recent-customers quick-pick row (null when the
  // host page predates it) — the last ten customers collected from,
  // latest first, with name, mohalla and dues.
  const recentQuickPickList = document.getElementById('rqpRecentQuickPick');
  const customerListContainer = document.getElementById('quickCollectCustomerList');
  const filterChips = modal.querySelectorAll('.quick-collect-filter-chip');
  const duesCountEl = document.getElementById('quickCollectDuesCount');
  const highDuesCountEl = document.getElementById('quickCollectHighDuesCount');
  const allCountEl = document.getElementById('quickCollectAllCount');

  // Form Elements
  const backToPickBtn = document.getElementById('quickCollectBackToPickBtn');
  const customerHeader = document.getElementById('quickCollectCustomerHeader');
  const paymentForm = document.getElementById('quickCollectPaymentForm');
  const amountInput = document.getElementById('quickCollectAmountInput');
  const dateInput = document.getElementById('quickCollectDateInput');
  const methodSelect = document.getElementById('quickCollectMethodSelect');
  // Plan 438: the Other button — reveals the full method list for
  // anything the three big buttons do not cover (null when the host
  // page predates it).
  const bigWalletOtherBtn = document.getElementById('bwbOtherMethodBtn');
  const monthSelect = document.getElementById('quickCollectMonthSelect');
  const paidByInput = document.getElementById('quickCollectPaidByInput');
  // Plan 379: the collection note fields (null when the host page
  // predates them) — who collected the payment, where it was taken,
  // and in which mohalla.
  const collectedByInput = document.getElementById('quickCollectCollectedByInput');
  const collectionPlaceSelect = document.getElementById('quickCollectCollectionPlaceSelect');
  const collectionMohallaInput = document.getElementById('quickCollectCollectionMohallaInput');
  // Plan 389: the Urdu-script note field (null when the host page
  // predates it) — one optional note on the transaction, written in
  // Urdu script and shown exactly as written.
  const urduNoteInput = document.getElementById('quickCollectUrduNoteInput');
  // Plan 393: the cross-payment note fields (null when the host page
  // predates them) — who paid for another customer's account, and
  // their relationship in plain words.
  const crossPayerSelect = document.getElementById('quickCollectCrossPayerSelect');
  const crossPayerNameInput = document.getElementById('quickCollectCrossPayerNameInput');
  const crossRelationshipInput = document.getElementById('quickCollectCrossRelationshipInput');
  // Plan 395: the excess cash purpose select (null when the host page
  // predates it) — what the extra over the dues is for, in plain
  // words: advance, credit, or change to return.
  const excessCashPurposeSelect = document.getElementById('quickCollectExcessCashPurposeSelect');
  // Plan 529: the note beside the excess-purpose select (null when the
  // host page predates it) — shown while the select is disabled, so
  // the operator is told the overpayment choice above owns the
  // question. The note carries no id: it is found through the
  // select's own field group, never through the bare document, and
  // the lookup is guarded for stub documents without querySelector
  // (polish #13 harness).
  const excessPurposeNote = excessCashPurposeSelect?.parentElement && typeof excessCashPurposeSelect.parentElement.querySelector === 'function'
    ? excessCashPurposeSelect.parentElement.querySelector('.qc-excess-purpose-note')
    : null;
  // Plan 397: the large-cash approval fields (null when the host page
  // predates them) — the operator-set threshold for cash that needs
  // the owner's approval, and the approver's initials or name.
  const largeCashThresholdInput = document.getElementById('quickCollectLargeCashThreshold');
  const largeCashApproverInput = document.getElementById('quickCollectLargeCashApprover');
  // Plan 398: the category tag select (null when the host page
  // predates it) — the kind of transaction in plain words, set at
  // entry and used only for filtering.
  const categoryTagSelect = document.getElementById('quickCollectCategoryTagSelect');
  // Plan 399: the promise picker (null when the host page
  // predates it) — the customer's still-unpaid promises, listed
  // on every open so the payment can be linked to the promise it
  // fulfils at entry time.
  const promiseLinkSelect = document.getElementById('quickCollectPromiseLinkSelect');
  // Plan 400: the live daily entry summary line (null when the host
  // page predates it) — today's transaction count and total on this
  // device, refreshed on every open and after each save.
  const dailyEntrySummaryEl = typeof document !== 'undefined' ? document.getElementById('quickCollectDailyEntrySummary') : null;
  // Plan 439: the live round-total line (null when the host page
  // predates it) — the payments taken this round: count and total
  // amount on this device, refreshed on every open and after each
  // save. A round starts when the sheet opens; the start instant
  // lives in roundStartMs below and is never stored anywhere.
  const roundTotalsEl = typeof document !== 'undefined' ? document.getElementById('rttRoundTotals') : null;
  let roundStartMs = null;
  // Plan 445: the live daily target progress bar (null when the host
  // page predates it) — today's collected total against today's
  // target, refreshed on every open and after each save. It shows
  // progress only and sets no target.
  const dailyTargetProgressEl = typeof document !== 'undefined' ? document.getElementById('dtpDailyTargetProgress') : null;
  // Plan 448: the end-of-day summary panel and its button (null when
  // the host page predates them) — today's payments count and total,
  // by method, with the cash total shown separately. The panel opens
  // from its button and refreshes on every open and after each save
  // while open. It summarises only and settles nothing.
  const endOfDaySummaryEl = typeof document !== 'undefined' ? document.getElementById('edsEndOfDaySummary') : null;
  const endOfDaySummaryBtn = typeof document !== 'undefined' ? document.getElementById('edsEndOfDaySummaryButton') : null;
  // Plan 450: the new-customer quick-add button and form host on the
  // picker step (null when the host page predates them) — a brand-new
  // customer is added from the picker itself (name, phone, mohalla,
  // package) and the payment form opens for them straight away, so
  // the operator never leaves Quick Collect for a first payment.
  const newCustomerBtn = typeof document !== 'undefined' ? document.getElementById('ncaNewCustomerButton') : null;
  const newCustomerForm = typeof document !== 'undefined' ? document.getElementById('ncaQuickAddForm') : null;
  // SISP-158: contributor picker hosts (null when the host page predates them).
  const contributorField = document.getElementById('quickCollectContributorField');
  const contributorSelect = document.getElementById('quickCollectContributorSelect');
  const advanceCheckbox = document.getElementById('quickCollectAdvanceCheckbox');
  const advanceTargetSelect = document.getElementById('quickCollectAdvanceTargetMonth');
  const dueAmountVal = document.getElementById('quickCollectDueAmountVal');
  // Plan 376: the offered pre-fill line under the amount field (null
  // when the host page predates it).
  const prefillLine = typeof document !== 'undefined' ? document.getElementById('quickCollectPrefillLine') : null;
  // Plan 377: the live amount-in-words line beside the amount field
  // (null when the host page predates it).
  const wordsLine = typeof document !== 'undefined' ? document.getElementById('quickCollectAmountWordsLine') : null;
  // Plan 381: the next-receipt-number preview line under the amount
  // field (null when the host page predates it).
  const nextReceiptLine = typeof document !== 'undefined' ? document.getElementById('quickCollectNextReceiptLine') : null;
  // Plan 385: the live settlement preview under the amount field
  // (null when the host page predates it).
  const settlementPreviewBox = typeof document !== 'undefined' ? document.getElementById('quickCollectSettlementPreview') : null;
  // Plan 386: the overpayment choice box under the amount field
  // (null when the host page predates it) — the radio pair the
  // operator uses to say what the extra over the dues should be,
  // and the span that names the extra in plain words.
  const overpaymentChoiceBox = typeof document !== 'undefined' ? document.getElementById('quickCollectOverpaymentChoice') : null;
  const overpaymentExtraLine = typeof document !== 'undefined' ? document.getElementById('quickCollectOverpaymentExtra') : null;
  // Plan 387: the underpayment warning line under the amount field
  // (null when the host page predates it).
  const underpaymentWarningLine = typeof document !== 'undefined' ? document.getElementById('quickCollectUnderpaymentWarning') : null;
  // Plan 388: the suspended-customer warning line under the amount field
  // (null when the host page predates it).
  const suspendedWarningLine = typeof document !== 'undefined' ? document.getElementById('quickCollectSuspendedWarning') : null;
  // Plan 447: the big name + mohalla confirmation line host on the
  // payment form (null when the host page predates it) — the selected
  // customer's name in large text, mohalla, and current dues, shown
  // before saving so a wrong-customer pick is caught by eye.
  const bigNameConfirmEl = typeof document !== 'undefined' ? document.getElementById('bncBigNameConfirm') : null;
  // Plan 444: the pending-clearance flag line under the method picker
  // (null when the host page predates it) — shown while the chosen
  // method is a Bank Transfer, so the customer knows at the counter
  // that the bill settles only when the money clears.
  const pendingClearanceFlagEl = typeof document !== 'undefined' ? document.getElementById('pcfPendingClearanceFlag') : null;
  // Plan 382: the save confirmation summary hosts (null when the
  // host page predates them) — the summary panel and its Confirm /
  // Back buttons, shown before the payment posts.
  const confirmSummaryBox = typeof document !== 'undefined' ? document.getElementById('quickCollectConfirmSummary') : null;
  // Plan 433: the receipt preview host on the confirm step (null when
  // the host page predates it) — the receipt exactly as it will print.
  const receiptPreviewBox = typeof document !== 'undefined' ? document.getElementById('rpvReceiptPreview') : null;
  // Plan 434: the success next-steps host on the success step (null
  // when the host page predates it) — amount paid, still owed after
  // this payment, next due date, and a collect-again action, shown
  // beside the package success message.
  const nextStepsBox = typeof document !== 'undefined' ? document.getElementById('snsSuccessNextSteps') : null;
  // Plan 490: the repeat-payment host on the success step (null when
  // the host page predates it) — "Record another payment for the
  // same customer", opening a fresh form with the same customer
  // chosen and an empty amount, shown beside the next-steps panel.
  const repeatPaymentBox = typeof document !== 'undefined' ? document.getElementById('rptRepeatPayment') : null;
  // Plan 436: the offline saved badge host on the success step (null when
  // the host page predates it) — "saved on this device" with the save time.
  const savedBadgeBox = typeof document !== 'undefined' ? document.getElementById('osbOfflineSavedBadge') : null;
  // Plan 440: the still-owes line host on the success step (null when
  // the host page predates it) — the customer's bill dues after this
  // payment, in plain words, or "Bill dues fully paid", shown
  // immediately at the top of the success screen.
  const stillOwesBox = typeof document !== 'undefined' ? document.getElementById('sowStillOwesLine') : null;
  // Polish 21 (Req 6): the settle/partial badge host in the merged
  // status section (null when the host page predates it) — the card
  // header no longer carries it; the badge is written here from the
  // same receipt data the card builder used.
  const settleStatusBadgeBox = typeof document !== 'undefined' ? document.getElementById('qcSettleStatusBadge') : null;
  // Plan 443: the receipt share draft host on the success step (null
  // when the host page predates it) — the receipt's share text, read
  // first, with Send and Dismiss, prepared right after a save.
  const shareDraftBox = typeof document !== 'undefined' ? document.getElementById('rsdReceiptShareDraft') : null;
  // Plan 444: the pending-clearance flag host on the success step
  // (null when the host page predates it) — shown again after the
  // save while the saved payment's method is a bank transfer or a
  // cheque.
  const successPendingClearanceFlagEl = typeof document !== 'undefined' ? document.getElementById('pcfSuccessPendingClearanceFlag') : null;
  // Plan 449: the second-connection step host on the success step
  // (null when the host page predates it) — the customer's other
  // connection with its dues, recordable in the same pass after the
  // first payment, shown only while the pass still owes it.
  const secondConnectionBox = typeof document !== 'undefined' ? document.getElementById('sccSecondConnectionStep') : null;
  const confirmSaveBtn = typeof document !== 'undefined' ? document.getElementById('quickCollectConfirmSaveBtn') : null;
  // Plan 437: the form's own Save button (null when the host page
  // predates it) — disabled while a save is in progress, so a second
  // tap cannot start a second save.
  const quickCollectConfirmBtn = typeof document !== 'undefined' ? document.getElementById('quickCollectConfirmBtn') : null;
  const confirmBackBtn = typeof document !== 'undefined' ? document.getElementById('quickCollectConfirmBackBtn') : null;
  // Plan 432: the cash change calculator (null when the host page
  // predates it) — the box, the cash-received input, and the
  // change-due line.
  const cashChangeBox = typeof document !== 'undefined' ? document.getElementById('quickCollectCashChangeBox') : null;
  const cashReceivedInput = typeof document !== 'undefined' ? document.getElementById('quickCollectCashReceivedInput') : null;
  const cashChangeLine = typeof document !== 'undefined' ? document.getElementById('quickCollectCashChangeLine') : null;

  // Plan 377: the words always match the digits currently typed —
  // typing, a chip tap, a concession, or a pre-fill — so an extra
  // zero is caught before the receipt is printed. Clearing the field
  // clears the words; the display never changes any amount.
  function renderAmountWordsLine() {
    if (!wordsLine) return;
    const text = amountInput ? amountInWordsLineText(amountInput.value) : '';
    wordsLine.textContent = text;
    wordsLine.hidden = text === '';
  }
  // Plan 432: the change calculator shows only while a cash-family
  // method is selected — change only exists for cash — and only
  // while both figures are typed. Cash below the amount never shows
  // a negative change: the line says plainly how much more is
  // needed. It hides on a split payment (each leg is an ordinary
  // payment of its own, so the amount field is only the first leg).
  // Calculates only: rendering posts nothing and changes no record.
  // Plan 537: when the box hides, the cash-received field is
  // cleared with it, so a stale figure never re-computes change.
  function renderCashChange() {
    if (!cashChangeBox) return;
    const method = methodSelect ? String(methodSelect.value || 'Cash') : 'Cash';
    const show = isCashPaymentMethod(method) && !splitToggle?.checked;
    cashChangeBox.hidden = !show;
    // Plan 537: the cash figure belongs to this payment only — clear
    // it with the box, before the line guard, so a host page that
    // predates the change line still clears it.
    if (!show && cashReceivedInput) cashReceivedInput.value = '';
    if (!cashChangeLine) return;
    const line = show ? cashChangeLineText(cashReceivedInput?.value, amountInput?.value) : '';
    cashChangeLine.textContent = line;
    cashChangeLine.hidden = line === '';
  }
  // Plan 381: the preview always names the number THIS payment will
  // receive — the active customer's record against the month
  // currently picked — so a month switch re-numbers the preview
  // before anything is saved. Read-only: rendering never reserves
  // or consumes a number, and a customer with no usable number
  // shows nothing extra. Plan 527: a split payment issues TWO
  // receipt numbers, so no single number can be quoted — the line
  // hides while the split toggle is checked, the same condition the
  // receipt preview already uses (buildReceiptPreview passes split:
  // true and the preview returns null); unticking the split shows
  // it again.
  function renderNextReceiptLine() {
    if (!nextReceiptLine) return;
    const month = monthSelect?.value || activeDefaults?.targetMonth;
    const customer = activeDefaults?.customer ?? null;
    const line = !splitToggle?.checked && customer && month ? nextReceiptNumberLineText(customer, month) : '';
    nextReceiptLine.textContent = line;
    nextReceiptLine.hidden = line === '';
  }
  // Plan 533: the live split total — leg 1 + leg 2 as typed, so the
  // operator checks the split against what the customer handed over
  // before saving instead of discovering a shortfall after. It shows
  // only while the split is on and at least one leg has a positive
  // figure; a split with nothing typed yet shows no "PKR 0" line.
  // Read-only: rendering posts nothing and changes no record.
  function renderSplitTotal() {
    if (!splitTotalLine) return;
    const line = splitToggle?.checked ? splitTotalLineText(amountInput?.value, splitAmountInput?.value) : '';
    splitTotalLine.textContent = line;
    splitTotalLine.hidden = line === '';
  }
  // Plan 385: the settlement preview always shows which bills the
  // amount currently typed will settle — the target bill first, then
  // later bills in month order, exactly as the allocation engine
  // settles them on save — so the operator tells the customer the
  // right months before anything is saved. Read-only: rendering
  // settles nothing and changes no record. The balances come from
  // the live allocation state, so a concession applied to a bill is
  // already in the figures; a ticked late-fee waiver is not — the
  // waiver lands on the bill only at save time.
  function renderSettlementPreview() {
    if (!settlementPreviewBox) return;
    let html = '';
    const amountCents = Math.round(Number(amountInput?.value || 0) * 100);
    const month = monthSelect?.value || activeDefaults?.targetMonth;
    if (activeCustomerId && month && amountCents > 0) {
      const state = getState();
      const customer = state?.customers?.find((c) => c.id === activeCustomerId) ?? null;
      if (customer) {
        const allocations = calculatePaymentAllocations(state);
        const bills = [...(customer.bills ?? [])]
          .sort((a, b) => a.month.localeCompare(b.month))
          .map((bill) => ({
            month: bill.month,
            balanceDueCents: allocations.forMonth(customer.id, bill.month)?.balanceDueCents ?? 0,
          }));
        const advanceTarget = advanceCheckbox?.checked ? (advanceTargetSelect?.value || '') : '';
        const preview = settlementPreview({ bills, targetMonth: month, amountCents, advanceTargetMonth: advanceTarget });
        html = settlementPreviewMarkup(preview, advanceTarget);
      }
    }
    settlementPreviewBox.innerHTML = html;
    settlementPreviewBox.hidden = html === '';
  }
  // Plan 386: the overpayment choice is offered only when the amount
  // currently typed strictly exceeds the customer's shared payable
  // figure — open bills plus pending ticket, addon and manual-baqaya
  // charges (activeDefaults.payableTotal, the same figure the amount
  // field defaults to and the header shows) — the extra over that
  // figure, in plain words — so the operator records the customer's
  // own decision at the counter instead of guessing later. Offered,
  // never forced: no radio is pre-ticked, and an unticked choice
  // records nothing. The box hides while Advance is ticked (the
  // money is already advance) and on a split payment (each leg is an
  // ordinary payment of its own). Read-only: rendering chooses
  // nothing and changes no record. Plan 523: the base is the payable
  // figure, never bill dues alone — a payment exactly equal to the
  // payable total used to be offered a choice for a phantom extra.
  // Plan 537: when the box hides, the checked radio is cleared with
  // it — a choice made for one amount never rides along with a
  // different amount.
  function renderOverpaymentChoice() {
    if (!overpaymentChoiceBox) return;
    let extraCents = 0;
    const amountCents = Math.round(Number(amountInput?.value || 0) * 100);
    if (activeCustomerId && activeDefaults && amountCents > 0 && !advanceCheckbox?.checked && !splitToggle?.checked) {
      const payableCents = Math.round(Number(activeDefaults.payableTotal ?? 0) * 100);
      extraCents = overpaymentExtraCents(payableCents, amountCents);
    }
    if (overpaymentExtraLine) overpaymentExtraLine.textContent = formatPKR(extraCents / 100);
    overpaymentChoiceBox.hidden = extraCents <= 0;
    // Plan 537: a choice belongs to the amount it was offered for —
    // when the box hides, the checked radio clears with it, so the
    // submit handler never reads a stale choice for a different
    // amount. Only the checked radio is cleared, through the same
    // box-scoped read the submit handler uses; the guard keeps stub
    // hosts without querySelector working.
    if (overpaymentChoiceBox.hidden && typeof overpaymentChoiceBox.querySelector === 'function') {
      const picked = overpaymentChoiceBox.querySelector('input[name="quickCollectOverpaymentChoice"]:checked');
      if (picked) picked.checked = false;
    }
    // Plan 529: while the choice box is shown the radios own the
    // extra-cash question, so the excess-purpose select is disabled
    // (with its note) and cannot record a second, contradicting
    // disposition; when the box hides the select works exactly as
    // before. The select's value is never cleared here — a purpose
    // picked before the amount was typed stands, and clearing it
    // would destroy a "Change to return" pick the radios cannot
    // express.
    if (excessCashPurposeSelect) excessCashPurposeSelect.disabled = !overpaymentChoiceBox.hidden;
    if (excessPurposeNote) excessPurposeNote.hidden = overpaymentChoiceBox.hidden;
  }
  // Plan 387: the underpayment warning is shown only while the
  // amount currently typed is a positive number strictly below the
  // customer's shared payable figure — open bills plus pending
  // ticket, addon and manual-baqaya charges (activeDefaults.
  // payableTotal, the same figure the amount field defaults to and
  // the header shows) — the amount entered, the payable total, and
  // what remains after this payment, in plain words — so the
  // customer leaves knowing what is still due instead of believing
  // they are fully paid. Warns only, blocks nothing: the form saves
  // exactly as before. The line hides while Advance is ticked (the
  // money is already advance, not a dues payment) and on a split
  // payment (each leg is an ordinary payment of its own). Read-only:
  // rendering warns nothing into any record. Plan 523: the base is
  // the payable figure, never bill dues alone — a part-payment used
  // to warn the customer they owed Rs 0 while a charge still stood
  // open.
  function renderUnderpaymentWarning() {
    if (!underpaymentWarningLine) return;
    let line = '';
    const amountCents = Math.round(Number(amountInput?.value || 0) * 100);
    if (activeCustomerId && activeDefaults && amountCents > 0 && !advanceCheckbox?.checked && !splitToggle?.checked) {
      const payableCents = Math.round(Number(activeDefaults.payableTotal ?? 0) * 100);
      const warning = underpaymentWarning(payableCents, amountCents);
      if (warning) line = underpaymentWarningLineText(warning);
    }
    underpaymentWarningLine.textContent = line;
    underpaymentWarningLine.hidden = line === '';
  }
  // Plan 388: the suspended-customer warning — shown on the entry form
  // while the picked customer holds an open suspension record (Plan 83),
  // so the operator can tell a returning customer at the moment of
  // payment that reconnection is a separate step, before they walk home
  // expecting the net to work. Warns only: the payment still records
  // normally, and the warning never changes any suspension,
  // reconnection, bill, or payment record by itself. The records come
  // from the same loader the app itself uses (the Plan 361 handling-note
  // idiom); when it is unavailable — for example in a test host without
  // the app script — no warning is invented. Read-only: rendering warns
  // nothing into any record. The warning depends on the customer only,
  // so it renders once when the form opens for that customer.
  function renderSuspendedWarning() {
    if (!suspendedWarningLine) return;
    let line = '';
    if (activeCustomerId) {
      const records = typeof loadSuspensions === 'function' ? loadSuspensions() : [];
      const record = openSuspensionFor(records, activeCustomerId);
      if (record) line = suspendedWarningLineText(record);
    }
    suspendedWarningLine.textContent = line;
    suspendedWarningLine.hidden = line === '';
  }
  // Plan 444: the pending-clearance flag — shown on the entry form
  // while either leg's method is a Bank Transfer, so the customer
  // knows before saving that the bill settles only when the money
  // clears. It flags only: the payment still records normally as
  // pending, and the flag never changes any bill, payment,
  // clearance status, or customer record by itself. Plan 535: the
  // entry form flags a Bank Transfer only — the only clearable
  // method the app offers. It reads both legs' selects, so every
  // method change refreshes it through the same sync below
  // (leg 1) or updateSplitVisibility (leg 2 / split toggle).
  function renderPendingClearanceFlag() {
    if (!pendingClearanceFlagEl) return;
    const method = methodSelect ? String(methodSelect.value || '') : '';
    // Plan 535: the split's second leg can be the transfer — the
    // split select holds nothing while the split is off, so it can
    // never flag on its own.
    const splitMethod = splitToggle?.checked && splitMethodSelect ? String(splitMethodSelect.value || '') : '';
    const flag = pendingClearanceEntryFlagForMethod(method) || pendingClearanceEntryFlagForMethod(splitMethod);
    pendingClearanceFlagEl.textContent = flag;
    pendingClearanceFlagEl.hidden = flag === '';
  }

  // Plan 447: the big confirmation line — the selected customer's
  // name in large text, mohalla, and current dues, refreshed every
  // time the form opens for a customer, so the operator sees who
  // the payment is about to be saved against before tapping Save.
  // It confirms only: rendering posts nothing and changes no record.
  // The dues figure is the same shared total the picker shows and
  // the amount defaults to — open bill balances plus unpaid manual
  // baqaya — never the payable remainder (ticket and boost charges
  // are not dues). With no selected customer the host is cleared
  // and hidden, exactly like the other live lines.
  function renderBigNameConfirm() {
    if (!bigNameConfirmEl) return;
    if (!activeDefaults || !activeCustomerId) {
      bigNameConfirmEl.innerHTML = '';
      bigNameConfirmEl.hidden = true;
      return;
    }
    const line = bigNameConfirmLine(activeDefaults.customer ?? null, activeDefaults.totalDues + activeDefaults.manualBaqayaPending);
    const html = line ? bigNameConfirmLineHtml(line) : '';
    bigNameConfirmEl.innerHTML = html;
    bigNameConfirmEl.hidden = html === '';
  }
  // Plan 382: the save confirmation summary — built from the same
  // reads the submit handler posts with, so the figures the operator
  // confirms are exactly the figures the save will record. Returns
  // null when the entry has nothing worth confirming; the submit
  // flow then proceeds exactly as before. A split payment carries
  // its second leg beside the main payment.
  function buildSaveConfirmationSummary() {
    if (!activeDefaults || !activeCustomerId) return null;
    const amountVal = Number(amountInput?.value);
    const legs = [];
    if (splitToggle?.checked) {
      legs.push({
        amount: Number(splitAmountInput?.value),
        amountWords: amountInWords(Number(splitAmountInput?.value)),
        method: splitMethodSelect?.value || 'Easypaisa',
      });
    }
    return normalizeSaveConfirmationSummary({
      customerId: activeCustomerId,
      customerName: activeDefaults.name,
      mohalla: activeDefaults.area,
      amount: amountVal,
      amountWords: amountInWords(amountVal),
      method: methodSelect?.value || 'Cash',
      billMonth: monthSelect?.value || activeDefaults.targetMonth,
      advance: !!advanceCheckbox?.checked,
      advanceTargetMonth: advanceTargetSelect?.value || '',
      legs,
    });
  }

  // Plan 433: the receipt preview — built from the same reads the
  // submit handler posts with, so the previewed receipt is the receipt
  // the save will issue. The receipt number is the next-number preview
  // for this customer and bill month, counted from the pre-save ledger
  // (existing payments plus one), which is the number the save stamps
  // on the payment. Returns null when there is nothing worth
  // previewing; a split entry previews nothing (no single receipt).
  function buildReceiptPreview() {
    if (!activeDefaults || !activeCustomerId) return null;
    const amountVal = Number(amountInput?.value);
    const month = monthSelect?.value || activeDefaults.targetMonth;
    const customer = activeDefaults.customer ?? null;
    return receiptPreviewFor({
      customer,
      amount: amountVal,
      amountWords: amountInWords(amountVal),
      method: methodSelect?.value || 'Cash',
      receiptNumber: customer && month ? nextReceiptNumberFor(customer, month) : '',
      date: dateInput?.value || getPakistanLocalDate(),
      split: !!splitToggle?.checked,
    });
  }

  const quickAmountChips = modal.querySelectorAll('.quick-amount-chip');
  const quickMethodChips = modal.querySelectorAll('.quick-method-chip');

  // SISP-116: loose-change chip host (null when the host page predates it).
  const looseChangeBox = typeof document !== 'undefined' ? document.getElementById('quickCollectLooseChangeChips') : null;

  // Plan 528: the round-note tender group label (in the page just
  // above the loose-change chips, found by its class hook — no new
  // element id); it hides with its row so an empty row never leaves
  // a stray label above the cash box. Null when the host page (or a
  // host document without querySelector) predates it.
  const looseChangeLabel = typeof document !== 'undefined' && typeof document.querySelector === 'function'
    ? document.querySelector('.qc-loose-change-label')
    : null;

  // SISP-116: renders the round-note tender chips for the amount owed.
  // The chips only ever FILL the amount input with the tendered figure —
  // recording still goes through the ordinary form submit, exactly like
  // typing the amount, so the engine derives the kept change as advance
  // credit. Hidden while the Advance tag is ticked (an advance has its
  // own flow) and whenever no round-up exists.
  function renderLooseChangeChips() {
    if (!looseChangeBox) return;
    const owed = advanceCheckbox?.checked ? 0 : Number(activeDefaults?.payableTotal ?? 0);
    const markup = looseChangeChipsMarkup(owed, (tendered, change) => t('khula_chip', null, {
      tendered: tendered.toLocaleString('en-PK'),
      change: change.toLocaleString('en-PK')
    }));
    looseChangeBox.innerHTML = markup;
    looseChangeBox.hidden = markup === '';
    // Plan 528: the group label hides with its row and returns with it.
    if (looseChangeLabel) looseChangeLabel.hidden = markup === '';
  }

  // SISP-30: outage concession badge host (null when the host page predates it).
  const concessionBox = typeof document !== 'undefined' ? document.getElementById('quickCollectConcessionBox') : null;

  // SISP-101: late-fee waiver toggle host (null when the host page predates it).
  const waiverBox = typeof document !== 'undefined' ? document.getElementById('quickCollectLateFeeWaiverBox') : null;

  // Owner feature: Change Package host in the payment step (null when
  // the host page predates it).
  const packageBox = typeof document !== 'undefined' ? document.getElementById('quickCollectPackageBox') : null;

  // Plan 361: handling-note alert host (null when the host page
  // predates it). The note is shown on the payment entry screen
  // before saving; a customer without one shows nothing extra.
  const handlingNoteBox = typeof document !== 'undefined' ? document.getElementById('quickCollectHandlingNoteBox') : null;
  function renderHandlingNoteBox(customerId) {
    if (!handlingNoteBox) return;
    const notes = typeof loadHandlingNotes === 'function' ? loadHandlingNotes() : [];
    handlingNoteBox.innerHTML = handlingNoteAlertHtml(handlingNoteForCustomer(notes, customerId)?.text ?? '', t('prof_handling_heading'));
  }

  // Plan 390: standing-instruction line host (null when the host page
  // predates it). The note is shown on the transaction entry screen
  // for that customer; a customer without one shows nothing extra.
  const standingInstructionLine = typeof document !== 'undefined' ? document.getElementById('quickCollectStandingInstructionLine') : null;
  function renderStandingInstructionLine(customerId) {
    if (!standingInstructionLine) return;
    const notes = typeof loadStandingInstructionNotes === 'function' ? loadStandingInstructionNotes() : [];
    const markup = standingInstructionLineHtml(standingInstructionForCustomer(notes, customerId), { heading: t('prof_sin_heading') });
    standingInstructionLine.innerHTML = markup;
    standingInstructionLine.hidden = markup === '';
  }

  // OWNER-CASH-SHOP: "Cash received at" sub-row hosts (null when the
  // host page predates them — every use below is guarded).
  const shopRowEl = typeof document !== 'undefined' ? document.getElementById('quickCollectShopRow') : null;
  const shopChipsEl = typeof document !== 'undefined' ? document.getElementById('quickCollectShopChips') : null;
  const shopLabelEl = typeof document !== 'undefined' ? document.getElementById('quickCollectShopLabel') : null;
  let shopChipButtons = [];

  // Uptime tracking: one-line online/offline summary host for the
  // selected bill month (null when the host page predates it).
  const uptimeLine = typeof document !== 'undefined' ? document.getElementById('quickCollectUptimeLine') : null;

  // SISP-126: Remainder Waada row host inside the payment form (null when
  // the host page predates it). The chosen chip date is controller state:
  // null until a date chip is tapped — revealing the row never writes a
  // promise by itself, and "Skip" leaves it null.
  const remainderWaadaRow = typeof document !== 'undefined' ? document.getElementById('quickCollectRemainderWaadaRow') : null;
  let selectedRemainderWaadaDate = null;
  let remainderWaadaSkipped = false;

  // Digital Payment Elements
  const digitalFieldsContainer = document.getElementById('quickCollectDigitalFields');
  const transactionIdInput = document.getElementById('quickCollectTransactionIdInput');
  // SISP-63: sender proof metadata inputs (null on host pages that
  // predate them — every use below is optional-chained).
  const senderNameInput = document.getElementById('quickCollectSenderNameInput');
  const senderDigitsInput = document.getElementById('quickCollectSenderDigitsInput');
  const overrideDetails = document.getElementById('quickCollectOverrideDetails');
  const overrideReasonInput = document.getElementById('quickCollectOverrideReasonInput');
  const screenshotInput = document.getElementById('quickCollectScreenshotInput');
  const screenshotPreviewWrap = document.getElementById('quickCollectScreenshotPreviewWrap');
  const screenshotPreview = document.getElementById('quickCollectScreenshotPreview');
  const removeScreenshotBtn = document.getElementById('quickCollectRemoveScreenshotBtn');
  const ownerPaymentInfo = document.getElementById('quickCollectOwnerPaymentInfo');

  // SISP-121: split-tender leg-2 elements (all null-safe — markup that
  // predates the split block simply keeps the single-payment flow).
  const splitToggle = document.getElementById('quickCollectSplitToggle');
  const splitFields = document.getElementById('quickCollectSplitFields');
  const splitAmountInput = document.getElementById('quickCollectSplitAmountInput');
  const splitMethodSelect = document.getElementById('quickCollectSplitMethodSelect');
  const splitDigitalFields = document.getElementById('quickCollectSplitDigitalFields');
  // Plan 533: the live split-total line (null when the host page
  // predates it) — "Split total: PKR X (leg 1 + leg 2)" under the
  // leg-2 fields, refreshed as either leg is typed. The line carries
  // no id: it is found through the split fields block, never through
  // the bare document, and the lookup is guarded for stub documents
  // without querySelector (polish #13 harness).
  const splitTotalLine = splitFields && typeof splitFields.querySelector === 'function'
    ? splitFields.querySelector('.qc-split-total-line')
    : null;
  // Plan 534: the leg-2 duplicate card (null when the host page
  // predates it) — the same treatment as the leg-1 duplicate card,
  // beside the leg-2 TID field. The card carries no id: it and its
  // message, reason input and buttons are found by class through
  // the split fields block, never through the bare document, and
  // the lookups are guarded for stub documents without
  // querySelector (polish #13 harness).
  const leg2DupCard = splitFields && typeof splitFields.querySelector === 'function'
    ? splitFields.querySelector('.qc-split-duplicate-card')
    : null;
  const leg2DupEl = (cls) => (leg2DupCard && typeof leg2DupCard.querySelector === 'function'
    ? leg2DupCard.querySelector(cls)
    : null);
  const leg2DupMsg = leg2DupEl('.qc-split-duplicate-msg');
  const leg2DupReasonInput = leg2DupEl('.qc-split-duplicate-reason');
  const leg2DupProceedBtn = leg2DupEl('.qc-split-duplicate-proceed');
  const leg2DupCancelBtn = leg2DupEl('.qc-split-duplicate-cancel');
  const splitTransactionIdInput = document.getElementById('quickCollectSplitTransactionIdInput');
  const splitOverrideReasonInput = document.getElementById('quickCollectSplitOverrideReasonInput');
  // FU-SISP121-SENDER: leg-2 sender proof inputs (SISP-63 mirror) —
  // they live inside the split digital block, so updateSplitVisibility
  // shows/hides them with leg 2's TID field; null-safe like the rest.
  const splitSenderNameInput = document.getElementById('quickCollectSplitSenderNameInput');
  const splitSenderDigitsInput = document.getElementById('quickCollectSplitSenderDigitsInput');

  // Duplicate Warning In-App Card (#279)
  const dupWarningCard = document.getElementById('quickCollectDuplicateWarning');
  const dupMsg = document.getElementById('quickCollectDuplicateMsg');
  const dupReasonInput = document.getElementById('quickCollectDuplicateReasonInput');
  const dupProceedBtn = document.getElementById('quickCollectDuplicateProceedBtn');
  const dupCancelBtn = document.getElementById('quickCollectDuplicateCancelBtn');
  let duplicateBypassedForTxn = null;
  // Plan 534: the leg-2 duplicate's one confirmed bypass — the
  // leg-2 TID the operator chose to save anyway, with its reason,
  // exactly like duplicateBypassedForTxn for leg 1.
  let duplicateBypassedForLeg2Txn = null;
  // SISP-146: the double-tap guard's one confirmed bypass (key of
  // customer|amount|method|earlier payment id) — see the submit handler.
  let duplicatePaymentBypassedKey = null;
  // Plan 382: the save confirmation's one confirmed arming — the key
  // of the summary the operator just confirmed. The save flow posts
  // only while the form's current summary still carries this key;
  // any edit after the summary was shown re-shows it instead.
  let saveConfirmationArmedKey = null;
  // Plan 437: the double-tap save guard — one in-flight save at a
  // time. tryStart arms it at the top of the submit handler and the
  // finally below clears it when the save settles, so a second tap for
  // the same payment is ignored while the first is still running and
  // a separate payment after this one still works. saveGuardHeldForDialog
  // stays true only while a duplicate prompt is waiting for the
  // operator's answer (the two async confirm branches below); the
  // finally leaves the guard armed in that case, and the prompt's
  // answer clears it before resubmitting.
  const saveGuard = createDoubleTapSaveGuard();
  let saveGuardHeldForDialog = false;

  let currentScreenshotDataUrl = '';

  // Success Elements
  const receiptCardContainer = document.getElementById('quickCollectReceiptCard');
  const whatsAppBtn = document.getElementById('quickCollectWhatsAppBtn');
  const shareImageBtn = document.getElementById('quickCollectShareImageBtn');
  const undoBtn = document.getElementById('quickCollectUndoBtn');
  // Plan 435: the sixty-second reversal undo button on the success
  // screen (null when the host page predates it).
  const reversalUndoBtn = document.getElementById('quickCollectReversalUndoBtn');
  // Plan 532: the one-line note shown when only the five-second undo
  // is available — found by class through the undo button's own
  // parent, never through a new id (null when the host page
  // predates it, or its document has no querySelector).
  const reversalUndoNote = typeof undoBtn?.parentElement?.querySelector === 'function'
    ? undoBtn.parentElement.querySelector('.qc-undo-note')
    : null;
  const printReceiptBtn = document.getElementById('quickCollectPrintReceiptBtn');
  const anotherBtn = document.getElementById('quickCollectAnotherBtn');
  const doneCloseBtn = document.getElementById('quickCollectDoneCloseBtn');
  const goToTransactionsBtn = document.getElementById('quickCollectGoToTransactionsBtn');

  // SISP-181: set when the operator taps "⚡ Apply Uptime Concession" — the
  // concession box then renders (and its Apply button recomputes) the
  // uptime-tracking-based suggestion for this exact customer + month
  // instead of the SISP-16 complaint-register one. The fill alone stamps
  // nothing; the bill changes only through the box's normal Apply path.
  let uptimeConcessionFill = null;

  let activeFilter = 'all-dues';
  // Plan 446: the mohalla the picker list is narrowed to — blank
  // means every mohalla. It lives through saves and round loops,
  // because a round is worked in one mohalla; only picking "All
  // mohallas" clears it.
  let activeMohallaFilter = '';
  // SISP-101: the operator's waiver tick for the currently open form.
  // Kept outside the waiver box's DOM because the box re-renders on
  // every amount keystroke; reset per customer and per month change.
  // executeQuickCollection re-plans the gate from live state at submit,
  // so this flag alone can never force a waiver through.
  let waiverTicked = false;
  // Owner feature: a package change applies synchronously; this flag only
  // guards against a double-tap while the click is being handled, so a
  // change can never be applied twice or land mid payment-save.
  let packageChangeBusy = false;
  let activeCustomerId = null;
  let activeDefaults = null;
  let activeReceipt = null;
  // Polish 4: true once the success card's area-select change listener
  // has been wired (setup runs once, but the flag keeps a re-run safe).
  let areaSelectWired = false;
  let activeUndoContext = null;
  const UNDO_WINDOW_MS = 5000;
  let undoTimeoutId = null;
  let undoCountdownId = null;
  let undoDeadline = 0;
  // Plan 435: the sixty-second reversal undo — one plain single
  // payment, its save instant, and the arming timers. Cleared
  // whenever the five-second undo runs, a split saves, Collect
  // Another loops, or the dialog closes, so a stale context can
  // never reverse a payment from an earlier save.
  let activeReversalUndo = null;
  let reversalUndoTimeoutId = null;
  let reversalUndoCountdownId = null;
  // True once the current opening's close-cleanup has run. The dialog 'close'
  // event and closeModal() can both fire for one close; cleanup must run
  // exactly once per opening (openModal resets this to false).
  let closeCleanupHandled = true;

  function updateDigitalVisibility(methodVal) {
    const isDig = isDigitalPaymentMethod(methodVal);
    if (digitalFieldsContainer) {
      digitalFieldsContainer.hidden = !isDig;
    }
    if (isDig && ownerPaymentInfo) {
      const settings = getDigitalPaymentsSettings();
      if (hasConfiguredDigitalPayments(settings)) {
        ownerPaymentInfo.hidden = false;
        ownerPaymentInfo.innerHTML = `
          <div class="qc-owner-info-box">
            <span class="qc-owner-info-title">💡 Customer direct pay / اکاؤنٹ تفصیلات:</span>
            <div class="qc-owner-details-grid">
              ${settings.ownerAccountTitle ? `<div><small>Title:</small> <strong>${escapeHtml(settings.ownerAccountTitle)}</strong></div>` : ''}
              ${settings.ownerRaastId ? `<div><small>⚡ Raast:</small> <strong class="qc-copyable-code">${escapeHtml(settings.ownerRaastId)}</strong></div>` : ''}
              ${settings.ownerTillId ? `<div><small>📱 Till ID:</small> <strong class="qc-copyable-code">${escapeHtml(settings.ownerTillId)}</strong></div>` : ''}
              ${(settings.ownerBankName && settings.ownerAccountNumber) ? `<div><small>🏦 ${escapeHtml(settings.ownerBankName)}:</small> <strong>${escapeHtml(settings.ownerAccountNumber)}</strong></div>` : ''}
            </div>
            ${settings.ownerQrDataUrl ? `<div class="qc-owner-qr-thumb-wrap"><img src="${escapeHtml(settings.ownerQrDataUrl)}" alt="Owner Payment QR" class="qc-owner-qr-thumb"></div>` : ''}
          </div>
        `;
      } else {
        ownerPaymentInfo.hidden = true;
        ownerPaymentInfo.innerHTML = '';
      }
    } else if (ownerPaymentInfo) {
      ownerPaymentInfo.hidden = true;
      ownerPaymentInfo.innerHTML = '';
    }
  }

  // Handle screenshot upload & preview: the picked image is downscaled +
  // recompressed to the storable proof cap BEFORE it is kept — a raw
  // phone screenshot would blow the ledger's storage quota. A pick that
  // cannot be shrunk enough is refused with a message and nothing is
  // stored (the old flat 1 MB pick rejection is gone: big originals
  // are welcome, only the stored copy is small).
  screenshotInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      currentScreenshotDataUrl = await compressPaymentProofImage(file);
      if (screenshotPreview) screenshotPreview.src = currentScreenshotDataUrl;
      if (screenshotPreviewWrap) screenshotPreviewWrap.hidden = false;
    } catch {
      currentScreenshotDataUrl = '';
      screenshotInput.value = '';
      if (screenshotPreviewWrap) screenshotPreviewWrap.hidden = true;
      if (screenshotPreview) screenshotPreview.src = '';
      if (typeof onToast === 'function') onToast(t('proof_too_large'));
    }
  });

  removeScreenshotBtn?.addEventListener('click', () => {
    currentScreenshotDataUrl = '';
    if (screenshotInput) screenshotInput.value = '';
    if (screenshotPreviewWrap) screenshotPreviewWrap.hidden = true;
    if (screenshotPreview) screenshotPreview.src = '';
  });

  function syncMethodChips(val) {
    quickMethodChips.forEach(chip => {
      const isMatch = chip.getAttribute('data-method') === val;
      chip.classList.toggle('is-active', isMatch);
    });
    // Plan 438: the Other button lights exactly while the select holds
    // a valid method that is none of the three big buttons and not a
    // cash-family method (a shop method keeps Cash lit, per the
    // shop-chip rule below); the full method list shows exactly while
    // Other is lit, so the list is reachable for anything else and
    // hides again the moment a big button is picked.
    const isOther = bigWalletMethodIsOtherMethod(val, PAYMENT_METHODS, isCashPaymentMethod(val));
    bigWalletOtherBtn?.classList.toggle('is-active', isOther);
    if (methodSelect) methodSelect.style.display = isOther ? '' : 'none';
    // Plan 444: every method change refreshes the pending-clearance
    // flag too — a chip tap, a shop pick, a list pick, or the form
    // opening with a remembered method all land here, so the flag
    // can never sit stale beside a method it does not belong to.
    renderPendingClearanceFlag();
    syncShopChips();
  }

  // OWNER-CASH-SHOP: render the "Cash received at" chips from
  // quickCollectShopChoices(). The hidden method select stays the single
  // source of truth — a chip click writes that choice's method string
  // into it, so the form submit (executeQuickCollection) records it with
  // no new save branch. Shop names are brand strings (untranslated, the
  // SISP-86 precedent); only the prompt and the Owner Office label
  // localise.
  function renderShopChips() {
    if (!shopChipsEl) return;
    if (shopLabelEl) shopLabelEl.textContent = t('cashshop_where_label');
    shopChipsEl.setAttribute('aria-label', t('cashshop_where_label'));
    shopChipsEl.innerHTML = '';
    shopChipButtons = quickCollectShopChoices().map((choice) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'qc-shop-chip';
      btn.setAttribute('data-shop-method', choice.method);
      btn.setAttribute('role', 'radio');
      btn.textContent = choice.labelKey ? t(choice.labelKey) : choice.label;
      btn.addEventListener('click', () => {
        if (methodSelect) methodSelect.value = choice.method;
        // Plan 438: route through syncMethodChips (which ends in
        // syncShopChips) so a shop pick also clears the Other button
        // and hides the full list — a shop method is cash-family,
        // so Cash stays lit and the list has nothing to offer.
        syncMethodChips(choice.method);
      });
      shopChipsEl.appendChild(btn);
      return btn;
    });
    syncShopChips();
  }

  // Shows the sub-row only while a cash-family method is selected and
  // marks the chip matching the select's current value: the shop whose
  // canonical collector it resolves to (a legacy shop method lights the
  // unified shop's chip), or Owner Office for plain 'Cash'.
  function syncShopChips() {
    if (!shopRowEl) return;
    const current = methodSelect ? String(methodSelect.value || 'Cash') : 'Cash';
    const cashFamily = isCashPaymentMethod(current);
    shopRowEl.hidden = !cashFamily;
    // Plan 432: the calculator follows the same cash-family rule —
    // a method change re-shows it or hides it. This runs before the
    // early return so switching away from cash hides it too.
    renderCashChange();
    if (!cashFamily) return;
    const activeShop = resolveShopCollector(current);
    // A shop method has no method chip of its own — keep Cash lit.
    quickMethodChips.forEach(chip => {
      if (chip.getAttribute('data-method') === 'Cash') chip.classList.toggle('is-active', true);
    });
    shopChipButtons.forEach(btn => {
      const shop = resolveShopCollector(btn.getAttribute('data-shop-method'));
      const isActive = shop ? shop === activeShop : activeShop === null;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-checked', String(isActive));
    });
  }

  // Wire 1-tap method chips
  quickMethodChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const chosenMethod = chip.getAttribute('data-method');
      if (methodSelect && chosenMethod) {
        methodSelect.value = chosenMethod;
      }
      syncMethodChips(chosenMethod);
      updateDigitalVisibility(chosenMethod);
    });
  });

  methodSelect?.addEventListener('change', () => {
    syncMethodChips(methodSelect.value);
    updateDigitalVisibility(methodSelect.value);
  });

  // Plan 438: the Other button reveals the full method list for
  // anything the big buttons do not cover. It selects nothing by
  // itself — the operator's pick from the revealed list writes the
  // select, and syncMethodChips lights Other while a non-big method
  // holds. If the operator closes the list without picking, nothing
  // changes: the big button that was lit stays lit.
  bigWalletOtherBtn?.addEventListener('click', () => {
    if (methodSelect) {
      methodSelect.style.display = '';
      methodSelect.focus();
      try { methodSelect.showPicker?.(); } catch { /* picker unsupported — the revealed list is enough */ }
    }
  });

  // SISP-161: wire the 1-tap payment-date chips (Today / Yesterday /
  // Prev Month End / Custom). A chip only sets the existing date input's
  // value — computed fresh at tap time on the PKT calendar — so the
  // chosen date flows through the normal submit -> executeQuickCollection
  // recorder path unchanged, and its month attribution follows
  // payment.date everywhere the app attributes by payment date.
  // 'custom' never invents a date: it hands focus to the date input so
  // the operator types/picks their own.
  const dateChips = modal.querySelectorAll('[data-qc-date-chip]');
  dateChips.forEach(chip => {
    chip.addEventListener('click', () => {
      if (!dateInput) return;
      const chipKind = chip.getAttribute('data-qc-date-chip');
      if (chipKind === 'custom') {
        dateInput.focus();
        try { dateInput.showPicker?.(); } catch { /* picker unsupported — focus alone is enough */ }
        return;
      }
      const value = computePaymentDateChip(chipKind, getPakistanLocalDate(), dateInput.value);
      if (value) {
        dateInput.value = value;
        dateInput.dispatchEvent(new Event('input', { bubbles: true }));
        dateInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });

  // SISP-30: refresh the concession badge when the operator picks another month.
  monthSelect?.addEventListener('change', () => {
    // SISP-181: an uptime fill belongs to the month it was made for.
    uptimeConcessionFill = null;
    if (activeCustomerId) renderConcessionBox(activeCustomerId, monthSelect.value);
    if (activeCustomerId) renderUptimeLine(activeCustomerId, monthSelect.value);
    // SISP-101: the waiver tick belongs to one bill's fee — a month
    // switch resets it and re-plans against the newly picked bill.
    waiverTicked = false;
    if (activeCustomerId) renderWaiverBox(activeCustomerId, monthSelect.value);
    // Plan 381: the preview belongs to the picked month too — a month
    // switch re-numbers it before anything is saved.
    renderNextReceiptLine();
    // Plan 385: the settlement preview belongs to the picked month
    // too — a month switch re-settles it before anything is saved.
    renderSettlementPreview();
    // Plan 386: a month switch moves the dues too, so the choice is
    // re-offered for the new total before anything is saved.
    renderOverpaymentChoice();
    // Plan 387: a month switch moves the dues too, so the warning is
    // re-shown for the new remaining figure before anything is saved.
    renderUnderpaymentWarning();
  });

  // SISP-101: the waiver gate depends on the amount being collected, so
  // the box re-plans on every amount edit (chips re-render explicitly —
  // they set the value programmatically and fire no input event).
  amountInput?.addEventListener('input', () => {
    if (activeCustomerId) renderWaiverBox(activeCustomerId, monthSelect?.value || activeDefaults?.targetMonth);
  });
  // Plan 377: the words follow every keystroke in the amount field.
  amountInput?.addEventListener('input', () => renderAmountWordsLine());
  // Plan 385: the settlement preview follows every keystroke too —
  // changing the amount re-settles it before anything is saved.
  amountInput?.addEventListener('input', () => renderSettlementPreview());
  // Plan 386: the choice follows every keystroke too — changing the
  // amount re-offers (or withdraws) it before anything is saved.
  amountInput?.addEventListener('input', () => renderOverpaymentChoice());
  // Plan 387: the warning follows every keystroke too — changing the
  // amount re-shows (or withdraws) it before anything is saved.
  amountInput?.addEventListener('input', () => renderUnderpaymentWarning());
  // Plan 432: the change follows every keystroke too — changing the
  // amount re-computes it before anything is saved.
  amountInput?.addEventListener('input', () => renderCashChange());
  // Plan 432: the change follows every keystroke in the cash field —
  // the line updates as the cash figure is typed.
  cashReceivedInput?.addEventListener('input', () => renderCashChange());
  advanceCheckbox?.addEventListener('change', () => {
    // An advance collection can never carry a waiver (see
    // executeQuickCollection) — the box hides while Advance is ticked.
    if (activeCustomerId) renderWaiverBox(activeCustomerId, monthSelect?.value || activeDefaults?.targetMonth);
  });
  // Plan 385: the Advance tag changes which bills the typed amount
  // can reach — the reservation holds the leftover back — so the
  // preview re-settles when it is ticked or cleared, and when its
  // target month moves.
  advanceCheckbox?.addEventListener('change', () => renderSettlementPreview());
  advanceTargetSelect?.addEventListener('change', () => renderSettlementPreview());
  // Plan 386: ticking Advance hides the choice (the money is already
  // advance), and clearing it re-offers the choice when the amount
  // exceeds the dues.
  advanceCheckbox?.addEventListener('change', () => renderOverpaymentChoice());
  // Plan 387: ticking Advance hides the warning (the money is already
  // advance, not a dues payment), and clearing it re-shows it.
  advanceCheckbox?.addEventListener('change', () => renderUnderpaymentWarning());

  // SISP-126: the Remainder Waada row tracks the amount live (typing, and
  // the payment date / Advance toggle, which move the chip dates and the
  // flow the row belongs to).
  amountInput?.addEventListener('input', () => renderRemainderWaadaRow());
  dateInput?.addEventListener('change', () => renderRemainderWaadaRow());
  advanceCheckbox?.addEventListener('change', () => renderRemainderWaadaRow());
  // Plan 533: the split total follows every keystroke in either leg —
  // the amount field is leg 1, the split amount field is leg 2.
  amountInput?.addEventListener('input', () => renderSplitTotal());
  splitAmountInput?.addEventListener('input', () => renderSplitTotal());

  // Populate payment methods select once
  if (methodSelect && methodSelect.options.length <= 1) {
    methodSelect.innerHTML = PAYMENT_METHODS.map(m =>
      `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`
    ).join('');
  }

  // SISP-121: leg-2 method select (every real method, shop methods
  // included) + split visibility. Leg 2 defaults to Easypaisa so the
  // common cash + wallet split needs no method hunting; the module
  // still refuses a same-method "split" at save time.
  if (splitMethodSelect && splitMethodSelect.options.length === 0) {
    splitMethodSelect.innerHTML = PAYMENT_METHODS.map(m =>
      `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`
    ).join('');
    if (PAYMENT_METHODS.includes('Easypaisa')) splitMethodSelect.value = 'Easypaisa';
  }
  function updateSplitVisibility() {
    const on = !!splitToggle?.checked;
    if (splitFields) splitFields.hidden = !on;
    const leg2Digital = on && isDigitalPaymentMethod(splitMethodSelect?.value || '');
    if (splitDigitalFields) splitDigitalFields.hidden = !leg2Digital;
    // Plan 533: toggling the split — or reopening the sheet, which
    // resets it off without a change event — re-renders the total
    // with the current leg figures. No new split change listener is
    // added here: the five-listener pin (Plan 527) stays exactly 5.
    renderSplitTotal();
    // Plan 535: toggling the split, or picking the second leg's
    // method, re-renders the pending-clearance flag with both
    // legs' methods — a Bank Transfer leg 2 flags while entering,
    // exactly like leg 1. No new split change listener is added
    // here either: the five-listener pin (Plan 527) stays exactly 5.
    renderPendingClearanceFlag();
  }
  splitToggle?.addEventListener('change', updateSplitVisibility);
  // Plan 386: splitting the payment hides the choice (each leg is an
  // ordinary payment of its own), and un-splitting re-offers it.
  splitToggle?.addEventListener('change', () => renderOverpaymentChoice());
  // Plan 387: splitting the payment hides the warning (each leg is an
  // ordinary payment of its own), and un-splitting re-shows it.
  splitToggle?.addEventListener('change', () => renderUnderpaymentWarning());
  // Plan 432: splitting the payment hides the calculator (each leg is
  // an ordinary payment of its own), and un-splitting re-shows it.
  splitToggle?.addEventListener('change', () => renderCashChange());
  // Plan 527: splitting the payment hides the next-receipt line (a
  // split issues two receipt numbers, so no single number can be
  // quoted), and un-splitting shows it again.
  splitToggle?.addEventListener('change', () => renderNextReceiptLine());
  splitMethodSelect?.addEventListener('change', updateSplitVisibility);

  function updateCounts() {
    const state = getState();
    if (!state) return;
    const allDues = getPendingCollectionCustomers(state, '', 'all-dues');
    const highDues = getPendingCollectionCustomers(state, '', 'high-dues');
    const all = getPendingCollectionCustomers(state, '', 'all');

    if (duesCountEl) duesCountEl.textContent = allDues.length;
    if (highDuesCountEl) highDuesCountEl.textContent = highDues.length;
    if (allCountEl) allCountEl.textContent = all.length;
    refreshDailyEntrySummary();
    refreshRoundTotals();
    refreshDailyTargetProgress();
    refreshEndOfDaySummary();
  }

  // Plan 400: refresh the live daily entry summary on the entry
  // screen from the transactions recorded on this device. It runs
  // inside updateCounts, so it refreshes on every open and after
  // each save, from the fresh state. It summarises only — it
  // settles nothing and changes no record.
  function refreshDailyEntrySummary() {
    if (!dailyEntrySummaryEl) return;
    const state = getState();
    if (!state || !Array.isArray(state.customers)) return;
    const summary = dailyEntrySummary(listTransactions(state), getPakistanLocalDate());
    dailyEntrySummaryEl.textContent = dailyEntrySummaryText(summary);
  }

  // Plan 439: refresh the live round total on the picker screen from
  // the transactions recorded on this device since this round
  // started. It runs inside updateCounts, so it refreshes on every
  // open and after each save, from the fresh state. The round start
  // is set when the sheet opens; the backstop below covers the
  // select-and-open path, which reaches the sheet without the open
  // call. It totals only — it settles nothing and changes no record.
  function refreshRoundTotals() {
    if (!roundTotalsEl) return;
    if (roundStartMs === null) roundStartMs = Date.now();
    const state = getState();
    if (!state || !Array.isArray(state.customers)) return;
    const totals = quickCollectRoundTotals(listTransactions(state), roundStartMs);
    roundTotalsEl.textContent = quickCollectRoundTotalsText(totals);
  }

  // Plan 445: refresh the live daily target progress bar on the
  // picker screen from the transactions recorded on this device
  // today and the day target already stored for today. It runs
  // inside updateCounts, so it refreshes on every open and after
  // each save, from the fresh state. The collected figure is the
  // same today total the entry summary shows, so the bar can never
  // drift from it on the same fixture; the target is read, never
  // set or changed, here. With no target stored the bar is hidden
  // and only the collected total shows. It shows progress only —
  // it settles nothing and changes no record.
  function refreshDailyTargetProgress() {
    if (!dailyTargetProgressEl) return;
    const state = getState();
    if (!state || !Array.isArray(state.customers)) return;
    const today = getPakistanLocalDate();
    const collected = dailyEntrySummary(listTransactions(state), today).total;
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    const target = getDayTarget(storage, today).amount;
    dailyTargetProgressEl.innerHTML = dailyTargetProgressHtml(dailyTargetProgress(collected, target));
  }

  // Plan 448: refresh the end-of-day summary panel from the
  // transactions recorded on this device today, while it is open.
  // It runs inside updateCounts, so it refreshes on every open and
  // after each save, from the fresh state. It summarises only — it
  // settles nothing and changes no record.
  function refreshEndOfDaySummary() {
    if (!endOfDaySummaryEl || endOfDaySummaryEl.hidden) return;
    const state = getState();
    if (!state || !Array.isArray(state.customers)) return;
    endOfDaySummaryEl.innerHTML = quickCollectEndOfDaySummaryHtml(
      quickCollectEndOfDaySummary(listTransactions(state), getPakistanLocalDate())
    );
  }

  // Plan 448: open or close the end-of-day summary panel from its
  // button. Opening renders the summary from the fresh state first,
  // so the panel can never show a stale day; closing only hides it.
  function toggleEndOfDaySummary() {
    if (!endOfDaySummaryEl) return;
    if (endOfDaySummaryEl.hidden) {
      const state = getState();
      if (!state || !Array.isArray(state.customers)) return;
      endOfDaySummaryEl.innerHTML = quickCollectEndOfDaySummaryHtml(
        quickCollectEndOfDaySummary(listTransactions(state), getPakistanLocalDate())
      );
      endOfDaySummaryEl.hidden = false;
      endOfDaySummaryBtn?.setAttribute('aria-expanded', 'true');
    } else {
      endOfDaySummaryEl.hidden = true;
      endOfDaySummaryBtn?.setAttribute('aria-expanded', 'false');
    }
  }

  // Plan 450: open or close the new-customer quick-add form on the
  // picker step. Opening renders the fields fresh from the module,
  // so a half-typed add never survives a close; closing only hides
  // it. It creates the customer only — the full onboarding
  // checklist is never opened or changed here.
  function toggleNewCustomerForm() {
    if (!newCustomerForm) return;
    if (newCustomerForm.hidden) {
      newCustomerForm.innerHTML = quickAddFormFieldsHtml();
      newCustomerForm.hidden = false;
      newCustomerBtn?.setAttribute('aria-expanded', 'true');
      newCustomerForm.querySelector('#ncaName')?.focus();
    } else {
      newCustomerForm.hidden = true;
      newCustomerBtn?.setAttribute('aria-expanded', 'false');
      newCustomerBtn?.focus();
    }
  }

  // Plan 450: submit the quick-add from the picker step. The four
  // fields are read through the form element, never bare
  // document.querySelector; a refused add shows the first error in
  // the form's own error line and focuses that field; a created
  // customer is committed, the picker refreshes, and the payment
  // form opens for them straight away. The Add button disables
  // while the submit runs, so a double tap cannot create the
  // customer twice.
  function submitNewCustomerQuickAdd() {
    if (!newCustomerForm) return;
    const addBtn = newCustomerForm.querySelector('#ncaAddButton');
    if (addBtn) addBtn.disabled = true;
    const input = {
      name: newCustomerForm.querySelector('#ncaName')?.value ?? '',
      phone: newCustomerForm.querySelector('#ncaPhone')?.value ?? '',
      mohalla: newCustomerForm.querySelector('#ncaMohalla')?.value ?? '',
      packageId: newCustomerForm.querySelector('#ncaPackage')?.value ?? '',
    };
    const result = quickAddCustomer(getState(), input, new Date());
    const errorEl = newCustomerForm.querySelector('#ncaError');
    if (!result.ok) {
      const firstField = ['name', 'phone', 'mohalla', 'package', 'form'].find((key) => result.errors?.[key]);
      const message = firstField ? result.errors[firstField] : 'Could not add this customer.';
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.hidden = false;
      }
      if (addBtn) addBtn.disabled = false;
      const focusId = { name: '#ncaName', phone: '#ncaPhone', mohalla: '#ncaMohalla', package: '#ncaPackage' }[firstField];
      if (focusId) newCustomerForm.querySelector(focusId)?.focus();
      return;
    }
    if (typeof onSaveState === 'function') onSaveState(result.nextState);
    updateCounts();
    renderList();
    newCustomerForm.hidden = true;
    newCustomerBtn?.setAttribute('aria-expanded', 'false');
    if (typeof onToast === 'function') onToast(quickAddCustomerSummaryText(result));
    openCustomerCollectionForm(result.customer.id);
  }

  function renderList() {
    const state = getState();
    if (!state || !customerListContainer) return;
    const query = searchInput?.value ?? '';
    const picked = renderQuickCollectPickerHtml(state, query, activeFilter, activeCustomerId, activeMohallaFilter);
    customerListContainer.innerHTML = picked.html;
    if (mohallaFilterSummary) {
      mohallaFilterSummary.textContent = activeMohallaFilter
        ? quickCollectMohallaFilterSummaryText(picked.customers, activeMohallaFilter)
        : '';
    }
    renderNamePrefixList();
    renderLastFourList();
    renderRecentQuickPick();
  }

  // Plan 488: the dues-and-status context for the picker lookup
  // rows — the allocation engine for this state, the ids of
  // customers with an open suspension, the current month, and today.
  // The pure picker-dues module takes this context and returns one
  // line per listed customer; nothing here changes any record.
  function pickerLookupDuesContext(state) {
    const referenceDate = new Date();
    return {
      allocations: calculatePaymentAllocations(state),
      suspendedCustomerIds: typeof loadSuspensions === 'function'
        ? loadSuspensions().filter((record) => record?.status === 'open').map((record) => record.customerId)
        : [],
      currentMonth: monthsForHistory(referenceDate)[0],
      referenceDate,
    };
  }

  // Plan 427: the live name-prefix lookup — two or more typed letters
  // list every customer whose name starts with them, in name order.
  // Clearing the field clears the list: fewer than two letters
  // renders nothing at all. Plan 446: a chosen mohalla narrows it
  // too, so the lookup never surfaces a customer outside the round.
  // Plan 488: each row also shows that customer's dues in PKR and
  // status in plain words beside the name and mohalla.
  function renderNamePrefixList() {
    if (!namePrefixList) return;
    const state = getState();
    const query = searchInput?.value ?? '';
    const matches = filterQuickCollectByMohalla(namePrefixLookupMatches(state?.customers ?? [], query), activeMohallaFilter);
    namePrefixList.innerHTML = namePrefixLookupHtml(matches, pickerDuesTextForMatches(state?.customers ?? [], matches, pickerLookupDuesContext(state)));
  }

  // Plan 441: the last-four-digits lookup — four typed digits list
  // every customer whose number ends with them, in name order.
  // Anything other than exactly four digits renders nothing at all.
  // Plan 446: a chosen mohalla narrows it too, like the picker list.
  // Plan 488: each row also shows that customer's dues in PKR and
  // status in plain words beside the name and mohalla.
  function renderLastFourList() {
    if (!lastFourList) return;
    const state = getState();
    const query = searchInput?.value ?? '';
    const matches = filterQuickCollectByMohalla(findCustomersByLastFourDigits(state?.customers ?? [], query), activeMohallaFilter);
    lastFourList.innerHTML = lastFourDigitsHtml(matches, query, pickerDuesTextForMatches(state?.customers ?? [], matches, pickerLookupDuesContext(state)));
  }

  // Plan 428: the recent-customers quick-pick — the last ten
  // customers collected from, latest first, with name, mohalla and
  // dues. It picks only and records nothing. The dues come from the
  // picker's own shared total (bills plus unpaid manual baqaya), so
  // the row never shows a different dues figure than the picker
  // below it; a customer with no figure reads as not recorded,
  // never as zero. It refreshes on every list render, so the
  // customer just collected from moves to the top of the row at once.
  function renderRecentQuickPick() {
    if (!recentQuickPickList) return;
    const state = getState();
    if (!state || !Array.isArray(state.customers)) {
      recentQuickPickList.innerHTML = '';
      return;
    }
    const duesCentsById = {};
    for (const entry of getPendingCollectionCustomers(state, '', 'all')) {
      duesCentsById[entry.id] = Math.round(entry.totalDues * 100);
    }
    recentQuickPickList.innerHTML = recentQuickPickHtml(
      recentQuickPickEntries(state.customers, listTransactions(state), duesCentsById)
    );
  }

  function setFilter(filter) {
    activeFilter = filter || 'all-dues';
    filterChips.forEach(c => {
      const isActive = c.getAttribute('data-filter') === activeFilter;
      c.classList.toggle('is-active', isActive);
      c.setAttribute('aria-selected', String(isActive));
    });
  }

  function showStep(stepName) {
    if (stepPick) stepPick.hidden = (stepName !== 'pick');
    if (stepForm) stepForm.hidden = (stepName !== 'form');
    if (stepConfirm) stepConfirm.hidden = (stepName !== 'confirm');
    if (stepSuccess) stepSuccess.hidden = (stepName !== 'success');
    if (stepOneScreen) stepOneScreen.hidden = (stepName !== 'one-screen');
    // Polish 17: the success-only compact + eyebrow rules hang off this
    // class on the modal (the header sits outside the step div).
    if (modal) modal.classList.toggle('qc-success-open', stepName === 'success');
    // Polish 21 (Req 7): the tick animation must visibly play on EVERY
    // showing. The base rules carry no animation (it would run once at
    // page load while the step is hidden), so re-trigger it here: drop
    // the trigger class, force a reflow, re-add it. A DOM change the
    // engine must honour on every WebView — unlike display toggling,
    // it cannot be optimised away. Guarded for stub hosts (no modal /
    // no querySelector / no tick): the screen works exactly as before
    // with a static tick, no toast, no throw.
    if (stepName === 'success' && modal && typeof modal.querySelector === 'function') {
      const tick = modal.querySelector('.qc-success-check');
      if (tick && tick.classList) {
        tick.classList.remove('qc-tick-play');
        void tick.offsetWidth;
        tick.classList.add('qc-tick-play');
      }
    }
  }

  // SISP-30: outage concession badge + 1-click apply/remove for one bill
  // month. The suggested amount is recomputed at click time from fresh
  // complaints, never trusted from markup. After an apply, the amount field
  // is pointed at the net due so the collector collects the conceded amount.
  // Uptime tracking: compact duration text ("28 days 18 hours") from
  // the shared upt_dur_* strings.
  function qcDurationText(totalMinutes) {
    const parts = splitMinutes(totalMinutes);
    const pieces = [];
    if (parts.days) pieces.push(parts.days === 1 ? t('upt_dur_day_1') : t('upt_dur_days', null, { n: parts.days }));
    if (parts.hours) pieces.push(parts.hours === 1 ? t('upt_dur_hour_1') : t('upt_dur_hours', null, { n: parts.hours }));
    if (parts.minutes) pieces.push(parts.minutes === 1 ? t('upt_dur_min_1') : t('upt_dur_mins', null, { n: parts.minutes }));
    return pieces.length ? pieces.join(' ') : t('upt_dur_zero');
  }

  // Uptime tracking: the month-end online/offline summary the owner
  // wants in front of the collector while the month's bill is being
  // paid. Unlike the concession box it needs no bill — it renders for
  // any customer (including free connections) from their recorded
  // offline periods and status history alone.
  function renderUptimeLine(customerId, month) {
    if (!uptimeLine) return;
    uptimeLine.textContent = '';
    try {
      const state = getState();
      if (!state || !customerId || !month) return;
      const customer = state.customers.find(c => c.id === customerId);
      if (!customer) return;
      const summary = buildMonthlyUptime(customer, month, new Date());
      uptimeLine.textContent = t('upt_qc_line', null, {
        month,
        online: qcDurationText(summary.onlineMinutes),
        offline: qcDurationText(summary.offlineMinutes),
        days: summary.daysInMonth
      });
      // SISP-181: 1-tap bridge from this uptime summary to the SISP-30
      // concession box. The button acts on the month's bill, so — exactly
      // like the concession box itself — it renders only when a bill
      // exists for the month and no concession is stamped on it yet.
      // Free connections never get a bill, so for them the button is
      // absent just like the manual concession control is.
      const bill = customer.bills?.find(b => b.month === month);
      if (bill && !(Number(bill.concessionAmount) > 0)) {
        const fillBtn = document.createElement('button');
        fillBtn.type = 'button';
        fillBtn.className = 'apply-late-fee-btn';
        fillBtn.setAttribute('data-qc-uptime-concession', '');
        fillBtn.textContent = t('upt_qc_apply_concession');
        fillBtn.addEventListener('click', () => fillUptimeConcession(customerId, month));
        uptimeLine.appendChild(document.createTextNode(' '));
        uptimeLine.appendChild(fillBtn);
      }
    } catch {
      uptimeLine.textContent = '';
    }
  }

  // SISP-181: the ⚡ button's whole job is to FILL the concession box with
  // the uptime-based suggestion. It stamps nothing itself — the operator
  // still taps the box's normal Apply button, which runs the existing
  // applyConcessionToBill path, so an auto-filled concession lands on the
  // bill exactly like a manually applied one. Below the SISP-30 threshold
  // the button invents nothing: a toast reports the recorded hours.
  function fillUptimeConcession(customerId, month) {
    try {
      const state = getState();
      if (!state || !customerId || !month) return;
      const customer = state.customers.find(c => c.id === customerId);
      const bill = customer?.bills?.find(b => b.month === month);
      if (!customer || !bill) return;
      const suggestion = buildUptimeConcessionSuggestion(customer, bill, { referenceDate: new Date() });
      if (!suggestion.eligible) {
        if (typeof onToast === 'function') onToast(t('upt_qc_concession_below_threshold', null, { hours: suggestion.downtimeHours, threshold: suggestion.thresholdHours }));
        return;
      }
      uptimeConcessionFill = { customerId, month };
      renderConcessionBox(customerId, month);
      if (typeof onToast === 'function') onToast(t('upt_qc_concession_filled', null, { amount: suggestion.suggestedAmount }));
    } catch {
      // Leave the concession box exactly as it was.
    }
  }

  // SISP-126: the Remainder Waada row. It appears ONLY while the typed
  // amount is a true partial of the payable figure this modal itself
  // displays (activeDefaults.payableTotal — open bills plus pending
  // ticket, addon and manual-baqaya charges) — the remainder is that
  // figure minus the typed amount via the shared computeRemainderWaada,
  // never a second hand-summed total. Plan 523: the figure is the
  // payable total unconditionally — addon and manual-baqaya charges
  // used to count only when a ticket charge happened to be pending,
  // so the "Baqi Rs …" line could understate the remainder. Full /
  // over / zero / invalid amounts (and the Advance-tagged flow, whose
  // money is early credit rather than a partial settlement) hide the
  // row and clear any chip selection, so a stale waada can never ride
  // along with a payment it no longer matches.
  function renderRemainderWaadaRow() {
    if (!remainderWaadaRow) return;
    const hide = () => {
      remainderWaadaRow.hidden = true;
      remainderWaadaRow.innerHTML = '';
      selectedRemainderWaadaDate = null;
      remainderWaadaSkipped = false;
    };
    try {
      if (!activeCustomerId || !activeDefaults || advanceCheckbox?.checked) { hide(); return; }
      const payable = activeDefaults.payableTotal;
      const partial = computeRemainderWaada(payable, Number(amountInput?.value));
      if (!partial) { hide(); return; }
      const baseDate = isValidWaadaDate(dateInput?.value ?? '') ? dateInput.value : getPakistanLocalDate();
      const dates = remainderWaadaChipDates(baseDate);
      if (!dates) { hide(); return; }
      // A payment-date change can strand a previously tapped chip date —
      // the selection survives only while it is still one of the chips.
      if (selectedRemainderWaadaDate
        && ![dates.plus3, dates.plus7, dates.tenth, dates.fifteenth].includes(selectedRemainderWaadaDate)) {
        selectedRemainderWaadaDate = null;
        remainderWaadaSkipped = false;
      }
      const chipBtn = (key, label, date) => {
        const active = selectedRemainderWaadaDate === date;
        return `<button type="button" class="qc-remwaada-chip${active ? ' is-active' : ''}" data-remwaada-chip="${key}" aria-pressed="${active}">${escapeHtml(label)}${date ? ` · ${escapeHtml(date.slice(5))}` : ''}</button>`;
      };
      remainderWaadaRow.innerHTML = `
        <p class="qc-remwaada-label">🤝 ${escapeHtml(t('remwaada_row_label', null, { amount: `Rs. ${partial.remainder.toLocaleString('en-PK')}` }))}</p>
        <div class="qc-remwaada-chips" role="group" aria-label="${escapeHtml(t('remwaada_chips_aria'))}">
          ${chipBtn('plus3', t('remwaada_chip_plus3'), dates.plus3)}
          ${chipBtn('plus7', t('remwaada_chip_plus7'), dates.plus7)}
          ${chipBtn('tenth', t('remwaada_chip_10th'), dates.tenth)}
          ${chipBtn('fifteenth', t('remwaada_chip_15th'), dates.fifteenth)}
          <button type="button" class="qc-remwaada-chip${remainderWaadaSkipped ? ' is-active' : ''}" data-remwaada-chip="skip" aria-pressed="${remainderWaadaSkipped}">${escapeHtml(t('remwaada_chip_skip'))}</button>
        </div>
        ${selectedRemainderWaadaDate ? `<p class="qc-remwaada-set">${escapeHtml(t('remwaada_set_line', null, { date: selectedRemainderWaadaDate }))}</p>` : ''}`;
      remainderWaadaRow.hidden = false;
    } catch {
      hide();
    }
  }

  // Chip taps are the ONLY way a remainder waada gets chosen: a date chip
  // arms it (re-rendered as the active chip), Skip disarms it. Nothing is
  // persisted here — the armed date rides the submit into
  // executeQuickCollection, which writes the promise only when the
  // payment itself records.
  remainderWaadaRow?.addEventListener('click', (event) => {
    const chip = event.target.closest?.('[data-remwaada-chip]');
    if (!chip) return;
    const key = chip.getAttribute('data-remwaada-chip');
    if (key === 'skip') {
      selectedRemainderWaadaDate = null;
      remainderWaadaSkipped = true;
      renderRemainderWaadaRow();
      return;
    }
    const baseDate = isValidWaadaDate(dateInput?.value ?? '') ? dateInput.value : getPakistanLocalDate();
    const dates = remainderWaadaChipDates(baseDate);
    const picked = dates?.[key];
    if (!picked) return;
    selectedRemainderWaadaDate = picked;
    remainderWaadaSkipped = false;
    renderRemainderWaadaRow();
  });

  // Plan 538: capture the operator's entries before a concession
  // reopen, and restore them after it — the same capture/restore
  // pattern as polish #13's package-change reopen, which restores
  // only the amount. The concession reopen (openCustomerCollectionForm)
  // resets method, date, digital fields, split leg 2 and the
  // screenshot to defaults, so without this the operator re-types
  // the whole payment at the counter. The amount is NOT carried
  // here: the Apply handler sets it to the post-concession net
  // balance after the reopen, and the Remove handler leaves the
  // fresh prefill (full dues, concession gone).
  function captureConcessionFormEntries() {
    return {
      method: methodSelect ? String(methodSelect.value || '') : '',
      date: dateInput ? String(dateInput.value || '') : '',
      transactionId: transactionIdInput ? String(transactionIdInput.value || '') : '',
      senderName: senderNameInput ? String(senderNameInput.value || '') : '',
      senderDigits: senderDigitsInput ? String(senderDigitsInput.value || '') : '',
      overrideReason: overrideReasonInput ? String(overrideReasonInput.value || '') : '',
      paidBy: paidByInput ? String(paidByInput.value || '') : '',
      urduNote: urduNoteInput ? String(urduNoteInput.value || '') : '',
      splitOn: !!splitToggle?.checked,
      splitAmount: splitAmountInput ? String(splitAmountInput.value || '') : '',
      splitMethod: splitMethodSelect ? String(splitMethodSelect.value || '') : '',
      splitTransactionId: splitTransactionIdInput ? String(splitTransactionIdInput.value || '') : '',
      splitOverrideReason: splitOverrideReasonInput ? String(splitOverrideReasonInput.value || '') : '',
      splitSenderName: splitSenderNameInput ? String(splitSenderNameInput.value || '') : '',
      splitSenderDigits: splitSenderDigitsInput ? String(splitSenderDigitsInput.value || '') : '',
      screenshotDataUrl: currentScreenshotDataUrl || ''
    };
  }

  function restoreConcessionFormEntries(entries) {
    if (!entries || typeof entries !== 'object') return;
    // Method first: the chips, the digital-field visibility and the
    // clearance flag all follow the method. An empty method means
    // the operator never picked one — the reopen's remembered
    // default stands.
    if (methodSelect && entries.method) {
      methodSelect.value = entries.method;
      syncMethodChips(entries.method);
      updateDigitalVisibility(entries.method);
    }
    if (dateInput && entries.date) dateInput.value = entries.date;
    if (transactionIdInput) transactionIdInput.value = entries.transactionId || '';
    if (senderNameInput) senderNameInput.value = entries.senderName || '';
    if (senderDigitsInput) senderDigitsInput.value = entries.senderDigits || '';
    if (overrideReasonInput) overrideReasonInput.value = entries.overrideReason || '';
    if (paidByInput) paidByInput.value = entries.paidBy || '';
    if (urduNoteInput) urduNoteInput.value = entries.urduNote || '';
    // Split second: values in first, then one visibility pass, so
    // the total and the flag render with the restored leg in place.
    if (splitToggle) splitToggle.checked = entries.splitOn === true;
    if (splitAmountInput) splitAmountInput.value = entries.splitAmount || '';
    if (splitMethodSelect) splitMethodSelect.value = entries.splitMethod || '';
    if (splitTransactionIdInput) splitTransactionIdInput.value = entries.splitTransactionId || '';
    if (splitOverrideReasonInput) splitOverrideReasonInput.value = entries.splitOverrideReason || '';
    if (splitSenderNameInput) splitSenderNameInput.value = entries.splitSenderName || '';
    if (splitSenderDigitsInput) splitSenderDigitsInput.value = entries.splitSenderDigits || '';
    if (entries.splitOn === true) updateSplitVisibility();
    // Screenshot: the file input itself cannot be re-filled, but the
    // data URL is what the submit records — restore it and the
    // preview, so the proof survives the reopen.
    if (entries.screenshotDataUrl) {
      currentScreenshotDataUrl = entries.screenshotDataUrl;
      if (screenshotPreview) screenshotPreview.src = entries.screenshotDataUrl;
      if (screenshotPreviewWrap) screenshotPreviewWrap.hidden = false;
    }
  }

  function renderConcessionBox(customerId, month) {
    if (!concessionBox) return;
    concessionBox.innerHTML = '';
    try {
      const state = getState();
      if (!state || !customerId || !month) return;
      const customer = state.customers.find(c => c.id === customerId);
      const bill = customer?.bills?.find(b => b.month === month);
      if (!customer || !bill) return;
      // SISP-181: while an uptime fill is active for this customer + month,
      // the box renders the uptime-tracking suggestion; otherwise the
      // SISP-16 complaint-register suggestion, exactly as before.
      const useUptimeFill = Boolean(uptimeConcessionFill && uptimeConcessionFill.customerId === customerId && uptimeConcessionFill.month === month);
      const suggestion = useUptimeFill
        ? buildUptimeConcessionSuggestion(customer, bill, { referenceDate: new Date() })
        : buildConcessionSuggestion(customer, bill, loadComplaints());
      const allocations = calculatePaymentAllocations(state);
      const balanceCents = allocations.forMonth(customerId, month)?.balanceDueCents;
      const balance = typeof balanceCents === 'number' ? balanceCents / 100 : null;
      if (suggestion.alreadyApplied) {
        // Plan 538: balance is the engine's figure, already net of
        // the concession (core.js subtracts bill.concessionAmount
        // before receipts apply) — netDueAfterConcession would
        // subtract it a second time (900 − 100 = 800 on a 1,000
        // bill with a 100 concession). The helper's contract is a
        // GROSS due minus the concession (pinned by
        // tests/concession.test.js); the balance here is already net.
        const net = balance;
        concessionBox.innerHTML = `<span class="discount-badge-applied">Outage concession (Reaayat): −PKR ${suggestion.existingAmount}</span> <small>(${escapeHtml(suggestion.existingReason || 'Outage Reaayat')})</small>${net !== null ? ` <span>Net due: PKR ${net}</span>` : ''} <button type="button" class="waive-late-fee-btn" data-qc-remove-concession>Remove</button>`;
      } else if (suggestion.eligible) {
        // SISP-131: [Round to Rs. 50] toggle + mode beside the apply
        // button. Default off — the raw suggestion is stamped, exactly
        // as before SISP-131.
        const roundControls = balance !== null && balance > 0 ? ` <label class="round50-toggle-label"><input type="checkbox" data-qc-round50-toggle> ${escapeHtml(t('round50_toggle'))}</label> <select data-qc-round50-mode aria-label="${escapeHtml(t('round50_toggle'))}"><option value="nearest">${escapeHtml(t('round50_mode_nearest'))}</option><option value="down">${escapeHtml(t('round50_mode_down'))}</option><option value="exact">${escapeHtml(t('round50_mode_exact'))}</option></select> <small data-qc-round50-hint hidden></small>` : '';
        concessionBox.innerHTML = `<span class="discount-badge-applied">${escapeHtml(concessionBadgeText(suggestion))}</span>${balance !== null && balance > 0 ? ` <button type="button" class="apply-late-fee-btn" data-qc-apply-concession>Apply Rs. ${suggestion.suggestedAmount} Outage Concession</button>${roundControls}` : ''}`;
      } else {
        return;
      }
      concessionBox.querySelector('[data-qc-apply-concession]')?.addEventListener('click', () => {
        try {
          // Plan 538: capture the operator's entries before the
          // reopen below — the reopen resets method, date, digital
          // fields, split leg 2 and the screenshot to defaults.
          const entriesBeforeConcession = captureConcessionFormEntries();
          const freshState = getState();
          const freshCustomer = freshState.customers.find(c => c.id === customerId);
          const freshBill = freshCustomer?.bills?.find(b => b.month === month);
          if (!freshCustomer || !freshBill) throw new Error('Bill not found for this concession.');
          // SISP-181: recompute from the SAME source that filled the box —
          // an uptime fill must stamp the uptime figure, never silently
          // swap in the complaint-register one.
          const fresh = useUptimeFill
            ? buildUptimeConcessionSuggestion(freshCustomer, freshBill, { referenceDate: new Date() })
            : buildConcessionSuggestion(freshCustomer, freshBill, loadComplaints());
          if (!fresh.eligible) throw new Error('No outage concession is due for this bill month.');
          // SISP-131: read the toggle rendered beside this button; off
          // (or absent) the raw suggestion is stamped unchanged.
          const effective = roundedConcessionSuggestion(fresh, {
            enabled: concessionBox.querySelector('[data-qc-round50-toggle]')?.checked === true,
            mode: concessionBox.querySelector('[data-qc-round50-mode]')?.value || 'nearest'
          });
          const next = applyConcessionToBill(freshState, customerId, month, { amount: effective.suggestedAmount, reason: fresh.reason, rounding: effective.rounding });
          if (typeof onSaveState === 'function') onSaveState(next);
          uptimeConcessionFill = null;
          openCustomerCollectionForm(customerId);
          // Plan 538: restore the captured entries — the reopen
          // above reset them; the amount is set separately below
          // to the post-concession net balance, not the old figure.
          restoreConcessionFormEntries(entriesBeforeConcession);
          const netAllocations = calculatePaymentAllocations(getState());
          const netBalanceCents = netAllocations.forMonth(customerId, month)?.balanceDueCents;
          // Plan 538: the engine's balance is ALREADY net of the
          // concession (core.js subtracts bill.concessionAmount
          // before receipts apply), so the amount IS the balance —
          // netDueAfterConcession would subtract the concession a
          // second time (900 − 100 = 800 on a 1,000 bill with a 100
          // concession) and the operator would under-collect by the
          // concession. The helper's contract is a GROSS due minus
          // the concession (pinned by tests/concession.test.js).
          // Nothing due covers the whole bill: blank, like the
          // prefill's own "nothing due" rule.
          if (amountInput && typeof netBalanceCents === 'number') {
            amountInput.value = netBalanceCents > 0 ? (netBalanceCents / 100).toFixed(2) : '';
          }
          // Plan 377: the concession sets the amount after the form
          // opened, so the words refresh explicitly.
          renderAmountWordsLine();
          // Plan 432: the concession sets the amount, so the change
          // refreshes explicitly too.
          renderCashChange();
          if (typeof onToast === 'function') onToast(`Outage concession of PKR ${effective.suggestedAmount} applied to bill ${month}.`);
        } catch (err) {
          if (typeof onToast === 'function') onToast(err.message);
        }
      });
      // SISP-131: keep the apply button's amount + rounded-from hint in
      // step with the toggle/mode; a rounded figure of Rs. 0 cannot be
      // stamped (concessions must be positive), so the button disables.
      concessionBox.querySelectorAll('[data-qc-round50-toggle], [data-qc-round50-mode]').forEach(control => control.addEventListener('change', () => {
        const button = concessionBox.querySelector('[data-qc-apply-concession]');
        if (!button) return;
        const effective = roundedConcessionSuggestion(suggestion, {
          enabled: concessionBox.querySelector('[data-qc-round50-toggle]')?.checked === true,
          mode: concessionBox.querySelector('[data-qc-round50-mode]')?.value || 'nearest'
        });
        button.textContent = `Apply Rs. ${effective.suggestedAmount} Outage Concession`;
        button.disabled = effective.suggestedAmount <= 0;
        const hint = concessionBox.querySelector('[data-qc-round50-hint]');
        if (hint) {
          hint.hidden = !effective.rounding;
          hint.textContent = effective.rounding ? `(${t('round50_rounded_from', null, { amount: effective.rawSuggestedAmount })})` : '';
        }
      }));
      concessionBox.querySelector('[data-qc-remove-concession]')?.addEventListener('click', () => {
        try {
          // Plan 538: capture first — the reopen below resets the
          // form, exactly like the Apply path above.
          const entriesBeforeConcession = captureConcessionFormEntries();
          const next = removeConcessionFromBill(getState(), customerId, month, { reason: 'Outage concession removed by owner' });
          if (typeof onSaveState === 'function') onSaveState(next);
          uptimeConcessionFill = null;
          openCustomerCollectionForm(customerId);
          // Plan 538: restore the captured entries. The amount is
          // NOT touched here: the fresh prefill is the full dues
          // again, which is exactly right once the concession is gone.
          restoreConcessionFormEntries(entriesBeforeConcession);
          if (typeof onToast === 'function') onToast(`Outage concession removed from bill ${month}.`);
        } catch (err) {
          if (typeof onToast === 'function') onToast(err.message);
        }
      });
    } catch {
      concessionBox.innerHTML = '';
    }
  }

  // SISP-101: 1-click late-fee waiver toggle for the selected bill.
  // Renders only when that bill still carries an unpaid late fee: an
  // enabled checkbox when the amount in the form covers the full
  // principal (ticking snaps the amount to the principal still due —
  // the concession Apply precedent), a disabled checkbox with the
  // principal figure when it does not. Hidden for advance collections
  // and while SISP-43 ticket charges are pending (that combined-
  // payable flow owns the sheet). The submit re-plans the gate inside
  // executeQuickCollection, so this box is presentation + intent only.
  function renderWaiverBox(customerId, month) {
    if (!waiverBox) return;
    waiverBox.innerHTML = '';
    try {
      if (advanceCheckbox?.checked) return;
      const state = getState();
      if (!state || !customerId || !month) return;
      const customer = state.customers.find(c => c.id === customerId);
      const bill = customer?.bills?.find(b => b.month === month);
      if (!customer || !bill) return;
      if (activeDefaults && activeDefaults.customerId === customerId && activeDefaults.ticketChargesPending > 0) return;
      const summary = calculatePaymentAllocations(state).forMonth(customerId, month);
      const plan = planLateFeeWaiver({
        bill,
        balanceDueCents: summary?.balanceDueCents,
        lateFeeCents: summary?.lateFeeCents,
        paymentAmountCents: Math.round(Number(amountInput?.value || 0) * 100)
      });
      if (!plan.eligible && plan.reason !== 'partial-principal') return;
      const feeStr = `PKR ${(plan.waivedAmountCents / 100).toLocaleString('en-PK')}`;
      if (plan.eligible) {
        waiverBox.innerHTML = `
          <label class="qc-late-fee-waiver-row">
            <input type="checkbox" data-qc-waive-late-fee${waiverTicked ? ' checked' : ''}>
            <span>${escapeHtml(t('lfw_toggle', null, { amount: feeStr }))}</span>
          </label>
          <p class="qc-late-fee-waiver-note">${escapeHtml(t('lfw_note_full'))}</p>`;
        const checkbox = waiverBox.querySelector('[data-qc-waive-late-fee]');
        checkbox?.addEventListener('change', () => {
          waiverTicked = checkbox.checked === true;
          if (!amountInput) return;
          const targetCents = waiverTicked ? plan.principalDueCents : plan.balanceDueCents;
          if (typeof targetCents === 'number' && targetCents > 0) {
            amountInput.value = (targetCents / 100).toFixed(2);
          }
          // Plan 377: the waiver tick sets the amount programmatically
          // (no input event), so the words refresh explicitly.
          renderAmountWordsLine();
          // Plan 432: the waiver tick sets the amount, so the change
          // refreshes explicitly too.
          renderCashChange();
          renderWaiverBox(customerId, month);
        });
      } else {
        waiverBox.innerHTML = `
          <label class="qc-late-fee-waiver-row is-disabled">
            <input type="checkbox" data-qc-waive-late-fee disabled${waiverTicked ? ' checked' : ''}>
            <span>${escapeHtml(t('lfw_toggle', null, { amount: feeStr }))}</span>
          </label>
          <p class="qc-late-fee-waiver-note">${escapeHtml(t('lfw_note_partial', null, { amount: `PKR ${(plan.principalDueCents / 100).toLocaleString('en-PK')}` }))}</p>`;
      }
    } catch {
      waiverBox.innerHTML = '';
    }
  }

  // Owner feature: Change Package row in the payment step. Shows the
  // customer's CURRENT package (label + monthly fee) and a picker of the
  // real package catalogue; one tap on "Change package" applies
  // changeCustomerPackage, saves through the host, and reopens this same
  // form so the amount field, quick chips and dues header immediately
  // reflect the new package's bill — the collector never leaves the
  // sheet. The success toast carries an Undo that restores the exact
  // pre-change state (the inline bill editor's established pattern).
  function renderPackageBox(customerId) {
    if (!packageBox) return;
    packageBox.innerHTML = '';
    try {
      const state = getState();
      if (!state || !customerId) return;
      const customer = state.customers.find(c => c.id === customerId);
      if (!customer) return;
      const month = getPakistanLocalDate().slice(0, 7);
      const currentPkg = billPackageByLabel(customer.packageSpeed ?? '');
      const fee = Number(customer.monthlySellingAmount);
      const currentText = (customer.packageSpeed ?? '').trim()
        ? t('qcpkg_current', null, {
          label: customer.packageSpeed,
          amount: Number.isFinite(fee) && fee > 0 ? formatPKR(fee) : t('qcpkg_fee_not_set')
        })
        : t('qcpkg_none');
      const freeNote = customer.isFreeConnection === true
        ? `<p class="qc-package-note">${escapeHtml(t('qcpkg_free_note'))}</p>`
        : '';
      const pausedNote = customer.isFreeConnection !== true && isBillingPaused(customer, month)
        ? `<p class="qc-package-note">${escapeHtml(t('qcpkg_paused_note'))}</p>`
        : '';
      packageBox.innerHTML = `
        <div class="qc-package-row">
          <span class="qc-package-current">📦 ${escapeHtml(currentText)}</span>
        </div>
        <div class="qc-package-row">
          <select id="quickCollectPackageSelect" class="qc-input" aria-label="${escapeHtml(t('qcpkg_label'))}">
            <option value="">${escapeHtml(t('qcpkg_pick'))}</option>
            ${BILL_PACKAGES.map(p => `<option value="${escapeHtml(p.id)}" ${currentPkg && p.id === currentPkg.id ? 'disabled' : ''}>${escapeHtml(p.label)} · ${escapeHtml(formatPKR(p.price))}</option>`).join('')}
          </select>
          <button type="button" class="secondary-button qc-package-apply" data-qc-change-package disabled>${escapeHtml(t('qcpkg_change_btn'))}</button>
        </div>
        ${freeNote}${pausedNote}`;
      const select = packageBox.querySelector('#quickCollectPackageSelect');
      const applyBtn = packageBox.querySelector('[data-qc-change-package]');
      select?.addEventListener('change', () => {
        if (applyBtn) applyBtn.disabled = !select.value || packageChangeBusy;
      });
      applyBtn?.addEventListener('click', () => {
        if (packageChangeBusy || !select?.value) return;
        packageChangeBusy = true;
        applyBtn.disabled = true;
        try {
          const beforeState = getState();
          const result = changeCustomerPackage(beforeState, customerId, select.value, new Date());
          if (!result.changed) {
            if (typeof onToast === 'function') onToast(t('qcpkg_same'));
            return;
          }
          // Polish #13: the reopen below re-prefills the amount from
          // the new dues — capture what the operator had first, so a
          // typed 2,500 is never silently replaced by the new prefill.
          const amountBeforeChange = amountInput ? amountInput.value : '';
          const suggestedBeforeChange = activeDefaults ? activeDefaults.suggestedAmount : null;
          if (typeof onSaveState === 'function') onSaveState(result.nextState);
          openCustomerCollectionForm(customerId, packageChangeAmountOptions(amountBeforeChange, suggestedBeforeChange, result.balanceDue));
          if (typeof onToast === 'function') {
            const message = !result.billSkipped && result.bill
              ? t('qcpkg_done', null, {
                label: result.package.label,
                month: result.month,
                amount: formatPKR(Number(result.bill.dueAmount)),
                due: formatPKR(result.balanceDue ?? 0)
              })
              : t('qcpkg_done_nobill', null, { label: result.package.label, month: result.month });
            onToast(message, {
              type: 'success',
              title: t('qcpkg_change_btn'),
              actionLabel: t('qcpkg_undo'),
              duration: 8000,
              onAction: () => {
                if (typeof onSaveState === 'function') onSaveState(beforeState);
                // Polish #13: Undo restores the exact pre-change
                // amount — the typed figure when the operator had
                // entered one, otherwise the fresh prefill, which on
                // the restored state IS the old prefill. The undo-time
                // field cannot tell a typed figure from the figure the
                // reopen itself wrote, so the pre-change capture from
                // the apply tap is what decides — not a fresh capture.
                openCustomerCollectionForm(customerId, packageChangeAmountOptions(amountBeforeChange, suggestedBeforeChange, null));
              }
            });
          }
        } catch (err) {
          if (typeof onToast === 'function') onToast(err.message, { type: 'error' });
        } finally {
          packageChangeBusy = false;
        }
      });
    } catch {
      packageBox.innerHTML = '';
    }
  }

  function openCustomerCollectionForm(customerId, options = {}) {
    const state = getState();
    if (!state) return;
    try {
      activeCustomerId = customerId;
      activeDefaults = getCustomerPaymentDefaults(state, customerId, new Date(), loadTickets());

      // Populate form header
      if (customerHeader) {
        // SISP-43: with billed ticket charges pending, the header shows
        // the full payable (bills + charges) with the split spelled out,
        // so the collector sees exactly what the 1-tap amount covers.
        // SISP-106: pending boost fees join the same breakdown.
        const hasTicketCharges = activeDefaults.ticketChargesPending > 0;
        const hasAddonCharges = activeDefaults.addonChargesPending > 0;
        // Owner feature (2026-10-29): pending manual baqaya joins the
        // header payable the same way, with its own split line, so the
        // collector sees the old dues inside the 1-tap amount.
        const hasBaqaya = activeDefaults.manualBaqayaPending > 0;
        const hasExtras = hasTicketCharges || hasAddonCharges || hasBaqaya;
        const chargeLines = [
          ...activeDefaults.ticketChargeLines.map(line => `<span class="qc-head-charge-line" style="display:block;">🔧 Murammat / Material Charge (${escapeHtml(line.ticketId)}): PKR ${Number(line.amount).toLocaleString('en-PK')}</span>`),
          ...activeDefaults.addonChargeLines.map(line => `<span class="qc-head-charge-line" style="display:block;">⚡ Speed Boost (${escapeHtml(line.boostId)}): PKR ${Number(line.amount).toLocaleString('en-PK')}</span>`),
          ...(hasBaqaya ? [`<span class="qc-head-charge-line" style="display:block;">🧾 ${escapeHtml(t('baqaya_qc_line', null, { amount: `PKR ${Number(activeDefaults.manualBaqayaPending).toLocaleString('en-PK')}` }))}</span>`] : [])
        ].join('');
        // Polish #11: the target bill's package + tax breakdown,
        // read-only — the bill's own figures, so the collection screen
        // can never disagree with the bill. Shown whenever the target
        // bill carries a package snapshot or a tax; an untaxed bill
        // with no package shows nothing extra.
        const targetBillTax = activeDefaults.targetBillSalesTaxCents;
        const targetBillPackage = activeDefaults.targetBillPackage;
        const packageTaxLine = (targetBillPackage || (typeof targetBillTax === 'number' && targetBillTax > 0))
          ? `<div class="qc-head-charges" style="margin-top:6px;font-size:0.85rem;"><span class="qc-head-charge-line" style="display:block;">📦 ${targetBillPackage ? `${escapeHtml(targetBillPackage.label)}: PKR ${Number(targetBillPackage.price).toLocaleString('en-PK')}` : 'Package'}${typeof targetBillTax === 'number' && targetBillTax > 0 ? ` · 🧾 Sales tax (19.5%): PKR ${Number(targetBillTax / 100).toLocaleString('en-PK')}` : ''}</span></div>`
          : '';

        customerHeader.innerHTML = `
          <div class="qc-active-cust-bar">
            <div class="qc-cust-identity">
              <span class="qc-tag-num">#${escapeHtml(String(activeDefaults.customerNumber))}</span>
              <strong class="qc-head-name">${escapeHtml(activeDefaults.name)}</strong>
              <span class="qc-head-area">${escapeHtml(activeDefaults.area)}${activeDefaults.phone ? ' · ' + escapeHtml(activeDefaults.phone) : ''}</span>
            </div>
            <div class="qc-head-due-box">
              <span class="qc-box-label">${hasExtras ? 'Total Payable (incl. charges)' : 'Total Dues'}</span>
              <strong class="qc-box-amt">PKR ${(hasExtras ? activeDefaults.payableTotal : activeDefaults.totalDues).toLocaleString('en-PK')}</strong>
            </div>
          </div>
          ${hasExtras ? `<div class="qc-head-charges" style="margin-top:6px;font-size:0.85rem;"><span class="qc-head-charge-line" style="display:block;">🧾 Bill dues: PKR ${activeDefaults.totalDues.toLocaleString('en-PK')}</span>${chargeLines}</div>` : ''}
          ${packageTaxLine}
        `;
      }

      if (dueAmountVal) {
        dueAmountVal.textContent = activeDefaults.balanceDue.toLocaleString('en-PK');
      }

      // Plan 447: the form opens with the big name + mohalla + dues
      // line already shown for the picked customer, so the operator
      // checks the name before saving. Every pick re-opens the form,
      // so the line always names the currently selected customer.
      renderBigNameConfirm();

      // Prefill fields
      if (amountInput) {
        amountInput.value = activeDefaults.suggestedAmount > 0 ? activeDefaults.suggestedAmount.toFixed(2) : '';
        amountInput.max = '999999';
      }
      // Plan 376 / Plan 522: name the oldest open bill as a
      // reference under the field, so the operator sees which bill
      // is oldest and what is still open on it — not a
      // typed-from-memory figure. The line never claims the oldest
      // bill is the starting amount: since Plan 429 the field holds
      // full dues. Hidden when no bill is open: a customer with no
      // open bill offers nothing.
      if (prefillLine) {
        const prefillHtml = transactionPrefillLineHtml(activeDefaults.prefill, { line: t('txp_line') });
        prefillLine.innerHTML = prefillHtml;
        prefillLine.hidden = prefillHtml === '';
      }
      // Plan 490: a repeat open carries nothing over — same customer,
      // empty amount. The prefill line is hidden too: with no amount
      // prefilled there is no bill the amount "came from". Every
      // other fresh-open default is untouched: today's date, the
      // customer's remembered method, and the empty cash field. The
      // amount-dependent lines below read the emptied field, so they
      // render the empty state. (Kept as a separate step after the
      // ordinary prefill, so the ordinary prefill line above stays
      // exactly as the dues-default wiring expects it.)
      if (options && options.emptyAmount === true) {
        if (amountInput) amountInput.value = '';
        if (prefillLine) {
          prefillLine.innerHTML = '';
          prefillLine.hidden = true;
        }
      }
      // Polish #13: a package-change reopen carries the amount over —
      // either the operator's typed figure, or the new package's
      // current-month balance (see packageChangeAmountOptions). It
      // runs after the ordinary prefill so the prefill line above
      // stays exactly as the dues-default wiring expects it — and the
      // line is hidden here, because the amount no longer "came from"
      // the oldest bill, so naming that bill would mislead (the Plan
      // 490 empty-amount step's precedent). Every amount-dependent
      // line below reads the overridden field, so words, settlement
      // preview, over/underpayment, cash change and the waada row all
      // follow the carried-over figure.
      if (options && options.amountOverride !== undefined && options.amountOverride !== null) {
        if (amountInput) {
          amountInput.value = typeof options.amountOverride === 'number'
            ? (options.amountOverride > 0 ? options.amountOverride.toFixed(2) : '')
            : String(options.amountOverride);
        }
        if (prefillLine) {
          prefillLine.innerHTML = '';
          prefillLine.hidden = true;
        }
      }
      // Plan 377: the form opens with the suggested amount already
      // typed, so the words start shown, not blank.
      renderAmountWordsLine();
      // Plan 381: the form opens with the number this payment will
      // receive already shown, so the operator can answer the
      // customer before anything is saved.
      renderNextReceiptLine();
      // Plan 385: the form opens with the settlement preview already
      // shown for the suggested amount, so the operator can tell the
      // customer which months it settles before anything is saved.
      renderSettlementPreview();
      // Plan 386: the form opens with the choice already offered for
      // the suggested amount when it exceeds the dues.
      renderOverpaymentChoice();
      // Plan 387: the form opens with the warning already shown for
      // the suggested amount when it falls short of the dues.
      renderUnderpaymentWarning();
      // Plan 388: the form opens with the warning already shown when
      // the picked customer holds an open suspension record.
      renderSuspendedWarning();
      if (dateInput) {
        dateInput.value = activeDefaults.todayDate;
        dateInput.max = activeDefaults.todayDate;
      }
      // Plan 431: the remembered method is pre-selected; a customer
      // with no past payment pre-selects nothing (''), and the
      // operator picks. The save path still records Cash when nothing
      // is chosen, exactly as before.
      if (methodSelect) {
        methodSelect.value = activeDefaults.defaultMethod ?? '';
      }
      syncMethodChips(activeDefaults.defaultMethod ?? '');
      // Plan 432: the cash field starts empty for the new customer,
      // and the calculator refreshes for the pre-selected method.
      if (cashReceivedInput) cashReceivedInput.value = '';
      renderCashChange();
      if (paidByInput) {
        paidByInput.value = activeDefaults.lastPaidBy || '';
      }

      // SISP-158: the "Paid by / kis ne diya" contributor picker exists
      // ONLY for a customer who actually has contributors — everyone
      // else's sheet is pixel-identical to before. The main customer is
      // the default (empty value = untagged payment).
      if (contributorField && contributorSelect) {
        const pickedCustomer = state.customers.find(c => c.id === customerId);
        const contributors = subContributorsOf(pickedCustomer);
        if (contributors.length > 0) {
          contributorSelect.innerHTML = `<option value="">${escapeHtml(t('contrib_qc_main'))}</option>` + contributors.map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.name)}</option>`).join('');
          contributorSelect.value = '';
          contributorField.hidden = false;
        } else {
          contributorSelect.innerHTML = '';
          contributorSelect.value = '';
          contributorField.hidden = true;
        }
      }

      // Plan 393: the cross-payment payer picker lists the other
      // customers (the account holder is never their own cross-payer).
      // The blank option means the account holder paid; a picked payer
      // plus the name and relationship fields record the note. The name
      // and relationship start empty on every open, like the payer field.
      if (crossPayerSelect) {
        const others = (state.customers || []).filter((entry) => entry && entry.id && entry.id !== customerId);
        crossPayerSelect.innerHTML = `<option value="">Account holder paid</option>` + others.map((entry) => `<option value="${escapeHtml(entry.id)}">#${escapeHtml(entry.customerNumber ?? '?')} ${escapeHtml(entry.name || entry.customerName || '')}</option>`).join('');
        crossPayerSelect.value = '';
      }
      if (crossPayerNameInput) crossPayerNameInput.value = '';
      if (crossRelationshipInput) crossRelationshipInput.value = '';
      // Plan 399: the promise picker lists this customer's
      // still-unpaid promises, earliest promised first — the
      // promises this payment can fulfil. The picker starts blank
      // on every open, like the payer fields — a promise picked
      // for one customer never carries over to the next.
      if (promiseLinkSelect) {
        const pickedCustomer = state.customers.find(c => c.id === customerId);
        promiseLinkSelect.innerHTML = promisePaymentLinkSelectOptions(openPromisesForCustomer(typeof loadCollectionPromises === 'function' ? loadCollectionPromises() : [], pickedCustomer));
        promiseLinkSelect.value = '';
      }
      // Plan 395: the excess cash purpose starts blank on every open,
      // like the payer fields — a purpose picked for one customer
      // never carries over to the next.
      if (excessCashPurposeSelect) excessCashPurposeSelect.value = '';
      // Plan 397: the threshold starts at the standing default and the
      // approver starts blank on every open, like the payer fields —
      // an approval given for one customer never carries over to the
      // next.
      if (largeCashThresholdInput) largeCashThresholdInput.value = String(LARGE_CASH_DEFAULT_THRESHOLD_CENTS / 100);
      if (largeCashApproverInput) largeCashApproverInput.value = '';
      // Plan 398: the category tag starts at the default (collection)
      // on every open, like the payer fields — a tag picked for one
      // customer never carries over to the next.
      if (categoryTagSelect) categoryTagSelect.value = 'collection';

      // Populate billing month select
      if (monthSelect) {
        const historyMonths = monthsForHistory();
        monthSelect.innerHTML = historyMonths.map(m =>
          `<option value="${m}" ${m === activeDefaults.targetMonth ? 'selected' : ''}>${m}</option>`
        ).join('');
      }

      // Advance tag: reset per customer. When nothing is due at all (no
      // bill balance, no ticket charges), money can only be recorded as
      // advance credit — pre-tick the box so the 2-tap flow keeps working
      // for early payers instead of hitting core's fully-paid guard.
      if (advanceCheckbox) {
        advanceCheckbox.checked = activeDefaults.totalDues <= 0 && activeDefaults.ticketChargesPending <= 0 && activeDefaults.addonChargesPending <= 0 && activeDefaults.manualBaqayaPending <= 0;

      }

      // Advance month target: current month onward, next month
      // pre-selected (the sheet's month select shows raw YYYY-MM, so
      // this one does too). Only read when the Advance box is ticked.
      if (advanceTargetSelect) {
        const targetDefault = defaultAdvanceTargetMonth();
        advanceTargetSelect.innerHTML = advanceTargetMonthOptions().map(m =>
          `<option value="${m}" ${m === targetDefault ? 'selected' : ''}>${m}</option>`
        ).join('');
      }

      // SISP-30: concession badge for the target month (refreshes on month change).
      renderConcessionBox(customerId, activeDefaults.targetMonth);

      // SISP-101: late-fee waiver toggle for the target month — the
      // tick never carries over between customers.
      waiverTicked = false;
      renderWaiverBox(customerId, activeDefaults.targetMonth);

      // Uptime tracking: month-end online/offline one-liner for the
      // same target month (refreshes on month change too).
      renderUptimeLine(customerId, activeDefaults.targetMonth);

      // Owner feature: Change Package row (current package + picker).
      renderPackageBox(customerId);

      // Plan 361: handling note for this customer, shown before saving.
      renderHandlingNoteBox(customerId);

      // Plan 390: standing instruction for this customer, shown before saving.
      renderStandingInstructionLine(customerId);

      // SISP-126: Remainder Waada starts un-chosen for every customer;
      // the row itself appears only if the prefilled amount is a partial.
      selectedRemainderWaadaDate = null;
      remainderWaadaSkipped = false;
      renderRemainderWaadaRow();

      // Reset digital fields
      if (transactionIdInput) transactionIdInput.value = '';
      if (senderNameInput) senderNameInput.value = '';
      if (senderDigitsInput) senderDigitsInput.value = '';
      if (overrideReasonInput) overrideReasonInput.value = '';
      if (overrideDetails) overrideDetails.open = false;
      // SISP-121: split always starts OFF for a fresh customer sheet.
      if (splitToggle) splitToggle.checked = false;
      if (splitAmountInput) splitAmountInput.value = '';
      if (splitTransactionIdInput) splitTransactionIdInput.value = '';
      if (splitOverrideReasonInput) splitOverrideReasonInput.value = '';
      if (splitSenderNameInput) splitSenderNameInput.value = '';
      if (splitSenderDigitsInput) splitSenderDigitsInput.value = '';
      updateSplitVisibility();
      // Plan 527: the reset above turns the split off WITHOUT a
      // change event, and the render at the top of this open ran
      // while the toggle could still hold the previous opening's
      // checked state (closing never resets it) — re-render so the
      // line is visible again for the fresh sheet.
      renderNextReceiptLine();
      currentScreenshotDataUrl = '';
      if (screenshotInput) screenshotInput.value = '';
      if (screenshotPreviewWrap) screenshotPreviewWrap.hidden = true;
      if (screenshotPreview) screenshotPreview.src = '';
      updateDigitalVisibility(activeDefaults.defaultMethod ?? '');

      // OWNER-CASH-SHOP: fresh "Cash received at" chips per open — the
      // default method above decides the row's visibility and which chip
      // starts active (Owner Office unless the default is a shop method).
      renderShopChips();

      // Update quick amount chips dynamic amounts (#281)
      if (quickAmountChips && activeDefaults) {
        // Plan 521: the "Full" and "50%" chips use the Plan 489
        // figures — the Plan 429 full-dues default
        // (activeDefaults.suggestedAmount), half of it rounded to
        // whole rupees, nothing when it works out to nothing — so
        // "Full" and "Half" mean one thing on every surface: the
        // chip row, the Plan 489 dues buttons and the one screen all
        // fill from the same figure. suggestedAmount already lifts
        // to the whole payable when ticket (SISP-43), boost
        // (SISP-106) or manual baqaya charges are pending (see
        // getCustomerPaymentDefaults), so no separate branch is
        // needed here; the oldest-bill-only balanceDue is never the
        // chip's base.
        const chipFigures = addPaymentDuesFigures({ fullDues: activeDefaults.suggestedAmount });
        const fullBal = chipFigures.full ?? 0;
        const halfBal = chipFigures.half ?? 0;
        // The Monthly chip still falls back to the oldest-bill /
        // total-dues figure when neither the current month nor the
        // full dues offer anything (unchanged — out of Plan 521's
        // scope).
        const monthlyFallbackBal = (activeDefaults.ticketChargesPending > 0 || activeDefaults.addonChargesPending > 0 || activeDefaults.manualBaqayaPending > 0)

          ? activeDefaults.payableTotal
          : (activeDefaults.balanceDue > 0 ? activeDefaults.balanceDue : activeDefaults.totalDues);
        const curBal = (activeDefaults.currentMonthBalance && activeDefaults.currentMonthBalance > 0)
          ? activeDefaults.currentMonthBalance
          : activeDefaults.suggestedAmount;
        // Plan 391: the package-price chip shows the customer's own
        // package price when it is known, plain words when it is not.
        const packagePrice = packagePriceForCustomer(activeDefaults.customer, BILL_PACKAGES);
        quickAmountChips.forEach(chip => {
          const type = chip.getAttribute('data-quick-amount');
          if (type === 'full') {
            chip.textContent = `Full (Rs ${fullBal > 0 ? fullBal.toLocaleString('en-PK') : '0'})`;
          } else if (type === 'package') {
            chip.textContent = packageChipLabel(packagePrice);
          } else if (type === 'current') {
            chip.textContent = `Monthly (Rs ${curBal > 0 ? curBal.toLocaleString('en-PK') : (monthlyFallbackBal > 0 ? monthlyFallbackBal.toLocaleString('en-PK') : '0')})`;
          } else if (type === 'half') {
            chip.textContent = `50% (Rs ${halfBal > 0 ? halfBal.toLocaleString('en-PK') : '0'})`;
          }
        });
      }

      // Plan 489: the form step's full-dues / half-dues buttons
      // refresh for the picked customer, from the same amount
      // default the field was just filled with.
      renderAddPaymentDuesButtons();

      // SISP-116: loose-change chips for the payable just computed.
      renderLooseChangeChips();

      showStep('form');
      setTimeout(() => {
        amountInput?.focus();
        amountInput?.select();
      }, 50);

    } catch (err) {
      if (typeof onToast === 'function') onToast(err.message);
    }
  }

  // Plan 426: one single screen for the whole quick payment —
  // customer, amount, method, save — with no navigation in between.
  // The screen only collects and validates the four fields. Saving
  // drives the normal payment form submit, so the payment records
  // exactly as the normal flow records it, with every guard and the
  // Plan 382 confirmation still in front of it. Closing the screen
  // without saving records nothing.
  function renderOneScreen() {
    if (!stepOneScreen) return;
    const state = getState();
    stepOneScreen.innerHTML = quickCollectOneScreenHtml({
      customers: state?.customers ?? [],
      methods: PAYMENT_METHODS
    });
    bindOneScreenControls();
  }

  // Plan 430: refresh the one screen's quick amount buttons for the
  // picked customer. The full dues are the amount default the one
  // screen already fills the field with; the package price follows
  // the same rule the entry form's package chip already uses. With
  // no customer picked the buttons show plain words and fill
  // nothing.
  function renderOneScreenQuickAmounts() {
    const row = stepOneScreen.querySelector('.qab-row');
    if (!row) return;
    const figures = oneScreenQuickAmountFigures({
      fullDues: activeDefaults?.suggestedAmount ?? null,
      packagePrice: activeDefaults ? packagePriceForCustomer(activeDefaults.customer, BILL_PACKAGES) : null,
    });
    row.innerHTML = oneScreenQuickAmountButtonsHtml(figures);
  }

  // Plan 528: one small group label above an amount row, created once
  // and left in place afterwards. The label only names the row — it
  // never changes a button, a figure, or a tap — so a re-render that
  // finds its row already labelled does nothing.
  function ensureAmountGroupLabel(row, text) {
    if (!row) return;
    const previous = row.previousElementSibling;
    if (previous && previous.classList && previous.classList.contains('qc-amount-group-label')) return;
    const label = document.createElement('p');
    label.className = 'qc-amount-group-label';
    label.textContent = text;
    row.before(label);
  }

  // Plan 489: the Add payment form step's own one-tap amount
  // buttons — full dues, half dues — one row ahead of the entry
  // form's chip row. The full dues are the amount default the form
  // already fills the field with (Plan 429); half is half of it
  // rounded to whole rupees, and fills nothing when it works out to
  // nothing. The row is rendered by the module and refreshed whenever
  // the customer changes; tapping a button only fills the amount
  // field, exactly as if the figure had been typed.
  function renderAddPaymentDuesButtons() {
    if (!stepForm || !amountInput) return;
    const chipsRow = stepForm.querySelector('.qc-quick-amount-chips');
    if (!chipsRow) return;
    let duesRow = stepForm.querySelector('.apd-row');
    if (!duesRow) {
      duesRow = document.createElement('div');
      duesRow.className = 'qc-quick-amount-chips apd-row';
      chipsRow.before(duesRow);
      duesRow.addEventListener('click', (event) => {
        const button = event.target?.closest?.('[data-apd-amount]');
        if (!button || !amountInput) return;
        const amount = Number(button.getAttribute('data-apd-amount'));
        if (!Number.isFinite(amount) || amount <= 0) return;
        amountInput.value = amount.toFixed(2);
        // A button-set amount refreshes the same live lines a typed
        // amount refreshes, exactly like the entry form's chips.
        if (activeCustomerId) renderWaiverBox(activeCustomerId, monthSelect?.value || activeDefaults?.targetMonth);
        renderAmountWordsLine();
        renderCashChange();
        renderSettlementPreview();
        renderOverpaymentChoice();
        renderUnderpaymentWarning();
        amountInput.focus();
        renderRemainderWaadaRow();
        // Plan 533: a button-set amount re-computes the split total
        // the same way.
        renderSplitTotal();
      });
    }
    const figures = addPaymentDuesFigures({
      fullDues: activeDefaults?.suggestedAmount ?? null,
    });
    duesRow.innerHTML = addPaymentDuesButtonsHtml(figures);
    // Plan 528: the three amount rows each carry a small group label
    // above them, so "Full" and "Full dues" stop looking like the same
    // button twice. The dues label goes above the dues row and the
    // quick-amounts label above the entry chip row — in that order,
    // so the page reads dues label, dues row, chip label, chip row.
    // The loose-change label lives in the page and hides with its row.
    ensureAmountGroupLabel(duesRow, 'Pay in full / half');
    ensureAmountGroupLabel(chipsRow, 'Quick amounts');
  }

  function bindOneScreenControls() {
    if (!stepOneScreen) return;
    const customerSelect = stepOneScreen.querySelector('#qosOneScreenCustomer');
    const amountInputOne = stepOneScreen.querySelector('#qosOneScreenAmount');
    const methodSelectOne = stepOneScreen.querySelector('#qosOneScreenMethod');
    const duesLine = stepOneScreen.querySelector('#qosOneScreenDues');
    const saveBtn = stepOneScreen.querySelector('#qosOneScreenSaveBtn');
    const backBtn = stepOneScreen.querySelector('#qosOneScreenBackBtn');
    // Plan 430: the one screen's quick amount buttons — full dues,
    // half dues, package price — one row under the amount field. The
    // row is rendered by the module and refreshed whenever the
    // customer changes; tapping a button only fills the amount
    // field, exactly as if the figure had been typed.
    const amountGroup = amountInputOne?.closest('.qc-field-group');
    let quickAmountRow = stepOneScreen.querySelector('.qab-row');
    if (!quickAmountRow && amountGroup) {
      quickAmountRow = document.createElement('div');
      quickAmountRow.className = 'qc-quick-amount-chips qab-row';
      amountGroup.after(quickAmountRow);
      quickAmountRow.addEventListener('click', (event) => {
        const button = event.target?.closest?.('[data-qab-amount]');
        if (!button || !amountInputOne) return;
        const amount = Number(button.getAttribute('data-qab-amount'));
        if (!Number.isFinite(amount) || amount <= 0) return;
        amountInputOne.value = amount.toFixed(2);
        amountInputOne.focus();
      });
    }
    renderOneScreenQuickAmounts();
    customerSelect?.addEventListener('change', () => {
      const customerId = customerSelect.value || '';
      if (!customerId) {
        activeCustomerId = null;
        activeDefaults = null;
        if (amountInputOne) amountInputOne.value = '';
        if (duesLine) { duesLine.textContent = ''; duesLine.hidden = true; }
        renderOneScreenQuickAmounts();
        return;
      }
      activeCustomerId = customerId;
      activeDefaults = getCustomerPaymentDefaults(getState(), customerId, new Date(), loadTickets());
      if (amountInputOne) {
        amountInputOne.value = activeDefaults.suggestedAmount > 0 ? activeDefaults.suggestedAmount.toFixed(2) : '';
      }
      if (duesLine) {
        // Plan 525: the line shows the payable figure the amount field
        // prefills (suggestedAmount — full dues plus any pending
        // charges), never bill dues alone, so the two agree.
        duesLine.textContent = quickCollectOneScreenDuesText(activeDefaults.suggestedAmount);
        duesLine.hidden = duesLine.textContent === '';
      }
      // Plan 431: the one screen pre-selects the remembered method too;
      // a customer with no past payment pre-selects nothing (''), and
      // the operator picks before saving.
      if (methodSelectOne) {
        methodSelectOne.value = activeDefaults.defaultMethod ?? '';
      }
      renderOneScreenQuickAmounts();
    });
    saveBtn?.addEventListener('click', () => { submitOneScreenPayment(); });
    backBtn?.addEventListener('click', () => { showStep('pick'); });
  }

  function submitOneScreenPayment() {
    if (!stepOneScreen) return;
    const customerSelect = stepOneScreen.querySelector('#qosOneScreenCustomer');
    const amountInputOne = stepOneScreen.querySelector('#qosOneScreenAmount');
    const methodSelectOne = stepOneScreen.querySelector('#qosOneScreenMethod');
    const result = quickCollectOneScreenDraft({
      customerId: customerSelect?.value || '',
      amountText: amountInputOne?.value ?? '',
      method: methodSelectOne?.value || '',
      methods: PAYMENT_METHODS
    });
    if (!result.ok) {
      if (typeof onToast === 'function') onToast(result.reason, { type: 'error' });
      if (result.field === 'customer') customerSelect?.focus();
      else if (result.field === 'amount') amountInputOne?.focus();
      else if (result.field === 'method') methodSelectOne?.focus();
      return;
    }
    const draft = result.draft;
    activeCustomerId = draft.customerId;
    activeDefaults = getCustomerPaymentDefaults(getState(), activeCustomerId, new Date(), loadTickets());
    if (amountInput) amountInput.value = draft.amount.toFixed(2);
    if (methodSelect) methodSelect.value = draft.method;
    if (dateInput) dateInput.value = getPakistanLocalDate();
    if (monthSelect) monthSelect.value = activeDefaults.targetMonth;
    if (typeof paymentForm?.requestSubmit === 'function') paymentForm.requestSubmit();
  }

  function openOneScreen() {
    renderOneScreen();
    showStep('one-screen');
    setTimeout(() => {
      stepOneScreen?.querySelector('#qosOneScreenCustomer')?.focus();
    }, 50);
  }

  let releaseFocusTrap = null;

  function openModal(defaultCustomerId = null) {
    closeCleanupHandled = false;
    // Polish 17 (Req 1): load the already-bundled Nastaliq face when the
    // modal opens, so it is ready by the success screen — the user's
    // phone runs English UI, so Urdu mode never loads it on its own.
    ensureUrduFont();
    // Plan 439: opening the sheet starts a new round — the round
    // total counts only the payments recorded from this instant on.
    roundStartMs = Date.now();
    updateCounts();
    if (defaultCustomerId) {
      openCustomerCollectionForm(defaultCustomerId);
    } else {
      showStep('pick');
      // Default to pending customers only (fully paid ones are hidden; "All" shows them).
      // When nothing is pending the picker shows "Sab ka bill wusool ho gaya" instead of
      // an empty list (replaces the #241 fallback to "All").
      setFilter('all-dues');
      renderList();
      setTimeout(() => {
        searchInput?.focus();
      }, 50);
    }

    if (typeof modal.showModal === 'function') {
      try {
        if (!modal.open) modal.showModal();
      } catch {
        modal.setAttribute('open', '');
      }
    } else {
      modal.setAttribute('open', '');
    }

    releaseFocusTrap = trapModalFocus(modal, {
      onEscape: closeModal
    });
  }

  function stopUndoCountdown() {
    if (undoCountdownId) {
      clearInterval(undoCountdownId);
      undoCountdownId = null;
    }
  }

  // Live countdown on the in-dialog Undo button ("Undo — deletes this
  // payment (4s)" ... 1s), so the 5-second window is visible instead
  // of a static "(5s)" label.
  // (Was 10s until 2026-10-21 — the user asked for 5s: 10 felt uselessly long.)
  function startUndoCountdown() {
    stopUndoCountdown();
    undoDeadline = Date.now() + UNDO_WINDOW_MS;
    const render = () => {
      if (!undoBtn || undoBtn.hidden) return;
      const left = Math.max(0, Math.ceil((undoDeadline - Date.now()) / 1000));
      undoBtn.textContent = `↩ Undo — deletes this payment (${left}s)`;
    };
    render();
    undoCountdownId = setInterval(render, 250);
  }

  function stopReversalUndoCountdown() {
    if (reversalUndoCountdownId) {
      clearInterval(reversalUndoCountdownId);
      reversalUndoCountdownId = null;
    }
  }

  // Plan 435: clears the sixty-second reversal undo — its timer, its
  // countdown and its context — and hides the button. Called when the
  // window lapses, when the undo runs, when the five-second undo runs
  // (a deleted payment has nothing left to reverse), when a split
  // collection saves (two legs of its own), when Collect Another
  // loops back to the picker, and when the dialog closes.
  function disarmReversalUndo() {
    if (reversalUndoTimeoutId) {
      clearTimeout(reversalUndoTimeoutId);
      reversalUndoTimeoutId = null;
    }
    stopReversalUndoCountdown();
    activeReversalUndo = null;
    if (reversalUndoBtn) reversalUndoBtn.hidden = true;
    // Plan 532: the note only explains a missing reversal undo — it
    // never outlives the arming it describes.
    if (reversalUndoNote) reversalUndoNote.hidden = true;
  }

  // Live countdown on the reversal Undo button ("↩ Undo by reversal
  // — original stays visible (59s)" ... 1s), so the sixty-second
  // window is visible instead of a static "(60s)" label. The seconds
  // come from the pure window check against the saved instant, so the
  // label can never drift from the rule that decides whether the
  // undo runs.
  function startReversalUndoCountdown() {
    stopReversalUndoCountdown();
    const render = () => {
      if (!reversalUndoBtn || reversalUndoBtn.hidden || !activeReversalUndo) return;
      reversalUndoBtn.textContent = quickCollectReversalUndoButtonText(
        quickCollectReversalUndoSecondsLeft(activeReversalUndo.savedAtMs, Date.now())
      );
    };
    render();
    reversalUndoCountdownId = setInterval(render, 250);
  }

  // Plan 435: arms the sixty-second reversal undo for one plain
  // single payment. The saved payment record and the receipt's
  // settled lines decide eligibility here, at save time — a payment
  // that settled ticket or boost charges, waived a late fee, or
  // touched a promise keeps the five-second undo, which restores
  // those, and is never offered the reversal. Nothing is recorded
  // by arming; the button only asks.
  function armReversalUndo({ customerId, month, paymentId, amount, customerName, savedPayment, ticketCharges, addonCharges }) {
    disarmReversalUndo();
    if (!reversalUndoBtn) return;
    const plain = quickCollectReversalUndoIsPlainPayment({
      ticketCharges,
      addonCharges,
      hasWaiver: !!lateFeeWaiverOf(savedPayment),
      hasWaadaStamp: !!remainderWaadaOf(savedPayment),
    });
    // Plan 532: when the reversal is not offered, the note says why
    // only the five-second undo is available.
    if (!plain) {
      if (reversalUndoNote) reversalUndoNote.hidden = false;
      return;
    }
    activeReversalUndo = { customerId, month, paymentId, amount, customerName, savedAtMs: Date.now() };
    reversalUndoBtn.hidden = false;
    reversalUndoBtn.disabled = false;
    reversalUndoBtn.textContent = quickCollectReversalUndoButtonText(60);
    reversalUndoTimeoutId = setTimeout(() => {
      disarmReversalUndo();
    }, QUICK_COLLECT_REVERSAL_UNDO_WINDOW_MS);
    startReversalUndoCountdown();
  }

  // Close-cleanup runs exactly once per opening, whichever way the dialog was
  // closed: the × / Done buttons (closeModal below), Escape, a backdrop tap,
  // the universal dialog controller, Bulk Collect taking over, or route sync.
  // Previously only closeModal() cleaned up, so a close that bypassed it left
  // the 5s undo timer armed, the undo context set and the success step
  // mounted — stale timer/context state then leaked into the next opening.
  function handleDialogClosed() {
    if (closeCleanupHandled) return;
    closeCleanupHandled = true;
    const pendingUndo = activeUndoContext;
    if (undoTimeoutId) {
      clearTimeout(undoTimeoutId);
      undoTimeoutId = null;
    }
    stopUndoCountdown();
    activeUndoContext = null;
    if (undoBtn) undoBtn.hidden = true;
    // Plan 435: closing drops the reversal undo with the rest of the
    // save — a payment from a closed sheet is never reversed later.
    disarmReversalUndo();
    showStep('pick');
    activeCustomerId = null;
    activeDefaults = null;
    activeReceipt = null;
    // Plan 449: closing drops the second-connection step with the
    // rest of the save — the next opening offers it afresh.
    secondConnectionRecorded = false;
    hideSecondConnectionStep();
    duplicateBypassedForTxn = null;
    duplicateBypassedForLeg2Txn = null;
    duplicatePaymentBypassedKey = null;
    // Plan 437: closing abandons any in-flight save — the guard can
    // never stay armed into the next opening.
    saveGuardHeldForDialog = false;
    doubleTapSaveGuardFinish(saveGuard);
    doubleTapSaveGuardSetDisabled(quickCollectConfirmBtn, false);
    doubleTapSaveGuardSetDisabled(confirmSaveBtn, false);
    if (dupWarningCard) dupWarningCard.hidden = true;
    if (leg2DupCard) leg2DupCard.hidden = true;
    // Closing during the undo window keeps the payment (it is NOT undone).
    // Say so briefly, with no Undo of its own, so there is no doubt it saved.
    // SISP-141: with a host onCollected, the floating 10s undo toast is
    // already on screen and stays undoable after this close — posting
    // "saved" here would contradict it, so it is skipped in that case.
    if (pendingUndo && typeof onToast === 'function' && typeof onCollected !== 'function') {
      onToast(`Payment of PKR ${pendingUndo.amount.toLocaleString()} for ${pendingUndo.customerName} saved.`, {
        type: 'success',
        title: 'Payment saved',
        duration: 3000
      });
    }
  }

  function closeModal() {
    if (releaseFocusTrap) {
      releaseFocusTrap();
      releaseFocusTrap = null;
    }

    if (typeof modal.close === 'function') {
      try {
        if (modal.open) modal.close();
      } catch {
        modal.removeAttribute('open');
      }
    } else {
      modal.removeAttribute('open');
    }
    // If the native 'close' event did not already run the cleanup (it can be
    // queued after close() returns, and removing the attribute fires none),
    // run it now; the guard inside makes the second call a no-op.
    handleDialogClosed();
  }

  modal.addEventListener('close', handleDialogClosed);

  
  // Wire duplicate warning card buttons (#279)
  // "Save anyway" needs a reason (#279); it is stored as the payment's reference override reason.
  function syncDupProceed() {
    if (!dupProceedBtn) return;
    const ok = Boolean((dupReasonInput?.value || '').trim()) || !dupReasonInput;
    dupProceedBtn.disabled = !ok;
    dupProceedBtn.title = ok ? '' : 'Write why this reference is used again';
  }
  dupReasonInput?.addEventListener('input', syncDupProceed);
  dupProceedBtn?.addEventListener('click', () => {
    if (dupProceedBtn.disabled) { dupReasonInput?.focus(); return; }
    duplicateBypassedForTxn = transactionIdInput ? transactionIdInput.value.trim() : '';
    if (dupWarningCard) dupWarningCard.hidden = true;
    if (paymentForm) {
      if (typeof paymentForm.requestSubmit === 'function') {
        paymentForm.requestSubmit();
      } else {
        paymentForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }
  });

  dupCancelBtn?.addEventListener('click', () => {
    duplicateBypassedForTxn = null;
    if (dupWarningCard) dupWarningCard.hidden = true;
    transactionIdInput?.focus();
  });

  transactionIdInput?.addEventListener('input', () => {
    duplicateBypassedForTxn = null;
    if (dupWarningCard) dupWarningCard.hidden = true;
  });

  // Plan 534: wire the leg-2 duplicate card buttons — the same
  // reason-and-proceed path as leg 1 (#279). "Save anyway" needs a
  // reason; it is stored as leg 2's reference override reason.
  function syncLeg2DupProceed() {
    if (!leg2DupProceedBtn) return;
    const ok = Boolean((leg2DupReasonInput?.value || '').trim()) || !leg2DupReasonInput;
    leg2DupProceedBtn.disabled = !ok;
    leg2DupProceedBtn.title = ok ? '' : 'Write why this reference is used again';
  }
  leg2DupReasonInput?.addEventListener('input', syncLeg2DupProceed);
  leg2DupProceedBtn?.addEventListener('click', () => {
    if (leg2DupProceedBtn.disabled) { leg2DupReasonInput?.focus(); return; }
    duplicateBypassedForLeg2Txn = splitTransactionIdInput ? splitTransactionIdInput.value.trim() : '';
    if (leg2DupCard) leg2DupCard.hidden = true;
    if (paymentForm) {
      if (typeof paymentForm.requestSubmit === 'function') {
        paymentForm.requestSubmit();
      } else {
        paymentForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }
  });

  leg2DupCancelBtn?.addEventListener('click', () => {
    duplicateBypassedForLeg2Txn = null;
    if (leg2DupCard) leg2DupCard.hidden = true;
    splitTransactionIdInput?.focus();
  });

  splitTransactionIdInput?.addEventListener('input', () => {
    duplicateBypassedForLeg2Txn = null;
    if (leg2DupCard) leg2DupCard.hidden = true;
  });

  // Plan 446: fill the mohalla filter from the app's own mohalla
  // list — the list itself is never copied here — and re-render
  // the list whenever the operator picks a mohalla or clears it
  // back to all. The stored value is the list's own spelling, so
  // the filter always matches on the standard form.
  if (mohallaFilterSelect) {
    mohallaFilterSelect.innerHTML = quickCollectMohallaFilterOptionsHtml(DEFAULT_MOHALLAS, '');
  }

  mohallaFilterSelect?.addEventListener('change', () => {
    activeMohallaFilter = resolveQuickCollectMohallaFilter(mohallaFilterSelect.value, DEFAULT_MOHALLAS) ?? '';
    renderList();
  });

  // Wire search input
  searchInput?.addEventListener('input', () => {
    if (searchClearBtn) searchClearBtn.hidden = !searchInput.value;
    renderList();
  });

  searchClearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    searchClearBtn.hidden = true;
    searchInput?.focus();
    renderList();
  });

  // Wire filter tabs
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      setFilter(chip.getAttribute('data-filter') || 'all-dues');
      renderList();
    });
  });

  // Wire list card selection
  customerListContainer?.addEventListener('click', (e) => {
    if (e.target.closest('[data-qc-show-all]')) {
      setFilter('all');
      renderList();
      return;
    }
    const card = e.target.closest('.qc-customer-card');
    if (!card) return;
    const cid = card.getAttribute('data-customer-id');
    if (cid) {
      if (typeof onSelectCustomer === 'function') {
        onSelectCustomer(cid);
      }
      openCustomerCollectionForm(cid);
    }
  });

  // Plan 427: tapping a lookup row picks that customer exactly the
  // way tapping a picker card does.
  namePrefixList?.addEventListener('click', (e) => {
    const row = e.target.closest('.npl-row');
    if (!row) return;
    const cid = row.getAttribute('data-customer-id');
    if (cid) {
      if (typeof onSelectCustomer === 'function') {
        onSelectCustomer(cid);
      }
      openCustomerCollectionForm(cid);
    }
  });

  // Plan 441: tapping a last-four row picks that customer exactly
  // the way tapping a picker card does.
  lastFourList?.addEventListener('click', (e) => {
    const row = e.target.closest('.lfd-row');
    if (!row) return;
    const cid = row.getAttribute('data-customer-id');
    if (cid) {
      if (typeof onSelectCustomer === 'function') {
        onSelectCustomer(cid);
      }
      openCustomerCollectionForm(cid);
    }
  });

  // Plan 428: tapping a quick-pick row picks that customer exactly
  // the way tapping a picker card does.
  recentQuickPickList?.addEventListener('click', (e) => {
    const row = e.target.closest('.rqp-row');
    if (!row) return;
    const cid = row.getAttribute('data-customer-id');
    if (cid) {
      if (typeof onSelectCustomer === 'function') {
        onSelectCustomer(cid);
      }
      openCustomerCollectionForm(cid);
    }
  });

  // Wire quick amount helper chips
  quickAmountChips.forEach(chip => {
    chip.addEventListener('click', () => {
      if (!amountInput || !activeDefaults) return;
      const type = chip.getAttribute('data-quick-amount');
      // Plan 521: the "Full" and "50%" chips fill from the Plan 489
      // figures — the Plan 429 full-dues default
      // (activeDefaults.suggestedAmount), half of it rounded to
      // whole rupees, nothing when it works out to nothing — the
      // same shared rule the Plan 489 dues buttons and the one
      // screen follow. suggestedAmount already lifts to the whole
      // payable when ticket, boost or manual baqaya charges are
      // pending, so no separate branch is needed here; the old
      // Rs 500 fallback was an invented figure and is gone.
      const chipFigures = addPaymentDuesFigures({ fullDues: activeDefaults.suggestedAmount });
      // The Monthly chip still falls back to the oldest-bill /
      // total-dues figure when neither the current month nor the
      // full dues offer anything (unchanged — out of Plan 521's
      // scope).
      const baseBalance = (activeDefaults.ticketChargesPending > 0 || activeDefaults.addonChargesPending > 0 || activeDefaults.manualBaqayaPending > 0)

        ? activeDefaults.payableTotal
        : (activeDefaults.balanceDue > 0 ? activeDefaults.balanceDue : activeDefaults.totalDues);

      if (type === 'full') {
        if (chipFigures.full !== null) amountInput.value = chipFigures.full.toFixed(2);
      } else if (type === 'package') {
        // Plan 391: the package-price chip fills the customer's own
        // package price; with no known price it fills nothing and
        // leaves the amount field exactly as it was.
        const price = resolveQuickAmount('package', { packagePrice: packagePriceForCustomer(activeDefaults.customer, BILL_PACKAGES) });
        if (price !== null) {
          amountInput.value = price.toFixed(2);
        }
      } else if (type === 'current') {
        const cur = (activeDefaults.currentMonthBalance && activeDefaults.currentMonthBalance > 0)
          ? activeDefaults.currentMonthBalance
          : activeDefaults.suggestedAmount;
        amountInput.value = (cur > 0 ? cur : baseBalance).toFixed(2);
      } else if (type === 'half') {
        if (chipFigures.half !== null) amountInput.value = chipFigures.half.toFixed(2);
      } else {
        const val = Number(type);
        if (Number.isFinite(val)) {
          amountInput.value = val.toFixed(2);
        }
      }
      // SISP-101: chips set the amount programmatically (no input
      // event), so the waiver gate re-plans explicitly.
      if (activeCustomerId) renderWaiverBox(activeCustomerId, monthSelect?.value || activeDefaults?.targetMonth);
      // Plan 377: a chip-set amount refreshes the words the same way.
      renderAmountWordsLine();
      // Plan 432: a chip-set amount re-computes the change the same way.
      renderCashChange();
      // Plan 385: a chip-set amount re-settles the preview the same way.
      renderSettlementPreview();
      // Plan 386: a chip-set amount re-offers the choice the same way.
      renderOverpaymentChoice();
      // Plan 387: a chip-set amount re-shows the warning the same way.
      renderUnderpaymentWarning();
      amountInput.focus();
      // SISP-126: a chip-set amount can reveal/clear the remainder row.
      renderRemainderWaadaRow();
      // Plan 533: a chip-set amount re-computes the split total the same way.
      renderSplitTotal();
    });
  });

  // Plan 442: the on-screen numeric keypad host (null when the host
  // page predates it) — big digit keys for the amount field, so the
  // operator never needs the phone's own keyboard at the counter.
  const amountKeypadBox = typeof document !== 'undefined' ? document.getElementById('kpdAmountKeypad') : null;
  function renderAmountKeypad() {
    if (!amountKeypadBox) return;
    amountKeypadBox.innerHTML = amountKeypadHtml();
  }
  renderAmountKeypad();

  // Plan 442: a keypad tap enters exactly its digit into the amount
  // field — identical to typing it, so the form's normal submit
  // records it, exactly like a typed amount. Backspace drops the
  // last digit, clear empties the field. The keypad posts nothing.
  // A keypad tap sets the amount, so the change re-computes the same way.
  amountKeypadBox?.addEventListener('click', (event) => {
    const key = event.target?.closest?.('[data-kpd-key]');
    if (!key || !amountInput) return;
    amountInput.value = amountKeypadApplyKey(amountInput.value, key.getAttribute('data-kpd-key'));
    if (activeCustomerId) renderWaiverBox(activeCustomerId, monthSelect?.value || activeDefaults?.targetMonth);
    renderAmountWordsLine();
    renderCashChange();
    renderSettlementPreview();
    renderOverpaymentChoice();
    renderUnderpaymentWarning();
    amountInput.focus();
    renderRemainderWaadaRow();
    // Plan 533: a keypad-set amount re-computes the split total the same way.
    renderSplitTotal();
  });

  // SISP-116: a loose-change chip tap fills the tendered round amount
  // into the amount input — identical to typing it (the form's normal
  // submit records it through executeQuickCollection).
  looseChangeBox?.addEventListener('click', (event) => {
    const chip = event.target?.closest?.('[data-loose-tender]');
    if (!chip || !amountInput) return;
    const tendered = Number(chip.getAttribute('data-loose-tender'));
    if (!Number.isFinite(tendered) || tendered <= 0) return;
    amountInput.value = tendered.toFixed(2);
    // Plan 377: a loose-change tap fills the amount, so the words
    // refresh explicitly.
    renderAmountWordsLine();
    // Plan 432: a loose-change tap fills the amount, so the change
    // refreshes explicitly too.
    renderCashChange();
    // Plan 385: a loose-change tap fills the amount, so the preview
    // refreshes explicitly too.
    renderSettlementPreview();
    // Plan 386: a loose-change tap fills the amount, so the choice
    // refreshes explicitly too.
    renderOverpaymentChoice();
    // Plan 387: a loose-change tap fills the amount, so the warning
    // refreshes explicitly too.
    renderUnderpaymentWarning();
    // Plan 533: a loose-change tap fills the amount, so the split
    // total refreshes explicitly too.
    renderSplitTotal();
    amountInput.focus();
  });
  // The chips belong to the dues flow only; the Advance tag hides them.
  advanceCheckbox?.addEventListener('change', renderLooseChangeChips);

  // Back to pick
  backToPickBtn?.addEventListener('click', () => {
    showStep('pick');
    renderList();
    searchInput?.focus();
  });

  // Plan 382: the confirm step's buttons. Confirm arms the summary's
  // key for the current form values and resubmits — the save flow
  // posts only when the armed key still matches. Back returns to the
  // form with every entry intact; nothing is posted.
  confirmSaveBtn?.addEventListener('click', () => {
    // Plan 437: a second tap on Confirm while a save is in progress
    // is ignored — the first tap's save is already running.
    if (doubleTapSaveGuardIsSaving(saveGuard)) return;
    const summary = buildSaveConfirmationSummary();
    if (!summary) { showStep('form'); return; }
    saveConfirmationArmedKey = saveConfirmationSummaryKey(summary);
    if (typeof paymentForm?.requestSubmit === 'function') paymentForm.requestSubmit();
  });
  confirmBackBtn?.addEventListener('click', () => {
    saveConfirmationArmedKey = null;
    showStep('form');
    amountInput?.focus();
  });

  // SISP-121: the success card shows the COMBINED receipt after a split
  // collection (activeReceipt.splitTender), the ordinary card otherwise.
  // Polish 6 (B): the combined card gets the same on-screen Area select
  // as the ordinary card, so an unassigned area can be picked right here.
  function renderActiveReceiptCard() {
    if (!receiptCardContainer || !activeReceipt) return;
    receiptCardContainer.innerHTML = activeReceipt.splitTender
      ? renderSplitReceiptCardHtml(activeReceipt.splitTender, quickCollectAreaSelectHtml(activeReceipt.splitTender.area))
      : renderQuickCollectReceiptCardHtml(activeReceipt);
    // Plan 443: the card re-render refreshes the share draft too, so
    // an area change or a share never leaves a stale draft on screen.
    renderReceiptShareDraft();
    // Plan 444: the card re-render refreshes the pending-clearance
    // flag too, so the flag on the success screen always matches
    // the receipt on the card.
    renderSuccessPendingClearanceFlag();
  }

  // Plan 444: the pending-clearance flag on the success screen —
  // shown again after the save while the saved payment's method is
  // a bank transfer or a cheque (any one leg, for a split
  // collection). It flags only: the payment already recorded
  // normally as pending, and the flag never changes any bill,
  // payment, clearance status, or customer record by itself. With
  // no receipt saved yet the host is cleared and hidden.
  function renderSuccessPendingClearanceFlag() {
    if (!successPendingClearanceFlagEl) return;
    if (!activeReceipt) {
      successPendingClearanceFlagEl.textContent = '';
      successPendingClearanceFlagEl.hidden = true;
      return;
    }
    const flag = pendingClearanceFlagForReceipt(activeReceipt);
    successPendingClearanceFlagEl.textContent = flag;
    successPendingClearanceFlagEl.hidden = flag === '';
  }

  // Plan 449: the second-connection step — after the first
  // connection's payment, the customer's other connection (from
  // the active link record) with the dues still owed, recordable
  // in the same pass. The step shows only while the pass still
  // owes it: no active link, a split first receipt, nothing still
  // owed, or a second payment already recorded in this pass all
  // hide it. The amount is the operator's to change — the
  // suggestion is the customer's remaining dues, because the app
  // stores no per-connection bills to read the second connection's
  // dues from. Recording reuses the existing save path with the
  // first payment's method and date and the second connection's
  // name, so the second payment is a separate record with its own
  // receipt; the step itself changes no bill, payment total,
  // connection, or link record.
  let secondConnectionRecorded = false;
  let secondConnectionWired = false;
  let currentSecondConnectionStep = null;
  function hideSecondConnectionStep() {
    if (!secondConnectionBox) return;
    currentSecondConnectionStep = null;
    secondConnectionBox.innerHTML = '';
    secondConnectionBox.hidden = true;
  }
  function renderSecondConnectionStep() {
    if (!secondConnectionBox) return;
    if (!activeReceipt || secondConnectionRecorded || activeReceipt.splitTender) {
      hideSecondConnectionStep();
      return;
    }
    const postSaveState = getState();
    const postSaveCustomer = postSaveState?.customers?.find((c) => c.id === activeCustomerId) ?? null;
    if (!postSaveCustomer) {
      hideSecondConnectionStep();
      return;
    }
    const links = typeof loadBillingLinks === 'function' ? loadBillingLinks() : [];
    const baqayaCents = manualBaqayaOutstandingCents(postSaveCustomer);
    const remainingCents = stillOwesCents(postSaveCustomer, calculatePaymentAllocations(postSaveState), baqayaCents);
    const step = secondConnectionStep({
      links,
      customerId: activeCustomerId,
      firstPayment: {
        connection: activeReceipt.connection || '',
        amountCents: Math.round(Number(activeReceipt.amount || 0) * 100),
        method: activeReceipt.method || '',
      },
      remainingDuesCents: remainingCents,
    });
    if (!step) {
      hideSecondConnectionStep();
      return;
    }
    currentSecondConnectionStep = step;
    secondConnectionBox.innerHTML = secondConnectionStepHtml(step);
    secondConnectionBox.hidden = false;
    if (!secondConnectionWired) {
      secondConnectionWired = true;
      secondConnectionBox.addEventListener('input', (event) => {
        if (event?.target?.id !== 'sccSecondConnectionAmount') return;
        const totalEl = document.getElementById('sccSecondConnectionTotal');
        if (!totalEl || !currentSecondConnectionStep) return;
        const typedCents = secondConnectionValidAmountCents({ amount: event.target.value });
        totalEl.textContent = secondConnectionSummaryText(currentSecondConnectionStep, typedCents);
      });
      secondConnectionBox.addEventListener('click', (event) => {
        if (event?.target?.id === 'sccSecondConnectionDismiss') {
          hideSecondConnectionStep();
          return;
        }
        if (event?.target?.id !== 'sccSecondConnectionRecord') return;
        recordSecondConnectionPayment();
      });
    }
  }
  function recordSecondConnectionPayment() {
    if (!activeReceipt || secondConnectionRecorded) return;
    const recordBtn = document.getElementById('sccSecondConnectionRecord');
    const amountInput = document.getElementById('sccSecondConnectionAmount');
    const amountVal = Number(amountInput?.value);
    if (!Number.isFinite(amountVal) || amountVal <= 0) {
      if (typeof onToast === 'function') onToast('Enter a valid amount greater than zero for the second connection.', { type: 'error' });
      amountInput?.focus();
      return;
    }
    const firstReceipt = activeReceipt;
    const postSaveState = getState();
    const postSaveCustomer = postSaveState?.customers?.find((c) => c.id === activeCustomerId) ?? null;
    if (!postSaveCustomer) {
      if (typeof onToast === 'function') onToast('Customer not found.', { type: 'error' });
      return;
    }
    // The first payment must still exist: undoing or reversing it
    // after the step was offered leaves nothing to follow, so the
    // step refuses instead of recording a lone second payment.
    const firstStillThere = (postSaveCustomer.bills ?? []).some((bill) =>
      (bill?.payments ?? []).some((p) => p?.id === firstReceipt.paymentId));
    if (!firstStillThere) {
      hideSecondConnectionStep();
      if (typeof onToast === 'function') onToast('The first payment is no longer recorded, so the second connection cannot be recorded after it.', { type: 'error' });
      return;
    }
    const links = typeof loadBillingLinks === 'function' ? loadBillingLinks() : [];
    const baqayaCents = manualBaqayaOutstandingCents(postSaveCustomer);
    const remainingCents = stillOwesCents(postSaveCustomer, calculatePaymentAllocations(postSaveState), baqayaCents);
    const step = secondConnectionStep({
      links,
      customerId: activeCustomerId,
      firstPayment: {
        connection: firstReceipt.connection || '',
        amountCents: Math.round(Number(firstReceipt.amount || 0) * 100),
        method: firstReceipt.method || '',
      },
      remainingDuesCents: remainingCents,
    });
    if (!step) {
      hideSecondConnectionStep();
      return;
    }
    if (recordBtn) recordBtn.disabled = true;
    try {
      // The second payment reuses the first payment's method and
      // date and the same target month — one visit, one method, one
      // day — and carries the second connection's name, so the
      // payment and its receipt say which connection they belong
      // to. It carries no separate transaction reference: the
      // reference (if any) stays on the first payment only.
      const { nextState, receipt } = executeQuickCollection(postSaveState, {
        customerId: activeCustomerId,
        month: firstReceipt.month,
        amount: amountVal,
        date: firstReceipt.date,
        method: firstReceipt.method,
        connection: step.secondConnection,
        tickets: loadTickets(),
      });
      secondConnectionRecorded = true;
      activeReceipt = receipt;
      if (typeof onSaveState === 'function') onSaveState(nextState);
      renderActiveReceiptCard();
      applyPackageSuccessMessage(receipt.amount);
      renderSuccessNextSteps();
      renderRepeatPayment();
      renderStillOwesLine();
      renderOfflineSavedBadge();
      renderSettleStatusBadge();
      renderReceiptShareDraft();
      renderSuccessPendingClearanceFlag();
      hideSecondConnectionStep();
      updateCounts();
      const totalCents = secondConnectionTotalCents(
        Math.round(Number(firstReceipt.amount || 0) * 100),
        Math.round(amountVal * 100)
      );
      if (typeof onToast === 'function') {
        onToast(
          `Second payment of PKR ${amountVal.toLocaleString('en-PK')} recorded for ${step.secondConnection}${totalCents !== null ? ` — total paid this visit PKR ${(totalCents / 100).toLocaleString('en-PK')}` : ''}.`,
          { type: 'success', title: 'Second payment recorded' }
        );
      }
    } catch (err) {
      if (typeof onToast === 'function') onToast(err?.message || err, { type: 'error' });
      if (recordBtn) recordBtn.disabled = false;
    }
  }

  // Plan 434: the success next-steps panel — amount paid, still owed
  // after this payment, next due date, and a collect-again action —
  // rendered beside the package success message from the receipt the
  // save just issued and the customer's own post-save record. It
  // shows only: rendering posts nothing and changes no record. The
  // still-owed figure is the receipt's own payable remainder; the
  // next due date is the earliest due date among bills that still
  // carry a balance, from the allocation engine's own figures. The
  // collect-again tap reopens the payment form for the same
  // customer; it records nothing by itself.
  let nextStepsWired = false;
  function renderSuccessNextSteps() {
    if (!nextStepsBox) return;
    if (!activeReceipt) {
      nextStepsBox.innerHTML = '';
      nextStepsBox.hidden = true;
      return;
    }
    const postSaveState = getState();
    const postSaveCustomer = postSaveState?.customers?.find((c) => c.id === activeCustomerId) ?? null;
    const nextDueDate = postSaveState
      ? successNextStepsNextDueDate(postSaveCustomer, calculatePaymentAllocations(postSaveState))
      : null;
    const nextSteps = successNextStepsFromReceipt(activeReceipt, nextDueDate);
    const html = nextSteps ? successNextStepsHtml(nextSteps) : '';
    nextStepsBox.innerHTML = html;
    nextStepsBox.hidden = html === '';
    if (!nextStepsWired && nextStepsBox) {
      nextStepsWired = true;
      nextStepsBox.addEventListener('click', (event) => {
        if (!event.target?.closest?.('[data-sns-collect-again]')) return;
        if (!activeCustomerId) return;
        openCustomerCollectionForm(activeCustomerId);
      });
    }
  }

  // Plan 490: the repeat-payment action — "Record another payment
  // for the same customer" — on the success screen, beside the
  // next-steps panel. The tap opens a fresh form for the same
  // customer with an empty amount and nothing else carried over; it
  // records nothing by itself. The second payment is recorded only
  // when the operator saves the fresh form, and leaving without
  // saving records nothing.
  let repeatPaymentWired = false;
  function renderRepeatPayment() {
    if (!repeatPaymentBox) return;
    if (!activeReceipt) {
      repeatPaymentBox.innerHTML = '';
      repeatPaymentBox.hidden = true;
      return;
    }
    const target = repeatPaymentFormTarget(activeCustomerId);
    const html = target ? repeatPaymentHtml(target) : '';
    repeatPaymentBox.innerHTML = html;
    repeatPaymentBox.hidden = html === '';
    if (!repeatPaymentWired && repeatPaymentBox) {
      repeatPaymentWired = true;
      repeatPaymentBox.addEventListener('click', (event) => {
        const button = event.target?.closest?.('[data-rpt-repeat-payment]');
        if (!button) return;
        const customerId = button.getAttribute('data-rpt-customer-id') || activeCustomerId;
        if (!customerId) return;
        openCustomerCollectionForm(customerId, { emptyAmount: true });
      });
    }
  }

  // Plan 440: the still-owes line — the customer's bill dues after this
  // payment, in plain words, or "Bill dues fully paid" — shown immediately at
  // the top of the success screen. It shows only: rendering posts
  // nothing and changes no record. The figure is the customer's
  // dues from the post-save record (open bill balances from the
  // allocation engine plus unpaid manual baqaya) — NOT the receipt's
  // payable remainder, which also folds in pending ticket and boost
  // charges. A figure that cannot be worked out shows no line,
  // never a guessed one.
  function renderStillOwesLine() {
    if (!stillOwesBox) return;
    if (!activeReceipt) {
      stillOwesBox.innerHTML = '';
      stillOwesBox.hidden = true;
      return;
    }
    const postSaveState = getState();
    const postSaveCustomer = postSaveState?.customers?.find((c) => c.id === activeCustomerId) ?? null;
    const baqayaCents = postSaveCustomer ? manualBaqayaOutstandingCents(postSaveCustomer) : 0;
    const line = postSaveState
      ? stillOwesLine(postSaveCustomer, calculatePaymentAllocations(postSaveState), baqayaCents)
      : null;
    const html = line ? stillOwesLineHtml(line) : '';
    stillOwesBox.innerHTML = html;
    stillOwesBox.hidden = html === '';
  }

  // Plan 436: the offline saved badge — "saved on this device" with the
  // save time, from the saved payment's own recorded-at stamp. It badges
  // only: rendering posts nothing, syncs nothing, and changes no record.
  // A payment not yet saved shows no badge: with no active receipt the
  // host is cleared and hidden. A split collection records two legs of
  // its own in one save, so the badge takes the later of the two stamps.
  function renderOfflineSavedBadge() {
    if (!savedBadgeBox) return;
    if (!activeReceipt) {
      savedBadgeBox.innerHTML = '';
      savedBadgeBox.hidden = true;
      return;
    }
    const postSaveState = getState();
    const postSaveCustomer = postSaveState?.customers?.find((c) => c.id === activeCustomerId) ?? null;
    const bills = Array.isArray(postSaveCustomer?.bills) ? postSaveCustomer.bills : [];
    const stamps = [];
    const collectStamp = (paymentId) => {
      if (!paymentId) return;
      for (const bill of bills) {
        const payments = Array.isArray(bill?.payments) ? bill.payments : [];
        const found = payments.find((p) => p?.id === paymentId);
        if (found?.recordedAt) stamps.push(found.recordedAt);
      }
    };
    collectStamp(activeReceipt.paymentId);
    const splitLegs = Array.isArray(activeUndoContext?.splitLegs) ? activeUndoContext.splitLegs : [];
    for (const leg of splitLegs) collectStamp(leg?.paymentId);
    const badge = offlineSavedBadge(offlineSavedBadgeLatestTime(stamps));
    // Polish 17 (Req 2 S1): the merged status row shows the badge as a
    // compact "✓ Saved 20:29" pill next to the still-owes pill.
    const html = badge ? offlineSavedBadgeHtml(badge, { compact: true }) : '';
    savedBadgeBox.innerHTML = html;
    savedBadgeBox.hidden = html === '';
  }

  // Polish 21 (Req 6): the settle/partial badge in the merged status
  // section — "✓ Settle in Full" when nothing is left to pay,
  // "⏳ Partial Payment" otherwise — written from the same receipt data
  // the card builder used (ordinary: payableRemaining ?? newTotalDues
  // <= 0; split: the combined receipt's PAID status). The badge is
  // layout-only: rendering posts nothing and changes no record. No
  // active receipt clears it and hides the host.
  function renderSettleStatusBadge() {
    if (!settleStatusBadgeBox) return;
    if (!activeReceipt) {
      settleStatusBadgeBox.textContent = '';
      settleStatusBadgeBox.hidden = true;
      return;
    }
    const settled = activeReceipt.splitTender
      ? activeReceipt.splitTender.status === 'PAID'
      : (activeReceipt.payableRemaining ?? activeReceipt.newTotalDues) <= 0;
    settleStatusBadgeBox.className = `qc-receipt-badge ${settled ? 'settled' : 'partial'}`;
    settleStatusBadgeBox.textContent = settled ? '✓ Settle in Full' : '⏳ Partial Payment';
    settleStatusBadgeBox.hidden = false;
  }

  // Plan 443: the receipt share draft — the receipt's share text,
  // prepared right after a save so the operator reads it first, then
  // sends it or dismisses it. It drafts only: rendering posts nothing
  // and changes no record. The text is the dispatch's own text for
  // this receipt — the ordinary receipt text for a single payment,
  // the combined-receipt text for a split — so the draft the operator
  // reads is exactly what Send will send. Send routes through the
  // success screen's existing messaging button; Dismiss hides the
  // draft for this receipt. A receipt already shared, or dismissed,
  // shows no draft again.
  let shareDraftDismissedFor = null;
  let shareDraftWired = false;
  function renderReceiptShareDraft() {
    if (!shareDraftBox) return;
    if (!activeReceipt) {
      shareDraftBox.innerHTML = '';
      shareDraftBox.hidden = true;
      return;
    }
    if (shareDraftDismissedFor === activeReceipt.id || isReceiptShared(activeReceipt.id)) {
      shareDraftBox.innerHTML = '';
      shareDraftBox.hidden = true;
      return;
    }
    const receiptCustomer = getState()?.customers?.find((c) => c.id === activeReceipt.customerId) ?? null;
    const shareText = activeReceipt.splitTender
      ? formatSplitTenderWhatsAppText(activeReceipt.splitTender)
      : formatQuickCollectWhatsAppReceipt(activeReceipt, { whatsappPhone: receiptCustomer ? whatsappPhoneFor(receiptCustomer) : '', lang: receiptLangPreference(receiptCustomer) }).text;
    const draft = receiptShareDraftFor(activeReceipt, shareText);
    const html = draft ? receiptShareDraftHtml(draft) : '';
    shareDraftBox.innerHTML = html;
    shareDraftBox.hidden = html === '';
    if (!shareDraftWired && shareDraftBox) {
      shareDraftWired = true;
      shareDraftBox.addEventListener('click', (event) => {
        if (!activeReceipt) return;
        const sendBtn = event.target?.closest?.('[data-rsd-send]');
        const dismissBtn = event.target?.closest?.('[data-rsd-dismiss]');
        if (!sendBtn && !dismissBtn) return;
        shareDraftDismissedFor = activeReceipt.id;
        shareDraftBox.innerHTML = '';
        shareDraftBox.hidden = true;
        if (sendBtn) whatsAppBtn?.click();
      });
    }
  }

  // Polish 4: the success line under the heading names the package that
  // the amount just collected pays for, or keeps the existing English
  // line when the amount matches no package.
  // Polish 17 (Req 1): the Urdu package message renders in Nastaliq
  // with the animated mixed-colour gradient; the English default line
  // (amount matches no package) keeps the system font — no gradient.
  function applyPackageSuccessMessage(amount) {
    const messageEl = document.getElementById('quickCollectSuccessMessage');
    if (!messageEl) return;
    messageEl.textContent = packageSuccessMessageOrDefault(amount);
    const isUrdu = packageSuccessMessage(amount) !== null;
    messageEl.classList.toggle('qc-urdu-nastaliq', isUrdu);
    messageEl.classList.toggle('qc-urdu-gradient', isUrdu);
    if (isUrdu) {
      messageEl.setAttribute('dir', 'rtl');
      messageEl.setAttribute('lang', 'ur');
    } else {
      messageEl.removeAttribute('dir');
      messageEl.removeAttribute('lang');
    }
  }

  // Polish 4: the success screen's Area / Location is a select. Choosing
  // an area saves it to the customer's profile (mohalla, canonical
  // spelling) through updateCustomerProfile and shows it on this receipt.
  // Picking 'Unassigned' changes nothing — the profile area is never
  // wiped from here. (A closure flag, not a dataset marker, so mock-DOM
  // elements without dataset still set up cleanly.)
  if (receiptCardContainer && !areaSelectWired) {
    areaSelectWired = true;
    receiptCardContainer.addEventListener('change', (event) => {
      const select = event.target?.closest?.('[data-qc-area-select]');
      if (!select || !activeReceipt || !activeCustomerId) return;
      const raw = String(select.value ?? '').trim();
      if (!raw) { renderActiveReceiptCard(); return; }
      const stored = canonicalMohalla(raw)?.stored ?? raw;
      try {
        const nextState = updateCustomerProfile(getState(), activeCustomerId, { mohalla: stored });
        if (typeof onSaveState === 'function') onSaveState(nextState);
        activeReceipt = { ...activeReceipt, area: stored };
        // Polish 6 (B): the combined split card reads its area from the
        // split receipt, not from the top-level receipt, so sync it too —
        // otherwise the re-render would show the old area on that card.
        if (activeReceipt.splitTender) {
          activeReceipt = { ...activeReceipt, splitTender: { ...activeReceipt.splitTender, area: stored } };
        }
        renderActiveReceiptCard();
        if (typeof onToast === 'function') onToast(`Area updated to ${stored}.`, { type: 'success', title: 'Area updated' });
      } catch (err) {
        if (typeof onToast === 'function') onToast(err.message || 'Area could not be updated.', { type: 'error' });
        renderActiveReceiptCard();
      }
    });
  }

  function executeUndo() {
    if (!activeUndoContext) return;
    const { customerId, month, paymentId, amount, customerName, ticketCharges, addonCharges, splitLegs: undoSplitLegs } = activeUndoContext;
    activeUndoContext = null;
    if (undoTimeoutId) {
      clearTimeout(undoTimeoutId);
      undoTimeoutId = null;
    }
    stopUndoCountdown();
    if (undoBtn) undoBtn.hidden = true;
    // Plan 435: the payment is being deleted, not reversed — clear
    // the sixty-second reversal undo too, so it can never reverse a
    // payment that no longer exists.
    disarmReversalUndo();
    try {
      const state = getState();
      // SISP-126: capture the doomed payment's remainder-waada stamp
      // BEFORE the delete — undoing the collection must also undo the
      // promise it set (or restore the promise it replaced).
      const doomedPayment = state?.customers?.find(c => c.id === customerId)
        ?.bills?.find(b => b.month === month)?.payments?.find(p => p.id === paymentId);
      const undoWaadaStamp = remainderWaadaOf(doomedPayment);
      const undoWaadaPrevious = remainderWaadaPreviousOf(doomedPayment);
      // Polish #11: the package-rollback stamp this payment's follow
      // left on it — captured here for the same reason, before the
      // delete takes it.
      const undoPackageRollback = autoPackageRollbackOf(doomedPayment);
      // SISP-121: undoing a split collection removes BOTH legs, newest
      // first, each with its own SISP-43 ticket-charge reopen — exactly
      // reversing the order they were recorded in.
      const splitLegs = Array.isArray(undoSplitLegs) ? undoSplitLegs : null;
      if (splitLegs && splitLegs.length > 0) {
        let workingTickets = loadTickets();
        let workingState = state;
        for (const leg of [...splitLegs].reverse()) {
          const legLines = Array.isArray(leg.ticketCharges) ? leg.ticketCharges : [];
          if (legLines.length > 0) {
            const reverted = unsettleTicketChargesForPayment(workingTickets, { id: leg.paymentId, ticketCharges: legLines });
            workingTickets = reverted.tickets;
            workingState = deletePayment(workingState, customerId, month, leg.paymentId, new Date(), { ticketChargesReverted: true });
          } else {
            workingState = deletePayment(workingState, customerId, month, leg.paymentId);
          }
        }
        saveTickets(workingTickets);
        if (typeof onSaveState === 'function') {
          onSaveState(workingState);
        }
        updateCounts();
        renderList();
        showStep('pick');
        if (typeof onToast === 'function') {
          onToast(`Payment of PKR ${amount.toLocaleString()} for ${customerName} undone. Ledger restored.`, { type: 'success', title: 'Undone' });
        }
        return;
      }
      // SISP-43: an undone collection reopens the ticket charges it
      // settled, first — only then may the payment itself be deleted
      // (core refuses to delete a charge-settling payment otherwise).
      const settledLines = Array.isArray(ticketCharges) ? ticketCharges : [];
      // SISP-101: an undone waiver collection first restores the late
      // fee from the payment's reversal stamp — only then may the
      // payment be deleted (core refuses to delete a waiver payment
      // otherwise), so the fee can never stay waived with no payment
      // behind it. Both restorations compose on the same working
      // state; nothing persists unless the delete itself succeeds.
      const undoPayment = state.customers.find(c => c.id === customerId)
        ?.bills.find(b => b.month === month)
        ?.payments.find(p => p.id === paymentId);
      const hasWaiver = !!lateFeeWaiverOf(undoPayment);
      let workingState = hasWaiver
        ? restoreWaivedLateFee(state, customerId, undoPayment, { note: 'Late fee restored (payment undone)' }).state
        : state;
      // SISP-106: the same for boost charges — they live on the
      // customer in state, so they reopen in the working state before
      // the delete, under the same guard contract.
      const settledAddonLines = Array.isArray(addonCharges) ? addonCharges : [];
      let nextState;
      if (settledLines.length > 0 || settledAddonLines.length > 0) {
        if (settledLines.length > 0) {
          const { tickets: revertedTickets } = unsettleTicketChargesForPayment(loadTickets(), { id: paymentId, ticketCharges: settledLines });
          saveTickets(revertedTickets);
        }
        if (settledAddonLines.length > 0) {
          const cust = workingState.customers.find(c => c.id === customerId);
          if (cust) {
            const { customer: reopenedCustomer } = unsettleAddonChargesForPayment(cust, { id: paymentId, addonCharges: settledAddonLines });
            workingState = { ...workingState, customers: workingState.customers.map(c => (c.id === customerId ? reopenedCustomer : c)) };
          }
        }
        nextState = deletePayment(workingState, customerId, month, paymentId, new Date(), {
          ...(settledLines.length > 0 ? { ticketChargesReverted: true } : {}),
          ...(settledAddonLines.length > 0 ? { addonChargesReverted: true } : {}),
          ...(hasWaiver ? { lateFeeWaiverReverted: true } : {})
        });
      } else if (hasWaiver) {
        nextState = deletePayment(workingState, customerId, month, paymentId, new Date(), { lateFeeWaiverReverted: true });
      } else {
        nextState = deletePayment(state, customerId, month, paymentId);
      }
      // SISP-126: if the customer's live promise is still exactly this
      // payment's remainder waada, undo it too — restore the promise the
      // waada replaced when the stamp kept one, otherwise clear it. A
      // promise changed since (a newer waada) is never clobbered.
      if (undoWaadaStamp) {
        const custAfter = nextState.customers.find(c => c.id === customerId);
        if (custAfter && isRemainderWaadaCurrent(custAfter, undoWaadaStamp)) {
          const restored = undoWaadaPrevious
            ? setCustomerWaada(custAfter, undoWaadaPrevious)
            : clearCustomerWaada(custAfter);
          nextState = { ...nextState, customers: nextState.customers.map(c => c.id === customerId ? restored : c) };
        }
      }
      // Polish #11: roll back the package follow this payment caused —
      // only while the live package is still exactly the follow's
      // result, so a newer package change is never clobbered.
      if (undoPackageRollback) {
        const custAfter = nextState.customers.find(c => c.id === customerId);
        if (custAfter) {
          const restored = rollbackAutoPackage(custAfter, undoPackageRollback);
          if (restored) nextState = { ...nextState, customers: nextState.customers.map(c => (c.id === customerId ? restored : c)) };
        }
      }
      if (typeof onSaveState === 'function') {
        onSaveState(nextState);
      }
      updateCounts();
      renderList();
      showStep('pick');
      if (typeof onToast === 'function') {
        onToast(`Payment of PKR ${amount.toLocaleString()} for ${customerName} undone. Ledger restored.`, { type: 'success', title: 'Undone' });
      }
    } catch (err) {
      if (typeof onToast === 'function') {
        onToast(`Could not undo payment: ${err.message}`, { type: 'error' });
      }
    }
  }

  undoBtn?.addEventListener('click', () => {
    executeUndo();
  });

  // Plan 435: the sixty-second reversal undo. Records a normal
  // negative entry linked to the original through the reversal
  // link — the original stays visible with its reversal, the pair
  // nets to zero, and nothing is deleted. Refused once the window
  // has passed; returns to the entry form for the same customer
  // so the correct amount can be entered straight away.
  function executeReversalUndo() {
    const ctx = activeReversalUndo;
    if (!ctx) return;
    disarmReversalUndo();
    // The payment is being reversed, not deleted: clear the
    // five-second delete-undo too, so it can never delete a
    // payment that already has a reversal.
    if (undoTimeoutId) {
      clearTimeout(undoTimeoutId);
      undoTimeoutId = null;
    }
    stopUndoCountdown();
    activeUndoContext = null;
    if (undoBtn) undoBtn.hidden = true;
    try {
      if (!quickCollectReversalUndoAllowed(ctx.savedAtMs, Date.now())) {
        if (typeof onToast === 'function') onToast('The sixty-second undo window has passed. Use the correction flow to fix this payment.', { type: 'error' });
        return;
      }
      const state = getState();
      const original = state?.customers?.find((c) => c.id === ctx.customerId)?.bills?.find((b) => b.month === ctx.month)?.payments?.find((p) => p.id === ctx.paymentId) ?? null;
      if (!original) {
        if (typeof onToast === 'function') onToast('Could not undo payment: the original payment was not found.', { type: 'error' });
        return;
      }
      const fields = quickCollectReversalUndoFields(original, { date: getPakistanLocalDate(), reason: QUICK_COLLECT_REVERSAL_UNDO_REASON });
      if (!fields) {
        if (typeof onToast === 'function') onToast('Could not undo payment: the original payment cannot be reversed.', { type: 'error' });
        return;
      }
      const nextState = addPayment(state, ctx.customerId, ctx.month, fields, new Date());
      if (typeof onSaveState === 'function') {
        onSaveState(nextState);
      }
      updateCounts();
      renderList();
      openCustomerCollectionForm(ctx.customerId);
      if (typeof onToast === 'function') {
        onToast(`Payment of PKR ${Number(ctx.amount).toLocaleString()} for ${ctx.customerName} undone by reversal. The original stays visible with its reversal.`, { type: 'success', title: 'Undone' });
      }
    } catch (err) {
      if (typeof onToast === 'function') {
        onToast(`Could not undo payment: ${err.message}`, { type: 'error' });
      }
    }
  }

  reversalUndoBtn?.addEventListener('click', () => {
    executeReversalUndo();
  });

  // Form submit
  paymentForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!activeCustomerId) return;

    // Plan 437: double-tap save guard — a second tap for the same
    // payment while a save is in progress is ignored outright, before
    // any guard runs or any figure is read. The buttons disable with
    // the arming and re-enable in the finally below.
    const saveGuardKey = doubleTapSaveGuardKey({
      customerId: activeCustomerId,
      amount: amountInput?.value,
      method: methodSelect?.value,
      month: monthSelect?.value,
      date: dateInput?.value
    });
    if (!doubleTapSaveGuardTryStart(saveGuard, saveGuardKey)) return;
    saveGuardHeldForDialog = false;
    doubleTapSaveGuardSetDisabled(quickCollectConfirmBtn, true);
    doubleTapSaveGuardSetDisabled(confirmSaveBtn, true);

    try {
      const state = getState();
      const amountVal = Number(amountInput?.value);
      const dateVal = dateInput?.value || getPakistanLocalDate();
      // SISP-161: month-attribution guard, surfaced in the operator's
      // language before submit — a payment date after today (PKT) is
      // refused. Core validatePayment enforces the identical rule at
      // record time, so Field Mode and every other entry path stay
      // covered even where this pre-check does not run.
      if (isFuturePaymentDate(dateVal, getPakistanLocalDate())) {
        if (typeof onToast === 'function') onToast(t('bdate_future_error'), { type: 'error' });
        return;
      }
      const methodVal = methodSelect?.value || 'Cash';
      const monthVal = monthSelect?.value || activeDefaults.targetMonth;
      const paidByVal = paidByInput?.value || '';
      // Plan 379: the collection note values, read beside the payer
      // name — empty reads as no note, exactly like the payer field.
      const collectedByVal = collectedByInput?.value || '';
      const collectionPlaceVal = normalizeCollectionPlace(collectionPlaceSelect?.value || '');
      const collectionMohallaVal = collectionMohallaInput?.value || '';
      // Plan 389: the Urdu-script note value, read beside the payer
      // name — empty reads as no note, exactly like the payer field.
      const urduNoteVal = urduNoteInput?.value || '';
      // Plan 398: the category tag value, read beside the payer
      // name — the kind of transaction in plain words; empty reads
      // as no tag (the payment reads as 'other'), exactly like the
      // payer field.
      const categoryTagVal = categoryTagSelect?.value || '';
      // Plan 399: the picked promise id, read beside the category
      // tag — the promise this payment fulfils. Empty reads as no
      // link, exactly like the payer field.
      const promiseLinkVal = promiseLinkSelect?.value || '';
      // Plan 393: the cross-payment note values, read beside the payer
      // name — a picked payer customer, a typed payer name, and the
      // relationship in plain words. The typed name wins; else the
      // picked payer customer's name is used. A note with no payer
      // name is no note at all, even when a relationship was typed.
      const crossPayerIdVal = crossPayerSelect?.value || '';
      const crossPayerNameVal = crossPayerNameInput?.value || '';
      const crossRelationshipVal = crossRelationshipInput?.value || '';
      const crossPayerCustomer = crossPayerIdVal ? (state.customers || []).find((entry) => entry && entry.id === crossPayerIdVal) : null;
      const crossPayerName = (crossPayerNameVal || '').trim() || (crossPayerCustomer ? (crossPayerCustomer.name || crossPayerCustomer.customerName || '') : '');
      const crossPaymentVal = crossPayerName ? { payerName: crossPayerName, payerCustomerId: crossPayerIdVal || undefined, relationship: (crossRelationshipVal || '').trim() || undefined } : undefined;

      const isDig = isDigitalPaymentMethod(methodVal);
      const txnIdVal = (transactionIdInput?.value || '').trim();
      const overrideReasonVal = (overrideReasonInput?.value || '').trim();

      if (isDig) {
        if (!txnIdVal && !overrideReasonVal) {
          const txnMsg = 'Please enter a Transaction ID or an override reason for digital payments.';
          // #292: show it next to the field too (a toast alone was hidden behind the sheet).
          if (transactionIdInput) {
            let err = document.getElementById('quickCollectTxnError');
            if (!err) {
              err = document.createElement('p');
              err.id = 'quickCollectTxnError';
              err.className = 'qc-field-error';
              err.setAttribute('role', 'alert');
              transactionIdInput.insertAdjacentElement('afterend', err);
              const clear = () => { err.hidden = true; transactionIdInput.removeAttribute('aria-invalid'); };
              transactionIdInput.addEventListener('input', clear);
              overrideReasonInput?.addEventListener('input', clear);
            }
            err.textContent = txnMsg;
            err.hidden = false;
            transactionIdInput.setAttribute('aria-invalid', 'true');
            transactionIdInput.setAttribute('aria-describedby', 'quickCollectTxnError');
          }
          // #296: the message is already shown inline under the field (role="alert"), so no toast
          // on top of the sheet; only fall back to a toast when the field is missing.
          if (!transactionIdInput && typeof onToast === 'function') {
            onToast(txnMsg, { type: 'error' });
          }
          transactionIdInput?.focus();
          return;
        }
        if (txnIdVal) {
          const dup = findDuplicatePaymentReference(state, txnIdVal);
          if (dup && duplicateBypassedForTxn !== txnIdVal) {
            const dupDate = dup.date || dup.paymentDate || 'recently';
            const dupMonth = dup.month || dup.billMonth || 'unknown';
            const dupAmt = Number(dup.amount || 0).toLocaleString('en-PK');
            if (dupWarningCard) {
              if (dupMsg) {
                dupMsg.textContent = `Transaction ID "${txnIdVal}" was already recorded on ${dupDate} for ${dup.customerName || 'customer'} (#${dup.customerNumber || '?'}) in month ${dupMonth} (PKR ${dupAmt}).`;
              }
              if (dupReasonInput) dupReasonInput.value = '';
              syncDupProceed();
              dupWarningCard.hidden = false;
              dupWarningCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              (dupCancelBtn || dupProceedBtn)?.focus(); // Cancel is the safe default (#279)
              return; // in-app card only: no browser confirm() (#279)
            }
            // No card in the page (older markup): fall back to the shared in-app confirm.
            const ask = typeof window.appConfirm === 'function'
              ? window.appConfirm({ tone: 'warning', title: 'Duplicate Transaction ID', subject: `Transaction ID "${txnIdVal}"`, message: `Already recorded on ${dupDate} for ${dup.customerName} (#${dup.customerNumber}) in month ${dupMonth} (PKR ${dupAmt}). Save anyway?`, confirmLabel: 'Save anyway' })
              : Promise.resolve(false);
            ask.then(ok => {
              // Plan 437: the prompt's answer settles this save — clear
              // the guard first, so the resubmit below re-arms it fresh
              // and a cancelled prompt leaves the form usable.
              saveGuardHeldForDialog = false;
              doubleTapSaveGuardFinish(saveGuard);
              doubleTapSaveGuardSetDisabled(quickCollectConfirmBtn, false);
              doubleTapSaveGuardSetDisabled(confirmSaveBtn, false);
              if (!ok) { transactionIdInput?.focus(); return; }
              duplicateBypassedForTxn = txnIdVal;
              if (typeof paymentForm?.requestSubmit === 'function') paymentForm.requestSubmit();
            });
            saveGuardHeldForDialog = true;
            return;
            if (dupWarningCard) {
              dupWarningCard.hidden = true;
            }
          }
        }
      }

      // Advance guard (owner rule): an untagged collection against an
      // already-paid bill is refused — the collector ticks the Advance
      // box instead, so money received early stays tagged as advance
      // credit. Collections settling billed ticket charges are exempt
      // (SISP-43: their money belongs to the tickets, and that pinned
      // flow records after a bill is paid).
      if (!advanceCheckbox?.checked
        && normalPaymentBlockReason(state, activeCustomerId, monthVal) === 'fully-paid'
        && billedTicketChargesPending(loadTickets(), activeCustomerId) <= 0
        && addonChargesPending(state.customers.find(c => c.id === activeCustomerId)) <= 0
        && manualBaqayaOutstandingCents(state.customers.find(c => c.id === activeCustomerId)) <= 0) {

        if (typeof onToast === 'function') onToast(t('adv_blocked_paid'), { type: 'error' });
        return;
      }

      // SISP-146: 5-minute double-tap guard — the same customer, amount
      // and method were already logged moments ago. Never a silent
      // block: the operator is asked through the shared themed confirm
      // (Cancel focused by default); confirming sets a one-shot bypass
      // keyed to THIS earlier payment and resubmits, exactly like the
      // duplicate-TID flow above. Cancelling records nothing.
      const recentDuplicate = findRecentDuplicate(state, {
        customerId: activeCustomerId,
        amount: amountVal,
        method: methodVal
      });
      if (recentDuplicate) {
        const bypassKey = duplicatePaymentBypassKey(activeCustomerId, amountVal, methodVal, recentDuplicate);
        if (duplicatePaymentBypassedKey !== bypassKey) {
          askDuplicatePayment(recentDuplicate, formatPKR).then((proceed) => {
            // Plan 437: the prompt's answer settles this save — clear
            // the guard first, so the resubmit below re-arms it fresh
            // and a cancelled prompt leaves the form usable.
            saveGuardHeldForDialog = false;
            doubleTapSaveGuardFinish(saveGuard);
            doubleTapSaveGuardSetDisabled(quickCollectConfirmBtn, false);
            doubleTapSaveGuardSetDisabled(confirmSaveBtn, false);
            if (!proceed) { amountInput?.focus(); return; }
            duplicatePaymentBypassedKey = bypassKey;
            if (typeof paymentForm?.requestSubmit === 'function') paymentForm.requestSubmit();
          });
          saveGuardHeldForDialog = true;
          return;
        }
        duplicatePaymentBypassedKey = null;
      }
      // Plan 397: large cash needs the owner's approval — a cash
      // payment above the operator-set threshold cannot post without
      // the approver's name recorded. Checked here, before the
      // confirm summary, so the operator is sent back to the
      // approver field instead of confirming figures that cannot
      // post; core's validator re-checks it before anything records.
      const largeCashThresholdCents = Math.round((Number(largeCashThresholdInput?.value) || 0) * 100);
      const largeCashApprover = (largeCashApproverInput?.value || '').trim();
      if (requiresLargeCashApproval(isCashPaymentMethod(methodVal), Math.round(amountVal * 100), largeCashThresholdCents) && !largeCashApprover) {
        if (typeof onToast === 'function') onToast('Large cash payments need the owner\'s approval recorded — enter the approver\'s name.', { type: 'error' });
        largeCashApproverInput?.focus();
        return;
      }
      // Plan 536: the split validations run here, before the confirm
      // summary — in the same position as the large-cash check
      // above. A bad split is refused on the form step instead of
      // after the operator confirms figures that cannot post. What
      // is validated is unchanged; only the position moves. The
      // recording stays below the confirm check, so a split still
      // posts only once the figures are confirmed. The leg-2 fields
      // are read here (not inside the split block below), so the
      // validations and the recording read the same values.
      const leg2Method = splitMethodSelect?.value || 'Easypaisa';
      const leg2Amount = Number(splitAmountInput?.value);
      const leg2Txn = (splitTransactionIdInput?.value || '').trim();
      const leg2Override = (splitOverrideReasonInput?.value || '').trim();
      if (splitToggle?.checked) {
        if (advanceCheckbox?.checked) {
          if (typeof onToast === 'function') onToast(t('split_advance_conflict'), { type: 'error' });
          return;
        }
        // The fully-paid guard applies to a split exactly as to a normal
        // collection (a split is two ordinary payments, never advance).
        if (normalPaymentBlockReason(state, activeCustomerId, monthVal) === 'fully-paid'
          && billedTicketChargesPending(loadTickets(), activeCustomerId) <= 0) {
          if (typeof onToast === 'function') onToast(t('adv_blocked_paid'), { type: 'error' });
          return;
        }
        if (isDigitalPaymentMethod(leg2Method) && !leg2Txn && !leg2Override) {
          if (typeof onToast === 'function') onToast(t('split_leg2_tid_required'), { type: 'error' });
          splitTransactionIdInput?.focus();
          return;
        }
        if (leg2Txn) {
          const dup2 = findDuplicatePaymentReference(state, leg2Txn);
          if (dup2 && duplicateBypassedForLeg2Txn !== leg2Txn) {
            const dup2Date = dup2.date || dup2.paymentDate || 'recently';
            const dup2Month = dup2.month || dup2.billMonth || 'unknown';
            const dup2Amt = Number(dup2.amount || 0).toLocaleString('en-PK');
            if (leg2DupCard) {
              // Plan 534: the leg-2 duplicate gets the same in-app
              // card as leg 1, beside the leg-2 TID field — a toast
              // alone hides behind the sheet (Plan 296). Plan 536:
              // this check now runs before the confirm step, so the
              // form step is already showing; the call below stays
              // as a guard, so the card lands on the form step even
              // if the handler is ever entered from another step.
              if (leg2DupMsg) {
                leg2DupMsg.textContent = `Transaction ID "${leg2Txn}" was already recorded on ${dup2Date} for ${dup2.customerName || 'customer'} (#${dup2.customerNumber || '?'}) in month ${dup2Month} (PKR ${dup2Amt}).`;
              }
              if (leg2DupReasonInput) leg2DupReasonInput.value = '';
              syncLeg2DupProceed();
              showStep('form');
              leg2DupCard.hidden = false;
              leg2DupCard.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
              (leg2DupCancelBtn || leg2DupProceedBtn)?.focus(); // Cancel is the safe default (#279)
              return;
            }
            // No card in the page (older markup): the toast is all
            // there is, exactly as before this plan.
            if (typeof onToast === 'function') onToast(`Leg 2 Transaction ID "${leg2Txn}" was already recorded on ${dup2.date || dup2.paymentDate || 'recently'} for ${dup2.customerName || 'a customer'} (#${dup2.customerNumber || '?'}). Give leg 2 its own Transaction ID.`, { type: 'error' });
            splitTransactionIdInput?.focus();
            return;
          }
        }
      }
      // Plan 382: confirm-before-posting — every guard above has
      // passed, so show the summary of the exact figures about to
      // post. The payment posts only after the operator confirms the
      // same figures; any edit after the summary was shown re-shows
      // it with the new figures. A null summary (nothing worth
      // confirming) proceeds exactly as before.
      const pendingSummary = buildSaveConfirmationSummary();
      if (pendingSummary && saveConfirmationSummaryKey(pendingSummary) !== saveConfirmationArmedKey) {
        if (confirmSummaryBox) confirmSummaryBox.innerHTML = saveConfirmationSummaryHtml(pendingSummary);
        // Plan 433: the receipt preview beside the summary, on the
        // same confirm step — the receipt exactly as it will print.
        // Hidden when there is nothing to preview (a split entry has
        // no single receipt).
        if (receiptPreviewBox) {
          const previewHtml = receiptPreviewHtml(buildReceiptPreview());
          receiptPreviewBox.innerHTML = previewHtml;
          receiptPreviewBox.hidden = previewHtml === '';
        }
        showStep('confirm');
        confirmSaveBtn?.focus();
        return;
      }
      saveConfirmationArmedKey = null;
      // SISP-121: split tender — leg 1 is the main form above (its TID
      // checks and duplicate card already ran), leg 2 is the split
      // block. The split validations (Advance conflict, leg-2
      // TID/override, leg-2 duplicate, fully-paid guard) already ran
      // above, before the confirm step (Plan 536), and the leg-2
      // fields were read there. Recording happens ONLY through
      // executeSplitTenderCollection: both legs are validated before
      // either is recorded and the chain is discarded whole on failure.
      if (splitToggle?.checked) {
        // Snapshot the recorder's device-local side effects (audit trail
        // + last-method preference) so a failed split restores them too:
        // the split is all-or-nothing, display log included.
        let auditSnapshot;
        let methodSnapshot;
        try {
          auditSnapshot = localStorage.getItem(QUICK_COLLECT_AUDIT_KEY);
          methodSnapshot = localStorage.getItem(QUICK_COLLECT_STORAGE_KEY);
        } catch { /* storage unavailable — nothing to snapshot */ }
        try {
          const leg1Reference = (duplicateBypassedForTxn && txnIdVal === duplicateBypassedForTxn && (dupReasonInput?.value || '').trim())
            ? (dupReasonInput.value.trim() + (overrideReasonVal ? ` · ${overrideReasonVal}` : ''))
            : overrideReasonVal;
          // Plan 534: leg 2's duplicate reason, exactly like leg 1's
          // above — the card's reason is recorded as leg 2's
          // reference override reason, joined with any override
          // reason the operator typed for leg 2.
          const leg2Reference = (duplicateBypassedForLeg2Txn && leg2Txn === duplicateBypassedForLeg2Txn && (leg2DupReasonInput?.value || '').trim())
            ? (leg2DupReasonInput.value.trim() + (leg2Override ? ` · ${leg2Override}` : ''))
            : leg2Override;
          const splitResult = executeSplitTenderCollection(state, {
            customerId: activeCustomerId,
            month: monthVal,
            date: dateVal,
            paidBy: paidByVal,
            legs: [
              // FU-SISP121-SENDER: leg 1 is the main form, so its sender
              // values are the main SISP-63 inputs (visible when leg 1's
              // method is digital); core keeps them for digital methods
              // only, exactly as in the single-payment submit below.
              { amount: amountVal, method: methodVal, transactionId: txnIdVal, senderTitle: (senderNameInput?.value || '').trim(), senderDigits: (senderDigitsInput?.value || '').trim(), referenceOverrideReason: leg1Reference, screenshot: currentScreenshotDataUrl },
              { amount: leg2Amount, method: leg2Method, transactionId: leg2Txn, senderTitle: (splitSenderNameInput?.value || '').trim(), senderDigits: (splitSenderDigitsInput?.value || '').trim(), referenceOverrideReason: leg2Reference }
            ],
            tickets: loadTickets()
          }, { execute: executeQuickCollection });

          if (splitResult.nextTickets) {
            saveTickets(splitResult.nextTickets);
          }
          const [legReceipt1, legReceipt2] = splitResult.receipts;
          const totalCollected = Math.round((Number(legReceipt1.amount) + Number(legReceipt2.amount)) * 100) / 100;
          activeReceipt = { ...legReceipt2, splitTender: splitResult.combinedReceipt };
          activeUndoContext = {
            customerId: activeCustomerId,
            month: monthVal,
            paymentId: legReceipt2.paymentId,
            amount: totalCollected,
            customerName: legReceipt2.customerName,
            ticketCharges: [],
            splitLegs: [
              { paymentId: legReceipt1.paymentId, ticketCharges: legReceipt1.ticketCharges ?? [] },
              { paymentId: legReceipt2.paymentId, ticketCharges: legReceipt2.ticketCharges ?? [] }
            ]
          };
          if (undoBtn) {
            undoBtn.hidden = false;
            undoBtn.disabled = false;
            undoBtn.textContent = '↩ Undo — deletes this payment (5s)';
          }
          if (undoTimeoutId) clearTimeout(undoTimeoutId);
          undoTimeoutId = setTimeout(() => {
            undoTimeoutId = null;
            activeUndoContext = null;
            stopUndoCountdown();
            if (undoBtn) undoBtn.hidden = true;
            // Plan 532: the note's premise stops being true when the
            // five-second window lapses, so it hides with the button.
            if (reversalUndoNote) reversalUndoNote.hidden = true;
          }, UNDO_WINDOW_MS);
          startUndoCountdown();
          // Plan 435: a split collection records two legs of its own,
          // so it never arms the sixty-second reversal undo — and a
          // stale arming from an earlier single save is dropped here.
          disarmReversalUndo();
          if (typeof onSaveState === 'function') {
            onSaveState(splitResult.nextState);
          }
          if (typeof onToast === 'function') {
            onToast(t('split_saved_msg', null, { amount: totalCollected.toLocaleString('en-PK') }), {
              type: 'success',
              title: 'Payment recorded',
              actionLabel: 'Undo',
              onAction: () => {
                executeUndo();
              },
              duration: UNDO_WINDOW_MS
            });
          }
          renderActiveReceiptCard();
          applyPackageSuccessMessage(totalCollected);
          renderSuccessNextSteps();
          renderRepeatPayment();
          renderStillOwesLine();
          renderOfflineSavedBadge();
          renderSettleStatusBadge();
          renderReceiptShareDraft();
          renderSuccessPendingClearanceFlag();
          showStep('success');
          updateCounts();
          announcePaymentSuccess(activeReceipt);
          setTimeout(() => {
            const successHeading = document.getElementById('quickCollectSuccessHeading') || whatsAppBtn;
            successHeading?.focus();
          }, 60);
        } catch (splitErr) {
          try {
            if (auditSnapshot === null || auditSnapshot === undefined) localStorage.removeItem(QUICK_COLLECT_AUDIT_KEY);
            else localStorage.setItem(QUICK_COLLECT_AUDIT_KEY, auditSnapshot);
            if (methodSnapshot === null || methodSnapshot === undefined) localStorage.removeItem(QUICK_COLLECT_STORAGE_KEY);
            else localStorage.setItem(QUICK_COLLECT_STORAGE_KEY, methodSnapshot);
          } catch { /* ignore storage issues */ }
          if (typeof onToast === 'function') onToast(splitErr.message || t('split_not_saved_toast'), { type: 'error' });
        }
        return;
      }

      // Plan 386: the overpayment choice for this payment — the radio
      // picked for the extra over the customer's shared payable
      // figure, read live at submit from the same figure the render
      // offered the choice over (activeDefaults.payableTotal), so a
      // figure typed after the last render still counts and the
      // validator's extra matches the extra the operator saw. Plan
      // 523: the recorded dues are the payable figure, never bill
      // dues alone. The validator re-checks it before anything
      // records. Only the single-payment path carries it; a split
      // payment records two ordinary legs of its own.
      let selectedOverpaymentChoice = '';
      let overpaymentDuesCents = 0;
      {
        // The radios live inside the choice box, so the checked one
        // is read through the box itself (null on hosts that predate
        // the box, and null in the test stub whose elements answer
        // no checked radio) — never through the bare document.
        const picked = overpaymentChoiceBox?.querySelector('input[name="quickCollectOverpaymentChoice"]:checked') ?? null;
        selectedOverpaymentChoice = picked?.value || '';
        if (selectedOverpaymentChoice) {
          overpaymentDuesCents = Math.round(Number(activeDefaults?.payableTotal ?? 0) * 100);
        }
      }
      // Plan 395: the excess cash note for this payment — the purpose
      // picked for the extra over the customer's total dues, read live
      // at submit from the same allocation state the preview reads,
      // so a figure typed after the last render still counts. The
      // validator re-checks it before anything records. Only the
      // single-payment path carries it; a split payment records two
      // ordinary legs of its own.
      let selectedExcessCashPurpose = '';
      let excessCashDuesCents = 0;
      {
        selectedExcessCashPurpose = excessCashPurposeSelect?.value || '';
        if (selectedExcessCashPurpose) {
          const submitAllocations = calculatePaymentAllocations(state);
          const submitCustomer = state?.customers?.find((c) => c.id === activeCustomerId) ?? null;
          for (const bill of (submitCustomer?.bills ?? [])) {
            const remaining = submitAllocations.forMonth(activeCustomerId, bill.month)?.balanceDueCents ?? 0;
            if (remaining > 0) excessCashDuesCents += remaining;
          }
        }
      }
      const { nextState, receipt, nextTickets } = executeQuickCollection(state, {
        customerId: activeCustomerId,
        month: monthVal,
        amount: amountVal,
        date: dateVal,
        method: methodVal,
        // SISP-101: the waiver tick (never on an advance collection —
        // executeQuickCollection refuses that combination outright).
        waiveLateFee: waiverTicked && !advanceCheckbox?.checked,
        kind: advanceCheckbox?.checked ? 'advance' : undefined,
        advanceTargetMonth: advanceCheckbox?.checked ? (advanceTargetSelect?.value || undefined) : undefined,
        paidBy: paidByVal,
        collectedBy: collectedByVal || undefined,
        collectionPlace: collectionPlaceVal || undefined,
        collectionMohalla: collectionMohallaVal || undefined,
        urduNote: urduNoteVal || undefined,
        crossPayment: crossPaymentVal || undefined,
        overpaymentChoice: selectedOverpaymentChoice || undefined,
        overpaymentDuesCents: selectedOverpaymentChoice ? overpaymentDuesCents : undefined,
        excessCashNote: selectedExcessCashPurpose || undefined,
        excessCashDuesCents: selectedExcessCashPurpose ? excessCashDuesCents : undefined,
        largeCashApproval: largeCashApprover || undefined,
        largeCashThresholdCents: largeCashThresholdCents,
        categoryTag: categoryTagVal || undefined,
        promiseLink: promiseLinkVal ? { promiseId: promiseLinkVal } : undefined,
        paidByContributorId: contributorSelect && contributorField && !contributorField.hidden ? (contributorSelect.value || undefined) : undefined,
        transactionId: txnIdVal,
        senderTitle: (senderNameInput?.value || '').trim(),
        senderDigits: (senderDigitsInput?.value || '').trim(),
        referenceOverrideReason: (duplicateBypassedForTxn && txnIdVal === duplicateBypassedForTxn && (dupReasonInput?.value || '').trim()) ? (dupReasonInput.value.trim() + (overrideReasonVal ? ` · ${overrideReasonVal}` : '')) : overrideReasonVal,
        screenshot: currentScreenshotDataUrl,
        // SISP-126: the armed remainder-waada chip date (null unless the
        // collector tapped a date chip — Skip / untouched writes nothing).
        remainderWaadaDate: selectedRemainderWaadaDate || undefined,
        // SISP-43: the live ticket list, so billed ticket charges can
        // settle inside this same collection (see executeQuickCollection).
        tickets: loadTickets()
      });

      // SISP-43: persist the settled tickets BEFORE the ledger state —
      // if this write fails, the whole submit aborts and nothing is
      // half-saved (the payment exists only in the unsaved nextState).
      if (nextTickets) {
        saveTickets(nextTickets);
      }

      activeReceipt = receipt;
      activeUndoContext = {
        customerId: activeCustomerId,
        month: monthVal,
        paymentId: receipt.paymentId,
        amount: amountVal,
        customerName: receipt.customerName,
        ticketCharges: receipt.ticketCharges ?? [],
        addonCharges: receipt.addonCharges ?? []
      };

      if (undoBtn) {
        undoBtn.hidden = false;
        undoBtn.disabled = false;
        undoBtn.textContent = '↩ Undo — deletes this payment (5s)';
      }

      if (undoTimeoutId) clearTimeout(undoTimeoutId);
      undoTimeoutId = setTimeout(() => {
        undoTimeoutId = null;
        activeUndoContext = null;
        stopUndoCountdown();
        if (undoBtn) undoBtn.hidden = true;
        // Plan 532: the note's premise stops being true when the
        // five-second window lapses, so it hides with the button.
        if (reversalUndoNote) reversalUndoNote.hidden = true;
      }, UNDO_WINDOW_MS);
      startUndoCountdown();

      // Plan 435: arm the sixty-second reversal undo for this one
      // plain single payment. The saved payment record comes from
      // the just-computed next state, because the host state is not
      // updated until onSaveState runs below.
      {
        const savedPayment = nextState?.customers?.find((c) => c.id === activeCustomerId)?.bills?.find((b) => b.month === monthVal)?.payments?.find((p) => p.id === receipt.paymentId) ?? null;
        armReversalUndo({
          customerId: activeCustomerId,
          month: monthVal,
          paymentId: receipt.paymentId,
          amount: amountVal,
          customerName: receipt.customerName,
          savedPayment,
          ticketCharges: receipt.ticketCharges ?? [],
          addonCharges: receipt.addonCharges ?? [],
        });
      }

      // Update parent application state
      if (typeof onSaveState === 'function') {
        onSaveState(nextState);
      }

      // SISP-141: when the host provides onCollected, the floating
      // 10-second undo toast is owned by the host-level presenter —
      // it survives this dialog closing, which this sheet's own toast
      // cannot promise (its undo context is cleared on close). The
      // in-dialog Undo button above keeps working either way, through
      // the same deletePayment seam. Without a host hook, the legacy
      // 5-second in-toast Undo below is exactly as before.
      if (typeof onCollected === 'function') {
        onCollected({
          customerId: activeCustomerId,
          month: monthVal,
          paymentId: receipt.paymentId,
          amount: amountVal,
          customerName: receipt.customerName
        });
      } else if (typeof onToast === 'function') {
        onToast(`Payment of PKR ${amountVal.toLocaleString()} recorded.`, {
          type: 'success',
          title: 'Payment recorded',
          actionLabel: 'Undo',
          onAction: () => {
            executeUndo();
          },
          duration: UNDO_WINDOW_MS
        });
      }

      // Render success screen
      renderActiveReceiptCard();
      applyPackageSuccessMessage(receipt.amount);
      renderSuccessNextSteps();
      renderRepeatPayment();
      renderStillOwesLine();
      renderOfflineSavedBadge();
      renderSettleStatusBadge();
      renderReceiptShareDraft();
      renderSuccessPendingClearanceFlag();
      // Plan 449: a fresh pass offers the second connection again —
      // the flag from any earlier pass in this opening never carries
      // over into the new receipt's step.
      secondConnectionRecorded = false;
      renderSecondConnectionStep();

      showStep('success');
      updateCounts();

      // Accessible screen reader announcement and programmatic focus
      announcePaymentSuccess(receipt);
      setTimeout(() => {
        const successHeading = document.getElementById('quickCollectSuccessHeading') || whatsAppBtn;
        successHeading?.focus();
      }, 60);

    } catch (err) {
      if (typeof onToast === 'function') {
        onToast(err.message, { type: 'error' });
      }
    } finally {
      // Plan 437: the save has settled (posted, refused, or thrown) —
      // clear the guard and re-enable the save buttons, unless a
      // duplicate prompt is still waiting for the operator's answer.
      if (!saveGuardHeldForDialog) {
        doubleTapSaveGuardFinish(saveGuard);
        doubleTapSaveGuardSetDisabled(quickCollectConfirmBtn, false);
        doubleTapSaveGuardSetDisabled(confirmSaveBtn, false);
      }
    }
  });

  // #297: a missing phone is a warning, with a shortcut to add the number to the customer's profile.
  function warnNoPhone(message) {
    if (typeof onToast !== 'function') return;
    const customerId = activeReceipt?.customerId;
    const opts = { type: 'warning', title: 'No phone number' };
    if (customerId && typeof onEditCustomer === 'function') {
      opts.actionLabel = 'Add phone';
      opts.onAction = () => {
        closeModal();
        // Let the dialog's own history entry go back first, then open the profile editor.
        setTimeout(() => onEditCustomer(customerId, { focus: 'phone' }), 350);
      };
    }
    onToast(message, opts);
  }

  // WhatsApp receipt dispatch
  whatsAppBtn?.addEventListener('click', async () => {
    if (!activeReceipt) return;
    // SISP-118: resolve the receipt owner's WhatsApp number from live state.
    // SISP-91: render the draft in the customer's saved receipt
    // language when set (the preference wins over the default draft).
    const receiptCustomer = getState()?.customers?.find(c => c.id === activeReceipt.customerId);
    // SISP-121: a split collection shares the COMBINED receipt text
    // (both legs, both real receipt numbers, one total).
    const { url, text } = activeReceipt.splitTender
      ? (() => {
          const splitText = formatSplitTenderWhatsAppText(activeReceipt.splitTender);
          const wa = formatWhatsAppUrl(activeReceipt.phone, splitText);
          return { url: wa.url || '', text: splitText };
        })()
      : formatQuickCollectWhatsAppReceipt(activeReceipt, { whatsappPhone: receiptCustomer ? whatsappPhoneFor(receiptCustomer) : '', lang: receiptLangPreference(receiptCustomer) });
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      markReceiptShared(activeReceipt.id, {
        method: 'whatsapp',
        phone: activeReceipt.phone,
        customerId: activeReceipt.customerId,
        amount: activeReceipt.amount
      });
      if (typeof onToast === 'function') {
        onToast('WhatsApp receipt draft opened.', { type: 'info' });
      }
    } else {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          markReceiptShared(activeReceipt.id, {
            method: 'clipboard',
            phone: '',
            customerId: activeReceipt.customerId,
            amount: activeReceipt.amount
          });
          warnNoPhone('No phone saved for this customer. The receipt text was copied to the clipboard instead.');
        } catch {
          warnNoPhone('No phone number saved for this customer.');
        }
      } else {
        warnNoPhone('No phone number saved for this customer.');
      }
    }

    renderActiveReceiptCard();
  });

  // Share Receipt as Image / PNG download
  shareImageBtn?.addEventListener('click', async () => {
    if (!activeReceipt) return;
    try {
      // SISP-121: the canvas slip shows the split TOTAL and both leg
      // methods (the combined card/HTML carries the full per-leg detail).
      const imageReceipt = activeReceipt.splitTender
        ? {
            ...activeReceipt,
            amount: activeReceipt.splitTender.totalReceived,
            method: activeReceipt.splitTender.legs.map(leg => leg.method).join(' + '),
            transactionId: activeReceipt.splitTender.legs.find(leg => leg.transactionId)?.transactionId || ''
          }
        : activeReceipt;
      const blob = await generateReceiptImageBlob(imageReceipt);
      if (!blob) {
        if (typeof onToast === 'function') onToast('Receipt image creation is not supported in this environment.', { type: 'warning' });
        return;
      }
      const filename = `receipt-${activeReceipt.receiptNumber || 'slip'}.png`;
      const file = (typeof File === 'function') ? new File([blob], filename, { type: 'image/png' }) : null;

      let shared = false;
      if (file && typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Payment Receipt ${activeReceipt.receiptNumber}`,
            text: `Receipt for ${activeReceipt.customerName} - PKR ${Number(activeReceipt.amount).toLocaleString('en-PK')}`,
            files: [file]
          });
          shared = true;
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') return;
        }
      }

      if (!shared) {
        if (typeof URL !== 'undefined' && typeof document !== 'undefined') {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      }

      markReceiptShared(activeReceipt.id, {
        method: 'image',
        phone: activeReceipt.phone,
        customerId: activeReceipt.customerId,
        amount: activeReceipt.amount
      });

      renderActiveReceiptCard();

      if (typeof onToast === 'function') {
        onToast('Receipt image ready (downloaded / shared).');
      }
    } catch (err) {
      if (typeof onToast === 'function') onToast(`Share failed: ${err.message}`, { type: 'error' });
    }
  });

  // Print slip
  printReceiptBtn?.addEventListener('click', () => {
    window.print?.();
  });

  // #226: Bluetooth thermal print of the just-collected receipt. The button
  // stays hidden when Web Bluetooth is unavailable (system print remains).
  const bluetoothPrintBtn = document.getElementById('quickCollectBluetoothPrintBtn');
  if (bluetoothPrintBtn) {
    bluetoothPrintBtn.hidden = !isWebBluetoothAvailable();
    bluetoothPrintBtn.addEventListener('click', async () => {
      if (!activeReceipt) {
        if (typeof onToast === 'function') onToast('No receipt to print yet.', { type: 'error' });
        return;
      }
      try {
        if (!thermalPrinter.isConnected()) await thermalPrinter.connect();
        const money = (v) => `PKR ${Number(v || 0).toLocaleString('en-PK')}`;
        // SISP-121: a split collection prints the combined total with
        // one line per leg (the leg lines ride the slip's extra-lines
        // slot, the same channel SISP-43 ticket charges use).
        const split = activeReceipt.splitTender || null;
        const { bytes } = buildEscPosReceipt({
          businessName: 'Shahdara ISP',
          receiptNumber: activeReceipt.receiptNumber || '',
          customerName: activeReceipt.customerName || '',
          customerNumber: activeReceipt.customerNumber ? String(activeReceipt.customerNumber) : '',
          monthLabel: activeReceipt.month || '',
          dateTimeLabel: activeReceipt.date || '',
          amount: money(split ? split.totalReceived : activeReceipt.amount),
          method: split ? 'Split' : (activeReceipt.method || ''),
          reference: split ? (split.legs.find(leg => leg.transactionId)?.transactionId || '') : (activeReceipt.transactionId || ''),
          // SISP-43: settled ticket charges print on the slip too.
          // Owner feature (2026-10-29): settled manual baqaya rides the
          // same slip rows with its own short label.
          ticketCharges: split
            ? split.legs.map(leg => ({
                label: `${t('split_leg_label', null, { leg: leg.leg })} · ${leg.method}`,
                value: money(leg.amount)
              }))
            : [
            ...(activeReceipt.ticketCharges ?? []).map(line => ({
              label: `Murammat (${line.ticketId})`,
              value: money(line.amount)
            })),
            ...(activeReceipt.manualBaqayaSettlements ?? []).map(line => ({
              label: `Baqaya (${line.entryId})`,
              value: money(line.amount)
            }))
          ],
          // SISP-106: settled boost fees print on the slip too.
          addonCharges: (activeReceipt.addonCharges ?? []).map(line => ({
            label: `Boost (${line.boostId})`,
            value: money(line.amount)
          })),
          // SISP-126: the remainder waada line prints on the slip too.
          remainderWaadaLine: formatRemainderWaadaLine(activeReceipt) ?? '',
          // SISP-96: owner-configured footer lines on the slip too.
          footerLines: buildReceiptFooterLines(getReceiptFooter()),

          balanceDue: money(split ? split.balanceDueCents / 100 : (activeReceipt.payableRemaining ?? activeReceipt.newBalanceDue)),
          statusLabel: split ? split.status : (activeReceipt.isSettled ? 'PAID' : 'PARTIAL')
        });
        await thermalPrinter.print(bytes);
        if (typeof onToast === 'function') onToast('Receipt sent to the Bluetooth printer.');
      } catch (err) {
        if (typeof onToast === 'function') onToast(`Bluetooth print failed: ${err?.message || err}`, { type: 'error' });
      }
    });
  }

  // Collect Another loop
  anotherBtn?.addEventListener('click', () => {
    if (undoTimeoutId) {
      clearTimeout(undoTimeoutId);
      undoTimeoutId = null;
    }
    stopUndoCountdown();
    activeUndoContext = null;
    if (undoBtn) undoBtn.hidden = true;
    // Plan 435: looping back to the picker drops the reversal undo
    // with the rest of the save — the next save arms its own.
    disarmReversalUndo();
    showStep('pick');
    if (searchInput) searchInput.value = '';
    activeCustomerId = null;
    activeDefaults = null;
    activeReceipt = null;
    // Plan 449: looping back to the picker drops the second-connection
    // step with the rest of the save — the next save offers it afresh.
    secondConnectionRecorded = false;
    hideSecondConnectionStep();
    renderList();
    searchInput?.focus();
  });

  // Done button
  doneCloseBtn?.addEventListener('click', closeModal);
  closeBtn?.addEventListener('click', closeModal);

  // Link to full transactions view
  goToTransactionsBtn?.addEventListener('click', () => {
    closeModal();
    const navCollectionBtn = document.querySelector('[data-mobile-nav="collection"]');
    const txView = document.getElementById('transactionsView');
    if (txView) {
      // Switch view and scroll
      const custView = document.getElementById('customersView');
      if (custView) custView.hidden = true;
      txView.hidden = false;
      txView.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // Plan 426: the one-screen payment entry on the picker step — the
  // modal is already open, so this only switches steps.
  openOneScreenBtn?.addEventListener('click', () => { openOneScreen(); });

  // Plan 448: the end-of-day summary button on the picker step —
  // opening renders the summary from the fresh state, and the Close
  // button inside the panel hides it again. The Close listener is
  // delegated on the panel itself, so it survives every re-render.
  endOfDaySummaryBtn?.addEventListener('click', () => { toggleEndOfDaySummary(); });
  endOfDaySummaryEl?.addEventListener('click', (event) => {
    if (event?.target?.id === 'edsEndOfDaySummaryClose') {
      endOfDaySummaryEl.hidden = true;
      endOfDaySummaryBtn?.setAttribute('aria-expanded', 'false');
    }
  });

  // Plan 450: the new-customer quick-add on the picker step — the
  // button toggles the form; submit and cancel are delegated on the
  // form itself, so they survive every re-render of the fields.
  newCustomerBtn?.addEventListener('click', () => { toggleNewCustomerForm(); });
  newCustomerForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    submitNewCustomerQuickAdd();
  });
  newCustomerForm?.addEventListener('click', (event) => {
    if (event?.target?.id === 'ncaCancelButton') {
      newCustomerForm.hidden = true;
      newCustomerBtn?.setAttribute('aria-expanded', 'false');
      newCustomerBtn?.focus();
    }
  });

  // Wire bottom nav & More menu Collection tab triggers
  document.querySelectorAll('[data-mobile-nav="collection"], [data-mobile-more="collection"]').forEach(btn => {
    if (btn.dataset.wiredQuickCollect) return;
    btn.dataset.wiredQuickCollect = 'true';
    btn.addEventListener('click', (e) => {
      // Intercept on mobile/touch, open Quick Collect
      e.preventDefault();
      openModal();
    });
  });

  // Wire Quick Actions button if present
  document.querySelectorAll('[data-open-quick-collect]').forEach(btn => {
    if (btn.dataset.wiredQuickCollect) return;
    btn.dataset.wiredQuickCollect = 'true';
    btn.addEventListener('click', () => openModal());
  });

  return {
    open: openModal,
    close: closeModal,
    selectAndOpen: openCustomerCollectionForm,
    openOneScreen,
    isOpen: () => modal.hasAttribute('open') || modal.open,
    // Used by bulk-collect.js: read the live state and save through the same path as a single collection.
    getState: () => getState(),
    commitState: (nextState) => {
      if (typeof onSaveState === 'function') onSaveState(nextState);
      updateCounts();
      renderList();
    },
    refresh: () => { updateCounts(); renderList(); }
  };
}
