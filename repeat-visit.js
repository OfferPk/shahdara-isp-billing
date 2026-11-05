// Plan 256 (Plan 203-350) — Repeat-visit customer note.
//
// Some customers need visit after visit, but each visit is treated
// as new, so nobody steps back and asks why this customer keeps
// needing help. This module adds only the missing piece: one note
// per customer flagged for repeat visits — the customer, the visits
// counted in the period, the reasons seen, the suggested next step
// in plain words, and the date noted. It is a note on the customer,
// not a rule: it sets no due date, closes nothing, and changes
// nothing by itself.
//
// The fences, stated plainly:
//   - This is not the Plan 140 rule for unresolved tickets, which
//     governs unresolved tickets with a due date and an outcome.
//     That rule is neither read nor rewritten here, and this module
//     imports nothing. A repeat-visit note never names a ticket
//     and never changes a ticket, a visit, a bill, a payment, or a
//     customer status.
//   - It is not the Plan 240 pattern view per segment, which counts
//     repeat faults per segment. That view is neither read nor
//     rewritten here. This note is per customer, not per segment.
//   - A note is never edited, only followed by a dated update.
//     There is no edit function: only record, follow up, and
//     remove. A follow-up never rewrites the customer, the period,
//     the visits counted, the reasons seen, the suggested next
//     step, or the date noted.
//   - One note per customer per period: a second note for the same
//     customer in the same period is refused, so a customer never
//     shows two different counts for one period. A later period
//     gets its own note.
//   - The flagged-customers list is counted from the visit records
//     the caller supplies for the same period, so a count can never
//     disagree with the records it was counted from. A customer
//     with fewer than two visits in the period is not flagged:
//     one visit is not a repeat visit.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

export const REPEAT_VISIT_STORE = 'shahdara_repeat_visit_notes_v1';
export const REPEAT_VISIT_FILENAME = 'repeat-visit-notes.csv';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validRepeatVisitDate(value) {
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
  if (!validRepeatVisitDate(date) || !note) return null;
  return { date, note };
}

function cleanReasons(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    const reason = text(item);
    if (reason) out.push(reason);
  }
  return out;
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customer = text(raw.customer);
  const periodFrom = text(raw.periodFrom);
  const periodTo = text(raw.periodTo);
  const nextStep = text(raw.nextStep);
  const dateNoted = text(raw.dateNoted);
  if (!id || !customer || !nextStep) return null;
  if (!validRepeatVisitDate(periodFrom)) return null;
  if (!validRepeatVisitDate(periodTo)) return null;
  if (periodFrom > periodTo) return null;
  if (!validRepeatVisitDate(dateNoted)) return null;
  const visitsCounted = raw.visitsCounted;
  if (!Number.isInteger(visitsCounted) || visitsCounted < 2) return null;
  const reasons = cleanReasons(raw.reasons);
  if (!reasons.length) return null;
  const followups = Array.isArray(raw.followups)
    ? raw.followups.map(cleanFollowup).filter(Boolean)
    : [];
  return { id, customer, periodFrom, periodTo, visitsCounted, reasons, nextStep, dateNoted, followups };
}

export function normalizeRepeatVisitList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenCustomerPeriods = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    const key = `${entry.customer.toLowerCase()}|${entry.periodFrom}|${entry.periodTo}`;
    if (seenCustomerPeriods.has(key)) continue;
    seenIds.add(entry.id);
    seenCustomerPeriods.add(key);
    out.push(entry);
  }
  return out;
}

export function recordRepeatVisitNote(list, raw) {
  const clean = normalizeRepeatVisitList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  if (clean.some(
    (item) => item.customer.toLowerCase() === entry.customer.toLowerCase()
      && item.periodFrom === entry.periodFrom
      && item.periodTo === entry.periodTo,
  )) return clean;
  return [...clean, entry];
}

export function removeRepeatVisitNote(list, id) {
  const clean = normalizeRepeatVisitList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findRepeatVisitNote(list, id) {
  const clean = normalizeRepeatVisitList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addRepeatVisitFollowup(list, id, date, note) {
  const clean = normalizeRepeatVisitList(list);
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
  if (a.dateNoted !== b.dateNoted) return a.dateNoted < b.dateNoted ? -1 : 1;
  if (a.customer !== b.customer) return a.customer < b.customer ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function repeatVisitSorted(list) {
  return normalizeRepeatVisitList(list).sort(compareEntries);
}

export function repeatVisitNotesForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return repeatVisitSorted(list).filter((item) => item.customer.toLowerCase() === wanted);
}

export function repeatVisitCustomers(list) {
  const seen = new Set();
  const out = [];
  for (const item of repeatVisitSorted(list)) {
    const key = item.customer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.customer);
  }
  return out;
}

// A visit row the caller supplies: a customer and a date, as plain
// text. Bad rows are dropped, so a count can never be inflated by
// a row that is not a real visit.
function cleanVisitRow(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const customer = text(raw.customer);
  const date = text(raw.date);
  if (!customer || !validRepeatVisitDate(date)) return null;
  return { customer, date };
}

// Counts per customer in the inclusive period, counted from the
// same visit rows the caller supplies. A customer with no visit in
// the period does not appear at all.
export function repeatVisitCountsForPeriod(visitRows, periodFrom, periodTo) {
  if (!Array.isArray(visitRows)) return [];
  if (!validRepeatVisitDate(periodFrom) || !validRepeatVisitDate(periodTo)) return [];
  if (periodFrom > periodTo) return [];
  const counts = new Map();
  for (const raw of visitRows) {
    const row = cleanVisitRow(raw);
    if (!row) continue;
    if (row.date < periodFrom || row.date > periodTo) continue;
    const key = row.customer.toLowerCase();
    const found = counts.get(key);
    if (found) {
      found.count += 1;
    } else {
      counts.set(key, { customer: row.customer, count: 1 });
    }
  }
  return [...counts.values()];
}

// Flagged customers: those with at least `threshold` visits in the
// period (two by default — one visit is not a repeat visit).
// Most visits first, then customer A-Z, first spelling kept. The
// count shown is the count of the visit records themselves, so it
// always matches the records for the same period.
export function flaggedRepeatVisitCustomers(visitRows, periodFrom, periodTo, threshold = 2) {
  const wanted = Number.isInteger(threshold) && threshold > 0 ? threshold : 2;
  const counts = repeatVisitCountsForPeriod(visitRows, periodFrom, periodTo)
    .filter((item) => item.count >= wanted);
  counts.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    if (a.customer !== b.customer) return a.customer < b.customer ? -1 : 1;
    return 0;
  });
  return counts;
}

export function repeatVisitSummaryText(list) {
  const clean = normalizeRepeatVisitList(list);
  const customers = repeatVisitCustomers(list).length;
  if (!clean.length) return 'No repeat-visit customer notes recorded.';
  return `${clean.length} repeat-visit note${clean.length === 1 ? '' : 's'} across ${customers} customer${customers === 1 ? '' : 's'}.`;
}

export function repeatVisitText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No repeat-visit customer note recorded.';
  const notes = clean.followups.length
    ? ` Follow-ups: ${clean.followups.map((f) => `${f.date}: ${f.note}`).join('; ')}`
    : '';
  return `Customer ${clean.customer}: ${clean.visitsCounted} visits from ${clean.periodFrom} to ${clean.periodTo}. Reasons seen: ${clean.reasons.join('; ')}. Suggested next step: ${clean.nextStep.replace(/\.+$/, '')}. Noted ${clean.dateNoted}.${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function repeatVisitHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No repeat-visit customer note recorded.</p>';
  const notes = clean.followups.length
    ? `<br>Follow-ups: ${escapeHtml(clean.followups.map((f) => `${f.date}: ${f.note}`).join('; '))}`
    : '';
  return `<p>Customer <strong>${escapeHtml(clean.customer)}</strong>: ${clean.visitsCounted} visits from ${escapeHtml(clean.periodFrom)} to ${escapeHtml(clean.periodTo)}. Reasons seen: ${escapeHtml(clean.reasons.join('; '))}. Suggested next step: ${escapeHtml(clean.nextStep.replace(/\.+$/, ''))}. Noted ${escapeHtml(clean.dateNoted)}.${notes}</p>`;
}

export function repeatVisitAllHtml(list) {
  const sorted = repeatVisitSorted(list);
  if (!sorted.length) return '<p>No repeat-visit customer notes recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(repeatVisitText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function repeatVisitCsv(list) {
  const sorted = repeatVisitSorted(list);
  const header = ['id', 'customer', 'period from', 'period to', 'visits counted', 'reasons seen', 'suggested next step', 'date noted', 'follow-ups'];
  const rows = sorted.map((item) => [
    item.id,
    item.customer,
    item.periodFrom,
    item.periodTo,
    item.visitsCounted,
    item.reasons.join('; '),
    item.nextStep,
    item.dateNoted,
    item.followups.map((f) => `${f.date}: ${f.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function repeatVisitFilename() {
  return 'repeat-visit-notes.csv';
}
