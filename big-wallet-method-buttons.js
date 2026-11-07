// Quick Collect big wallet method buttons (Plan 438): one row of big
// method buttons on the Quick Collect screen — Cash, JazzCash and
// Easypaisa, the three methods used at the counter — plus the full
// method list for anything else. A button selects only: it writes the
// method into the form's hidden method select, the single source of
// truth, exactly as the existing method chips already do. It never
// posts the payment and never changes any bill, payment, or customer
// record by itself.
//
// What already existed, and what this plan adds:
//   - The form already carried one small chip per common method, and
//     the hidden select already carried every offered method. What
//     was missing was (a) the three counter methods as BIG buttons
//     the operator's thumb can hit without hunting, and (b) any way
//     to reach the full list at all — the select was hidden, so a
//     method with no chip of its own could not be picked on this
//     form. This module adds only those two pieces: the big-three
//     list, and the "anything else" rule that lights the Other button
//     and shows the full list. The Bank and Raast chips stay exactly
//     as they were, and the select still carries every offered
//     method, so no method loses a way in.
//   - The one-screen flow keeps its own method select and is
//     untouched; this row lives on the normal Quick Collect form
//     only.
//   - A cash-family method (plain Cash or a shop method) keeps Cash
//     lit, per the shop-chip rule — the Other button never lights
//     for cash, because cash already has its own row below.
//   - The module is pure and import-free: the caller supplies the
//     method, the offered list and the cash-family answer. It never
//     reads storage, the clock, or the network, and never mutates
//     an input. Money is rupees throughout, PKR only, never
//     converted.

export const BIG_WALLET_METHODS = Object.freeze(['Cash', 'JazzCash', 'Easypaisa']);

// True exactly for the three big-button methods. Anything else —
// another method, a blank, a non-string — is not a big-button
// method, never a guess.
export function bigWalletMethodIsBigMethod(method) {
  return typeof method === 'string' && BIG_WALLET_METHODS.includes(method);
}

// The offered methods that are NOT big-button methods, in the
// caller's order. These are the methods the full list covers: the
// big three are already one tap away, everything else comes from
// the list. A non-array offers nothing, never a guessed list.
export function bigWalletMethodOtherMethods(methods) {
  if (!Array.isArray(methods)) return [];
  return methods.filter((method) => !bigWalletMethodIsBigMethod(method));
}

// True exactly while the Other button should show as the active
// choice: the method is one the app actually offers, it is none of
// the three big-button methods, and it is not a cash-family method
// (cash keeps Cash lit). A damaged value — not offered, blank, not
// a string — is never "other": nothing lights and no list is shown
// for a value that cannot be recorded.
export function bigWalletMethodIsOtherMethod(method, offeredMethods, isCashFamily) {
  if (typeof method !== 'string' || method === '') return false;
  if (!Array.isArray(offeredMethods) || !offeredMethods.includes(method)) return false;
  if (isCashFamily) return false;
  return !bigWalletMethodIsBigMethod(method);
}
