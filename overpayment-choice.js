// Transaction overpayment choice (Plan 386): when the amount typed
// at entry exceeds the customer's dues, the operator is offered one
// explicit choice for the extra — keep it as an advance toward
// future bills, or hold it as a credit balance — and the choice is
// recorded with the transaction. It offers the choice only and it
// applies nothing automatically: choosing "advance" creates no
// advance record of its own and choosing "credit" touches no
// credit-balance record; the advance and credit-balance mechanisms
// (Plans 101 and 103) stay exactly as they are, and no bill,
// payment, or past total changes because a choice was recorded.
//
// The choice rides the payment itself (the same field the payment
// validator keeps), so it needs no store of its own: the record is
// the choice. A payment that does not exceed the dues records no
// choice — the validator is given the dues at entry time and keeps
// the choice only when the amount strictly exceeds them, and a
// choice offered on a payment that does not exceed the dues stores
// nothing. The extra amount is the amount over the dues, in integer
// cents, PKR only, never converted.
//
// Pure and import-free: no storage, no DOM, no network, no other
// module. Inputs are never mutated.

export const OVERPAYMENT_CHOICES = Object.freeze(['advance', 'credit']);

function foldOverpaymentChoice(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** True only for the two words the choice can ever be. */
export function isOverpaymentChoice(value) {
  return OVERPAYMENT_CHOICES.includes(foldOverpaymentChoice(value));
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
export function overpaymentExtraCents(duesCents, amountCents) {
  const dues = finiteCents(duesCents);
  const amount = finiteCents(amountCents);
  if (dues === null || amount === null) return 0;
  return Math.max(0, amount - dues);
}

/**
 * Defensive reader: the choice a payment carries, or null. Only a
 * well-formed record counts — a valid choice word and a positive
 * integer extra — so a damaged record reads as no choice.
 */
export function overpaymentChoiceOf(payment) {
  const raw = payment?.overpaymentChoice;
  if (!raw || typeof raw !== 'object') return null;
  const choice = foldOverpaymentChoice(raw.choice);
  if (!OVERPAYMENT_CHOICES.includes(choice)) return null;
  const extraCents = Number(raw.extraCents);
  if (!Number.isFinite(extraCents) || !Number.isInteger(extraCents) || extraCents <= 0) return null;
  return { choice, extraCents };
}

/**
 * Normalize one overpayment choice. With the dues known (the entry
 * form passes them), the choice is kept only when the amount
 * strictly exceeds the dues, and the recorded extra is the amount
 * over the dues — a choice on a payment that does not exceed the
 * dues stores nothing, and a missing or unknown choice stores
 * nothing too (the choice is offered, never invented). Without the
 * dues (a correction carrying the choice the payment already has),
 * a choice that is already a well-formed record is kept as-is, so
 * a correction never silently strips it; a bare word with no dues
 * to check against stores nothing.
 */
export function normalizeOverpaymentChoice(raw, duesCents, amountCents) {
  const dues = finiteCents(duesCents);
  if (dues !== null) {
    const extraCents = overpaymentExtraCents(dues, amountCents);
    if (extraCents <= 0) return null;
    const choice = foldOverpaymentChoice(raw && typeof raw === 'object' ? raw.choice : raw);
    if (!OVERPAYMENT_CHOICES.includes(choice)) return null;
    return { choice, extraCents };
  }
  return overpaymentChoiceOf({ overpaymentChoice: raw });
}

const OVERPAYMENT_CHOICE_LABELS_DEFAULT = {
  extra: 'Extra',
  advance: 'as advance',
  credit: 'held as credit',
};

function overpaymentChoiceLabels(labels = {}) {
  return {
    extra: String(labels.extra ?? OVERPAYMENT_CHOICE_LABELS_DEFAULT.extra),
    advance: String(labels.advance ?? OVERPAYMENT_CHOICE_LABELS_DEFAULT.advance),
    credit: String(labels.credit ?? OVERPAYMENT_CHOICE_LABELS_DEFAULT.credit),
  };
}

function formatOverpaymentAmountDefault(cents) {
  const rupees = cents / 100;
  return `PKR ${rupees.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * The choice in plain words: "Extra PKR 500 as advance" or
 * "Extra PKR 500 held as credit", or '' when the payment carries
 * no choice. Unescaped — callers must escape before inserting
 * into HTML.
 */
export function overpaymentChoiceLineText(choice, labels = {}, formatAmount = formatOverpaymentAmountDefault) {
  const normalized = overpaymentChoiceOf({ overpaymentChoice: choice });
  if (!normalized) return '';
  const merged = overpaymentChoiceLabels(labels);
  const how = normalized.choice === 'advance' ? merged.advance : merged.credit;
  return `${merged.extra} ${formatAmount(normalized.extraCents)} ${how}`;
}

function escapeOverpaymentChoiceHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * The choice as it appears beside a transaction: a ' · …' suffix
 * for the payment-meta line, or '' when the payment carries no
 * choice, so a transaction without one shows the customer only.
 * The choice words themselves are folded to two fixed values, and
 * the caller-supplied labels are always escaped.
 */
export function overpaymentChoiceMarkup(payment, labels = {}, formatAmount = formatOverpaymentAmountDefault) {
  const text = overpaymentChoiceLineText(payment?.overpaymentChoice, labels, formatAmount);
  return text ? ` · ${escapeOverpaymentChoiceHtml(text)}` : '';
}
