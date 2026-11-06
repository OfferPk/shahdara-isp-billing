// Transaction same-day correction note (Plan 383):
// one correction note on a transaction — what was wrong, what it
// should be, who recorded it, and the date — allowed only on the day
// the transaction was recorded and only as a note attached to the
// original. It corrects nothing by itself and it never rewrites the
// original entry: the original transaction stays visible and
// unchanged, and no bill, payment total, or past total changes
// because a note was recorded. A note dated after the transaction
// day is refused, never silently kept.
//
// The note rides the payment record itself (the same field the
// payment validator keeps), so it needs no store of its own: the
// record is the note. A transaction without one shows the customer
// only. This is a note, not an edit: the payment-correction path
// that rewrites a payment's figures is a different mechanism and
// is never opened or rewritten here.
//
// Pure and import-free: no storage, no DOM, no network, no other
// module. Inputs are never mutated.

export const SAME_DAY_CORRECTION_WRONG_MAX_LENGTH = 200;
export const SAME_DAY_CORRECTION_SHOULD_BE_MAX_LENGTH = 200;
export const SAME_DAY_CORRECTION_RECORDED_BY_MAX_LENGTH = 60;

const SAME_DAY_CORRECTION_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanSameDayCorrectionText(value) {
  return typeof value === 'string' ? value.replace(/[\r\n\u2028\u2029]+/g, ' ').trim() : '';
}

function isSameDayCorrectionLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isStrictSameDayCorrectionDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = SAME_DAY_CORRECTION_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isSameDayCorrectionLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

/**
 * The note is allowed only on the day the transaction was recorded:
 * the payment's own date must be a strict date and today must be
 * that same day. The caller supplies today — this module never reads
 * the clock, so a test can pin the rule with any two dates.
 */
export function sameDayCorrectionAllowed(payment, todayDate) {
  if (!payment || typeof payment !== 'object') return false;
  if (!isStrictSameDayCorrectionDate(payment.date)) return false;
  return isStrictSameDayCorrectionDate(todayDate) && todayDate === payment.date;
}

/**
 * Normalize one same-day correction note. A note with neither a
 * "wrong" nor a "should be" says nothing about what was wrong and
 * reads as null, so a transaction without one shows the customer
 * only. A note with no usable date, or with a date that is not the
 * payment's day (when the payment date is given), is refused and
 * reads as null — a note dated after the transaction day is never
 * silently kept. Over-long text is cut to its cap, never stored raw.
 */
export function normalizeSameDayCorrectionNote(raw, paymentDate) {
  if (!raw || typeof raw !== 'object') return null;
  const wrong = cleanSameDayCorrectionText(raw.wrong).slice(0, SAME_DAY_CORRECTION_WRONG_MAX_LENGTH);
  const shouldBe = cleanSameDayCorrectionText(raw.shouldBe).slice(0, SAME_DAY_CORRECTION_SHOULD_BE_MAX_LENGTH);
  const recordedBy = cleanSameDayCorrectionText(raw.recordedBy).slice(0, SAME_DAY_CORRECTION_RECORDED_BY_MAX_LENGTH);
  const date = cleanSameDayCorrectionText(raw.date);
  if (!wrong && !shouldBe) return null;
  if (!isStrictSameDayCorrectionDate(date)) return null;
  if (isStrictSameDayCorrectionDate(paymentDate) && date !== paymentDate) return null;
  return {
    ...(wrong ? { wrong } : {}),
    ...(shouldBe ? { shouldBe } : {}),
    ...(recordedBy ? { recordedBy } : {}),
    date,
  };
}

/**
 * The same-day correction note on a payment record, or null when the
 * payment carries none. Reads the same field the payment validator
 * keeps, so a note recorded with the payment is the note shown. A
 * damaged record whose note date is not the payment's day reads as
 * no note at all.
 */
export function sameDayCorrectionNoteOf(payment) {
  if (!payment || typeof payment !== 'object') return null;
  return normalizeSameDayCorrectionNote(payment.sameDayCorrection, payment.date);
}

const SAME_DAY_CORRECTION_DEFAULT_LABELS = {
  correction: 'Correction',
  shouldBe: 'should be',
  by: 'by',
};

/**
 * The note in plain words — "Correction {date}: {wrong}, should be
 * {should} — by {name}", each part shown only when given. Empty when
 * the note has nothing to say. The caller supplies labels (the
 * profile passes translated ones); the plain defaults are used
 * otherwise. The returned text is unescaped: callers that put it in
 * HTML must escape it, as the markup helper below does.
 */
export function sameDayCorrectionNoteLineText(note, labels = {}) {
  const normalized = normalizeSameDayCorrectionNote(note, note?.date);
  if (!normalized) return '';
  const correctionLabel = typeof labels.correction === 'string' && labels.correction ? labels.correction : SAME_DAY_CORRECTION_DEFAULT_LABELS.correction;
  const shouldBeLabel = typeof labels.shouldBe === 'string' && labels.shouldBe ? labels.shouldBe : SAME_DAY_CORRECTION_DEFAULT_LABELS.shouldBe;
  const byLabel = typeof labels.by === 'string' && labels.by ? labels.by : SAME_DAY_CORRECTION_DEFAULT_LABELS.by;
  const parts = [];
  if (normalized.wrong) parts.push(normalized.wrong);
  if (normalized.shouldBe) parts.push(`${shouldBeLabel} ${normalized.shouldBe}`);
  const byPart = normalized.recordedBy ? ` — ${byLabel} ${normalized.recordedBy}` : '';
  return `${correctionLabel} ${normalized.date}: ${parts.join(', ')}${byPart}`;
}

function escapeSameDayCorrectionHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * The note as it appears beside the original transaction: a ' · …'
 * suffix for the payment-meta line, or '' when the payment carries
 * no note, so a transaction without one shows the customer only.
 * Every user-entered word is always escaped.
 */
export function sameDayCorrectionNoteMarkup(payment, labels = {}) {
  const text = sameDayCorrectionNoteLineText(sameDayCorrectionNoteOf(payment), labels);
  return text ? ` · ${escapeSameDayCorrectionHtml(text)}` : '';
}
