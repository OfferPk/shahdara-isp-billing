// Plan 253 (Plan 203-350) — Material return-to-shop log.
//
// Unused material comes back from jobs but is never logged, so the
// shop record says it is still out in the field while it is actually
// back on the shelf. This module adds only the missing piece: one
// log entry per return — the job reference, the item, the quantity
// returned, a condition note, the date returned, and who received it.
//
// The fences, stated plainly:
//   - This is not the stock register (Plan 51), which holds stock
//     totals; not the fault parts-used log (Plan 132), which records
//     parts used on a fault; not the reorder flow (Plan 136), which
//     decides what to buy next; not the per-job drum usage log
//     (Plan 239), which records what a job used; and not the
//     supplier warranty return log (Plan 80), which tracks faulty
//     units sent back to a supplier. None of those modules is read
//     or rewritten here, and this module imports nothing.
//   - Returned quantities are shown separately from issued
//     quantities so the two reconcile, checked by
//     materialReturnReconciliation on the same fixture: returned
//     can never exceed issued, and the amount still out is issued
//     minus returned. Recording a return never changes any bill,
//     payment, customer, or stock total by itself: the module takes
//     no bill, payment, customer, or stock object in, edits none,
//     and returns none. Job references, item names, and people
//     arrive as plain text.
//   - An entry is never edited, only corrected by a dated
//     follow-up note. There is no edit function: only record,
//     follow up, and remove. A follow-up never rewrites the job
//     reference, the item, the quantity returned, the condition
//     note, the date returned, or who received it.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

export const MATERIAL_RETURN_STORE = 'shahdara_material_returns_v1';
export const MATERIAL_RETURN_FILENAME = 'material-returns.csv';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validMaterialReturnDate(value) {
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
  if (!validMaterialReturnDate(date) || !note) return null;
  return { date, note };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const jobRef = text(raw.jobRef);
  const item = text(raw.item);
  const condition = text(raw.condition);
  const date = text(raw.dateReturned);
  const receivedBy = text(raw.receivedBy);
  const returned = quantity(raw.quantityReturned);
  if (!id || !jobRef || !item || !condition || !receivedBy) return null;
  if (!validMaterialReturnDate(date)) return null;
  if (!Number.isFinite(returned) || returned <= 0) return null;
  const followups = Array.isArray(raw.followups)
    ? raw.followups.map(cleanFollowup).filter(Boolean)
    : [];
  return { id, jobRef, item, quantityReturned: returned, condition, dateReturned: date, receivedBy, followups };
}

export function normalizeMaterialReturnList(list) {
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

export function recordMaterialReturn(list, raw) {
  const clean = normalizeMaterialReturnList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeMaterialReturn(list, id) {
  const clean = normalizeMaterialReturnList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findMaterialReturn(list, id) {
  const clean = normalizeMaterialReturnList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addMaterialReturnFollowup(list, id, date, note) {
  const clean = normalizeMaterialReturnList(list);
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
  if (a.dateReturned !== b.dateReturned) return a.dateReturned < b.dateReturned ? -1 : 1;
  if (a.jobRef !== b.jobRef) return a.jobRef < b.jobRef ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function materialReturnSorted(list) {
  return normalizeMaterialReturnList(list).sort(compareEntries);
}

export function materialReturnsForJob(list, jobRef) {
  const wanted = text(jobRef).toLowerCase();
  if (!wanted) return [];
  return materialReturnSorted(list).filter((item) => item.jobRef.toLowerCase() === wanted);
}

export function materialReturnsForItem(list, itemName) {
  const wanted = text(itemName).toLowerCase();
  if (!wanted) return [];
  return materialReturnSorted(list).filter((item) => item.item.toLowerCase().includes(wanted));
}

export function materialReturnItems(list) {
  const seen = new Set();
  const out = [];
  for (const item of materialReturnSorted(list)) {
    const key = item.item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.item);
  }
  return out;
}

export function materialReturnJobs(list) {
  const seen = new Set();
  const out = [];
  for (const item of materialReturnSorted(list)) {
    const key = item.jobRef.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.jobRef);
  }
  return out;
}

export function materialReturnTotalForItem(list, itemName) {
  return materialReturnsForItem(list, itemName)
    .reduce((sum, item) => sum + item.quantityReturned, 0);
}

export function materialReturnSummaryText(list) {
  const clean = normalizeMaterialReturnList(list);
  const items = materialReturnItems(list).length;
  if (!clean.length) return 'No material returns recorded.';
  const total = clean.reduce((sum, item) => sum + item.quantityReturned, 0);
  return `${clean.length} return ${clean.length === 1 ? 'entry' : 'entries'} across ${items} item${items === 1 ? '' : 's'}, ${total} returned in total.`;
}

// Returned quantities are shown separately from issued quantities
// so the two reconcile: the amount still out is issued minus
// returned, and returned can never exceed issued. Returns null
// when the issued figure is not a positive finite number or when
// there are no return entries.
export function materialReturnReconciliation(issuedQuantity, returnEntries) {
  const issued = quantity(issuedQuantity);
  const entries = materialReturnSorted(returnEntries);
  if (!Number.isFinite(issued) || issued <= 0 || !entries.length) return null;
  const totalReturned = entries.reduce((sum, item) => sum + item.quantityReturned, 0);
  const remainingOut = issued - totalReturned;
  const reconciles = totalReturned <= issued;
  return { issued, totalReturned, remainingOut, reconciles };
}

export function materialReturnReconciliationText(issuedQuantity, returnEntries) {
  const check = materialReturnReconciliation(issuedQuantity, returnEntries);
  if (!check) return 'No reconciliation: give a positive issued quantity and at least one return entry.';
  if (check.reconciles) {
    return `Reconciles: ${check.totalReturned} returned of ${check.issued} issued, ${check.remainingOut} still out.`;
  }
  return `Does not reconcile: ${check.totalReturned} returned but only ${check.issued} issued — ${-check.remainingOut} more than issued.`;
}

export function materialReturnText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No material return recorded.';
  const notes = clean.followups.length
    ? ` Follow-ups: ${clean.followups.map((f) => `${f.date}: ${f.note}`).join('; ')}`
    : '';
  return `Job ${clean.jobRef} returned ${clean.quantityReturned} ${clean.item} on ${clean.dateReturned} (${clean.condition}), received by ${clean.receivedBy}.${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function materialReturnHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No material return recorded.</p>';
  const notes = clean.followups.length
    ? `<br>Follow-ups: ${escapeHtml(clean.followups.map((f) => `${f.date}: ${f.note}`).join('; '))}`
    : '';
  return `<p>Job <strong>${escapeHtml(clean.jobRef)}</strong> returned ${escapeHtml(clean.quantityReturned)} ${escapeHtml(clean.item)} on ${escapeHtml(clean.dateReturned)} (${escapeHtml(clean.condition)}), received by ${escapeHtml(clean.receivedBy)}.${notes}</p>`;
}

export function materialReturnAllHtml(list) {
  const sorted = materialReturnSorted(list);
  if (!sorted.length) return '<p>No material returns recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(materialReturnText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function materialReturnCsv(list) {
  const sorted = materialReturnSorted(list);
  const header = ['id', 'job reference', 'item', 'quantity returned', 'condition', 'date returned', 'received by', 'follow-ups'];
  const rows = sorted.map((item) => [
    item.id,
    item.jobRef,
    item.item,
    item.quantityReturned,
    item.condition,
    item.dateReturned,
    item.receivedBy,
    item.followups.map((f) => `${f.date}: ${f.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function materialReturnFilename() {
  return 'material-returns.csv';
}
