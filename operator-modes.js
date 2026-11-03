// Plan 33 (Plan 1-100) — Owner and collector operator modes.
//
// Problem: every operator sees every action, so a collector on a field
// phone can reach destructive or settings screens that only the owner
// should touch.
//
// Scope fence, stated plainly:
//   - Two on-device modes only, owner and collector, set by the owner
//     with no server or cloud account and no password or account
//     system invented: this app has no operator identity (the same
//     honest limit Plan 31 states for its audit log), so the mode is
//     a guard against accidental taps, not a security boundary. The
//     "owner's step" for switching back to owner mode is a deliberate
//     confirmation dialog in the owner panel / header control, and
//     every switch is recorded in the Plan 31 audit log.
//   - Collector mode shows collection, field, and customer lookup
//     screens (customers + transactions views, the field-mode overlay,
//     profiles, Quick Collect) and blocks the owner-only views and
//     actions below. Blocking is enforced by the gate functions here
//     and applied in app.js at the navigation switch and at each
//     guarded handler — a hidden menu button alone never counts, so
//     the switch itself refuses a blocked view and each guarded
//     handler refuses a blocked action with a toast.
//   - Owner mode shows everything and changes nothing about any
//     billing, payment, or lifecycle rule: the same customer's figures
//     are identical in both modes, because the mode only gates which
//     screens and actions are reachable, never any figure.
//   - This is NOT the SISP-80 owner PIN lock (which prompts for a PIN
//     on four money-oversight actions when the owner has set a PIN and
//     turned Restricted Mode on). The two systems are independent: a
//     PIN-locked action stays PIN-locked in owner mode, and collector
//     mode blocks its own list whether or not a PIN is set.
//   - Import-free, like campaign-planner.js and audit-log.js: the
//     caller supplies the mode and the action, the module never reads
//     storage, the clock, or the network, and never mutates an input.

export const OPERATOR_MODES = Object.freeze([
  { value: 'owner', label: 'Owner' },
  { value: 'collector', label: 'Collector' },
]);

const MODE_LABELS = new Map(OPERATOR_MODES.map((m) => [m.value, m.label]));

export function operatorModeLabel(mode) {
  return MODE_LABELS.get(mode) ?? null;
}

/** Anything that is not exactly 'collector' is owner mode (the default). */
export function normalizeOperatorMode(value) {
  return value === 'collector' ? 'collector' : 'owner';
}

/**
 * Actions only the owner may perform. Anything not listed here is a
 * collector-visible action (collection, field work, customer lookup).
 * The labels name the app surfaces these actions live on.
 */
export const OWNER_ONLY_ACTIONS = Object.freeze([
  { value: 'backup-download', label: 'Download backup' },
  { value: 'backup-share', label: 'Share backup' },
  { value: 'backup-restore', label: 'Restore backup' },
  { value: 'settings', label: 'Settings' },
  { value: 'payment-void', label: 'Void payment' },
  { value: 'expense-delete', label: 'Delete expense' },
  { value: 'customer-delete', label: 'Delete customer' },
  { value: 'customer-archive', label: 'Archive customer' },
  { value: 'partner-settlement', label: 'Partner settlement' },
  { value: 'partner-shares', label: 'Partner shares' },
]);

const OWNER_ONLY_VALUES = new Set(OWNER_ONLY_ACTIONS.map((a) => a.value));

export function operatorActionLabel(action) {
  const found = OWNER_ONLY_ACTIONS.find((a) => a.value === action);
  return found ? found.label : null;
}

/** Owner may do everything; collector may do everything except the list above. */
export function canPerformAction(mode, action) {
  if (normalizeOperatorMode(mode) === 'owner') return true;
  return !OWNER_ONLY_VALUES.has(action);
}

/** Views the collector may open: customers (lookup) and transactions (collection). */
export const COLLECTOR_VISIBLE_VIEWS = Object.freeze(['customers', 'transactions']);

/**
 * 'full' — the view opens normally. 'blocked' — the view must not open
 * in this mode; the caller refuses the navigation with a toast. Owner
 * mode opens every view; collector mode opens only the two listed
 * views, and an unknown view is blocked in collector mode (fail closed).
 */
export function viewAccess(mode, view) {
  if (normalizeOperatorMode(mode) === 'owner') return 'full';
  return COLLECTOR_VISIBLE_VIEWS.includes(view) ? 'full' : 'blocked';
}

/**
 * Describe a requested switch without applying it. Switching to
 * collector mode needs no extra step (the owner hands the phone over);
 * switching back to owner mode needs the owner's step (a deliberate
 * confirmation), so needsOwnerStep is true only for collector → owner.
 * A switch to the current mode, or to an unknown mode, changes nothing.
 */
export function requestModeSwitch(current, target) {
  const from = normalizeOperatorMode(current);
  if (target !== 'owner' && target !== 'collector') {
    return { from, to: from, changed: false, needsOwnerStep: false };
  }
  if (target === from) {
    return { from, to: from, changed: false, needsOwnerStep: false };
  }
  return { from, to: target, changed: true, needsOwnerStep: target === 'owner' };
}

/**
 * Apply a requested switch. Returns the resulting mode: the target when
 * the switch is allowed, otherwise the current mode unchanged. A
 * collector → owner switch without the owner's confirmation is refused.
 */
export function applyModeSwitch(current, target, { ownerConfirmed = false } = {}) {
  const request = requestModeSwitch(current, target);
  if (!request.changed) return request.from;
  if (request.needsOwnerStep && !ownerConfirmed) return request.from;
  return request.to;
}

export function operatorModeSummaryText(mode) {
  const normalized = normalizeOperatorMode(mode);
  if (normalized === 'collector') {
    return 'Current mode: Collector — collection, field and customer lookup only. Owner screens, backup, restore, settings and destructive actions are blocked. Switch back to owner mode only with the owner\'s confirmation; every switch is recorded in the audit log.';
  }
  return 'Current mode: Owner — everything is available. Switch to collector mode before handing the phone to a collector; every switch is recorded in the audit log.';
}

function escapeOperatorModeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Panel body: current mode, what each mode may do, and both switch buttons. */
export function operatorModeHtml(mode) {
  const current = normalizeOperatorMode(mode);
  const ownerOnlyList = OWNER_ONLY_ACTIONS.map((a) => escapeOperatorModeHtml(a.label)).join(', ');
  return `<p>Current mode: <strong>${escapeOperatorModeHtml(operatorModeLabel(current))}</strong></p>`
    + `<p>${escapeOperatorModeHtml(operatorModeSummaryText(current))}</p>`
    + `<p>Owner-only actions in collector mode: ${ownerOnlyList}.</p>`
    + `<p>Collector mode still shows customers, transactions, field mode, profiles and Quick Collect, and the same customer's figures are identical in both modes.</p>`
    + `<div style="display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0;">`
    + `<button data-operator-mode-target="owner" class="secondary-button btn-sm" type="button" style="font-size: 11px; padding: 4px 10px;"${current === 'owner' ? ' disabled' : ''}>Switch to owner mode</button>`
    + `<button data-operator-mode-target="collector" class="secondary-button btn-sm" type="button" style="font-size: 11px; padding: 4px 10px;"${current === 'collector' ? ' disabled' : ''}>Switch to collector mode</button>`
    + `</div>`
    + `<p>Switching back to owner mode asks for the owner's confirmation first. The other mode button is in the header (next to the field-mode toggle), so the mode can be switched back even while owner screens are blocked.</p>`
    + `<p>Note: this mode is a guard against accidental taps, not a password lock — the app has no accounts. When the owner PIN lock (SISP-80) is set, its PIN prompts still apply in owner mode.</p>`
    + `<p>Switch history lives in the audit log panel below, under “Operator mode switched”.</p>`;
}

/** Short label for the header toggle button. */
export function operatorModeToggleLabel(mode) {
  return `Mode: ${operatorModeLabel(normalizeOperatorMode(mode))}`;
}
