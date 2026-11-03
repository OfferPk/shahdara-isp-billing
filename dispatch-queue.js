// Plan 23 (Plan 1-100) — Fault visit dispatch queue.
//
// Open fault tickets sit in no working order, so Saad chooses the
// next visit by memory and an urgent no-connection case can wait
// behind a routine query. This module is the ORDER for that work:
// a dispatch queue of Plan 21 tickets, highest priority first,
// then oldest reported first, then mohalla (so nearby jobs can be
// batched), each job showing its customer, its Plan 17 connection
// record, and a parts-or-tools note.
//
// Scope fence, stated plainly against the neighbouring systems:
//   - This is a VIEW of Plan 21's ticket log, not a second ticket
//     system: membership and identity come from Plan 21 tickets,
//     and this module never reads or writes the ticket store
//     itself — the caller supplies the tickets, the connection
//     records and the parts notes, and the module returns new
//     lists. It never touches a bill, a payment, a lifecycle
//     record, a connection-register record, or a field-visit
//     outcome (Plan 2 covers the visit itself), and it never
//     touches route sequencing (Plan 1 covers the route).
//   - It is NOT the SISP-67 field dispatch board
//     (field-dispatch-board.js): that board groups mixed open
//     items (complaints, tickets, installations, works, hardware
//     recovery) by zone with no priority or age order, no
//     connection record and no parts note. This queue orders
//     Plan 21 tickets only, by priority, then age, then mohalla.
//   - Reordering the queue never changes a ticket's status or any
//     payment: reorderDispatchQueue returns a reordered array of
//     the same job objects and touches no ticket field at all.
//     Completing a visit from the queue changes only that
//     ticket's status (through the caller's ticket store), never
//     the ledger — this module holds no payment or ledger field.
//
// How the fence is kept in this module:
//   - It is import-free: the caller supplies every ticket, every
//     connection record, every parts note, and today, and the
//     module never reads storage, the clock, or the network, and
//     never mutates an input.
//   - A ticket without a customer, or with a category outside
//     Plan 21's five, is not a job: normalizeDispatchTicket
//     returns null instead of inventing a customer or a category.
//     An unknown priority falls back to medium and an unknown
//     status to open, because those are display defaults, not
//     identity; a bad reported date becomes null — shown as
//     "Not recorded", never guessed.
//   - The queue lists exactly the dispatchable tickets: status
//     'open' or 'assigned'. A ticket already in progress is work
//     already dispatched, and resolved or closed tickets are
//     history, so neither is queued. The caller may override the
//     status set explicitly, but the default is the plan's
//     "open, assigned" wording.
//   - Mohalla ordering is by caller-supplied mohallaKey when one
//     is present (the caller computes it with Plan T's canonical
//     rule), otherwise by a plain case-insensitive label, so
//     "Bani" and "bani" batch together. A job with no mohalla is
//     "Unassigned" and sorts last within its priority and age,
//     never dropped.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const DISPATCH_TICKET_CATEGORIES = [
  'no_connection',
  'slow_speed',
  'billing_query',
  'device_fault',
  'relocation_request',
];

export const DISPATCH_TICKET_CATEGORY_LABELS = {
  no_connection: 'No connection',
  slow_speed: 'Slow speed',
  billing_query: 'Billing query',
  device_fault: 'Device fault',
  relocation_request: 'Relocation request',
};

export const DISPATCH_TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export const DISPATCH_TICKET_PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const DISPATCH_TICKET_STATUSES = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];

// Statuses that count as dispatchable work: open, assigned. In
// progress is already dispatched; resolved and closed are history.
export const DISPATCH_QUEUE_STATUSES = ['open', 'assigned'];

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function upper(value) {
  return text(value).toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// A real calendar date in YYYY-MM-DD form, or null. 2026-02-30 is
// rejected: the Date round-trip must reproduce the same string.
export function validDispatchDate(value) {
  const str = text(value);
  if (!DATE_RE.test(str)) return null;
  const parsed = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === str ? str : null;
}

// Whole days from dateA to dateB (UTC calendar days), or null when
// either date is not a real calendar date.
export function wholeDaysBetweenDispatchDates(dateA, dateB) {
  const a = validDispatchDate(dateA);
  const b = validDispatchDate(dateB);
  if (!a || !b) return null;
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

// One normalised dispatch ticket, or null when the entry cannot be
// a job: no customer, or a category outside Plan 21's five. The
// returned object is fresh; the input is never mutated.
export function normalizeDispatchTicket(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const customerId = text(entry.customerId);
  if (!customerId) return null;
  const category = text(entry.category);
  if (!DISPATCH_TICKET_CATEGORIES.includes(category)) return null;
  const priority = DISPATCH_TICKET_PRIORITIES.includes(text(entry.priority)) ? text(entry.priority) : 'medium';
  const status = DISPATCH_TICKET_STATUSES.includes(text(entry.status)) ? text(entry.status) : 'open';
  return {
    id: text(entry.id),
    customerId,
    customerName: text(entry.customerName),
    mohalla: text(entry.mohalla),
    mohallaKey: text(entry.mohallaKey),
    category,
    priority,
    status,
    reportedDate: validDispatchDate(entry.reportedDate),
    assignee: text(entry.assignee),
    note: text(entry.note),
  };
}

// Every ticket in the list, normalised, with unusable entries
// dropped. Input order is preserved; inputs are never mutated.
export function normalizeDispatchTicketList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const entry of list) {
    const ticket = normalizeDispatchTicket(entry);
    if (ticket) out.push(ticket);
  }
  return out;
}

function normalizedMohallaLabel(value) {
  return text(value).replace(/\s+/g, ' ').toLocaleLowerCase();
}

// The mohalla sort key for one job: canonical key when present,
// otherwise the case-insensitive label, otherwise '' (Unassigned,
// which sorts last within its priority and age).
function mohallaSortKey(job) {
  if (job.mohallaKey) return job.mohallaKey;
  return normalizedMohallaLabel(job.mohalla);
}

// Does one job's mohalla match the caller's mohalla filter? The
// filter may be a canonical key (preferred, Plan T rule) or a
// label. An empty filter matches every job. The label
// "Unassigned" matches only jobs with no mohalla.
export function dispatchJobMatchesMohalla(job, mohallaFilter, mohallaKeyFilter) {
  const keyFilter = text(mohallaKeyFilter);
  if (keyFilter) {
    if (job.mohallaKey) return job.mohallaKey === keyFilter;
    return normalizedMohallaLabel(job.mohalla) === keyFilter;
  }
  const labelFilter = normalizedMohallaLabel(mohallaFilter);
  if (!labelFilter) return true;
  if (labelFilter === 'unassigned') return !job.mohalla;
  return normalizedMohallaLabel(job.mohalla) === labelFilter;
}

// Work order: highest priority first, then oldest reported first
// (a job with no reported date sorts last), then mohalla (so
// nearby jobs batch), then customer name A–Z, then id. Inputs are
// never mutated.
export function sortDispatchQueue(list) {
  const clean = normalizeDispatchTicketList(list);
  return [...clean].sort((a, b) => {
    const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rank !== 0) return rank;
    if (a.reportedDate && b.reportedDate && a.reportedDate !== b.reportedDate) {
      return a.reportedDate < b.reportedDate ? -1 : 1;
    }
    if (a.reportedDate && !b.reportedDate) return -1;
    if (!a.reportedDate && b.reportedDate) return 1;
    const keyA = mohallaSortKey(a);
    const keyB = mohallaSortKey(b);
    if (keyA && !keyB) return -1;
    if (!keyA && keyB) return 1;
    if (keyA !== keyB) return keyA < keyB ? -1 : 1;
    const name = a.customerName.localeCompare(b.customerName);
    if (name !== 0) return name;
    return a.id.localeCompare(b.id);
  });
}

// The dispatch queue: exactly the dispatchable tickets (open or
// assigned by default), in work order. Optional filters: mohalla
// (label) or mohallaKey, assignee (case-insensitive substring),
// category. Inputs are never mutated.
export function dispatchQueueList(list, filters = {}) {
  const statuses = Array.isArray(filters.statuses) && filters.statuses.length
    ? filters.statuses.filter((s) => DISPATCH_TICKET_STATUSES.includes(text(s))).map((s) => text(s))
    : DISPATCH_QUEUE_STATUSES;
  const category = text(filters.category);
  const assignee = text(filters.assignee).toLocaleLowerCase();
  const clean = normalizeDispatchTicketList(list).filter((ticket) => {
    if (!statuses.includes(ticket.status)) return false;
    if (category && ticket.category !== category) return false;
    if (assignee && !ticket.assignee.toLocaleLowerCase().includes(assignee)) return false;
    if (!dispatchJobMatchesMohalla(ticket, filters.mohalla, filters.mohallaKey)) return false;
    return true;
  });
  return sortDispatchQueue(clean);
}

// Whole days a job has waited, from its reported date to today
// (caller-supplied). A future reported date counts as 0, never
// negative; a missing or invalid date gives null, never a guess.
export function daysDispatchWaiting(job, today) {
  const clean = normalizeDispatchTicket(job);
  if (!clean) return null;
  const days = wholeDaysBetweenDispatchDates(clean.reportedDate, today);
  if (days === null) return null;
  return days < 0 ? 0 : days;
}

// One normalised connection record for a job, or null when the row
// carries no customer to attach it to. Mirrors Plan 17's register
// shape (OLT, PON port, splitter, ONU serial, install date) without
// reading or writing that register: the caller supplies records.
export function normalizeDispatchConnection(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const customerId = text(raw.customerId ?? raw.id);
  if (!customerId) return null;
  return {
    customerId,
    oltId: text(raw.oltId ?? raw.olt ?? raw.oltName),
    ponPort: upper(raw.ponPort ?? raw.pon ?? raw.port),
    splitter: text(raw.splitter ?? raw.splitterId ?? raw.splitterBoxId ?? raw.box),
    onuSerial: upper(raw.onuSerial ?? raw.serial ?? raw.onu),
    installDate: validDispatchDate(raw.installDate ?? raw.installedAt ?? raw.date),
  };
}

// Attach each job's connection record (last record per customer
// wins, as in Plan 17's register). Jobs without a record get
// connection: null, never an invented assignment.
export function attachConnectionRecords(jobs, records) {
  const byCustomer = new Map();
  if (Array.isArray(records)) {
    for (const raw of records) {
      const record = normalizeDispatchConnection(raw);
      if (record) byCustomer.set(record.customerId, record);
    }
  }
  return jobs.map((job) => ({
    ...job,
    connection: byCustomer.get(job.customerId) ?? null,
  }));
}

// One normalised parts-or-tools note, or null when it names no
// ticket or carries no note text.
export function normalizePartsNote(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const ticketId = text(entry.ticketId ?? entry.id);
  const note = text(entry.note ?? entry.partsNote ?? entry.toolsNote);
  if (!ticketId || !note) return null;
  return { ticketId, note };
}

// Attach each job's parts-or-tools note (last note per ticket
// wins). Jobs without a note get partsNote: '', shown as
// "No parts note", never an invented tool list.
export function attachPartsNotes(jobs, notes) {
  const byTicket = new Map();
  if (Array.isArray(notes)) {
    for (const raw of notes) {
      const note = normalizePartsNote(raw);
      if (note) byTicket.set(note.ticketId, note.note);
    }
  }
  return jobs.map((job) => ({
    ...job,
    partsNote: byTicket.get(job.id) ?? '',
  }));
}

// The full queue job: dispatchable tickets in work order, each
// with waiting days, its connection record, and its parts note.
export function buildDispatchQueue(list, options = {}) {
  const queue = dispatchQueueList(list, options);
  const withConnection = attachConnectionRecords(queue, options.connections);
  const withNotes = attachPartsNotes(withConnection, options.partsNotes);
  const today = options.today;
  return withNotes.map((job) => ({
    ...job,
    waitingDays: today ? daysDispatchWaiting(job, today) : null,
  }));
}

// Reorder the displayed queue. Returns a new array of the same job
// objects in the new order; out-of-range moves leave the order
// unchanged. Reordering touches no ticket field — in particular it
// never changes a ticket's status and never touches a payment.
export function reorderDispatchQueue(jobs, fromIndex, toIndex) {
  if (!Array.isArray(jobs)) return [];
  const out = [...jobs];
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return out;
  if (fromIndex < 0 || fromIndex >= out.length) return out;
  if (toIndex < 0 || toIndex >= out.length) return out;
  const [moved] = out.splice(fromIndex, 1);
  out.splice(toIndex, 0, moved);
  return out;
}

// Completing a visit from the queue: change only that ticket's
// status (default 'resolved'). An unknown id or an unknown status
// leaves every ticket unchanged; no other field moves, and this
// module holds no bill, payment or ledger field to change.
export function completeVisitFromQueue(list, ticketId, status = 'resolved') {
  const clean = normalizeDispatchTicketList(list);
  if (!DISPATCH_TICKET_STATUSES.includes(text(status))) return clean;
  const wanted = text(ticketId);
  let changed = false;
  const out = clean.map((ticket) => {
    if (ticket.id !== wanted) return ticket;
    changed = true;
    return { ...ticket, status: text(status) };
  });
  return changed ? out : clean;
}

// Group a queue by mohalla for batching nearby jobs, preserving
// queue order inside each group. Groups are in first-appearance
// order; the Unassigned group, when present, comes last.
export function groupQueueByMohalla(jobs) {
  const groups = [];
  const byKey = new Map();
  for (const job of Array.isArray(jobs) ? jobs : []) {
    const key = job.mohallaKey || normalizedMohallaLabel(job.mohalla) || '__unassigned__';
    const label = job.mohalla || 'Unassigned';
    if (!byKey.has(key)) {
      const group = { key, label, jobs: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key).jobs.push(job);
  }
  groups.sort((a, b) => {
    if (a.key === '__unassigned__') return 1;
    if (b.key === '__unassigned__') return -1;
    return 0;
  });
  return groups;
}

// Counts for a queue: total, and per-priority counts.
export function dispatchQueueSummary(jobs) {
  const list = Array.isArray(jobs) ? jobs : [];
  const byPriority = {};
  for (const priority of DISPATCH_TICKET_PRIORITIES) byPriority[priority] = 0;
  for (const job of list) {
    if (byPriority[job.priority] !== undefined) byPriority[job.priority] += 1;
  }
  return { total: list.length, byPriority };
}

export function dispatchQueueSummaryText(summary) {
  if (!summary || typeof summary !== 'object') return 'No jobs in the dispatch queue';
  const total = summary.total ?? 0;
  const urgent = summary.byPriority?.urgent ?? 0;
  return `${total} job${total === 1 ? '' : 's'} in the dispatch queue${urgent ? `, ${urgent} urgent` : ''}`;
}

function dispatchJobLabels(job) {
  return {
    category: DISPATCH_TICKET_CATEGORY_LABELS[job.category] ?? job.category,
    priority: DISPATCH_TICKET_PRIORITY_LABELS[job.priority] ?? job.priority,
    status: job.status,
  };
}

function connectionLine(connection) {
  if (!connection) return 'Connection: no record';
  const parts = [];
  if (connection.oltId) parts.push(`OLT ${connection.oltId}`);
  if (connection.ponPort) parts.push(`PON ${connection.ponPort}`);
  if (connection.splitter) parts.push(`Splitter ${connection.splitter}`);
  if (connection.onuSerial) parts.push(`ONU ${connection.onuSerial}`);
  if (connection.installDate) parts.push(`Installed ${connection.installDate}`);
  return parts.length ? `Connection: ${parts.join(' · ')}` : 'Connection: no record';
}

// One row per queued job, escaped, numbered in queue order, with
// waiting days, the connection record and the parts note — and
// nothing else.
export function dispatchQueueHtml(jobs, options = {}) {
  const list = Array.isArray(jobs) ? jobs : [];
  if (!list.length) return '<p class="empty-state">No jobs in the dispatch queue.</p>';
  const today = options.today;
  const startAt = Number.isInteger(options.startAt) ? options.startAt : 0;
  return list.map((job, index) => {
    const labels = dispatchJobLabels(job);
    const waiting = today ? daysDispatchWaiting(job, today) : (job.waitingDays ?? null);
    const waitingText = waiting === null ? 'Waiting: not recorded' : `Waiting: ${waiting} day${waiting === 1 ? '' : 's'}`;
    return `<div class="dispatch-queue-row" data-ticket-id="${escapeHtml(job.id)}"><strong>#${startAt + index + 1} ${escapeHtml(job.customerName || job.customerId)}</strong> · ${escapeHtml(labels.category)} · ${escapeHtml(labels.priority)} priority · ${escapeHtml(labels.status)} · Owner: ${escapeHtml(job.assignee || 'Unassigned')} · Reported: ${escapeHtml(job.reportedDate || 'Not recorded')} · ${escapeHtml(waitingText)}${job.mohalla ? ` · ${escapeHtml(job.mohalla)}` : ''}<div>${escapeHtml(connectionLine(job.connection))}</div><div>Parts/tools: ${escapeHtml(job.partsNote || 'No parts note')}</div>${job.note ? `<div>Ticket note: ${escapeHtml(job.note)}</div>` : ''}</div>`;
  }).join('');
}

export function dispatchQueueCsv(jobs, options = {}) {
  const list = Array.isArray(jobs) ? jobs : [];
  const today = options.today;
  const header = ['Queue position', 'Ticket id', 'Customer', 'Mohalla', 'Category', 'Priority', 'Status', 'Reported date', 'Waiting days', 'Owner', 'OLT', 'PON port', 'Splitter', 'ONU serial', 'Parts/tools note', 'Ticket note'];
  const lines = [header.map(csvCell).join(',')];
  list.forEach((job, index) => {
    const labels = dispatchJobLabels(job);
    const waiting = today ? daysDispatchWaiting(job, today) : (job.waitingDays ?? null);
    lines.push([
      index + 1, job.id, job.customerName || job.customerId, job.mohalla,
      labels.category, labels.priority, labels.status,
      job.reportedDate || '', waiting === null ? '' : waiting,
      job.assignee,
      job.connection?.oltId ?? '', job.connection?.ponPort ?? '',
      job.connection?.splitter ?? '', job.connection?.onuSerial ?? '',
      job.partsNote ?? '', job.note,
    ].map(csvCell).join(','));
  });
  return lines.join('\n');
}

export function dispatchQueueFilename() {
  return 'dispatch-queue.csv';
}
