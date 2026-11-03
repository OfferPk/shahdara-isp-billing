// Plan 21 (Plan 1-100) — Fault and complaint ticket log.
//
// A customer complaint arrives by phone or WhatsApp and lives only in
// chat history, so nobody can tell which faults are open, who owns
// them, or how long they have waited. This module is the LOG for
// those complaints: one ticket per complaint, linked to exactly one
// customer, with exactly one category, one priority and one status.
//
// Scope fence, stated plainly against the neighbouring systems:
//   - The SISP complaint register (complaint-register.js) records
//     faults with downtime (resolved minus reported) and the SISP
//     field tickets (complaint-tickets.js) run a field-work pipeline
//     with technicians, materials, SLA badges and billed charges,
//     and only know three statuses (Open / In Progress / Resolved).
//     Neither has Plan 21's five categories, its five statuses
//     (open, assigned, in progress, resolved, closed), or a
//     mohalla filter. This log is the lightweight intake list that
//     sits in front of both: it never reads or writes either
//     system, never touches a bill, a payment, a lifecycle record,
//     a connection-register record (Plan 17), or a field-visit
//     outcome (Plan 2 covers the visit itself).
//   - Plan 50 (customer-requested change queue) will route
//     relocation requests to one queue; for Plan 21 itself,
//     relocation stays a ticket category here and no Plan 50
//     queue is built.
//   - Closing a ticket changes only the ticket's status. A closed
//     ticket carries no bill, payment or customer-status change,
//     because this module holds no such fields and the caller
//     passes no such records in.
//
// How the fence is kept in this module:
//   - It is import-free: the caller supplies every ticket, every
//     date, and today, and the module never reads storage, the
//     clock, or the network, and never mutates an input.
//   - A ticket without a customer, or with a category outside the
//     five in the plan, is not a ticket: normalizeTicket returns
//     null instead of inventing a customer or a category. An
//     unknown priority falls back to medium and an unknown status
//     to open, because those are display defaults, not identity;
//     a bad reported date becomes null — shown as "Not recorded",
//     never guessed.
//   - Mohalla filtering is by caller-supplied mohallaKey when one
//     is present (the caller computes it with Plan T's canonical
//     rule), otherwise by a plain case-insensitive label match, so
//     "Bani" and "bani" are one mohalla here too. A ticket with no
//     mohalla is "Unassigned" and is never dropped by a filter
//     unless the filter asks for a different mohalla.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const TICKET_CATEGORIES = [
  'no_connection',
  'slow_speed',
  'billing_query',
  'device_fault',
  'relocation_request',
];

export const TICKET_CATEGORY_LABELS = {
  no_connection: 'No connection',
  slow_speed: 'Slow speed',
  billing_query: 'Billing query',
  device_fault: 'Device fault',
  relocation_request: 'Relocation request',
};

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export const TICKET_PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const TICKET_STATUSES = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];

export const TICKET_STATUS_LABELS = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

// Statuses that still count as an open ticket. Resolved and closed
// tickets are history, not work still waiting.
export const TICKET_OPEN_STATUSES = ['open', 'assigned', 'in_progress'];

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
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
export function validTicketDate(value) {
  const str = text(value);
  if (!DATE_RE.test(str)) return null;
  const parsed = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === str ? str : null;
}

// Whole days from dateA to dateB (UTC calendar days), or null when
// either date is not a real calendar date.
export function wholeDaysBetweenTicketDates(dateA, dateB) {
  const a = validTicketDate(dateA);
  const b = validTicketDate(dateB);
  if (!a || !b) return null;
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

// Normalised ticket, or null when the entry cannot be a ticket:
// no customer, or a category outside the plan's five. The returned
// object is fresh; the input is never mutated.
export function normalizeTicket(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const customerId = text(entry.customerId);
  if (!customerId) return null;
  const category = text(entry.category);
  if (!TICKET_CATEGORIES.includes(category)) return null;
  const priority = TICKET_PRIORITIES.includes(text(entry.priority)) ? text(entry.priority) : 'medium';
  const status = TICKET_STATUSES.includes(text(entry.status)) ? text(entry.status) : 'open';
  return {
    id: text(entry.id),
    customerId,
    customerName: text(entry.customerName),
    mohalla: text(entry.mohalla),
    mohallaKey: text(entry.mohallaKey),
    category,
    priority,
    status,
    reportedDate: validTicketDate(entry.reportedDate),
    assignee: text(entry.assignee),
    note: text(entry.note),
  };
}

// Create one ticket. Returns null for a missing customer or an
// unknown category — never a ticket with an invented customer or
// category. The id is caller-supplied (the wiring generates it);
// a ticket without an id is still a ticket, it just has no id yet.
export function createTicket(input) {
  return normalizeTicket(input);
}

// Every ticket in the list, normalised, with unusable entries
// dropped. Input order is preserved; inputs are never mutated.
export function normalizeTicketList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const entry of list) {
    const ticket = normalizeTicket(entry);
    if (ticket) out.push(ticket);
  }
  return out;
}

// Set one ticket's status. Returns a new list; an unknown id or an
// unknown status leaves every ticket unchanged. Only the status
// field of the matched ticket changes — closing a ticket never
// rewrites any other field, and this module holds no bill, payment
// or customer-status field to change.
export function updateTicketStatus(list, id, status) {
  const clean = normalizeTicketList(list);
  if (!TICKET_STATUSES.includes(text(status))) return clean;
  const wanted = text(id);
  let changed = false;
  const out = clean.map((ticket) => {
    if (ticket.id !== wanted) return ticket;
    changed = true;
    return { ...ticket, status: text(status) };
  });
  return changed ? out : clean;
}

// Close one ticket: status becomes 'closed', nothing else changes.
export function closeTicket(list, id) {
  return updateTicketStatus(list, id, 'closed');
}

// Set one ticket's owner. Returns a new list; an unknown id leaves
// every ticket unchanged. Setting an owner never changes status.
export function updateTicketAssignee(list, id, assignee) {
  const clean = normalizeTicketList(list);
  const wanted = text(id);
  let changed = false;
  const out = clean.map((ticket) => {
    if (ticket.id !== wanted) return ticket;
    changed = true;
    return { ...ticket, assignee: text(assignee) };
  });
  return changed ? out : clean;
}

// The open-ticket list: tickets still waiting for work (open,
// assigned, in progress). Resolved and closed tickets are out.
export function openTicketList(list) {
  return normalizeTicketList(list).filter((ticket) => TICKET_OPEN_STATUSES.includes(ticket.status));
}

function normalizedMohallaLabel(value) {
  return text(value).replace(/\s+/g, ' ').toLocaleLowerCase();
}

// Does one ticket's mohalla match the caller's mohalla filter?
// The filter may be a canonical key (preferred, Plan T rule) or a
// label. An empty filter matches every ticket. The label
// "Unassigned" matches only tickets with no mohalla.
export function ticketMatchesMohalla(ticket, mohallaFilter, mohallaKeyFilter) {
  const keyFilter = text(mohallaKeyFilter);
  if (keyFilter) {
    if (ticket.mohallaKey) return ticket.mohallaKey === keyFilter;
    return normalizedMohallaLabel(ticket.mohalla) === keyFilter;
  }
  const labelFilter = normalizedMohallaLabel(mohallaFilter);
  if (!labelFilter) return true;
  if (labelFilter === 'unassigned') return !ticket.mohalla;
  return normalizedMohallaLabel(ticket.mohalla) === labelFilter;
}

// Filter a ticket list. Filters are all optional; a blank filter
// matches everything. openOnly restricts to the open-ticket list.
export function filterTicketList(list, filters = {}) {
  const clean = normalizeTicketList(list);
  const status = text(filters.status);
  const category = text(filters.category);
  const openOnly = filters.openOnly === true;
  return clean.filter((ticket) => {
    if (openOnly && !TICKET_OPEN_STATUSES.includes(ticket.status)) return false;
    if (status && ticket.status !== status) return false;
    if (category && ticket.category !== category) return false;
    if (!ticketMatchesMohalla(ticket, filters.mohalla, filters.mohallaKey)) return false;
    return true;
  });
}

// Work order: highest priority first, then oldest reported first
// (a ticket with no reported date sorts last), then customer name
// A–Z, then id. Inputs are never mutated.
export function sortTicketList(list) {
  const clean = normalizeTicketList(list);
  return [...clean].sort((a, b) => {
    const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rank !== 0) return rank;
    if (a.reportedDate && b.reportedDate && a.reportedDate !== b.reportedDate) {
      return a.reportedDate < b.reportedDate ? -1 : 1;
    }
    if (a.reportedDate && !b.reportedDate) return -1;
    if (!a.reportedDate && b.reportedDate) return 1;
    const name = a.customerName.localeCompare(b.customerName);
    if (name !== 0) return name;
    return a.id.localeCompare(b.id);
  });
}

// Whole days a ticket has waited, from its reported date to today
// (caller-supplied). A future reported date counts as 0, never
// negative; a missing or invalid date gives null, never a guess.
export function daysTicketWaiting(ticket, today) {
  const clean = normalizeTicket(ticket);
  if (!clean) return null;
  const days = wholeDaysBetweenTicketDates(clean.reportedDate, today);
  if (days === null) return null;
  return days < 0 ? 0 : days;
}

// Counts for a ticket list: total, open, and per-status counts.
export function ticketSummary(list) {
  const clean = normalizeTicketList(list);
  const byStatus = {};
  for (const status of TICKET_STATUSES) byStatus[status] = 0;
  for (const ticket of clean) byStatus[ticket.status] += 1;
  return {
    total: clean.length,
    open: clean.filter((ticket) => TICKET_OPEN_STATUSES.includes(ticket.status)).length,
    byStatus,
  };
}

export function ticketSummaryText(summary) {
  if (!summary || typeof summary !== 'object') return 'No tickets';
  const open = summary.open ?? 0;
  const total = summary.total ?? 0;
  return `${open} open of ${total} tickets`;
}

function ticketRowLabel(ticket) {
  return {
    category: TICKET_CATEGORY_LABELS[ticket.category] ?? ticket.category,
    priority: TICKET_PRIORITY_LABELS[ticket.priority] ?? ticket.priority,
    status: TICKET_STATUS_LABELS[ticket.status] ?? ticket.status,
  };
}

// One row per ticket, escaped, with waiting days when today is
// supplied. The HTML names the customer, category, priority,
// status, owner and waiting time — and nothing else.
export function ticketHtml(rows, options = {}) {
  const clean = normalizeTicketList(rows);
  if (!clean.length) return '<p class="empty-state">No tickets match these filters.</p>';
  const today = options.today;
  return clean.map((ticket) => {
    const labels = ticketRowLabel(ticket);
    const waiting = today ? daysTicketWaiting(ticket, today) : null;
    const waitingText = waiting === null ? 'Waiting: not recorded' : `Waiting: ${waiting} day${waiting === 1 ? '' : 's'}`;
    return `<div class="ticket-log-row" data-ticket-id="${escapeHtml(ticket.id)}"><strong>${escapeHtml(ticket.customerName || ticket.customerId)}</strong> · ${escapeHtml(labels.category)} · ${escapeHtml(labels.priority)} priority · <span>${escapeHtml(labels.status)}</span> · Owner: ${escapeHtml(ticket.assignee || 'Unassigned')} · Reported: ${escapeHtml(ticket.reportedDate || 'Not recorded')} · ${escapeHtml(waitingText)}${ticket.mohalla ? ` · ${escapeHtml(ticket.mohalla)}` : ''}${ticket.note ? `<div>${escapeHtml(ticket.note)}</div>` : ''}</div>`;
  }).join('');
}

export function ticketCsv(rows, options = {}) {
  const clean = normalizeTicketList(rows);
  const today = options.today;
  const header = ['Ticket id', 'Customer', 'Mohalla', 'Category', 'Priority', 'Status', 'Reported date', 'Waiting days', 'Owner', 'Note'];
  const lines = [header.map(csvCell).join(',')];
  for (const ticket of clean) {
    const labels = ticketRowLabel(ticket);
    const waiting = today ? daysTicketWaiting(ticket, today) : null;
    lines.push([
      ticket.id, ticket.customerName || ticket.customerId, ticket.mohalla,
      labels.category, labels.priority, labels.status,
      ticket.reportedDate || '', waiting === null ? '' : waiting,
      ticket.assignee, ticket.note,
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function ticketFilename() {
  return 'ticket-log.csv';
}
