/**
 * complaint-ticket-sync.js — SISP-44: Complaint Register (CMP-101,
 * SISP-15) ↔ Lineman Worklist Ticket (TKT-101, SISP-12) Two-Way Sync.
 *
 * The link lives on the ticket (`ticket.complaintId`, shipped with
 * SISP-12 and counted through by SISP-39). This module is the only place
 * the two ledgers change each other; both source modules stay
 * self-contained, and app.js runs one reconcile pass after every
 * complaint or ticket change (plus once at startup). All helpers here
 * are pure — inputs are sanitized copies, never mutated.
 *
 * ASSIGN (spec requirement 1): assignTicketForComplaint creates a linked
 * ticket from a register complaint in one click — customer, zone fault
 * category (mapped to the closest ticket preset via
 * COMPLAINT_CATEGORY_TO_PRESET, else the category text as the custom
 * fault) and the link are copied; the lineman name is the only thing the
 * operator types. If an unresolved ticket is already linked, that ticket
 * is returned instead of creating a duplicate.
 *
 * SYNC MAPPING (spec requirement 2 + the reopen directions the spec
 * leaves to the existing state machines):
 * - Ticket Resolved, complaint not → the complaint resolves with the
 *   ticket's resolvedAt (so downtimeHours = resolved − reported is
 *   computed by the register's own setComplaintStatus, honouring a
 *   manual downtime override), the ticket's note becomes the resolution
 *   note (an empty ticket note never wipes an existing one), and the
 *   complaint is stamped resolvedViaTicketId = the ticket.
 * - Complaint Resolved, ticket not → if either provenance stamp ties
 *   this pair's earlier synced resolution to the ticket, the ticket has
 *   been reopened since, so the complaint reopens with it (its timeline
 *   restarts, per register reopen semantics). Otherwise the ticket
 *   resolves from the complaint: a free resolution with no materials
 *   (the office closed the fault; nothing left the store), stamped
 *   resolvedViaComplaintId = the complaint.
 * - Complaint not Resolved, ticket Resolved → the ticket reopens only
 *   when its resolution was a synced one (either stamp ties the pair);
 *   an independent field resolution is never dragged back by the
 *   register — the field record is the truth for field work.
 * - In Progress mirrors across an Open partner on either side.
 * - First resolution wins: a side that is already Resolved is never
 *   overwritten (its resolvedAt / note stay as recorded).
 * - Once a pair is fully open again, the provenance stamps of the
 *   undone resolution are cleared — a stamp only ever describes the
 *   pair's currently standing synced resolution, so a later fresh
 *   resolution is never mistaken for the old one.
 *
 * CAUSALITY (options.trigger): a pass runs after a change on one side,
 * and a deliberate reopen must never be undone by the very pass it
 * triggers. So ticket-driven rules (resolve/reopen the complaint from
 * the ticket) run on 'ticket' and 'both' passes, complaint-driven
 * rules (resolve/reopen the ticket from the complaint) run on
 * 'complaint' and 'both' passes, and the provenance stamps break any
 * remaining tie in favour of the reopen. One case needs a durable
 * marker: a complaint resolved independently of its (already resolved)
 * ticket and then deliberately reopened carries no stamp, so a
 * complaint-side pass records syncReopenGuard = "TKT-NNN@<resolvedAt>"
 * on it; Rule 1 never re-resolves a complaint against that exact
 * ticket resolution, on any pass (startup included), until the ticket
 * is reopened and resolved afresh at a new time. app.js passes
 * 'ticket' from the ticket callback, 'complaint' from the complaint
 * callback, and 'both' (the default) for the startup reconcile.
 *
 * LOOP SAFETY: every rule moves the pair toward agreement and stamps
 * the resolution it creates; applying the reconcile to its own output
 * is a no-op (zero actions, identical lists), so change callbacks can
 * re-run the pass freely — one user change produces at most one
 * cross-update per linked pair. Dangling links (ticket.complaintId
 * naming a complaint that no longer exists) and unlinked records are
 * passed through untouched; neither ledger has a delete, so links are
 * never explicitly removed either.
 *
 * SISP-177: three additions on the same seams. bulkAssignTickets-
 * ForComplaints runs assignTicketForComplaint itself over every open
 * unlinked complaint (openUnlinkedComplaints), so a bulk assignment is
 * by construction identical to assigning one by one — no parallel
 * ticket writer exists. collectTechnicianNames feeds the register's
 * lineman picker from the tickets' own technician fields, grouped by
 * the scorecard's linemanNameKey rule. linkedTicketSummary also reports
 * a materialBadge for the ticket it picks: when that ticket is Resolved
 * and its SISP-42 stock deductions have actually been consumed
 * (stockDeducted), the badge lists the recorded materialsUsed lines in
 * the ticket UI's own materialLineLabel format — display-only, derived
 * at read time, never stored.
 *
 * Tests use synthetic data only.
 */

import {
  AREA_OUTAGE_CUSTOMER_ID,
  complaintCustomerLabel,
  sanitizeComplaints,
  setComplaintStatus
} from './complaint-register.js';
import {
  COMPLAINT_CATEGORY_TO_PRESET,
  createTicket,
  materialLineLabel,
  resolveTicket,
  sanitizeTicketMaterials,
  sanitizeTickets,
  setTicketStatus
} from './complaint-tickets.js';
import { linemanNameKey } from './lineman-scorecard.js';

/** All tickets linked to one complaint, oldest first. */
export function linkedTicketsForComplaint(tickets, complaintId) {
  return sanitizeTickets(tickets)
    .filter((ticket) => ticket.complaintId && ticket.complaintId === complaintId);
}

/**
 * SISP-177: the material badge for one ticket, or null. A badge exists
 * only when the ticket is Resolved AND its SISP-42 stock deductions
 * were actually consumed (stockDeducted) AND it recorded materials;
 * items are the materialsUsed lines in the ticket card's own format.
 */
function materialBadgeForTicket(ticket) {
  if (!ticket || ticket.status !== 'Resolved' || ticket.stockDeducted !== true) return null;
  const items = sanitizeTicketMaterials(ticket.materialsUsed).map(materialLineLabel).filter(Boolean);
  if (!items.length) return null;
  return { ticketId: ticket.id, items };
}

/**
 * The linked ticket a complaint card should show: the newest unresolved
 * one (the live work), else the newest resolved one. Null when unlinked.
 * SISP-177: the summary also carries that same ticket's materialBadge
 * (null unless it is resolved with consumed stock deductions).
 */
export function linkedTicketSummary(tickets, complaintId) {
  const linked = linkedTicketsForComplaint(tickets, complaintId);
  if (!linked.length) return null;
  const newestFirst = [...linked].sort((a, b) =>
    String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    || String(b.id).localeCompare(String(a.id), undefined, { numeric: true }));
  const pick = newestFirst.find((ticket) => ticket.status !== 'Resolved') || newestFirst[0];
  return { id: pick.id, status: pick.status, materialBadge: materialBadgeForTicket(pick) };
}

/**
 * Spec requirement 1: create the linked lineman ticket for a complaint.
 * options: { technician (required — createTicket enforces it),
 * priority, note, referenceDate }. Returns { complaints, tickets,
 * ticket, created }; created is false when an unresolved linked ticket
 * already existed and was returned instead of a duplicate.
 */
export function assignTicketForComplaint(complaints, tickets, complaintId, options = {}) {
  const cleanComplaints = sanitizeComplaints(complaints);
  const cleanTickets = sanitizeTickets(tickets);
  const complaint = cleanComplaints.find((entry) => entry.id === complaintId);
  if (!complaint) throw new Error('Complaint not found.');
  const existing = linkedTicketsForComplaint(cleanTickets, complaint.id)
    .filter((ticket) => ticket.status !== 'Resolved')
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
  if (existing) {
    return { complaints: cleanComplaints, tickets: cleanTickets, ticket: existing, created: false };
  }
  const preset = COMPLAINT_CATEGORY_TO_PRESET[complaint.issueCategory] || '';
  const ticket = createTicket({
    customerId: complaint.customerId,
    customerName: complaint.customerId === AREA_OUTAGE_CUSTOMER_ID
      ? complaintCustomerLabel(complaint)
      : complaint.customerName,
    complaintId: complaint.id,
    faultPreset: preset,
    customFault: preset ? '' : complaint.issueCategory,
    technician: options.technician,
    // SISP-84: an Urgent complaint (e.g. a commercial_vip customer's,
    // born Urgent in the register) passes its urgency to the ticket
    // unless the caller explicitly chose a priority.
    priority: options.priority ?? (complaint.priority === 'Urgent' ? 'Urgent' : undefined),
    note: options.note
  }, cleanTickets, options.referenceDate);
  return {
    complaints: cleanComplaints,
    tickets: [...cleanTickets, ticket],
    ticket,
    created: true
  };
}

/**
 * SISP-177: the complaints the bulk-assign bar acts on — still open
 * (status not Resolved) and with NO linked ticket at all. A complaint
 * whose only linked ticket is already Resolved is deliberately NOT a
 * bulk target: the register card's single assign stays available for
 * that deliberate, one-at-a-time decision.
 */
export function openUnlinkedComplaints(complaints, tickets) {
  const linkedIds = new Set(
    sanitizeTickets(tickets).map((ticket) => ticket.complaintId).filter(Boolean)
  );
  return sanitizeComplaints(complaints)
    .filter((complaint) => complaint.status !== 'Resolved' && !linkedIds.has(complaint.id));
}

/**
 * SISP-177: assign every open unlinked complaint to one lineman, in
 * register order, by running the single-assign seam
 * (assignTicketForComplaint) over the evolving lists — so each bulk
 * result is exactly the ticket a manual assignment would have created,
 * and ids sequence through the same nextTicketId path. Complaints are
 * never mutated (the assign seam does not change them); already-linked
 * and already-resolved complaints are untouched. options:
 * { referenceDate } (threaded to createTicket for tests). Returns
 * { complaints, tickets, assigned: [{ complaintId, ticket, created }] }.
 * With no targets the lists pass through sanitized and assigned is
 * empty; a blank technician with targets present throws the same error
 * createTicket throws, before any ticket is created.
 */
export function bulkAssignTicketsForComplaints(complaints, tickets, technician, options = {}) {
  const targets = openUnlinkedComplaints(complaints, tickets);
  let nextComplaints = sanitizeComplaints(complaints);
  let nextTickets = sanitizeTickets(tickets);
  if (!targets.length) return { complaints: nextComplaints, tickets: nextTickets, assigned: [] };
  const name = typeof technician === 'string' ? technician.trim() : '';
  if (!name) throw new Error('Assign a lineman / technician first.');
  const assigned = [];
  for (const target of targets) {
    const result = assignTicketForComplaint(nextComplaints, nextTickets, target.id, {
      technician: name,
      referenceDate: options.referenceDate
    });
    nextComplaints = result.complaints;
    nextTickets = result.tickets;
    assigned.push({ complaintId: target.id, ticket: result.ticket, created: result.created });
  }
  return { complaints: nextComplaints, tickets: nextTickets, assigned };
}

/**
 * SISP-177: lineman names for the register's picker, discovered from
 * the tickets' own technician fields (the register records carry no
 * technician). Grouped by the scorecard's linemanNameKey (trimmed,
 * whitespace-collapsed, case-insensitive); the display name is the
 * first-seen spelling, whitespace-collapsed like the scorecard's.
 * Sorted by display name. Nothing is hardcoded.
 */
export function collectTechnicianNames(tickets) {
  const byKey = new Map();
  for (const ticket of sanitizeTickets(tickets)) {
    const key = linemanNameKey(ticket.technician);
    if (!key || byKey.has(key)) continue;
    byKey.set(key, ticket.technician.replace(/\s+/g, ' '));
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * One reconcile pass over every linked pair (see the header mapping).
 * options.trigger: 'ticket' | 'complaint' | 'both' (default) — which
 * side's change caused the pass; see CAUSALITY in the header.
 * Returns { complaints, tickets, changedComplaints, changedTickets,
 * actions } — actions names each cross-update in words, for tests and
 * diagnostics. Running it on its own output yields zero actions.
 */
export function syncComplaintTicketLinks(complaints, tickets, options = {}) {
  const trigger = options && ['ticket', 'complaint'].includes(options.trigger) ? options.trigger : 'both';
  const fromTicket = trigger !== 'complaint';
  const fromComplaint = trigger !== 'ticket';
  let nextComplaints = sanitizeComplaints(complaints);
  let nextTickets = sanitizeTickets(tickets);
  const beforeComplaints = JSON.stringify(nextComplaints);
  const beforeTickets = JSON.stringify(nextTickets);
  const actions = [];
  const getComplaint = (id) => nextComplaints.find((entry) => entry.id === id);
  const getTicket = (id) => nextTickets.find((entry) => entry.id === id);

  for (const seed of [...nextTickets]) {
    if (!seed.complaintId) continue;
    let ticket = getTicket(seed.id);
    let complaint = ticket ? getComplaint(ticket.complaintId) : null;
    if (!ticket || !complaint) continue; // dangling link: tolerated, untouched
    // A provenance stamp tying this pair means the standing Resolved
    // state on one side was produced by the sync from the other — a
    // reopen on the producing side undoes it, never re-applies it.
    const stampsTie = () => complaint.resolvedViaTicketId === ticket.id
      || ticket.resolvedViaComplaintId === complaint.id;
    const guardOf = () => `${ticket.id}@${ticket.resolvedAt}`;

    // Rule 1 — a resolved ticket resolves its complaint (spec). Never
    // when the pair's standing resolution was itself synced (that is
    // Rule 3's reopen territory), never on a complaint-side pass (a
    // deliberate complaint reopen is not undone by its own pass), and
    // never against a reopen guard naming this exact resolution.
    if (fromTicket && ticket.status === 'Resolved' && complaint.status !== 'Resolved'
      && !stampsTie() && complaint.syncReopenGuard !== guardOf()) {
      nextComplaints = setComplaintStatus(nextComplaints, complaint.id, 'Resolved', {
        resolvedAt: ticket.resolvedAt || undefined,
        resolutionNote: ticket.note ? ticket.note : undefined
      });
      const entry = getComplaint(complaint.id);
      if (entry) entry.resolvedViaTicketId = ticket.id;
      actions.push(`${complaint.id} resolved by ${ticket.id}`);
      complaint = getComplaint(complaint.id);
      ticket = getTicket(ticket.id);
    }

    // Rule 2 — a resolved complaint meets an unresolved ticket: either
    // the ticket was reopened after the pair's synced resolution (the
    // complaint follows it back open) or the complaint's own resolution
    // now resolves the ticket.
    if (complaint.status === 'Resolved' && ticket.status !== 'Resolved') {
      if (fromTicket && stampsTie()) {
        nextComplaints = setComplaintStatus(nextComplaints, complaint.id, 'Open');
        actions.push(`${complaint.id} reopened with ${ticket.id}`);
      } else if (fromComplaint && !stampsTie()) {
        // Same time and note as the register resolution: resolvedAt is
        // stamped verbatim (a wall-time string, never re-zoned through
        // a Date, so the stamp is exact on any host timezone) and a
        // non-empty resolution note is carried over; an empty note
        // never wipes the ticket's own note.
        nextTickets = resolveTicket(nextTickets, ticket.id, {
          materialsUsed: [],
          billingType: 'free',
          resolvedAt: complaint.resolvedAt || undefined
        });
        const entry = getTicket(ticket.id);
        if (entry) {
          entry.resolvedViaComplaintId = complaint.id;
          if (complaint.resolutionNote) entry.note = complaint.resolutionNote;
        }
        actions.push(`${ticket.id} resolved by ${complaint.id}`);
      }
      complaint = getComplaint(complaint.id);
      ticket = getTicket(ticket.id);
    }

    // Rule 3 — a reopened complaint pulls its ticket back only when the
    // ticket's resolution was a synced one; an independent field
    // resolution stands.
    if (fromComplaint && complaint.status !== 'Resolved' && ticket.status === 'Resolved' && stampsTie()) {
      nextTickets = setTicketStatus(nextTickets, ticket.id, 'Open');
      actions.push(`${ticket.id} reopened with ${complaint.id}`);
      ticket = getTicket(ticket.id);
    }

    // Reopen guard — on a complaint-side pass, a complaint standing
    // open against an independently resolved ticket is a deliberate
    // reopen: record the guard so no later pass (startup included)
    // re-resolves it against this same ticket resolution.
    if (trigger === 'complaint' && complaint.status !== 'Resolved' && ticket.status === 'Resolved'
      && !stampsTie() && complaint.syncReopenGuard !== guardOf()) {
      complaint.syncReopenGuard = guardOf();
    }

    // Rule 4 — In Progress mirrors across an Open partner.
    if (ticket.status === 'In Progress' && complaint.status === 'Open') {
      nextComplaints = setComplaintStatus(nextComplaints, complaint.id, 'In Progress');
      actions.push(`${complaint.id} in progress with ${ticket.id}`);
      complaint = getComplaint(complaint.id);
    } else if (complaint.status === 'In Progress' && ticket.status === 'Open') {
      nextTickets = setTicketStatus(nextTickets, ticket.id, 'In Progress');
      actions.push(`${ticket.id} in progress with ${complaint.id}`);
      ticket = getTicket(ticket.id);
    }

    // Rule 0 — a fully open pair retires the provenance stamps (and
    // any reopen guard naming this ticket) of the resolution that was
    // undone, so they can never be mistaken for the provenance of a
    // later, fresh resolution.
    if (complaint.status !== 'Resolved' && ticket.status !== 'Resolved') {
      if (complaint.resolvedViaTicketId === ticket.id) complaint.resolvedViaTicketId = '';
      if (ticket.resolvedViaComplaintId === complaint.id) ticket.resolvedViaComplaintId = '';
      if (complaint.syncReopenGuard.startsWith(`${ticket.id}@`)) complaint.syncReopenGuard = '';
    }
  }

  return {
    complaints: nextComplaints,
    tickets: nextTickets,
    changedComplaints: JSON.stringify(nextComplaints) !== beforeComplaints,
    changedTickets: JSON.stringify(nextTickets) !== beforeTickets,
    actions
  };
}
