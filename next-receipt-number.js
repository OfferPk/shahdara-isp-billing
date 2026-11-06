// Transaction next receipt number (Plan 381): the receipt number the
// payment being entered will receive, shown on the transaction entry
// form before saving, so the operator can tell the customer their
// number while the customer is still standing at the counter — and a
// gap in the series is noticed at entry time, not after the save.
//
// The preview is the number the save itself issues. On save, the
// Quick Collect flow numbers the new payment
// RCPT-<customer number>-<YYYYMM>-<two-digit sequence>, where the
// payment count AFTER the new payment lands. The preview reads the
// same figure from the PRE-save ledger: existing payments on the
// target bill, plus one. A bill with no payments yet previews -01;
// a bill with two payments previews -03; a month with no bill at all
// previews -01, because the save creates that bill with this payment
// as its first. Every payment on the bill counts toward the sequence
// — including a voided one — because the save counts the same array,
// so the preview and the issued number can never drift apart.
//
// The preview only reads. It issues no number, reserves no number,
// and consumes no number: previewing twice returns the same number,
// and the customer record comes back byte-identical. It changes no
// bill, no payment, and no per-collector series record (Plan 122 —
// checked by filename only, neither read nor rewritten here): the
// series record assigns ranges, it never numbers a payment.
//
// The module never reads storage, the clock, the network, or the
// page. Inputs are never mutated.

const RECEIPT_NUMBER_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// A customer number as the save prints it: a positive safe integer,
// or a digits-only string kept exactly as given (leading zeros and
// all). Anything else has no usable number, so there is no preview.
function customerNumberText(customerNumber) {
  if (Number.isSafeInteger(customerNumber) && customerNumber > 0) {
    return String(customerNumber);
  }
  const raw = text(customerNumber);
  if (/^\d+$/.test(raw) && !/^0+$/.test(raw)) return raw;
  return '';
}

// The receipt number a payment would receive on the target bill
// month, given how many payments that bill already carries.
// Returns '' when the number cannot be formed (no customer number,
// a month that is not strict YYYY-MM, or a count that is not a
// non-negative integer).
export function nextReceiptNumber(customerNumber, targetMonth, existingPaymentsCount) {
  const number = customerNumberText(customerNumber);
  if (!number) return '';
  if (!RECEIPT_NUMBER_MONTH_RE.test(String(targetMonth || ''))) return '';
  if (!Number.isSafeInteger(existingPaymentsCount) || existingPaymentsCount < 0) return '';
  const sequence = String(existingPaymentsCount + 1).padStart(2, '0');
  return `RCPT-${number}-${String(targetMonth).replace('-', '')}-${sequence}`;
}

// The next receipt number for a customer record and a bill month:
// the bill for that month, its payments counted, then the builder
// above. A month with no bill yet counts zero payments. Returns ''
// when the number cannot be formed.
export function nextReceiptNumberFor(customer, targetMonth) {
  if (!customer || typeof customer !== 'object') return '';
  const bill = Array.isArray(customer.bills)
    ? customer.bills.find((entry) => entry && entry.month === targetMonth)
    : undefined;
  const count = bill && Array.isArray(bill.payments) ? bill.payments.length : 0;
  return nextReceiptNumber(customer.customerNumber, targetMonth, count);
}

// Plain-words preview line for the transaction entry form, e.g.
// "Next receipt: RCPT-41-202611-03". Returns '' when there is no
// number to preview, so the form shows nothing extra.
export function nextReceiptNumberLineText(customer, targetMonth) {
  const number = nextReceiptNumberFor(customer, targetMonth);
  return number ? `Next receipt: ${number}` : '';
}
