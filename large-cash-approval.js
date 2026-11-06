// Transaction owner approval for large cash amounts at entry (Plan
// 397): a very large cash payment can be recorded by any operator
// with no second pair of eyes, so a large figure typed wrong — or
// taken wrong — is only found at settlement. One approval step at
// entry fixes that: a cash payment above an operator-set threshold
// cannot post without the owner's initials or name recorded with
// the transaction, and the approval appears on the transaction
// itself. It approves only — it never changes any bill, payment
// total, customer record, or approval-limits record (the discount
// and waiver limits live in their own record, untouched, and this
// step neither reads nor rewrites them).
//
// The approval rides the payment record itself (the same field the
// payment validator keeps), so it needs no store of its own: the
// record is the approval. The threshold rides along for the check
// only and is never stored — the entry form passes it, the
// validator enforces it, and a caller that passes no threshold
// keeps its historical behaviour. A payment below the threshold
// stores nothing extra, and a payment that is not cash stores
// nothing either.
//
// Pure and import-free: no storage, no DOM, no network, no other
// module. Inputs are never mutated. Cash here means any method
// that is not a digital wallet or bank method — the same rule the
// payment validator applies when it tells cash from digital.

/** The standing default threshold: PKR 10,000, in integer cents. */
export const LARGE_CASH_DEFAULT_THRESHOLD_CENTS = 1000000;

/** The approver's initials or name are capped at 100 characters. */
export const LARGE_CASH_APPROVER_MAX_LENGTH = 100;

function finiteCents(value) {
  // Number(null), Number('') and Number(false) are all 0 — none of
  // those is an amount or threshold figure, so they count as "not a
  // number" here instead of zero.
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const cents = Number(value);
  return Number.isFinite(cents) ? Math.round(cents) : null;
}

/**
 * The threshold in integer cents, or the standing default when the
 * value is not a positive finite number — an empty, zero, negative
 * or unreadable threshold never silently turns the step off.
 */
export function normalizeLargeCashThresholdCents(value) {
  const cents = finiteCents(value);
  return cents !== null && cents > 0 ? cents : LARGE_CASH_DEFAULT_THRESHOLD_CENTS;
}

/**
 * True only for a cash payment whose amount strictly exceeds the
 * threshold. At the threshold exactly, or below it, no approval is
 * needed; a non-cash payment never needs one however large it is.
 * `isCash` is the caller's cash-or-digital answer, so this module
 * never has to know the method list.
 */
export function requiresLargeCashApproval(isCash, amountCents, thresholdCents) {
  if (isCash !== true) return false;
  const amount = finiteCents(amountCents);
  if (amount === null) return false;
  return amount > normalizeLargeCashThresholdCents(thresholdCents);
}

function cleanApproverName(raw) {
  const text = typeof raw === 'string' ? raw : raw?.by ?? '';
  return String(text).replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, LARGE_CASH_APPROVER_MAX_LENGTH);
}

/**
 * Normalize one large-cash approval. With the threshold known (the
 * entry form passes it), the approval is kept only when the payment
 * actually needs one — cash above the threshold — and the approver's
 * name is present; an approval on a payment that needs none stores
 * nothing, and a missing name stores nothing too. Without the
 * threshold (a correction carrying the approval the payment already
 * has), a record that is already well-formed is kept as-is, so a
 * correction never silently strips it; a bare name with no
 * threshold to check against stores nothing.
 */
export function normalizeLargeCashApproval(raw, { isCash, amountCents, thresholdCents } = {}) {
  const by = cleanApproverName(raw);
  if (!by) return null;
  if (thresholdCents === undefined || thresholdCents === null) {
    return { by };
  }
  if (!requiresLargeCashApproval(isCash, amountCents, thresholdCents)) return null;
  return { by };
}

/**
 * Defensive reader: the approval a payment carries, or null.
 * Only a well-formed record counts — a non-empty approver name —
 * so a damaged record reads as no approval.
 */
export function largeCashApprovalOf(payment) {
  const raw = payment?.largeCashApproval;
  if (!raw || typeof raw !== 'object') return null;
  const by = cleanApproverName(raw);
  return by ? { by } : null;
}

/**
 * The approval in plain words: "Approved by AB", or '' when the
 * payment carries no approval. Unescaped — callers must escape
 * before inserting into HTML.
 */
export function largeCashApprovalLineText(approval) {
  const normalized = largeCashApprovalOf({ largeCashApproval: approval });
  if (!normalized) return '';
  return `Approved by ${normalized.by}`;
}

function escapeLargeCashApprovalHtml(value) {
  return String(value ?? '').replace(/[&<>\"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * The approval as it appears beside a transaction: a ' · …' suffix
 * for the payment-meta line, or '' when the payment carries no
 * approval, so a transaction without one shows nothing extra. The
 * approver's name is always escaped.
 */
export function largeCashApprovalMarkup(payment) {
  const text = largeCashApprovalLineText(payment?.largeCashApproval);
  return text ? ` · ${escapeLargeCashApprovalHtml(text)}` : '';
}
