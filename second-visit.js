// Plan 140 (Plan 101-202) — Second-visit rule for unresolved tickets.
//
// An unresolved ticket drifts because no rule forces a second visit
// by a date. This module is that rule: one second-visit record per
// unresolved ticket with a ticket link, a due date for the second
// visit, and the outcome of that visit.
//
// What this module is NOT, stated plainly:
//   - It is not a ticket closer. Recording an outcome of "closed"
//     here only takes the rule off the open list; the ticket
//     itself is closed through its own flow, which this module
//     never reads and never writes. A rule never closes a ticket
//     by itself.
//   - It is not a second copy of any ticket, fault, or visit
//     record. No existing second-visit rule module was found to
//     check against: the ticket log (ticket-log.js), the visit
//     outcomes (visit-outcomes.js), and the day-part visit
//     schedule (visit-day-part.js) hold no second-visit due date
//     or outcome, and they are neither read nor written here.
//     A rule names a ticket by id only; it never changes that
//     ticket, any fault, any bill, or any payment.
//   - It is not proof that a visit happened. A due date and an
//     outcome say what the operator planned and recorded; the
//     module verifies format and ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed records are refused outright, never stored
//     half-formed: a record needs an id, a ticket link, and a
//     real calendar due date. Unknown fields are dropped, so a
//     record can never grow a ticket-status, bill, or payment
//     field.
//   - One open rule per ticket: a ticket that already has an
//     open rule (outcome not "closed") cannot gain a second
//     open rule. A ticket whose rule is closed may gain a fresh
//     rule later, because a ticket can come back.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later changes are recording an outcome and
//     removal.
//   - An outcome moves forward only: pending -> still-open /
//     missed / closed, still-open or missed -> closed. A closed
//     rule is terminal and never reopens through this module.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).
//   - The open list holds every rule whose outcome is not
//     "closed", sorted by due date, then id A-Z. The overdue
//     list is the open list filtered to due dates before the
//     reference date. A ticket closed on the second visit
//     leaves both lists at once.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validSecondVisitDate(value) {
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

const OUTCOMES = ['pending', 'still-open', 'missed', 'closed'];

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanOutcome(value) {
  const outcome = cleanText(value);
  return OUTCOMES.includes(outcome) ? outcome : 'pending';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Normalize one raw record, or null when half-formed. */
export function normalizeSecondVisit(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const ticket = cleanText(raw.ticket);
  const dueDate = validSecondVisitDate(raw.dueDate);
  if (!id || !ticket || !dueDate) return null;
  return {
    id,
    ticket,
    dueDate,
    outcome: cleanOutcome(raw.outcome),
    note: cleanText(raw.note),
  };
}

/** Normalize a list: drop half-formed rows and duplicate ids (first wins). */
export function normalizeSecondVisitList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const record = normalizeSecondVisit(raw);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

export function findSecondVisit(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeSecondVisitList(list).find((item) => item.id === clean) || null;
}

/**
 * Insert a record. Returns a new list, or the input unchanged when
 * the record is half-formed, repeats an id with different figures,
 * or would give a ticket a second open rule.
 */
export function upsertSecondVisit(list, raw) {
  const clean = normalizeSecondVisitList(list);
  const record = normalizeSecondVisit(raw);
  if (!record) return clean;
  const existing = clean.find((item) => item.id === record.id);
  if (existing) return clean;
  const openForTicket = clean.some(
    (item) => item.ticket === record.ticket && item.outcome !== 'closed',
  );
  if (openForTicket) return clean;
  return [...clean, record];
}

export function removeSecondVisit(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeSecondVisitList(list);
  return normalizeSecondVisitList(list).filter((item) => item.id !== clean);
}

const NEXT_OUTCOMES = {
  pending: ['still-open', 'missed', 'closed'],
  'still-open': ['closed'],
  missed: ['closed'],
  closed: [],
};

/**
 * Record the outcome of the second visit. Returns a new list, or
 * the input unchanged for an unknown id, an unknown outcome, or
 * a move the rule does not allow (a closed rule never reopens).
 */
export function markSecondVisitOutcome(list, id, outcome) {
  const clean = normalizeSecondVisitList(list);
  const target = cleanText(outcome);
  if (!OUTCOMES.includes(target)) return clean;
  let changed = false;
  const next = clean.map((item) => {
    if (item.id !== cleanText(id)) return item;
    if (!NEXT_OUTCOMES[item.outcome].includes(target)) return item;
    changed = true;
    return { ...item, outcome: target };
  });
  return changed ? next : clean;
}

function byDueDateThenId(a, b) {
  return a.dueDate === b.dueDate ? compareText(a.id, b.id) : compareText(a.dueDate, b.dueDate);
}

/** Open rules: outcome not "closed", sorted by due date, then id A-Z. */
export function openSecondVisits(list) {
  return normalizeSecondVisitList(list)
    .filter((item) => item.outcome !== 'closed')
    .sort(byDueDateThenId);
}

/** Overdue open rules: due date strictly before the reference date. */
export function overdueSecondVisits(list, today) {
  const ref = validSecondVisitDate(today);
  if (!ref) return [];
  return openSecondVisits(list).filter((item) => item.dueDate < ref);
}

export function secondVisitSummaryText(list) {
  const clean = normalizeSecondVisitList(list);
  const open = openSecondVisits(clean);
  return `${clean.length} second-visit rule${clean.length === 1 ? '' : 's'}, `
    + `${open.length} open`;
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function secondVisitRowHtml(item) {
  return `<tr><td>${esc(item.id)}</td><td>${esc(item.ticket)}</td>`
    + `<td>${esc(item.dueDate)}</td><td>${esc(item.outcome)}</td>`
    + `<td>${esc(item.note)}</td></tr>`;
}

function secondVisitTableHtml(rows) {
  return '<table><thead><tr><th>Id</th><th>Ticket</th><th>Due date</th>'
    + '<th>Outcome</th><th>Note</th></tr></thead><tbody>'
    + rows.map(secondVisitRowHtml).join('') + '</tbody></table>';
}

/** Open list as HTML, optionally filtered to one ticket (blank shows all). */
export function secondVisitHtml(list, ticketFilter) {
  const filter = cleanText(ticketFilter);
  const rows = openSecondVisits(list)
    .filter((item) => !filter || item.ticket === filter);
  if (rows.length === 0) return '<p>No open second visit. A ticket closed on its second visit leaves this list.</p>';
  return secondVisitTableHtml(rows);
}

/** Overdue list as HTML; an empty overdue list says so plainly. */
export function secondVisitOverdueHtml(list, today) {
  const rows = overdueSecondVisits(list, today);
  if (rows.length === 0) return '<p>No second visit is overdue.</p>';
  return secondVisitTableHtml(rows);
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function secondVisitCsv(list) {
  const rows = normalizeSecondVisitList(list);
  const lines = ['id,ticket,dueDate,outcome,note'];
  for (const item of rows) {
    lines.push([item.id, item.ticket, item.dueDate, item.outcome, item.note].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function secondVisitFilename() {
  return 'second-visits.csv';
}
