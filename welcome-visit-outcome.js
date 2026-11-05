// Plan 274 (Plan 203-350) — Welcome visit outcome note.
//
// A new customer's welcome visit happens, but its outcome was
// not recorded, so nobody knew whether the welcome actually
// landed or left questions open. This module adds only the
// missing piece: one outcome note per welcome visit — the
// customer, the visit date, the outcome (settled or questions
// open), and the open questions noted — so a new customer shows
// their welcome visit outcome with open questions still listed
// until answered.
//
// What this module is NOT, stated plainly:
//   - It is not the onboarding checklist. That checklist tracks
//     the onboarding steps themselves, and it is neither read
//     nor rewritten here. This module records only the outcome
//     of the welcome visit itself.
//   - It is not the welcome pack draft. That draft is the
//     welcome material prepared in advance, and it is neither
//     read nor rewritten here.
//   - It is not the new-customer check-in list. That list tracks
//     who still needs a check-in, and it is neither read nor
//     rewritten here.
//   - It never changes any onboarding, bill, or payment record.
//     This module holds no onboarding status, bill, or payment
//     field, so there is nothing here that could rewrite one.
//     Recording a note only adds the note.
//   - A note is refused when it has no customer or no date.
//   - A note is never edited, only annotated. There is no edit
//     function: only record, annotate, and remove. Adding an
//     open question or marking one answered never rewrites the
//     customer, the date, the outcome, or the note.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

export const WELCOME_VISIT_OUTCOME_STORE = 'shahdara_welcome_visit_outcomes_v1';
export const WELCOME_VISIT_OUTCOME_FILENAME = 'welcome-visit-outcomes.csv';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validWelcomeVisitOutcomeDate(value) {
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

const SETTLED_WORDS = new Set(['settled', 'done', 'complete', 'completed', 'resolved', 'all settled']);
const OPEN_WORDS = new Set(['questions open', 'open', 'pending', 'questions', 'unresolved', 'not settled']);

export function foldWelcomeVisitOutcome(value) {
  const clean = text(value).toLowerCase();
  if (SETTLED_WORDS.has(clean)) return 'settled';
  if (OPEN_WORDS.has(clean)) return 'questions open';
  return null;
}

function cleanQuestion(raw) {
  if (typeof raw === 'string') {
    const question = text(raw);
    return question ? { question, answered: false } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const question = text(raw.question);
  if (!question) return null;
  return { question, answered: raw.answered === true };
}

function cleanQuestions(raw) {
  if (typeof raw === 'string') {
    return raw.split('\n').map(cleanQuestion).filter(Boolean);
  }
  if (!Array.isArray(raw)) return [];
  return raw.map(cleanQuestion).filter(Boolean);
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customer = text(raw.customer);
  const date = text(raw.date);
  if (!id || !customer) return null;
  if (!validWelcomeVisitOutcomeDate(date)) return null;
  const openQuestions = cleanQuestions(raw.openQuestions);
  let outcome = foldWelcomeVisitOutcome(raw.outcome);
  if (!outcome) outcome = openQuestions.some((q) => !q.answered) ? 'questions open' : 'settled';
  const note = text(raw.note);
  return { id, customer, date, outcome, openQuestions, note };
}

export function normalizeWelcomeVisitOutcomeList(list) {
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

export function recordWelcomeVisitOutcome(list, raw) {
  const clean = normalizeWelcomeVisitOutcomeList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeWelcomeVisitOutcome(list, id) {
  const clean = normalizeWelcomeVisitOutcomeList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findWelcomeVisitOutcome(list, id) {
  const clean = normalizeWelcomeVisitOutcomeList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addWelcomeVisitOpenQuestion(list, id, question) {
  const clean = normalizeWelcomeVisitOutcomeList(list);
  const wanted = text(id);
  const entry = cleanQuestion(question);
  if (!wanted || !entry) return clean;
  let changed = false;
  const out = clean.map((item) => {
    if (item.id !== wanted) return item;
    changed = true;
    return { ...item, openQuestions: [...item.openQuestions, entry] };
  });
  return changed ? out : clean;
}

export function answerWelcomeVisitQuestion(list, id, question) {
  const clean = normalizeWelcomeVisitOutcomeList(list);
  const wanted = text(id);
  const wantedQuestion = text(question).toLowerCase();
  if (!wanted || !wantedQuestion) return clean;
  let changed = false;
  const out = clean.map((item) => {
    if (item.id !== wanted) return item;
    let answeredOne = false;
    const openQuestions = item.openQuestions.map((q) => {
      if (!answeredOne && !q.answered && q.question.toLowerCase() === wantedQuestion) {
        answeredOne = true;
        return { ...q, answered: true };
      }
      return q;
    });
    if (!answeredOne) return item;
    changed = true;
    return { ...item, openQuestions };
  });
  return changed ? out : clean;
}

function compareEntries(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.customer !== b.customer) return a.customer < b.customer ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function welcomeVisitOutcomeSorted(list) {
  return normalizeWelcomeVisitOutcomeList(list).sort(compareEntries);
}

export function outcomesForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return welcomeVisitOutcomeSorted(list).filter((item) => item.customer.toLowerCase() === wanted);
}

export function notesWithOpenQuestions(list) {
  return welcomeVisitOutcomeSorted(list).filter((item) =>
    item.openQuestions.some((q) => !q.answered));
}

export function openQuestionsForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  const out = [];
  for (const item of outcomesForCustomer(list, customer)) {
    for (const q of item.openQuestions) {
      if (!q.answered) out.push({ noteId: item.id, date: item.date, question: q.question });
    }
  }
  return out;
}

export function welcomeVisitOutcomeCustomers(list) {
  const seen = new Set();
  const out = [];
  for (const item of welcomeVisitOutcomeSorted(list)) {
    const key = item.customer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.customer);
  }
  return out;
}

export function welcomeVisitOutcomeSummaryText(list) {
  const clean = normalizeWelcomeVisitOutcomeList(list);
  if (!clean.length) return 'No welcome visit outcomes recorded.';
  const open = notesWithOpenQuestions(list).length;
  return `${clean.length} welcome visit outcome${clean.length === 1 ? '' : 's'} recorded, ${open} with open question${open === 1 ? '' : 's'} still to answer.`;
}

export function welcomeVisitOutcomeText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No welcome visit outcome recorded.';
  const open = clean.openQuestions.filter((q) => !q.answered).map((q) => q.question);
  const answered = clean.openQuestions.filter((q) => q.answered).map((q) => q.question);
  const questions = open.length ? ` Open questions: ${open.join('; ')}.` : '';
  const done = answered.length ? ` Answered: ${answered.join('; ')}.` : '';
  const note = clean.note ? ` ${clean.note.replace(/\.+$/, '')}.` : '';
  return `${clean.date}: welcome visit for ${clean.customer} — ${clean.outcome}.${questions}${done}${note}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function welcomeVisitOutcomeHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No welcome visit outcome recorded.</p>';
  return `<p>${escapeHtml(welcomeVisitOutcomeText(entry))}</p>`;
}

export function welcomeVisitOutcomeAllHtml(list) {
  const sorted = welcomeVisitOutcomeSorted(list);
  if (!sorted.length) return '<p>No welcome visit outcomes recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(welcomeVisitOutcomeText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function welcomeVisitOutcomeCsv(list) {
  const sorted = welcomeVisitOutcomeSorted(list);
  const header = ['id', 'customer', 'date', 'outcome', 'open questions', 'answered questions', 'note'];
  const rows = sorted.map((item) => [
    item.id,
    item.customer,
    item.date,
    item.outcome,
    item.openQuestions.filter((q) => !q.answered).map((q) => q.question).join('; '),
    item.openQuestions.filter((q) => q.answered).map((q) => q.question).join('; '),
    item.note,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function welcomeVisitOutcomeFilename() {
  return 'welcome-visit-outcomes.csv';
}
