/**
 * Pending-action receipt month (receipt polish 6, part A).
 *
 * A receipt sent from the Pending Action Center must always carry its
 * month (month name + year). The month is derived from data the receipt
 * already has, in this order:
 *   1. the bill month (YYYY-MM) when it is a valid month;
 *   2. the payment date's month when the payment date is a valid
 *      calendar date;
 *   3. nothing — a receipt with no usable date never invents a month.
 *
 * The bill month is preferred because it is the month the payment is
 * for; the payment date is only the fallback when the bill month is
 * missing or invalid. The same derivation feeds both the WhatsApp
 * draft and the clipboard fallback, so the month is present whichever
 * path the share takes.
 *
 * Pure module: no imports, no storage, no clock, no network. Dates are
 * checked with integer arithmetic against a days-in-month table, so no
 * date object is ever constructed here.
 */

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const isLeapYear = year => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** True only for a strict YYYY-MM month (01–12). */
export function isValidReceiptMonth(value) {
  return MONTH_PATTERN.test(String(value ?? '').trim());
}

/**
 * Parses a strict YYYY-MM-DD calendar date (real day for the month,
 * leap years included). Returns { year, month, day } or null.
 */
function parseCalendarDate(value) {
  const match = DATE_PATTERN.exec(String(value ?? '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day < 1 || day > maxDay) return null;
  return { year, month, day };
}

/**
 * Derives the send month (YYYY-MM) for a receipt-like record with
 * `month` (bill month) and `date` (payment date) fields. Bill month
 * first, payment date second, empty string when neither is usable.
 */
export function deriveReceiptSendMonth(input) {
  const record = input == null ? {} : input;
  const month = String(record.month ?? '').trim();
  if (isValidReceiptMonth(month)) return month;
  const parsed = parseCalendarDate(record.date);
  if (parsed) return `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
  return '';
}

/** '2026-11' -> 'November 2026'; anything invalid -> ''. */
export function formatReceiptMonthLong(month) {
  if (!isValidReceiptMonth(month)) return '';
  const monthIndex = Number(String(month).trim().slice(5, 7)) - 1;
  return `${MONTH_NAMES[monthIndex]} ${String(month).trim().slice(0, 4)}`;
}

/** Display label ('November 2026') for a receipt-like record, or ''. */
export function pendingReceiptMonthLabel(input) {
  return formatReceiptMonthLong(deriveReceiptSendMonth(input));
}

/**
 * Builds the complete receipt object a WhatsApp share needs from a
 * Pending Action Center queue item plus the customer it belongs to.
 * The month is derived automatically (see above); the customer id,
 * name and number are carried so the share resolves to a real draft
 * instead of falling back with a blank month. Only the named fields
 * are copied — anything else on the queue item is dropped — and the
 * inputs are never mutated.
 */
export function pendingReceiptForShare(queueReceipt, customer) {
  const receipt = queueReceipt == null ? {} : queueReceipt;
  const person = customer == null ? {} : customer;
  const out = {
    id: receipt.id ?? receipt.paymentId ?? '',
    customerId: person.id ?? receipt.customerId ?? '',
    customerName: person.name ?? receipt.customerName ?? '',
    customerNumber: person.customerNumber ?? receipt.customerNumber ?? null,
    amount: Number(receipt.amount || 0),
    method: receipt.method ?? '',
    date: receipt.date ?? '',
    month: deriveReceiptSendMonth(receipt)
  };
  const billAmount = Number(receipt.billAmount);
  if (Number.isFinite(billAmount)) out.billAmount = billAmount;
  return out;
}
