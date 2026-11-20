// Quick Collect receipt preview (Plan 433): the receipt exactly as it
// will print — customer, area, amount in digits and words, sales tax,
// method, receipt number, date, bill month, and the remaining balance
// after this payment — shown on the confirm step before anything is
// saved, so a wrong name, a wrong amount, a wrong area, a wrong tax,
// or a wrong month is caught while the customer is still standing at
// the counter, not when they read the receipt.
//
// This module previews ONLY. It issues no receipt number, reserves no
// number, records no payment, and changes no bill, payment, or receipt
// record by itself: it is a read-only view of the entry form's own
// figures, built by the caller from the values already on the form.
// The caller shows the preview beside the save confirmation summary
// on the same confirm step; going back returns to the form with the
// entries intact, and cancelling issues nothing.
//
// Where each figure comes from, so the preview can never drift from
// the receipt the save will issue:
//   - Customer name and number: the picked customer record itself.
//   - Area: the customer's area as the receipt prints it — mohalla
//     plus zone, 'Not recorded' when neither is set. The caller
//     passes the receipt's own derivation; the preview never shows
//     the mohalla-only short form.
//   - Amount: the amount field, read the same way the save reads it.
//   - Amount in words: the caller passes the words the form already
//     shows for that amount. The printed receipt carries no words
//     line of its own, so the words line here is the operator's check
//     aid only — it is derived from the same amount the receipt
//     prints, never from a second figure.
//   - Sales tax: the target bill's sales tax, in integer cents —
//     null when the bill carries no tax (untaxed, or a first-month-
//     waived bill), never 0. The caller reads it for the bill month
//     the preview claims, through the same helper the receipt uses.
//   - Method: the method field; blank reads as Cash, exactly as the
//     save records Cash when nothing is chosen.
//   - Receipt number: the next-number preview for this customer and
//     bill month — the same number the save stamps on the payment,
//     counted from the pre-save ledger (existing payments plus one).
//   - Date: the payment date field, read the same way the save reads
//     it. A date that is not a strict calendar day is refused, never
//     guessed.
//   - Bill month: the bill month the entry settles — the caller
//     passes the month the receipt number is counted under (the
//     month field or the target month). A preview without a strict
//     bill month is refused, never guessed: a month-less preview
//     would still match a receipt for the wrong month.
//   - Remaining balance: the caller's overall remaining after this
//     payment (all open balances plus pending charges, minus this
//     amount, never below zero) — a display figure only. The receipt
//     carries its own bill-only balance, which is a different figure
//     whenever pending charges exist, so the two are never compared.
// A split payment has no single receipt to preview — the customer
// leaves with the combined card instead — so a split entry previews
// nothing rather than a wrong receipt. The same rule hides the
// change calculator on a split entry.
//
// The match check is the acceptance, stated as a function: given the
// preview and the receipt built from the saved payment on the same
// fixture, every field the receipt prints must agree — customer name
// and number, area, amount, sales tax, method, receipt number, date,
// and bill month.
// The receipt's month is read from its service period start. The
// words line is not one of the printed fields, so it takes no part
// in the match; it follows the amount it was derived from. The
// remaining balance takes no part in the match either: it is the
// caller's overall remaining, and the receipt's own balance is a
// bill-only figure, so the two are never equal by construction.
//
// The module is standalone: it reads no storage, no clock, and no
// page, takes no other module, and never mutates an input.

const RECEIPT_PREVIEW_DATE_RE = /^(\d{4})-(0[1-9]|1[0-2])-(\d{2})$/;
const RECEIPT_PREVIEW_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Plan 580 (D3(a)): the tax row's label, hardcoded as the literal
// bilingual string — the same words the single card's tax row prints
// (its SALES_TAX_RECEIPT_LABEL), emoji and all — so the preview's tax
// row reads exactly like the receipt's. No `import` statement here:
// the module stays import-free, as the 433 purity test pins.
const RECEIPT_PREVIEW_TAX_LABEL = '🧾 Sales tax / سیلز ٹیکس (19.5%)';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function daysInMonth(year, month) {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

// A strict bill month (YYYY-MM). Anything else has no usable month,
// so there is no preview.
export function receiptPreviewIsStrictMonth(value) {
  return RECEIPT_PREVIEW_MONTH_RE.test(text(value));
}

// A strict calendar day (YYYY-MM-DD, leap-aware). Anything else has no
// usable date, so there is no preview.
export function receiptPreviewIsStrictDate(value) {
  const match = RECEIPT_PREVIEW_DATE_RE.exec(String(value ?? ''));
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return day >= 1 && day <= daysInMonth(year, month);
}

// A customer number as the receipt prints it: a positive safe integer,
// or a digits-only string kept exactly as given (leading zeros and
// all). Anything else has no usable number, so the field stays blank.
function customerNumberText(customerNumber) {
  if (Number.isSafeInteger(customerNumber) && customerNumber > 0) return String(customerNumber);
  const digits = text(customerNumber);
  return /^\d+$/.test(digits) ? digits : '';
}

// A typed figure is usable only as a finite number. Null, undefined,
// blank, boolean, and non-numeric input are "not a number", never
// zero — a missing figure must never read as a free payment (the
// defensive rule the dues default pins).
export function receiptPreviewFigureCents(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  const cleaned = String(value).trim().replace(/[\s,]/g, '');
  if (cleaned === '') return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

// Money in the app's min-0 style: PKR 2,000, PKR 1,500.5, PKR 0.5.
export function formatReceiptPreviewAmount(cents) {
  const value = Number(cents);
  if (!Number.isFinite(value)) return '';
  return `PKR ${(value / 100).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// The preview for one entry, or null when there is nothing worth
// previewing: no usable name, no positive amount, no receipt number,
// no strict date, no strict bill month, or a split entry (no single
// receipt to preview).
export function normalizeReceiptPreview(input) {
  const source = input && typeof input === 'object' ? input : {};
  if (source.split) return null;
  const customerName = text(source.customerName);
  if (!customerName) return null;
  const receiptNumber = text(source.receiptNumber);
  if (!receiptNumber) return null;
  const date = text(source.date);
  if (!receiptPreviewIsStrictDate(date)) return null;
  const billMonth = text(source.billMonth);
  if (!receiptPreviewIsStrictMonth(billMonth)) return null;
  const amountCents = receiptPreviewFigureCents(source.amount);
  if (amountCents === null || amountCents <= 0) return null;
  // The caller's overall remaining after this payment, in cents — a
  // display figure only. Null when the caller passes none (or a
  // non-integer), never zero: a missing figure must never read as a
  // fully-paid customer.
  const remainingBalanceCents = Number.isSafeInteger(source.remainingBalanceCents) && source.remainingBalanceCents >= 0
    ? source.remainingBalanceCents
    : null;
  // Plan 580 (D1(a)/D6(a)): the area, exactly as the receipt prints
  // it — mohalla plus zone, 'Not recorded' when neither is set. The
  // caller joins the raw parts; normalize re-derives the receipt's
  // trimmed form (each comma part trimmed, empties dropped) so the
  // match can never false-negative on whitespace.
  const area = text(source.area).split(',').map((part) => part.trim()).filter(Boolean).join(', ') || 'Not recorded';
  // Plan 580 (D2(a)/D5(a)/T9): the target bill's sales tax, in
  // integer cents — null when the bill carries no tax (untaxed, or a
  // first-month-waived bill), never 0, never a rupee float, so the
  // match compares cents against the receipt's own cents.
  const salesTaxCents = Number.isSafeInteger(source.salesTaxCents) && source.salesTaxCents > 0 ? source.salesTaxCents : null;
  return {
    customerName,
    customerNumber: customerNumberText(source.customerNumber),
    area,
    amountCents,
    amountText: formatReceiptPreviewAmount(amountCents),
    amountWords: text(source.amountWords),
    salesTaxCents,
    method: text(source.method) || 'Cash',
    receiptNumber,
    date,
    billMonth,
    remainingBalanceCents,
    remainingBalanceText: remainingBalanceCents === null ? '' : formatReceiptPreviewAmount(remainingBalanceCents),
  };
}

// The preview for a picked customer record plus the entry form's own
// figures. The caller passes the receipt number and the amount words
// in; this module never derives either from a second source. The
// caller likewise passes the area and the sales tax in — this module
// never derives them from the customer record itself (Plan 580 D1(a)).
export function receiptPreviewFor(input) {
  const source = input && typeof input === 'object' ? input : {};
  const customer = source.customer && typeof source.customer === 'object' ? source.customer : null;
  return normalizeReceiptPreview({
    customerName: customer ? customer.name : source.customerName,
    customerNumber: customer ? customer.customerNumber : source.customerNumber,
    area: source.area,
    amount: source.amount,
    amountWords: source.amountWords,
    salesTaxCents: source.salesTaxCents,
    method: source.method,
    receiptNumber: source.receiptNumber,
    date: source.date,
    billMonth: source.billMonth,
    remainingBalanceCents: source.remainingBalanceCents,
    split: source.split,
  });
}

// The preview as plain lines, in the order the receipt prints them.
// '' when there is no preview.
export function receiptPreviewLineText(preview) {
  if (!preview || typeof preview !== 'object') return '';
  const lines = [
    `Receipt: ${preview.receiptNumber}`,
    `Date: ${preview.date}`,
  ];
  if (receiptPreviewIsStrictMonth(preview.billMonth)) lines.push(`Bill month: ${preview.billMonth}`);
  lines.push(`Customer: ${preview.customerName}${preview.customerNumber ? ` (#${preview.customerNumber})` : ''}`);
  // Plan 580 (D4(a)): the area prints directly after the customer,
  // exactly as the receipt prints it — 'Not recorded' when the
  // customer has no area recorded.
  lines.push(`Area: ${preview.area}`);
  lines.push(`Amount: ${preview.amountText}`);
  // Plan 580 (D3(a)/D4(a)/T6): the tax prints directly after the
  // amount, with the receipt's own bilingual label — only when the
  // bill carries a tax. An untaxed or waived bill shows no tax row,
  // never PKR 0.
  if (Number.isSafeInteger(preview.salesTaxCents) && preview.salesTaxCents > 0) {
    lines.push(`${RECEIPT_PREVIEW_TAX_LABEL}: ${formatReceiptPreviewAmount(preview.salesTaxCents)}`);
  }
  if (preview.amountWords) lines.push(`Amount in words: ${preview.amountWords}`);
  if (Number.isSafeInteger(preview.remainingBalanceCents) && preview.remainingBalanceCents >= 0) {
    lines.push(`Remaining balance: ${preview.remainingBalanceText || formatReceiptPreviewAmount(preview.remainingBalanceCents)}`);
  }
  lines.push(`Method: ${preview.method}`);
  return lines.join('\n');
}

// The preview as markup for the confirm step. Every user-entered value
// is escaped; '' when there is no preview.
export function receiptPreviewHtml(preview) {
  if (!preview || typeof preview !== 'object') return '';
  const rows = [
    ['Receipt', preview.receiptNumber],
    ['Date', preview.date],
  ];
  if (receiptPreviewIsStrictMonth(preview.billMonth)) rows.push(['Bill month', preview.billMonth]);
  rows.push(['Customer', `${preview.customerName}${preview.customerNumber ? ` (#${preview.customerNumber})` : ''}`]);
  // Plan 580 (D4(a)): the area prints directly after the customer —
  // 'Not recorded' when the customer has no area recorded.
  rows.push(['Area', preview.area]);
  rows.push(['Amount', preview.amountText]);
  // Plan 580 (D3(a)/D4(a)/T6): the tax prints directly after the
  // amount, with the receipt's own bilingual label — only when the
  // bill carries a tax. An untaxed or waived bill shows no tax row,
  // never PKR 0.
  if (Number.isSafeInteger(preview.salesTaxCents) && preview.salesTaxCents > 0) {
    rows.push([RECEIPT_PREVIEW_TAX_LABEL, formatReceiptPreviewAmount(preview.salesTaxCents)]);
  }
  if (preview.amountWords) rows.push(['Amount in words', preview.amountWords]);
  if (Number.isSafeInteger(preview.remainingBalanceCents) && preview.remainingBalanceCents >= 0) {
    rows.push(['Remaining balance', preview.remainingBalanceText || formatReceiptPreviewAmount(preview.remainingBalanceCents)]);
  }
  rows.push(['Method', preview.method]);
  const fields = rows
    .map(([label, value]) => `<div class="receipt-field"><dt>${escapeHtml(label)}:</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join('');
  return `<div class="rpv-preview" role="region" aria-label="Receipt preview"><p class="rpv-preview-heading">Receipt preview</p>${fields}<p class="rpv-preview-note">Check the receipt before saving — nothing is saved yet.</p></div>`;
}

// The acceptance, as a function: the preview and the receipt built
// from the saved payment on the same fixture must agree on every
// field the receipt prints — customer name and number, amount,
// method, receipt number, date, and bill month. The receipt's month
// is read from its service period start. False whenever either side
// is missing or any field differs. The remaining balance takes no
// part in the match: it is the caller's overall remaining, and the
// receipt's own balance is a bill-only figure, so the two are never
// equal by construction.
export function receiptPreviewMatchesReceipt(preview, receipt) {
  if (!preview || typeof preview !== 'object') return false;
  if (!receipt || typeof receipt !== 'object') return false;
  if (preview.customerName !== text(receipt.customerName)) return false;
  if (preview.customerNumber !== text(receipt.customerId)) return false;
  const paidCents = receiptPreviewFigureCents(receipt.paidAmount);
  if (paidCents === null || paidCents !== preview.amountCents) return false;
  if (preview.method !== text(receipt.paymentMethod)) return false;
  // QC receipt numbering: the preview shows the global sequence, so the
  // match compares against the receipt's sequence when it has one —
  // the stored number stays the fallback for legacy receipts.
  const receiptNo = receipt.receiptSequence != null ? String(receipt.receiptSequence) : text(receipt.receiptNumber);
  if (preview.receiptNumber !== receiptNo) return false;
  if (preview.date !== text(receipt.paymentDate)) return false;
  if (preview.billMonth !== text(receipt.servicePeriodStart).slice(0, 7)) return false;
  // Plan 580 (D1(a)/D5(a)/D6(a)): the area must agree exactly as the
  // receipt prints it, and the tax must agree in integer cents —
  // null == null passes (untaxed), anything else must be equal.
  if (preview.area !== text(receipt.area)) return false;
  const receiptTaxCents = Number.isSafeInteger(receipt.salesTaxCents) && receipt.salesTaxCents > 0 ? receipt.salesTaxCents : null;
  if (preview.salesTaxCents !== receiptTaxCents) return false;
  return true;
}
