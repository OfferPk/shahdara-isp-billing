// Plan 264 (Plan 203-350) — Winback outcome log.
//
// Former customers are queued and contacted on a cadence, but the
// outcome of each winback attempt was not logged, so the same failed
// approach was repeated. This module adds only the missing piece:
// one outcome entry per winback attempt — the former-customer link,
// the attempt date, the outcome (returned / declined / no answer),
// and a note in plain words.
//
// What this module is NOT, stated plainly:
//   - It is not the winback queue from Plan 59. That queue lists
//     former customers to revisit and holds the re-contact drafts;
//     it is neither read nor rewritten here, and this module
//     imports nothing. An outcome entry only records what happened
//     when an attempt was made.
//   - It is not the follow-up cadence from Plan 171. That cadence
//     says when to follow up again; it is neither read nor
//     rewritten here. This module logs outcomes only and never
//     schedules a step.
//   - It never reactivates anyone and never changes any customer,
//     bill, or payment record. A "returned" outcome only takes the
//     customer off the open winback list shown here; reactivation
//     still goes through the normal onboarding flow, and this
//     module holds no customer status, bill, or payment field, so
//     there is nothing here that could rewrite one.
//   - One entry per attempt: a former customer may have several
//     attempts, each its own entry, shown in date order with the
//     latest outcome prominent.
//   - An outcome entry is never edited, only annotated. There is
//     no edit function: only record, annotate, and remove. A dated
//     follow-up never rewrites the customer link, the attempt
//     date, the outcome, or the note.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

export const WINBACK_OUTCOME_STORE = 'shahdara_wb_outcomes_v1';
export const WINBACK_OUTCOME_FILENAME = 'winback-outcomes.csv';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const OUTCOMES = ['returned', 'declined', 'no answer'];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validWinbackOutcomeDate(value) {
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

function cleanOutcome(raw) {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim().toLowerCase();
  return OUTCOMES.includes(value) ? value : undefined;
}

function cleanFollowup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = text(raw.date);
  const note = text(raw.note);
  if (!validWinbackOutcomeDate(date) || !note) return null;
  return { date, note };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customer = text(raw.customer);
  const attemptDate = text(raw.attemptDate);
  const note = text(raw.note);
  if (!id || !customer || !note) return null;
  if (!validWinbackOutcomeDate(attemptDate)) return null;
  const outcome = cleanOutcome(raw.outcome);
  if (outcome === undefined) return null;
  const followups = Array.isArray(raw.followups)
    ? raw.followups.map(cleanFollowup).filter(Boolean)
    : [];
  return { id, customer, attemptDate, outcome, note, followups };
}

export function normalizeWinbackOutcomeList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function recordWinbackOutcome(list, raw) {
  const clean = normalizeWinbackOutcomeList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeWinbackOutcome(list, id) {
  const clean = normalizeWinbackOutcomeList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findWinbackOutcome(list, id) {
  const clean = normalizeWinbackOutcomeList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addWinbackOutcomeNote(list, id, date, note) {
  const clean = normalizeWinbackOutcomeList(list);
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

function compareEntries(a, b) {
  if (a.attemptDate !== b.attemptDate) return a.attemptDate < b.attemptDate ? -1 : 1;
  if (a.customer !== b.customer) return a.customer < b.customer ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function winbackOutcomeSorted(list) {
  return normalizeWinbackOutcomeList(list).sort(compareEntries);
}

export function attemptsForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return winbackOutcomeSorted(list).filter((item) => item.customer.toLowerCase() === wanted);
}

export function winbackOutcomeCustomers(list) {
  const seen = new Set();
  const out = [];
  for (const item of winbackOutcomeSorted(list)) {
    const key = item.customer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.customer);
  }
  return out;
}

// The latest outcome for one former customer: the attempt with the
// latest date, or null when the customer has no attempt recorded.
export function latestWinbackOutcome(list, customer) {
  const attempts = attemptsForCustomer(list, customer);
  return attempts.length ? attempts[attempts.length - 1] : null;
}

// Returned customers leave the open winback list: given the
// caller-supplied former-customer references, return the ones with
// no recorded "returned" outcome. Blank references are dropped,
// duplicates are listed once, and the first spelling is kept.
export function openWinbackCustomers(list, customers) {
  if (!Array.isArray(customers)) return [];
  const clean = normalizeWinbackOutcomeList(list);
  const returned = new Set();
  for (const item of clean) {
    if (item.outcome === 'returned') returned.add(item.customer.toLowerCase());
  }
  const seen = new Set();
  const out = [];
  for (const raw of customers) {
    const customer = text(raw);
    if (!customer) continue;
    const key = customer.toLowerCase();
    if (seen.has(key) || returned.has(key)) continue;
    seen.add(key);
    out.push(customer);
  }
  return out;
}

export function winbackOutcomeSummaryText(list) {
  const clean = normalizeWinbackOutcomeList(list);
  if (!clean.length) return 'No winback outcomes recorded.';
  const returned = clean.filter((item) => item.outcome === 'returned').length;
  const declined = clean.filter((item) => item.outcome === 'declined').length;
  const noAnswer = clean.filter((item) => item.outcome === 'no answer').length;
  return `${clean.length} winback outcome${clean.length === 1 ? '' : 's'}: ${returned} returned, ${declined} declined, ${noAnswer} no answer.`;
}

export function winbackOutcomeText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No winback outcome recorded.';
  const notes = clean.followups.length
    ? ` Follow-ups: ${clean.followups.map((f) => `${f.date}: ${f.note}`).join('; ')}`
    : '';
  return `Customer ${clean.customer} (${clean.attemptDate}): ${clean.outcome} — ${clean.note.replace(/\.+$/, '')}.${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function winbackOutcomeHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No winback outcome recorded.</p>';
  const notes = clean.followups.length
    ? `<br>Follow-ups: ${escapeHtml(clean.followups.map((f) => `${f.date}: ${f.note}`).join('; '))}`
    : '';
  return `<p>Customer <strong>${escapeHtml(clean.customer)}</strong> (${escapeHtml(clean.attemptDate)}): ${escapeHtml(clean.outcome)} — ${escapeHtml(clean.note.replace(/\.+$/, ''))}.${notes}</p>`;
}

export function winbackOutcomeAllHtml(list) {
  const sorted = winbackOutcomeSorted(list);
  if (!sorted.length) return '<p>No winback outcomes recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(winbackOutcomeText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function winbackOutcomeCsv(list) {
  const sorted = winbackOutcomeSorted(list);
  const header = ['id', 'customer', 'attempt date', 'outcome', 'note', 'follow-ups'];
  const rows = sorted.map((item) => [
    item.id,
    item.customer,
    item.attemptDate,
    item.outcome,
    item.note,
    item.followups.map((f) => `${f.date}: ${f.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function winbackOutcomeFilename() {
  return 'winback-outcomes.csv';
}
