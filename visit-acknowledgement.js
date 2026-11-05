// Plan 257 (Plan 203-350) — Field visit customer signature note.
//
// A customer later disputes that a visit happened or that work was
// agreed, and there is no record that the customer acknowledged the
// visit at the time. This module adds only the missing piece: one
// acknowledgement note per visit — the visit reference, the customer,
// the date, whether acknowledgement was recorded yes or no, and a
// note of what was acknowledged in plain words.
//
// What this module is NOT, stated plainly:
//   - It is not a signature image and never a legal paper. It
//     records only that the customer acknowledged the visit, in
//     plain words. No image, no signature file, and no legal
//     wording is stored anywhere here.
//   - It is not the Plan 162 feedback after a visit, which records
//     how satisfied the customer was after the visit. That record
//     is neither read nor rewritten here, and this module imports
//     nothing. Acknowledgement is about what was agreed at the
//     door, not about satisfaction afterwards.
//   - It is not the Plan 140 second visit rule, which governs
//     unresolved tickets with a due date and an outcome. That rule
//     is neither read nor rewritten here. An acknowledgement note
//     never names a ticket and never changes a ticket, a visit,
//     a bill, a payment, or a customer status.
//   - A note is never edited, only annotated. There is no edit
//     function: only record, annotate, and remove. A dated
//     follow-up never rewrites the visit reference, the customer,
//     the date, the acknowledgement, or the note of what was
//     acknowledged.
//   - One note per visit: a second note for the same visit
//     reference is refused, so a visit never shows two different
//     acknowledgement statuses.
//   - Visits without acknowledgement are listed as exceptions:
//     a visit with no note at all, or a note that says no,
//     appears in the exceptions list. The list is built from the
//     visit references the caller supplies, so it can never
//     disagree with the visits it was checked against.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

export const VISIT_ACKNOWLEDGEMENT_STORE = 'shahdara_visit_acknowledgements_v1';
export const VISIT_ACKNOWLEDGEMENT_FILENAME = 'visit-acknowledgements.csv';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validVisitAcknowledgementDate(value) {
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

function cleanAcknowledged(raw) {
  if (raw === true) return true;
  if (raw === false) return false;
  if (typeof raw === 'string') {
    const value = raw.trim().toLowerCase();
    if (value === 'yes') return true;
    if (value === 'no') return false;
  }
  return null;
}

function cleanFollowup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = text(raw.date);
  const note = text(raw.note);
  if (!validVisitAcknowledgementDate(date) || !note) return null;
  return { date, note };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const visitRef = text(raw.visitRef);
  const customer = text(raw.customer);
  const date = text(raw.date);
  const note = text(raw.note);
  if (!id || !visitRef || !customer || !note) return null;
  if (!validVisitAcknowledgementDate(date)) return null;
  const acknowledged = cleanAcknowledged(raw.acknowledged);
  if (acknowledged === null) return null;
  const followups = Array.isArray(raw.followups)
    ? raw.followups.map(cleanFollowup).filter(Boolean)
    : [];
  return { id, visitRef, customer, date, acknowledged, note, followups };
}

export function normalizeVisitAcknowledgementList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenVisitRefs = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    const key = entry.visitRef.toLowerCase();
    if (seenVisitRefs.has(key)) continue;
    seenIds.add(entry.id);
    seenVisitRefs.add(key);
    out.push(entry);
  }
  return out;
}

export function recordVisitAcknowledgement(list, raw) {
  const clean = normalizeVisitAcknowledgementList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  if (clean.some((item) => item.visitRef.toLowerCase() === entry.visitRef.toLowerCase())) return clean;
  return [...clean, entry];
}

export function removeVisitAcknowledgement(list, id) {
  const clean = normalizeVisitAcknowledgementList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findVisitAcknowledgement(list, id) {
  const clean = normalizeVisitAcknowledgementList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addVisitAcknowledgementFollowup(list, id, date, note) {
  const clean = normalizeVisitAcknowledgementList(list);
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
  if (a.visitRef !== b.visitRef) return a.visitRef < b.visitRef ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function visitAcknowledgementSorted(list) {
  return normalizeVisitAcknowledgementList(list).sort(compareEntries);
}

export function visitAcknowledgementsForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return visitAcknowledgementSorted(list).filter((item) => item.customer.toLowerCase() === wanted);
}

export function visitAcknowledgementCustomers(list) {
  const seen = new Set();
  const out = [];
  for (const item of visitAcknowledgementSorted(list)) {
    const key = item.customer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.customer);
  }
  return out;
}

export function visitAcknowledgementStatus(list, visitRef) {
  const wanted = text(visitRef);
  if (!wanted) return null;
  const clean = normalizeVisitAcknowledgementList(list);
  const found = clean.find((item) => item.visitRef.toLowerCase() === wanted.toLowerCase());
  if (!found) return { visitRef: wanted, status: 'no note recorded' };
  return { visitRef: found.visitRef, status: found.acknowledged ? 'acknowledged' : 'not acknowledged' };
}

// Visits without acknowledgement, checked against the visit
// references the caller supplies as plain text. A visit appears
// here when it has no note at all, or when its note says no.
// Blank references are dropped and duplicates are listed once,
// keeping the first spelling.
export function visitsWithoutAcknowledgement(list, visitRefs) {
  if (!Array.isArray(visitRefs)) return [];
  const clean = normalizeVisitAcknowledgementList(list);
  const seen = new Set();
  const out = [];
  for (const raw of visitRefs) {
    const visitRef = text(raw);
    if (!visitRef) continue;
    const key = visitRef.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const found = clean.find((item) => item.visitRef.toLowerCase() === key);
    if (!found) {
      out.push({ visitRef, status: 'no note recorded' });
    } else if (!found.acknowledged) {
      out.push({ visitRef: found.visitRef, status: 'not acknowledged' });
    }
  }
  return out;
}

export function visitAcknowledgementSummaryText(list) {
  const clean = normalizeVisitAcknowledgementList(list);
  if (!clean.length) return 'No visit acknowledgement notes recorded.';
  const yes = clean.filter((item) => item.acknowledged).length;
  const no = clean.length - yes;
  return `${clean.length} visit acknowledgement note${clean.length === 1 ? '' : 's'}: ${yes} acknowledged, ${no} not acknowledged.`;
}

export function visitAcknowledgementText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No visit acknowledgement note recorded.';
  const notes = clean.followups.length
    ? ` Follow-ups: ${clean.followups.map((f) => `${f.date}: ${f.note}`).join('; ')}`
    : '';
  return `Visit ${clean.visitRef} (${clean.customer}, ${clean.date}): ${clean.acknowledged ? 'acknowledged' : 'not acknowledged'} — ${clean.note.replace(/\.+$/, '')}.${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function visitAcknowledgementHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No visit acknowledgement note recorded.</p>';
  const notes = clean.followups.length
    ? `<br>Follow-ups: ${escapeHtml(clean.followups.map((f) => `${f.date}: ${f.note}`).join('; '))}`
    : '';
  return `<p>Visit <strong>${escapeHtml(clean.visitRef)}</strong> (${escapeHtml(clean.customer)}, ${escapeHtml(clean.date)}): ${clean.acknowledged ? 'acknowledged' : 'not acknowledged'} — ${escapeHtml(clean.note.replace(/\.+$/, ''))}.${notes}</p>`;
}

export function visitAcknowledgementAllHtml(list) {
  const sorted = visitAcknowledgementSorted(list);
  if (!sorted.length) return '<p>No visit acknowledgement notes recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(visitAcknowledgementText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function visitAcknowledgementCsv(list) {
  const sorted = visitAcknowledgementSorted(list);
  const header = ['id', 'visit reference', 'customer', 'date', 'acknowledged', 'note', 'follow-ups'];
  const rows = sorted.map((item) => [
    item.id,
    item.visitRef,
    item.customer,
    item.date,
    item.acknowledged ? 'yes' : 'no',
    item.note,
    item.followups.map((f) => `${f.date}: ${f.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function visitAcknowledgementFilename() {
  return 'visit-acknowledgements.csv';
}
