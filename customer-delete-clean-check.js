// Customer delete clean check (Polish #10): the profile's Delete
// button removes a customer only when the money state is fully clean
// — no bills, no payments, no dues, no manual baqaya. Anything else
// is refused with the reason, so a customer who still has money on
// the account can never be deleted by mistake.
//
// The check reads the customer record only, plus two figures the
// caller supplies from the app's own canonical computations: the
// dues figure (open bill balances plus unpaid manual baqaya) and the
// unpaid manual baqaya in cents. It never changes a record, reads no
// storage, no clock, and no page, and holds no store of its own.
//
// Strictness is deliberate: a bill blocks even when it is fully paid,
// a payment blocks even when it was later voided, and a manual
// baqaya entry blocks even when it is fully settled — all of those
// are money history, and deleting the profile must never silently
// erase money history. A figure that cannot be worked out (dues
// null) also refuses: deletion never proceeds on a guessed figure.
//
// What deletion removes: only the customer record itself. The
// separate per-customer stores (wada records, emergency contacts,
// suspension records, notes, complaints) are not touched by the
// delete — their rows stay where they are, keyed by a customer id
// that no longer exists, and are only ever shown on that customer's
// own profile, so they become invisible. The safety snapshot taken
// before deleting still holds the full customer record for restore.

/** A figure counts as cents only when it is a finite number: null, undefined, an empty string, or a boolean is "not a number", never zero. */
export function customerDeleteFigureCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value);
}

/** Format a rupee amount the way the app shows money (min-0 decimals). */
export function formatCustomerDeleteAmount(rupees) {
  return `PKR ${Number(rupees).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function countDeleteCheckRecords(list) {
  if (!Array.isArray(list)) return 0;
  return list.filter((item) => item && typeof item === 'object').length;
}

/**
 * Whether the customer's profile may be deleted, and why not.
 *
 * @param {Object} customer - the customer record ({ bills, manualBaqaya }).
 * @param {Object} figures - { duesCents, baqayaOutstandingCents } in whole
 *   cents, from the caller's own canonical computations; null when a
 *   figure could not be worked out.
 * @returns {Object} { clean, billCount, paymentCount, baqayaEntryCount,
 *   baqayaOutstandingCents, duesCents, reasons } where reasons is a
 *   list of 'has-bills' | 'has-payments' | 'has-dues' | 'has-baqaya' |
 *   'dues-unknown'.
 */
export function customerDeleteCleanCheck(customer, figures = {}) {
  const duesCents = customerDeleteFigureCents(figures?.duesCents);
  const baqayaOutstandingCents = customerDeleteFigureCents(figures?.baqayaOutstandingCents);
  // No usable record, no usable id: the account cannot be checked, so
  // it is never clean — deletion never proceeds on a record that
  // could not be read.
  const customerId = typeof customer?.id === 'string' ? customer.id.trim() : '';
  if (!customer || typeof customer !== 'object' || !customerId) {
    return { clean: false, billCount: 0, paymentCount: 0, baqayaEntryCount: 0, baqayaOutstandingCents, duesCents, reasons: ['dues-unknown'] };
  }
  const bills = Array.isArray(customer.bills) ? customer.bills.filter((bill) => bill && typeof bill === 'object') : [];
  const billCount = bills.length;
  let paymentCount = 0;
  for (const bill of bills) {
    paymentCount += countDeleteCheckRecords(bill.payments);
  }
  const baqayaEntryCount = countDeleteCheckRecords(customer.manualBaqaya);
  const reasons = [];
  if (billCount > 0) reasons.push('has-bills');
  if (paymentCount > 0) reasons.push('has-payments');
  if (duesCents === null) reasons.push('dues-unknown');
  else if (duesCents > 0) reasons.push('has-dues');
  if (baqayaEntryCount > 0 || (baqayaOutstandingCents !== null && baqayaOutstandingCents > 0)) reasons.push('has-baqaya');
  return {
    clean: reasons.length === 0,
    billCount,
    paymentCount,
    baqayaEntryCount,
    baqayaOutstandingCents,
    duesCents,
    reasons,
  };
}

function deleteCheckCountText(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function deleteCheckJoinList(parts) {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * The refusal message for a customer who may not be deleted: what is
 * still on the account, and what to do instead. Plain English, no
 * customer name in it — the caller puts the customer in the toast
 * title. Never invents a figure: when the dues figure could not be
 * worked out, it says so instead of naming an amount.
 */
export function customerDeleteRefusalText(check) {
  if (!check || typeof check !== 'object') {
    return 'Cannot delete this profile — the account could not be checked. Clear the account first, or archive the profile instead.';
  }
  if (Array.isArray(check.reasons) && check.reasons.includes('dues-unknown') && check.billCount === 0 && check.paymentCount === 0 && check.baqayaEntryCount === 0) {
    return 'Cannot delete this profile — the amount still due could not be worked out. Clear the account first, or archive the profile instead.';
  }
  const parts = [];
  if (check.billCount > 0) parts.push(`${deleteCheckCountText(check.billCount, 'bill', 'bills')} recorded`);
  if (check.paymentCount > 0) parts.push(`${deleteCheckCountText(check.paymentCount, 'payment', 'payments')} recorded`);
  if (check.baqayaEntryCount > 0) parts.push(`${deleteCheckCountText(check.baqayaEntryCount, 'manual baqaya entry', 'manual baqaya entries')} recorded`);
  let text = 'Cannot delete this profile';
  if (parts.length > 0) text += ` — ${deleteCheckJoinList(parts)}`;
  if (check.duesCents !== null && check.duesCents !== undefined && check.duesCents > 0) {
    text += ` and ${formatCustomerDeleteAmount(check.duesCents / 100)} is still due`;
  } else if (Array.isArray(check.reasons) && check.reasons.includes('dues-unknown')) {
    text += ' and the amount still due could not be worked out';
  }
  return `${text}. Clear the account first, or archive the profile instead.`;
}
