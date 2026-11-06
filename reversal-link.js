// Transaction reversal link (Plan 384): one reversal link record —
// the original transaction, the reversing entry, the reason, the
// date, and the operator — where the reversing entry is a normal
// negative entry linked by reference. It reverses through the link
// only and it never deletes the original: the original transaction
// stays visible and unchanged, and no other bill, payment, or past
// total changes because a link was recorded.
//
// The link rides the reversing payment itself (the same field the
// payment validator keeps), so it needs no store of its own: the
// record is the link. The original shows its reversal and the
// reversal shows its original, resolved by scanning the customer's
// payments — the original itself is never written to. A transaction
// without a link either way shows the customer only.
//
// This is a link, not an edit and not a void: the payment-correction
// path that rewrites a payment's figures is a different mechanism,
// the quick undo that deletes a just-made payment is a different
// mechanism, the void audit that freezes a settled receipt is a
// different mechanism, and the bill-correction workflow (wrong bill
// to reversing entry plus corrected bill) and its approval trail are
// bill mechanisms, not this transaction link. None of those is
// opened or rewritten here.
//
// Pure and import-free: no storage, no DOM, no network, no other
// module. Inputs are never mutated.

export const REVERSAL_LINK_REASON_MAX_LENGTH = 200;
export const REVERSAL_LINK_OPERATOR_MAX_LENGTH = 60;

const REVERSAL_LINK_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanReversalLinkText(value) {
  return typeof value === 'string' ? value.replace(/[\r\n\u2028\u2029]+/g, ' ').trim() : '';
}

function isReversalLinkLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isStrictReversalLinkDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = REVERSAL_LINK_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isReversalLinkLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

/**
 * Normalize one reversal link record. A link needs its two
 * endpoints and a date: the original payment it reverses
 * (reversesPaymentId) and a strict date — the date supplied on the
 * link, else the fallback date (the reversing payment's own day).
 * A link with no original, or with a date that is neither strict
 * on the link nor strict as a fallback, is refused and reads as
 * null, never silently kept. The reason caps at 200 chars and the
 * operator at 60 (the same caps as the same-day correction note's
 * words and recorder); over-long text is cut, never stored raw.
 */
export function normalizeReversalLink(raw, fallbackDate) {
  if (!raw || typeof raw !== 'object') return null;
  const reversesPaymentId = String(raw.reversesPaymentId ?? '').trim();
  if (!reversesPaymentId) return null;
  const reason = cleanReversalLinkText(raw.reason).slice(0, REVERSAL_LINK_REASON_MAX_LENGTH);
  const operator = cleanReversalLinkText(raw.operator).slice(0, REVERSAL_LINK_OPERATOR_MAX_LENGTH);
  const rawDate = cleanReversalLinkText(raw.date);
  const date = isStrictReversalLinkDate(rawDate)
    ? rawDate
    : (isStrictReversalLinkDate(fallbackDate) ? String(fallbackDate) : '');
  if (!date) return null;
  return {
    reversesPaymentId,
    ...(reason ? { reason } : {}),
    ...(operator ? { operator } : {}),
    date,
  };
}

/**
 * The reversal link on a payment record, or null when the payment
 * carries none. Reads the same field the payment validator keeps.
 * A genuine reversing entry is a negative entry: a payment whose
 * amount is not below zero reads as no link at all, so a damaged
 * or hand-edited record can never claim a reversal it did not
 * make. A link that points at the payment itself is refused the
 * same way — a payment never reverses itself.
 */
export function reversalLinkOf(payment) {
  if (!payment || typeof payment !== 'object') return null;
  const amount = Number(payment.amount);
  if (!Number.isFinite(amount) || amount >= 0) return null;
  const link = normalizeReversalLink(payment.reversalLink, payment.date);
  if (!link) return null;
  if (link.reversesPaymentId === payment.id) return null;
  return link;
}

/** True when the payment is a genuine reversing entry (negative, linked). */
export function isReversalEntry(payment) {
  return reversalLinkOf(payment) !== null;
}

/**
 * The reversing entry for an original payment, found by scanning a
 * flat list of payments (one customer's bills, in any month) for
 * the entry whose link names the original — or null when no entry
 * reverses it. The original itself is never touched by the search.
 */
export function reversalEntryOf(originalPayment, payments) {
  if (!originalPayment || typeof originalPayment !== 'object' || !originalPayment.id) return null;
  const list = Array.isArray(payments) ? payments : [];
  return list.find((entry) => entry
    && typeof entry === 'object'
    && entry.id !== originalPayment.id
    && reversalLinkOf(entry)?.reversesPaymentId === originalPayment.id) ?? null;
}

/**
 * The original payment a reversing entry reverses, found by
 * scanning a flat list of payments for the id its link names — or
 * null when the original is not among them (a damaged record
 * still shows its link, just without the original's receipt ref).
 */
export function originalEntryOf(reversalPayment, payments) {
  const link = reversalLinkOf(reversalPayment);
  if (!link) return null;
  const list = Array.isArray(payments) ? payments : [];
  return list.find((entry) => entry
    && typeof entry === 'object'
    && entry.id === link.reversesPaymentId) ?? null;
}

/**
 * The receipt reference printed for a payment: the payment's real
 * stored receipt number, else its permanent receipt number (the
 * same read the quick undo toast uses). Never derived or
 * fabricated — a payment carrying neither yields ''.
 */
export function reversalReceiptRef(payment) {
  return String(payment?.receiptNumber ?? payment?.permanentReceiptNumber ?? '').trim();
}

const REVERSAL_LINK_DEFAULT_LABELS = {
  reversedBy: 'Reversed by {ref}',
  reversedByUnknown: 'Reversed',
  reverses: 'Reverses {ref}',
  reversesUnknown: 'Reverses an earlier payment',
  by: 'by',
};

function reversalLinkLabels(labels = {}) {
  const merged = { ...REVERSAL_LINK_DEFAULT_LABELS };
  for (const key of Object.keys(REVERSAL_LINK_DEFAULT_LABELS)) {
    if (typeof labels[key] === 'string' && labels[key]) merged[key] = labels[key];
  }
  return merged;
}

/**
 * The link in plain words. Direction 'reversedBy' names the
 * reversal on the original's row ("Reversed by RCPT-… · {reason}
 * — by {operator}, {date}"); direction 'reverses' names the
 * original on the reversal's row ("Reverses RCPT-… · {reason} —
 * by {operator}, {date}"). When the counterpart's receipt ref is
 * unknown the head falls back to "Reversed" / "Reverses an
 * earlier payment" rather than printing a blank ref. Empty when
 * the link has nothing to say. The caller supplies labels (the
 * profile passes translated ones); the plain defaults are used
 * otherwise. The returned text is unescaped: callers that put it
 * in HTML must escape it, as the markup helper below does.
 */
export function reversalLinkLineText(link, counterpartRef = '', direction = 'reversedBy', labels = {}) {
  const normalized = normalizeReversalLink(link, link?.date);
  if (!normalized) return '';
  const merged = reversalLinkLabels(labels);
  const ref = String(counterpartRef ?? '').trim();
  let head;
  if (direction === 'reverses') {
    head = ref ? merged.reverses.replace('{ref}', ref) : merged.reversesUnknown;
  } else {
    head = ref ? merged.reversedBy.replace('{ref}', ref) : merged.reversedByUnknown;
  }
  let text = head;
  if (normalized.reason) text += ` · ${normalized.reason}`;
  const byDate = [normalized.operator ? `${merged.by} ${normalized.operator}` : '', normalized.date]
    .filter(Boolean).join(', ');
  if (byDate) text += ` — ${byDate}`;
  return text;
}

function escapeReversalLinkHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * The link as it appears beside a transaction: a ' · …' suffix
 * for the payment-meta line, or '' when the payment has no link
 * either way, so a transaction without one shows the customer
 * only. A reversing entry shows its original; any other payment
 * shows the entry that reverses it, when one exists. Every
 * user-entered word is always escaped.
 */
export function reversalLinkMarkup(payment, payments = [], labels = {}) {
  if (!payment || typeof payment !== 'object') return '';
  if (isReversalEntry(payment)) {
    const link = reversalLinkOf(payment);
    const original = originalEntryOf(payment, payments);
    const text = reversalLinkLineText(link, original ? reversalReceiptRef(original) : '', 'reverses', labels);
    return text ? ` · ${escapeReversalLinkHtml(text)}` : '';
  }
  const entry = reversalEntryOf(payment, payments);
  if (!entry) return '';
  const text = reversalLinkLineText(reversalLinkOf(entry), reversalReceiptRef(entry), 'reversedBy', labels);
  return text ? ` · ${escapeReversalLinkHtml(text)}` : '';
}

/**
 * The two entries' amounts together, in cents — the original plus
 * its reversing entry — or null when the pair is not a genuine
 * reversal pair (the second entry's link does not name the first).
 * A pair that nets to zero sums to exactly 0.
 */
export function reversalPairNetCents(originalPayment, reversalPayment) {
  if (!originalPayment || typeof originalPayment !== 'object') return null;
  const link = reversalLinkOf(reversalPayment);
  if (!link || link.reversesPaymentId !== originalPayment.id) return null;
  const original = Number(originalPayment.amount);
  const reversal = Number(reversalPayment.amount);
  if (!Number.isFinite(original) || !Number.isFinite(reversal)) return null;
  return Math.round(original * 100) + Math.round(reversal * 100);
}

/** True when the original and its reversing entry together net to exactly zero. */
export function reversalNetsToZero(originalPayment, reversalPayment) {
  return reversalPairNetCents(originalPayment, reversalPayment) === 0;
}
