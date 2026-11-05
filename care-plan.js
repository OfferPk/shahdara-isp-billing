// Plan 265 (Plan 203-350) — Vulnerable-customer care plan.
//
// A vulnerable customer is noted for a visit, but there is no dated
// plan of agreed care actions, so each visit starts from scratch.
// This module adds only the missing piece: one care plan per
// vulnerable customer — the customer, the agreed actions, a review
// date, and a note, plus dated follow-up notes and a recorded
// review date when a review happens.
//
// What this module is NOT, stated plainly:
//   - It is not the visit note itself. The Plan 173 visit note
//     only flags vulnerability for a visit; it is neither read
//     nor rewritten here. This module holds the dated plan with
//     actions, and the caller supplies the customer name.
//   - It never changes any customer record, any bill, or any
//     payment. Recording a plan or reviewing one never changes
//     any of those, and this module holds no customer, bill, or
//     payment field beyond the customer name on the plan itself,
//     so there is nothing here that could rewrite one.
//   - A care plan is never edited, only annotated and reviewed.
//     There is no edit function: only record, annotate, review,
//     and remove. A dated follow-up never rewrites the customer,
//     the agreed actions, the review date, or the note, and a
//     review only records the review date and a dated note.
//   - Overdue reviews appear on one list sorted by review date,
//     so the oldest unreviewed plan is always first.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - A plan with no id, no customer, no agreed action, no
//     strict review date, or no note is refused outright.
//     Unknown fields are dropped, so a plan can never grow a
//     customer, bill, or payment field.
//   - A duplicate id is never rewritten, and a second plan for
//     the same customer is refused, so one vulnerable customer
//     has exactly one care plan at a time.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validCarePlanDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day <= limit;
}

function cleanActions(raw) {
  if (!Array.isArray(raw)) return null;
  const actions = raw.map(text).filter(Boolean);
  return actions.length ? actions : null;
}

function cleanFollowup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = text(raw.date);
  const note = text(raw.note);
  if (!validCarePlanDate(date) || !note) return null;
  return { date, note };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customer = text(raw.customer);
  const reviewDate = text(raw.reviewDate);
  const note = text(raw.note);
  if (!id || !customer || !note) return null;
  if (!validCarePlanDate(reviewDate)) return null;
  const actions = cleanActions(raw.actions);
  if (!actions) return null;
  const lastReviewedDate = text(raw.lastReviewedDate);
  if (lastReviewedDate && !validCarePlanDate(lastReviewedDate)) return null;
  const followups = Array.isArray(raw.followups)
    ? raw.followups.map(cleanFollowup).filter(Boolean)
    : [];
  return { id, customer, actions, reviewDate, note, lastReviewedDate, followups };
}

export function normalizeCarePlanList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenCustomers = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    const key = entry.customer.toLowerCase();
    if (seenCustomers.has(key)) continue;
    seenIds.add(entry.id);
    seenCustomers.add(key);
    out.push(entry);
  }
  return out;
}

export function recordCarePlan(list, raw) {
  const clean = normalizeCarePlanList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  if (clean.some((item) => item.customer.toLowerCase() === entry.customer.toLowerCase())) return clean;
  return [...clean, entry];
}

export function removeCarePlan(list, id) {
  const clean = normalizeCarePlanList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findCarePlan(list, id) {
  const clean = normalizeCarePlanList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addCarePlanNote(list, id, date, note) {
  const clean = normalizeCarePlanList(list);
  const wanted = text(id);
  const followup = cleanFollowup({ date, note });
  if (!wanted || !followup) return clean;
  let changed = false;
  const out = clean.map((item) => {
    if (item.id !== wanted) return item;
    changed = true;
    return { ...item, followups: [...item.followups, followup] };
  });
  return changed ? out : clean;
}

export function reviewCarePlan(list, id, date, note) {
  const clean = normalizeCarePlanList(list);
  const wanted = text(id);
  const followup = cleanFollowup({ date, note });
  if (!wanted || !followup) return clean;
  let changed = false;
  const out = clean.map((item) => {
    if (item.id !== wanted) return item;
    changed = true;
    return { ...item, lastReviewedDate: followup.date, followups: [...item.followups, followup] };
  });
  return changed ? out : clean;
}

function compareEntries(a, b) {
  if (a.reviewDate !== b.reviewDate) return a.reviewDate < b.reviewDate ? -1 : 1;
  if (a.customer.toLowerCase() !== b.customer.toLowerCase()) return a.customer.toLowerCase() < b.customer.toLowerCase() ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function carePlanSorted(list) {
  return normalizeCarePlanList(list).sort(compareEntries);
}

export function carePlansForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return carePlanSorted(list).filter((item) => item.customer.toLowerCase() === wanted);
}

export function overdueCarePlans(list, asOf) {
  if (!validCarePlanDate(asOf)) return [];
  return carePlanSorted(list).filter((item) => item.reviewDate < asOf);
}

export function carePlanCustomers(list) {
  const seen = new Set();
  const out = [];
  for (const item of carePlanSorted(list)) {
    const key = item.customer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.customer);
  }
  return out;
}

export function carePlanSummaryText(list) {
  const clean = normalizeCarePlanList(list);
  if (!clean.length) return 'No care plans recorded.';
  return `${clean.length} care plan${clean.length === 1 ? '' : 's'} for vulnerable customers.`;
}

export function carePlanText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No care plan recorded.';
  const actions = clean.actions.join('; ');
  const reviewed = clean.lastReviewedDate ? ` Last reviewed ${clean.lastReviewedDate}.` : '';
  const notes = clean.followups.length
    ? ` Follow-ups: ${clean.followups.map((f) => `${f.date}: ${f.note}`).join('; ')}`
    : '';
  return `${clean.customer} — review by ${clean.reviewDate}. Actions: ${actions.replace(/\.+$/, '')}. Note: ${clean.note.replace(/\.+$/, '')}.${reviewed}${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function carePlanHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No care plan recorded.</p>';
  return `<p>${escapeHtml(carePlanText(clean))}</p>`;
}

export function carePlanAllHtml(list) {
  const sorted = carePlanSorted(list);
  if (!sorted.length) return '<p>No care plans recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(carePlanText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function carePlanCsv(list) {
  const sorted = carePlanSorted(list);
  const header = ['id', 'customer', 'actions', 'review date', 'last reviewed', 'note', 'follow-ups'];
  const rows = sorted.map((item) => [
    item.id,
    item.customer,
    item.actions.join('; '),
    item.reviewDate,
    item.lastReviewedDate,
    item.note,
    item.followups.map((f) => `${f.date}: ${f.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function carePlanFilename() {
  return 'care-plans.csv';
}
