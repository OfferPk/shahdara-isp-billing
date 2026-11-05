// Plan 290 (Plan 203-350) — Shop opening and closing checklist.
//
// Opening and closing the shop relies on memory, so a missed step
// (a shutter, a device, a cash check) is found only after
// something goes wrong. This module adds only the missing piece:
// one checklist step per record — the date, the shift (opening
// or closing), the step in plain words, whether it was done, who
// did it, and, when a step involves a key, the key id only. Each
// day shows its opening and closing checklists with done and
// missed steps visible, so a hurried opening or closing still
// leaves a checkable record.
//
// What this module is NOT, stated plainly:
//   - It is not a bill, payment, stock, or access change.
//     Completing a checklist never changes any bill, payment,
//     stock, or access record by itself; it only records that a
//     step was done, by whom, and when.
//   - It is not the keys and access register. A step that
//     involves a key names the key id only; the register itself
//     is neither read nor rewritten here, and no key is issued,
//     returned, or reassigned by this module.
//   - It is not a live record. A past checklist step is
//     read-only: there is no edit function, only record, find,
//     and remove, so a wrong step is removed and recorded again.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     step, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - A step with no id, no strict date, no shift, or no step
//     is refused outright. Unknown fields are dropped, so a step
//     can never grow a bill, payment, stock, or access field.
//   - A duplicate id is never rewritten.
//   - Done folds from plain spellings, and a step with no
//     done-by name reads as not done yet, because nobody has
//     claimed it.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validShopChecklistDate(value) {
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
 * Shift in plain words: 'opening' or 'open' read as opening,
 * 'closing' or 'close' read as closing, anything else is not a
 * shift at all.
 */
export function foldShopChecklistShift(value) {
  const raw = text(value).toLowerCase();
  if (raw === 'opening' || raw === 'open') return 'opening';
  if (raw === 'closing' || raw === 'close') return 'closing';
  return null;
}

/** Done folds from plain spellings; anything else reads as not done. */
export function foldShopChecklistDone(value) {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  const raw = text(value).toLowerCase();
  return raw === 'yes' || raw === 'true' || raw === 'done' || raw === 'checked' || raw === 'x' || raw === '1';
}

/**
 * One shop checklist step, or null when half-formed. A step needs
 * an id, a strict date, a shift, and a step in plain words. Done
 * defaults to not done, done-by and the key id are optional, and
 * unknown fields are dropped; the input is never mutated.
 */
export function normalizeShopChecklistStep(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const date = text(raw.date);
  const shift = foldShopChecklistShift(raw.shift);
  const step = text(raw.step);
  if (!id || !shift || !step) return null;
  if (!validShopChecklistDate(date)) return null;
  return {
    id,
    date,
    shift,
    step,
    done: foldShopChecklistDone(raw.done),
    doneBy: text(raw.doneBy),
    keyId: text(raw.keyId),
  };
}

/** Normalised steps only; a duplicate id is never rewritten, the first stays. */
export function normalizeShopChecklist(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeShopChecklistStep(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findShopChecklistStep(list, id) {
  const clean = normalizeShopChecklist(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((entry) => entry.id === wanted) ?? null;
}

export function recordShopChecklistStep(list, raw) {
  const clean = normalizeShopChecklist(list);
  const entry = normalizeShopChecklistStep(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeShopChecklistStep(list, id) {
  const clean = normalizeShopChecklist(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

function shiftOrder(shift) {
  return shift === 'opening' ? 0 : 1;
}

/** Steps in date order, opening before closing, then step A-Z, then id, so the same list always reads the same way. */
export function shopChecklistSorted(list) {
  const clean = normalizeShopChecklist(list);
  return [...clean].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.shift !== b.shift) return shiftOrder(a.shift) - shiftOrder(b.shift);
    const aStep = a.step.toLowerCase();
    const bStep = b.step.toLowerCase();
    if (aStep !== bStep) return aStep < bStep ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * One day's checklists: the opening steps and the closing steps,
 * each in step order, with done and missed steps both visible.
 * Returns null for a date that is not a real calendar date.
 */
export function shopChecklistForDay(list, date) {
  if (!validShopChecklistDate(date)) return null;
  const rows = shopChecklistSorted(list).filter((entry) => entry.date === date);
  return {
    date,
    opening: rows.filter((entry) => entry.shift === 'opening'),
    closing: rows.filter((entry) => entry.shift === 'closing'),
  };
}

/** Missed steps for one day, in step order; pass a shift to narrow it to opening or closing only. */
export function shopChecklistMissedSteps(list, date, shift) {
  const day = shopChecklistForDay(list, date);
  if (!day) return [];
  const wanted = foldShopChecklistShift(shift);
  const rows = wanted ? day[wanted] : [...day.opening, ...day.closing];
  return rows.filter((entry) => !entry.done);
}

/** Plain checked count for one day, e.g. "2 of 3 steps done". */
export function shopChecklistDaySummaryText(list, date) {
  const day = shopChecklistForDay(list, date);
  if (!day) return 'No checklist steps recorded for this day.';
  const rows = [...day.opening, ...day.closing];
  if (!rows.length) return `No checklist steps recorded for ${date}.`;
  const done = rows.filter((entry) => entry.done).length;
  const openingDone = day.opening.filter((entry) => entry.done).length;
  const closingDone = day.closing.filter((entry) => entry.done).length;
  return `${date}: opening ${openingDone} of ${day.opening.length} steps done, closing ${closingDone} of ${day.closing.length} steps done — ${done} of ${rows.length} steps done in total.`;
}

export function shopChecklistSummaryText(list) {
  const clean = normalizeShopChecklist(list);
  if (clean.length === 0) return 'No shop checklist steps recorded.';
  const word = clean.length === 1 ? 'step' : 'steps';
  const latest = shopChecklistSorted(clean).at(-1);
  return `${clean.length} shop checklist ${word} recorded. Latest day: ${latest.date}.`;
}

/** Plain-words text for one step: its shift, its step, and who did it — or that it is still missed. */
export function shopChecklistStepText(entry) {
  const clean = normalizeShopChecklistStep(entry);
  if (!clean) return 'No shop checklist step recorded.';
  const done = clean.done
    ? `done${clean.doneBy ? ` by ${clean.doneBy}` : ''}`
    : 'not done yet';
  const key = clean.keyId ? ` — key ${clean.keyId}` : '';
  return `${clean.date} ${clean.shift} — ${clean.step} — ${done}${key}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function shopChecklistStepHtml(entry) {
  const clean = normalizeShopChecklistStep(entry);
  if (!clean) return '<p>No shop checklist step recorded.</p>';
  return `<p>${escapeHtml(shopChecklistStepText(clean))}</p>`;
}

export function shopChecklistDayHtml(list, date) {
  const day = shopChecklistForDay(list, date);
  if (!day) return '<p>No checklist steps recorded for this day.</p>';
  const rows = [...day.opening, ...day.closing];
  if (!rows.length) return `<p>No checklist steps recorded for ${escapeHtml(date)}.</p>`;
  const opening = day.opening.length
    ? `<h5>Opening</h5><ul>${day.opening.map((entry) => `<li>${escapeHtml(shopChecklistStepText(entry))}</li>`).join('')}</ul>`
    : '<h5>Opening</h5><p>No opening steps recorded.</p>';
  const closing = day.closing.length
    ? `<h5>Closing</h5><ul>${day.closing.map((entry) => `<li>${escapeHtml(shopChecklistStepText(entry))}</li>`).join('')}</ul>`
    : '<h5>Closing</h5><p>No closing steps recorded.</p>';
  return `<p>${escapeHtml(shopChecklistDaySummaryText(list, date))}</p>${opening}${closing}`;
}

export function shopChecklistAllHtml(list) {
  const rows = shopChecklistSorted(list);
  if (!rows.length) return '<p>No shop checklist steps recorded.</p>';
  return `<ul>${rows.map((entry) => `<li>${escapeHtml(shopChecklistStepText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function shopChecklistCsv(list) {
  const rows = shopChecklistSorted(list);
  const lines = ['"id","date","shift","step","done","done by","key id"'];
  for (const entry of rows) {
    lines.push([
      csvCell(entry.id),
      csvCell(entry.date),
      csvCell(entry.shift),
      csvCell(entry.step),
      csvCell(entry.done ? 'done' : 'not done'),
      csvCell(entry.doneBy),
      csvCell(entry.keyId),
    ].join(','));
  }
  return lines.join('\n');
}

export function shopChecklistFilename() {
  return 'shop-checklists.csv';
}
