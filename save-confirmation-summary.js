// Plan 382 — Save confirmation summary before posting.
//
// A payment posts the moment Save is tapped, so a wrong customer, a
// wrong amount, or a wrong method is discovered only after it is
// already in the ledger. This module builds the one calm review
// summary the operator sees BEFORE the payment posts: customer name
// and mohalla, amount in digits and words, method, and which bill
// the payment settles — plus the second leg when the payment is
// split across two methods.
//
// This module confirms ONLY. It posts nothing, reserves nothing,
// and changes no bill, payment, or customer record by itself: it is
// a read-only view of the entry form's own figures, built by the
// caller from the values already on the form. The caller shows the
// summary, waits for an explicit confirm step, and only then runs
// the existing save flow; going back returns to the form with the
// entries intact, and cancelling posts nothing.
//
// What this module is NOT, stated plainly:
//   - It is not the post-save confirmation drafts: those are written
//     AFTER a payment is recorded, to tell the customer their money
//     arrived. This summary is shown BEFORE anything is recorded,
//     and it is never sent anywhere.
//   - It is not a service-change draft: it confirms no package, move,
//     or pause — only the payment about to be posted.
//   - It is not a bill preview: it prices nothing and estimates
//     nothing. Every figure comes from the entry form itself, so the
//     summary's figures match the form exactly on the same fixture.
//   - It never reads storage, the clock, or the network, never
//     imports another module, and never mutates an input. A month is
//     always caller-supplied and strictly YYYY-MM; anything else has
//     no summary at all.
//
// An advance payment settles no bill: its "Settles" line names the
// advance target month instead, so the operator sees the money is
// recorded as advance credit, not against the current bill.

export const SAVE_CONFIRMATION_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STRICT_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function cappedText(value, cap) {
  return String(value ?? '').trim().slice(0, cap);
}

function amountDigits(amount) {
  return `PKR ${Number(amount).toLocaleString('en-PK')}`;
}

/**
 * The bill-month label for a strict YYYY-MM month: "November 2026".
 * Anything that is not a strict YYYY-MM month has no label at all.
 */
export function saveConfirmationMonthLabel(month) {
  if (typeof month !== 'string' || !STRICT_MONTH.test(month)) return '';
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7)) - 1;
  return `${SAVE_CONFIRMATION_MONTH_NAMES[index]} ${year}`;
}

function normalizeLeg(leg) {
  if (!leg || typeof leg !== 'object') return null;
  const amount = Number(leg.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const method = cappedText(leg.method, 60);
  if (method === '') return null;
  return {
    amount,
    amountWords: cappedText(leg.amountWords, 400),
    method,
  };
}

/**
 * The normalized summary for one about-to-be-posted payment, or null
 * when the entry has nothing worth confirming (no customer, no
 * positive amount, no method, or no strict bill month — an advance
 * needs a strict advance target month instead). Normalization trims
 * and caps the free text, folds the month into its display label,
 * and keeps the caller's amount-in-words exactly as given.
 */
export function normalizeSaveConfirmationSummary(input) {
  if (!input || typeof input !== 'object') return null;
  const customerName = cappedText(input.customerName, 100);
  if (customerName === '') return null;
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const method = cappedText(input.method, 60);
  if (method === '') return null;
  const advance = input.advance === true;
  let billLabel = '';
  let advanceTargetMonth = '';
  if (advance) {
    advanceTargetMonth = typeof input.advanceTargetMonth === 'string'
      ? input.advanceTargetMonth
      : '';
    const label = saveConfirmationMonthLabel(advanceTargetMonth);
    if (label === '') return null;
    billLabel = `Advance credit for ${label}`;
  } else {
    const label = saveConfirmationMonthLabel(input.billMonth);
    if (label === '') return null;
    billLabel = `${label} bill`;
  }
  const legs = [];
  if (Array.isArray(input.legs)) {
    for (const leg of input.legs) {
      const normalized = normalizeLeg(leg);
      if (!normalized) return null;
      legs.push(normalized);
    }
  }
  return {
    customerId: String(input.customerId ?? ''),
    customerName,
    mohalla: cappedText(input.mohalla, 60) || 'Unassigned',
    amount,
    amountWords: cappedText(input.amountWords, 400),
    method,
    billMonth: advance ? '' : String(input.billMonth),
    billLabel,
    advance,
    advanceTargetMonth,
    legs,
  };
}

/**
 * The summary as display lines, in the order the operator reads
 * them: customer, mohalla, amount in digits, amount in words,
 * method, then which bill the payment settles. A split payment
 * adds one block per extra leg after the method line, so the
 * summary always shows every figure the save will record.
 */
export function saveConfirmationSummaryLines(summary) {
  if (!summary || typeof summary !== 'object') return [];
  const lines = [
    { label: 'Customer', value: summary.customerName },
    { label: 'Mohalla', value: summary.mohalla },
    { label: 'Amount', value: amountDigits(summary.amount) },
  ];
  if (summary.amountWords) {
    lines.push({ label: 'Amount in words', value: summary.amountWords });
  }
  lines.push({ label: 'Method', value: summary.method });
  for (let i = 0; i < (summary.legs || []).length; i += 1) {
    const leg = summary.legs[i];
    const legNo = i + 2;
    lines.push({ label: `Leg ${legNo} amount`, value: amountDigits(leg.amount) });
    if (leg.amountWords) {
      lines.push({ label: `Leg ${legNo} amount in words`, value: leg.amountWords });
    }
    lines.push({ label: `Leg ${legNo} method`, value: leg.method });
  }
  lines.push({ label: 'Settles', value: summary.billLabel });
  return lines;
}

/**
 * The summary as escaped HTML for the confirmation panel, or ''
 * when there is no summary to show. Every value is escaped, so a
 * name typed on the form can never break out of the panel.
 */
export function saveConfirmationSummaryHtml(summary) {
  const lines = saveConfirmationSummaryLines(summary);
  if (lines.length === 0) return '';
  const rows = lines.map((line) => (
    `<dt>${escapeHtml(line.label)}</dt><dd>${escapeHtml(line.value)}</dd>`
  )).join('');
  return `<dl class="scs-summary">${rows}</dl>`;
}

/**
 * The stable key for one summary: the operator's Confirm step arms
 * exactly this key, and the save flow posts only when the form's
 * current summary still carries the same key. Any edit after the
 * summary was shown — a changed amount, method, month, or customer
 * — produces a different key, so the summary is shown again with
 * the new figures instead of posting the old ones.
 */
export function saveConfirmationSummaryKey(summary) {
  if (!summary || typeof summary !== 'object') return '';
  return JSON.stringify(summary);
}
