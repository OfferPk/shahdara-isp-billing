import { calculatePaymentAllocations } from './core.js';

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

  const packageLabel = packageAtServiceStart(customer, bill.month);
  const speedMatch = packageLabel.match(/\b(\d+(?:\.\d+)?)\s*Mbps\b/i);
  const billDue = positiveAmount(bill.dueAmount);
  const nominalPrice = billDue ?? positiveAmount(bill.priceSnapshot);
  const customerBills = Array.isArray(customer.bills) ? customer.bills : [];
  const matchingBill = customerBills.find(row => row === bill || (row?.id && bill.id && row.id === bill.id)) ?? bill;
  const orderedPayments = [...(Array.isArray(matchingBill.payments) ? matchingBill.payments : [])].sort(paymentOrder);
  const selectedIndex = orderedPayments.findIndex(row => row === payment
    || (row?.id && payment.id && row.id === payment.id));

  let status = 'RECEIVED';
  let balanceDueCents = null;
  if (billDue !== null && selectedIndex >= 0) {
    const dueCents = cents(billDue);
    const allocations = calculatePaymentAllocations({ customers:[customer] });
    const summary = allocations.forMonth(customer.id, matchingBill.month);
    const carryInCents = Math.min(dueCents, Math.max(0, Number(summary?.creditAppliedCents) || 0));
    const paidBeforeCents = orderedPayments.slice(0, selectedIndex)
      .reduce((sum, row) => sum + cents(positiveAmount(row.amount) ?? 0), 0);
    const receivedThroughCents = orderedPayments.slice(0, selectedIndex + 1)
      .reduce((sum, row) => sum + cents(positiveAmount(row.amount) ?? 0), 0);
    const coveredBeforeReceipt = carryInCents + paidBeforeCents >= dueCents;
    balanceDueCents = Math.max(0, dueCents - carryInCents - receivedThroughCents);
    if (coveredBeforeReceipt) status = 'CREDIT RECEIVED';
    else if (balanceDueCents === 0) status = 'PAID';
    else if (carryInCents + receivedThroughCents > 0) status = 'PARTIAL';
  }

  const transactionId = text(payment.transactionId);
  const packageDuration = text(bill.packageDuration) || text(customer.packageDuration);
  const dataLimit = text(bill.packageDataLimit) || text(customer.packageDataLimit);
  const servicePeriodStart = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(bill.month ?? '')) ? `${bill.month}-01` : '';
  const packageDate = servicePeriodStart;
  const servicePeriodEnd = validStoredDate(bill.servicePeriodEnd);

  return {
    customerName:text(customer.name),
    customerId:Number.isSafeInteger(customer.customerNumber) && customer.customerNumber > 0 ? String(customer.customerNumber) : '',
    paymentDate:validStoredDate(payment.date),
    transactionId,
    package:packageLabel,
    speedMbps:speedMatch?.[1] ?? '',
    packageDuration,
    packageType:nominalPrice === null ? '' : nominalPrice < 3000 ? 'Limited' : 'Unlimited',
    dataLimit,
    nominalPrice,
    paidAmount:positiveAmount(payment.amount),
    paymentMethod:text(payment.method),
    packageDate,
    servicePeriodStart,
    servicePeriodEnd,
    status,
    balanceDueCents
  };
}
