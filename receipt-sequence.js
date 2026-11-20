// QC receipt numbering — one global sequential receipt number (1, 2, 3, ...).
// Every payment recorded through addPayment (core.js) gets the next number
// of this single counter, across all customers and all months: the first
// receipt ever is 1, the next is 2, and so on. Each bill gets exactly one
// unique receipt number.
//
// The number is a NEW field, `receiptSequence`, on the payment — the
// stored numbers are NOT touched: the transient QC display number
// (RCPT-<customer>-<YYYYMM>-<nn>) and the permanent generated number
// (REC-<YYMM>-<customer>-<tail>) keep their exact shapes. Two reasons
// the sequence must never live in `payment.receiptNumber`:
//  - the receipt-book filter (ledger-receipt-book.js) matches an entry
//    to a collector's book when its STORED receiptNumber is a plain
//    integer inside that book's range — a plain-integer sequence would
//    be misattributed to a collector's book;
//  - the gap audit (receipt-gap-audit.js) counts only exact-digit
//    references as plain numbers — a plain-integer sequence would feed
//    its plain run and invent gaps.
// VER codes, PNG, reprints, the offline queue and the gap audit all
// keep reading receiptNumber / permanentReceiptNumber, so they never
// see the sequence.
//
// Counter home (the Plan 67 ticket pattern): the live counter is the
// state field `receiptSequenceNext`, bumped in addPayment; the
// localStorage key below is its mirror, written on save and at boot,
// and reconciled on restore as max(stored, snapshot, seed). The next
// number is always max(stored, highest assigned, state field), so a
// lost counter save is healed by the list floor and a deleted payment
// (5s undo) never has its number re-issued — a skipped number is a
// gap, never a duplicate.
//
// Migration: `ensureReceiptSequences` runs once at boot (and is
// idempotent, so running it again is safe). Stored payments that lack
// a sequence get 1..N in (payment date, ledger order) order; payments
// restored later from an old backup get the next counter value, never
// their chronological position — stability over chronology. Stored
// receiptNumber / permanentReceiptNumber values are NEVER rewritten.
//
// Pure and import-free; storage is injected, so tests run without it.
export const RECEIPT_SEQUENCE_KEY = 'shahdara_receipt_sequence_next_v1';

// The stored NEXT number, or null when the key is absent / corrupt.
// Never throws — a missing key just means "not seeded yet".
export function readReceiptSequenceCounter(storage) {
  try {
    const raw = storage?.getItem?.(RECEIPT_SEQUENCE_KEY);
    if (raw === null || raw === undefined) return null;
    const n = Number(raw);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

// Write the next number. Never rewinds: the stored value stays the
// max of what is already stored and the value offered (the ticket
// counter's writeTicketCounter rule).
export function writeReceiptSequenceCounter(storage, nextNumber) {
  try {
    const n = Number(nextNumber);
    if (!Number.isSafeInteger(n) || n <= 0) return readReceiptSequenceCounter(storage);
    const kept = Math.max(readReceiptSequenceCounter(storage) ?? 0, n);
    storage?.setItem?.(RECEIPT_SEQUENCE_KEY, String(kept));
    return kept;
  } catch {
    return readReceiptSequenceCounter(storage);
  }
}

// Every positive-integer sequence already assigned on stored payments,
// in ledger order (customers, bills, payments as stored).
export function allReceiptSequences(state) {
  const out = [];
  for (const customer of (state?.customers ?? [])) {
    for (const bill of (customer?.bills ?? [])) {
      for (const payment of (bill?.payments ?? [])) {
        if (payment && Number.isSafeInteger(payment.receiptSequence) && payment.receiptSequence > 0) {
          out.push(payment.receiptSequence);
        }
      }
    }
  }
  return out;
}

export function maxReceiptSequence(state) {
  let max = 0;
  for (const n of allReceiptSequences(state)) if (n > max) max = n;
  return max;
}

// The seed for a fresh counter: one past the highest assigned number,
// or 1 when no payment carries a sequence yet.
export function computeReceiptSequenceSeed(state) {
  return maxReceiptSequence(state) + 1;
}

// Seed the counter once, when the key is absent. Later calls are no-ops.
export function seedReceiptSequenceCounter(storage, state) {
  const existing = readReceiptSequenceCounter(storage);
  if (existing !== null) return existing;
  const next = computeReceiptSequenceSeed(state);
  writeReceiptSequenceCounter(storage, next);
  return next;
}

// The next number to issue: max(stored key, highest assigned + 1,
// state field) — the never-rewind floor. Without storage (pure/test
// use) the stored term drops out and the state field + list floor
// decide, exactly like nextTicketId without storage.
export function nextReceiptSequence(state, storage = null) {
  const stored = storage ? readReceiptSequenceCounter(storage) : null;
  const stateNext = Number.isSafeInteger(state?.receiptSequenceNext) && state.receiptSequenceNext > 0
    ? state.receiptSequenceNext
    : 1;
  return Math.max(stored ?? 1, maxReceiptSequence(state) + 1, stateNext);
}

// Assign sequences to stored payments that lack one, in (payment date,
// ledger order) order — the backfill for receipts recorded before this
// feature. Payments with no usable date sort last (never first: an
// unknown date must not jump the queue ahead of dated receipts).
// Only the new field is filled; stored receiptNumber /
// permanentReceiptNumber values are never written here. Returns the
// number of payments backfilled. Idempotent: a second run finds no
// unsequenced payment and assigns nothing.
export function backfillReceiptSequences(state, storage = null) {
  const pending = [];
  let ledgerIndex = 0;
  for (const customer of (state?.customers ?? [])) {
    for (const bill of (customer?.bills ?? [])) {
      for (const payment of (bill?.payments ?? [])) {
        if (!payment || typeof payment !== 'object') continue;
        ledgerIndex += 1;
        if (Number.isSafeInteger(payment.receiptSequence) && payment.receiptSequence > 0) continue;
        const date = typeof payment.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(payment.date)
          ? payment.date.slice(0, 10)
          : '9999-12-31';
        pending.push({ payment, date, ledgerIndex });
      }
    }
  }
  pending.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ledgerIndex - b.ledgerIndex));
  let next = nextReceiptSequence(state, storage);
  for (const { payment } of pending) {
    payment.receiptSequence = next;
    next += 1;
  }
  if (pending.length > 0 && state && typeof state === 'object') {
    state.receiptSequenceNext = next;
    if (storage) writeReceiptSequenceCounter(storage, next);
  }
  return pending.length;
}

// Boot entry: backfill once, then hydrate the state field from the
// key (or the seed) so the first issue after boot is correct. Safe to
// run on every boot — the backfill assigns nothing the second time.
export function ensureReceiptSequences(state, storage = null) {
  if (!state || typeof state !== 'object') return state;
  backfillReceiptSequences(state, storage);
  const next = nextReceiptSequence(state, storage);
  state.receiptSequenceNext = next;
  if (storage) writeReceiptSequenceCounter(storage, next);
  return state;
}
