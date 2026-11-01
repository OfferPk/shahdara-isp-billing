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
import { calculatePaymentAllocations, derivedBillStatus, paymentTicketChargeCents } from './core.js';
import { isVoidedPayment } from './payment-void-audit.js';

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
