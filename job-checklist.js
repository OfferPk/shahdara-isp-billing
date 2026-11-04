// Plan 144 (Plan 101-202) — Job-type field checklist.
//
// Different jobs need different checks, but field staff work from
// memory and skip steps on some visits. This module is the written
// checklist: one template per job type with ordered check items, and
// one tick record per visit naming which items were ticked.
//
// What this module is NOT, stated plainly:
//   - It is not a visit editor. A tick record names a visit by
//     label only; it never changes that visit's outcome, never
//     changes any fault ticket, and never changes any bill or
//     payment. Ticking a box proves nothing by itself — it only
//     records what the operator says was checked.
//   - It is not a second copy of any existing checklist.
//     Checked first: the onboarding checklist (Plan 16,
//     onboarding-checklist.js) tracks steps per CUSTOMER for a
//     new connection; the expansion checklist (Plan 29,
//     expansion-checklist.js) tracks readiness steps per AREA;
//     the bend-loss inspection (qa-bend-loss-inspection.js)
//     records one specific inspection. None of those modules is
//     read or written here, and none of their records is ever
//     touched by this one. The missing piece is a checklist per
//     JOB TYPE, reused on every visit of that type, with a
//     per-visit tick record.
//   - It is not proof that a check really happened. Items and
//     ticks say what the operator recorded; the module verifies
//     format and arithmetic, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     template, every visit record, and every tick, and the
//     module never reads storage, the clock, or the network,
//     never imports another module, and never mutates an input.
//     Every function returns new lists or new rows.
//   - One template per job type: three built-in templates ship
//     with the module (new connection, fault visit, relocation
//     check) and the operator may add a template for any other
//     job type, but a job type that already has a template
//     cannot gain a second one, and a built-in template cannot
//     be removed or replaced.
//   - A visit record needs an id, a job type that has a
//     template, a visit label, and a real calendar date.
//     Half-formed visits are refused outright, never stored
//     half-formed. A duplicate id is never rewritten, and there
//     is no edit function — only ticking, unticking, and
//     removal. Unknown fields are dropped, so a record can
//     never grow a visit-outcome, bill, or payment field.
//   - Ticks name template items only: a tick for an item the
//     template does not have is dropped, never silently kept.
//     A tick without a date or a name still counts as ticked,
//     with the missing field shown as null, so the operator can
//     see what was not recorded.
//   - An incomplete checklist is flagged, never hidden: the
//     incomplete list names every visit whose ticked count is
//     below its template's item count, and the visit view shows
//     ticked and unticked items side by side, in template
//     order. An incomplete checklist blocks nothing — it is
//     only visible.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validJobChecklistDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth ? value : null;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Built-in templates, in fixed item order. Never edited by callers. */
export const JOB_CHECKLIST_DEFAULTS = Object.freeze([
  Object.freeze({
    jobType: 'new-connection',
    items: Object.freeze([
      Object.freeze({ id: 'survey', label: 'Survey / feasibility done' }),
      Object.freeze({ id: 'cable', label: 'Cable laid' }),
      Object.freeze({ id: 'device', label: 'Device installed' }),
      Object.freeze({ id: 'credentials', label: 'Credentials issued' }),
      Object.freeze({ id: 'test', label: 'Service tested on site' }),
      Object.freeze({ id: 'briefing', label: 'Customer briefed' }),
    ]),
  }),
  Object.freeze({
    jobType: 'fault-visit',
    items: Object.freeze([
      Object.freeze({ id: 'confirm', label: 'Fault confirmed on site' }),
      Object.freeze({ id: 'cause', label: 'Cause identified' }),
      Object.freeze({ id: 'fix', label: 'Fix applied' }),
      Object.freeze({ id: 'test', label: 'Service tested on site' }),
      Object.freeze({ id: 'briefing', label: 'Customer briefed' }),
    ]),
  }),
  Object.freeze({
    jobType: 'relocation',
    items: Object.freeze([
      Object.freeze({ id: 'old-disconnect', label: 'Old site disconnected' }),
      Object.freeze({ id: 'route', label: 'Cable route planned' }),
      Object.freeze({ id: 'install', label: 'New site installed' }),
      Object.freeze({ id: 'test', label: 'Service tested on site' }),
      Object.freeze({ id: 'briefing', label: 'Customer briefed' }),
    ]),
  }),
]);

/** Normalize one template, or null when half-formed. */
export function normalizeJobChecklistTemplate(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const jobType = cleanText(raw.jobType);
  if (!jobType) return null;
  if (!Array.isArray(raw.items) || raw.items.length === 0) return null;
  const seen = new Set();
  const items = [];
  for (const item of raw.items) {
    if (!item || typeof item !== 'object') return null;
    const id = cleanText(item.id);
    const label = cleanText(item.label);
    if (!id || !label || seen.has(id)) return null;
    seen.add(id);
    items.push({ id, label });
  }
  return { jobType, items };
}

/** Normalize custom templates: drop half-formed rows, first job type wins. */
export function normalizeJobChecklistTemplateList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const template = normalizeJobChecklistTemplate(raw);
    if (!template || seen.has(template.jobType)) continue;
    seen.add(template.jobType);
    out.push(template);
  }
  return out;
}

/** Built-ins plus stored custom templates, first job type wins. */
export function jobChecklistTemplatesWithDefaults(stored) {
  const customs = normalizeJobChecklistTemplateList(stored);
  const seen = new Set();
  const out = [];
  for (const template of [...JOB_CHECKLIST_DEFAULTS, ...customs]) {
    if (seen.has(template.jobType)) continue;
    seen.add(template.jobType);
    out.push({ jobType: template.jobType, items: template.items.map((item) => ({ ...item })) });
  }
  return out;
}

export function findJobChecklistTemplate(templates, jobType) {
  const clean = cleanText(jobType);
  if (!clean) return null;
  return jobChecklistTemplatesWithDefaults(templates)
    .find((template) => template.jobType === clean) || null;
}

/**
 * Add a custom template. Returns a new custom list, or the input
 * unchanged when the template is half-formed or its job type
 * already has a template (built-in or custom).
 */
export function upsertJobChecklistTemplate(stored, raw) {
  const clean = normalizeJobChecklistTemplateList(stored);
  const template = normalizeJobChecklistTemplate(raw);
  if (!template) return clean;
  if (jobChecklistTemplatesWithDefaults(clean).some((item) => item.jobType === template.jobType)) return clean;
  return [...clean, template];
}

/** Remove a custom template. Built-ins cannot be removed. */
export function removeJobChecklistTemplate(stored, jobType) {
  const clean = cleanText(jobType);
  if (!clean) return normalizeJobChecklistTemplateList(stored);
  return normalizeJobChecklistTemplateList(stored)
    .filter((template) => template.jobType !== clean);
}

function normalizeTick(tick, template) {
  if (!tick || typeof tick !== 'object') return null;
  const item = cleanText(tick.item);
  if (!template.items.some((entry) => entry.id === item)) return null;
  return {
    item,
    by: cleanText(tick.by),
    date: tick.date === undefined || tick.date === '' ? null : validJobChecklistDate(tick.date),
  };
}

/** Normalize one visit record, or null when half-formed. */
export function normalizeJobChecklistVisit(raw, templates) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const jobType = cleanText(raw.jobType);
  const visit = cleanText(raw.visit);
  const date = validJobChecklistDate(raw.date);
  if (!id || !jobType || !visit || !date) return null;
  const template = findJobChecklistTemplate(templates, jobType);
  if (!template) return null;
  const seen = new Set();
  const ticks = [];
  if (Array.isArray(raw.ticks)) {
    for (const tick of raw.ticks) {
      const clean = normalizeTick(tick, template);
      if (!clean || seen.has(clean.item)) continue;
      seen.add(clean.item);
      ticks.push(clean);
    }
  }
  return { id, jobType, visit, date, ticks };
}

/** Normalize visits: drop half-formed rows and duplicate ids (first wins). */
export function normalizeJobChecklistVisitList(list, templates) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const record = normalizeJobChecklistVisit(raw, templates);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

export function findJobChecklistVisit(list, id, templates) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeJobChecklistVisitList(list, templates)
    .find((item) => item.id === clean) || null;
}

/**
 * Insert a visit record. Returns a new list, or the input
 * unchanged when the record is half-formed, names a job type
 * with no template, or repeats an id.
 */
export function upsertJobChecklistVisit(list, raw, templates) {
  const clean = normalizeJobChecklistVisitList(list, templates);
  const record = normalizeJobChecklistVisit(raw, templates);
  if (!record) return clean;
  if (clean.some((item) => item.id === record.id)) return clean;
  return [...clean, record];
}

export function removeJobChecklistVisit(list, id, templates) {
  const clean = cleanText(id);
  if (!clean) return normalizeJobChecklistVisitList(list, templates);
  return normalizeJobChecklistVisitList(list, templates)
    .filter((item) => item.id !== clean);
}

/**
 * Tick one item on a visit. Returns a new list, or the input
 * unchanged for an unknown visit, an item the template does
 * not have, or an item already ticked.
 */
export function tickJobChecklistVisit(list, id, item, by, date, templates) {
  const clean = normalizeJobChecklistVisitList(list, templates);
  const target = cleanText(id);
  const itemId = cleanText(item);
  let changed = false;
  const next = clean.map((record) => {
    if (record.id !== target) return record;
    const template = findJobChecklistTemplate(templates, record.jobType);
    const tick = normalizeTick({ item: itemId, by, date }, template);
    if (!tick || record.ticks.some((entry) => entry.item === itemId)) return record;
    changed = true;
    return { ...record, ticks: [...record.ticks, tick] };
  });
  return changed ? next : clean;
}

/** Untick one item on a visit. Unknown visits and items leave the list unchanged. */
export function untickJobChecklistVisit(list, id, item, templates) {
  const clean = normalizeJobChecklistVisitList(list, templates);
  const target = cleanText(id);
  const itemId = cleanText(item);
  let changed = false;
  const next = clean.map((record) => {
    if (record.id !== target) return record;
    if (!record.ticks.some((entry) => entry.item === itemId)) return record;
    changed = true;
    return { ...record, ticks: record.ticks.filter((entry) => entry.item !== itemId) };
  });
  return changed ? next : clean;
}

/**
 * A visit's checklist view: every template item in template
 * order, each marked ticked or unticked, with the tick's by
 * and date where recorded. Returns null for an unknown visit
 * or a job type with no template.
 */
export function jobChecklistView(visit, templates) {
  const record = normalizeJobChecklistVisit(visit, templates);
  if (!record) return null;
  const template = findJobChecklistTemplate(templates, record.jobType);
  const byItem = new Map(record.ticks.map((tick) => [tick.item, tick]));
  const items = template.items.map((entry) => {
    const tick = byItem.get(entry.id);
    return {
      id: entry.id,
      label: entry.label,
      ticked: Boolean(tick),
      by: tick ? tick.by : '',
      date: tick ? tick.date : null,
    };
  });
  const ticked = items.filter((entry) => entry.ticked).length;
  return {
    id: record.id,
    jobType: record.jobType,
    visit: record.visit,
    date: record.date,
    items,
    ticked,
    total: items.length,
    complete: ticked === items.length,
  };
}

/** Incomplete visits, flagged not hidden: oldest date first, then id A-Z. */
export function incompleteJobChecklists(list, templates) {
  return normalizeJobChecklistVisitList(list, templates)
    .map((record) => jobChecklistView(record, templates))
    .filter((view) => view && !view.complete)
    .sort((a, b) => {
      if (a.date !== b.date) return compareText(a.date, b.date);
      return compareText(a.id, b.id);
    });
}

export function jobChecklistSummaryText(list, templates) {
  const clean = normalizeJobChecklistVisitList(list, templates);
  const complete = clean.filter((record) => jobChecklistView(record, templates).complete).length;
  return `${clean.length} visit checklist${clean.length === 1 ? '' : 's'}, `
    + `${complete} complete, ${clean.length - complete} incomplete — flagged, not hidden`;
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function viewHtml(view) {
  const rows = view.items.map((entry) => {
    const mark = entry.ticked ? '☑' : '☐';
    const detail = entry.ticked
      ? ` — ticked${entry.by ? ` by ${esc(entry.by)}` : ''}${entry.date ? ` on ${esc(entry.date)}` : ''}`
      : ' — not ticked';
    return `<li>${mark} ${esc(entry.label)}${detail}</li>`;
  }).join('');
  const flag = view.complete
    ? '<p>Complete.</p>'
    : `<p><strong>INCOMPLETE — ${view.total - view.ticked} of ${view.total} items still unticked.</strong></p>`;
  return `<div><h4>${esc(view.visit)} — ${esc(view.jobType)} (${esc(view.date)})</h4>`
    + `<p>${view.ticked} of ${view.total} items ticked.</p>${flag}<ul>${rows}</ul></div>`;
}

/** Visit views as HTML, optionally filtered to one job type (blank shows all). */
export function jobChecklistHtml(list, templates, jobTypeFilter) {
  const filter = cleanText(jobTypeFilter);
  const views = normalizeJobChecklistVisitList(list, templates)
    .map((record) => jobChecklistView(record, templates))
    .filter((view) => view && (!filter || view.jobType === filter));
  if (views.length === 0) return '<p>No visit checklist recorded yet. A visit shows its job-type checklist with ticked and unticked items.</p>';
  return views.map(viewHtml).join('');
}

/** Incomplete visits only, flagged plainly. */
export function jobChecklistIncompleteHtml(list, templates) {
  const views = incompleteJobChecklists(list, templates);
  if (views.length === 0) return '<p>No incomplete checklist. Every recorded visit has all its items ticked.</p>';
  return views.map((view) => `<p><strong>INCOMPLETE:</strong> ${esc(view.visit)} — ${esc(view.jobType)} `
    + `(${esc(view.date)}): ${view.ticked} of ${view.total} items ticked.</p>`).join('');
}

/** Templates as HTML, each with its ordered items. */
export function jobChecklistTemplatesHtml(templates) {
  const all = jobChecklistTemplatesWithDefaults(templates);
  return all.map((template) => {
    const items = template.items.map((entry) => `<li>${esc(entry.label)}</li>`).join('');
    return `<div><h4>${esc(template.jobType)}</h4><ol>${items}</ol></div>`;
  }).join('');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function jobChecklistCsv(list, templates) {
  const rows = normalizeJobChecklistVisitList(list, templates);
  const lines = ['id,jobType,visit,date,tickedItems,totalItems,complete'];
  for (const record of rows) {
    const view = jobChecklistView(record, templates);
    lines.push([record.id, record.jobType, record.visit, record.date,
      record.ticks.map((tick) => tick.item).join(';'), view.total,
      view.complete ? 'yes' : 'no'].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function jobChecklistFilename() {
  return 'job-checklists.csv';
}
