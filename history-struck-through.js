// History voided and corrected entries shown struck-through (Plan 421):
// one display rule for the customer history — a voided or corrected
// entry stays visible, struck through, with its reversal or its
// correction beside it. It displays only and it voids or corrects
// nothing: it reads the entries the full history list already
// composes plus the payment records already on the customer record,
// and it writes to no store.
//
// What already exists, and what was missing: the full history list
// already lists a voided payment (with a small VOID suffix, moving
// nothing) and already shows a corrected payment at its corrected
// figure — but neither looks any different from an ordinary row, and
// neither carries its reversal or its correction beside it. A
// customer holding an old receipt therefore cannot find it in the
// history as voided or corrected; the row just looks like any other
// payment. This module is the missing display rule only.
//
// A voided entry is an entry the list itself marks voided. Its
// beside-line names the void reason the payment carries (or says no
// reason was recorded) and the void date, and when a negative entry
// links back to it as the entry it reverses, the line names that
// reversing entry by its receipt reference, with the link's reason,
// operator and date — the same words the reversal link already
// prints beside a transaction. A corrected entry is a payment whose
// own correction trail (the append-only audit the payment-correction
// path keeps on the payment) records an amount or date change: the
// beside-line names the original figure and the corrected figure,
// with the latest correction date. A bill correction (the separate
// bill mechanism with its own original, reversing entry and corrected
// bill) is not re-marked here: its corrected bill is a new bill,
// and its rows already appear as their own entries.
//
// The list this module renders is the ordinary list when nothing on
// it is voided or corrected: with no struck row, no operator note
// and no disputed flag it is byte-identical to the full history
// list; with a disputed flag and nothing struck it matches the
// disputed-flag view; with an operator note and nothing struck it
// matches the annotated list. Only a struck row differs — its own
// figures are struck through, and the beside-line (and any operator
// note) stays readable beside it. The running balance is never
// recomputed here: a voided entry already moves nothing and a
// corrected entry already carries its corrected figure, so the
// balances the list already shows stand as they are.
//
// Pure and import-free: no storage, no DOM, no network, no other
// module. Inputs are never mutated.

export const HISTORY_STRUCK_THROUGH_TYPES = Object.freeze([
  'charge',
  'payment',
  'advance',
  'credit',
  'refund',
  'adjustment',
]);

const HISTORY_STRUCK_THROUGH_TYPE_LABELS = Object.freeze({
  charge: 'Charge',
  payment: 'Payment',
  advance: 'Advance',
  credit: 'Credit',
  refund: 'Refund',
  adjustment: 'Adjustment',
});

const HISTORY_STRUCK_THROUGH_PAYMENT_TYPES = Object.freeze([
  'payment',
  'advance',
  'refund',
  'adjustment',
]);

const HISTORY_STRUCK_THROUGH_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const HISTORY_STRUCK_THROUGH_LINK_REASON_MAX = 200;
const HISTORY_STRUCK_THROUGH_LINK_OPERATOR_MAX = 60;
const HISTORY_STRUCK_THROUGH_NOTE_TEXT_MAX = 300;
const HISTORY_STRUCK_THROUGH_NOTE_BY_MAX = 60;

function isLeapStruckYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function isStrictHistoryStruckThroughDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const lastDay = month === 2 && isLeapStruckYear(year) ? 29 : HISTORY_STRUCK_THROUGH_DAYS_IN_MONTH[month - 1];
  return day <= lastDay;
}

function cleanStruckKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cleanStruckText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function capStruckText(value, max) {
  return cleanStruckText(value).slice(0, max);
}

// A null, undefined, empty, or boolean figure is not a number,
// never zero — the same defensive rule the overpayment choice
// established, because Number(null) is 0 and Number(true) is 1.
function finiteStruckCents(value) {
  if (value === null || value === undefined || typeof value === 'boolean' || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount);
}

function rupeesToStruckCents(value) {
  if (value === null || value === undefined || typeof value === 'boolean' || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

// Amounts print with no decimals for whole rupees (PKR 1,500) and one
// decimal for a paisa remainder (PKR 1,500.5), the same shape the
// entry-screen formatters use.
export function formatHistoryStruckThroughAmount(cents) {
  if (cents === null || cents === undefined || typeof cents === 'boolean' || cents === '') return 'PKR 0';
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return 'PKR 0';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

export function historyStruckThroughRunningNote(balanceCents) {
  if (balanceCents === null || balanceCents === undefined || typeof balanceCents === 'boolean' || balanceCents === '') return 'Settled';
  const balance = Number(balanceCents);
  if (!Number.isFinite(balance) || balance === 0) return 'Settled';
  if (balance > 0) return `Still owed ${formatHistoryStruckThroughAmount(balance)}`;
  return `Credit ${formatHistoryStruckThroughAmount(-balance)}`;
}

function escapeStruckHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The payment record behind one history entry, found by the entry's
// own reference — or null when no payment on this device carries
// that reference. Charge and credit rows carry a bill or credit
// reference, never a payment one, so they never match here.
function struckPaymentOf(entry, payments) {
  if (!entry || typeof entry !== 'object') return null;
  const ref = cleanStruckText(entry.ref);
  if (ref === '') return null;
  const list = Array.isArray(payments) ? payments : [];
  return list.find((payment) => payment
    && typeof payment === 'object'
    && cleanStruckText(payment.id) === ref) ?? null;
}

// The receipt reference printed for a payment: the payment's real
// stored receipt number, else its permanent receipt number. Never
// derived or fabricated — a payment carrying neither yields ''.
export function struckReceiptRef(payment) {
  return cleanStruckText(payment?.receiptNumber ?? payment?.permanentReceiptNumber ?? '');
}

// One reversal link, restated import-free in the same words the
// link already uses: a link needs the original payment it reverses
// and a strict date — the date supplied on the link, else the
// fallback date (the reversing payment's own day). A link with no
// original, or with a date that is neither strict on the link nor
// strict as a fallback, is refused and reads as null, never silently
// kept. The reason caps at 200 chars and the operator at 60.
function normalizeStruckReversalLink(raw, fallbackDate) {
  if (!raw || typeof raw !== 'object') return null;
  const reversesPaymentId = cleanStruckText(raw.reversesPaymentId);
  if (reversesPaymentId === '') return null;
  const reason = capStruckText(raw.reason, HISTORY_STRUCK_THROUGH_LINK_REASON_MAX);
  const operator = capStruckText(raw.operator, HISTORY_STRUCK_THROUGH_LINK_OPERATOR_MAX);
  const rawDate = cleanStruckText(raw.date);
  const date = isStrictHistoryStruckThroughDate(rawDate)
    ? rawDate
    : (isStrictHistoryStruckThroughDate(fallbackDate) ? String(fallbackDate) : '');
  if (date === '') return null;
  return {
    reversesPaymentId,
    ...(reason ? { reason } : {}),
    ...(operator ? { operator } : {}),
    date,
  };
}

// The reversal link on a payment record, or null when the payment
// carries none. A genuine reversing entry is a negative entry: a
// payment whose amount is not below zero reads as no link at all,
// so a damaged or hand-edited record can never claim a reversal it
// did not make. A link that points at the payment itself is refused
// the same way — a payment never reverses itself.
export function struckReversalLinkOf(payment) {
  if (!payment || typeof payment !== 'object') return null;
  const amount = Number(payment.amount);
  if (!Number.isFinite(amount) || amount >= 0) return null;
  const link = normalizeStruckReversalLink(payment.reversalLink, payment.date);
  if (!link) return null;
  if (link.reversesPaymentId === payment.id) return null;
  return link;
}

// The reversing entry for an original payment, found by scanning a
// flat list of payments for the entry whose link names the original
// — or null when no entry reverses it. The original itself is never
// touched by the search.
export function struckReversalEntryOf(originalPayment, payments) {
  if (!originalPayment || typeof originalPayment !== 'object' || !originalPayment.id) return null;
  const list = Array.isArray(payments) ? payments : [];
  return list.find((entry) => entry
    && typeof entry === 'object'
    && entry.id !== originalPayment.id
    && struckReversalLinkOf(entry)?.reversesPaymentId === originalPayment.id) ?? null;
}

// The link in plain words. "Reversed by RCPT-… · {reason} — by
// {operator}, {date}"; when the counterpart's receipt reference is
// unknown the head falls back to "Reversed" rather than printing a
// blank reference. Empty when the link has nothing to say.
export function struckReversalLineText(link, counterpartRef = '') {
  const normalized = normalizeStruckReversalLink(link, link?.date);
  if (!normalized) return '';
  const ref = cleanStruckText(counterpartRef);
  let text = ref ? `Reversed by ${ref}` : 'Reversed';
  if (normalized.reason) text += ` · ${normalized.reason}`;
  const byDate = [normalized.operator ? `by ${normalized.operator}` : '', normalized.date]
    .filter(Boolean).join(', ');
  if (byDate) text += ` — ${byDate}`;
  return text;
}

// The correction beside a corrected payment, from the append-only
// audit trail the payment-correction path keeps on the payment:
// the original figure is the first entry's previous amount and the
// corrected figure is the latest entry's new amount, with the latest
// correction date. A date-only correction names its dates instead.
// Null when the payment carries no usable correction trail.
export function struckCorrectionTextOf(payment) {
  if (!payment || typeof payment !== 'object') return null;
  const trail = Array.isArray(payment.correctionHistory)
    ? payment.correctionHistory.filter((item) => item && typeof item === 'object')
    : [];
  if (trail.length === 0) return null;
  const first = trail[0];
  const latest = trail[trail.length - 1];
  const originalCents = rupeesToStruckCents(first.previousAmount);
  const correctedCents = rupeesToStruckCents(latest.newAmount);
  const date = typeof latest.correctedAt === 'string' && isStrictHistoryStruckThroughDate(latest.correctedAt.slice(0, 10))
    ? latest.correctedAt.slice(0, 10)
    : '';
  if (originalCents !== null && correctedCents !== null && originalCents !== correctedCents) {
    return `Corrected from ${formatHistoryStruckThroughAmount(originalCents)} to ${formatHistoryStruckThroughAmount(correctedCents)}${date === '' ? '' : ` · ${date}`}`;
  }
  const previousDate = cleanStruckText(first.previousDate);
  const newDate = cleanStruckText(latest.newDate);
  if (previousDate !== '' && newDate !== '' && previousDate !== newDate
    && isStrictHistoryStruckThroughDate(previousDate) && isStrictHistoryStruckThroughDate(newDate)) {
    return `Corrected date from ${previousDate} to ${newDate}${date === '' ? '' : ` · ${date}`}`;
  }
  return `Corrected${date === '' ? '' : ` · ${date}`}`;
}

// The struck-through display for one history entry, or null when
// the entry is neither voided nor corrected. A voided entry wins
// over a corrected one: a void can never carry a correction, so a
// record claiming both is read as voided. Only payment-derived rows
// can be corrected — a charge row carries a bill reference, never a
// payment correction trail. The returned text is unescaped: callers
// that put it in HTML must escape it.
export function historyStruckThroughOf(entry, payments) {
  if (!entry || typeof entry !== 'object') return null;
  if (entry.voided === true) {
    const payment = struckPaymentOf(entry, payments);
    const reason = payment && typeof payment.voidReason === 'string' && payment.voidReason.trim() !== ''
      ? payment.voidReason.trim()
      : 'No reason recorded';
    let text = `Voided: ${reason}`;
    const voidDate = payment && typeof payment.voidedAt === 'string'
      && isStrictHistoryStruckThroughDate(payment.voidedAt.slice(0, 10))
      ? payment.voidedAt.slice(0, 10)
      : '';
    if (voidDate !== '') text += ` · ${voidDate}`;
    if (payment) {
      const reversing = struckReversalEntryOf(payment, payments);
      if (reversing) {
        const line = struckReversalLineText(struckReversalLinkOf(reversing), struckReceiptRef(reversing));
        if (line !== '') text += ` · ${line}`;
      }
    }
    return { kind: 'voided', text };
  }
  const type = cleanStruckKey(entry.type);
  if (!HISTORY_STRUCK_THROUGH_PAYMENT_TYPES.includes(type)) return null;
  const payment = struckPaymentOf(entry, payments);
  if (!payment) return null;
  const correction = struckCorrectionTextOf(payment);
  if (correction === null) return null;
  return { kind: 'corrected', text: correction };
}

export function historyShownHasStruckThrough(entries, payments) {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => historyStruckThroughOf(entry, payments) !== null);
}

// The operator note attached to one entry, restated import-free in
// the same words the entry annotation uses: the note is keyed by
// the entry's type and reference for this customer, its text caps
// at 300 chars, its writer at 60, and its date must be a strict
// calendar date. A second note on the same entry replaces the first.
function struckAnnotationKey(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const type = cleanStruckKey(entry.type);
  if (!HISTORY_STRUCK_THROUGH_TYPES.includes(type)) return '';
  const ref = cleanStruckText(entry.ref);
  if (ref === '') return '';
  return `${type}:${ref}`;
}

function struckNormalizeAnnotations(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const usedIds = new Set();
  const out = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const customerId = cleanStruckKey(raw.customerId);
    if (customerId === '') continue;
    const type = cleanStruckKey(raw.entryType);
    if (!HISTORY_STRUCK_THROUGH_TYPES.includes(type)) continue;
    const ref = cleanStruckText(raw.entryRef);
    if (ref === '') continue;
    const entryKey = `${type}:${ref}`;
    const key = `${customerId}|${entryKey}`;
    if (seen.has(key)) continue;
    const text = capStruckText(raw.text, HISTORY_STRUCK_THROUGH_NOTE_TEXT_MAX);
    if (text === '') continue;
    if (!isStrictHistoryStruckThroughDate(raw.date)) continue;
    seen.add(key);
    let id = cleanStruckText(raw.id);
    if (id === '' || usedIds.has(id)) {
      let n = 1;
      while (usedIds.has(`hea-${n}`)) n += 1;
      id = `hea-${n}`;
    }
    usedIds.add(id);
    out.push({
      id,
      customerId,
      entryKey,
      entryType: type,
      entryRef: ref,
      text,
      date: raw.date,
      by: capStruckText(raw.by, HISTORY_STRUCK_THROUGH_NOTE_BY_MAX),
    });
  }
  return out;
}

function struckAnnotationForEntry(annotations, customerId, entry) {
  const customer = cleanStruckKey(customerId);
  if (customer === '') return null;
  const key = struckAnnotationKey(entry);
  if (key === '') return null;
  const list = struckNormalizeAnnotations(annotations);
  return list.find((item) => item.customerId === customer && item.entryKey === key) ?? null;
}

function struckAnnotationLineText(annotation) {
  if (!annotation || typeof annotation !== 'object') return '';
  const text = capStruckText(annotation.text, HISTORY_STRUCK_THROUGH_NOTE_TEXT_MAX);
  if (text === '') return '';
  if (!isStrictHistoryStruckThroughDate(annotation.date)) return '';
  const by = capStruckText(annotation.by, HISTORY_STRUCK_THROUGH_NOTE_BY_MAX);
  return `Note: ${text} · ${annotation.date}${by === '' ? '' : ` · by ${by}`}`;
}

function struckDisputedFlagText(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const ref = entry.disputedCaseRef;
  if (typeof ref !== 'string' || ref === '') return '';
  return ` · Disputed · ${ref}`;
}

// The history list with its voided and corrected entries struck
// through: the same rows the full history renders — label, amount,
// date, method, note and running balance, with the disputed flag
// kept on every flagged row and the operator note kept on every
// annotated row — and a struck row's own figures wrapped in <s>,
// with its reversal or correction beside it in plain words. With
// no struck row the output is the ordinary list, unchanged: with no
// operator note and no disputed flag it matches the full history
// list; with a disputed flag and nothing struck it matches the
// disputed-flag view; with an operator note and nothing struck it
// matches the annotated list.
export function historyStruckThroughListHtml(entries, payments, annotations, customerId) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) return '';
  const rows = list.map((entry) => {
    if (!entry || typeof entry !== 'object') return '';
    const label = HISTORY_STRUCK_THROUGH_TYPE_LABELS[cleanStruckKey(entry.type)] || 'Payment';
    const date = entry.date ? entry.date : 'date not recorded';
    const amount = formatHistoryStruckThroughAmount(entry.amountCents);
    const note = historyStruckThroughRunningNote(entry.runningBalanceCents);
    const details = [date, entry.method, entry.note].filter(Boolean).join(' · ');
    const voided = entry.voided ? ' · VOID' : '';
    const flagText = struckDisputedFlagText(entry);
    const annotation = struckAnnotationForEntry(annotations, customerId, entry);
    const annotationSpan = annotation === null
      ? ''
      : `<span class="payment-meta hea-annotation">${escapeStruckHtml(struckAnnotationLineText(annotation))} <button class="secondary-button btn-sm" type="button" data-hea-remove="${escapeStruckHtml(annotation.id)}">Remove</button></span>`;
    const struck = historyStruckThroughOf(entry, payments);
    if (struck === null) {
      return `<li class="payment-row"><span class="payment-main"><span class="payment-amount">${escapeStruckHtml(label)} · ${escapeStruckHtml(amount)}${escapeStruckHtml(voided)}</span><span class="payment-meta">${escapeStruckHtml(details)} · ${escapeStruckHtml(note)}${escapeStruckHtml(flagText)}</span>${annotationSpan}</span></li>`;
    }
    return `<li class="payment-row"><span class="payment-main"><s><span class="payment-amount">${escapeStruckHtml(label)} · ${escapeStruckHtml(amount)}${escapeStruckHtml(voided)}</span><span class="payment-meta">${escapeStruckHtml(details)} · ${escapeStruckHtml(note)}${escapeStruckHtml(flagText)}</span></s><span class="payment-meta hst-struck-note">${escapeStruckHtml(struck.text)}</span>${annotationSpan}</span></li>`;
  });
  return `<ul class="payment-list">${rows.join('')}</ul>`;
}
