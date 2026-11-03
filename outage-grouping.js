// Plan 22 (Plan 1-100) — Outage grouping: one parent fault for many
// customers.
//
// When a whole mohalla or splitter segment goes down, each affected
// customer becomes a separate ticket, so the same fault is chased many
// times and customers get conflicting updates. This module is the
// GROUPING only: an outage record (affected mohalla or segment, start
// time, cause note) that links related Plan 21 tickets as children of
// one parent fault.
//
// Scope fence, stated plainly:
//   - This module never reads or writes the Plan 21 ticket log
//     itself: the caller supplies the tickets, and linking only
//     records ticket ids on the outage. A ticket's own history is
//     untouched — each linked customer still keeps their own ticket,
//     and resolving the parent never resolves a ticket silently.
//     The operator resolves linked tickets one by one, through the
//     Plan 21 status change, after the parent is resolved.
//   - A ticket can belong to at most one OPEN outage at a time.
//     Linking a ticket that already sits in another open outage
//     leaves every outage unchanged, never steals the ticket.
//   - Updating the parent prepares ONE status draft for the linked
//     customers. Nothing is sent from here: the wiring opens the
//     existing WhatsApp draft route per customer, and a customer
//     with no WhatsApp number gets no draft. No bulk auto-send.
//   - No billing, payment, lifecycle, connection-register or
//     field-visit record is read or written here, and no ticket
//     money exists in this module to change.
//
// How the fence is kept in this module:
//   - It is import-free: the caller supplies every outage, every
//     ticket, and every id, and the module never reads storage, the
//     clock, or the network, and never mutates an input.
//   - An outage without an affected area is not an outage:
//     normalizeOutage returns null instead of inventing an area.
//     An unknown status falls back to open, because that is a
//     display default, not identity; a missing start time or cause
//     note is shown as "Not recorded", never guessed.
//   - Ticket ids on an outage are kept unique and in link order;
//     linking the same ticket twice adds nothing.

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[\",\n]/.test(str) ? `"${str.replace(/\"/g, '""')}"` : str;
}

export const OUTAGE_STATUSES = ['open', 'in_progress', 'resolved'];

// Statuses that still count as an open parent fault. A resolved
// outage is history: its tickets no longer "belong" to an open outage,
// which is what frees them to join a later outage.
export const OUTAGE_OPEN_STATUSES = ['open', 'in_progress'];

// Ticket statuses that still count as waiting for work. This mirrors
// Plan 21's TICKET_OPEN_STATUSES without importing it, so this module
// stays import-free; the caller may override it via options.
export const OUTAGE_OPEN_TICKET_STATUSES = ['open', 'assigned', 'in_progress'];

export const OUTAGE_STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

// Normalised outage, or null when the entry cannot be an outage: no
// affected area. The returned object is fresh; the input is never
// mutated. Ticket ids are deduplicated, blanks dropped, link order
// kept.
export function normalizeOutage(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const area = text(entry.area);
  if (!area) return null;
  const status = OUTAGE_STATUSES.includes(text(entry.status)) ? text(entry.status) : 'open';
  const seen = new Set();
  const ticketIds = [];
  for (const id of Array.isArray(entry.ticketIds) ? entry.ticketIds : []) {
    const clean = text(id);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      ticketIds.push(clean);
    }
  }
  return {
    id: text(entry.id),
    area,
    segment: text(entry.segment),
    startTime: text(entry.startTime),
    causeNote: text(entry.causeNote),
    status,
    ticketIds,
  };
}

// Every outage in the list, normalised, with unusable entries
// dropped. Input order is preserved; inputs are never mutated.
export function normalizeOutageList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const entry of list) {
    const outage = normalizeOutage(entry);
    if (outage) out.push(outage);
  }
  return out;
}

// Create one outage. Returns null for a missing area — never an
// outage with an invented area. The id is caller-supplied (the wiring
// generates it); an outage without an id is still an outage, it just
// has no id yet.
export function createOutage(input) {
  return normalizeOutage(input);
}

// The open outages: parents still being worked on. Resolved outages
// are out.
export function openOutageList(list) {
  return normalizeOutageList(list).filter((outage) => OUTAGE_OPEN_STATUSES.includes(outage.status));
}

// The open outage a ticket currently belongs to, or null. A ticket
// linked only to resolved outages belongs to no open outage and is
// free to join a new one.
export function outageForTicket(list, ticketId) {
  const wanted = text(ticketId);
  if (!wanted) return null;
  for (const outage of openOutageList(list)) {
    if (outage.ticketIds.includes(wanted)) return outage;
  }
  return null;
}

// Link one ticket to one outage. Returns a new list. The link is
// refused — every outage unchanged — when the outage does not exist,
// the outage is resolved, or the ticket already belongs to another
// open outage. Linking a ticket already linked to this same outage
// adds nothing and returns the list unchanged in content.
export function linkTicketToOutage(list, outageId, ticketId) {
  const clean = normalizeOutageList(list);
  const wantedOutage = text(outageId);
  const wantedTicket = text(ticketId);
  if (!wantedOutage || !wantedTicket) return clean;
  const target = clean.find((outage) => outage.id === wantedOutage);
  if (!target) return clean;
  if (!OUTAGE_OPEN_STATUSES.includes(target.status)) return clean;
  const holder = outageForTicket(clean, wantedTicket);
  if (holder && holder.id !== wantedOutage) return clean;
  if (target.ticketIds.includes(wantedTicket)) return clean;
  return clean.map((outage) => (
    outage.id === wantedOutage
      ? { ...outage, ticketIds: [...outage.ticketIds, wantedTicket] }
      : outage
  ));
}

// Unlink one ticket from one outage. Returns a new list; an unknown
// outage or a ticket that is not linked leaves every outage
// unchanged.
export function unlinkTicketFromOutage(list, outageId, ticketId) {
  const clean = normalizeOutageList(list);
  const wantedOutage = text(outageId);
  const wantedTicket = text(ticketId);
  if (!wantedOutage || !wantedTicket) return clean;
  let changed = false;
  const out = clean.map((outage) => {
    if (outage.id !== wantedOutage || !outage.ticketIds.includes(wantedTicket)) return outage;
    changed = true;
    return { ...outage, ticketIds: outage.ticketIds.filter((id) => id !== wantedTicket) };
  });
  return changed ? out : clean;
}

// Set one outage's status. Returns a new list; an unknown id or an
// unknown status leaves every outage unchanged. Only the status
// field moves — resolving a parent never touches any ticket.
export function updateOutageStatus(list, id, status) {
  const clean = normalizeOutageList(list);
  if (!OUTAGE_STATUSES.includes(text(status))) return clean;
  const wanted = text(id);
  let changed = false;
  const out = clean.map((outage) => {
    if (outage.id !== wanted) return outage;
    changed = true;
    return { ...outage, status: text(status) };
  });
  return changed ? out : clean;
}

// Resolve one parent fault. Returns the new outage list plus the
// linked tickets, split into those still waiting and those already
// settled — so the operator resolves the waiting ones one by one
// through the Plan 21 status change, never silently. Resolving an
// unknown outage, or one already resolved, changes nothing and
// reports no pending tickets. Ticket objects are caller-supplied and
// matched by id; the caller may override the open-ticket statuses.
export function resolveOutage(list, outageId, ticketList, options = {}) {
  const clean = normalizeOutageList(list);
  const wanted = text(outageId);
  const outage = clean.find((entry) => entry.id === wanted);
  if (!outage || outage.status === 'resolved') {
    return { outages: clean, linkedTickets: [], pendingTickets: [] };
  }
  const openStatuses = Array.isArray(options.openTicketStatuses) && options.openTicketStatuses.length
    ? options.openTicketStatuses
    : OUTAGE_OPEN_TICKET_STATUSES;
  const ticketsById = new Map();
  for (const ticket of Array.isArray(ticketList) ? ticketList : []) {
    if (ticket && typeof ticket === 'object' && text(ticket.id)) ticketsById.set(text(ticket.id), ticket);
  }
  const linkedTickets = outage.ticketIds
    .map((id) => ticketsById.get(id))
    .filter(Boolean);
  const pendingTickets = linkedTickets.filter((ticket) => openStatuses.includes(text(ticket.status)));
  return {
    outages: clean.map((entry) => (entry.id === wanted ? { ...entry, status: 'resolved' } : entry)),
    linkedTickets,
    pendingTickets,
  };
}

// The linked tickets of one outage, in link order, from a
// caller-supplied ticket list. Tickets not found in the list are
// skipped, never invented; each linked customer still keeps their
// own ticket record elsewhere.
export function ticketsForOutage(outage, ticketList) {
  const clean = normalizeOutage(outage);
  if (!clean) return [];
  const ticketsById = new Map();
  for (const ticket of Array.isArray(ticketList) ? ticketList : []) {
    if (ticket && typeof ticket === 'object' && text(ticket.id)) ticketsById.set(text(ticket.id), ticket);
  }
  return clean.ticketIds.map((id) => ticketsById.get(id)).filter(Boolean);
}

// The linked tickets of one outage that are still waiting for work,
// so the operator can resolve them one by one after the parent is
// resolved. The caller may override the open-ticket statuses.
export function pendingResolutionTickets(outage, ticketList, options = {}) {
  const openStatuses = Array.isArray(options.openTicketStatuses) && options.openTicketStatuses.length
    ? options.openTicketStatuses
    : OUTAGE_OPEN_TICKET_STATUSES;
  return ticketsForOutage(outage, ticketList)
    .filter((ticket) => openStatuses.includes(text(ticket.status)));
}

// One status draft for the linked customers of an outage. The draft
// names the affected area (and segment when recorded), the start
// time, the cause note when recorded, and the parent's status —
// never a cause that was not recorded, and never a promise about
// when service returns. options.customerName personalises the draft
// for one linked customer; without it the draft addresses the
// affected customers as a group. The wiring sends this text per
// customer through the existing WhatsApp draft route; nothing here
// sends anything.
export function buildOutageStatusDraft(outage, options = {}) {
  const clean = normalizeOutage(outage);
  if (!clean) return { text: '', ready: false };
  const statusLabel = OUTAGE_STATUS_LABELS[clean.status] ?? clean.status;
  const areaLine = clean.segment ? `${clean.area} (${clean.segment})` : clean.area;
  const customerName = text(options.customerName);
  const lines = [
    customerName ? `Assalam-o-Alaikum ${customerName},` : 'Assalam-o-Alaikum,',
    `Shahdara Fiber Net ki taraf se update: ${areaLine} mein fault ki wajah se service mutasir hai.`,
    `Fault shuru hua: ${clean.startTime || 'Not recorded'}.`,
  ];
  if (clean.causeNote) lines.push(`Wajah: ${clean.causeNote}.`);
  lines.push(`Fault ki halat: ${statusLabel}.`);
  if (clean.status === 'resolved') {
    lines.push('Fault theek ho gaya hai. Agar aap ki service abhi bhi band hai to please humein batayein, aap ka ticket alag se dekha jayega.');
  } else {
    lines.push('Humari team is par kaam kar rahi hai. Aap ka ticket isi fault se linked hai, is liye alag update ki zaroorat nahi.');
  }
  return { text: lines.join('\n'), ready: true };
}

// Counts for an outage list: total, open, resolved, and linked
// tickets across all outages (a ticket linked to two resolved
// outages counts once per link — the count is of links, not of
// distinct tickets).
export function outageSummary(list) {
  const clean = normalizeOutageList(list);
  return {
    total: clean.length,
    open: clean.filter((outage) => OUTAGE_OPEN_STATUSES.includes(outage.status)).length,
    resolved: clean.filter((outage) => outage.status === 'resolved').length,
    linkedTickets: clean.reduce((sum, outage) => sum + outage.ticketIds.length, 0),
  };
}

export function outageSummaryText(summary) {
  if (!summary || typeof summary !== 'object') return 'No outages';
  return `${summary.open ?? 0} open of ${summary.total ?? 0} outages, ${summary.linkedTickets ?? 0} tickets linked`;
}

function outageRowLabel(outage) {
  return OUTAGE_STATUS_LABELS[outage.status] ?? outage.status;
}

// One block per outage, escaped, naming the area, segment, start
// time, cause note, status and linked ticket count — and nothing else.
export function outageHtml(rows) {
  const clean = normalizeOutageList(rows);
  if (!clean.length) return '<p class="empty-state">No outages recorded.</p>';
  return clean.map((outage) => {
    const areaLine = outage.segment ? `${outage.area} (${outage.segment})` : outage.area;
    return `<div class="outage-group-row" data-outage-id="${escapeHtml(outage.id)}"><strong>${escapeHtml(areaLine)}</strong> · ${escapeHtml(outageRowLabel(outage))} · Started: ${escapeHtml(outage.startTime || 'Not recorded')}${outage.causeNote ? ` · ${escapeHtml(outage.causeNote)}` : ''} · ${outage.ticketIds.length} ticket${outage.ticketIds.length === 1 ? '' : 's'} linked</div>`;
  }).join('');
}

export function outageCsv(rows) {
  const clean = normalizeOutageList(rows);
  const header = ['Outage id', 'Area', 'Segment', 'Start time', 'Cause note', 'Status', 'Linked tickets'];
  const lines = [header.map(csvCell).join(',')];
  for (const outage of clean) {
    lines.push([
      outage.id, outage.area, outage.segment, outage.startTime,
      outage.causeNote, outageRowLabel(outage), outage.ticketIds.join('; '),
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function outageFilename() {
  return 'outage-groups.csv';
}
