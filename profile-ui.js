import { PAYMENT_METHODS, calculatePaymentAllocations, derivedBillStatus, formatPKR, listTransactions, nextCycleDueDateFromBillMonth, searchCustomers } from './core.js';
import { arrearsBreakdownTextLines, fifoRemainingForBill, fifoTextLines } from './billing-cycle.js';
import { sanitizePauseFields, vacationHoldState } from './pause-billing.js';
import { normalizeGpsPin, googleMapsUrl, formatGpsCoords } from './gps-pin-helper.js';
import { buildVacationHoldDisableSnippet, buildVacationHoldEnableSnippet } from './mikrotik-generator.js';
import { getAppLanguage, t } from './nav-language.js';
import { paymentDayHabit } from './payment-day-advisor.js';
import { earlyPayoffAmount, sanitizeInstallmentPlan } from './installment-plan.js';
import { prepaidUntilMonth } from './advance-prepay.js';
import { addonChargesPending, speedBoostStatus, speedBoostsOf } from './speed-addon.js';
import { loyaltyInfoForCustomer } from './loyalty-retention.js';
import { isCommercialVip } from './commercial-sla.js';

import { referralEntriesForReferrer, referralTotalsForReferrer } from './referral-credits.js';
import { depositSettlementOf, depositSettlementQuote, isDisconnected } from './hardware-custody.js';
import { disconnectDetailsOf, disconnectReasonLabel } from './churn-winback.js';
import { computeWaadaScore } from './waada-queue.js';
import { activeDownstreamCount, feederHostCreditOf, isFeederHost } from './feeder-host-credit.js';
import { activeBadDebtFor, badDebtWriteOffQuote } from './bad-debt-ledger.js';
import { receiptLangPreference, sanitizeReceiptLang } from './receipt-preferences.js';
import { helpButtonMarkup } from './help-guide.js';

const BILL_STATUS = Object.freeze({
  paid: { label:'Paid', className:'status-received' },
  pending: { label:'Pending', className:'status-pending' },
  partial: { label:'Partial', className:'status-partial' },
  'not-set': { label:'Not set', className:'status-empty' }
});
const normalisePhoneSyntax = phone => String(phone ?? '').trim().replace(/[\s().-]/g, '');
const validCalendarDate = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const validMonth = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value ?? ''));
const formatReceiptDate = value => {
  if (!validCalendarDate(value)) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(12, 0, 0, 0);
  return new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'UTC' }).format(date).replace(',', '');
};
const formatReceiptMonth = value => validMonth(value)
  ? new Intl.DateTimeFormat('en-US', { month:'short', year:'numeric', timeZone:'UTC' }).format(new Date(`${value}-01T00:00:00Z`))
  : null;
const receiptMonthDate = (month, day) => validMonth(month) ? `${month}-${String(day).padStart(2, '0')}` : null;
const safeLine = (value, limit = 120) => String(value ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, limit);

/** Present only a saved bill and the balance computed from existing payment allocations. */
export function currentBillPresentation(customer, month, allocations) {
  const bill = (customer?.bills ?? []).find(item => item.month === month) ?? null;
  const amount = bill?.dueAmount;
  const hasBillAmount = amount !== null && amount !== undefined && amount !== '' && Number.isFinite(Number(amount)) && Number(amount) > 0;
  const status = derivedBillStatus(customer, bill, allocations);
  const summary = allocations?.forMonth?.(customer?.id, month);
  const balanceDueCents = summary?.balanceDueCents ?? null;
  const receivedAmount = bill ? (bill.payments ?? []).filter((payment) => payment?.voided !== true).reduce((sum, payment) => sum + Number(payment.amount || 0), 0) : 0;
  const statusPresentation = BILL_STATUS[status] ?? BILL_STATUS['not-set'];

  return {
    month,
    billAmount: hasBillAmount ? Number(amount) : null,
    billAmountLabel: hasBillAmount ? formatPKR(Number(amount)) : 'Not set',
    status,
    statusLabel: statusPresentation.label,
    statusClassName: statusPresentation.className,
    receivedAmount,
    receivedAmountLabel: bill?.payments?.length ? formatPKR(receivedAmount) : 'No receipts',
    receiptCount: bill?.payments?.length ?? 0,
    balanceDueCents,
    balanceDueLabel: balanceDueCents === null ? 'Not set' : formatPKR(balanceDueCents / 100),
    // SISP-33: remaining FIFO split (arrears / package / kist) for this
    // bill month, derived from saved payments. Null when the bill is
    // unpriced. The profile renderer shows the strip only when the split
    // is meaningful (arrears or kist present).
    fifo: fifoRemainingForBill(customer, bill)
  };
}

/** Cross-search matching customers and their saved bill/payment detail, irrespective of customer-list filters. */
export function buildGlobalLedgerSearch(state, query, month) {
  const normalized = String(query ?? '').normalize('NFKC').trim();
  if (!normalized) return [];
  const allocations = calculatePaymentAllocations(state);
  const allTransactions = listTransactions(state);
  const matchingTransactions = listTransactions(state, { customerQuery:normalized });
  return searchCustomers(state, normalized).map(customer => {
    const receipts = allTransactions.filter(row => row.customerId === customer.id);
    const matchedReceiptIds = new Set(matchingTransactions.filter(row => row.customerId === customer.id).map(row => row.paymentId));
    const orderedReceipts = [...receipts].sort((a, b) => Number(matchedReceiptIds.has(b.paymentId)) - Number(matchedReceiptIds.has(a.paymentId)) || b.date.localeCompare(a.date) || a.paymentId.localeCompare(b.paymentId));
    return {
      customer,
      billing:currentBillPresentation(customer, month, allocations),
      receipts:orderedReceipts.slice(0, 3),
      receiptCount:receipts.length,
      matchingReceiptCount:receipts.filter(row => matchedReceiptIds.has(row.paymentId)).length
    };
  });
}

/** Build call and WhatsApp targets without guessing a country code or accepting extension/URL syntax. */
export function contactActionTargets(phone) {
  const compact = normalisePhoneSyntax(phone);
  if (!/^\+?\d{3,20}$/.test(compact)) return null;
  const explicitInternational = /^\+?[1-9]\d{7,14}$/.test(compact);
  return {
    tel:`tel:${compact}`,
    whatsapp:explicitInternational ? `https://wa.me/${compact.replace(/^\+/, '')}` : null
  };
}

/** Build a user-reviewed customer follow-up draft; this helper never opens or sends WhatsApp. */
export function createWhatsAppFollowupDraft(phone, customer, details, template = 'friendly') {
  const target = contactActionTargets(phone)?.whatsapp;
  const name = safeLine(customer?.name);
  const outstanding = Number(details?.outstanding);
  const previousBalance = Number(details?.previousBalance ?? 0);
  const dueDate = validCalendarDate(details?.dueDate) ? formatReceiptDate(details.dueDate) : 'Not recorded';
  const packageName = safeLine(details?.packageName, 80) || 'Not recorded';
  if (!target || !name || !Number.isFinite(outstanding) || outstanding < 0 || !Number.isFinite(previousBalance) || previousBalance < 0) return null;
  const paymentAmount = Number(details?.paymentAmount);
  const paymentDate = String(details?.paymentDate ?? '');
  if (template === 'payment-confirmation' && (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || !validCalendarDate(paymentDate))) return null;
  const linesByTemplate = {
    friendly:[`Assalamu alaikum ${name},`, '', `This is a friendly reminder about your Shahdara ISP bill.`, `Outstanding balance: ${formatPKR(outstanding)}`, `Previous balance: ${formatPKR(previousBalance)}`, `Due date: ${dueDate}`, `Package: ${packageName}`, '', `If you have already paid, please let us know so we can check the local record. Thank you.`],
    overdue:[`Assalamu alaikum ${name},`, '', `Our saved record shows an overdue Shahdara ISP balance of ${formatPKR(outstanding)}.`, `Previous balance: ${formatPKR(previousBalance)}`, `Due date: ${dueDate}`, `Package: ${packageName}`, '', `Please let us know if you have already paid, or contact us to discuss the balance. Thank you.`],
    final:[`Assalamu alaikum ${name},`, '', `Final reminder from Shahdara ISP regarding the saved outstanding balance of ${formatPKR(outstanding)}.`, `Previous balance: ${formatPKR(previousBalance)}`, `Due date: ${dueDate}`, `Package: ${packageName}`, '', `Please contact us to settle the balance or tell us if your payment is missing from our records. Thank you.`],
    'payment-confirmation':[`Assalamu alaikum ${name},`, '', `We confirm that a payment of ${formatPKR(paymentAmount)} was recorded on ${formatReceiptDate(paymentDate)} for your Shahdara ISP account.`, `Remaining balance: ${formatPKR(outstanding)}`, `Previous balance: ${formatPKR(previousBalance)}`, `Due date: ${dueDate}`, `Package: ${packageName}`, '', `Thank you.`]
  };
  const lines = linesByTemplate[template];
  if (!lines) return null;
  const message = lines.join('\n');
  return { url:`${target}?text=${encodeURIComponent(message)}`, message };
}

/** Return a user-reviewed wa.me composer URL for one saved receipt; never sends a message. */
// SISP-91: the draft renders in the customer's saved receipt language
// (preferredReceiptLang) when one is set — the preference wins over the
// UI language and over this builder's English default. With no saved
// preference (or 'english') the English text below is byte-identical to
// the pre-SISP-91 draft. The SISP-2 breakdown and SISP-33 FIFO lines
// come from the shared billing-cycle helpers in every language, exactly
// as before; dates, PKR amounts and method names keep their formats.
const RECEIPT_DRAFT_TEXT = Object.freeze({
  english: {
    header: '🧾 SHAHDARA ISP — PAYMENT RECEIPT',
    customer: '👤 Customer', customerNumber: '🆔 Customer #', paidBy: 'Paid by',
    amountPaid: '💰 Amount Paid', amountReceived: '💰 Amount Received',
    receivedDate: '📅 Received date', method: '💳 Method', billingMonth: '📆 Billing Month',
    packageDate: '📦 Package date', renewalNote: '(renewal day: 1st of every month)',
    breakdownHeading: '📋 Bill breakdown:', fifoHeading: '💠 FIFO taqseem:',
    ticketCharge: (ticketId) => `🔧 Murammat / Material Charge (${ticketId})`,
    statusPaid: '✅ Status: PAID', statusPartial: '🟠 Status: PARTIAL',
    outstanding: '💵 Outstanding', outstandingZero: '💵 Outstanding: PKR 0',
    nextBillDue: '📅 Next Bill Due', billAmount: '💳 Bill Amount', currentBillDue: '📅 Current Bill Due',
    payBy5: '⚠️ Please pay by the 5th to avoid service interruption. thanks 🥰',
    notAvailable: 'Not available', notRecorded: 'Not recorded'
  },
  urdu: {
    header: '🧾 شاہدرہ آئی ایس پی — ادائیگی کی رسید',
    customer: '👤 صارف', customerNumber: '🆔 صارف نمبر', paidBy: 'ادا کنندہ',
    amountPaid: '💰 رقم ادا شدہ', amountReceived: '💰 رقم موصول',
    receivedDate: '📅 وصولی کی تاریخ', method: '💳 طریقہ ادائیگی', billingMonth: '📆 بل کا مہینہ',
    packageDate: '📦 پیکیج کی تاریخ', renewalNote: '(تجدید ہر مہینے کی 1 تاریخ کو)',
    breakdownHeading: '📋 بل کی تفصیل:', fifoHeading: '💠 فائیفو تقسیم:',
    ticketCharge: (ticketId) => `🔧 مرمت / سامان چارج (${ticketId})`,
    statusPaid: '✅ کیفیت: مکمل ادا شدہ', statusPartial: '🟠 کیفیت: جزوی ادائیگی',
    outstanding: '💵 بقایا رقم', outstandingZero: '💵 بقایا رقم: PKR 0',
    nextBillDue: '📅 اگلے بل کی آخری تاریخ', billAmount: '💳 بل کی رقم', currentBillDue: '📅 موجودہ بل کی آخری تاریخ',
    payBy5: '⚠️ سروس کی بندش سے بچنے کے لیے ہر مہینے کی 5 تاریخ تک ادائیگی فرمائیں۔ شکریہ 🥰',
    notAvailable: 'دستیاب نہیں', notRecorded: 'درج نہیں'
  },
  roman: {
    header: '🧾 SHAHDARA ISP — ADAIGI KI RASEED',
    customer: '👤 Customer', customerNumber: '🆔 Customer #', paidBy: 'Ada karne wala',
    amountPaid: '💰 Raqam Ada', amountReceived: '💰 Raqam Wasool',
    receivedDate: '📅 Wasooli ki tareekh', method: '💳 Tareeqa-e-Adaigi', billingMonth: '📆 Bill ka maheena',
    packageDate: '📦 Package ki tareekh', renewalNote: '(tajdeed har maheenay ki 1 tareekh ko)',
    breakdownHeading: '📋 Bill ki tafseel:', fifoHeading: '💠 FIFO taqseem:',
    ticketCharge: (ticketId) => `🔧 Murammat / Material Charge (${ticketId})`,
    statusPaid: '✅ Status: MUKAMMAL ADA SHUDA', statusPartial: '🟠 Status: JUZWI ADAIGI',
    outstanding: '💵 Baqaya raqam', outstandingZero: '💵 Baqaya raqam: PKR 0',
    nextBillDue: '📅 Aglay bill ki aakhri tareekh', billAmount: '💳 Bill ki raqam', currentBillDue: '📅 Mojooda bill ki aakhri tareekh',
    payBy5: '⚠️ Service bandish se bachne ke liye har maheenay ki 5 tareekh tak adaigi kar dein. Shukriya 🥰',
    notAvailable: 'Dastiyab nahi', notRecorded: 'Darj nahi'
  }
});

export function createReceiptWhatsAppDraft(phone, receipt, options = {}) {
  const target = contactActionTargets(phone)?.whatsapp;
  const amount = Number(receipt?.amount);
  const name = safeLine(receipt?.customerName);
  const method = safeLine(receipt?.method, 40);
  const customerNumber = Number(receipt?.customerNumber);
  const date = String(receipt?.date ?? '');
  const month = String(receipt?.month ?? '');
  if (!target || !name || !Number.isSafeInteger(customerNumber) || customerNumber < 1 || !Number.isFinite(amount) || amount <= 0 || !validCalendarDate(date) || !validMonth(month) || !PAYMENT_METHODS.includes(method)) return null;

  const lang = sanitizeReceiptLang(options.lang ?? receipt?.receiptLang);
  const L = RECEIPT_DRAFT_TEXT[lang] ?? RECEIPT_DRAFT_TEXT.english;
  // The default/English layout keeps its long-standing literal lines
  // verbatim (tests/deployment.test.js source-pins them); the urdu and
  // roman layouts render the same lines through the dictionary above.
  const englishLayout = lang !== 'urdu' && lang !== 'roman';
  const billAmount = Number(receipt?.billAmount);
  const balanceDueCents = Number(receipt?.balanceDueCents);
  const hasBillContext = Number.isFinite(billAmount) && billAmount > 0 && Number.isSafeInteger(balanceDueCents) && balanceDueCents >= 0;
  const requestedStatus = receipt?.billStatus ?? receipt?.status;
  const billStatus = hasBillContext
    ? requestedStatus === 'paid' && balanceDueCents === 0 ? 'paid'
      : requestedStatus === 'partial' && balanceDueCents > 0 ? 'partial'
        : null
    : null;
  const paidBy = safeLine(receipt?.paidBy, 100);
  const packageDate = formatReceiptDate(receiptMonthDate(month, 1)) ?? L.notAvailable;
  const lines = [
    L.header,
    '',
    `${L.customer}: ${name}`,
    `${L.customerNumber}: ${customerNumber}`,
    ...(paidBy ? [`${L.paidBy}: ${paidBy}`] : []),
    '',
    `${billStatus === 'paid' ? L.amountPaid : L.amountReceived}: ${formatPKR(amount)}`,
    englishLayout ? `📅 Received date: ${formatReceiptDate(date)}` : `${L.receivedDate}: ${formatReceiptDate(date)}`,
    `${L.method}: ${method}`,
    `${L.billingMonth}: ${formatReceiptMonth(month)}`,
    englishLayout ? `📦 Package date: ${packageDate} (renewal day: 1st of every month)` : `${L.packageDate}: ${packageDate} ${L.renewalNote}`
  ];

  // SISP-2: itemized arrears breakdown on the WhatsApp receipt, when the
  // caller attached one (app.js computes it per bill month).
  if (receipt?.arrearsBreakdown) {
    lines.push('', L.breakdownHeading, ...arrearsBreakdownTextLines(receipt.arrearsBreakdown));
  }

  // SISP-33: FIFO split of this payment plus the remaining split, when
  // the caller attached them (app.js passes them from buildPaymentReceipt).
  if (receipt?.fifoAllocation && receipt?.fifoRemaining && receipt?.fifoShow) {
    lines.push('', L.fifoHeading, ...fifoTextLines(receipt.fifoAllocation, receipt.fifoRemaining));
  }

  // SISP-43: billed ticket charges this payment settled, when the caller
  // attached them (app.js passes them from buildPaymentReceipt). Only
  // well-formed lines print — a malformed stamp never breaks the draft.
  const ticketChargeLines = (Array.isArray(receipt?.ticketCharges) ? receipt.ticketCharges : [])
    .filter((line) => /^TKT-\d+$/.test(String(line?.ticketId ?? '')) && Number.isFinite(Number(line?.amount)) && Number(line.amount) > 0)
    .map((line) => `${L.ticketCharge(line.ticketId)}: ${formatPKR(Number(line.amount))}`);
  if (ticketChargeLines.length > 0) {
    lines.push('', ...ticketChargeLines);
  }

  // SISP-101: a payment that waived the bill's late fee at collect time
  // says so on the WhatsApp receipt too, when the caller attached the
  // waived amount (app.js passes it from buildPaymentReceipt). Only a
  // well-formed positive amount prints — a malformed value never does.
  const waivedAmount = Number(receipt?.waivedAmount);
  if (Number.isFinite(waivedAmount) && waivedAmount > 0) {
    lines.push(`🎟️ ${t('lfw_whatsapp', null, { amount: formatPKR(waivedAmount) })}`);
  }

  if (billStatus === 'paid') {
    const nextBillDueDate = nextCycleDueDateFromBillMonth(month);
    const nextBillDue = formatReceiptDate(nextBillDueDate) ?? L.notAvailable;
    lines.push(
      '',
      L.statusPaid,
      L.outstandingZero,
      '',
      '━━━━━━━━━━━━━━',
      englishLayout ? `📅 Next Bill Due: ${nextBillDue}` : `${L.nextBillDue}: ${nextBillDue}`,
      '',
      L.payBy5
    );
  } else if (billStatus === 'partial') {
    const currentBillDue = formatReceiptDate(receipt?.billDueDate) ?? L.notRecorded;
    lines.push(
      '',
      L.statusPartial,
      `${L.outstanding}: ${formatPKR(balanceDueCents / 100)}`,
      `${L.billAmount}: ${formatPKR(billAmount)}`,
      englishLayout ? `📅 Current Bill Due: ${currentBillDue}` : `${L.currentBillDue}: ${currentBillDue}`,
      L.payBy5
    );
  }

  // SISP-96: the owner-configured receipt footer (built once by
  // receipt-footer-studio.js, passed in by the host as receiptFooterText)
  // closes the draft verbatim. Absent/empty on unconfigured setups, so
  // the draft stays byte-identical to before.
  const footerText = typeof receipt?.receiptFooterText === 'string' ? receipt.receiptFooterText.trim() : '';
  if (footerText) {
    lines.push('', footerText);
  }

  const message = lines.join('\n');
  return { url:`${target}?text=${encodeURIComponent(message)}`, message };
}

const escapeHtml = value => String(value ?? '').replace(/[&<>\"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[ch]));

// SISP-41: the 1-tap PNG receipt button for one saved payment in the
// Customer Profile receipt actions. The host binds [data-png-receipt]
// clicks to downloadPngReceipt (the SISP-6 generator: stamped PNG via
// generateReceiptPNG + shareOrDownloadPng); this helper owns the markup so
// the profile history rows and any other profile surface render the exact
// same button (class, data attributes, i18n label) — never a dead button.
export function pngReceiptButtonMarkup(customerId, month, paymentId, customerNumber) {
  return `<button class="print-receipt-button png-receipt-button" type="button" data-png-receipt data-customer-id="${escapeHtml(customerId)}" data-month="${escapeHtml(month)}" data-payment-id="${escapeHtml(paymentId)}" aria-label="${t('prof_hist_png_receipt_aria', null, { number: customerNumber })}">${t('prof_hist_png_receipt')}</button>`;
}

// SISP-65: the [🔊 Speak Due] button for the profile heading actions.
// Markup-only helper, the same pattern as pngReceiptButtonMarkup
// above: app.js binds [data-speak-due] clicks to speakCustomerDue
// (field-mode.js), which speaks the customer's name + net due built
// from the SAME allocation-engine figures Field Mode shows
// (fieldModeCustomerStatus) — no second balance computation lives
// here; this helper only owns the markup so the label/i18n stay put.
export function speakDueButtonMarkup(customerNumber) {
  return `<button class="secondary-button speak-due-button" type="button" data-speak-due aria-label="${t('speak_due_aria', null, { number: customerNumber })}">${t('speak_due_btn')}</button>`;
}

/** Bind each actual receipt only to its owning profile's saved number and identity. */
export function resolveReceiptWhatsAppAction(customer, receipt) {
  if (!customer?.id || !receipt || receipt.customerId !== customer.id) return { type:'unavailable', reason:'customer-mismatch' };
  const phone = String(customer.phone ?? '').trim();
  if (!contactActionTargets(phone)?.whatsapp) return { type:'phone-required', hasSavedPhone:Boolean(phone) };
  const draft = createReceiptWhatsAppDraft(phone, {
    ...receipt,
    customerName:customer.name,
    customerNumber:customer.customerNumber
  }, { lang: receiptLangPreference(customer) });
  return draft ? { type:'draft', draft } : { type:'unavailable', reason:'invalid-receipt' };
}

/**
 * SISP-92: GPS pin presentation for the profile view. Reads only the
 * stored gpsLat / gpsLng pair — a customer without a pin reports
 * hasPin false with no coordinates and no Maps link, never a guessed
 * location. coordsLabel keeps Latin digits (house coordinate rule).
 */
export function gpsPinPresentation(customer) {
  const pin = normalizeGpsPin(customer);
  if (!pin) {
    return { hasPin: false, lat: null, lng: null, coordsLabel: '', mapsUrl: null };
  }
  return {
    hasPin: true,
    lat: pin.lat,
    lng: pin.lng,
    coordsLabel: formatGpsCoords(pin),
    mapsUrl: googleMapsUrl(pin)
  };
}

// SISP-8: vacation-hold summary for the profile view (Service group row)
// and the profile header badge. Reads only the stored hold fields — it
// never decides billing; isBillingPaused in pause-billing.js does that.
export function pauseBillingSummary(customer) {
  const { paused, pauseStartDate, autoResumeDate, pauseSkippedMonths } = sanitizePauseFields(customer);
  const active = paused === true && pauseStartDate !== null;
  const skippedNote = pauseSkippedMonths.length > 0
    ? (pauseSkippedMonths.length === 1 ? t('prof_pause_skipped_1') : t('prof_pause_skipped_n', null, { n: pauseSkippedMonths.length }))
    : '';
  const label = (paused !== true || !pauseStartDate)
    ? t('prof_pause_not_paused')
    : (autoResumeDate
      ? t('prof_pause_since_resume', null, { start: pauseStartDate, resume: autoResumeDate })
      : t('prof_pause_since_until', null, { start: pauseStartDate }));
  return {
    active,
    paused,
    pauseStartDate,
    autoResumeDate,
    pauseSkippedMonths,
    label,
    detail: active
      ? t('prof_pause_detail_active', null, { label, skipped: skippedNote })
      : (pauseSkippedMonths.length > 0
        ? t('prof_pause_detail_inactive_skipped', null, { skipped: skippedNote })
        : t('prof_pause_not_paused'))
  };
}

// SISP-47: vacation-hold router presentation for the profile view —
// decides WHICH 1-click snippet the operator needs next, so the router
// half of a hold is always an explicit paste, never a silent change:
//   hold scheduled/active -> the DISABLE snippet (secret off + drop
//     the live session);
//   auto-resume date reached ('expired'), or the customer was resumed
//     in the app after a recorded hold -> the ENABLE snippet;
//   no hold and no hold history -> not visible at all.
// Pure presentation: it reads the stored hold fields and builds text;
// it never writes the ledger and never touches the router.
export function vacationHoldRouterPresentation(customer, { todayStr = '' } = {}) {
  const { paused, pauseStartDate, autoResumeDate, pauseSkippedMonths } = sanitizePauseFields(customer);
  const state = vacationHoldState(customer, todayStr);
  if (state === 'active' || state === 'scheduled') {
    return {
      visible: true,
      mode: 'disable',
      state,
      statusText: state === 'scheduled'
        ? t('prof_hold_status_scheduled', null, { start: pauseStartDate })
        : (autoResumeDate
          ? t('prof_hold_status_active_resume', null, { start: pauseStartDate, resume: autoResumeDate })
          : t('prof_hold_status_active', null, { start: pauseStartDate })),
      snippet: buildVacationHoldDisableSnippet(customer, { todayStr }),
      copyLabel: t('prof_hold_copy_disable')
    };
  }
  if (state === 'expired') {
    return {
      visible: true,
      mode: 'enable',
      state,
      statusText: t('prof_hold_status_expired', null, { resume: autoResumeDate }),
      snippet: buildVacationHoldEnableSnippet(customer, { todayStr }),
      copyLabel: t('prof_hold_copy_enable')
    };
  }
  // Not paused now, but a hold happened before (the edit form keeps the
  // start date, and resume/billing recorded the skipped months): the
  // router secret may still be disabled, so keep the ENABLE snippet one
  // tap away instead of letting the resume look automatic.
  const hasHoldHistory = pauseSkippedMonths.length > 0 || (paused !== true && pauseStartDate !== null);
  if (hasHoldHistory) {
    return {
      visible: true,
      mode: 'enable',
      state: 'resumed',
      statusText: t('prof_hold_status_resumed'),
      snippet: buildVacationHoldEnableSnippet(customer, { todayStr }),
      copyLabel: t('prof_hold_copy_enable')
    };
  }
  return { visible: false, mode: null, state, statusText: '', snippet: '', copyLabel: '' };
}

// SISP-40: hamsaya referral summary for the profile view. Reads only the
// stored link (referredByCustomerId) and the referral queue — it never
// decides credit; referral-credits.js reconcile + the SISP-2 cycle do.
export function referralBillingSummary(customer, state, credits) {
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const byId = new Map(customers.filter((row) => row && row.id).map((row) => [row.id, row]));
  const labelFor = (row) => (row ? `${row.name} (#${row.customerNumber ?? ''})` : '');
  const referrer = customer?.referredByCustomerId && customer.referredByCustomerId !== customer.id
    ? byId.get(customer.referredByCustomerId) ?? null
    : null;
  const earned = referralEntriesForReferrer(credits, customer?.id).map((entry) => {
    const referred = byId.get(entry.referredCustomerId);
    const name = referred ? labelFor(referred) : t('prof_ref_customer_gone');
    const amount = formatPKR(entry.amount);
    const label = entry.status === 'applied'
      ? t('prof_ref_line_applied', null, { name, amount })
      : entry.status === 'cancelled'
        ? t('prof_ref_line_cancelled', null, { name, amount })
        : t('prof_ref_line_queued', null, { name, amount });
    return { referralId: entry.referralId, status: entry.status, label };
  });
  const totals = referralTotalsForReferrer(credits, customer?.id);
  return {
    referredByLabel: referrer ? t('prof_ref_referred_by', null, { name: labelFor(referrer) }) : '',
    earned,
    queuedTotal: totals.queuedTotal,
    appliedTotal: totals.appliedTotal,
    queuedLabel: totals.queuedTotal > 0 ? t('prof_ref_queued', null, { amount: formatPKR(totals.queuedTotal) }) : '',
    appliedLabel: totals.appliedTotal > 0 ? t('prof_ref_applied', null, { amount: formatPKR(totals.appliedTotal) }) : '',
    hasContent: Boolean(referrer) || earned.length > 0
  };
}

// SISP-97: feeder-host bijli credit presentation for the profile feeder
// section. Pure: it reads the configured amount and the LIVE topology
// (feeder-host-credit.js) and formats the line — it never decides the
// money; the SISP-2 cycle derives eligibility again at plan time.
// Visible whenever an amount is configured, so a credit whose last
// downstream link was removed stays visible with its ineligible label
// instead of silently vanishing.
export function feederHostCreditPresentation(customer, customers) {
  const list = Array.isArray(customers) ? customers : [];
  const creditPKR = feederHostCreditOf(customer);
  const activeDownstream = customer ? activeDownstreamCount(list, customer.id) : 0;
  const eligible = isFeederHost(list, customer);
  return {
    creditPKR,
    activeDownstream,
    eligible,
    show: creditPKR > 0,
    label: creditPKR > 0
      ? t(eligible ? 'fhost_profile_applied' : 'fhost_profile_ineligible', null, { amount: formatPKR(creditPKR) })
      : ''
  };
}

// SISP-50: security-deposit settlement presentation for the profile
// custody section. Pure: it reads the stored settlement stamp (or the
// live quote from hardware-custody.js) and formats labels — it never
// decides the money; depositSettlementQuote does that, and app.js
// supplies the engine arrears total. Visible only on disconnected
// (archived) customers who hold — or already settled — a deposit.
export function depositSettlementPresentation(customer, unpaidArrears = 0) {
  if (!isDisconnected(customer)) return { visible: false, settled: false, canSettle: false };
  const settled = depositSettlementOf(customer);
  if (settled) {
    const stillDue = settled.arrearsRemaining + settled.hardwareOutstanding;
    return {
      visible: true,
      settled: true,
      canSettle: false,
      settledLabel: t('prof_dep_settled', null, { date: settled.settledAt, arrears: formatPKR(settled.arrearsOffset), refund: formatPKR(settled.refundAmount) }),
      stillDueLabel: stillDue > 0 ? t('prof_dep_still_due', null, { amount: formatPKR(stillDue) }) : '',
      receiptLabel: t('prof_dep_receipt_btn')
    };
  }
  const quote = depositSettlementQuote(customer, unpaidArrears);
  if (!(quote.securityDeposit > 0)) return { visible: false, settled: false, canSettle: false };
  return {
    visible: true,
    settled: false,
    canSettle: quote.eligible,
    depositLabel: t('prof_dep_deposit', null, { amount: formatPKR(quote.securityDeposit) }),
    arrearsLabel: t('prof_dep_arrears', null, { amount: formatPKR(quote.unpaidArrears) }),
    hardwareLabel: quote.unrecoveredItems.length > 0
      ? t('prof_dep_hardware', null, { amount: formatPKR(quote.unrecoveredHardwareCharge) })
      : t('prof_dep_hardware_none'),
    refundLabel: t('prof_dep_refund', null, { amount: formatPKR(quote.netDepositRefund) }),
    noteLabel: t('prof_dep_note'),
    settleLabel: t('prof_dep_settle_btn')
  };
}

// SISP-64: bad-debt write-off presentation for the profile. Pure: it
// reads the register's active entry (or the live quote from
// bad-debt-ledger.js) and formats labels — it never decides the money;
// badDebtWriteOffQuote does that, and app.js supplies the engine
// arrears total. Visible only on archived (churned) customers who
// still owe money, or who already carry a write-off.
export function badDebtPresentation(customer, entries, unpaidArrears = 0) {
  const active = customer ? activeBadDebtFor(entries, customer.id) : null;
  if (active) {
    return {
      visible: true,
      writtenOff: true,
      canWriteOff: false,
      amount: active.amount,
      writtenOffLabel: t('bd_written_off', null, { amount: formatPKR(active.amount), date: active.writeOffDate }),
      reasonLabel: active.writeOffReason ? t('bd_reason_line', null, { reason: active.writeOffReason }) : '',
      noteLabel: t('bd_written_off_note')
    };
  }
  const quote = badDebtWriteOffQuote(customer, entries, unpaidArrears);
  if (!quote.eligible) return { visible: false, writtenOff: false, canWriteOff: false };
  return {
    visible: true,
    writtenOff: false,
    canWriteOff: true,
    amount: quote.amount,
    arrearsLabel: t('bd_arrears', null, { amount: formatPKR(quote.amount) }),
    noteLabel: t('bd_note'),
    reasonLabel: t('bd_reason_label'),
    reasonPlaceholder: t('bd_reason_ph'),
    writeOffLabel: t('bd_write_off_btn')
  };
}

// SISP-29: payoff presentation for one kist plan card. Pure: the payoff
// amount is exactly totalAmount - downPayment - monthlyKist * monthsBilled
// (0 for completed plans), and a settled-early plan reports its recorded
// payoff amount/date. app.js renders the button/label from this object.
export function kistSettlementPresentation(plan) {
  const sane = sanitizeInstallmentPlan(plan);
  if (!sane) return { canPayoff: false, payoffAmount: 0, payoffLabel: '', settledEarly: false, settledLabel: '' };
  const settledEarly = sane.payoffAmount !== null || sane.payoffDate !== null;
  const payoffAmount = earlyPayoffAmount(sane);
  return {
    canPayoff: sane.status === 'active',
    payoffAmount,
    payoffLabel: sane.status === 'active' ? t('prof_kist_payoff', null, { amount: formatPKR(payoffAmount) }) : '',
    settledEarly,
    settledLabel: settledEarly
      ? (sane.payoffDate
        ? t('prof_kist_settled', null, { amount: formatPKR(sane.payoffAmount ?? 0), date: sane.payoffDate })
        : t('prof_kist_settled_nodate', null, { amount: formatPKR(sane.payoffAmount ?? 0) }))
      : ''
  };
}

/**
 * SISP-59: profile upgrade-suggestion hint. Renders ONLY for a customer
 * who is an upsell candidate (computed read-only by
 * upsell-optimizer.js — this helper just formats it); returns '' for
 * everyone else. The offer anchor is the same 1-tap wa.me link the
 * dashboard card uses; nothing here changes a package.
 */
/**
 * SISP-61: the "🟢 Prepaid Until <Month YYYY>" badge. The month comes
 * from advance-prepay.js's live derivation (engine balances + unapplied
 * credit vs the price schedule) — never from the promised month count —
 * and this helper returns '' the moment coverage no longer reaches the
 * current month, so the badge can never outlive the money.
 */
export function prepaidUntilBadgeHtml(state, customer, referenceDate = new Date()) {
  const until = prepaidUntilMonth(state, customer?.id, referenceDate);
  if (!until) return '';
  const label = t('prepaid_badge', null, { month: formatReceiptMonth(until) ?? until });
  return `<span class="prepaid-until-badge">${label}</span>`;
}

/**
 * SISP-98: Waada reliability badge for the profile Waada section —
 * "🤝 Waada Score: Kept X / Broken Y", derived live by
 * waada-queue.computeWaadaScore from the customer's recorded promise
 * resolutions (SISP-34 clearedWaada stamps + the live promise's tier).
 * Outstanding is the allocation sum over priced bills — the same recipe
 * core.addPayment uses to decide the promise auto-clear. Returns '' while
 * the customer has no resolved waada on record (the house empty-stat
 * pattern, like the prepaid badge above), so the section stays clean for
 * customers who never promised. todayStr is a YYYY-MM-DD string; '' or a
 * non-string falls back to the score module's own PKT today.
 * OWNER-HELP follow-up: the badge carries the waada_score ℹ️ mount — the
 * score gets its own guide topic because the waada topic's text explains
 * recording promises, not the Kept/Broken derivation.
 */
export function waadaScoreBadgeHtml(state, customer, todayStr = '') {
  if (!state || !customer || typeof customer !== 'object') return '';
  const allocations = calculatePaymentAllocations(state);
  let outstandingCents = 0;
  for (const bill of Array.isArray(customer.bills) ? customer.bills : []) {
    const summary = allocations.forMonth(customer.id, bill?.month);
    if (summary && summary.balanceDueCents !== null && summary.balanceDueCents !== undefined) {
      outstandingCents += summary.balanceDueCents;
    }
  }
  const today = typeof todayStr === 'string' && todayStr.trim() !== '' ? todayStr.trim() : undefined;
  const score = computeWaadaScore(customer, outstandingCents / 100, today);
  if (score.total === 0) return '';
  const label = t('wscore_badge', null, { kept: score.kept, broken: score.broken });
  return `<p class="profile-waada-score"><span class="wada-badge waada-score-badge">${label}</span> ${helpButtonMarkup('waada_score')}</p>`;
}
/**
 * SISP-90: the "👑 1+ Yr Loyal" badge. Tenure comes from
 * loyalty-retention.js's live derivation over the recorded start
 * (connectionDate, else the profile-added date — never invented), and
 * this helper returns '' the moment tenure is under 12 whole months
 * or no honest start date exists, so the badge can never appear for a
 * customer whose record does not prove a year of service.
 */
export function loyaltyBadgeHtml(customer, referenceDate = new Date()) {
  const info = loyaltyInfoForCustomer(customer, referenceDate);
  if (!info.isLoyal) return '';
  return `<span class="loyalty-badge">${t('loyalty_badge')}</span>`;
}
/**
 * SISP-84: the "🏢 Commercial VIP" tag for a commercial_vip customer's
 * profile (their open complaints/tickets get SLA queue priority — see
 * commercial-sla.js). Returns '' for residential customers, whose
 * profiles render exactly as before.
 */
export function commercialVipBadgeHtml(customer) {
  if (!isCommercialVip(customer)) return '';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  return `<span class="sla-vip-badge">${esc(t('sla_vip_badge'))}</span>`;
}
const ordinalDay = (day) => {
  const n = Number(day);
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th'
    : n % 10 === 1 ? 'st'
      : n % 10 === 2 ? 'nd'
        : n % 10 === 3 ? 'rd'
          : 'th';
  return `${n}${suffix}`;
};

/**
 * SISP-79: the profile's "Usual pay day" line. Pure presentation over
 * payment-day-advisor.js's derived habit — it reads the customer's
 * live receipts and formats the usual window (e.g. "Usually pays
 * around 10th–12th"); with fewer than 2 qualifying payments it reports
 * that there is not enough history yet instead of guessing a day.
 * Urdu keeps plain Latin digits (house rule); English gets ordinals.
 */
export function paymentHabitPresentation(customer) {
  const habit = paymentDayHabit(customer);
  if (!habit) {
    return { visible: false, medianDay: null, windowStart: null, windowEnd: null, paymentCount: 0, label: t('prof_payday_none') };
  }
  const range = getAppLanguage() === 'ur'
    ? `${habit.windowStart}–${habit.windowEnd}`
    : `${ordinalDay(habit.windowStart)}–${ordinalDay(habit.windowEnd)}`;
  return {
    visible: true,
    medianDay: habit.medianDay,
    windowStart: habit.windowStart,
    windowEnd: habit.windowEnd,
    paymentCount: habit.paymentCount,
    label: t('prof_payday_usually', null, { range })
  };
}

export function upsellProfileHintHtml(candidate, formatAmountFn = (n) => String(n ?? '')) {
  if (!candidate) return '';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const textLine = t('prof_upsell_text', null, { target: candidate.targetLabel, price: formatAmountFn(candidate.targetPrice), gain: formatAmountFn(candidate.gainPerMonth) });
  return `<section class="profile-referral-section" aria-label="${esc(t('prof_upsell_heading'))}"><h4>${esc(t('prof_upsell_heading'))}</h4><p>${esc(textLine)}</p>${candidate.whatsappUrl ? `<p><a class="secondary-button" href="${esc(candidate.whatsappUrl)}" target="_blank" rel="noopener noreferrer">${esc(t('upsell_offer'))}</a></p>` : ''}</section>`;
}

// SISP-110: the Welcome & Custody Slip button in the profile heading
// actions. This helper owns the markup (the SISP-41 pngReceiptButtonMarkup
// pattern) so the profile renders the exact same button everywhere; the
// host binds #profileWelcomeSlipButton clicks to the welcome-slip modal
// (welcome-agreement-slip.js builders, wired in app.js).
export function welcomeSlipButtonMarkup() {
  return `<button id="profileWelcomeSlipButton" class="secondary-button" type="button">${t('welcome_btn')}</button>`;
}

/**
 * SISP-108: profile disconnect section. For an archived customer it
 * shows the CURRENT disconnect record (reason, note, win-back
 * eligibility, offer stamp); earlier archive events are listed from
 * disconnectHistory so a re-archive never rewrites the past. Returns ''
 * for a customer who is active and has never been archived — nothing
 * is invented for legacy or active records.
 */
export function disconnectProfileHtml(customer) {
  if (!customer || typeof customer !== 'object') return '';
  const details = disconnectDetailsOf(customer);
  const archived = customer.archived === true;
  const history = details.disconnectHistory;
  if (!archived && history.length === 0) return '';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const lines = [];
  if (archived) {
    lines.push(`<p>${esc(t('winback_prof_reason', null, { reason: disconnectReasonLabel(details.disconnectReason) }))}</p>`);
    lines.push(`<p>${esc(t(details.winBackEligible ? 'winback_prof_eligible' : 'winback_prof_not_eligible'))}</p>`);
    if (details.disconnectNote) lines.push(`<p>${esc(t('winback_prof_note', null, { note: details.disconnectNote }))}</p>`);
    if (details.winBackEligible) lines.push(`<p>${esc(details.winBackOfferSentAt ? t('winback_prof_offer_sent', null, { date: details.winBackOfferSentAt.slice(0, 10) }) : t('winback_prof_offer_not_sent'))}</p>`);
  }
  // The latest history entry duplicates the current block above when
  // archived, so the history list shows the earlier events only then.
  const earlier = archived ? history.slice(0, -1) : history;
  if (earlier.length > 0) {
    lines.push(`<p><strong>${esc(t('winback_prof_history'))}</strong></p><ul>${earlier.map(entry => `<li>${esc(t('winback_prof_history_line', null, { date: entry.archivedAt.slice(0, 10), reason: disconnectReasonLabel(entry.disconnectReason) }))}</li>`).join('')}</ul>`);
  }
  if (lines.length === 0) return '';
  return `<section class="profile-disconnect-section" aria-label="${esc(t('winback_prof_heading'))}"><h4>${esc(t('winback_prof_heading'))}</h4>${lines.join('')}</section>`;
}

// SISP-106: the profile Speed Boost section — the customer's boost log
// (newest first) with its derived status (active / upcoming / expired,
// never a stored flag) and charge state, the MikroTik snippet buttons
// (wired in app.js via data attributes; the snippet text is generated
// on click by mikrotik-generator.js), and the add-boost form. The base
// package is never shown as changed here — a boost is an add-on only.
// FREE customers get the explanatory note instead of the form (they
// are never billed); archived customers get the log without the form.
export function speedBoostProfileSectionHtml(customer, { todayStr = '', formatAmountFn = (n) => String(n ?? '') } = {}) {
  if (!customer) return '';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const boosts = [...speedBoostsOf(customer)].sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)) || (Number(String(b.boostId).slice(4)) - Number(String(a.boostId).slice(4))));
  const pending = addonChargesPending(customer);
  const statusLabel = (status) => t(status === 'expired' ? 'boost_status_expired' : status === 'upcoming' ? 'boost_status_upcoming' : 'boost_status_active');
  const rows = boosts.map((boost) => {
    const status = speedBoostStatus(boost, todayStr);
    const line = t('boost_line', null, { mbps: boost.boostMbps, days: boost.durationDays, fee: formatAmountFn(boost.addonFeePKR), start: boost.startDate, expiry: boost.expiryDate });
    return `<li><span><strong>${esc(boost.boostId)}</strong> · ${esc(line)} · ${esc(statusLabel(status))}</span><span>${boost.chargePaid ? esc(t('boost_paid')) : esc(t('boost_unpaid'))}</span> <button type="button" class="secondary-button" data-boost-snippet="${esc(boost.boostId)}">${esc(t('boost_copy_snippet'))}</button>${status === 'expired' ? ` <button type="button" class="secondary-button" data-boost-restore="1">${esc(t('boost_copy_restore'))}</button>` : ''}</li>`;
  }).join('');
  const canAdd = customer.isFreeConnection !== true && customer.archived !== true;
  const form = canAdd
    ? `<div class="boost-add-form"><label for="profileBoostMbps">${esc(t('boost_form_mbps'))}</label><input id="profileBoostMbps" type="number" min="1" step="any" inputmode="decimal"><label for="profileBoostDays">${esc(t('boost_form_days'))}</label><input id="profileBoostDays" type="number" min="1" max="365" step="1" inputmode="numeric"><label for="profileBoostFee">${esc(t('boost_form_fee'))}</label><input id="profileBoostFee" type="number" min="1" step="any" inputmode="decimal"><label for="profileBoostStart">${esc(t('boost_form_start'))}</label><input id="profileBoostStart" type="date" value="${esc(todayStr)}"><button type="button" class="primary-button" id="profileBoostAddBtn">${esc(t('boost_add'))}</button></div>`
    : (customer.isFreeConnection === true ? `<p class="profile-boost-note">${esc(t('boost_free_note'))}</p>` : '');
  return `<section class="profile-boost-section" aria-label="${esc(t('boost_heading'))}"><h4>${esc(t('boost_heading'))}</h4>${pending > 0 ? `<p class="profile-boost-charges">${esc(t('boost_pending', null, { amount: formatAmountFn(pending) }))}</p>` : ''}${boosts.length === 0 ? `<p class="profile-boost-empty">${esc(t('boost_empty'))}</p>` : `<ul class="profile-boost-list">${rows}</ul>`}${form}</section>`;
}
/**
 * SISP-69: profile bottleneck hint. Renders ONLY for a customer flagged
 * by hardware-speed-audit.js (catalogue speed >= 15 Mbps AND last RX
 * below the -26.0 dBm weak-signal line — computed read-only there; this
 * helper just formats the row); returns '' for everyone else. The RX
 * figure is formatted by the caller with splitter-map.js's own
 * formatRxDbm so the profile optical section and this hint can never
 * disagree on the reading.
 */
export function bottleneckProfileHintHtml(suspect, formatRxFn = (v) => String(v ?? '')) {
  if (!suspect) return '';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const textLine = t('prof_hwaudit_text', null, { label: suspect.packageLabel, rx: formatRxFn(suspect.lastRxDbm) });
  const complaintsLine = suspect.slowSpeedComplaints > 0
    ? t('hwaudit_complaints', null, { count: suspect.slowSpeedComplaints })
    : t('hwaudit_no_complaints');
  return `<section class="profile-referral-section" aria-label="${esc(t('prof_hwaudit_heading'))}"><h4>${esc(t('prof_hwaudit_heading'))}</h4><p>${esc(textLine)}</p><p>${esc(complaintsLine)}</p></section>`;

}
