// Plan 141 (Plan 101-202) — Escalation timer for ageing open tickets.
//
// Open tickets age quietly with no stage that says this one is now
// urgent. This module is that stage: one escalation record per open
// ticket with age thresholds in days, a current stage (open, watch,
// or escalated), and the date the stage changed.
//
// What this module is NOT, stated plainly:
//   - It is not a ticket editor. A record names a ticket by id
//     only; it never changes that ticket's content, never changes
//     a priority the operator set, and never changes any bill or
//     payment. Closing a record here only takes the ticket off
//     the ageing list; the ticket itself is closed through its
//     own flow, which this module never reads and never writes.
//   - It is not a second copy of any existing escalation record.
//     Checked first: the overdue-reminder ladder (Plan 12,
//     escalation-ladder.js) stages overdue BILLS, not tickets;
//     the dispute follow-up queue (Plan 117,
//     dispute-followups.js) stages DISPUTES, not tickets; the
//     second-visit rule (Plan 140, second-visit.js) gives an
//     unresolved ticket a due date, not an ageing stage. None of
//     those modules is read or written here, and none of their
//     records is ever touched by this one.
//   - It is not proof that a ticket is really that old. An
//     opened date and thresholds say what the operator recorded;
//     the module verifies format and arithmetic, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record and the reference date, and the module never reads
//     storage, the clock, or the network, never imports another
//     module, and never mutates an input. Every function returns
//     a new list or new rows.
//   - Half-formed records are refused outright, never stored
//     half-formed: a record needs an id, a ticket link, a real
//     calendar opened date, and two positive whole-day
//     thresholds with the escalated threshold strictly above
//     the watch threshold. Unknown fields are dropped, so a
//     record can never grow a ticket-status, priority, bill, or
//     payment field.
//   - One record per open ticket: a ticket that already has an
//     open record cannot gain a second one. A ticket whose
//     record is closed may gain a fresh record later, because a
//     ticket can come back.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later changes are recording a stage, closing,
//     and removal.
//   - A stage changes only two ways: the ticket's age crosses
//     a threshold, or the operator records a stage. A recorded
//     stage never moves backwards, and a threshold never moves
//     a stage backwards either — once a ticket is escalated it
//     stays escalated while it is open.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass). Ages are whole days from
//     the opened date to the reference date; a reference date
//     before the opened date gives age 0, never a negative age.
//   - The ageing list holds open records only, sorted by stage
//     (escalated first, then watch, then open) and, inside a
//     stage, by age descending (oldest first), then id A-Z.
//     A closed ticket leaves the ageing list at once.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validEscalationDate(value) {
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

export const ESCALATION_STAGES = ['open', 'watch', 'escalated'];

const STAGE_RANK = { open: 0, watch: 1, escalated: 2 };

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanStage(value) {
  const stage = cleanText(value);
  return ESCALATION_STAGES.includes(stage) ? stage : 'open';
}

function cleanDays(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function dateToUtcMs(date) {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function utcMsToDate(ms) {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Whole days from opened to reference; never negative. */
export function escalationAgeDays(openedDate, refDate) {
  const opened = validEscalationDate(openedDate);
  const ref = validEscalationDate(refDate);
  if (!opened || !ref) return null;
  const diff = Math.floor((dateToUtcMs(ref) - dateToUtcMs(opened)) / 86400000);
  return diff < 0 ? 0 : diff;
}

/** Stage the thresholds alone give at the reference date. */
export function thresholdStage(record, refDate) {
  const age = escalationAgeDays(record.openedDate, refDate);
  if (age === null) return 'open';
  if (age >= record.escalatedDays) return 'escalated';
  if (age >= record.watchDays) return 'watch';
  return 'open';
}

/** Date the threshold stage was crossed (opened + threshold days). */
function thresholdChangedDate(record, stage) {
  const days = stage === 'escalated' ? record.escalatedDays : record.watchDays;
  return utcMsToDate(dateToUtcMs(record.openedDate) + days * 86400000);
}

/** Normalize one raw record, or null when half-formed. */
export function normalizeEscalation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const ticket = cleanText(raw.ticket);
  const openedDate = validEscalationDate(raw.openedDate);
  const watchDays = cleanDays(raw.watchDays);
  const escalatedDays = cleanDays(raw.escalatedDays);
  if (!id || !ticket || !openedDate || watchDays === null || escalatedDays === null) return null;
  if (escalatedDays <= watchDays) return null;
  const stageChangedDate = raw.stageChangedDate === undefined || raw.stageChangedDate === ''
    ? openedDate
    : validEscalationDate(raw.stageChangedDate);
  if (!stageChangedDate) return null;
  const status = cleanText(raw.status) === 'closed' ? 'closed' : 'open';
  return {
    id,
    ticket,
    openedDate,
    watchDays,
    escalatedDays,
    stage: cleanStage(raw.stage),
    stageChangedDate,
    status,
    note: cleanText(raw.note),
  };
}

/** Normalize a list: drop half-formed rows and duplicate ids (first wins). */
export function normalizeEscalationList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const record = normalizeEscalation(raw);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

export function findEscalation(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeEscalationList(list).find((item) => item.id === clean) || null;
}

/**
 * Insert a record. Returns a new list, or the input unchanged when
 * the record is half-formed, repeats an id with different figures,
 * or would give an open ticket a second record.
 */
export function upsertEscalation(list, raw) {
  const clean = normalizeEscalationList(list);
  const record = normalizeEscalation(raw);
  if (!record) return clean;
  const existing = clean.find((item) => item.id === record.id);
  if (existing) return clean;
  const openForTicket = clean.some(
    (item) => item.ticket === record.ticket && item.status !== 'closed',
  );
  if (openForTicket) return clean;
  return [...clean, record];
}

export function removeEscalation(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeEscalationList(list);
  return normalizeEscalationList(list).filter((item) => item.id !== clean);
}

/**
 * The record's effective stage at the reference date: the higher
 * of the recorded stage and the threshold stage. A stage never
 * moves backwards, and the changed date follows the winning side
 * (the threshold crossing date when the threshold wins).
 */
export function effectiveEscalation(record, refDate) {
  const threshold = thresholdStage(record, refDate);
  if (STAGE_RANK[threshold] > STAGE_RANK[record.stage]) {
    return { stage: threshold, stageChangedDate: thresholdChangedDate(record, threshold) };
  }
  return { stage: record.stage, stageChangedDate: record.stageChangedDate };
}

/**
 * Record a stage by hand. Returns a new list, or the input
 * unchanged for an unknown id, an unknown stage, a bad date, a
 * closed record, or a stage that would move backwards from the
 * recorded stage.
 */
export function recordEscalationStage(list, id, stage, date) {
  const clean = normalizeEscalationList(list);
  const target = cleanText(stage);
  const changedDate = validEscalationDate(date);
  if (!ESCALATION_STAGES.includes(target) || !changedDate) return clean;
  let changed = false;
  const next = clean.map((item) => {
    if (item.id !== cleanText(id)) return item;
    if (item.status === 'closed') return item;
    if (STAGE_RANK[target] < STAGE_RANK[item.stage]) return item;
    if (target === item.stage && changedDate === item.stageChangedDate) return item;
    changed = true;
    return { ...item, stage: target, stageChangedDate: changedDate };
  });
  return changed ? next : clean;
}

/** Close a record: it leaves the ageing list at once. Closed is terminal. */
export function closeEscalation(list, id) {
  const clean = normalizeEscalationList(list);
  let changed = false;
  const next = clean.map((item) => {
    if (item.id !== cleanText(id) || item.status === 'closed') return item;
    changed = true;
    return { ...item, status: 'closed' };
  });
  return changed ? next : clean;
}

/**
 * Ageing list: open records only, each with its effective stage
 * and age at the reference date, sorted by stage (escalated,
 * watch, open), then age descending, then id A-Z. An invalid
 * reference date gives an empty list, never a guessed order.
 */
export function ageingEscalations(list, refDate) {
  const ref = validEscalationDate(refDate);
  if (!ref) return [];
  return normalizeEscalationList(list)
    .filter((item) => item.status !== 'closed')
    .map((item) => {
      const effective = effectiveEscalation(item, ref);
      return {
        ...item,
        stage: effective.stage,
        stageChangedDate: effective.stageChangedDate,
        ageDays: escalationAgeDays(item.openedDate, ref),
      };
    })
    .sort((a, b) => {
      const byStage = STAGE_RANK[b.stage] - STAGE_RANK[a.stage];
      if (byStage !== 0) return byStage;
      if (b.ageDays !== a.ageDays) return b.ageDays - a.ageDays;
      return compareText(a.id, b.id);
    });
}

export function escalationSummaryText(list, refDate) {
  const clean = normalizeEscalationList(list);
  const ageing = ageingEscalations(clean, refDate);
  const escalated = ageing.filter((item) => item.stage === 'escalated').length;
  return `${clean.length} escalation timer${clean.length === 1 ? '' : 's'}, `
    + `${ageing.length} ageing, ${escalated} escalated`;
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escalationRowHtml(item) {
  return `<tr><td>${esc(item.id)}</td><td>${esc(item.ticket)}</td>`
    + `<td>${esc(item.openedDate)}</td><td>${esc(item.ageDays)}</td>`
    + `<td>${esc(item.stage)}</td><td>${esc(item.stageChangedDate)}</td>`
    + `<td>${esc(item.note)}</td></tr>`;
}

function escalationTableHtml(rows) {
  return '<table><thead><tr><th>Id</th><th>Ticket</th><th>Opened</th>'
    + '<th>Age (days)</th><th>Stage</th><th>Stage changed</th><th>Note</th>'
    + '</tr></thead><tbody>' + rows.map(escalationRowHtml).join('') + '</tbody></table>';
}

/** Ageing list as HTML, optionally filtered to one ticket (blank shows all). */
export function escalationHtml(list, refDate, ticketFilter) {
  const filter = cleanText(ticketFilter);
  const rows = ageingEscalations(list, refDate)
    .filter((item) => !filter || item.ticket === filter);
  if (rows.length === 0) return '<p>No open ticket is ageing. A closed ticket leaves this list.</p>';
  return escalationTableHtml(rows);
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function escalationCsv(list) {
  const rows = normalizeEscalationList(list);
  const lines = ['id,ticket,openedDate,watchDays,escalatedDays,stage,stageChangedDate,status,note'];
  for (const item of rows) {
    lines.push([item.id, item.ticket, item.openedDate, item.watchDays, item.escalatedDays,
      item.stage, item.stageChangedDate, item.status, item.note].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function escalationFilename() {
  return 'escalation-timers.csv';
}
