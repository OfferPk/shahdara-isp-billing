import { calculatePaymentAllocations, paymentSenderLabel, paymentTicketChargeCents, prepayTermsOf, ticketChargeLinesOf } from './core.js';
import { classifyPackagePrice, validateBillPackageSnapshot } from './package-catalog.js';
import { buildArrearsBreakdown, fifoAllocationForPayment } from './billing-cycle.js';
import { kistLineLabel, kistSchedule, sanitizeInstallmentPlan } from './installment-plan.js';
import { urduNameFor } from './urdu-names.js';
import { sanitizeDepositSettlement } from './hardware-custody.js';
import { isVoidedPayment } from './payment-void-audit.js';

export const PACKAGE_TERMS_NOTE = '📌 پیکیج کی اہم شرط:\nPKR 3,000 سے کم قیمت والے تمام پیکیجز محدود (Limited) پیکیجز ہیں۔ ان میں ڈیٹا کی ایک مقررہ حد ہوتی ہے، مثلاً 5 Mbps / 300 GB۔ مقررہ ڈیٹا حد مکمل ہونے پر انٹرنیٹ سروس بند ہو جائے گی۔ ان پیکیجز میں مکمل یا مستقل رفتار کی ضمانت بھی نہیں ہے۔\nPKR 3,000 اور اس سے زیادہ قیمت والے پیکیجز Unlimited ہیں اور ان میں مقررہ ڈیٹا حد لاگو نہیں ہوتی۔';
export const RECEIPT_URDU_NOTE = 'رسید برائے انٹرنیٹ بل ادائیگی - ادائیگی موصول ہوئی۔ شکریہ! بروقت سروس کے لیے ہر ماہ کی 5 تاریخ تک بل ادا فرمائیں۔';

export function generateReceiptNumber({ customerNumber, paymentDate, paymentId, billMonth } = {}) {
  const dateStr = String(paymentDate || billMonth || '2026-01-01').replace(/-/g, '').slice(2, 6);
  const custStr = String(customerNumber || '0').padStart(4, '0');
  const idStr = paymentId ? String(paymentId).replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() : '1001';
  return `REC-${dateStr}-${custStr}-${idStr}`;
}

const text = value => typeof value === 'string' ? value.trim() : '';
const positiveAmount = value => {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};
const cents = value => Math.round(Number(value) * 100);
const paymentOrder = (left, right) => String(left?.date ?? '').localeCompare(String(right?.date ?? ''));

function packageAtServiceStart(customer, month) {
  const start = `${month}-01`;
  const history = (Array.isArray(customer?.packageHistory) ? customer.packageHistory : [])
    .filter(change => /^\d{4}-\d{2}-\d{2}$/.test(String(change?.date ?? '')))
    .sort((left, right) => left.date.localeCompare(right.date)
      || String(left.recordedAt ?? '').localeCompare(String(right.recordedAt ?? '')));
  if (!history.length) return text(customer?.packageSpeed);
  const changesByStart = history.filter(change => change.date <= start);
  if (changesByStart.length) return text(changesByStart.at(-1).newPackage);
  return text(history[0].oldPackage);
}

function validStoredDate(value) {
  const date = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? '' : date;
}

/**
 * Create a read-only receipt snapshot from a saved customer, bill month and payment.
 * Missing transaction references, package duration, data caps and period ends stay blank.
 * Payment status/balance are calculated only through this payment, not from later receipts.
 */
export function buildPaymentReceipt(customer, bill, payment) {
  if (!customer || !bill || !payment) throw new Error('A saved customer, bill and payment are required.');

  const packageSnapshot = validateBillPackageSnapshot(bill.packageSnapshot);
  const packageLabel = packageSnapshot?.label ?? packageAtServiceStart(customer, bill.month);
  const speedMatch = packageLabel.match(/\b(\d+(?:\.\d+)?)\s*Mbps\b/i);
  const billDue = positiveAmount(bill.dueAmount);
  const lateFee = positiveAmount(bill.lateFee) || 0;
  // SISP-30: an applied outage concession reduces what this receipt settles.
  // The bill amount itself is untouched; the concession is subtracted here so
  // the balance (and the PAID / PARTIAL seal) reflect the net due.
  const concessionAmount = positiveAmount(bill.concessionAmount) || 0;
  const concessionReason = text(bill.concessionReason);
  // SISP-40: an applied hamsaya referral credit reduces what this receipt
  // settles, exactly like the outage concession — the bill amount itself
  // is untouched; the credit is subtracted here so the balance (and the
  // PAID / PARTIAL seal) reflect the net due.
  const referralCreditAmount = positiveAmount(bill.referralCreditAmount) || 0;
  const referralCreditReason = text(bill.referralCreditReason);
  // SISP-50: a disconnection security-deposit offset waived part of this
  // bill — subtracted here exactly like the concession and the referral
  // credit, so the balance (and the PAID / PARTIAL seal) reflect the
  // amount the customer actually still owed.
  const depositOffsetAmount = positiveAmount(bill.depositOffsetAmount) || 0;
  const depositOffsetReason = text(bill.depositOffsetReason);
  const nominalPrice = packageSnapshot?.nominalPrice ?? billDue ?? positiveAmount(bill.priceSnapshot);
  const packageType = packageSnapshot?.packageType ?? classifyPackagePrice(nominalPrice);
  const customerBills = Array.isArray(customer.bills) ? customer.bills : [];
  const matchingBill = customerBills.find(row => row === bill || (row?.id && bill.id && row.id === bill.id)) ?? bill;
  const orderedPayments = [...(Array.isArray(matchingBill.payments) ? matchingBill.payments : [])].sort(paymentOrder);
  const selectedIndex = orderedPayments.findIndex(row => row === payment
    || (row?.id && payment.id && row.id === payment.id));

  let status = 'RECEIVED';
  let balanceDueCents = null;
  if (billDue !== null && selectedIndex >= 0) {
    const dueCents = Math.max(0, cents(billDue) + cents(lateFee) - cents(concessionAmount) - cents(referralCreditAmount) - cents(depositOffsetAmount));
    const allocations = calculatePaymentAllocations({ customers:[customer] });
    const summary = allocations.forMonth(customer.id, matchingBill.month);
    const carryInCents = Math.min(dueCents, Math.max(0, Number(summary?.creditAppliedCents) || 0));
    // SISP-43: a receipt's balance math counts only the BILL portion of
    // each payment — the ticket-charge portion settled field work, not
    // this bill (the total cash received still prints as paidAmount).
    const billPortionCents = (row) => Math.max(0, cents(positiveAmount(row.amount) ?? 0) - paymentTicketChargeCents(row));
    // FU4: SISP-34 voided payments settle nothing — a voided sibling
    // receipt (amount, discount and ticket-charge portions alike) never
    // counts toward what was received before this payment, and a voided
    // payment's own receipt contributes nothing itself, so the printed
    // balance/status agree with the allocation engine and Khata Doctor.
    const paidBeforeCents = orderedPayments.slice(0, selectedIndex)
      .filter(row => !isVoidedPayment(row))
      .reduce((sum, row) => sum + billPortionCents(row) + cents(positiveAmount(row.discount) ?? 0), 0);
    const thisEffectiveCents = isVoidedPayment(payment) ? 0 : billPortionCents(payment) + cents(positiveAmount(payment.discount) ?? 0);
    const receivedThroughCents = paidBeforeCents + thisEffectiveCents;
    const coveredBeforeReceipt = carryInCents + paidBeforeCents >= dueCents;
    balanceDueCents = Math.max(0, dueCents - carryInCents - receivedThroughCents);
    if (coveredBeforeReceipt) status = 'CREDIT RECEIVED';
    else if (balanceDueCents === 0) status = 'PAID';
    else if (carryInCents + receivedThroughCents > 0) status = 'PARTIAL';
  }

  const transactionId = text(payment.transactionId);
  // SISP-63: sender proof metadata display label ("Hamza (…3310)") —
  // '' on every payment without sender metadata, so receipts for those
  // payments stay byte-identical.
  const senderLabel = paymentSenderLabel(payment);
  const packageDuration = text(bill.packageDuration) || text(customer.packageDuration);
  const dataLimit = packageType === 'Limited'
    ? packageSnapshot?.dataLimit || text(bill.packageDataLimit) || text(customer.packageDataLimit)
    : '';
  const servicePeriodStart = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(bill.month ?? '')) ? `${bill.month}-01` : '';
  const packageDate = servicePeriodStart;
  const servicePeriodEnd = validStoredDate(bill.servicePeriodEnd);

  const permanentReceiptNumber = text(payment.receiptNumber) || generateReceiptNumber({
    customerNumber: customer.customerNumber,
    paymentDate: validStoredDate(payment.date),
    paymentId: payment.id,
    billMonth: bill.month
  });

  return {
    customerName:text(customer.name),
    // SISP-26: Urdu-script name for the bilingual receipt header ('' when
    // no override/transliteration exists — the header then shows Roman only).
    customerNameUrdu:urduNameFor(customer),
    customerId:Number.isSafeInteger(customer.customerNumber) && customer.customerNumber > 0 ? String(customer.customerNumber) : '',
    paymentDate:validStoredDate(payment.date),
    transactionId,
    senderLabel,
    receiptNumber: permanentReceiptNumber,
    permanentReceiptNumber,
    urduNote: RECEIPT_URDU_NOTE,
    package:packageLabel,
    speedMbps:packageSnapshot ? String(packageSnapshot.speedMbps) : speedMatch?.[1] ?? '',
    packageDuration,
    packageType,
    dataLimit,
    nominalPrice,
    lateFee,
    lateFeeReason: text(bill.lateFeeReason),
    concessionAmount,
    concessionReason,
    referralCreditAmount,
    referralCreditReason,
    depositOffsetAmount,
    depositOffsetReason,
    // SISP-43: billed ticket charges this payment settled (from the
    // payment's stamp), printed as their own lines on every receipt.
    ticketCharges: ticketChargeLinesOf(payment),
    ticketChargesTotal: ticketChargeLinesOf(payment).reduce((sum, line) => sum + line.amount, 0),
    totalBilled: (nominalPrice !== null ? nominalPrice : 0) + lateFee,
    // SISP-61: a multi-month prepay prints its three money lines
    // separately — gross coverage, the upfront discount, and the cash
    // actually paid (paidAmount above, which stays NET cash: the gross
    // is coverage, never cash collected). Null on every other receipt,
    // so non-prepay receipts stay byte-identical.
    prepay: (() => {
      const terms = prepayTermsOf(payment);
      if (!terms) return null;
      return { months: terms.months, gross: terms.gross, rate: terms.rate, startMonth: terms.startMonth, discount: positiveAmount(payment.discount) || 0, cashPaid: positiveAmount(payment.amount) };
    })(),
    discount: positiveAmount(payment.discount) || 0,
    discountReason: text(payment.discountReason),
    paidAmount:positiveAmount(payment.amount),
    paymentMethod:text(payment.method),
    packageDate,
    servicePeriodStart,
    servicePeriodEnd,
    status,
    balanceDueCents,
    // SISP-2: itemized arrears breakdown for this bill month (package,
    // previous arrears, total due, paid applied, balance). Null when the
    // bill has no price — the breakdown needs a priced bill month.
    arrearsBreakdown: buildArrearsBreakdown(customer, bill),
    // SISP-33: FIFO split of this payment (arrears / package / kist) and
    // the remaining split right after it, derived from the bill's saved
    // payments — never stored on the receipt, so re-printing a receipt
    // always shows the split for the ledger as saved. fifoShow is false
    // for a plain package-only bill, where the split would be trivial.
    ...(() => {
      const fifo = fifoAllocationForPayment(customer, matchingBill, payment.id);
      if (!fifo) return { fifoAllocation: null, fifoRemaining: null, fifoShow: false };
      return { fifoAllocation: fifo.allocation, fifoRemaining: fifo.remaining, fifoShow: fifo.show };
    })()
  };
}

// SISP-43: billed ticket charge rows for the HTML receipt layouts.
// Empty when the payment settled no ticket charge, so ordinary receipts
// render exactly as before.
// SISP-61: a prepay receipt shows its coverage as its own lines — the
// gross coverage bought and the upfront discount — alongside the PAID
// row (the cash actually received). The generic discount row is
// suppressed for prepay receipts so the discount prints exactly once.
const prepayReceiptRows = (receipt, formatAmount) => {
  if (!receipt.prepay) return '';
  const rows = [`<div class="receipt-field"><dt>Prepay Coverage / پیشگی کوریج (${receipt.prepay.months} months · from ${escapeHtml(receipt.prepay.startMonth)}):</dt><dd>${formatAmount(receipt.prepay.gross)}</dd></div>`];
  if (receipt.prepay.discount > 0) rows.push(`<div class="receipt-field"><dt>Prepay Discount / پیشگی رعایت:</dt><dd>-${formatAmount(receipt.prepay.discount)}</dd></div>`);
  return rows.join('');
};

const ticketChargeReceiptRows = (receipt, formatAmount) => {
  const lines = Array.isArray(receipt?.ticketCharges) ? receipt.ticketCharges : [];
  return lines.map((line) => `<div class="receipt-field"><dt>Murammat / Material Charge (${escapeHtml(line.ticketId)}):</dt><dd>${formatAmount(line.amount)}</dd></div>`).join('');
};

// SISP-4: kist breakdown rows for the HTML receipt layouts. Empty when the
// bill month carries no kist, so non-kist receipts render exactly as before.
const kistBreakdownRows = (breakdown, formatAmount, label) => {
  if (!breakdown || !(breakdown.kistAmount > 0)) return '';
  const detail = (Array.isArray(breakdown.kistLines) ? breakdown.kistLines : [])
    .map((line) => `<div class="receipt-field"><dt>${escapeHtml(kistLineLabel(line))}:</dt><dd>${formatAmount(line.amount)}</dd></div>`).join('');
  return `<div class="receipt-field"><dt>${label}:</dt><dd>${formatAmount(breakdown.kistAmount)}</dd></div>${detail}`;
};

// SISP-33: FIFO split rows for the HTML receipt layouts. Empty when the
// bill is package-only (fifoShow false) or the receipt carries no split,
// so non-FIFO receipts render exactly as before.
const fifoReceiptRows = (receipt, formatAmount) => {
  if (!receipt?.fifoShow || !receipt.fifoAllocation || !receipt.fifoRemaining) return '';
  const a = receipt.fifoAllocation;
  const r = receipt.fifoRemaining;
  return `<div class="receipt-field"><dt>FIFO taqseem / payment split:</dt><dd>Sabiqa Baqaya ${formatAmount(a.toArrears)} · Mahana Bill ${formatAmount(a.toPackage)} · Kist ${formatAmount(a.toKist)}</dd></div>`
    + `<div class="receipt-field"><dt>Baqi Sabiqa Baqaya:</dt><dd>${formatAmount(r.arrears)}</dd></div>`
    + `<div class="receipt-field"><dt>Baqi Mahana Bill:</dt><dd>${formatAmount(r.package)}</dd></div>`
    + `<div class="receipt-field"><dt>Baqi Kist:</dt><dd>${formatAmount(r.kist)}</dd></div>`;
};

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate formatted, printable receipt markup supporting A4, 80mm thermal, and 58mm thermal layouts.
 * @param {Object} receipt - Output of buildPaymentReceipt
 * @param {Object} [options]
 * @param {string} [options.format='a4'] - 'a4' | 'thermal-80' | 'thermal-58'
 * @param {string} [options.businessName='Shahdara ISP']
 * @param {string} [options.businessPhone='0300-1234567']
 * @param {string} [options.areaName='Shahdara, Lahore']
 * @returns {string} HTML markup
 */
export function generatePaymentReceiptHtml(receipt, {
  format = 'a4',
  businessName = 'Shahdara ISP',
  businessPhone = '0300-1234567',
  areaName = 'Shahdara, Lahore'
} = {}) {
  if (!receipt) return '';

  // SISP-26 bilingual receipt name header: "Urdu name (Roman name)" when an
  // Urdu rendering exists and differs from the Roman name, else Roman only.
  // Receipts built before this field existed (no customerNameUrdu key) render
  // Roman only — the header never drops the saved Roman name.
  const displayName = receipt.customerNameUrdu && receipt.customerNameUrdu !== receipt.customerName
    ? `${receipt.customerNameUrdu} (${receipt.customerName})`
    : receipt.customerName;

  const formatAmount = (val) => {
    if (val === null || val === undefined || val === '') return 'PKR 0';
    const num = Number(val);
    return `PKR ${num.toLocaleString()}`;
  };

  const status = receipt.status || 'RECEIVED';
  const statusClass = status === 'PAID' ? 'receipt-status-paid' : status === 'PARTIAL' ? 'receipt-status-partial' : '';
  const balanceStr = receipt.balanceDueCents === null ? 'PKR 0' : formatAmount(receipt.balanceDueCents / 100);
  const balanceLabel = receipt.balanceDueCents === 0 ? 'PKR 0 (مکمل ادا شدہ / Paid)' : `${balanceStr} (بقایا جات / Due)`;

  if (format === 'thermal-58') {
    return `<article class="receipt-sheet thermal-receipt thermal-58" data-receipt-format="thermal-58">
  <header class="receipt-head">
    <div class="receipt-brand">${escapeHtml(businessName)}</div>
    <div class="receipt-subbrand">انٹرنیٹ ادائیگی رسید (58mm)</div>
    <div class="receipt-meta-line">${escapeHtml(areaName)} · Tel: ${escapeHtml(businessPhone)}</div>
    <div class="receipt-num">No: <strong>${escapeHtml(receipt.receiptNumber)}</strong></div>
  </header>
  <div class="receipt-divider">--------------------------------</div>
  <dl class="receipt-fields">
    <div class="receipt-field"><dt>Date / تاریخ:</dt><dd>${escapeHtml(receipt.paymentDate)}</dd></div>
    <div class="receipt-field"><dt>Cust ID / کھاتہ:</dt><dd>#${escapeHtml(receipt.customerId)}</dd></div>
    <div class="receipt-field"><dt>Name / صارف:</dt><dd>${escapeHtml(displayName)}</dd></div>
    <div class="receipt-field"><dt>Package / پیکیج:</dt><dd>${escapeHtml(receipt.package)}</dd></div>
    <div class="receipt-field"><dt>Month / بل ماہ:</dt><dd>${escapeHtml(receipt.servicePeriodStart ? receipt.servicePeriodStart.slice(0, 7) : '')}</dd></div>
    <div class="receipt-field"><dt>Method / طریقہ:</dt><dd>${escapeHtml(receipt.paymentMethod)}</dd></div>
    ${receipt.transactionId ? `<div class="receipt-field"><dt>Txn ID:</dt><dd>${escapeHtml(receipt.transactionId)}</dd></div>` : ''}
    ${receipt.senderLabel ? `<div class="receipt-field"><dt>Sender:</dt><dd>${escapeHtml(receipt.senderLabel)}</dd></div>` : ''}
    <div class="receipt-divider">--------------------------------</div>
    <div class="receipt-field"><dt>Billed / بل رقم:</dt><dd>${formatAmount(receipt.nominalPrice)}</dd></div>
    ${receipt.lateFee > 0 ? `<div class="receipt-field"><dt>Late Surcharge:</dt><dd>+${formatAmount(receipt.lateFee)}</dd></div>` : ''}
    ${prepayReceiptRows(receipt, formatAmount)}
    ${receipt.discount > 0 && !receipt.prepay ? `<div class="receipt-field"><dt>Discount / رعایت:</dt><dd>-${formatAmount(receipt.discount)}</dd></div>` : ''}
    ${receipt.concessionAmount > 0 ? `<div class="receipt-field"><dt>Outage Concession / رعایت:</dt><dd>-${formatAmount(receipt.concessionAmount)}${receipt.concessionReason ? ` (${escapeHtml(receipt.concessionReason)})` : ''}</dd></div>` : ''}
    ${receipt.referralCreditAmount > 0 ? `<div class="receipt-field"><dt>Referral Credit / ہمسایہ ریفرل:</dt><dd>-${formatAmount(receipt.referralCreditAmount)}${receipt.referralCreditReason ? ` (${escapeHtml(receipt.referralCreditReason)})` : ''}</dd></div>` : ''}
    ${receipt.depositOffsetAmount > 0 ? `<div class="receipt-field"><dt>Security Deposit Offset / سیکیورٹی ڈپازٹ تصفیہ:</dt><dd>-${formatAmount(receipt.depositOffsetAmount)}</dd></div>` : ''}
    ${ticketChargeReceiptRows(receipt, formatAmount)}
    ${receipt.arrearsBreakdown ? `<div class="receipt-field"><dt>Mahana Package:</dt><dd>${formatAmount(receipt.arrearsBreakdown.packageAmount)}</dd></div>${kistBreakdownRows(receipt.arrearsBreakdown, formatAmount, 'Kist')}<div class="receipt-field"><dt>Sabiqa Baqaya:</dt><dd>${formatAmount(receipt.arrearsBreakdown.previousArrears)}</dd></div><div class="receipt-field"><dt>Kul Qabil-e-Ada:</dt><dd>${formatAmount(receipt.arrearsBreakdown.totalDue)}</dd></div><div class="receipt-field"><dt>Wusool Paya:</dt><dd>${formatAmount(receipt.arrearsBreakdown.paidAmount)}</dd></div><div class="receipt-field"><dt>Baqi Rehta:</dt><dd>${formatAmount(receipt.arrearsBreakdown.balanceDue)}</dd></div>` : ''}
    ${fifoReceiptRows(receipt, formatAmount)}
    <div class="receipt-field receipt-paid-field"><dt><strong>PAID / موصولہ:</strong></dt><dd><strong>${formatAmount(receipt.paidAmount)}</strong></dd></div>
    <div class="receipt-field receipt-balance-field"><dt><strong>Balance / بقایا:</strong></dt><dd class="${statusClass}"><strong>${balanceLabel}</strong></dd></div>
    <div class="receipt-field"><dt>Status / کیفیت:</dt><dd class="${statusClass}">${escapeHtml(status)}</dd></div>
  </dl>
  <div class="receipt-divider">--------------------------------</div>
  <div class="receipt-urdu-notice" dir="rtl" lang="ur">${escapeHtml(RECEIPT_URDU_NOTE)}</div>
  <footer class="receipt-terms">
    <p class="receipt-footer-text">* شکریہ! Shahdara ISP *</p>
  </footer>
</article>`;
  }

  if (format === 'thermal-80' || format === 'thermal') {
    return `<article class="receipt-sheet thermal-receipt thermal-80" data-receipt-format="thermal-80">
  <header class="receipt-head">
    <div class="receipt-brand">${escapeHtml(businessName)}</div>
    <h1>Payment Receipt / رسید ادائیگی</h1>
    <p>${escapeHtml(areaName)} · Phone: ${escapeHtml(businessPhone)}</p>
    <div class="receipt-receipt-no">Receipt #: <strong>${escapeHtml(receipt.receiptNumber)}</strong></div>
  </header>
  <div class="receipt-divider">================================</div>
  <dl class="receipt-fields">
    <div class="receipt-field"><dt>Payment Date / تاریخ ادائیگی:</dt><dd>${escapeHtml(receipt.paymentDate)}</dd></div>
    <div class="receipt-field"><dt>Customer ID / کھاتہ نمبر:</dt><dd>#${escapeHtml(receipt.customerId)}</dd></div>
    <div class="receipt-field"><dt>Customer Name / صارف کا نام:</dt><dd>${escapeHtml(displayName)}</dd></div>
    <div class="receipt-field"><dt>Package / پیکیج پلان:</dt><dd>${escapeHtml(receipt.package)}${receipt.speedMbps ? ` (${receipt.speedMbps} Mbps)` : ''}</dd></div>
    <div class="receipt-field"><dt>Billing Month / بل کا مہینہ:</dt><dd>${escapeHtml(receipt.servicePeriodStart ? receipt.servicePeriodStart.slice(0, 7) : '')}</dd></div>
    <div class="receipt-field"><dt>Payment Method / طریقہ کار:</dt><dd>${escapeHtml(receipt.paymentMethod)}</dd></div>
    ${receipt.transactionId ? `<div class="receipt-field"><dt>Transaction ID / ٹرانزیکشن نمبر:</dt><dd>${escapeHtml(receipt.transactionId)}</dd></div>` : ''}
    ${receipt.senderLabel ? `<div class="receipt-field"><dt>Sender / بھیجنے والا:</dt><dd>${escapeHtml(receipt.senderLabel)}</dd></div>` : ''}
    <div class="receipt-divider">--------------------------------</div>
    <div class="receipt-field"><dt>Monthly Fee / ماہانہ واجبات:</dt><dd>${formatAmount(receipt.nominalPrice)}</dd></div>
    ${receipt.lateFee > 0 ? `<div class="receipt-field"><dt>Late Surcharge / تاخیری فیس:</dt><dd>+${formatAmount(receipt.lateFee)}</dd></div>` : ''}
    ${prepayReceiptRows(receipt, formatAmount)}
    ${receipt.discount > 0 && !receipt.prepay ? `<div class="receipt-field"><dt>Concession / رعایت بل:</dt><dd>-${formatAmount(receipt.discount)}${receipt.discountReason ? ` (${escapeHtml(receipt.discountReason)})` : ''}</dd></div>` : ''}
    ${receipt.concessionAmount > 0 ? `<div class="receipt-field"><dt>Outage Concession / رعایت:</dt><dd>-${formatAmount(receipt.concessionAmount)}${receipt.concessionReason ? ` (${escapeHtml(receipt.concessionReason)})` : ''}</dd></div>` : ''}
    ${receipt.referralCreditAmount > 0 ? `<div class="receipt-field"><dt>Referral Credit / ہمسایہ ریفرل:</dt><dd>-${formatAmount(receipt.referralCreditAmount)}${receipt.referralCreditReason ? ` (${escapeHtml(receipt.referralCreditReason)})` : ''}</dd></div>` : ''}
    ${receipt.depositOffsetAmount > 0 ? `<div class="receipt-field"><dt>Security Deposit Offset / سیکیورٹی ڈپازٹ تصفیہ:</dt><dd>-${formatAmount(receipt.depositOffsetAmount)}</dd></div>` : ''}
    ${ticketChargeReceiptRows(receipt, formatAmount)}
    ${receipt.lateFee > 0 || receipt.discount > 0 ? `<div class="receipt-field"><dt>Total Payable / کل واجب الادا:</dt><dd>${formatAmount(receipt.totalBilled)}</dd></div>` : ''}
    ${receipt.arrearsBreakdown ? `<div class="receipt-field"><dt>Mahana Package / ماہانہ پیکیج:</dt><dd>${formatAmount(receipt.arrearsBreakdown.packageAmount)}</dd></div>${kistBreakdownRows(receipt.arrearsBreakdown, formatAmount, 'Kist / قسط')}<div class="receipt-field"><dt>Sabiqa Baqaya / سابقہ بقایا:</dt><dd>${formatAmount(receipt.arrearsBreakdown.previousArrears)}</dd></div><div class="receipt-field"><dt>Kul Qabil-e-Ada / کل قابل ادا:</dt><dd>${formatAmount(receipt.arrearsBreakdown.totalDue)}</dd></div><div class="receipt-field"><dt>Wusool Paya / وصول پایا:</dt><dd>${formatAmount(receipt.arrearsBreakdown.paidAmount)}</dd></div><div class="receipt-field"><dt>Baqi Rehta / باقی رہتا:</dt><dd>${formatAmount(receipt.arrearsBreakdown.balanceDue)}</dd></div>` : ''}
    ${fifoReceiptRows(receipt, formatAmount)}
    <div class="receipt-field receipt-paid-field"><dt><strong>Amount Received / رقم موصول:</strong></dt><dd><strong>${formatAmount(receipt.paidAmount)}</strong></dd></div>
    <div class="receipt-field receipt-balance-field"><dt><strong>Balance Due / باقی واجبات:</strong></dt><dd class="${statusClass}"><strong>${balanceLabel}</strong></dd></div>
    <div class="receipt-field"><dt>Receipt Status / بل کی حالت:</dt><dd class="${statusClass}"><strong>${escapeHtml(status)}</strong></dd></div>
  </dl>
  <div class="receipt-divider">================================</div>
  <div class="receipt-urdu-notice" dir="rtl" lang="ur">
    <p><strong>نوٹ:</strong> ${escapeHtml(RECEIPT_URDU_NOTE)}</p>
  </div>
  <footer class="receipt-terms">
    <p dir="rtl" lang="ur">${escapeHtml(PACKAGE_TERMS_NOTE).replaceAll('\n', '<br>')}</p>
    <p class="receipt-footer-text">*** برائے مہربانی رسید سنبھال کر رکھیں۔ شکریہ! ***</p>
  </footer>
</article>`;
  }

  // Default: A4 Layout
  const fields = [
    ['Receipt Number / رسید نمبر', receipt.receiptNumber],
    ['Customer Name / صارف کا نام', displayName],
    ['Account / Customer ID', receipt.customerId ? `#${receipt.customerId}` : ''],
    ['Payment Date / تاریخ ادائیگی', receipt.paymentDate],
    ['Transaction ID', receipt.transactionId],
    ...(receipt.senderLabel ? [['Sender / بھیجنے والا', receipt.senderLabel]] : []),
    ['Package / پیکیج', receipt.package],
    ['Internet Speed', receipt.speedMbps ? `${receipt.speedMbps} Mbps` : ''],
    ['Package Duration', receipt.packageDuration],
    ['Package Type', receipt.packageType],
    ['Data Limit', receipt.dataLimit],
    ['Nominal Package Price', receipt.nominalPrice === null ? '' : formatAmount(receipt.nominalPrice)],
    ...(receipt.lateFee > 0 ? [['Late Fee Surcharge', `+${formatAmount(receipt.lateFee)}`]] : []),
    ...(receipt.lateFee > 0 ? [['Total Gross Payable', formatAmount(receipt.totalBilled)]] : []),
    ...(receipt.concessionAmount > 0 ? [['Outage Concession (Reaayat)', `-${formatAmount(receipt.concessionAmount)}${receipt.concessionReason ? ` (${receipt.concessionReason})` : ''}`]] : []),
    ...(receipt.referralCreditAmount > 0 ? [['Hamsaya Referral Credit', `-${formatAmount(receipt.referralCreditAmount)}${receipt.referralCreditReason ? ` (${receipt.referralCreditReason})` : ''}`]] : []),
    ...(receipt.depositOffsetAmount > 0 ? [['Security Deposit Offset', `-${formatAmount(receipt.depositOffsetAmount)}`]] : []),
    ...(Array.isArray(receipt.ticketCharges) ? receipt.ticketCharges.map((line) => [`Murammat / Material Charge (${line.ticketId})`, formatAmount(line.amount)]) : []),
    ...(receipt.prepay ? [['Prepay Coverage', `${formatAmount(receipt.prepay.gross)} (${receipt.prepay.months} months from ${receipt.prepay.startMonth})`], ...(receipt.prepay.discount > 0 ? [['Prepay Discount', `-${formatAmount(receipt.prepay.discount)}`]] : []), ['Prepay Cash Paid', formatAmount(receipt.prepay.cashPaid)]] : []),
    ...(receipt.discount > 0 && !receipt.prepay ? [['Concession / Discount', `-${formatAmount(receipt.discount)}${receipt.discountReason ? ` (${receipt.discountReason})` : ''}`]] : []),
    ...(receipt.arrearsBreakdown ? [
      ['Mahana Package / ماہانہ پیکیج', formatAmount(receipt.arrearsBreakdown.packageAmount)],
      ...(receipt.arrearsBreakdown.kistAmount > 0 ? [
        ['Kist / قسط', formatAmount(receipt.arrearsBreakdown.kistAmount)],
        ...(Array.isArray(receipt.arrearsBreakdown.kistLines) ? receipt.arrearsBreakdown.kistLines.map((line) => [kistLineLabel(line), formatAmount(line.amount)]) : [])
      ] : []),
      ['Sabiqa Baqaya / سابقہ بقایا', formatAmount(receipt.arrearsBreakdown.previousArrears)],
      ['Kul Qabil-e-Ada / کل قابل ادا', formatAmount(receipt.arrearsBreakdown.totalDue)],
      ['Wusool Paya / وصول پایا', formatAmount(receipt.arrearsBreakdown.paidAmount)],
      ['Baqi Rehta / باقی رہتا', formatAmount(receipt.arrearsBreakdown.balanceDue)]
    ] : []),
    ...(receipt.fifoShow && receipt.fifoAllocation && receipt.fifoRemaining ? [
      ['FIFO taqseem / payment split', `Sabiqa Baqaya ${formatAmount(receipt.fifoAllocation.toArrears)} · Mahana Bill ${formatAmount(receipt.fifoAllocation.toPackage)} · Kist ${formatAmount(receipt.fifoAllocation.toKist)}`],
      ['Baqi Sabiqa Baqaya', formatAmount(receipt.fifoRemaining.arrears)],
      ['Baqi Mahana Bill', formatAmount(receipt.fifoRemaining.package)],
      ['Baqi Kist', formatAmount(receipt.fifoRemaining.kist)]
    ] : []),
    ['Package Date', receipt.packageDate],
    ['Amount Received / رقم موصول', receipt.paidAmount === null ? '' : formatAmount(receipt.paidAmount), 'receipt-amount'],
    ['Payment Method / ذریعہ ادائیگی', receipt.paymentMethod],
    ['Service Period Start', receipt.servicePeriodStart],
    ['Service Period End', receipt.servicePeriodEnd],
    ['Receipt Status / کیفیت', receipt.status, statusClass],
    ['Balance Due After Payment / باقی واجبات', balanceLabel, statusClass]
  ];

  return `<article class="receipt-sheet a4-receipt" data-receipt-format="a4">
  <header class="receipt-head">
    <div>
      <span class="receipt-brand">${escapeHtml(businessName)}</span>
      <h1>Payment Receipt / رسید بل ادائیگی</h1>
      <p>Official Customer Record · ${escapeHtml(areaName)} · Phone: ${escapeHtml(businessPhone)}</p>
      <div class="receipt-num-badge">Permanent Receipt: <strong>${escapeHtml(receipt.receiptNumber)}</strong></div>
    </div>
    <span class="receipt-mark ${statusClass}">${escapeHtml(status)}</span>
  </header>
  <dl class="receipt-fields">
    ${fields.map(([label, val, cls]) => `<div class="receipt-field"><dt>${escapeHtml(label)}</dt><dd class="${cls || ''}">${val ? escapeHtml(val) : '&nbsp;'}</dd></div>`).join('')}
  </dl>
  <div class="receipt-urdu-notice" dir="rtl" lang="ur">
    <strong>اہم معلوماتی نوٹ:</strong> ${escapeHtml(RECEIPT_URDU_NOTE)}
  </div>
  ${status === 'PAID' ? '<p class="receipt-reminder">⚠️ Please pay by the 5th of each calendar month to avoid service interruption. Thanks 🥰</p>' : ''}
  <footer class="receipt-terms">
    <h2>Package Terms &amp; Conditions / شرائط پیکیج</h2>
    <p dir="rtl" lang="ur">${escapeHtml(PACKAGE_TERMS_NOTE).replaceAll('\n', '<br>')}</p>
    <div class="receipt-signatures">
      <div class="receipt-sig-box"><span>دستخط وصول کنندہ / Collector</span></div>
      <div class="receipt-sig-box"><span>مہر و دستخط ادارہ / Shahdara ISP</span></div>
    </div>
  </footer>
</article>`;
}

// SISP-29: Down-Payment + Kist Schedule Receipt. The down payment itself
// is recorded as an ordinary payment entry (via core.addPayment) on the
// current month's bill, so this snapshot only describes that payment plus
// the plan it belongs to — it never creates a second ledger entry. The
// schedule mirrors cycle billing (monthlyKist per installment); the
// remaining figure is the plan's stated remainder (total - down payment).
export function buildDownPaymentKistReceipt(customer, plan, payment) {
  if (!customer || !plan || !payment) throw new Error('A saved customer, installment plan and down payment are required.');
  const sane = sanitizeInstallmentPlan(plan);
  if (!sane) throw new Error('A valid installment plan is required.');
  const paid = positiveAmount(payment.amount);
  if (paid === null) throw new Error('A valid down payment amount is required.');
  return {
    customerName: text(customer.name),
    customerId: Number.isSafeInteger(customer.customerNumber) && customer.customerNumber > 0 ? String(customer.customerNumber) : '',
    receiptNumber: generateReceiptNumber({
      customerNumber: customer.customerNumber,
      paymentDate: validStoredDate(payment.date),
      paymentId: payment.id
    }),
    paymentDate: validStoredDate(payment.date),
    paymentMethod: text(payment.method),
    itemTitle: sane.itemTitle,
    totalAmount: sane.totalAmount,
    downPayment: sane.downPayment,
    paidDownPayment: paid,
    monthlyKist: sane.monthlyKist,
    totalMonths: sane.totalMonths,
    remainingAfterDownPayment: Math.max(0, Number((sane.totalAmount - sane.downPayment).toFixed(2))),
    schedule: kistSchedule(sane),
    urduNote: RECEIPT_URDU_NOTE
  };
}

// SISP-29: printable down-payment receipt. Single A4-style layout reusing
// the standard receipt classes, so the existing print CSS applies. Paper
// styling is deliberate (like the SISP-6 slip), not an app UI surface.
export function buildDownPaymentKistReceiptHtml(receipt, {
  businessName = 'Shahdara ISP',
  businessPhone = '0300-1234567',
  areaName = 'Shahdara, Lahore'
} = {}) {
  if (!receipt) return '';
  const formatAmount = (val) => {
    if (val === null || val === undefined || val === '') return 'PKR 0';
    const num = Number(val);
    return `PKR ${num.toLocaleString()}`;
  };
  const rows = (Array.isArray(receipt.schedule) ? receipt.schedule : [])
    .map((row) => `<div class="receipt-field"><dt>Kist ${row.installmentNumber}/${row.totalMonths}:</dt><dd>${formatAmount(row.amount)} (${row.status === 'billed' ? 'billed' : 'remaining'})</dd></div>`).join('');
  return `<article class="receipt-sheet" data-receipt-format="down-payment-kist">
  <header class="receipt-head">
    <div class="receipt-brand">${escapeHtml(businessName)}</div>
    <h1>Down Payment Receipt / پیشگی ادائیگی رسید</h1>
    <p>${escapeHtml(areaName)} · Phone: ${escapeHtml(businessPhone)}</p>
    <div class="receipt-receipt-no">Receipt #: <strong>${escapeHtml(receipt.receiptNumber)}</strong></div>
  </header>
  <div class="receipt-divider">================================</div>
  <dl class="receipt-fields">
    <div class="receipt-field"><dt>Payment Date / تاریخ ادائیگی:</dt><dd>${escapeHtml(receipt.paymentDate)}</dd></div>
    <div class="receipt-field"><dt>Customer ID / کھاتہ نمبر:</dt><dd>#${escapeHtml(receipt.customerId)}</dd></div>
    <div class="receipt-field"><dt>Customer Name / صارف کا نام:</dt><dd>${escapeHtml(receipt.customerName)}</dd></div>
    <div class="receipt-field"><dt>Item / چیز:</dt><dd>${escapeHtml(receipt.itemTitle)}</dd></div>
    <div class="receipt-field"><dt>Payment Method / طریقہ کار:</dt><dd>${escapeHtml(receipt.paymentMethod)}</dd></div>
    <div class="receipt-divider">--------------------------------</div>
    <div class="receipt-field"><dt>Total Amount / کل رقم:</dt><dd>${formatAmount(receipt.totalAmount)}</dd></div>
    <div class="receipt-field receipt-paid-field"><dt><strong>Down Payment Received / موصولہ پیشگی:</strong></dt><dd><strong>${formatAmount(receipt.paidDownPayment)}</strong></dd></div>
    <div class="receipt-field"><dt>Monthly Kist / ماہانہ قسط:</dt><dd>${formatAmount(receipt.monthlyKist)} × ${receipt.totalMonths} months</dd></div>
    <div class="receipt-field"><dt>Remaining After Down Payment / بقایا:</dt><dd>${formatAmount(receipt.remainingAfterDownPayment)}</dd></div>
    <div class="receipt-divider">--------------------------------</div>
    <div class="receipt-field"><dt>Kist Schedule / قسطوں کی تفصیل:</dt><dd></dd></div>
    ${rows}
  </dl>
  <div class="receipt-divider">--------------------------------</div>
  <div class="receipt-urdu-notice" dir="rtl" lang="ur">${escapeHtml(receipt.urduNote)}</div>
  <footer class="receipt-terms">
    <p class="receipt-footer-text">* شکریہ! Shahdara ISP *</p>
  </footer>
</article>`;
}

// SISP-50: Final Disconnection Clearance Receipt. The settlement itself
// is recorded by hardware-custody.js applyDepositSettlement (deposit
// consumed, arrears offset as audited discount records, settlement
// stamped on the customer); this snapshot only READS that stamp — it
// never creates a second ledger entry. Null when the customer has no
// settlement, so an unsettled profile can never print a clearance.
export function buildDepositSettlementReceipt(customer) {
  const settlement = sanitizeDepositSettlement(customer?.depositSettlement);
  if (!customer || !settlement) return null;
  const receiptNumber = settlement.receiptNumber || generateReceiptNumber({
    customerNumber: customer.customerNumber,
    paymentDate: settlement.settledAt,
    paymentId: 'DSET'
  });
  const fullyCleared = settlement.arrearsRemaining <= 0 && settlement.hardwareOutstanding <= 0;
  return {
    customerName: text(customer.name),
    customerNameUrdu: urduNameFor(customer),
    customerId: Number.isSafeInteger(customer.customerNumber) && customer.customerNumber > 0 ? String(customer.customerNumber) : '',
    settlementDate: settlement.settledAt,
    receiptNumber,
    securityDeposit: settlement.securityDeposit,
    arrearsOffset: settlement.arrearsOffset,
    unrecoveredHardwareCharge: settlement.unrecoveredHardwareCharge,
    hardwareCovered: settlement.hardwareCovered,
    refundAmount: settlement.refundAmount,
    arrearsRemaining: settlement.arrearsRemaining,
    hardwareOutstanding: settlement.hardwareOutstanding,
    offsets: settlement.offsets,
    hardwareCharges: settlement.hardwareCharges,
    status: fullyCleared ? 'CLEARED' : 'PARTIALLY CLEARED',
    urduNote: 'یہ رسید اس بات کی تصدیق ہے کہ کسٹمر کا سیکیورٹی ڈپازٹ حتمی بقایا جات اور سامان کی کٹوتی کے بعد تصفیہ کر دیا گیا ہے۔ شکریہ!'
  };
}

// SISP-50: printable clearance receipt. Single A4-style layout reusing
// the standard receipt classes (the SISP-29 down-payment pattern), so
// the existing print CSS applies. Paper styling is deliberate, not an
// app UI surface.
export function generateDepositSettlementReceiptHtml(receipt, {
  businessName = 'Shahdara ISP',
  businessPhone = '0300-1234567',
  areaName = 'Shahdara, Lahore'
} = {}) {
  if (!receipt) return '';
  const displayName = receipt.customerNameUrdu && receipt.customerNameUrdu !== receipt.customerName
    ? `${receipt.customerNameUrdu} (${receipt.customerName})`
    : receipt.customerName;
  const formatAmount = (val) => {
    if (val === null || val === undefined || val === '') return 'PKR 0';
    const num = Number(val);
    return `PKR ${num.toLocaleString()}`;
  };
  const offsetRows = (Array.isArray(receipt.offsets) ? receipt.offsets : [])
    .map((row) => `<div class="receipt-field"><dt>Arrears offset — ${escapeHtml(row.month)}:</dt><dd>-${formatAmount(row.amount)}</dd></div>`).join('');
  const hardwareRows = (Array.isArray(receipt.hardwareCharges) ? receipt.hardwareCharges : [])
    .map((row) => `<div class="receipt-field"><dt>Unrecovered ${escapeHtml(row.label)}:</dt><dd>${row.amount > 0 ? `-${formatAmount(row.amount)}` : 'No recorded price — PKR 0'}</dd></div>`).join('');
  const statusClass = receipt.status === 'CLEARED' ? 'receipt-status-paid' : 'receipt-status-partial';
  return `<article class="receipt-sheet a4-receipt" data-receipt-format="deposit-settlement">
  <header class="receipt-head">
    <div>
      <span class="receipt-brand">${escapeHtml(businessName)}</span>
      <h1>Final Disconnection Clearance Receipt / حتمی منقطعی کلیئرنس رسید</h1>
      <p>${escapeHtml(areaName)} · Phone: ${escapeHtml(businessPhone)}</p>
      <div class="receipt-num-badge">Clearance Receipt: <strong>${escapeHtml(receipt.receiptNumber)}</strong></div>
    </div>
    <span class="receipt-mark ${statusClass}">${escapeHtml(receipt.status)}</span>
  </header>
  <dl class="receipt-fields">
    <div class="receipt-field"><dt>Settlement Date / تاریخ تصفیہ:</dt><dd>${escapeHtml(receipt.settlementDate)}</dd></div>
    <div class="receipt-field"><dt>Customer ID / کھاتہ نمبر:</dt><dd>#${escapeHtml(receipt.customerId)}</dd></div>
    <div class="receipt-field"><dt>Customer Name / صارف کا نام:</dt><dd>${escapeHtml(displayName)}</dd></div>
    <div class="receipt-divider">--------------------------------</div>
    <div class="receipt-field"><dt>Security Deposit Held / سیکیورٹی ڈپازٹ:</dt><dd>${formatAmount(receipt.securityDeposit)}</dd></div>
    <div class="receipt-field"><dt>Arrears Cleared by Deposit Offset / بقایا تصفیہ:</dt><dd>-${formatAmount(receipt.arrearsOffset)}</dd></div>
    ${offsetRows}
    ${receipt.unrecoveredHardwareCharge > 0 || (Array.isArray(receipt.hardwareCharges) && receipt.hardwareCharges.length > 0) ? hardwareRows : `<div class="receipt-field"><dt>Hardware / سامان:</dt><dd>All recovered — no charge</dd></div>`}
    ${receipt.hardwareCovered > 0 ? `<div class="receipt-field"><dt>Hardware Charge Deducted / سامان کٹوتی:</dt><dd>-${formatAmount(receipt.hardwareCovered)}</dd></div>` : ''}
    <div class="receipt-field receipt-paid-field"><dt><strong>Net Refund to Customer / قابل واپسی رقم:</strong></dt><dd><strong>${formatAmount(receipt.refundAmount)}</strong></dd></div>
    ${receipt.arrearsRemaining > 0 ? `<div class="receipt-field"><dt>Arrears Still Outstanding / بقایا باقی:</dt><dd>${formatAmount(receipt.arrearsRemaining)}</dd></div>` : ''}
    ${receipt.hardwareOutstanding > 0 ? `<div class="receipt-field"><dt>Hardware Charge Still Outstanding:</dt><dd>${formatAmount(receipt.hardwareOutstanding)}</dd></div>` : ''}
    <div class="receipt-field"><dt>Status / کیفیت:</dt><dd class="${statusClass}"><strong>${escapeHtml(receipt.status)}</strong></dd></div>
  </dl>
  <div class="receipt-divider">================================</div>
  <div class="receipt-urdu-notice" dir="rtl" lang="ur">${escapeHtml(receipt.urduNote)}</div>
  <footer class="receipt-terms">
    <div class="receipt-signatures">
      <div class="receipt-sig-box"><span>دستخط وصول کنندہ / Collector</span></div>
      <div class="receipt-sig-box"><span>مہر و دستخط ادارہ / Shahdara ISP</span></div>
    </div>
    <p class="receipt-footer-text">* شکریہ! Shahdara ISP *</p>
  </footer>
</article>`;
}
