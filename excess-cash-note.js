// Transaction excess cash note (Plan 395): when a customer hands
// over more cash than the dues, the extra sits unexplained unless
// somebody records at the counter what it is for. One excess note
// on the transaction carries the extra amount and its stated purpose
// in plain words — advance, credit, or change to return — recorded
// with the payment when the amount exceeds the dues. It notes the
// extra only and it applies nothing by itself: it never creates an
// advance record, never touches any credit balance, and never
// changes any bill, payment total, or past total. The advance and
// credit-balance mechanisms (Plans 101 and 103) stay exactly as
// they are, and this note is a different note from the overpayment
// choice (Plan 386) — the choice says advance-or-credit, this note
// says how much extra and what it is for, including change to
// return.
//
// The note rides the payment record itself (the same field the
// payment validator keeps), so it needs no store of its own: the
// record is the note. The validator is given the dues at entry time
// and keeps the note only when the amount strictly exceeds them,
// with the extra recomputed as amount minus dues — a note on a
// payment that does not exceed the dues stores nothing, and a
// missing purpose stores nothing too. A payment with no excess
// shows nothing extra.
//
// Pure and import-free: no storage, no DOM, no network, no other
// module. Inputs are never mutated.

export const EXCESS_CASH_PURPOSES = Object.freeze(['advance', 'credit', 'change']);

function foldExcessCashPurpose(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** True only for the three words a purpose can ever be. */
export function isExcessCashPurpose(value) {
  return EXCESS_CASH_PURPOSES.includes(foldExcessCashPurpose(value));
}

function finiteCents(value) {
  // Number(null), Number('') and Number(false) are all 0 — none of
  // those is a dues or amount figure, so they count as "not a
  // number" here instead of zero dues.
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const cents = Number(value);
  return Number.isFinite(cents) ? Math.round(cents) : null;
}

/**
 * The extra over the dues, in integer cents, or 0 when the amount
 * does not exceed the dues. Dues and amount are both integer cents;
 * anything that is not a number counts as no extra.
 */
export function excessCashExtraCents(duesCents, amountCents) {
  const dues = finiteCents(duesCents);
  const amount = finiteCents(amountCents);
  if (dues === null || amount === null) return 0;
  return Math.max(0, amount - dues);
}

/**
 * Defensive reader: the excess note a payment carries, or null.
 * Only a well-formed record counts — a valid purpose word and a
 * positive integer extra — so a damaged record reads as no note.
 */
export function excessCashNoteOf(payment) {
  const raw = payment?.excessCashNote;
  if (!raw || typeof raw !== 'object') return null;
  const purpose = foldExcessCashPurpose(raw.purpose);
  if (!EXCESS_CASH_PURPOSES.includes(purpose)) return null;
  const extraCents = Number(raw.extraCents);
  if (!Number.isFinite(extraCents) || !Number.isInteger(extraCents) || extraCents <= 0) return null;
  return { purpose, extraCents };
}

/**
 * Normalize one excess cash note. With the dues known (the entry
 * form passes them), the note is kept only when the amount strictly
 * exceeds the dues, and the recorded extra is the amount over the
 * dues — a note on a payment that does not exceed the dues stores
 * nothing, and a missing or unknown purpose stores nothing too (the
 * purpose is offered, never invented). Without the dues (a
 * correction carrying the note the payment already has), a note
 * that is already a well-formed record is kept as-is, so a
 * correction never silently strips it; a bare purpose word with no
 * dues to check against stores nothing.
 */
export function normalizeExcessCashNote(raw, duesCents, amountCents) {
  const dues = finiteCents(duesCents);
  if (dues !== null) {
    const extraCents = excessCashExtraCents(dues, amountCents);
    if (extraCents <= 0) return null;
    const purpose = foldExcessCashPurpose(raw && typeof raw === 'object' ? raw.purpose : raw);
    if (!EXCESS_CASH_PURPOSES.includes(purpose)) return null;
    return { purpose, extraCents };
  }
  return excessCashNoteOf({ excessCashNote: raw });
}

const EXCESS_CASH_NOTE_LABELS_DEFAULT = {
  extra: 'Extra',
  advance: 'as advance',
  credit: 'held as credit',
  change: 'change to return',
};

function excessCashNoteLabels(labels = {}) {
  return {
    extra: String(labels.extra ?? EXCESS_CASH_NOTE_LABELS_DEFAULT.extra),
    advance: String(labels.advance ?? EXCESS_CASH_NOTE_LABELS_DEFAULT.advance),
    credit: String(labels.credit ?? EXCESS_CASH_NOTE_LABELS_DEFAULT.credit),
    change: String(labels.change ?? EXCESS_CASH_NOTE_LABELS_DEFAULT.change),
  };
}

function formatExcessCashAmountDefault(cents) {
  const rupees = cents / 100;
  return `PKR ${rupees.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * The note in plain words: "Extra PKR 500 as advance",
 * "Extra PKR 500 held as credit", or "Extra PKR 500 — change to
 * return", or '' when the payment carries no note. Unescaped —
 * callers must escape before inserting into HTML.
 */
export function excessCashNoteLineText(note, labels = {}, formatAmount = formatExcessCashAmountDefault) {
  const normalized = excessCashNoteOf({ excessCashNote: note });
  if (!normalized) return '';
  const merged = excessCashNoteLabels(labels);
  if (normalized.purpose === 'change') return `${merged.extra} ${formatAmount(normalized.extraCents)} — ${merged.change}`;
  const how = normalized.purpose === 'advance' ? merged.advance : merged.credit;
  return `${merged.extra} ${formatAmount(normalized.extraCents)} ${how}`;
}

function escapeExcessCashNoteHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * The note as it appears beside a transaction: a ' · …' suffix
 * for the payment-meta line, or '' when the payment carries no
 * note, so a transaction without one shows nothing extra. The
 * purpose words themselves are folded to three fixed values, and
 * the caller-supplied labels are always escaped.
 */
export function excessCashNoteMarkup(payment, labels = {}, formatAmount = formatExcessCashAmountDefault) {
  const text = excessCashNoteLineText(payment?.excessCashNote, labels, formatAmount);
  return text ? ` · ${escapeExcessCashNoteHtml(text)}` : '';
}
