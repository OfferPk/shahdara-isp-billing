// Plan 444 — Quick Collect pending clearance flag at entry for transfer
// and cheque: one plain line on the Quick Collect screen while the
// chosen method is a bank transfer or a cheque, saying the bill
// settles only when the money clears. A transfer or cheque taken at
// the counter looks settled on the entry screen, but it is only
// pending until it clears (Plan 123), so the customer can leave
// believing they are fully paid. This plan adds only the missing
// piece: the flag itself, shown before the save on the entry form
// and after the save on the success screen.
//
// What this module NEVER does, stated plainly:
//   - it never clears anything: the flag is a reading of the chosen
//     method only, and the payment still records normally as pending;
//   - it never changes a bill, a payment, a clearance status, or a
//     customer record — there is no store, no save, and no edit here;
//   - it never invents a method: only a transfer or a cheque flags,
//     every other method — cash, wallet, Raast, a shop method —
//     shows nothing, and a damaged value flags nothing either;
//   - it never reads storage, the clock, or the page, takes no other
//     module, and never mutates an input.
//
// Method spellings: the counter records methods as plain words
// ("Bank Transfer"), while the clearance record behind Plan 123
// keeps the same methods as codes ("bank_transfer", "cheque").
// Both spellings flag, so the flag cannot miss a transfer or a
// cheque whichever form the caller hands over. Raast is instant
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
