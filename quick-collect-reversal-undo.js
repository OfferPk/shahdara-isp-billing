// Quick Collect reversal undo (Plan 435): one undo action on the
// success screen, available for sixty seconds after saving, which
// reverses that payment through the reversal link and returns to
// the entry form. It undoes only that one payment and only within
// the window; it never deletes any bill, payment, or customer
// record — the original stays visible with its reversal, and the
// pair together nets to zero.
//
// This is NOT the five-second undo that deletes a just-made
// payment: that undo removes the record (and reopens any ticket
// charges, waived late fee, or promise it touched), while this one
// records a normal negative entry linked by reference, so the
// original is never edited or deleted. The two undos coexist on
// the success screen; each clears the other when it runs, so a
// payment can never be both deleted and reversed.
//
// The window is a pure comparison: the caller supplies both the
// instant the payment was saved and the instant of the check, so
// this module never reads the clock. A split collection records
// two legs of its own, so it never arms this undo — reversing one
// leg alone would leave half a collection standing. A payment
// that settled ticket or boost charges, waived a late fee, or
// touched a promise is not offered this undo either: the reversal
// moves money only, and those side effects stay as they are —
// the five-second undo, which restores them, is the path for
// those. The caller decides that from the receipt and the saved
// payment record; this module only checks the figures it is
// given.
//
// Pure and import-free: no storage, no page, no network, no other
// module, no clock. Inputs are never mutated.

export const QUICK_COLLECT_REVERSAL_UNDO_WINDOW_MS = 60000;
export const QUICK_COLLECT_REVERSAL_UNDO_REASON = 'Undone within sixty seconds';

const QUICK_COLLECT_REVERSAL_UNDO_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isQuickCollectReversalUndoLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function quickCollectReversalUndoIsStrictDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = QUICK_COLLECT_REVERSAL_UNDO_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isQuickCollectReversalUndoLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

/**
 * True only while the sixty-second window is open: both instants
 * finite numbers, the check at or after the save, and no more than
 * sixty seconds between them. Exactly sixty seconds still counts;
 * sixty seconds and one millisecond does not. A check before the
 * save (a clock moved backwards) never counts, and a null, empty,
 * boolean, or string instant is never read as a number.
 */
export function quickCollectReversalUndoAllowed(savedAtMs, nowMs) {
  if (typeof savedAtMs !== 'number' || typeof nowMs !== 'number') return false;
  if (!Number.isFinite(savedAtMs) || !Number.isFinite(nowMs)) return false;
  if (nowMs < savedAtMs) return false;
  return nowMs - savedAtMs <= QUICK_COLLECT_REVERSAL_UNDO_WINDOW_MS;
}

/**
 * Whole seconds left in the window (60 down to 0), for the live
 * countdown label. Zero when the window is closed or the instants
 * are unusable — never a negative number, never a guess.
 */
export function quickCollectReversalUndoSecondsLeft(savedAtMs, nowMs) {
  if (!quickCollectReversalUndoAllowed(savedAtMs, nowMs)) return 0;
  return Math.max(0, Math.min(60, Math.ceil((savedAtMs + QUICK_COLLECT_REVERSAL_UNDO_WINDOW_MS - nowMs) / 1000)));
}

/** The button label for the seconds left: plain words, never a guess. */
export function quickCollectReversalUndoButtonText(secondsLeft) {
  const left = Number(secondsLeft);
  if (Number.isFinite(left) && left >= 1 && left <= 60) return `↩ Undo by reversal — original stays visible (${Math.floor(left)}s)`;
  return '↩ Undo by reversal — original stays visible';
}

function cleanQuickCollectReversalUndoText(value) {
  return typeof value === 'string' ? value.replace(/[\r\n\u2028\u2029]+/g, ' ').trim() : '';
}

/**
 * True only for a plain single payment: no settled ticket charges,
 * no settled boost charges, no waived late fee, no promise touched.
 * A payment that did more than move money is not offered this
 * undo — its side effects would stay behind while the money came
 * back. Missing lists read as none; a damaged (non-array) list
 * reads as not plain, never as empty.
 */
export function quickCollectReversalUndoIsPlainPayment(facts = {}) {
  const { ticketCharges, addonCharges, hasWaiver, hasWaadaStamp } = facts || {};
  if (hasWaiver || hasWaadaStamp) return false;
  for (const list of [ticketCharges, addonCharges]) {
    if (list === undefined || list === null) continue;
    if (!Array.isArray(list)) return false;
    if (list.length > 0) return false;
  }
  return true;
}

/**
 * The fields for the reversing entry, ready for the payment
 * recorder: the same date, the negative of the original amount,
 * the original method, and the link naming the original. Null
 * when the original cannot be reversed — no usable id, no finite
 * positive numeric amount (a null, empty, boolean, or string
 * amount is never read as a number, and never as zero), an amount
 * that is not clean to two decimals, no usable method, or no
 * strict date. The reason caps at 200 chars; a missing reason
 * reads as the plain default, never as an invented detail.
 */
export function quickCollectReversalUndoFields(payment, options = {}) {
  if (!payment || typeof payment !== 'object') return null;
  const id = typeof payment.id === 'string' ? payment.id.trim() : '';
  if (!id) return null;
  if (typeof payment.amount !== 'number' || !Number.isFinite(payment.amount) || payment.amount <= 0) return null;
  const cents = Math.round(payment.amount * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  if (cents / 100 !== payment.amount) return null;
  const method = typeof payment.method === 'string' ? payment.method.trim() : '';
  if (!method) return null;
  const date = typeof options.date === 'string' ? options.date.trim() : '';
  if (!quickCollectReversalUndoIsStrictDate(date)) return null;
  const reason = cleanQuickCollectReversalUndoText(options.reason).slice(0, 200) || QUICK_COLLECT_REVERSAL_UNDO_REASON;
  return {
    date,
    amount: -cents / 100,
    method,
    reversalLink: {
      reversesPaymentId: id,
      reason,
      date,
    },
  };
}
