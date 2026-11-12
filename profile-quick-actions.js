// Customer profile quick actions row (Plan 369): one row of four
// everyday actions on the profile — record a payment, write a fault
// note, draft a message, check the balance — each opening its screen
// with this customer already selected. It adds no new action type:
// payment reuses the Quick Collect flow, the fault note reuses the
// complaint register, the message draft reuses the balance reply
// draft, and the balance view reuses the at-a-glance strip. The row
// never changes any bill, payment, ticket, or customer record by
// itself, and it is never sent anywhere.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const PROFILE_QUICK_ACTIONS = Object.freeze([
  { key: 'payment', buttonId: 'pqaPaymentBtn', labelKey: 'prof_quick_action_payment' },
  { key: 'fault', buttonId: 'pqaFaultBtn', labelKey: 'prof_quick_action_fault' },
  { key: 'message', buttonId: 'pqaMessageBtn', labelKey: 'prof_quick_action_message' },
  { key: 'balance', buttonId: 'pqaBalanceBtn', labelKey: 'prof_quick_action_balance' },
]);

export const PROFILE_QUICK_ACTION_KEYS = Object.freeze(
  PROFILE_QUICK_ACTIONS.map(action => action.key),
);

function cleanProfileQuickActionsText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeProfileQuickActionsHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function defaultProfileQuickActionLabel(key) {
  if (key === 'payment') return 'Record payment';
  if (key === 'fault') return 'New fault note';
  if (key === 'message') return 'Message draft';
  if (key === 'balance') return 'Balance view';
  return '';
}

export function isProfileQuickActionKey(key) {
  return typeof key === 'string' && PROFILE_QUICK_ACTION_KEYS.includes(key);
}

/**
 * Where one quick action opens. Every key maps to a real opener, so
 * no tap opens nothing: payment and fault open their modals with the
 * customer already selected, while message and balance open the
 * profile's own draft and at-a-glance sections for that customer.
 * Unknown keys map to null.
 */
export function profileQuickActionTarget(key) {
  if (key === 'payment') return { kind: 'quick-collect', selector: null };
  if (key === 'fault') return { kind: 'complaint-register', selector: null };
  if (key === 'message') return { kind: 'balance-reply', selector: '#balanceReplyShowBtn' };
  if (key === 'balance') return { kind: 'header-strip', selector: '#phsStrip' };
  return null;
}

export function profileQuickActionsRowHtml(customerId, labels = {}) {
  const id = cleanProfileQuickActionsText(customerId);
  if (!id) return '';
  const heading = cleanProfileQuickActionsText(labels.heading) || 'Quick actions';
  // Profile Polish B (13) — the four buttons share one merged group
  // already; each takes its own colour (pqa-btn-<key>, styled in
  // styles.css from the customer-id pill palette), so the operator can
  // tell them apart at a glance. Order and targets never change.
  const buttons = PROFILE_QUICK_ACTIONS.map(action => {
    const label = cleanProfileQuickActionsText(labels[action.key]) || defaultProfileQuickActionLabel(action.key);
    return `<button type="button" class="secondary-button pqa-btn pqa-btn-${action.key}" id="${action.buttonId}" data-quick-action="${action.key}">${escapeProfileQuickActionsHtml(label)}</button>`;
  }).join('');
  return `<div class="profile-quick-actions" id="pqaRow" role="group" aria-label="${escapeProfileQuickActionsHtml(heading)}" data-customer-id="${escapeProfileQuickActionsHtml(id)}">${buttons}</div>`;
}
