import { PAYMENT_METHODS, calculatePaymentAllocations, derivedBillStatus, formatPKR, listTransactions, nextCycleDueDateFromBillMonth, searchCustomers } from './core.js';
import { arrearsBreakdownTextLines, fifoRemainingForBill, fifoTextLines } from './billing-cycle.js';
import { sanitizePauseFields } from './pause-billing.js';
import { t } from './nav-language.js';
import { earlyPayoffAmount, sanitizeInstallmentPlan } from './installment-plan.js';
import { referralEntriesForReferrer, referralTotalsForReferrer } from './referral-credits.js';

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
export function createReceiptWhatsAppDraft(phone, receipt) {
  const target = contactActionTargets(phone)?.whatsapp;
  const amount = Number(receipt?.amount);
  const name = safeLine(receipt?.customerName);
  const method = safeLine(receipt?.method, 40);
  const customerNumber = Number(receipt?.customerNumber);
  const date = String(receipt?.date ?? '');
  const month = String(receipt?.month ?? '');
  if (!target || !name || !Number.isSafeInteger(customerNumber) || customerNumber < 1 || !Number.isFinite(amount) || amount <= 0 || !validCalendarDate(date) || !validMonth(month) || !PAYMENT_METHODS.includes(method)) return null;

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
  const packageDate = formatReceiptDate(receiptMonthDate(month, 1)) ?? 'Not available';
  const lines = [
    '🧾 SHAHDARA ISP — PAYMENT RECEIPT',
    '',
    `👤 Customer: ${name}`,
    `🆔 Customer #: ${customerNumber}`,
    ...(paidBy ? [`Paid by: ${paidBy}`] : []),
    '',
    `💰 Amount ${billStatus === 'paid' ? 'Paid' : 'Received'}: ${formatPKR(amount)}`,
    `📅 Received date: ${formatReceiptDate(date)}`,
    `💳 Method: ${method}`,
    `📆 Billing Month: ${formatReceiptMonth(month)}`,
    `📦 Package date: ${packageDate} (renewal day: 1st of every month)`
  ];

  // SISP-2: itemized arrears breakdown on the WhatsApp receipt, when the
  // caller attached one (app.js computes it per bill month).
  if (receipt?.arrearsBreakdown) {
    lines.push('', '📋 Bill breakdown:', ...arrearsBreakdownTextLines(receipt.arrearsBreakdown));
  }

  // SISP-33: FIFO split of this payment plus the remaining split, when
  // the caller attached them (app.js passes them from buildPaymentReceipt).
  if (receipt?.fifoAllocation && receipt?.fifoRemaining && receipt?.fifoShow) {
    lines.push('', '💠 FIFO taqseem:', ...fifoTextLines(receipt.fifoAllocation, receipt.fifoRemaining));
  }

  if (billStatus === 'paid') {
    const nextBillDueDate = nextCycleDueDateFromBillMonth(month);
    const nextBillDue = formatReceiptDate(nextBillDueDate) ?? 'Not available';
    lines.push(
      '',
      '✅ Status: PAID',
      '💵 Outstanding: PKR 0',
      '',
      '━━━━━━━━━━━━━━',
      `📅 Next Bill Due: ${nextBillDue}`,
      '',
      '⚠️ Please pay by the 5th to avoid service interruption. thanks 🥰'
    );
  } else if (billStatus === 'partial') {
    const currentBillDue = formatReceiptDate(receipt?.billDueDate) ?? 'Not recorded';
    lines.push(
      '',
      '🟠 Status: PARTIAL',
      `💵 Outstanding: ${formatPKR(balanceDueCents / 100)}`,
      `💳 Bill Amount: ${formatPKR(billAmount)}`,
      `📅 Current Bill Due: ${currentBillDue}`,
      '⚠️ Please pay by the 5th to avoid service interruption. thanks 🥰'
    );
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

/** Bind each actual receipt only to its owning profile's saved number and identity. */
export function resolveReceiptWhatsAppAction(customer, receipt) {
  if (!customer?.id || !receipt || receipt.customerId !== customer.id) return { type:'unavailable', reason:'customer-mismatch' };
  const phone = String(customer.phone ?? '').trim();
  if (!contactActionTargets(phone)?.whatsapp) return { type:'phone-required', hasSavedPhone:Boolean(phone) };
  const draft = createReceiptWhatsAppDraft(phone, {
    ...receipt,
    customerName:customer.name,
    customerNumber:customer.customerNumber
  });
  return draft ? { type:'draft', draft } : { type:'unavailable', reason:'invalid-receipt' };
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
