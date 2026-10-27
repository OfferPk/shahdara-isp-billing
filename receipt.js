import { calculatePaymentAllocations } from './core.js';
import { classifyPackagePrice, validateBillPackageSnapshot } from './package-catalog.js';
import { buildArrearsBreakdown } from './billing-cycle.js';

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
    const dueCents = cents(billDue) + cents(lateFee);
    const allocations = calculatePaymentAllocations({ customers:[customer] });
    const summary = allocations.forMonth(customer.id, matchingBill.month);
    const carryInCents = Math.min(dueCents, Math.max(0, Number(summary?.creditAppliedCents) || 0));
    const paidBeforeCents = orderedPayments.slice(0, selectedIndex)
      .reduce((sum, row) => sum + cents(positiveAmount(row.amount) ?? 0) + cents(positiveAmount(row.discount) ?? 0), 0);
    const thisEffectiveCents = cents(positiveAmount(payment.amount) ?? 0) + cents(positiveAmount(payment.discount) ?? 0);
    const receivedThroughCents = paidBeforeCents + thisEffectiveCents;
    const coveredBeforeReceipt = carryInCents + paidBeforeCents >= dueCents;
    balanceDueCents = Math.max(0, dueCents - carryInCents - receivedThroughCents);
    if (coveredBeforeReceipt) status = 'CREDIT RECEIVED';
    else if (balanceDueCents === 0) status = 'PAID';
    else if (carryInCents + receivedThroughCents > 0) status = 'PARTIAL';
  }

  const transactionId = text(payment.transactionId);
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
    customerId:Number.isSafeInteger(customer.customerNumber) && customer.customerNumber > 0 ? String(customer.customerNumber) : '',
    paymentDate:validStoredDate(payment.date),
    transactionId,
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
    totalBilled: (nominalPrice !== null ? nominalPrice : 0) + lateFee,
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
    arrearsBreakdown: buildArrearsBreakdown(customer, bill)
  };
}

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
    <div class="receipt-field"><dt>Name / صارف:</dt><dd>${escapeHtml(receipt.customerName)}</dd></div>
    <div class="receipt-field"><dt>Package / پیکیج:</dt><dd>${escapeHtml(receipt.package)}</dd></div>
    <div class="receipt-field"><dt>Month / بل ماہ:</dt><dd>${escapeHtml(receipt.servicePeriodStart ? receipt.servicePeriodStart.slice(0, 7) : '')}</dd></div>
    <div class="receipt-field"><dt>Method / طریقہ:</dt><dd>${escapeHtml(receipt.paymentMethod)}</dd></div>
    ${receipt.transactionId ? `<div class="receipt-field"><dt>Txn ID:</dt><dd>${escapeHtml(receipt.transactionId)}</dd></div>` : ''}
    <div class="receipt-divider">--------------------------------</div>
    <div class="receipt-field"><dt>Billed / بل رقم:</dt><dd>${formatAmount(receipt.nominalPrice)}</dd></div>
    ${receipt.lateFee > 0 ? `<div class="receipt-field"><dt>Late Surcharge:</dt><dd>+${formatAmount(receipt.lateFee)}</dd></div>` : ''}
    ${receipt.discount > 0 ? `<div class="receipt-field"><dt>Discount / رعایت:</dt><dd>-${formatAmount(receipt.discount)}</dd></div>` : ''}
    ${receipt.arrearsBreakdown ? `<div class="receipt-field"><dt>Mahana Package:</dt><dd>${formatAmount(receipt.arrearsBreakdown.packageAmount)}</dd></div><div class="receipt-field"><dt>Sabiqa Baqaya:</dt><dd>${formatAmount(receipt.arrearsBreakdown.previousArrears)}</dd></div><div class="receipt-field"><dt>Kul Qabil-e-Ada:</dt><dd>${formatAmount(receipt.arrearsBreakdown.totalDue)}</dd></div><div class="receipt-field"><dt>Wusool Paya:</dt><dd>${formatAmount(receipt.arrearsBreakdown.paidAmount)}</dd></div><div class="receipt-field"><dt>Baqi Rehta:</dt><dd>${formatAmount(receipt.arrearsBreakdown.balanceDue)}</dd></div>` : ''}
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
    <div class="receipt-field"><dt>Customer Name / صارف کا نام:</dt><dd>${escapeHtml(receipt.customerName)}</dd></div>
    <div class="receipt-field"><dt>Package / پیکیج پلان:</dt><dd>${escapeHtml(receipt.package)}${receipt.speedMbps ? ` (${receipt.speedMbps} Mbps)` : ''}</dd></div>
    <div class="receipt-field"><dt>Billing Month / بل کا مہینہ:</dt><dd>${escapeHtml(receipt.servicePeriodStart ? receipt.servicePeriodStart.slice(0, 7) : '')}</dd></div>
    <div class="receipt-field"><dt>Payment Method / طریقہ کار:</dt><dd>${escapeHtml(receipt.paymentMethod)}</dd></div>
    ${receipt.transactionId ? `<div class="receipt-field"><dt>Transaction ID / ٹرانزیکشن نمبر:</dt><dd>${escapeHtml(receipt.transactionId)}</dd></div>` : ''}
    <div class="receipt-divider">--------------------------------</div>
    <div class="receipt-field"><dt>Monthly Fee / ماہانہ واجبات:</dt><dd>${formatAmount(receipt.nominalPrice)}</dd></div>
    ${receipt.lateFee > 0 ? `<div class="receipt-field"><dt>Late Surcharge / تاخیری فیس:</dt><dd>+${formatAmount(receipt.lateFee)}</dd></div>` : ''}
    ${receipt.discount > 0 ? `<div class="receipt-field"><dt>Concession / رعایت بل:</dt><dd>-${formatAmount(receipt.discount)}${receipt.discountReason ? ` (${escapeHtml(receipt.discountReason)})` : ''}</dd></div>` : ''}
    ${receipt.lateFee > 0 || receipt.discount > 0 ? `<div class="receipt-field"><dt>Total Payable / کل واجب الادا:</dt><dd>${formatAmount(receipt.totalBilled)}</dd></div>` : ''}
    ${receipt.arrearsBreakdown ? `<div class="receipt-field"><dt>Mahana Package / ماہانہ پیکیج:</dt><dd>${formatAmount(receipt.arrearsBreakdown.packageAmount)}</dd></div><div class="receipt-field"><dt>Sabiqa Baqaya / سابقہ بقایا:</dt><dd>${formatAmount(receipt.arrearsBreakdown.previousArrears)}</dd></div><div class="receipt-field"><dt>Kul Qabil-e-Ada / کل قابل ادا:</dt><dd>${formatAmount(receipt.arrearsBreakdown.totalDue)}</dd></div><div class="receipt-field"><dt>Wusool Paya / وصول پایا:</dt><dd>${formatAmount(receipt.arrearsBreakdown.paidAmount)}</dd></div><div class="receipt-field"><dt>Baqi Rehta / باقی رہتا:</dt><dd>${formatAmount(receipt.arrearsBreakdown.balanceDue)}</dd></div>` : ''}
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
    ['Customer Name / صارف کا نام', receipt.customerName],
    ['Account / Customer ID', receipt.customerId ? `#${receipt.customerId}` : ''],
    ['Payment Date / تاریخ ادائیگی', receipt.paymentDate],
    ['Transaction ID', receipt.transactionId],
    ['Package / پیکیج', receipt.package],
    ['Internet Speed', receipt.speedMbps ? `${receipt.speedMbps} Mbps` : ''],
    ['Package Duration', receipt.packageDuration],
    ['Package Type', receipt.packageType],
    ['Data Limit', receipt.dataLimit],
    ['Nominal Package Price', receipt.nominalPrice === null ? '' : formatAmount(receipt.nominalPrice)],
    ...(receipt.lateFee > 0 ? [['Late Fee Surcharge', `+${formatAmount(receipt.lateFee)}`]] : []),
    ...(receipt.lateFee > 0 ? [['Total Gross Payable', formatAmount(receipt.totalBilled)]] : []),
    ...(receipt.discount > 0 ? [['Concession / Discount', `-${formatAmount(receipt.discount)}${receipt.discountReason ? ` (${receipt.discountReason})` : ''}`]] : []),
    ...(receipt.arrearsBreakdown ? [
      ['Mahana Package / ماہانہ پیکیج', formatAmount(receipt.arrearsBreakdown.packageAmount)],
      ['Sabiqa Baqaya / سابقہ بقایا', formatAmount(receipt.arrearsBreakdown.previousArrears)],
      ['Kul Qabil-e-Ada / کل قابل ادا', formatAmount(receipt.arrearsBreakdown.totalDue)],
      ['Wusool Paya / وصول پایا', formatAmount(receipt.arrearsBreakdown.paidAmount)],
      ['Baqi Rehta / باقی رہتا', formatAmount(receipt.arrearsBreakdown.balanceDue)]
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
