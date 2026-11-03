// Plan 2 (Plan 1-100) — Field visit outcomes and next-action queue.
//
// RECORDING ONLY. This module records what happened on a field visit and
// derives the follow-up queue from those records. It changes no payment,
// Waada, or dispute rule, and it never creates a payment, a Waada
// promise, or a dispute case by itself:
//
//   * A 'paid' outcome is only a visit note. It counts as a real
//     payment only when a payment record exists for it — see
//     validatePaidVisit. A paid outcome recorded without payment
//     evidence is flagged, never silently treated as paid money.
//   * A 'promised' outcome is a visit note with a next-action date.
//     It does not create a Waada promise on its own; Waada promises
//     are still created only through the existing promise flow
//     (saveFieldRouteOutcome's promise sync in
//     nav-collection-rounds.js), which this module does not touch.
//   * A 'dispute' outcome is a visit note that the customer disputed
//     the bill. It does NOT create or resolve a dispute case —
//     dispute cases live in Plan 61's flow, and a dispute visit
//     entry carries disputeCaseCreated: false so no reader can
//     mistake the note for a case.
//
// Why a new module exists when the route sheet already records
// outcomes: the existing storage (nav-collection-rounds.js) covered
// paid, partial, promised, not_home and refused, but Plan 2's
// catalogue also needs 'dispute' and 'no_answer', and nothing
// anywhere built a next-action queue from the recorded visits.
// This module supplies exactly those two gaps: the full six-outcome
// catalogue (with aliases, so "not home" and "no answer" typed with
// spaces still land on one canonical outcome) and the queue.
//
// The module is import-free by design (like route-sequencing.js and
// field-day-flow.js), so the route sheet can use it without pulling
// in the app graph. It never mutates its inputs and never reads
// storage, dates from the clock, or any other module: the caller
// passes visits and, for overdue flags, today's date explicitly.

// Plan 2's outcome catalogue: every visit ends with exactly one of
// these. 'pending' (no outcome recorded yet) and 'partial' (an
// existing payment-split outcome from the route sheet) are NOT Plan 2
// outcomes: pending means "no visit outcome yet" and partial is
// handled by the payment flow, so neither ever enters the queue.
export const VISIT_OUTCOMES = Object.freeze([
  'paid',
  'promised',
  'not_home',
  'refused',
  'dispute',
  'no_answer',
]);

export const VISIT_OUTCOME_LABELS = Object.freeze({
  paid: 'Paid',
  promised: 'Promised',
  not_home: 'Not home',
  refused: 'Refused',
  dispute: 'Dispute',
  no_answer: 'No answer',
});

// Outcomes that automatically appear in the next-action queue:
// promised visits and every missed-visit outcome. Paid visits do
// not (the money is in), pending visits do not (nothing happened
// yet to follow up), and partial visits do not (they are followed
// through the payment flow, not the visit queue).
export const QUEUEABLE_VISIT_OUTCOMES = Object.freeze([
  'promised',
  'not_home',
  'refused',
  'dispute',
  'no_answer',
]);

const ALIASES = Object.freeze({
  'not home': 'not_home',
  'not-home': 'not_home',
  'nothome': 'not_home',
  'no answer': 'no_answer',
  'no-answer': 'no_answer',
  'noanswer': 'no_answer',
  'not answered': 'no_answer',
  'disputed': 'dispute',
  'promised to pay': 'promised',
});

function str(value) {
  return value == null ? '' : String(value);
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Canonicalises a raw outcome string to one of VISIT_OUTCOMES, or
// null when it is not a Plan 2 outcome. Null is deliberate: an
// unrecognised outcome must never be silently re-labelled as a
// real one, and a visit with no outcome stays "no outcome yet".
export function normalizeVisitOutcome(value) {
  const raw = str(value).trim().toLowerCase();
  if (!raw) return null;
  if (VISIT_OUTCOMES.includes(raw)) return raw;
  if (Object.prototype.hasOwnProperty.call(ALIASES, raw)) return ALIASES[raw];
  return null;
}

export function isPlan2Outcome(value) {
  return normalizeVisitOutcome(value) !== null;
}

export function isQueueableOutcome(value) {
  const outcome = normalizeVisitOutcome(value);
  return outcome !== null && QUEUEABLE_VISIT_OUTCOMES.includes(outcome);
}

// Derives the next-action date for one visit, in priority order:
//   1. an explicit nextActionDate the operator recorded;
//   2. for a promised visit, its promiseDate;
//   3. otherwise the day after the visit (a missed visit is
//      revisited next, not left dateless).
// Returns null only when no usable date exists at all (no visit
// date and no explicit date), so such an entry sorts last in the
// queue instead of being dropped or given an invented date.
export function deriveNextActionDate(outcome, details = {}) {
  const explicit = str(details.nextActionDate).trim();
  if (isValidDateString(explicit)) return explicit;
  const canonical = normalizeVisitOutcome(outcome);
  const promiseDate = str(details.promiseDate).trim();
  if (canonical === 'promised' && isValidDateString(promiseDate)) return promiseDate;
  const visitDate = str(details.visitDate).trim();
  if (isValidDateString(visitDate)) return addDays(visitDate, 1);
  return null;
}

// Normalises one raw visit record to the queue's shape, or null
// when it carries no Plan 2 outcome or no customer id. A null
// result means "this record cannot appear in the queue", never
// "invent an outcome for it".
export function normalizeVisitRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const outcome = normalizeVisitOutcome(record.outcome);
  if (outcome === null) return null;
  const customerId = str(record.customerId ?? record.id ?? '').trim();
  if (!customerId) return null;
  const visitDate = str(record.visitDate ?? record.date ?? '').trim();
  const entry = {
    customerId,
    customerName: str(record.customerName ?? record.name ?? '').trim(),
    mohalla: str(record.mohalla ?? record.area ?? record.sector ?? '').trim(),
    outcome,
    outcomeLabel: VISIT_OUTCOME_LABELS[outcome],
    note: str(record.note ?? record.visitNote ?? '').trim(),
    visitDate: isValidDateString(visitDate) ? visitDate : null,
    promiseDate: isValidDateString(str(record.promiseDate).trim())
      ? str(record.promiseDate).trim()
      : null,
    nextActionDate: deriveNextActionDate(outcome, {
      visitDate: isValidDateString(visitDate) ? visitDate : null,
      nextActionDate: record.nextActionDate,
      promiseDate: record.promiseDate,
    }),
    paymentRecorded: record.paymentRecorded === true
      || str(record.paymentId ?? '').trim() !== '',
    paymentId: str(record.paymentId ?? '').trim() || null,
  };
  // A dispute visit note is not a dispute case (see header).
  if (outcome === 'dispute') entry.disputeCaseCreated = false;
  return entry;
}

// A payment outcome still requires a real payment record, never an
// implied one. Returns null when the record is fine, or a plain
// error string when a paid/partial visit has no payment evidence.
// Non-payment outcomes always return null: this check is only
// about money, and it must not block follow-ups for missed visits.
export function validatePaidVisit(record) {
  if (!record || typeof record !== 'object') return 'No visit record to validate.';
  const outcome = normalizeVisitOutcome(record.outcome);
  if (outcome !== 'paid' && record.outcome !== 'partial') return null;
  const hasEvidence = record.paymentRecorded === true
    || str(record.paymentId ?? '').trim() !== '';
  if (hasEvidence) return null;
  return 'A paid visit requires a real payment record; a visit note alone is not a payment.';
}

// Builds the next-action queue from recorded visits: only
// promised and missed-visit outcomes, sorted by next-action date
// (earliest first, dateless entries last), then customer name
// A-Z, then customer id — fully deterministic. When `today` is
// supplied (YYYY-MM-DD), each entry also carries `overdue`:
// true when its next-action date is before today. When today is
// not supplied, overdue is false rather than guessed from the
// clock, because this module never reads the clock.
export function buildNextActionQueue(visits, options = {}) {
  const today = isValidDateString(str(options.today).trim())
    ? str(options.today).trim()
    : null;
  const list = (Array.isArray(visits) ? visits : [])
    .map(normalizeVisitRecord)
    .filter((entry) => entry !== null && QUEUEABLE_VISIT_OUTCOMES.includes(entry.outcome))
    .map((entry) => ({
      ...entry,
      overdue: today !== null && entry.nextActionDate !== null && entry.nextActionDate < today,
    }));
  list.sort((a, b) => {
    if (a.nextActionDate === null && b.nextActionDate !== null) return 1;
    if (a.nextActionDate !== null && b.nextActionDate === null) return -1;
    if (a.nextActionDate !== null && b.nextActionDate !== null && a.nextActionDate !== b.nextActionDate) {
      return a.nextActionDate < b.nextActionDate ? -1 : 1;
    }
    const nameA = a.customerName.toLowerCase();
    const nameB = b.customerName.toLowerCase();
    if (nameA !== nameB) return nameA < nameB ? -1 : 1;
    return a.customerId < b.customerId ? -1 : a.customerId > b.customerId ? 1 : 0;
  });
  return list;
}

// Counts for a queue built by buildNextActionQueue: total,
// overdue, and per-outcome counts. Counts are derived from the
// queue itself, so they can never drift from what is displayed.
export function queueSummary(queue) {
  const counts = {};
  for (const outcome of QUEUEABLE_VISIT_OUTCOMES) counts[outcome] = 0;
  let overdue = 0;
  for (const entry of Array.isArray(queue) ? queue : []) {
    if (Object.prototype.hasOwnProperty.call(counts, entry.outcome)) counts[entry.outcome] += 1;
    if (entry.overdue) overdue += 1;
  }
  return {
    total: Array.isArray(queue) ? queue.length : 0,
    overdue,
    byOutcome: counts,
  };
}
