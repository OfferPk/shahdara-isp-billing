// Quick Collect still-owes line (Plan 440): after a Quick Collect
// save, the success screen says in one plain line how much of the
// customer's BILL DUES is still owed — "Bill dues still owed
// PKR 1,500" — or "Bill dues fully paid" when nothing is left. The
// customer hears the remaining balance before leaving the counter,
// so the next visit starts from an agreed figure. The line names
// bill dues explicitly (Plan 526): the receipt's payable remainder
// folds pending ticket and boost charges in as well, and the
// next-steps panel shows that wider figure — so this line says
// which figure it is, and the two lines can no longer read as a
// contradiction.
//
// The figure is the customer's DUES after the payment, read from
// the customer's own post-save record: every open bill's remaining
// balance from the allocation engine's own figures, plus unpaid
// manual baqaya. That is the same dues figure the picker shows and
// the amount field defaults to — and it is deliberately NOT the
// receipt's payable remainder: the receipt also folds in ticket
// and boost charges still pending, and those are not dues. A
// customer whose bill is fully paid but who still has a repair
// charge pending reads "Fully paid" here, because their dues are
// settled; the charge is not hidden, it simply is not dues.
//
// The line shows only. It records nothing new, changes no bill,
// payment, or customer record, and holds no store of its own: every
// figure comes from the post-save record the caller supplies. A
// figure that cannot be worked out shows no line at all — never a
// guessed figure, and never a "Fully paid" for a customer whose
// record could not be read.
//
// The module is standalone: it reads no storage, no clock, and no
// page, takes no other module, and never mutates an input. There
// is no user text in the line, so there is nothing to escape.

const STILL_OWES_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export const STILL_OWES_FULLY_PAID_TEXT = 'Bill dues fully paid';
export const STILL_OWES_STILL_OWED_TEXT = 'Bill dues still owed';

function cleanStillOwesText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Strict YYYY-MM month (01–12). */
export function stillOwesIsStrictMonth(value) {
  if (typeof value !== 'string') return false;
  const match = STILL_OWES_MONTH_PATTERN.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

// A figure counts as cents only when it is a finite number: null,
// undefined, an empty string, or a boolean is "not a number", never
// zero — a null figure must never invent a zero-cent due, and a
// boolean must never read as one cent. (Same defensive rule as the
// overpayment choice.)
export function stillOwesFigureCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value);
}

/** Format an amount the way the app shows money (min-0 decimals). */
export function formatStillOwesAmount(amount) {
  return Number(amount).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * The customer's dues after the payment, in whole cents: every open
 * bill's remaining balance from the allocation engine, plus unpaid
 * manual baqaya in cents as supplied by the caller. 0 when the
 * customer has no dues left. Null when the figure cannot be worked
 * out — no usable customer id, no allocation lookup, or a lookup
 * that throws — so the caller shows no line instead of guessing.
 *
 * Only a bill the engine still shows as open counts: a bill whose
 * balance is zero or negative is not open, and a bill with no usable
 * month is skipped. Ticket and boost charges are NOT dues and are
 * never an input here, so they can never enter the figure.
 *
 * @param {Object} customer - the customer record ({ id, bills }).
 * @param {Object} allocations - the allocation engine result for the
 *   post-save state, with a forMonth(customerId, month) lookup.
 * @param {number} manualBaqayaCents - unpaid manual baqaya, in cents.
 * @returns {number|null} whole cents of dues left, or null.
 */
export function stillOwesCents(customer, allocations, manualBaqayaCents) {
  if (!customer || typeof customer !== 'object') return null;
  const customerId = cleanStillOwesText(customer.id);
  if (!customerId) return null;
  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  const forMonth = allocations && typeof allocations.forMonth === 'function'
    ? allocations.forMonth
    : null;
  if (!forMonth) return null;
  let totalCents = 0;
  const ordered = bills
    .filter((bill) => bill && typeof bill === 'object' && stillOwesIsStrictMonth(bill.month))
    .sort((a, b) => a.month.localeCompare(b.month));
  for (const bill of ordered) {
    let summary = null;
    try {
      summary = forMonth(customerId, bill.month);
    } catch {
      return null;
    }
    const balanceCents = stillOwesFigureCents(summary?.balanceDueCents);
    if (balanceCents === null || balanceCents <= 0) continue;
    totalCents += balanceCents;
  }
  const baqayaCents = stillOwesFigureCents(manualBaqayaCents);
  if (baqayaCents !== null && baqayaCents > 0) totalCents += baqayaCents;
  return Math.max(0, totalCents);
}

/**
 * One still-owes line from the customer's post-save record, or null
 * when the figure cannot be worked out. A still-owed figure of zero
 * or less reads fully paid: the next bill has not been issued yet,
 * and this line never invents one.
 */
export function stillOwesLine(customer, allocations, manualBaqayaCents) {
  const cents = stillOwesCents(customer, allocations, manualBaqayaCents);
  if (cents === null) return null;
  return {
    stillOwedCents: cents,
    stillOwed: cents / 100,
    fullyPaid: cents <= 0,
  };
}

// The line as one plain-text line, for the screen-reader
// announcement and for tests: the bill dues still owed, or bill
// dues fully paid. The label names bill dues (Plan 526) because
// the figure is dues only — pending ticket and boost charges are
// not dues and never enter it.
export function stillOwesLineText(line) {
  if (!line || typeof line !== 'object') return '';
  if (typeof line.stillOwed !== 'number' || !Number.isFinite(line.stillOwed)) return '';
  if (line.fullyPaid) return STILL_OWES_FULLY_PAID_TEXT;
  return `${STILL_OWES_STILL_OWED_TEXT} PKR ${formatStillOwesAmount(line.stillOwed)}`;
}

// The line markup: one prominent line, reusing the receipt card's
// own balance classes, so no new colour enters the stylesheet —
// red while something is still owed, green when fully paid.
export function stillOwesLineHtml(line) {
  if (!line || typeof line !== 'object') return '';
  if (typeof line.stillOwed !== 'number' || !Number.isFinite(line.stillOwed)) return '';
  if (line.fullyPaid) {
    // Polish 17 (Req 2 S1): the merged status row shows the settled line
    // as a "✓ Bill dues fully paid" pill next to the saved badge. The plain-text
    // line (stillOwesLineText) stays "Bill dues fully paid" for screen readers.
    return `<strong class="qc-meta-val zero-balance">✓ ${STILL_OWES_FULLY_PAID_TEXT}</strong>`;
  }
  return `<strong class="qc-meta-val has-balance">${STILL_OWES_STILL_OWED_TEXT} PKR ${formatStillOwesAmount(line.stillOwed)}</strong>`;
}
