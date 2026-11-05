// Plan 239 (Plan 203-350) — Cable drum and consumable usage per job.
//
// Cable and consumables leave the shop for jobs with no per-job
// record, so nobody knows how much drum cable a job actually used
// or when a drum will run out. This module adds only the missing
// piece: one usage entry per job — the job reference, the drum or
// consumable, the quantity used, the quantity remaining on the
// drum, and the date.
//
// The fences, stated plainly:
//   - This is not the stock register (Plan 51), which holds stock
//     totals; not the fault parts-used log (Plan 132), which
//     records parts used on a fault; and not the reorder flow
//     (Plan 136), which reorders spares. None of those modules is
//     read or rewritten here, and this module imports nothing.
//   - Usage entries for one drum sum to the drum's issued quantity
//     minus its remaining quantity, checked by
//     drumUsageReconciliation on the same fixture. Recording usage
//     never changes any bill, payment, customer, or stock total by
//     itself: the module takes no bill, payment, customer, or stock
//     object in, edits none, and returns none. Job references and
//     drum names arrive as plain text.
//   - An entry is never edited, only corrected by a dated
//     follow-up note. There is no edit function: only record,
//     follow up, and remove. A follow-up never rewrites the job
//     reference, the drum, the quantity used, the quantity
//     remaining, or the date.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validDrumUsageDate(value) {
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

function quantity(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
}

function cleanFollowup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = text(raw.date);
  const note = text(raw.note);
  if (!validDrumUsageDate(date) || !note) return null;
  return { date, note };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const jobRef = text(raw.jobRef);
  const drum = text(raw.drum);
  const date = text(raw.date);
  const used = quantity(raw.quantityUsed);
  const remaining = quantity(raw.quantityRemaining);
  if (!id || !jobRef || !drum || !validDrumUsageDate(date)) return null;
  if (!Number.isFinite(used) || used <= 0) return null;
  if (!Number.isFinite(remaining) || remaining < 0) return null;
  const followups = Array.isArray(raw.followups)
    ? raw.followups.map(cleanFollowup).filter(Boolean)
    : [];
  return { id, jobRef, drum, quantityUsed: used, quantityRemaining: remaining, date, followups };
}

export function normalizeDrumUsageList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function recordDrumUsage(list, raw) {
  const clean = normalizeDrumUsageList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeDrumUsage(list, id) {
  const clean = normalizeDrumUsageList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findDrumUsage(list, id) {
  const clean = normalizeDrumUsageList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addDrumUsageFollowup(list, id, date, note) {
  const clean = normalizeDrumUsageList(list);
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
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.drum !== b.drum) return a.drum < b.drum ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function drumUsageSorted(list) {
  return normalizeDrumUsageList(list).sort(compareEntries);
}

export function drumUsageForJob(list, jobRef) {
  const wanted = text(jobRef).toLowerCase();
  if (!wanted) return [];
  return drumUsageSorted(list).filter((item) => item.jobRef.toLowerCase() === wanted);
}

export function drumUsageForDrum(list, drum) {
  const wanted = text(drum).toLowerCase();
  if (!wanted) return [];
  return drumUsageSorted(list).filter((item) => item.drum.toLowerCase().includes(wanted));
}

export function drumUsageDrums(list) {
  const seen = new Set();
  const out = [];
  for (const item of drumUsageSorted(list)) {
    const key = item.drum.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.drum);
  }
  return out;
}

export function drumUsageSummaryText(list) {
  const clean = normalizeDrumUsageList(list);
  const drums = drumUsageDrums(list).length;
  if (!clean.length) return 'No drum usage recorded.';
  const total = clean.reduce((sum, item) => sum + item.quantityUsed, 0);
  return `${clean.length} usage ${clean.length === 1 ? 'entry' : 'entries'} across ${drums} drum${drums === 1 ? '' : 's'}, ${total} used in total.`;
}

// Usage entries for one drum sum to the drum's issued quantity
// minus its remaining quantity: the latest entry's remaining
// figure must equal issued minus the sum of quantities used.
// Returns null when the issued figure is not a positive finite
// number or when there are no entries for the drum.
export function drumUsageReconciliation(issuedQuantity, drumEntries) {
  const issued = quantity(issuedQuantity);
  const entries = drumUsageSorted(drumEntries);
  if (!Number.isFinite(issued) || issued <= 0 || !entries.length) return null;
  const totalUsed = entries.reduce((sum, item) => sum + item.quantityUsed, 0);
  const latestRemaining = entries[entries.length - 1].quantityRemaining;
  const expectedRemaining = issued - totalUsed;
  const reconciles = Math.abs(latestRemaining - expectedRemaining) < 0.000001;
  return { totalUsed, latestRemaining, expectedRemaining, reconciles };
}

export function drumUsageReconciliationText(issuedQuantity, drumEntries) {
  const check = drumUsageReconciliation(issuedQuantity, drumEntries);
  if (!check) return 'No reconciliation: give a positive issued quantity and at least one usage entry for the drum.';
  if (check.reconciles) {
    return `Reconciles: ${check.totalUsed} used, ${check.latestRemaining} remaining, which matches the issued quantity minus usage.`;
  }
  return `Does not reconcile: ${check.totalUsed} used, latest remaining ${check.latestRemaining}, but issued minus usage is ${check.expectedRemaining}.`;
}

export function drumUsageText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No drum usage recorded.';
  const notes = clean.followups.length
    ? ` Follow-ups: ${clean.followups.map((f) => `${f.date}: ${f.note}`).join('; ')}`
    : '';
  return `Job ${clean.jobRef} used ${clean.quantityUsed} from ${clean.drum} on ${clean.date}, leaving ${clean.quantityRemaining} on the drum.${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function drumUsageHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No drum usage recorded.</p>';
  const notes = clean.followups.length
    ? `<br>Follow-ups: ${escapeHtml(clean.followups.map((f) => `${f.date}: ${f.note}`).join('; '))}`
    : '';
  return `<p>Job <strong>${escapeHtml(clean.jobRef)}</strong> used ${escapeHtml(clean.quantityUsed)} from ${escapeHtml(clean.drum)} on ${escapeHtml(clean.date)}, leaving ${escapeHtml(clean.quantityRemaining)} on the drum.${notes}</p>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function drumUsageCsv(list) {
  const sorted = drumUsageSorted(list);
  const header = ['id', 'job reference', 'drum or consumable', 'quantity used', 'quantity remaining', 'date', 'follow-ups'];
  const rows = sorted.map((item) => [
    item.id,
    item.jobRef,
    item.drum,
    item.quantityUsed,
    item.quantityRemaining,
    item.date,
    item.followups.map((f) => `${f.date}: ${f.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function drumUsageFilename() {
  return 'drum-usage.csv';
}
