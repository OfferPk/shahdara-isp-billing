// Plan 97 (Plan 1-100) — Field Mode big-touch, sunlight-readable
// collection view.
//
// PRESENTATION ONLY. This module renders the large-format field view:
// icon-led visit-outcome buttons with short Urdu labels, and the class
// name that switches the Field Mode overlay into its sunlight-readable
// size. It changes no collection, billing, or visit rule, and it is not
// the general keyboard/focus accessibility work (Plan C) or the
// small-phone layout work (Plan D) — it is the outdoor, one-hand field
// view specifically.
//
// The module is import-free by design (like visit-outcomes.js and
// suggestion-log.js): it reads no store, writes no store, touches no
// DOM, and never mutates its inputs. Switching the field view on or
// off only adds or removes a CSS class, so it can never change a
// payment, visit, or route record.
//
// Outcome catalogue: exactly Plan 2's six visit outcomes, in Plan 2's
// order. The route sheet's outcome row adds one extra button —
// 'partial', the pre-existing payment-split outcome — so no marking
// ability the sheet already had is lost; partial is NOT a Plan 2
// outcome and is labelled as such in the row builder.

export const FIELD_VIEW_CLASS = 'field-view-big';

// CSS class switched on the Field Mode overlay (#fieldModeView) while
// the sunlight-readable view is on. Off means the overlay's ordinary
// sizes — nothing else changes.
export function fieldViewClassFor(enabled) {
  return enabled ? FIELD_VIEW_CLASS : '';
}

// Plan 2's six visit outcomes, each with its icon and short labels.
// The Urdu label is Urdu script (the collector reads it at a glance
// in the field); the English label is the button's title text.
export const FIELD_VIEW_OUTCOMES = Object.freeze([
  { outcome: 'paid', icon: '💵', urdu: 'ادا', english: 'Paid' },
  { outcome: 'promised', icon: '🤝', urdu: 'وعدہ', english: 'Promised' },
  { outcome: 'not_home', icon: '🚪', urdu: 'گھر پر نہیں', english: 'Not home' },
  { outcome: 'refused', icon: '✕', urdu: 'انکار', english: 'Refused' },
  { outcome: 'dispute', icon: '⚠️', urdu: 'اختلاف', english: 'Dispute' },
  { outcome: 'no_answer', icon: '🔕', urdu: 'جواب نہیں', english: 'No answer' },
]);

// The route sheet's extra, non-Plan-2 outcome button: a partial payment
// is a payment-split outcome handled by the payment flow, not a Plan 2
// visit outcome — but the sheet already offered it, so the row keeps it.
export const FIELD_VIEW_PARTIAL_BUTTON = Object.freeze({
  outcome: 'partial', icon: '½', urdu: 'جزوی', english: 'Partial',
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function fieldViewButtonMarkup(button, { customerId, active }) {
  const isActive = active === button.outcome;
  return `<button type="button" class="field-view-outcome-btn${isActive ? ' is-active' : ''}" data-set-outcome="${escapeHtml(button.outcome)}" data-customer-id="${escapeHtml(customerId)}" title="${escapeHtml(button.english)}" aria-pressed="${isActive}"><span aria-hidden="true">${escapeHtml(button.icon)}</span> <span lang="ur">${escapeHtml(button.urdu)}</span></button>`;
}

// One icon-led outcome button, or '' for an unknown outcome (never a
// button for something the catalogue does not name).
export function fieldViewOutcomeButton({ outcome, customerId, activeOutcome } = {}) {
  const button = FIELD_VIEW_OUTCOMES.find((entry) => entry.outcome === outcome);
  if (!button) return '';
  return fieldViewButtonMarkup(button, { customerId, active: activeOutcome });
}

// The route sheet's outcome row: the six Plan 2 outcomes plus the
// pre-existing partial button, in the sheet's old order (paid,
// partial, promised, not home, refused) with the two Plan 2 outcomes
// the sheet was missing (dispute, no answer) added at the end. The
// data-set-outcome / data-customer-id contract the sheet's click
// handler reads is unchanged, so marking works exactly as before —
// only the buttons are bigger and carry icon + Urdu label.
export function fieldViewRouteOutcomeButtons({ activeOutcome, customerId } = {}) {
  const row = [
    FIELD_VIEW_OUTCOMES[0],
    FIELD_VIEW_PARTIAL_BUTTON,
    FIELD_VIEW_OUTCOMES[1],
    FIELD_VIEW_OUTCOMES[2],
    FIELD_VIEW_OUTCOMES[3],
    FIELD_VIEW_OUTCOMES[4],
    FIELD_VIEW_OUTCOMES[5],
  ];
  return row
    .map((button) => fieldViewButtonMarkup(button, { customerId, active: activeOutcome }))
    .join('');
}
