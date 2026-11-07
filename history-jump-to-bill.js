// Plan 422 — History quick jump from a payment line to its bill.
//
// One tap on a history payment line opens the bill it settled, with
// the payment already highlighted on that bill. The jump navigates
// only: it changes no bill, payment, or customer record. A payment
// that settles no single bill says so plainly instead of opening
// anything.
//
// The jump is derived from the records the app already keeps: a
// history entry carries the month of the bill it belongs to and the
// id of the payment it is, so the bill is the one bill of that month
// carrying a payment with that id. No new store is needed, and no
// connection is guessed: a payment whose month names no bill, names
// two bills, or names a bill without that payment has no single bill
// to open.
//
// A history line that is not a payment line — a charge, which is the
// bill itself, or a credit, which belongs to no bill — never jumps;
// only payment lines are tappable. The row markup itself is owned by
// the list builders, so this module resolves targets only; the wiring
// in the profile render attaches the tap to each row.

// Plain words when a payment settles no single bill.
export const HISTORY_JUMP_TO_BILL_NO_BILL_TEXT = 'This payment settles no single bill.';

// Class added to the payment row on the bill the jump lands on.
export const HISTORY_JUMP_TO_BILL_HIGHLIGHT_CLASS = 'hjb-highlight';

// History entry types that come from a payment on a bill. A charge is
// the bill itself and a credit belongs to no bill, so neither is a
// payment line.
export const HISTORY_JUMP_TO_BILL_PAYMENT_TYPES = ['payment', 'advance', 'adjustment', 'refund'];

function cleanHistoryJumpText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanHistoryJumpKey(value) {
  return cleanHistoryJumpText(value).toLowerCase();
}

// A strict bill month: four-digit year, dash, month 01-12.
export function isStrictHistoryJumpMonth(value) {
  const month = cleanHistoryJumpText(value);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return false;
  return true;
}

// Whether a history entry is a payment line: one of the types that
// come from a payment recorded on a bill.
export function historyJumpToBillIsPaymentEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  return HISTORY_JUMP_TO_BILL_PAYMENT_TYPES.includes(cleanHistoryJumpKey(entry.type));
}

// The bill a history payment line settles, or null when it settles no
// single bill: the entry must be a payment line with a strict bill
// month, exactly one bill must carry that month, and that bill must
// carry a payment with the entry's reference. The payment id is
// matched exactly (trimmed), never by a guessed or partial id.
export function historyJumpToBillTarget(entry, bills) {
  if (!historyJumpToBillIsPaymentEntry(entry)) return null;
  const month = cleanHistoryJumpText(entry.month);
  if (!isStrictHistoryJumpMonth(month)) return null;
  const ref = cleanHistoryJumpText(entry.ref);
  if (ref === '') return null;
  const list = Array.isArray(bills) ? bills : [];
  const matches = list.filter((bill) => bill
    && typeof bill === 'object'
    && cleanHistoryJumpText(bill.month) === month);
  if (matches.length !== 1) return null;
  const payments = Array.isArray(matches[0].payments) ? matches[0].payments : [];
  const payment = payments.find((item) => item
    && typeof item === 'object'
    && cleanHistoryJumpText(item.id) === ref);
  if (!payment) return null;
  return { month, paymentId: cleanHistoryJumpText(payment.id) };
}

// The shown entry behind one rendered history row, by the row's
// position among the rows. The list builders render one row per shown
// entry in order, so the row index is the entry index; anything
// outside the list yields no entry.
export function historyJumpToBillShownEntry(shown, index) {
  if (!Array.isArray(shown)) return null;
  if (typeof index !== 'number' || !Number.isInteger(index)) return null;
  if (index < 0 || index >= shown.length) return null;
  const entry = shown[index];
  return entry && typeof entry === 'object' ? entry : null;
}
