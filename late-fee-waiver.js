/**
 * late-fee-waiver.js — SISP-101: 1-Click Late-Fee Waiver (lateFeeWaived)
 * & Audit Log in the Quick Collect modal.
 *
 * The owner rule: when a customer pays the FULL principal of a bill that
 * carries a late fee, the collector may forgive the fee with one tick in
 * Quick Collect. The waiver is recorded three ways, so it can never
 * become invisible or unrecoverable:
 *
 *   1. On the PAYMENT (this module's record shape): lateFeeWaived: true,
 *      waivedAmount (the fee that was on the bill, in rupees) and
 *      waivedLateFee — a reversal stamp capturing the bill's exact
 *      pre-waiver fee fields { month, lateFee, lateFeeAppliedAt,
 *      lateFeeReason }, mirroring the SISP-34 clearedWaada stamp. The
 *      stamp is data, not behaviour: voiding (payment-void-audit.js) or
 *      undoing (nav-quick-collect.js) the payment restores exactly this
 *      fee, and core's deletePayment refuses to delete a waiver payment
 *      whose fee has not been restored first.
 *   2. On the BILL: core's waiveLateFeeFromBill zeroes bill.lateFee and
 *      appends an audited amountHistory entry (type 'late_fee_waived').
 *      THAT is where the deduction lands — the allocation engine reads
 *      bill.lateFee, so the customer-visible balance drops by the fee
 *      exactly once, through the same shipped path as a profile waiver.
 *      (The engine's concession/referral subtraction is a separate,
 *      already-owned fix — this feature never touches it.)
 *   3. On the RECEIPT: buildPaymentReceipt reads the payment stamp and
 *      every layout (A4, thermal 58/80 HTML, PNG, ESC/POS, WhatsApp)
 *      prints a "Late Fee Waived: -PKR X" line. The waived fee is never
 *      a payment amount, so cash/method totals count only money that
 *      was actually received.
 *
 * This module imports nothing on purpose (the payment-void-audit.js
 * precedent), so core.js can import its reader/sanitizer without a
 * module cycle. lateFeeWaiverOf below is the single sanitization point:
 * a partial or corrupt waiver record reads as NO waiver, never as a
 * partial one — mirroring core's prepayTermsOf rule, so a damaged
 * record can never mint a fee restoration or a receipt line.
 *
 * Money is handled in integer cents at the planning boundary; the
 * stored waivedAmount is rupees rounded to cents, like every other
 * payment field core sanitizes.
 *
 * Tests use synthetic data only.
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function moneyOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null;
}

// The planning boundary speaks integer cents already (the allocation
// engine's summary fields), so this only validates and rounds — it
// never rescales.
function centsOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount) : null;
}

/**
 * Backup amountHistory entries are validated against the strict
 * 'YYYY-MM-DDTHH:mm' local format (core's parseLocalDateTime), so every
 * timestamp this feature writes into amountHistory uses exactly that
 * shape — built from local wall-clock getters, like core's own
 * localDateTimeValue.
 */
export function formatLocalMinute(date = new Date()) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The reversal stamp a waiver payment carries: the bill's fee fields
 * exactly as they were before the waiver. Strictly shaped — a stamp
 * with a bad month, a non-positive fee or wrong-typed fields is not a
 * stamp at all (returns null), so a corrupt record can never steer a
 * restoration.
 */
export function sanitizeWaivedLateFeeStamp(value) {
  if (!value || typeof value !== 'object') return null;
  const month = typeof value.month === 'string' ? value.month : '';
  if (!MONTH_RE.test(month)) return null;
  const lateFee = moneyOrNull(value.lateFee);
  if (lateFee === null || lateFee <= 0) return null;
  const lateFeeAppliedAt = typeof value.lateFeeAppliedAt === 'string' && value.lateFeeAppliedAt
    ? value.lateFeeAppliedAt
    : null;
  const lateFeeReason = typeof value.lateFeeReason === 'string'
    ? value.lateFeeReason.replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, 100)
    : '';
  return { month, lateFee, lateFeeAppliedAt, lateFeeReason };
}

/**
 * The single sanitization point for the waiver record shape. Returns
 * { waivedAmount, stamp } only for a complete, sane record:
 * lateFeeWaived === true, a positive waivedAmount (rupees) and a valid
 * reversal stamp. Anything partial or malformed reads as null — the
 * payment is then an ordinary payment everywhere (receipts, guards,
 * void), exactly like a legacy record.
 */
export function lateFeeWaiverOf(payment) {
  if (!payment || typeof payment !== 'object') return null;
  if (payment.lateFeeWaived !== true) return null;
  const waivedAmount = moneyOrNull(payment.waivedAmount);
  if (waivedAmount === null || waivedAmount <= 0) return null;
  const stamp = sanitizeWaivedLateFeeStamp(payment.waivedLateFee);
  if (!stamp) return null;
  return { waivedAmount, stamp };
}

/** Captures the reversal stamp from a bill that currently carries a fee. */
export function waivedLateFeeStampFor(bill) {
  if (!bill || typeof bill !== 'object') return null;
  return sanitizeWaivedLateFeeStamp({
    month: bill.month,
    lateFee: bill.lateFee,
    lateFeeAppliedAt: bill.lateFeeAppliedAt ?? null,
    lateFeeReason: bill.lateFeeReason ?? ''
  });
}

/**
 * The full-principal gate, in cents, from the allocation summary of the
 * target bill BEFORE the payment:
 *
 *   balanceDueCents — what the engine says is still owed on the bill
 *                     (null for an unpriced bill → never eligible);
 *   lateFeeCents    — the bill's late fee as the engine counted it.
 *
 * The fee still outstanding is min(fee, balance): money already
 * received may have covered part of the fee, and only the outstanding
 * part can still be waived. The principal still owed is the rest.
 * Eligible ⇔ a fee is outstanding AND the incoming payment covers the
 * full principal still owed. waivedAmountCents is the bill's whole
 * lateFee — the amount waiveLateFeeFromBill removes from the bill and
 * the amount the audit trail and receipt report.
 */
export function planLateFeeWaiver({ bill = null, balanceDueCents = null, lateFeeCents = null, paymentAmountCents = null } = {}) {
  if (!bill || typeof bill !== 'object') return { eligible: false, reason: 'no-bill' };
  const feeCents = centsOrNull(lateFeeCents);
  if (feeCents === null || feeCents <= 0) return { eligible: false, reason: 'no-late-fee' };
  const balanceCents = centsOrNull(balanceDueCents);
  if (balanceCents === null || balanceCents <= 0) return { eligible: false, reason: 'nothing-due' };
  const outstandingFeeCents = Math.min(feeCents, balanceCents);
  if (outstandingFeeCents <= 0) return { eligible: false, reason: 'nothing-due' };
  const principalDueCents = balanceCents - outstandingFeeCents;
  const paidCents = centsOrNull(paymentAmountCents);
  if (paidCents === null || paidCents < principalDueCents) {
    return { eligible: false, reason: 'partial-principal', principalDueCents, outstandingFeeCents, waivedAmountCents: feeCents, balanceDueCents: balanceCents };
  }
  return { eligible: true, reason: 'full-principal', principalDueCents, outstandingFeeCents, waivedAmountCents: feeCents, balanceDueCents: balanceCents };
}

/** Human-readable refusal for a waiver that fails the gate (modal + API). */
export function lateFeeWaiverRefusal(plan) {
  switch (plan?.reason) {
    case 'no-bill':
      return 'Late fee waiver needs a saved bill for the selected month.';
    case 'no-late-fee':
      return 'This bill has no late fee to waive.';
    case 'nothing-due':
      return 'Nothing is due on this bill, so there is no late fee left to waive.';
    case 'partial-principal':
      return 'The late fee can only be waived when the full principal is paid.';
    default:
      return 'The late fee cannot be waived for this payment.';
  }
}

/**
 * Reverses a waiver on the bill its stamp names: restores the exact
 * pre-waiver fee fields and appends an audited amountHistory entry
 * (type 'late_fee_restored'). Used by the Quick Collect undo before the
 * payment is deleted (core's deletePayment refuses otherwise).
 *
 * Never clobbers: when the bill is missing, or a late fee is already
 * back on it (re-applied by the owner, or restored by an earlier
 * reversal), the state is returned unchanged — the same guard the
 * SISP-34 void applies to promise restoration. Pure: the input state
 * is never mutated.
 *
 * Returns { state, restored } so callers can report honestly.
 */
export function restoreWaivedLateFee(state, customerId, payment, { changedAt = null, note = 'Late fee restored (payment undone)' } = {}) {
  const waiver = lateFeeWaiverOf(payment);
  if (!waiver || !state || !Array.isArray(state.customers)) return { state, restored: false };
  const customer = state.customers.find((c) => c && c.id === customerId);
  const bill = customer?.bills?.find((b) => b && b.month === waiver.stamp.month);
  if (!customer || !bill) return { state, restored: false };
  if (Number(bill.lateFee || 0) > 0) return { state, restored: false };
  const stamp = waiver.stamp;
  const amountHistory = [...(bill.amountHistory ?? [])];
  amountHistory.push({
    changedAt: typeof changedAt === 'string' && changedAt ? changedAt : formatLocalMinute(),
    type: 'late_fee_restored',
    previousLateFee: bill.lateFee ?? 0,
    lateFee: stamp.lateFee,
    note: typeof note === 'string' && note.trim() ? note.trim() : 'Late fee restored (payment undone)'
  });
  const restoredBill = {
    ...bill,
    lateFee: stamp.lateFee,
    lateFeeAppliedAt: stamp.lateFeeAppliedAt,
    lateFeeReason: stamp.lateFeeReason,
    amountHistory
  };
  return {
    state: {
      ...state,
      customers: state.customers.map((c) => c.id !== customerId ? c : {
        ...c,
        bills: c.bills.map((b) => b.month !== stamp.month ? b : restoredBill)
      })
    },
    restored: true
  };
}
