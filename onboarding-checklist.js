// Plan 16 (Plan 1-100) — New-connection onboarding checklist.
//
// A new connection is set up in several loose steps (enquiry, survey,
// cable, device, credentials, activation, first bill), so a step can be
// skipped and nobody notices until the customer complains. This module
// writes those steps down, per customer, in one fixed order, each ticked
// off with a date and by whom.
//
// Scope fence, stated plainly: this is a checklist ONLY. It never
// changes a billing rule, a package, a lifecycle rule (Plan U keeps the
// journey timeline), a bill, a payment, or a service status. An
// incomplete checklist blocks nothing — it is only visible, on the
// profile and in the pending list, so Saad and the owner always agree
// on which new connections are actually finished.
//
// How the fence is kept in this module:
//   - It is import-free (like contact-preferences.js): the caller
//     supplies every customer and every tick, and the module never
//     reads storage, the clock, or the network, and never mutates an
//     input. A tick date is always caller-supplied, never invented.
//   - The step order is fixed. Tick input in any order still renders
//     in the canonical order, and an unknown step id is dropped,
//     never silently relabelled as a real step.
//   - A date that is not a real YYYY-MM-DD calendar date becomes
//     null, never a guessed date. Ticking without a date or a name
//     still counts as ticked, with the missing field shown as null,
//     so the operator can see what was not recorded.
//   - Clearing a step only clears that step's tick. It never deletes
//     the checklist, and it never touches any other record.
//   - Plan 20 (pending installations queue) is the pending VIEW of
//     this checklist, not a second list: pendingOnboardingList is
//     the function Plan 20 reuses, so there is never a second
//     pending list to drift from this one.

export const ONBOARDING_STEPS = Object.freeze([
  Object.freeze({ id: 'enquiry', label: 'Enquiry' }),
  Object.freeze({ id: 'survey', label: 'Survey / feasibility' }),
  Object.freeze({ id: 'cable', label: 'Cable laid' }),
  Object.freeze({ id: 'device', label: 'Device installed' }),
  Object.freeze({ id: 'credentials', label: 'Credentials issued' }),
  Object.freeze({ id: 'activation', label: 'Service activated' }),
  Object.freeze({ id: 'first_bill', label: 'First bill raised' }),
]);

export const ONBOARDING_STEP_IDS = Object.freeze(
  ONBOARDING_STEPS.map((step) => step.id),
);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isCompleted(value) {
  return value === true || value === 'true' || value === 1;
}

function isOnboardingStepId(value) {
  return ONBOARDING_STEP_IDS.includes(value);
}

// A real calendar date in YYYY-MM-DD form, or null. 2026-02-30 is
// rejected: the Date round-trip must reproduce the same string.
function validDate(value) {
  const str = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const parsed = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === str ? str : null;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[\",\n]/.test(str) ? `"${str.replace(/\"/g, '\"\"')}"` : str;
}

// One normalised tick, or null when the row names no real step.
// A tick may carry completed=false: that is a real, recorded
// unticked state, kept so an explicit untick is not lost.
export function normalizeOnboardingTick(tick) {
  const stepId = text(tick?.stepId ?? tick?.step ?? tick?.id);
  if (!isOnboardingStepId(stepId)) return null;
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
export function normalizeOnboardingTicks(ticks) {
  const byStep = new Map();
  for (const tick of Array.isArray(ticks) ? ticks : []) {
    const normalised = normalizeOnboardingTick(tick);
    if (normalised) byStep.set(normalised.stepId, normalised);
  }
  return ONBOARDING_STEPS.map((step) => byStep.get(step.id) ?? {
    stepId: step.id, completed: false, date: null, by: null,
  });
}

// One checklist for one customer: the same ordered steps for every
// new customer, each with its completion state. done/total,
// progressPercent, complete, and the next uncompleted step are all
// derived from the steps themselves, never stored separately, so the
// summary can never drift from the steps.
export function buildOnboardingChecklist(customerId, ticks) {
  const normalised = normalizeOnboardingTicks(ticks);
  const steps = ONBOARDING_STEPS.map((step, index) => ({
    stepId: step.id,
    label: step.label,
    completed: normalised[index].completed,
    date: normalised[index].date,
    by: normalised[index].by,
  }));
  const done = steps.filter((step) => step.completed).length;
  const next = steps.find((step) => !step.completed) ?? null;
  return {
    customerId: text(customerId),
    steps,
    done,
    total: steps.length,
    complete: done === steps.length,
    progressPercent: Math.round((done / steps.length) * 100),
    nextStepId: next?.stepId ?? null,
    nextStepLabel: next?.label ?? null,
  };
}

// Tick one step (date/by caller-supplied). Returns a NEW checklist;
// the input is never mutated. An unknown step returns the input
// unchanged, never inventing a step.
export function tickOnboardingStep(checklist, stepId, details) {
  const id = text(stepId);
  if (!isOnboardingStepId(id)) return checklist;
  const ticks = checklist.steps.map((step) => (step.stepId === id
    ? {
      stepId: step.stepId,
      completed: true,
      date: validDate(details?.date),
      by: text(details?.by) || null,
    }
    : {
      stepId: step.stepId,
      completed: step.completed,
      date: step.date,
      by: step.by,
    }));
  return buildOnboardingChecklist(checklist.customerId, ticks);
}

// Clear one step's tick (date/by cleared with it). Returns a NEW
// checklist; an unknown step returns the input unchanged.
export function untickOnboardingStep(checklist, stepId) {
  const id = text(stepId);
  if (!isOnboardingStepId(id)) return checklist;
  const ticks = checklist.steps.map((step) => (step.stepId === id
    ? { stepId: step.stepId, completed: false, date: null, by: null }
    : {
      stepId: step.stepId,
      completed: step.completed,
      date: step.date,
      by: step.by,
    }));
  return buildOnboardingChecklist(checklist.customerId, ticks);
}

// Stored ticks for one customer, or [] when none were recorded.
// Stored rows carry customerId; customer records carry id — both
// spellings mean the same customer, so lookups accept either.
export function findOnboardingTicks(checklists, customerId) {
  const id = text(customerId);
  if (!id) return [];
  const row = (Array.isArray(checklists) ? checklists : [])
    .find((entry) => text(entry?.customerId ?? entry?.id) === id);
  if (!row) return [];
  return normalizeOnboardingTicks(row.ticks ?? row.steps ?? []);
}

// Replace (or add) one customer's stored ticks. Returns a NEW list.
export function upsertOnboardingChecklist(checklists, customerId, ticks) {
  const id = text(customerId);
  const normalised = normalizeOnboardingTicks(ticks);
  const list = (Array.isArray(checklists) ? checklists : [])
    .filter((entry) => text(entry?.customerId ?? entry?.id) !== id);
  list.push({ customerId: id, ticks: normalised });
  return list;
}

// Remove one customer's stored ticks. Returns a NEW list.
export function removeOnboardingChecklist(checklists, customerId) {
  const id = text(customerId);
  return (Array.isArray(checklists) ? checklists : [])
    .filter((entry) => text(entry?.customerId ?? entry?.id) !== id);
}

// One pending-list entry: a customer plus their checklist. Mohalla
// comes from area or mohalla, whichever the record carries.
export function buildOnboardingEntry(customer, ticks) {
  const checklist = buildOnboardingChecklist(
    customer?.id ?? customer?.customerId, ticks,
  );
  return {
    customerId: checklist.customerId,
    customerName: text(customer?.name ?? customer?.customerName) || checklist.customerId,
    mohalla: text(customer?.area ?? customer?.mohalla),
    checklist,
  };
}

// The pending list: incomplete checklists only, sorted by customer
// name A–Z (case-insensitive) then customer id. Complete checklists
// never appear here. This is the list Plan 20 reuses as its pending
// installations view — no second list is built.
export function pendingOnboardingList(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry?.checklist && !entry.checklist.complete)
    .slice()
    .sort((a, b) => {
      const byName = (a.customerName || '').localeCompare(b.customerName || '', undefined, { sensitivity: 'base' });
      return byName !== 0 ? byName : (a.customerId || '').localeCompare(b.customerId || '');
    });
}

export function onboardingSummaryText(checklists) {
  const list = (Array.isArray(checklists) ? checklists : [])
    .map((entry) => (entry?.steps ? entry
      : entry?.checklist?.steps ? entry.checklist
      : buildOnboardingChecklist(
        entry?.customerId ?? entry?.id, entry?.ticks ?? entry?.steps ?? [],
      )));
  const complete = list.filter((entry) => entry.complete).length;
  const pending = list.length - complete;
  if (list.length === 0) return 'No onboarding checklists yet';
  return `${complete} of ${list.length} fully onboarded · ${pending} pending`;
}

export function onboardingChecklistHtml(checklist, customerName) {
  if (!checklist) return '<p class="empty-state">No onboarding checklist</p>';
  const name = text(customerName) || checklist.customerId;
  // Profile Polish F: the li carries a done/pending class so the CSS can
  // pill completed steps green and pending steps neutral — a styling hook
  // only; the mark, label, date and by-line are unchanged.
  const rows = checklist.steps.map((step) => {
    const mark = step.completed ? '✓' : '○';
    const detail = step.completed
      ? [step.date, step.by].filter(Boolean).join(' · ')
      : '';
    return `<li class="${step.completed ? 'onb-done' : 'onb-pending'}">${mark} ${escapeHtml(step.label)}${detail ? ` — ${escapeHtml(detail)}` : ''}</li>`;
  }).join('');
  const state = checklist.complete
    ? 'Complete — all steps done'
    : `${checklist.done} of ${checklist.total} steps done · next: ${escapeHtml(checklist.nextStepLabel)}`;
  return `<section class="onboarding-checklist"><h4>Onboarding checklist — ${escapeHtml(name)}</h4>`
    + `<p>${escapeHtml(state)} (${checklist.progressPercent}%)</p>`
    + `<ol>${rows}</ol>`
    + '<p>An incomplete checklist blocks nothing; it only shows what is still waiting.</p></section>';
}

export function onboardingPendingHtml(entries) {
  const pending = pendingOnboardingList(entries);
  if (pending.length === 0) return '<p class="empty-state">No pending onboardings</p>';
  const rows = pending.map((entry) => {
    const mohalla = entry.mohalla ? ` (${escapeHtml(entry.mohalla)})` : '';
    return `<li>${escapeHtml(entry.customerName)}${mohalla} — `
      + `${entry.checklist.done} of ${entry.checklist.total} steps done · `
      + `next: ${escapeHtml(entry.checklist.nextStepLabel)}</li>`;
  }).join('');
  return `<ul>${rows}</ul>`;
}

export function onboardingChecklistCsv(checklists) {
  const header = 'customerId,customerName,step,completed,date,by';
  const rows = [];
  for (const entry of Array.isArray(checklists) ? checklists : []) {
    const checklist = entry?.steps ? entry
      : entry?.checklist?.steps ? entry.checklist
      : buildOnboardingChecklist(
        entry?.customerId ?? entry?.id, entry?.ticks ?? entry?.steps ?? [],
      );
    const name = text(entry?.customerName ?? entry?.name) || checklist.customerId;
    for (const step of checklist.steps) {
      rows.push([
        csvCell(checklist.customerId),
        csvCell(name),
        csvCell(step.label),
        step.completed ? 'yes' : 'no',
        csvCell(step.date),
        csvCell(step.by),
      ].join(','));
    }
  }
  return [header, ...rows].join('\n');
}
