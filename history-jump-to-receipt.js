// Plan 423 — History quick jump from a payment line to its receipt.
// A payment line in the history gives no way to open its receipt, so
// reprinting one means searching for it by number first. This module
// supplies the missing piece: given a shown history entry, it resolves
// exactly the receipt that payment carries — the stored number first,
// else the derived number the receipt builder prints for a payment
// with no stored number — plus how many times that receipt is already
// recorded as reprinted in the reprint register. It navigates only:
// it reads the bills and the reprint list it is handed, writes to no
// store, and changes no bill, payment, receipt, or customer record.
// The receipt itself opens through the same print path the month-card
// payment rows already use; this module only says which receipt to
// open. A charge line is the bill itself and a credit line belongs to
// no bill, so neither is a payment line and neither jumps.
export const HISTORY_JUMP_TO_RECEIPT_NO_RECEIPT_TEXT = 'This payment has no receipt to open.';
export const HISTORY_JUMP_TO_RECEIPT_BUTTON_TEXT = 'Receipt';
export const HISTORY_JUMP_TO_RECEIPT_BUTTON_CLASS = 'hjr-receipt-button';
export const HISTORY_JUMP_TO_RECEIPT_PAYMENT_TYPES = Object.freeze([
  'payment',
  'advance',
  'adjustment',
  'refund',
]);

function cleanReceiptKey(value) {
  return String(value ?? '').trim().toLowerCase();
}

function cleanReceiptText(value) {
  return String(value ?? '').trim();
}

export function historyJumpToReceiptIsPaymentEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  return HISTORY_JUMP_TO_RECEIPT_PAYMENT_TYPES.includes(cleanReceiptKey(entry.type));
}

export function historyJumpToReceiptShownEntry(shown, rowIndex) {
  if (!Array.isArray(shown)) return null;
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= shown.length) return null;
  const entry = shown[rowIndex];
  return entry && typeof entry === 'object' ? entry : null;
}

// The derived receipt number, restated from the receipt builder so
// this module stays import-free: REC-YYMM-CCCC-XXXX, where YYMM comes
// from the payment date (else the bill month), CCCC is the customer
// number padded to four digits, and XXXX is the last four alphanumeric
// characters of the payment id, upper-cased ('1001' when the payment
// carries no id). A payment with a stored number keeps that number.
export function historyJumpToReceiptNumber(payment, customerNumber, billMonth) {
  if (!payment || typeof payment !== 'object') return '';
  const stored = cleanReceiptText(payment.receiptNumber) || cleanReceiptText(payment.permanentReceiptNumber);
  if (stored) return stored;
  const date = cleanReceiptText(payment.date);
  const month = cleanReceiptText(billMonth);
  const digits = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date.replace(/-/g, '').slice(2, 6)
    : /^\d{4}-\d{2}$/.test(month)
      ? month.replace(/-/g, '').slice(2, 6)
      : '2601';
  const customerPart = String(customerNumber || '0').padStart(4, '0');
  const idPart = payment.id
    ? String(payment.id).replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase()
    : '1001';
  return `REC-${digits}-${customerPart}-${idPart}`;
}

// How many times this receipt number is already recorded as reprinted
// in the reprint register: the register matches by receipt number, so
// this counts entries carrying exactly the same number, trimmed.
export function historyJumpToReceiptReprintCount(reprints, receiptNumber) {
  const number = cleanReceiptText(receiptNumber);
  if (!number) return 0;
  if (!Array.isArray(reprints)) return 0;
  let count = 0;
  for (const item of reprints) {
    if (!item || typeof item !== 'object') continue;
    if (cleanReceiptText(item.receiptNumber) === number) count += 1;
  }
  return count;
}

export function historyJumpToReceiptTarget(entry, bills, reprints, customerNumber) {
  if (!historyJumpToReceiptIsPaymentEntry(entry)) return null;
  const ref = cleanReceiptText(entry.ref);
  if (!ref) return null;
  if (!Array.isArray(bills)) return null;
  for (const bill of bills) {
    if (!bill || typeof bill !== 'object') continue;
    const payments = Array.isArray(bill.payments) ? bill.payments : [];
    for (const payment of payments) {
      if (!payment || typeof payment !== 'object') continue;
      if (cleanReceiptText(payment.id) !== ref) continue;
      const receiptNumber = historyJumpToReceiptNumber(payment, customerNumber, bill.month);
      return {
        month: cleanReceiptText(bill.month),
        paymentId: cleanReceiptText(payment.id),
        receiptNumber,
        reprintCount: historyJumpToReceiptReprintCount(reprints, receiptNumber),
      };
    }
  }
  return null;
}

export function historyJumpToReceiptButtonText(target) {
  if (!target || typeof target !== 'object') return HISTORY_JUMP_TO_RECEIPT_BUTTON_TEXT;
  const count = Number(target.reprintCount);
  if (Number.isFinite(count) && count > 0) {
    return `${HISTORY_JUMP_TO_RECEIPT_BUTTON_TEXT} · REPRINT ×${Math.trunc(count)}`;
  }
  return HISTORY_JUMP_TO_RECEIPT_BUTTON_TEXT;
}
