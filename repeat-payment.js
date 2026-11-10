// Plan 490 — record another payment for the same customer, one tap
// after saving: after one payment is saved, the success screen
// offers a repeat action that opens a fresh Add payment form with
// the same customer already chosen and nothing else carried over —
// an empty amount. A customer paying for two connections or two
// months finishes both payments in one visit without the operator
// searching twice, and each payment stays its own honest record.
//
// QC receipt-modal overhaul (§4.5.3): the panel itself is superseded
// — the small "Empty amount" text button under the next-action row
// carries the same handler (openCustomerCollectionForm with
// { emptyAmount: true }). This module is KEPT: repeatPaymentFormTarget
// / repeatPaymentHtml stay for their tests.
//
// Checked first, so this module is only the missing piece:
//   - The success next-steps panel already offers a collect-again
//     action, but it reopens the form with the suggested amount
//     prefilled (the full-dues default) — not a fresh form with an
//     empty amount.
//   - The second-connection step already records the customer's
//     other connection in the same pass — a different payment for a
//     different connection, not a fresh form for the same customer.
// Neither is what this plan adds.
//
// The repeat target is the whole decision, kept pure: the same
// customer id, an empty amount, and nothing else. The repeat reuses
// the form's ordinary fresh-open defaults (today's date, the
// customer's remembered method) — only the amount is forced empty,
// because the amount is the one figure the previous save would
// otherwise carry over through the suggested-amount prefill.
//
// The button only asks for the form; the wiring opens it, and the
// tap records nothing by itself. The second payment is recorded
// only when the operator saves the fresh form, and leaving without
// saving records nothing. The button carries no money figure at
// all, so no currency symbol or code can appear on it.
//
// The module is standalone: it reads no storage, no clock, and no
// page, takes no other module, and never mutates an input. All
// user text is escaped before it reaches HTML.

export const REPEAT_PAYMENT_BUTTON_TEXT = 'Record another — empty amount';

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

// The repeat target for one customer: the same customer id, an
// empty amount, and nothing else — no amount, no method, no month,
// no figure of any kind is carried over from the payment just
// saved. Null when the customer id is unusable, so a repeat can
// never open for nobody.
export function repeatPaymentFormTarget(customerId) {
  const id = text(customerId);
  if (!id) return null;
  return { customerId: id, amount: '' };
}

// The repeat button: type="button" so the tap can never submit
// anything, carrying the customer id in a data attribute so the
// wiring opens the form for exactly that customer. It reuses the
// secondary-button look, so no new style enters the stylesheet.
// Null when there is no usable target — a button that opens
// nowhere is worse than no button.
export function repeatPaymentHtml(target) {
  if (!target || typeof target !== 'object') return '';
  const id = text(target.customerId);
  if (!id) return '';
  if (target.amount !== '') return '';
  return `<button type="button" class="secondary-button rpt-repeat-payment" data-rpt-repeat-payment data-rpt-customer-id="${escapeHtml(id)}">${escapeHtml(REPEAT_PAYMENT_BUTTON_TEXT)}</button>`;
}
