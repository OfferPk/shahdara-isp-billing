// Quick Collect success screen with next steps (Plan 434): after a
// Quick Collect save, the screen shows what the customer still owes
// and when it is next due, beside the package success message — so
// the customer leaves knowing exactly what remains, and the operator
// is already ready for the next customer.
//
// This module shows ONLY. It records nothing new, changes no bill,
// payment, or customer record, and holds no store of its own: every
// figure comes from the receipt the save just issued and from the
// customer's own post-save record, supplied by the caller.
//
// Where each figure comes from, so the screen can never drift from
// the record:
//   - Amount paid: the receipt's own amount. On a split collection
//     the combined receipt's total received is the amount, never
//     one leg's amount alone.
//   - Still owed after this payment: the receipt's payable
//     remainder (the post-save total the save itself computed —
//     bill dues plus any ticket, boost, or manual baqaya still
//     pending). On a split collection the combined receipt's
//     balance due is the figure. The row labels what it counts
//     (Plan 526): "Still owed (incl. pending charges)" while
//     ticket or boost charges are still pending, plain "Still
//     owed" otherwise — so it can never read as contradicting
//     the still-owes line, which counts bill dues only. A
//     still-owed figure that cannot be worked out is never
//     guessed: there is no panel.
//   - Next due date: the earliest due date among the customer's
//     bills that still carry a balance, from the allocation
//     engine's own figures — the same rule the balance reply
//     uses. A bill with no usable due date contributes nothing.
//     When no bill carries an open balance, the caller-supplied
//     fallback applies instead: the next bill month's due date
//     under the customer's own billing cycle (Polish #22) — the
//     next bill genuinely falls due on that date, so it is a
//     computed date, never an invented bill. When a bill carries
//     a balance but no usable due date, there is no fallback:
//     the line says so plainly instead of guessing a date.
//   - Fully paid: still owed of zero or less reads "Fully paid".
//     A fully paid customer has no open bill, so the next-due
//     line reads the fallback — the next bill month's due date
//     under the customer's own cycle — because the next bill has
//     not been issued yet and this screen never invents one.
//   - Collect again: a plain action that reopens the payment form
//     for the same customer. The button only asks for the form;
//     the wiring opens it, and nothing is recorded by the tap.
//
// The module is standalone: it reads no storage, no clock, and no
// page, takes no other module, and never mutates an input. All
// user text is escaped before it reaches HTML.

const SUCCESS_NEXT_STEPS_DATE_RE = /^(\d{4})-(0[1-9]|1[0-2])-(\d{2})$/;

const SUCCESS_NEXT_STEPS_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const SUCCESS_NEXT_STEPS_FULLY_PAID_TEXT = 'Fully paid';
export const SUCCESS_NEXT_STEPS_STILL_OWED_TEXT = 'Still owed';
export const SUCCESS_NEXT_STEPS_STILL_OWED_CHARGES_TEXT = 'Still owed (incl. pending charges)';
export const SUCCESS_NEXT_STEPS_NO_DUE_DATE_TEXT = 'Next due date not recorded';
export const SUCCESS_NEXT_STEPS_COLLECT_AGAIN_TEXT = 'Collect again — full dues';
export const SUCCESS_NEXT_STEPS_HEADING_TEXT = 'What is next';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function daysInMonth(year, month) {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return SUCCESS_NEXT_STEPS_DAYS_IN_MONTH[month - 1];
}

// A strict calendar day (YYYY-MM-DD, leap-aware). Anything else has
// no usable date, so there is no next due date.
export function successNextStepsIsStrictDate(value) {
  const match = SUCCESS_NEXT_STEPS_DATE_RE.exec(String(value ?? ''));
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return day >= 1 && day <= daysInMonth(year, month);
}

// A figure counts as cents only when it is a finite number: null,
// undefined, an empty string, or a boolean is "not a number", never
// zero — a null figure must never invent a zero-cent amount, and a
// boolean must never read as one cent. (Same defensive rule as the
// overpayment choice.)
export function successNextStepsFigureCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

// Format an amount the way the app shows money (min-0 decimals).
export function formatSuccessNextStepsAmount(amount) {
  return Number(amount).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function isStrictMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

// The next due date from the customer's own post-save record: the
// earliest due date among bills that still carry a balance, from the
// allocation engine's own figures. A bill with no usable month, no
// balance, or no strict due date contributes nothing. When no bill
// carries an open balance, `fallbackDueDate` applies instead — the
// caller's computed next-bill-month due date under the customer's
// own billing cycle (Polish #22). When a bill carries a balance
// but no usable due date, the fallback does NOT apply: null, never
// a guessed date. An unusable fallback is ignored the same way.
export function successNextStepsNextDueDate(customer, allocations, fallbackDueDate = null) {
  if (!customer || typeof customer !== 'object') return null;
  const customerId = text(customer.id);
  if (!customerId) return null;
  const forMonth = allocations && typeof allocations.forMonth === 'function'
    ? allocations.forMonth
    : null;
  if (!forMonth) return null;
  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  let nextDueDate = null;
  let anyOpenBalance = false;
  for (const bill of bills) {
    if (!bill || typeof bill !== 'object' || !isStrictMonth(bill.month)) continue;
    let summary = null;
    try {
      summary = forMonth(customerId, bill.month);
    } catch {
      return null;
    }
    const balanceCents = summary?.balanceDueCents;
    if (typeof balanceCents !== 'number' || !Number.isFinite(balanceCents) || balanceCents <= 0) continue;
    anyOpenBalance = true;
    const dueDate = successNextStepsIsStrictDate(bill.dueDate) ? String(bill.dueDate).slice(0, 10) : null;
    if (!dueDate) continue;
    if (!nextDueDate || dueDate < nextDueDate) nextDueDate = dueDate;
  }
  if (nextDueDate) return nextDueDate;
  if (anyOpenBalance) return null;
  return successNextStepsIsStrictDate(fallbackDueDate) ? String(fallbackDueDate).slice(0, 10) : null;
}

// Whether ticket or boost charges are still pending after this
// payment, read off the issued receipt's own pending fields (Rs):
// the receipt stamps ticketChargesPending and addonChargesPending
// at the save. Manual baqaya is dues, not a charge, so it never
// counts here. On a split collection the top-level receipt is the
// leg receipt, which carries the same pending fields, so the flag
// reads the same way on both success paths. A missing or
// non-numeric field is not pending — never a guessed flag.
export function successNextStepsChargesPending(receipt) {
  if (!receipt || typeof receipt !== 'object') return false;
  for (const field of ['ticketChargesPending', 'addonChargesPending']) {
    const value = receipt[field];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return true;
  }
  return false;
}

// Build one next-steps panel from the receipt the save just issued
// plus the next due date the caller worked out from the customer's
// post-save record. Null when the amount paid or the still-owed
// figure cannot be worked out — a panel with a guessed figure is
// worse than no panel. A split collection reads its combined
// receipt: total received for the amount paid, balance due for the
// still-owed figure.
export function successNextStepsFromReceipt(receipt, nextDueDate) {
  if (!receipt || typeof receipt !== 'object') return null;
  const split = receipt.splitTender && typeof receipt.splitTender === 'object' ? receipt.splitTender : null;
  const amountCents = split
    ? successNextStepsFigureCents(split.totalReceived)
    : successNextStepsFigureCents(receipt.amount);
  const stillOwedCents = split
    ? (typeof split.balanceDueCents === 'number' && Number.isFinite(split.balanceDueCents) ? Math.round(split.balanceDueCents) : null)
    : successNextStepsFigureCents(receipt.payableRemaining ?? receipt.newTotalDues ?? receipt.newBalanceDue ?? null);
  if (amountCents === null || amountCents <= 0) return null;
  if (stillOwedCents === null) return null;
  const dueDate = successNextStepsIsStrictDate(nextDueDate) ? String(nextDueDate).slice(0, 10) : null;
  return {
    customerName: text(receipt.customerName),
    customerNumber: receipt.customerNumber ?? null,
    amountPaidCents: amountCents,
    amountPaid: amountCents / 100,
    stillOwedCents,
    stillOwed: stillOwedCents / 100,
    chargesPending: successNextStepsChargesPending(receipt),
    nextDueDate: dueDate,
    fullyPaid: stillOwedCents <= 0,
  };
}

// The panel as one plain-text line, for the screen-reader
// announcement and for tests: amount paid, still owed (or fully
// paid), and the next due date (or that none is recorded). The
// still-owed part names the pending charges when any are pending
// (Plan 526), so the line cannot be misread as bill dues alone.
export function successNextStepsLineText(nextSteps) {
  if (!nextSteps || typeof nextSteps !== 'object') return '';
  if (typeof nextSteps.amountPaid !== 'number' || !Number.isFinite(nextSteps.amountPaid)) return '';
  if (typeof nextSteps.stillOwed !== 'number' || !Number.isFinite(nextSteps.stillOwed)) return '';
  const paid = `Paid PKR ${formatSuccessNextStepsAmount(nextSteps.amountPaid)}`;
  const owedLabel = nextSteps.chargesPending
    ? SUCCESS_NEXT_STEPS_STILL_OWED_CHARGES_TEXT
    : SUCCESS_NEXT_STEPS_STILL_OWED_TEXT;
  const owed = nextSteps.fullyPaid
    ? SUCCESS_NEXT_STEPS_FULLY_PAID_TEXT
    : `${owedLabel} PKR ${formatSuccessNextStepsAmount(nextSteps.stillOwed)}`;
  const due = nextSteps.nextDueDate
    ? `Next due ${nextSteps.nextDueDate}`
    : SUCCESS_NEXT_STEPS_NO_DUE_DATE_TEXT;
  return `${paid} · ${owed} · ${due}`;
}

// The panel markup: amount paid, still owed after this payment (or
// "Fully paid"), next due date, and a Collect again button that
// reopens the payment form for the same customer. All user text is
// escaped. The button carries only a data hook — the wiring owns
// what the tap does — and the panel reuses the receipt card's own
// row classes, so no new colour enters the stylesheet.
export function successNextStepsHtml(nextSteps) {
  if (!nextSteps || typeof nextSteps !== 'object') return '';
  const name = nextSteps.customerName
    ? ` · ${escapeHtml(nextSteps.customerName)}${nextSteps.customerNumber !== null && nextSteps.customerNumber !== undefined ? ` (#${escapeHtml(String(nextSteps.customerNumber))})` : ''}`
    : '';
  const owedLabel = nextSteps.chargesPending
    ? SUCCESS_NEXT_STEPS_STILL_OWED_CHARGES_TEXT
    : SUCCESS_NEXT_STEPS_STILL_OWED_TEXT;
  const owedRow = nextSteps.fullyPaid
    ? `<div class="qc-receipt-item"><span class="qc-meta-label">Still owed</span><strong class="qc-meta-val zero-balance">${escapeHtml(SUCCESS_NEXT_STEPS_FULLY_PAID_TEXT)}</strong></div>`
    : `<div class="qc-receipt-item"><span class="qc-meta-label">${escapeHtml(owedLabel)}</span><strong class="qc-meta-val has-balance">PKR ${escapeHtml(formatSuccessNextStepsAmount(nextSteps.stillOwed))}</strong></div>`;
  const dueRow = nextSteps.nextDueDate
    ? `<div class="qc-receipt-item"><span class="qc-meta-label">Next due date</span><strong class="qc-meta-val">${escapeHtml(nextSteps.nextDueDate)}</strong></div>`
    : `<div class="qc-receipt-item"><span class="qc-meta-label">Next due date</span><strong class="qc-meta-val">${escapeHtml(SUCCESS_NEXT_STEPS_NO_DUE_DATE_TEXT)}</strong></div>`;
  return `<div class="qc-receipt-card sns-next-steps" role="region" aria-label="What is next">
      <div class="qc-receipt-item"><span class="qc-meta-label">Amount paid</span><strong class="qc-meta-val">PKR ${escapeHtml(formatSuccessNextStepsAmount(nextSteps.amountPaid))}</strong></div>
      ${owedRow}
      ${dueRow}
      <div class="qc-receipt-item full-width"><span class="qc-meta-label">${escapeHtml(SUCCESS_NEXT_STEPS_HEADING_TEXT)}${name}</span><button type="button" class="secondary-button sns-collect-again" data-sns-collect-again>${escapeHtml(SUCCESS_NEXT_STEPS_COLLECT_AGAIN_TEXT)}</button></div>
    </div>`;
}
