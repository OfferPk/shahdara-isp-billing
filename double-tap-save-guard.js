/**
 * double-tap-save-guard.js — Plan 437: Quick Collect double-tap save guard.
 *
 * Problem: an impatient double-tap on Save can record the same quick
 * payment twice, because nothing stops the second tap while the first
 * save is still running.
 *
 * This module is the guard's whole rule, as pure state: one in-flight
 * save at a time. The controller arms it at the top of the submit
 * handler and clears it when the save settles, so a second tap for the
 * same payment is ignored while the first is still running, and a
 * second, separate payment after the first completes still works
 * normally. The guard never records, deletes, or changes any bill,
 * payment, or customer record by itself — it only answers "may this
 * save start now".
 *
 * How it differs from the five-minute duplicate detector that already
 * exists: that detector compares a NEW payment against payments
 * already on the ledger and asks the operator before recording a
 * likely duplicate. It cannot see a second tap that lands while the
 * first save is still running, because the first payment is not on the
 * ledger yet. This guard covers exactly that window — the save in
 * progress — and the two work together, neither replacing the other.
 *
 * The key names the payment being saved (customer, amount, method,
 * bill month, date), so a test can prove the refused second tap was
 * for the SAME payment. While a save is in flight every further start
 * is refused, whatever its key — the form cannot start a second
 * payment until the first one settles. The key is still recorded, so
 * the in-flight payment is inspectable, never anonymous.
 *
 * Amounts follow the defensive rule: a null, undefined, empty, or
 * boolean figure is "not a number", never zero — it reads as the
 * literal part 'none' in the key, so two taps with the same unusable
 * figure still share one key and the second is still refused.
 *
 * No store: the guard lives in the controller's closure for one
 * opening only. No clock: the guard is a flag, not a timer — callers
 * supply nothing time-based and this module never reads the clock.
 */

function guardCents(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

function guardPart(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

/**
 * A stable key identifying ONE save attempt: this customer, this
 * amount, this method, this bill month, this date. Two taps on Save
 * with the form untouched build the same key; any changed figure
 * builds a different one.
 */
export function doubleTapSaveGuardKey(input) {
  const source = input && typeof input === 'object' ? input : {};
  const cents = guardCents(source.amount);
  const amountPart = cents === null ? 'none' : String(cents);
  return [
    guardPart(source.customerId),
    amountPart,
    guardPart(source.method),
    guardPart(source.month),
    guardPart(source.date)
  ].join('|');
}

/** A fresh guard: no save in flight. */
export function createDoubleTapSaveGuard() {
  return { saving: false, key: null };
}

/**
 * Try to start a save for `key`. Returns true and arms the guard when
 * no save is in flight; returns false and changes nothing when one
 * already is — the caller ignores the second tap.
 */
export function doubleTapSaveGuardTryStart(guard, key) {
  if (!guard || typeof guard !== 'object') return false;
  if (guard.saving) return false;
  guard.saving = true;
  guard.key = typeof key === 'string' ? key : String(key ?? '');
  return true;
}

/** Clear the guard: the save has settled, the next save may start. */
export function doubleTapSaveGuardFinish(guard) {
  if (!guard || typeof guard !== 'object') return;
  guard.saving = false;
  guard.key = null;
}

/** True while a save started through this guard is still in flight. */
export function doubleTapSaveGuardIsSaving(guard) {
  return Boolean(guard && typeof guard === 'object' && guard.saving);
}

/**
 * The visible half of the guard: disable a save button while a save
 * is in progress, enable it again when the save settles. Null-safe —
 * a host page that predates the button simply has nothing to disable.
 */
export function doubleTapSaveGuardSetDisabled(button, disabled) {
  if (!button || typeof button !== 'object') return;
  button.disabled = Boolean(disabled);
}
