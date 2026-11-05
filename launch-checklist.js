// Plan 261 (Plan 203-350) — New-mohalla launch checklist.
//
// Once a new mohalla is approved for expansion, the launch itself
// (first connections, collector route, announcements) has no ordered
// checklist, so launch steps are improvised. This module adds only
// the missing piece: one launch checklist per new mohalla — launch
// steps in order, owner per step, done date per step.
//
// What this module is NOT, stated plainly:
//   - It is not the expansion readiness checklist. That checklist
//     judges whether a mohalla is ready before approval — fixed
//     readiness steps plus a go/no-go note — and it is neither read
//     nor rewritten here. This module covers execution after
//     approval only, and it imports nothing.
//   - It never changes a coverage register, any bill, or any
//     payment. Recording a launch never changes any of those, and
//     this module holds no coverage, bill, or payment field, so
//     there is nothing here that could rewrite one.
//   - A launch shows ticked and unticked steps in order, and a
//     launch cannot be marked complete with unticked steps unless
//     a reason is recorded.
//   - A launch is never edited, only ticked and annotated. There
//     is no edit function: only record, tick a step, mark complete,
//     annotate, and remove. A dated follow-up never rewrites the
//     mohalla, the approved date, the steps, the completion, or
//     the reason.
//   - One launch checklist per new mohalla: a second checklist
//     for the same mohalla is refused.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - A record with no id, no mohalla, no strict approved date,
//     or no steps is refused outright. Every step needs its step
//     text and its owner, and a done date must be a real date or
//     empty (unticked). Unknown fields are dropped, so a record
//     can never grow a coverage, bill, payment, or sending field.
//   - A duplicate id is never rewritten, and a second checklist
//     for the same mohalla is refused.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validLaunchChecklistDate(value) {
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

function cleanFollowup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = text(raw.date);
  const note = text(raw.note);
  if (!validLaunchChecklistDate(date) || !note) return null;
  return { date, note };
}

function cleanStep(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const step = text(raw.step);
  const owner = text(raw.owner);
  if (!step || !owner) return null;
  const doneDate = text(raw.doneDate);
  if (doneDate !== '' && !validLaunchChecklistDate(doneDate)) return null;
  return { step, owner, doneDate };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const mohalla = text(raw.mohalla);
  const approvedDate = text(raw.approvedDate);
  if (!id || !mohalla) return null;
  if (!validLaunchChecklistDate(approvedDate)) return null;
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) return null;
  const seenSteps = new Set();
  const steps = [];
  for (const rawStep of raw.steps) {
    const step = cleanStep(rawStep);
    if (!step) return null;
    const key = step.step.toLowerCase();
    if (seenSteps.has(key)) return null;
    seenSteps.add(key);
    steps.push(step);
  }
  const complete = raw.complete === true;
  const incompleteReason = text(raw.incompleteReason);
  if (complete && steps.some((step) => step.doneDate === '') && !incompleteReason) return null;
  const followups = Array.isArray(raw.followups)
    ? raw.followups.map(cleanFollowup).filter(Boolean)
    : [];
  return { id, mohalla, approvedDate, steps, complete, incompleteReason, followups };
}

export function normalizeLaunchChecklistList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenMohallas = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    const key = entry.mohalla.toLowerCase();
    if (seenMohallas.has(key)) continue;
    seenIds.add(entry.id);
    seenMohallas.add(key);
    out.push(entry);
  }
  return out;
}

export function recordLaunchChecklist(list, raw) {
  const clean = normalizeLaunchChecklistList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  if (clean.some((item) => item.mohalla.toLowerCase() === entry.mohalla.toLowerCase())) return clean;
  return [...clean, entry];
}

export function removeLaunchChecklist(list, id) {
  const clean = normalizeLaunchChecklistList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findLaunchChecklist(list, id) {
  const clean = normalizeLaunchChecklistList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addLaunchChecklistNote(list, id, date, note) {
  const clean = normalizeLaunchChecklistList(list);
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

// Tick one step of a launch: the step is named by its step text
// (first spelling kept, matched case-insensitively) and the done
// date must be a real date. An unknown step, a bad date, or an
// already-ticked step leaves the list unchanged.
export function tickLaunchChecklistStep(list, id, step, doneDate) {
  const clean = normalizeLaunchChecklistList(list);
  const wanted = text(id);
  const stepText = text(step);
  const date = text(doneDate);
  if (!wanted || !stepText || !validLaunchChecklistDate(date)) return clean;
  let changed = false;
  const out = clean.map((item) => {
    if (item.id !== wanted) return item;
    const index = item.steps.findIndex((entry) => entry.step.toLowerCase() === stepText.toLowerCase());
    if (index === -1 || item.steps[index].doneDate !== '') return item;
    changed = true;
    const steps = item.steps.map((entry, i) => (i === index ? { ...entry, doneDate: date } : entry));
    return { ...item, steps };
  });
  return changed ? out : clean;
}

// Mark a launch complete. With every step ticked it completes
// plainly; with unticked steps it completes only when a reason is
// recorded. With unticked steps and no reason, the list is
// unchanged.
export function completeLaunchChecklist(list, id, reason) {
  const clean = normalizeLaunchChecklistList(list);
  const wanted = text(id);
  const reasonText = text(reason);
  if (!wanted) return clean;
  let changed = false;
  const out = clean.map((item) => {
    if (item.id !== wanted || item.complete) return item;
    const unticked = item.steps.some((step) => step.doneDate === '');
    if (unticked && !reasonText) return item;
    changed = true;
    return { ...item, complete: true, incompleteReason: unticked ? reasonText : '' };
  });
  return changed ? out : clean;
}

function compareEntries(a, b) {
  if (a.approvedDate !== b.approvedDate) return a.approvedDate < b.approvedDate ? -1 : 1;
  if (a.mohalla.toLowerCase() !== b.mohalla.toLowerCase()) return a.mohalla.toLowerCase() < b.mohalla.toLowerCase() ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function launchChecklistSorted(list) {
  return normalizeLaunchChecklistList(list).sort(compareEntries);
}

export function launchesForMohalla(list, mohalla) {
  const wanted = text(mohalla).toLowerCase();
  if (!wanted) return [];
  return launchChecklistSorted(list).filter((item) => item.mohalla.toLowerCase() === wanted);
}

export function launchChecklistMohallas(list) {
  const seen = new Set();
  const out = [];
  for (const item of launchChecklistSorted(list)) {
    const key = item.mohalla.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.mohalla);
  }
  return out;
}

export function launchChecklistUntickedSteps(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return [];
  return clean.steps.filter((step) => step.doneDate === '');
}

export function launchChecklistProgress(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return { done: 0, total: 0 };
  const done = clean.steps.filter((step) => step.doneDate !== '').length;
  return { done, total: clean.steps.length };
}

export function launchChecklistStatus(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'no launch checklist recorded';
  const { done, total } = launchChecklistProgress(clean);
  if (clean.complete && clean.incompleteReason) return `complete — ${total - done} step${total - done === 1 ? '' : 's'} unticked, reason recorded`;
  if (clean.complete) return 'complete';
  return `in progress — ${done}/${total} steps done`;
}

export function launchChecklistSummaryText(list) {
  const clean = normalizeLaunchChecklistList(list);
  if (!clean.length) return 'No launch checklists recorded.';
  const complete = clean.filter((item) => item.complete).length;
  const inProgress = clean.length - complete;
  return `${clean.length} launch checklist${clean.length === 1 ? '' : 's'}: ${complete} complete, ${inProgress} in progress.`;
}

function stepText(step, index) {
  const done = step.doneDate === '' ? 'not done' : `done ${step.doneDate}`;
  return `${index + 1}. ${step.step} (${step.owner}) — ${done}`;
}

export function launchChecklistText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No launch checklist recorded.';
  const { done, total } = launchChecklistProgress(clean);
  const steps = clean.steps.map(stepText).join('; ');
  const reason = clean.complete && clean.incompleteReason
    ? ` Reason for unticked steps: ${clean.incompleteReason.replace(/\.+$/, '')}.`
    : '';
  const notes = clean.followups.length
    ? ` Follow-ups: ${clean.followups.map((f) => `${f.date}: ${f.note}`).join('; ')}`
    : '';
  return `Launch for ${clean.mohalla} (approved ${clean.approvedDate}): ${done}/${total} steps done — ${launchChecklistStatus(clean)}. Steps: ${steps}.${reason}${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function launchChecklistHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No launch checklist recorded.</p>';
  return `<p>${escapeHtml(launchChecklistText(clean))}</p>`;
}

export function launchChecklistAllHtml(list) {
  const sorted = launchChecklistSorted(list);
  if (!sorted.length) return '<p>No launch checklists recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(launchChecklistText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function launchChecklistCsv(list) {
  const sorted = launchChecklistSorted(list);
  const header = ['id', 'mohalla', 'approved date', 'steps', 'complete', 'incomplete reason', 'follow-ups'];
  const rows = sorted.map((item) => [
    item.id,
    item.mohalla,
    item.approvedDate,
    item.steps.map((step) => `${step.step} | ${step.owner} | ${step.doneDate || 'not done'}`).join('; '),
    item.complete ? 'yes' : 'no',
    item.incompleteReason,
    item.followups.map((f) => `${f.date}: ${f.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function launchChecklistFilename() {
  return 'launch-checklists.csv';
}
