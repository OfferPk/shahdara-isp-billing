// Plan 192 (Plan 101-202) — New Collector Onboarding Checklist.
//
// A new collector learns the job by shadowing and memory, so some
// steps (shop routines, record-keeping, handover rules) are taught
// and others are missed. This module writes those steps down, one
// checklist per new collector, each step showing its own status, so
// a second collector can be brought in consistently.
//
// What this module is NOT, stated plainly:
//   - It is not customer onboarding. The new-connection onboarding
//     checklist and the new-customer check-in modules are neither
//     read nor written here; this covers staff onboarding only.
//   - It is not an assignment. It never assigns mohallas, routes,
//     or payments by itself, and it never changes any bill,
//     payment, route, or customer record: ticking a step moves only
//     that step's own marker inside its own checklist.
//   - It is not a settlement, commission, or performance record.
//     Collector assignment, settlement, commission, and performance
//     modules are neither read nor written here.
//   - It is not a task list that reassigns work. A step is plain
//     text only; ticking it never creates, closes, or reassigns any
//     other record.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the network,
//     and never touches another record type.
//   - Unknown fields are dropped, so no mohalla, route, bill,
//     payment, customer, or sending field can ever creep into a
//     checklist record.
//   - One checklist per collector (case-insensitive): a second
//     checklist for the same collector is refused outright, so a
//     collector can never quietly carry two conflicting checklists.
//   - Duplicate ids are never rewritten, and there is no edit
//     function at all: a checklist is recorded, a step is ticked or
//     unticked, or the checklist is removed — never silently
//     rewritten.
//   - Completed checklists stay as history: ticking the last step
//     only marks the checklist complete, it never removes it.

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsv(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function normalizeDate(value) {
  const date = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  if (month < 1 || month > 12) return null;
  const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day < 1 || day > maxDay) return null;
  return date;
}

function normalizeStep(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const step = text(raw.step);
  if (!step) return null;
  const done = raw.done === true;
  const date = done ? normalizeDate(raw.date) : null;
  return {
    step,
    done,
    date,
    checkedBy: done ? text(raw.checkedBy) : '',
    note: text(raw.note),
  };
}

function normalizeStepList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    const step = normalizeStep(entry);
    if (!step) continue;
    const key = step.step.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(step);
  }
  return out;
}

function normalizeChecklist(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const collector = text(raw.collector);
  if (!id || !collector) return null;
  const steps = normalizeStepList(raw.steps);
  if (!steps.length) return null;
  return { id, collector, steps };
}

function normalizeChecklistList(raw) {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set();
  const seenCollectors = new Set();
  const out = [];
  for (const entry of raw) {
    const checklist = normalizeChecklist(entry);
    if (!checklist) continue;
    if (seenIds.has(checklist.id)) continue;
    const collectorKey = checklist.collector.toLowerCase();
    if (seenCollectors.has(collectorKey)) continue;
    seenIds.add(checklist.id);
    seenCollectors.add(collectorKey);
    out.push(checklist);
  }
  return out;
}

function findChecklist(list, id) {
  const wanted = text(id);
  if (!wanted) return null;
  return normalizeChecklistList(list).find((entry) => entry.id === wanted) || null;
}

function recordChecklist(list, raw) {
  const entries = normalizeChecklistList(list);
  const checklist = normalizeChecklist(raw);
  if (!checklist) return entries;
  if (entries.some((entry) => entry.id === checklist.id)) return entries;
  if (entries.some((entry) => entry.collector.toLowerCase() === checklist.collector.toLowerCase())) return entries;
  return [...entries, checklist];
}

function removeChecklist(list, id) {
  const wanted = text(id);
  if (!wanted) return normalizeChecklistList(list);
  return normalizeChecklistList(list).filter((entry) => entry.id !== wanted);
}

function tickChecklistStep(list, id, stepName, tick) {
  const wanted = text(id);
  const wantedStep = text(stepName);
  if (!wanted || !wantedStep) return normalizeChecklistList(list);
  const date = normalizeDate(tick && tick.date);
  if (!date) return normalizeChecklistList(list);
  return normalizeChecklistList(list).map((entry) => {
    if (entry.id !== wanted) return entry;
    const steps = entry.steps.map((step) =>
      step.step.toLowerCase() === wantedStep.toLowerCase()
        ? { ...step, done: true, date, checkedBy: text(tick.checkedBy), note: text(tick.note) }
        : step
    );
    return { ...entry, steps };
  });
}

function untickChecklistStep(list, id, stepName) {
  const wanted = text(id);
  const wantedStep = text(stepName);
  if (!wanted || !wantedStep) return normalizeChecklistList(list);
  return normalizeChecklistList(list).map((entry) => {
    if (entry.id !== wanted) return entry;
    const steps = entry.steps.map((step) =>
      step.step.toLowerCase() === wantedStep.toLowerCase()
        ? { ...step, done: false, date: null, checkedBy: '' }
        : step
    );
    return { ...entry, steps };
  });
}

function checklistsSorted(list) {
  return normalizeChecklistList(list).sort((a, b) => {
    if (a.collector.toLowerCase() !== b.collector.toLowerCase()) {
      return a.collector.toLowerCase() < b.collector.toLowerCase() ? -1 : 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function checklistsForCollector(list, query) {
  const wanted = text(query).toLowerCase();
  if (!wanted) return checklistsSorted(list);
  return checklistsSorted(list).filter((entry) => entry.collector.toLowerCase().includes(wanted));
}

function isChecklistComplete(entry) {
  const clean = normalizeChecklist(entry);
  return !!clean && clean.steps.every((step) => step.done);
}

function completedChecklists(list) {
  return checklistsSorted(list).filter(isChecklistComplete);
}

function pendingChecklists(list) {
  return checklistsSorted(list).filter((entry) => !isChecklistComplete(entry));
}

function starterCollectorSteps() {
  return [
    'Shop opening and closing routine',
    'Receipt book and record-keeping',
    'Cash handover rules',
    'Collection trust and customer manner',
    'Fault visit note handover',
  ];
}

function checklistSummaryText(list) {
  const entries = normalizeChecklistList(list);
  const done = entries.filter(isChecklistComplete).length;
  return `${done}/${entries.length} collector checklists complete`;
}

function checklistText(entry) {
  const clean = normalizeChecklist(entry);
  if (!clean) return '';
  const lines = [`${clean.collector} [${isChecklistComplete(clean) ? 'complete' : 'in progress'}]`];
  for (const step of clean.steps) {
    const mark = step.done ? 'done' : 'not done';
    const detail = step.done ? ` (${step.date || ''}${step.checkedBy ? `, checked by ${step.checkedBy}` : ''})` : '';
    lines.push(`- ${step.step} [${mark}]${detail}`);
    if (step.note) lines.push(`  Note: ${step.note}`);
  }
  return lines.join('\n');
}

function checklistHtml(entry) {
  const clean = normalizeChecklist(entry);
  if (!clean) return '';
  const status = isChecklistComplete(clean) ? 'complete' : 'in progress';
  const items = clean.steps.map((step) => {
    const mark = step.done ? 'done' : 'not done';
    const detail = step.done ? ` (${escapeHtml(step.date || '')}${step.checkedBy ? `, checked by ${escapeHtml(step.checkedBy)}` : ''})` : '';
    const note = step.note ? `<br>Note: ${escapeHtml(step.note)}` : '';
    return `<li>${escapeHtml(step.step)} [${mark}]${detail}${note}</li>`;
  }).join('');
  return `<p><strong>${escapeHtml(clean.collector)}</strong> [${status}]</p><ul>${items}</ul>`;
}

function checklistAllHtml(list) {
  return checklistsSorted(list).map(checklistHtml).join('');
}

function checklistCsv(list) {
  const rows = [['id', 'collector', 'step', 'done', 'date', 'checkedBy', 'note', 'checklistComplete']];
  for (const entry of checklistsSorted(list)) {
    for (const step of entry.steps) {
      rows.push([
        entry.id,
        entry.collector,
        step.step,
        step.done ? 'done' : 'not done',
        step.date || '',
        step.checkedBy,
        step.note,
        isChecklistComplete(entry) ? 'complete' : 'in progress',
      ]);
    }
  }
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function checklistFilename() {
  return 'collector-onboarding.csv';
}

export {
  normalizeDate,
  normalizeStep,
  normalizeStepList,
  normalizeChecklist,
  normalizeChecklistList,
  findChecklist,
  recordChecklist,
  removeChecklist,
  tickChecklistStep,
  untickChecklistStep,
  checklistsSorted,
  checklistsForCollector,
  isChecklistComplete,
  completedChecklists,
  pendingChecklists,
  starterCollectorSteps,
  checklistSummaryText,
  checklistText,
  checklistHtml,
  checklistAllHtml,
  checklistCsv,
  checklistFilename,
};
