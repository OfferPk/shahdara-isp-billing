// Transaction underpayment warning (Plan 387): while the operator
// types a part-payment on the transaction entry form, the warning
// says in plain words what the typed amount pays, what the dues
// total, and what remains after this payment — so a customer who
// pays half leaves knowing they paid half, instead of believing
// they are fully paid.
//
// The warning only reads. It warns and blocks nothing, settles
// nothing, and changes no bill, payment, or customer record by
// itself: the caller supplies the dues total and the typed amount,
// and warning twice returns the same line with the records
// byte-identical. It shows only while the typed amount is a
// positive number strictly below the dues total: an amount that
// covers the dues in full, an amount over the dues, or no usable
// amount at all warns about nothing. The two neighbouring live
// lines — the settlement preview (which months the money settles)
// and the overpayment choice (what the extra over the dues should
// be) — are different surfaces and are left untouched: this module
// never settles, never chooses, and never records.
//
// The module never reads storage, the clock, the network, or the
// page. Inputs are never mutated. Money is integer cents throughout,
// PKR only, never converted.

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function formatAmountDefault(cents) {
  const rupees = Math.round(cents) / 100;
  return `PKR ${rupees.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// Integer cents, or null when the value is not a usable number. A
// missing value, an empty value, and a boolean are not numbers at
// all — they never read as zero dues or a zero amount, so they can
// never invent a warning out of thin air.
function finiteCents(value) {
  if (value === null || value === undefined || typeof value === 'boolean' || value === '') return null;
  const cents = Math.round(Number(value));
  return Number.isFinite(cents) ? cents : null;
}

function labelOr(labels, key, fallback) {
  const value = labels?.[key];
  return typeof value === 'string' && value ? value : fallback;
}

/**
 * The dues still unpaid after the typed amount, in integer cents —
 * the dues total minus the entered amount — or 0 when there is
 * nothing to warn about: the amount is not a positive number, the
 * dues are not a positive number, or the amount already covers the
 * dues in full (or more).
 */
export function underpaymentRemainingCents(duesCents, amountCents) {
  const warning = underpaymentWarning(duesCents, amountCents);
  return warning ? warning.remainingCents : 0;
}

/**
 * The underpayment as one record — { amountCents, duesCents,
 * remainingCents } — or null when there is nothing to warn about.
 * remainingCents is always the dues total minus the entered amount,
 * recomputed here, never trusted from a stored figure.
 */
export function underpaymentWarning(duesCents, amountCents) {
  const dues = finiteCents(duesCents);
  const amount = finiteCents(amountCents);
  if (dues === null || amount === null) return null;
  if (dues <= 0 || amount <= 0) return null;
  if (amount >= dues) return null;
  return { amountCents: amount, duesCents: dues, remainingCents: dues - amount };
}

/**
 * The warning in plain words, for reading aloud to the customer:
 * "Paid PKR 1,500 of PKR 3,000 dues — PKR 1,500 still due". The
 * remaining figure is always the dues minus the amount, recomputed
 * from the two figures themselves — a stored remaining figure on
 * the record is never trusted. Labels may be supplied for another
 * language; the figures stay PKR. Returns '' when there is nothing
 * to warn about.
 */
export function underpaymentWarningLineText(warning, labels = {}, formatAmount = formatAmountDefault) {
  if (!warning || typeof warning !== 'object') return '';
  const amount = finiteCents(warning.amountCents);
  const dues = finiteCents(warning.duesCents);
  if (amount === null || dues === null) return '';
  if (amount <= 0 || dues <= 0 || amount >= dues) return '';
  const remaining = dues - amount;
  const paid = labelOr(labels, 'paid', 'Paid');
  const of = labelOr(labels, 'of', 'of');
  const duesWord = labelOr(labels, 'dues', 'dues');
  const stillDue = labelOr(labels, 'stillDue', 'still due');
  return `${paid} ${formatAmount(amount)} ${of} ${formatAmount(dues)} ${duesWord} — ${formatAmount(remaining)} ${stillDue}`;
}

/**
 * The warning as escaped HTML for the entry form, or '' when there
 * is nothing to warn about. Every value is escaped, so a damaged
 * record can never inject markup into the form.
 */
export function underpaymentWarningMarkup(warning, labels = {}, formatAmount = formatAmountDefault) {
  const text = underpaymentWarningLineText(warning, labels, formatAmount);
  return text ? escapeHtml(text) : '';
}
