// Plan 29 (Plan 1-100) — New-mohalla expansion readiness checklist.
//
// Expanding into a new street or mohalla is decided on enthusiasm, so
// a launch can arrive before the splitter, the route, or the price list
// is ready. This module writes the readiness down, per area, in one
// fixed order of steps, each ticked off with a date and by whom, plus
// the operator's go/no-go note — the explicit decision, not a guess.
//
// Scope fence, stated plainly: this is a checklist ONLY, modelled on
// Plan 16's onboarding checklist pattern but for expansion areas, not
// customers. It never creates a customer, a bill, or a port assignment,
// never changes a billing rule, the connection register (Plan 17), or
// any customer record, and it never builds Plan 14's announcement
// itself — the announcement step here only records that a draft
// exists. An incomplete checklist blocks nothing; it is only visible,
// so the owner can see at a glance which new area is actually ready.
//
// How the fence is kept in this module:
//   - It is import-free (like onboarding-checklist.js): the caller
//     supplies every area and every tick, and the module never reads
//     storage, the clock, or the network, and never mutates an input.
//   - The step order is fixed. Tick input in any order still renders
//     in the canonical order, and an unknown step id is dropped,
//     never silently relabelled as a real step.
//   - A date that is not a real YYYY-MM-DD calendar date becomes
//     null, never a guessed date. Ticking without a date or a name
//     still counts as ticked, with the missing field shown as null.
//   - Ready is derived, never stored: an area is ready only when
//     every required step is ticked AND a go/no-go note is recorded.
//     An area can never be marked ready while a required step is
//     unticked, and an area with no decision note is never ready.
//   - Areas are keyed by their trimmed, case-insensitive name, so
//     "Bani" and "BANI" are one area, never two checklists that drift.

export const EXPANSION_STEPS = Object.freeze([
  Object.freeze({ id: 'survey', label: 'Survey done' }),
  Object.freeze({ id: 'splitter', label: 'Splitter capacity confirmed' }),
  Object.freeze({ id: 'route', label: 'Cable route planned' }),
  Object.freeze({ id: 'prices', label: 'Package prices set' }),
  Object.freeze({ id: 'announcement', label: 'Launch announcement drafted' }),
]);

export const EXPANSION_STEP_IDS = Object.freeze(
  EXPANSION_STEPS.map((step) => step.id),
);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isCompleted(value) {
  return value === true || value === 'true' || value === 1;
}

function isExpansionStepId(value) {
  return EXPANSION_STEP_IDS.includes(value);
}

// A real calendar date in YYYY-MM-DD form, or null. 2026-02-30 is
// rejected: the Date round-trip must reproduce the same string.
function validDate(value) {
  const str = text(value);
  if (!DATE_RE.test(str)) return null;
  const parsed = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === str ? str : null;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// Canonical key for one area: trimmed and case-insensitive, so the
// same area typed twice never becomes two checklists.
export function expansionAreaKey(area) {
  return text(area).toLowerCase();
}

// One normalised tick, or null when the row names no real step.
// A tick may carry completed=false: that is a real, recorded
// unticked state, kept so an explicit untick is not lost.
export function normalizeExpansionTick(tick) {
  const stepId = text(tick?.stepId ?? tick?.step ?? tick?.id);
  if (!isExpansionStepId(stepId)) return null;
  return {
    stepId,
    completed: isCompleted(tick?.completed ?? tick?.done ?? tick?.ticked),
    date: validDate(tick?.date ?? tick?.completedAt ?? tick?.at),
    by: text(tick?.by ?? tick?.completedBy ?? tick?.staffName) || null,
  };
}

// Ticks normalised and returned in canonical step order. A repeated
// step keeps its LAST tick, so re-ticking updates the date/by rather
// than piling up two ticks for one step.
export function normalizeExpansionTicks(ticks) {
  const byStep = new Map();
  for (const tick of Array.isArray(ticks) ? ticks : []) {
    const normalised = normalizeExpansionTick(tick);
    if (normalised) byStep.set(normalised.stepId, normalised);
  }
  return EXPANSION_STEPS.map((step) => byStep.get(step.id) ?? {
    stepId: step.id, completed: false, date: null, by: null,
  });
}

// One checklist for one area: the same ordered steps for every
// expansion area, each with its completion state, plus the go/no-go
// note. done/total, progressPercent, complete, ready, and the next
// uncompleted step are all derived from the steps and the note
// themselves, never stored separately, so the summary can never drift
// from the steps. Returns null for a blank area name — an area with no
// name is never a checklist.
export function buildExpansionChecklist(area, ticks, note) {
  const name = text(area);
  if (!name) return null;
  const normalised = normalizeExpansionTicks(ticks);
  const steps = EXPANSION_STEPS.map((step, index) => ({
    stepId: step.id,
    label: step.label,
    completed: normalised[index].completed,
    date: normalised[index].date,
    by: normalised[index].by,
  }));
  const done = steps.filter((step) => step.completed).length;
  const total = steps.length;
  const complete = done === total;
  const goNoGoNote = text(note) || null;
  const next = steps.find((step) => !step.completed);
  return {
    area: name,
    areaKey: expansionAreaKey(name),
    steps,
    done,
    total,
    progressPercent: Math.round((done / total) * 100),
    complete,
    goNoGoNote,
    ready: complete && goNoGoNote !== null,
    nextStep: next ? next.label : null,
    nextStepId: next ? next.stepId : null,
  };
}

// Normalise one stored checklist row, or null when it names no area.
// The row's own ticks are re-normalised, so a stored row with a bad
// step or a bad date still renders honestly.
export function normalizeExpansionChecklist(row) {
  if (!row || typeof row !== 'object') return null;
  const ticks = Array.isArray(row.steps) ? row.steps : (row.ticks ?? []);
  const note = row.goNoGoNote ?? row.note ?? row.decision ?? null;
  return buildExpansionChecklist(row.area ?? row.name, ticks, note);
}

export function normalizeExpansionChecklists(list) {
  const byKey = new Map();
  for (const row of Array.isArray(list) ? list : []) {
    const normalised = normalizeExpansionChecklist(row);
    if (normalised) byKey.set(normalised.areaKey, normalised);
  }
  return [...byKey.values()];
}

export function findExpansionChecklist(list, area) {
  const key = expansionAreaKey(area);
  if (!key) return null;
  return normalizeExpansionChecklists(list).find((row) => row.areaKey === key) ?? null;
}

// Tick one step of a built checklist. Returns a NEW checklist; the
// input is never mutated. Unknown step ids are a no-op.
export function tickExpansionStep(checklist, stepId, details) {
  if (!checklist || !isExpansionStepId(text(stepId))) return checklist;
  const ticks = checklist.steps.map((step) => step.stepId === text(stepId)
    ? { stepId: step.stepId, completed: true, date: details?.date ?? null, by: details?.by ?? null }
    : { stepId: step.stepId, completed: step.completed, date: step.date, by: step.by });
  return buildExpansionChecklist(checklist.area, ticks, checklist.goNoGoNote);
}

// Untick one step of a built checklist. Returns a NEW checklist; the
// input is never mutated. Unknown step ids are a no-op.
export function untickExpansionStep(checklist, stepId) {
  if (!checklist || !isExpansionStepId(text(stepId))) return checklist;
  const ticks = checklist.steps.map((step) => step.stepId === text(stepId)
    ? { stepId: step.stepId, completed: false, date: null, by: null }
    : { stepId: step.stepId, completed: step.completed, date: step.date, by: step.by });
  return buildExpansionChecklist(checklist.area, ticks, checklist.goNoGoNote);
}

// Upsert one area's checklist into a list: the same area (by key)
// replaces its old row, never piles up a second. Returns a NEW list.
export function upsertExpansionChecklist(list, area, ticks, note) {
  const built = buildExpansionChecklist(area, ticks, note);
  if (!built) return normalizeExpansionChecklists(list);
  const rows = normalizeExpansionChecklists(list).filter((row) => row.areaKey !== built.areaKey);
  rows.push(built);
  return rows.sort((a, b) => a.area.localeCompare(b.area));
}

// Remove one area's checklist from a list. Returns a NEW list.
export function removeExpansionChecklist(list, area) {
  const key = expansionAreaKey(area);
  if (!key) return normalizeExpansionChecklists(list);
  return normalizeExpansionChecklists(list).filter((row) => row.areaKey !== key);
}

// The list view: every area, name A–Z, each with its derived state.
// Ticking never creates anything else — this list is the whole output.
export function buildExpansionChecklistList(list) {
  return normalizeExpansionChecklists(list)
    .sort((a, b) => a.area.localeCompare(b.area));
}

export function expansionSummaryText(list) {
  const rows = buildExpansionChecklistList(list);
  const ready = rows.filter((row) => row.ready).length;
  const inProgress = rows.filter((row) => !row.ready && row.done > 0).length;
  const notStarted = rows.filter((row) => row.done === 0).length;
  return `${rows.length} expansion areas · ${ready} ready · ${inProgress} in progress · ${notStarted} not started`;
}

export function expansionChecklistHtml(list) {
  const rows = buildExpansionChecklistList(list);
  if (!rows.length) return '<p>No expansion areas yet.</p>';
  return rows.map((row) => {
    const stepsHtml = row.steps.map((step) => `<li>${step.completed ? '✓' : '○'} ${escapeHtml(step.label)}${step.completed && step.date ? ` — ${escapeHtml(step.date)}` : ''}${step.completed && step.by ? ` by ${escapeHtml(step.by)}` : ''} <button type="button" data-expansion-tick="${escapeHtml(row.area)}|${escapeHtml(step.stepId)}">Tick</button> <button type="button" data-expansion-untick="${escapeHtml(row.area)}|${escapeHtml(step.stepId)}">Untick</button></li>`).join('');
    return `<section><h4>${escapeHtml(row.area)} — ${row.progressPercent}% (${row.done}/${row.total})${row.ready ? ' — READY' : ''}</h4><ul>${stepsHtml}</ul><p>${row.nextStep ? `Next step: ${escapeHtml(row.nextStep)}` : 'All steps complete.'}</p><p>Go / no-go note: ${row.goNoGoNote ? escapeHtml(row.goNoGoNote) : 'Not recorded'}</p></section>`;
  }).join('');
}

export function expansionChecklistCsv(list) {
  const rows = buildExpansionChecklistList(list);
  const header = ['Area', 'Done', 'Total', 'Progress %', 'Ready', 'Next step', 'Go / no-go note'];
  const lines = rows.map((row) => [
    row.area, row.done, row.total, row.progressPercent, row.ready ? 'Yes' : 'No', row.nextStep ?? '', row.goNoGoNote ?? '',
  ].map(csvCell).join(','));
  return [header.join(','), ...lines].join('\n');
}

export function expansionChecklistFilename() {
  return 'expansion-checklist.csv';
}
