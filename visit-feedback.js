// Plan 162 (Plan 101-202) — Customer Feedback After a Visit.
//
// After a visit, nobody asks the customer whether the visit actually
// helped, so recurring irritation is only discovered when the
// customer leaves. This module is the RECORD for that answer: one
// feedback record per visit, collected by the operator after the
// visit, with a simple satisfied / partly satisfied / not satisfied
// choice, one short comment in the customer's own words, and a date.
//
// What this module is NOT, stated plainly:
//   - It is not a second copy of Plan 49's satisfaction note. Plan 49
//     records a rating per resolved TICKET (satisfied / neutral /
//     unhappy) with a monthly view by mohalla and category, and it
//     is neither read nor written here. This module records
//     feedback per VISIT, linked by visit id only: it never reads
//     any visit record, ticket, bill, payment, or customer status,
//     and it never changes one. A visit id here is a label the
//     operator types, not a lookup into another record.
//   - It is not a score. Counts are simple totals only — how many
//     satisfied, how many partly satisfied, how many not satisfied
//     — never a blended score, average, or percentage rating.
//   - It is not collected during billing or collection. The record
//     is made by the operator after the visit; nothing in this
//     module touches billing or collection at all.
//   - It is not proof that a visit really helped. The record says
//     what the operator recorded; the module verifies format and
//     ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the
//     network, and never touches another record type.
//   - A record with no visit id, no customer, no date, or no
//     rating from the fixed three is refused outright, as is any
//     impossible date. Unknown fields are dropped, so a record can
//     never grow a visit-outcome, bill, payment, or status field.
//   - One feedback record per visit: a second record for the same
//     visit id is refused outright. A duplicate id is never
//     rewritten: an identical re-save leaves the list unchanged,
//     and a re-save with different figures is refused outright.
//     There is no edit function; the only later changes are
//     removal of the record itself, and marking a record reviewed.
//   - A not-satisfied record stays visible on the customer's
//     record and on the unreviewed list until the operator marks
//     it reviewed; marking reviewed only flips that flag and
//     changes nothing else.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const VISIT_FEEDBACK_RATINGS = ['satisfied', 'partly-satisfied', 'not-satisfied'];

export const VISIT_FEEDBACK_RATING_LABELS = {
  satisfied: 'Satisfied',
  'partly-satisfied': 'Partly satisfied',
  'not-satisfied': 'Not satisfied',
};

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
function strictDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day > limit) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Rating from the fixed three only; space/underscore spellings fold to hyphens. */
function normalizeRating(value) {
  if (typeof value !== 'string') return null;
  const folded = value.trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (folded === 'partly') return 'partly-satisfied';
  if (folded === 'not') return 'not-satisfied';
  return VISIT_FEEDBACK_RATINGS.includes(folded) ? folded : null;
}

/** One feedback record, or null when half-formed. Never mutates its input. */
export function normalizeVisitFeedback(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const id = text(entry.id);
  const visitId = text(entry.visitId);
  const customer = text(entry.customer);
  const date = strictDate(entry.date);
  const rating = normalizeRating(entry.rating);
  if (!id || !visitId || !customer || !date || !rating) return null;
  return {
    id,
    visitId,
    customer,
    date,
    rating,
    comment: text(entry.comment),
    reviewed: entry.reviewed === true,
  };
}

export function normalizeVisitFeedbackList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seenIds = new Set();
  const seenVisits = new Set();
  for (const raw of list) {
    const record = normalizeVisitFeedback(raw);
    if (!record) continue;
    if (seenIds.has(record.id) || seenVisits.has(record.visitId)) continue;
    seenIds.add(record.id);
    seenVisits.add(record.visitId);
    out.push(record);
  }
  return out;
}

export function findVisitFeedback(list, id) {
  const clean = normalizeVisitFeedbackList(list);
  return clean.find((record) => record.id === text(id)) || null;
}

/**
 * Add a feedback record. An identical re-save leaves the list
 * unchanged; a re-save with different figures, or a second record
 * for the same visit id, is refused with the list unchanged.
 */
export function upsertVisitFeedback(list, raw) {
  const clean = normalizeVisitFeedbackList(list);
  const record = normalizeVisitFeedback(raw);
  if (!record) return clean;
  // An identical re-save leaves the list unchanged, and so does a
  // re-save with different figures: a duplicate id is never rewritten.
  if (clean.some((item) => item.id === record.id)) return clean;
  if (clean.some((item) => item.visitId === record.visitId)) return clean;
  return [...clean, record];
}

export function removeVisitFeedback(list, id) {
  const clean = normalizeVisitFeedbackList(list);
  const wanted = text(id);
  return clean.filter((record) => record.id !== wanted);
}

/** Mark one record reviewed; changes nothing else, and never invents a record. */
export function markVisitFeedbackReviewed(list, id) {
  const clean = normalizeVisitFeedbackList(list);
  const wanted = text(id);
  let changed = false;
  const out = clean.map((record) => {
    if (record.id === wanted && !record.reviewed) {
      changed = true;
      return { ...record, reviewed: true };
    }
    return record;
  });
  return changed ? out : clean;
}

function byDateDescThenId(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Feedback for one customer (case-insensitive), newest first. */
export function feedbackForCustomer(list, customer) {
  const clean = normalizeVisitFeedbackList(list);
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return clean
    .filter((record) => record.customer.toLowerCase() === wanted)
    .sort(byDateDescThenId);
}

/** Feedback for one visit id, newest first. */
export function feedbackForVisit(list, visitId) {
  const clean = normalizeVisitFeedbackList(list);
  const wanted = text(visitId);
  if (!wanted) return [];
  return clean
    .filter((record) => record.visitId === wanted)
    .sort(byDateDescThenId);
}

/** Not-satisfied records not yet marked reviewed, newest first. */
export function unreviewedNotSatisfied(list) {
  const clean = normalizeVisitFeedbackList(list);
  return clean
    .filter((record) => record.rating === 'not-satisfied' && !record.reviewed)
    .sort(byDateDescThenId);
}

/** Customers with feedback, A-Z, first spelling kept. */
export function feedbackCustomers(list) {
  const clean = normalizeVisitFeedbackList(list);
  const seen = new Map();
  for (const record of clean) {
    const key = record.customer.toLowerCase();
    if (!seen.has(key)) seen.set(key, record.customer);
  }
  return [...seen.values()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Simple totals only — never a blended score, average, or percentage. */
export function feedbackCounts(list) {
  const clean = normalizeVisitFeedbackList(list);
  const counts = {
    total: clean.length,
    satisfied: 0,
    partlySatisfied: 0,
    notSatisfied: 0,
    unreviewedNotSatisfied: 0,
  };
  for (const record of clean) {
    if (record.rating === 'satisfied') counts.satisfied += 1;
    else if (record.rating === 'partly-satisfied') counts.partlySatisfied += 1;
    else if (record.rating === 'not-satisfied') {
      counts.notSatisfied += 1;
      if (!record.reviewed) counts.unreviewedNotSatisfied += 1;
    }
  }
  return counts;
}

export function feedbackSummaryText(list) {
  const counts = feedbackCounts(list);
  if (counts.total === 0) return 'No visit feedback recorded yet.';
  return (
    `${counts.total} feedback record${counts.total === 1 ? '' : 's'} — ` +
    `${counts.satisfied} satisfied, ${counts.partlySatisfied} partly satisfied, ` +
    `${counts.notSatisfied} not satisfied (${counts.unreviewedNotSatisfied} unreviewed).`
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function feedbackRowHtml(record) {
  const flag =
    record.rating === 'not-satisfied' && !record.reviewed
      ? ' ⚠ needs review'
      : record.rating === 'not-satisfied'
        ? ' (reviewed)'
        : '';
  return (
    `<tr><td>${escapeHtml(record.date)}</td>` +
    `<td>${escapeHtml(record.customer)}</td>` +
    `<td>${escapeHtml(record.visitId)}</td>` +
    `<td>${escapeHtml(VISIT_FEEDBACK_RATING_LABELS[record.rating])}${flag}</td>` +
    `<td>${escapeHtml(record.comment)}</td></tr>`
  );
}

function feedbackTableHtml(rows) {
  if (rows.length === 0) return '<p>No visit feedback to show.</p>';
  return (
    '<table><thead><tr><th>Date</th><th>Customer</th><th>Visit</th><th>Feedback</th><th>Comment</th></tr></thead>' +
    `<tbody>${rows.map(feedbackRowHtml).join('')}</tbody></table>`
  );
}

export function feedbackAllHtml(list) {
  const clean = normalizeVisitFeedbackList(list);
  return feedbackTableHtml([...clean].sort(byDateDescThenId));
}

export function feedbackCustomerHtml(list, customer) {
  const rows = feedbackForCustomer(list, customer);
  if (rows.length === 0) return '<p>No visit feedback for this customer.</p>';
  return feedbackTableHtml(rows);
}

export function feedbackUnreviewedHtml(list) {
  const rows = unreviewedNotSatisfied(list);
  if (rows.length === 0) return '<p>No unreviewed not-satisfied feedback.</p>';
  return feedbackTableHtml(rows);
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function feedbackCsv(list) {
  const clean = normalizeVisitFeedbackList(list);
  const lines = ['id,visitId,customer,date,rating,comment,reviewed'];
  for (const record of clean) {
    lines.push(
      [
        record.id,
        record.visitId,
        record.customer,
        record.date,
        record.rating,
        record.comment,
        record.reviewed ? 'yes' : 'no',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n');
}

export function feedbackFilename() {
  return 'visit-feedback.csv';
}
