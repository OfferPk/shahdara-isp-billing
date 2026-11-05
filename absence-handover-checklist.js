// Plan 309 (Plan 203-350) — Owner absence handover checklist.
//
// When the owner is away, the covering person has no written
// list of what must be done, so urgent work waits and routine
// work is missed. This module adds only the missing piece:
// one handover checklist per cover period — the cover dates,
// the covering person, the checklist steps with done and
// not-done shown, and notes — so each cover period shows its
// checklist with done and missed steps visible, and the cover
// person works from a list instead of from guesswork.
//
// What this module is NOT, stated plainly:
//   - It is not the Plan 202 cover roster, which says who
//     covers when. That roster already exists and is neither
//     read nor rewritten here; this module is the checklist
//     for a cover period, not the roster itself.
//   - It is not the Plan 184 owner decision log, which
//     records decisions. That log already exists and is
//     neither read nor rewritten here; a checklist step is
//     a job to do, not a decision.
//   - It is not the Plan 183 staff handover notes or the
//     Plan 160 field handover note, which hand over staff
//     work and field work. Those already exist and are
//     neither read nor rewritten here; this checklist is
//     for a whole cover period while the owner is away.
//   - It is not the Plan 298 delegation note, which records
//     one task handed to one person. That note already
//     exists and is neither read nor rewritten here; a
//     handover checklist holds many steps for one cover
//     period, not one delegated task.
//   - It is not a bill, payment, customer, or staff change.
//     Creating a checklist never changes any bill, payment,
//     customer, or staff record by itself, and it grants no
//     new permissions: the checklist only lists work.
//   - It is not a live record. A checklist, once written,
//     is never silently edited: there is no edit function,
//     only record, find, remove, and marking one step done
//     or not done; a wrong checklist is removed and
//     recorded again.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     checklist, and the module never reads storage, the
//     clock, or the network, and never mutates an input.
//   - A checklist with no id, no strict cover-from date, no
//     strict cover-to date, no covering person in plain
//     words, or no step is refused outright, as is a cover-to
//     date before the cover-from date, and any step with no
//     label. Unknown fields are dropped, so a checklist can
//     never grow a bill, payment, customer, or staff field.
//   - A duplicate id is never rewritten: the first
//     checklist stays.
//   - Marking a step done or not done changes only that one
//     step of that one checklist.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validAbsenceHandoverChecklistDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= limit;
}

/**
 * One checklist step, or null when half-formed. A step needs
 * a label in plain words; done defaults to not done, and the
 * note is optional plain words. Unknown fields are dropped;
 * the input is never mutated.
 */
export function normalizeAbsenceHandoverChecklistStep(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const label = text(raw.label);
  if (!label) return null;
  const step = { label, done: raw.done === true };
  const note = text(raw.note);
  if (note) step.note = note;
  return step;
}

/**
 * One handover checklist, or null when half-formed. A
 * checklist needs an id, a strict cover-from date, a strict
 * cover-to date on or after the cover-from date, a covering
 * person in plain words, and at least one step. Unknown
 * fields are dropped; the input is never mutated.
 */
export function normalizeAbsenceHandoverChecklist(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const coverFrom = text(raw.coverFrom);
  const coverTo = text(raw.coverTo);
  const coveringPerson = text(raw.coveringPerson);
  if (!id) return null;
  if (!validAbsenceHandoverChecklistDay(coverFrom)) return null;
  if (!validAbsenceHandoverChecklistDay(coverTo)) return null;
  if (coverTo < coverFrom) return null;
  if (!coveringPerson) return null;
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) return null;
  const steps = raw.steps.map((step) => normalizeAbsenceHandoverChecklistStep(step));
  if (steps.some((step) => step === null)) return null;
  const checklist = { id, coverFrom, coverTo, coveringPerson, steps };
  const notes = text(raw.notes);
  if (notes) checklist.notes = notes;
  return checklist;
}

/** Normalised handover checklists only; a duplicate id is never rewritten, the first stays. */
export function normalizeAbsenceHandoverChecklistList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const checklist = normalizeAbsenceHandoverChecklist(raw);
    if (!checklist || seen.has(checklist.id)) continue;
    seen.add(checklist.id);
    out.push(checklist);
  }
  return out;
}

export function findAbsenceHandoverChecklist(list, id) {
  const clean = normalizeAbsenceHandoverChecklistList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((checklist) => checklist.id === wanted) ?? null;
}

/**
 * Record a handover checklist. Refused when half-formed or
 * when its id is already recorded — the first checklist for
 * an id always stays.
 */
export function recordAbsenceHandoverChecklist(list, raw) {
  const clean = normalizeAbsenceHandoverChecklistList(list);
  const checklist = normalizeAbsenceHandoverChecklist(raw);
  if (!checklist) return clean;
  if (clean.some((item) => item.id === checklist.id)) return clean;
  return [...clean, checklist];
}

export function removeAbsenceHandoverChecklist(list, id) {
  const clean = normalizeAbsenceHandoverChecklistList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((checklist) => checklist.id !== wanted);
}

/**
 * Mark one step of one checklist done or not done, by its
 * position in the steps list. An unknown id, an out-of-range
 * step, or a non-boolean value leaves the list unchanged;
 * only that one step ever changes.
 */
export function setAbsenceHandoverChecklistStepDone(list, id, stepIndex, done) {
  const clean = normalizeAbsenceHandoverChecklistList(list);
  const wanted = text(id);
  if (!wanted || typeof done !== 'boolean') return clean;
  if (!Number.isInteger(stepIndex) || stepIndex < 0) return clean;
  return clean.map((checklist) => {
    if (checklist.id !== wanted) return checklist;
    if (stepIndex >= checklist.steps.length) return checklist;
    const steps = checklist.steps.map((step, index) => (index === stepIndex ? { ...step, done } : step));
    return { ...checklist, steps };
  });
}

/** Done, missed (not done), and total step counts for one checklist, or null when half-formed. */
export function absenceHandoverChecklistStepCounts(checklist) {
  const clean = normalizeAbsenceHandoverChecklist(checklist);
  if (!clean) return null;
  const done = clean.steps.filter((step) => step.done).length;
  return { done, missed: clean.steps.length - done, total: clean.steps.length };
}

/** Handover checklists by cover-from date, then cover-to date, then id, so the same list always reads the same way. */
export function absenceHandoverChecklistSorted(list) {
  const clean = normalizeAbsenceHandoverChecklistList(list);
  return [...clean].sort((a, b) => {
    if (a.coverFrom !== b.coverFrom) return a.coverFrom < b.coverFrom ? -1 : 1;
    if (a.coverTo !== b.coverTo) return a.coverTo < b.coverTo ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Handover checklists for one covering person, in cover-date order; the person match is case-insensitive. */
export function absenceHandoverChecklistsForPerson(list, person) {
  const wanted = text(person).toLowerCase();
  if (!wanted) return [];
  return absenceHandoverChecklistSorted(list).filter(
    (checklist) => checklist.coveringPerson.toLowerCase() === wanted,
  );
}

/**
 * Covering people in A-Z order, keeping the first spelling
 * seen, so "Saad" and "saad" never list as two people.
 */
export function absenceHandoverChecklistCoveringPeople(list) {
  const clean = normalizeAbsenceHandoverChecklistList(list);
  const byLower = new Map();
  for (const checklist of clean) {
    const key = checklist.coveringPerson.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, checklist.coveringPerson);
  }
  return [...byLower.values()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
}

/** Plain-words summary: the count, the steps done and still to do, and the next cover period. */
export function absenceHandoverChecklistSummaryText(list) {
  const clean = normalizeAbsenceHandoverChecklistList(list);
  if (!clean.length) return 'No owner absence handover checklists recorded.';
  const sorted = absenceHandoverChecklistSorted(clean);
  let done = 0;
  let total = 0;
  for (const checklist of clean) {
    const counts = absenceHandoverChecklistStepCounts(checklist);
    done += counts.done;
    total += counts.total;
  }
  const missed = total - done;
  const countWord = clean.length === 1 ? '1 handover checklist' : `${clean.length} handover checklists`;
  const next = sorted[0];
  return `${countWord}, ${done} of ${total} steps done, ${missed} steps still to do. Next cover: ${next.coverFrom} to ${next.coverTo} by ${next.coveringPerson}.`;
}

/** One line naming a checklist, with its done and missed steps, for lists and messages. */
export function absenceHandoverChecklistEntryText(checklist) {
  const clean = normalizeAbsenceHandoverChecklist(checklist);
  if (!clean) return '';
  const counts = absenceHandoverChecklistStepCounts(clean);
  const steps = clean.steps
    .map((step) => `${step.label} (${step.done ? 'done' : 'to do'}${step.note ? ` — ${step.note}` : ''})`)
    .join('; ');
  const notes = clean.notes ? ` Notes: ${clean.notes.replace(/\.+$/, '')}.` : '';
  return `${clean.coverFrom} to ${clean.coverTo} — cover by ${clean.coveringPerson}: ${counts.done} of ${counts.total} steps done, ${counts.missed} still to do. Steps: ${steps}.${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function absenceHandoverChecklistEntryHtml(checklist) {
  const clean = normalizeAbsenceHandoverChecklist(checklist);
  if (!clean) return '';
  return `<li>${escapeHtml(absenceHandoverChecklistEntryText(clean))}</li>`;
}

export function absenceHandoverChecklistAllHtml(list) {
  const sorted = absenceHandoverChecklistSorted(list);
  if (!sorted.length) return '<p>No owner absence handover checklists recorded.</p>';
  return `<ul>${sorted.map((checklist) => absenceHandoverChecklistEntryHtml(checklist)).join('')}</ul>`;
}

export function absenceHandoverChecklistsForPersonHtml(list, person) {
  const checklists = absenceHandoverChecklistsForPerson(list, person);
  if (!checklists.length) return '<p>No handover checklists for that covering person.</p>';
  return `<ul>${checklists.map((checklist) => absenceHandoverChecklistEntryHtml(checklist)).join('')}</ul>`;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function absenceHandoverChecklistCsv(list) {
  const sorted = absenceHandoverChecklistSorted(list);
  const header = ['id', 'coverFrom', 'coverTo', 'coveringPerson', 'steps', 'notes'].join(',');
  const rows = sorted.map((checklist) => {
    const steps = checklist.steps.map((step) => `${step.label}:${step.done ? 'done' : 'to do'}`).join('; ');
    return [checklist.id, checklist.coverFrom, checklist.coverTo, checklist.coveringPerson, steps, checklist.notes ?? ''].map(csvCell).join(',');
  });
  return [header, ...rows].join('\n');
}

export function absenceHandoverChecklistFilename() {
  return 'absence-handover-checklists.csv';
}
