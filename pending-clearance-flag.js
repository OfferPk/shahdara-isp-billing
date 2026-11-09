// Plan 444 — Quick Collect pending clearance flag: one plain line on
// the Quick Collect screen while the chosen method is a bank
// transfer, saying the bill settles only when the money clears. A
// transfer taken at the counter looks settled on the entry screen,
// but it is only pending until it clears (Plan 123), so the
// customer can leave believing they are fully paid. This plan adds
// only the missing piece: the flag itself, shown before the save on
// the entry form and after the save on the success screen.
//
// Plan 535 — the entry form's half changed: the app offers no Cheque
// method (PAYMENT_METHODS carries none, and validatePayment rejects
// it), so the entry form flags a Bank Transfer only and its text
// names the transfer. The success screen keeps the old rule — a
// transfer or a legacy cheque still flags there — because a cheque
// recorded in an older or imported record can still arrive.
//
// What this module NEVER does, stated plainly:
//   - it never clears anything: the flag is a reading of the chosen
//     method only, and the payment still records normally as pending;
//   - it never changes a bill, a payment, a clearance status, or a
//     customer record — there is no store, no save, and no edit here;
//   - it never invents a method: the entry form flags a Bank Transfer
//     only, and the receipt flag flags only a transfer or a legacy
//     cheque; every other method — cash, wallet, Raast, a shop
//     method — shows nothing, and a damaged value flags nothing
//     either;
//   - it never reads storage, the clock, or the page, takes no other
//     module, and never mutates an input.
//
// Method spellings: the counter records methods as plain words
// ("Bank Transfer"), while the clearance record behind Plan 123
// keeps the same methods as codes ("bank_transfer", "cheque").
// Both spellings flag, so neither flag can miss a transfer
// whichever form the caller hands over. Raast is instant
// and never waits for clearance, so it never flags.

export const PENDING_CLEARANCE_FLAG_TEXT = 'pending clearance — bill settles when cleared';

const PENDING_CLEARANCE_METHOD_KEYS = Object.freeze(['bank transfer', 'cheque']);

// One spelling for a method: trimmed, lowercased, underscores read
// as spaces, runs of spaces collapsed. Anything that is not a
// string has no spelling, never a guessed one.
function pendingClearanceFlagMethodKey(method) {
  if (typeof method !== 'string') return '';
  return method.trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
}

// The flag text for one chosen method, or '' when the method needs
// no flag: only a bank transfer or a cheque flags, and a blank,
// damaged, or unknown method flags nothing.
export function pendingClearanceFlagForMethod(method) {
  return PENDING_CLEARANCE_METHOD_KEYS.includes(pendingClearanceFlagMethodKey(method))
    ? PENDING_CLEARANCE_FLAG_TEXT
    : '';
}

// Plan 535 — the entry form's flag text: it names the Bank Transfer —
// the only clearable method the app offers. The entry form never
// promises another method; the receipt-side flag below keeps the
// old rule for older records.
export const PENDING_CLEARANCE_ENTRY_FLAG_TEXT = 'Bank transfer — bill settles when cleared';

// The entry form's rule: only a Bank Transfer flags. Every other
// method — cash, wallet, Raast, a shop method — flags nothing on
// the entry form, never a guess.
export function pendingClearanceEntryFlagForMethod(method) {
  return pendingClearanceFlagMethodKey(method) === 'bank transfer'
    ? PENDING_CLEARANCE_ENTRY_FLAG_TEXT
    : '';
}

// The flag text for a saved receipt, or '' when no flag is owed:
// the receipt's own method, or — for a split collection, whose
// combined method names both legs at once — any one leg's method.
// A receipt with no usable method flags nothing, never a guess.
export function pendingClearanceFlagForReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return '';
  if (pendingClearanceFlagForMethod(receipt.method)) return PENDING_CLEARANCE_FLAG_TEXT;
  const legs = receipt.splitTender?.legs;
  if (Array.isArray(legs)) {
    for (const leg of legs) {
      if (leg && typeof leg === 'object' && pendingClearanceFlagForMethod(leg.method)) {
        return PENDING_CLEARANCE_FLAG_TEXT;
      }
    }
  }
  return '';
}
