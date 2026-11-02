// Billing Invoice Register — read-only, period-filtered invoice view of the
// saved bills, shown on the Monthly Billing screen next to the monthly
// report. Periods are computed from the BILL MONTH (YYYY-MM) relative to an
// injectable current month, so tests never depend on the real clock.
//
// Status comes from the ledger itself: core.js calculatePaymentAllocations
// (which already excludes voided payments — SISP-34) + derivedBillStatus, so
// a bill whose only payment was voided can never read as Paid, and the paid
// amount shown is exactly billAmount - balanceDue for that bill month under
// the same attribution the monthly report uses (SISP-2 / SISP-33 views).
//
// Read-only feature: no storage keys, no data changes, no billing-logic
// changes. Bills carry no invoice number in this app, so the row reference
// is the real identifier the app has: customer number + bill month
// (e.g. "#12 · 2026-10"). An INV- number is never fabricated.
//
// SISP-176: each row also surfaces the SISP-43 ticket-charge split of the
// cash recorded on that bill. A settled ticket charge rides INSIDE a
// normal payment (payment.ticketCharges, stamped by Quick Collect); the
// allocation engine deliberately keeps that portion out of bill money, so
// the register's paidAmount never contained it. ticketChargesPaid is the
// ticket portion of the bill's NON-VOIDED payments (core's
// paymentTicketChargeCents — the one sanitization point), attributed to
// the bill the payment was recorded on, exactly like the payment itself.
// The split never inflates anything: totals.totalPaid stays the pre-split
// bill figure byte-for-byte, and the new ticketTotals only ADD the two
// views of the same cash (totalTicketChargesPaid, and totalCollected =
// totalPaid + totalTicketChargesPaid). Pending (unsettled) ticket charges
// are NOT surfaced here — they live on tickets, not on bill rows, and a
// current receivable has no bill-month to belong to; the Owner Khata
// closing report carries them as its month-end pending line instead.
import { calculatePaymentAllocations, derivedBillStatus, formatPKR, paymentTicketChargeCents } from './core.js';
import { isVoidedPayment } from './payment-void-audit.js';
//
// SISP-185 adds a printable summary sheet (A4 + 80mm) of the SAME register
// the screen shows: buildBillingRegisterPrintHtml consumes the register
// object buildBillingRegister already produced — the exact filtered rows
// and the exact totals — and never re-derives or re-filters anything, so
// the printed sheet, the screen and the CSV can never disagree. Because
// the sheet renders from the register's live row model, register columns
// added later (e.g. the SISP-176 ticket-charge split) flow into the sheet
// at reconciliation without a second column list being maintained here.
import { t } from './nav-language.js';
import { PARTNERS } from './partner-settlement.js';

export const BILLING_REGISTER_PERIODS = ['this', 'last', 'last3', 'last6', 'last12'];
export const BILLING_REGISTER_STATUSES = ['all', 'paid', 'partial', 'unpaid'];
// Owner wording: the register exists for "jo jo bill pay ho" — paid bills
// are the point, so Paid is the default chip; the rest are one tap away.
export const BILLING_REGISTER_DEFAULT_PERIOD = 'this';
export const BILLING_REGISTER_DEFAULT_STATUS = 'paid';

// Inclusive [from, to] month offsets from the current month per period.
const PERIOD_SPANS = { this: [0, 0], last: [-1, -1], last3: [-2, 0], last6: [-5, 0], last12: [-11, 0] };

export function normalizeBillingRegisterPeriod(value) {
  return BILLING_REGISTER_PERIODS.includes(value) ? value : BILLING_REGISTER_DEFAULT_PERIOD;
}

export function normalizeBillingRegisterStatus(value) {
  return BILLING_REGISTER_STATUSES.includes(value) ? value : BILLING_REGISTER_DEFAULT_STATUS;
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function validBillingRegisterMonth(value) {
  return typeof value === 'string' && MONTH_PATTERN.test(value);
}

// Local YYYY-MM month arithmetic (core.js shiftMonth is not exported).
export function shiftBillingRegisterMonth(month, delta) {
  if (!validBillingRegisterMonth(month)) return null;
  const [year, monthNumber] = month.split('-').map(Number);
  const total = year * 12 + (monthNumber - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`;
}

// Ascending list of bill months covered by a period, e.g. last3 with
// currentMonth 2026-10 -> ['2026-08', '2026-09', '2026-10'].
export function billingRegisterMonths(period, currentMonth) {
  if (!validBillingRegisterMonth(currentMonth)) return [];
  const [from, to] = PERIOD_SPANS[normalizeBillingRegisterPeriod(period)];
  const months = [];
  for (let delta = from; delta <= to; delta += 1) months.push(shiftBillingRegisterMonth(currentMonth, delta));
  return months;
}

const centsToAmount = (cents) => Number((cents / 100).toFixed(2));
const amountToCents = (amount) => Math.round(Number(amount || 0) * 100);

// Build the register for one period + status view. Only priced bills
// (derived status paid / partial / pending) become invoice rows — an
// unpriced bill is "not set", not an invoice. The ledger's 'pending'
// status is presented as 'unpaid' in the register.
export function buildBillingRegister(state, { period = BILLING_REGISTER_DEFAULT_PERIOD, status = BILLING_REGISTER_DEFAULT_STATUS, currentMonth } = {}) {
  const normalizedPeriod = normalizeBillingRegisterPeriod(period);
  const normalizedStatus = normalizeBillingRegisterStatus(status);
  const months = billingRegisterMonths(normalizedPeriod, currentMonth);
  const monthSet = new Set(months);
  const allocations = calculatePaymentAllocations(state);
  const rows = [];
  let periodBillCount = 0;
  for (const customer of state?.customers ?? []) {
    if (!customer) continue;
    for (const bill of customer.bills ?? []) {
      if (!bill || !monthSet.has(bill.month)) continue;
      const derived = derivedBillStatus(customer, bill, allocations);
      if (derived === 'not-set') continue;
      periodBillCount += 1;
      const rowStatus = derived === 'pending' ? 'unpaid' : derived;
      if (normalizedStatus !== 'all' && rowStatus !== normalizedStatus) continue;
      const summary = allocations?.forMonth?.(customer.id, bill.month) ?? null;
      const billAmountCents = summary?.billAmountCents ?? amountToCents(bill.dueAmount);
      const balanceDueCents = summary?.balanceDueCents ?? billAmountCents;
      const paidAmountCents = Math.max(0, billAmountCents - balanceDueCents);
      // SISP-176: ticket-charge portion of this bill's own payments. A
      // voided payment settles nothing (SISP-34), so its stamp counts
      // neither here nor in the paid amount above.
      const ticketChargesPaidCents = (bill.payments ?? []).reduce(
        (sum, payment) => (isVoidedPayment(payment) ? sum : sum + paymentTicketChargeCents(payment)),
        0
      );
      rows.push({
        reference: `#${customer.customerNumber} · ${bill.month}`,
        customerId: customer.id,
        customerNumber: customer.customerNumber,
        customerName: customer.name ?? '',
        mobile: customer.phone ?? '',
        packageSpeed: customer.packageSpeed || '',
        month: bill.month,
        billAmount: centsToAmount(billAmountCents),
        paidAmount: centsToAmount(paidAmountCents),
        ticketChargesPaid: centsToAmount(ticketChargesPaidCents),
        balanceDue: centsToAmount(balanceDueCents),
        status: rowStatus
      });
    }
  }
  // Newest bill month first, then customer number — a stable register order
  // shared by the screen and the CSV so the two always agree.
  rows.sort((a, b) => (a.month === b.month ? a.customerNumber - b.customerNumber : (a.month < b.month ? 1 : -1)));
  const totals = {
    count: rows.length,
    totalBilled: centsToAmount(rows.reduce((sum, row) => sum + amountToCents(row.billAmount), 0)),
    totalPaid: centsToAmount(rows.reduce((sum, row) => sum + amountToCents(row.paidAmount), 0))
  };
  // SISP-176: the ticket-charge split of the SAME visible rows. Kept out
  // of `totals` so the pre-split figures stay byte-identical; the identity
  // totalCollected = totalPaid + totalTicketChargesPaid holds in cents.
  const totalTicketChargesPaidCents = rows.reduce((sum, row) => sum + amountToCents(row.ticketChargesPaid), 0);
  const ticketTotals = {
    totalTicketChargesPaid: centsToAmount(totalTicketChargesPaidCents),
    totalCollected: centsToAmount(amountToCents(totals.totalPaid) + totalTicketChargesPaidCents)
  };
  return { period: normalizedPeriod, status: normalizedStatus, months, rows, totals, ticketTotals, periodBillCount };
}

// CSV export — house style (statement filtered export): English columns and
// contents, a NOTE row describing the filtered view, and a `_filtered`
// filename suffix. Serialized by the app's generateCsvContent helper.
export const BILLING_REGISTER_CSV_HEADERS = [
  { key: 'reference', label: 'Reference' },
  { key: 'customer', label: 'Customer' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'package', label: 'Package' },
  { key: 'month', label: 'Month' },
  { key: 'billAmount', label: 'Bill Amount' },
  { key: 'paidAmount', label: 'Paid Amount' },
  { key: 'status', label: 'Status' },
  // SISP-176: the split columns ride at the end so the long-standing
  // column positions (and every figure in them) stay exactly as before.
  { key: 'ticketChargesPaid', label: 'Ticket Charges Paid' },
  { key: 'collectedAmount', label: 'Total Collected' }
];

export const BILLING_REGISTER_STATUS_LABELS = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' };

export function billingRegisterCsvRows(register) {
  return (register?.rows ?? []).map((row) => ({
    reference: row.reference,
    customer: row.customerName,
    mobile: row.mobile,
    package: row.packageSpeed,
    month: row.month,
    billAmount: row.billAmount,
    paidAmount: row.paidAmount,
    status: BILLING_REGISTER_STATUS_LABELS[row.status] ?? row.status,
    ticketChargesPaid: row.ticketChargesPaid ?? 0,
    // Bill Paid + Ticket Charges Paid — the cash this row's receipts
    // actually brought in (SISP-176 identity, per row).
    collectedAmount: centsToAmount(amountToCents(row.paidAmount) + amountToCents(row.ticketChargesPaid ?? 0))
  }));
}

export function billingRegisterCsvNote(register, { periodLabel = '', statusLabel = '' } = {}) {
  const months = register?.months ?? [];
  const range = months.length ? ` (${months[0]} to ${months[months.length - 1]})` : '';
  return `Note: Filtered view: showing ${register?.rows?.length ?? 0} of ${register?.periodBillCount ?? 0} bills · period ${periodLabel || register?.period || ''}${range} · status ${statusLabel || register?.status || ''}; the CSV rows cover only the visible register entries.`;
}

export function billingRegisterCsvFilename(register) {
  return `billing-register-${register?.period || BILLING_REGISTER_DEFAULT_PERIOD}-${register?.status || BILLING_REGISTER_DEFAULT_STATUS}_filtered.csv`;
}

// ---------------------------------------------------------------------------
// Printable summary sheet (SISP-185) — a standalone black-on-white HTML
// document (house print convention: SISP-60 voucher book, SISP-55 zone
// sheet) opened in a print window by app.js. Two sizes, like the receipt
// surfaces: a full A4 table and a condensed 80mm thermal table.
//
// Column call for 80mm: an 80mm roll cannot honestly fit all nine A4
// columns, so Mobile, Package and Balance Due are dropped and the
// "#12 · 2026-10" reference is split back into its parts — a bare
// customer-number column plus the existing Month column. What remains
// (#, Customer, Month, Bill, Paid, Status) still identifies every row
// and carries the money columns the totals line is built from.
//
// Header honesty: the brand is whatever the caller's settings hold (the
// app-wide 'Shahdara ISP' fallback lives in app.js, as on every receipt);
// the phone line prints ONLY when settings actually record one — the
// placeholder phone some receipt defaults carry is never used here, and
// no address line is invented. Sign-off blocks iterate the recorded
// partner set (partner-settlement PARTNERS, the SISP-125 precedent) —
// a partner added there appears on the sheet with no code change here.
export const BILLING_REGISTER_PRINT_FORMATS = ['a4', '80mm'];
export const BILLING_REGISTER_DEFAULT_PRINT_FORMAT = 'a4';

export function normalizeBillingRegisterPrintFormat(value) {
  return BILLING_REGISTER_PRINT_FORMATS.includes(value) ? value : BILLING_REGISTER_DEFAULT_PRINT_FORMAT;
}

function escapePrintHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildBillingRegisterPrintHtml(register, {
  format = BILLING_REGISTER_DEFAULT_PRINT_FORMAT,
  businessName = '',
  businessPhone = '',
  partners = PARTNERS,
  generatedDate = '',
  lang = null
} = {}) {
  const normalizedFormat = normalizeBillingRegisterPrintFormat(format);
  const thermal = normalizedFormat === '80mm';
  const rows = register?.rows ?? [];
  const totals = register?.totals ?? { count: rows.length, totalBilled: 0, totalPaid: 0 };
  const months = register?.months ?? [];
  const range = months.length > 1
    ? `${months[0]} – ${months[months.length - 1]}`
    : (months[0] ?? '');
  const periodLabel = t(`bill_reg_period_${register?.period || BILLING_REGISTER_DEFAULT_PERIOD}`, lang);
  const statusLabel = t(`bill_reg_status_${register?.status || BILLING_REGISTER_DEFAULT_STATUS}`, lang);
  const filterLine = `${t('bill_reg_period_label', lang)}: ${periodLabel}${range ? ` (${range})` : ''} · ${t('bill_reg_status_label', lang)}: ${statusLabel}`;
  const brand = String(businessName ?? '').trim() || 'Shahdara ISP';
  const phone = String(businessPhone ?? '').trim();
  const partnerNames = (Array.isArray(partners) ? partners : [])
    .map((name) => String(name ?? '').trim())
    .filter(Boolean);
  // Balance is not part of register.totals (the screen totals line is
  // count / billed / paid), so its column total follows the voucher-book
  // precedent: a plain sum of the printed rows.
  const balanceTotal = centsToAmount(rows.reduce((sum, row) => sum + amountToCents(row.balanceDue), 0));
  // SISP-176 split, flowed in at SISP-185's reconciliation per the note at
  // the top of this file: the ticket column reads the SAME live row model
  // (row.ticketChargesPaid) and the register's own ticketTotals — never a
  // recomputation here. The split rides AFTER the long-standing money
  // columns (SISP-176's own CSV discipline) and adds nothing to any total:
  // the ticket cash already sits inside the payments behind Paid.
  const ticketTotal = register?.ticketTotals?.totalTicketChargesPaid
    ?? centsToAmount(rows.reduce((sum, row) => sum + amountToCents(row.ticketChargesPaid ?? 0), 0));

  const statusText = (row) => t(`bill_reg_status_${row.status}`, lang);
  const columns = thermal
    ? [
      { label: '#', className: 'ref', value: (row) => `#${row.customerNumber}` },
      { label: t('bill_reg_col_customer', lang), className: 'cust', value: (row) => row.customerName },
      { label: t('bill_reg_col_month', lang), className: 'nowrap', value: (row) => row.month },
      { label: t('bill_reg_col_bill', lang), className: 'amt', value: (row) => formatPKR(row.billAmount), total: totals.totalBilled },
      { label: t('bill_reg_col_paid', lang), className: 'amt', value: (row) => formatPKR(row.paidAmount), total: totals.totalPaid },
      { label: t('bill_reg_col_status', lang), className: '', value: statusText }
    ]
    : [
      { label: t('bill_reg_col_reference', lang), className: 'ref', value: (row) => row.reference },
      { label: t('bill_reg_col_customer', lang), className: '', value: (row) => row.customerName },
      { label: t('bill_reg_col_mobile', lang), className: 'nowrap', value: (row) => row.mobile || '—' },
      { label: t('bill_reg_col_package', lang), className: '', value: (row) => row.packageSpeed || '—' },
      { label: t('bill_reg_col_month', lang), className: 'nowrap', value: (row) => row.month },
      { label: t('bill_reg_col_bill', lang), className: 'amt', value: (row) => formatPKR(row.billAmount), total: totals.totalBilled },
      { label: t('bill_reg_col_paid', lang), className: 'amt', value: (row) => formatPKR(row.paidAmount), total: totals.totalPaid },
      { label: t('bill_reg_col_balance', lang), className: 'amt', value: (row) => formatPKR(row.balanceDue), total: balanceTotal },
      { label: t('bill_reg_col_ticket', lang), className: 'amt', value: (row) => formatPKR(row.ticketChargesPaid ?? 0), total: ticketTotal },
      { label: t('bill_reg_col_status', lang), className: '', value: statusText }
    ];

  const headCells = columns.map((column) => `<th${column.className ? ` class="${column.className}"` : ''}>${escapePrintHtml(column.label)}</th>`).join('');
  const bodyRows = rows.map((row) => `<tr>${columns.map((column) => `<td${column.className ? ` class="${column.className}"` : ''}>${escapePrintHtml(column.value(row))}</td>`).join('')}</tr>`).join('');
  const firstAmountIndex = columns.findIndex((column) => column.className === 'amt');
  const amountCells = columns
    .filter((column) => column.className === 'amt')
    .map((column) => `<td class="amt">${escapePrintHtml(formatPKR(column.total))}</td>`)
    .join('');
  // Totals row: label spans up to the first money column, money totals sit
  // under their own columns, and any non-money column after them (Status)
  // stays blank.
  const amountCount = columns.filter((column) => column.className === 'amt').length;
  const trailingCount = columns.length - firstAmountIndex - amountCount;
  const totalsRow = `<tr class="grand"><td colspan="${firstAmountIndex}">${escapePrintHtml(t('bill_reg_print_total_row', lang))}</td>${amountCells}${'<td></td>'.repeat(trailingCount)}</tr>`;

  const totalsLine = t('bill_reg_totals', lang, {
    count: totals.count,
    billed: formatPKR(totals.totalBilled),
    paid: formatPKR(totals.totalPaid)
  });

  const signatureBlock = (label) => `<div class="sig"><div class="line"></div>${escapePrintHtml(label)}</div>`;
  const signatures = [
    signatureBlock(t('bill_reg_sign_prepared', lang)),
    ...partnerNames.map((name) => signatureBlock(name))
  ].join('');

  const pageStyle = thermal
    ? `@page { size: 80mm auto; margin: 3mm; }
        body { font-size: 10px; }
        th, td { padding: 3px 2px; font-size: 10px; }
        .brand { font-size: 15px; }
        .title { font-size: 12px; }
        td.cust { max-width: 24mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`
    : `@page { size: A4; margin: 12mm; }
        body { font-size: 12px; }
        th, td { padding: 5px 6px; }
        th { font-size: 11px; }
        .brand { font-size: 19px; }
        .title { font-size: 14px; }`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapePrintHtml(t('bill_reg_title', lang))} — ${escapePrintHtml(periodLabel)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; color: #111; line-height: 1.4; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; gap: 12px; }
  .brand { font-weight: 800; }
  .title { font-weight: 700; }
  .meta { font-size: 11px; text-align: right; }
  .filter-line { font-size: 11px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; text-align: left; vertical-align: top; }
  th { background: #eee; }
  td.ref { font-weight: 700; white-space: nowrap; }
  td.nowrap { white-space: nowrap; }
  td.amt, th.amt { text-align: right; white-space: nowrap; }
  tr.grand td { border-top: 2px solid #000; font-weight: 800; }
  .empty { text-align: center; padding: 22px; font-size: 12px; border: 1px solid #999; }
  .totals-line { margin-top: 10px; font-weight: 700; }
  .signatures { display: flex; justify-content: space-between; margin-top: 34px; font-size: 11px; gap: 18px; }
  .sig { flex: 1; text-align: center; }
  .sig .line { border-top: 1px solid #000; margin-bottom: 4px; height: 28px; }
  ${pageStyle}
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">${escapePrintHtml(brand)}</div>
      <div class="title">${escapePrintHtml(t('bill_reg_title', lang))}</div>
    </div>
    <div class="meta">
      <div>${escapePrintHtml(t('bill_reg_print_generated', lang, { date: generatedDate || '—' }))}</div>
      ${phone ? `<div>${escapePrintHtml(phone)}</div>` : ''}
    </div>
  </div>
  <p class="filter-line">${escapePrintHtml(filterLine)}</p>
  ${rows.length ? `<table>
    <thead><tr>${headCells}</tr></thead>
    <tbody>
      ${bodyRows}
      ${totalsRow}
    </tbody>
  </table>` : `<div class="empty">${escapePrintHtml(t('bill_reg_empty', lang))}</div>`}
  <p class="totals-line">${escapePrintHtml(totalsLine)}</p>
  <div class="signatures">
    ${signatures}
  </div>
</body>
</html>`;
}
