// SISP-44: Complaint Register (CMP-101 SISP-15) ↔ Lineman Worklist
// Ticket (TKT-101 SISP-12) Two-Way Sync. Pure-function tests on synthetic
// data only. Spec test criterion (verbatim): Creating CMP-105 at 10:00,
// creating linked TKT-105, and resolving TKT-105 at 13:30 marks CMP-105
// Resolved with downtimeHours = 3.5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createComplaint,
  sanitizeComplaints,
  setComplaintStatus,
  updateComplaint
} from '../complaint-register.js';
import {
  createTicket,
  resolveTicket,
  sanitizeTickets,
  setTicketStatus,
  updateTicket
} from '../complaint-tickets.js';
import {
  assignTicketForComplaint,
  linkedTicketSummary,
  linkedTicketsForComplaint,
  syncComplaintTicketLinks
} from '../complaint-ticket-sync.js';
import { buildLinemanScorecards } from '../lineman-scorecard.js';

// 13:30 in Pakistan time, expressed as a UTC instant so the pin is exact
// on any host (ticket resolvedAt is formatted in Asia/Karachi).
const RESOLVE_1330_PKT = new Date('2026-10-29T08:30:00Z');

function seedComplaints(count) {
  let list = [];
  for (let i = 0; i < count; i++) {
    list = [...list, createComplaint({
      customerId: `seed-cust-${i}`,
      customerName: `Synthetic Seed ${i}`,
      issueCategory: 'Other'
    }, list)];
  }
  return list;
}

function seedTickets(count) {
  let list = [];
  for (let i = 0; i < count; i++) {
    list = [...list, createTicket({
      customerId: `seed-cust-${i}`,
      customerName: `Synthetic Seed ${i}`,
      faultPreset: 'Router / IP Conflict',
      technician: 'Lineman A'
    }, list)];
  }
  return list;
}

function linkedPair({ category = 'Fiber Cut', reportedAt = '2026-10-29T10:00', note = '' } = {}) {
  const complaint = createComplaint({
    customerId: 'cust-1',
    customerName: 'Synthetic Customer',
    issueCategory: category,
    reportedAt
  }, []);
  const assigned = assignTicketForComplaint([complaint], [], complaint.id, { technician: 'Lineman A' });
  let tickets = assigned.tickets;
  if (note) tickets = updateTicket(tickets, assigned.ticket.id, { note });
  return { complaint, complaints: [complaint], tickets, ticket: assigned.ticket };
}

test('spec criterion: CMP-105 at 10:00, linked TKT-105, resolved 13:30 => CMP-105 Resolved, downtimeHours 3.5', () => {
  let complaints = seedComplaints(4);
  const cmp = createComplaint({
    customerId: 'cust-1',
    customerName: 'Synthetic Customer',
    issueCategory: 'Fiber Cut',
    reportedAt: '2026-10-29T10:00'
  }, complaints);
  assert.equal(cmp.id, 'CMP-105');
  complaints = [...complaints, cmp];

  const assigned = assignTicketForComplaint(complaints, seedTickets(4), 'CMP-105', { technician: 'Lineman A' });
  assert.equal(assigned.created, true);
  assert.equal(assigned.ticket.id, 'TKT-105');
  assert.equal(assigned.ticket.complaintId, 'CMP-105');
  assert.equal(assigned.ticket.faultPreset, 'Fiber Cut / Splice Loss');
  assert.equal(assigned.ticket.customerId, 'cust-1');

  let tickets = updateTicket(assigned.tickets, 'TKT-105', { note: 'Splice redone at the pole' });
  tickets = resolveTicket(tickets, 'TKT-105', {
    materialsUsed: [],
    billingType: 'free',
    referenceDate: RESOLVE_1330_PKT
  });
  assert.equal(tickets.find((t) => t.id === 'TKT-105').resolvedAt, '2026-10-29T13:30');

  const synced = syncComplaintTicketLinks(complaints, tickets);
  const resolved = synced.complaints.find((c) => c.id === 'CMP-105');
  assert.equal(resolved.status, 'Resolved');
  assert.equal(resolved.resolvedAt, '2026-10-29T13:30');
  assert.equal(resolved.downtimeHours, 3.5);
  assert.equal(resolved.resolutionNote, 'Splice redone at the pole');
  assert.equal(resolved.resolvedViaTicketId, 'TKT-105');
  assert.deepEqual(synced.actions, ['CMP-105 resolved by TKT-105']);
  // Exactly one cross-update for one change: the ticket side is untouched.
  assert.equal(synced.changedTickets, false);
  assert.equal(synced.changedComplaints, true);
});

test('assign: unmapped category falls back to custom fault; duplicate assign returns the active ticket', () => {
  const complaint = createComplaint({
    customerId: 'cust-2',
    customerName: 'Synthetic Two',
    issueCategory: 'WAPDA / Power Outage',
    reportedAt: '2026-10-29T09:00'
  }, []);
  const first = assignTicketForComplaint([complaint], [], complaint.id, { technician: 'Lineman B' });
  assert.equal(first.created, true);
  assert.equal(first.ticket.faultPreset, '');
  assert.equal(first.ticket.customFault, 'WAPDA / Power Outage');

  const second = assignTicketForComplaint(first.complaints, first.tickets, complaint.id, { technician: 'Lineman C' });
  assert.equal(second.created, false);
  assert.equal(second.ticket.id, first.ticket.id);
  assert.equal(second.tickets.length, 1);

  // Once the linked ticket is resolved, a fresh assign creates a new one.
  const resolved = resolveTicket(first.tickets, first.ticket.id, { materialsUsed: [], billingType: 'free' });
  const third = assignTicketForComplaint(first.complaints, resolved, complaint.id, { technician: 'Lineman B' });
  assert.equal(third.created, true);
  assert.notEqual(third.ticket.id, first.ticket.id);
  assert.equal(linkedTicketsForComplaint(third.tickets, complaint.id).length, 2);
});

test('assign: missing technician and missing complaint throw; area outage carries the zone label', () => {
  const complaint = createComplaint({
    customerId: 'cust-3',
    customerName: 'Synthetic Three',
    issueCategory: 'Fiber Cut'
  }, []);
  assert.throws(() => assignTicketForComplaint([complaint], [], complaint.id, {}), /technician/i);
  assert.throws(() => assignTicketForComplaint([complaint], [], 'CMP-999', { technician: 'Lineman A' }), /not found/i);

  const outage = createComplaint({
    customerId: 'AREA_OUTAGE',
    zone: 'Test Zone',
    issueCategory: 'Fiber Cut'
  }, []);
  const assigned = assignTicketForComplaint([outage], [], outage.id, { technician: 'Lineman A' });
  assert.equal(assigned.ticket.customerId, 'AREA_OUTAGE');
  assert.equal(assigned.ticket.customerName, 'Area outage · Test Zone');
});

test('complaint resolved in the register resolves its linked ticket (free, no materials, stamped)', () => {
  const { complaints, tickets, ticket } = linkedPair();
  const resolvedComplaints = setComplaintStatus(complaints, 'CMP-101', 'Resolved', { resolvedAt: '2026-10-29T12:00' });
  const synced = syncComplaintTicketLinks(resolvedComplaints, tickets);
  const t = synced.tickets.find((entry) => entry.id === ticket.id);
  assert.equal(t.status, 'Resolved');
  assert.equal(t.billingType, 'free');
  assert.equal(t.billedAmount, 0);
  assert.deepEqual(t.materialsUsed, []);
  assert.equal(t.resolvedViaComplaintId, 'CMP-101');
  assert.deepEqual(synced.actions, [`${ticket.id} resolved by CMP-101`]);
  assert.equal(synced.changedComplaints, false);
});

test('reopening the ticket undoes a synced complaint resolution (timeline restarts)', () => {
  const { complaints, tickets, ticket } = linkedPair();
  const resolvedTickets = resolveTicket(tickets, ticket.id, {
    materialsUsed: [],
    billingType: 'free',
    referenceDate: RESOLVE_1330_PKT
  });
  const synced = syncComplaintTicketLinks(complaints, resolvedTickets);
  assert.equal(synced.complaints[0].status, 'Resolved');
  assert.equal(synced.complaints[0].downtimeHours, 3.5);

  const reopenedTickets = setTicketStatus(synced.tickets, ticket.id, 'Open');
  const resynced = syncComplaintTicketLinks(synced.complaints, reopenedTickets);
  const c = resynced.complaints[0];
  assert.equal(c.status, 'Open');
  assert.equal(c.resolvedAt, '');
  assert.equal(c.downtimeHours, null);
  // The undone resolution's provenance stamp is retired with it.
  assert.equal(c.resolvedViaTicketId, '');
  assert.deepEqual(resynced.actions, [`CMP-101 reopened with ${ticket.id}`]);
});

test('reopening the complaint undoes a synced ticket resolution', () => {
  const { complaints, tickets, ticket } = linkedPair();
  const resolvedComplaints = setComplaintStatus(complaints, 'CMP-101', 'Resolved', { resolvedAt: '2026-10-29T12:00' });
  const synced = syncComplaintTicketLinks(resolvedComplaints, tickets);
  assert.equal(synced.tickets[0].status, 'Resolved');
  assert.equal(synced.tickets[0].resolvedViaComplaintId, 'CMP-101');

  const reopenedComplaints = setComplaintStatus(synced.complaints, 'CMP-101', 'Open');
  const resynced = syncComplaintTicketLinks(reopenedComplaints, synced.tickets);
  const t = resynced.tickets.find((entry) => entry.id === ticket.id);
  assert.equal(t.status, 'Open');
  assert.equal(t.resolvedAt, '');
  assert.equal(t.resolvedViaComplaintId, '');
  assert.deepEqual(resynced.actions, [`${ticket.id} reopened with CMP-101`]);
});

test('independent resolutions are never overwritten; a manual complaint resolution stands', () => {
  const { complaints, tickets, ticket } = linkedPair();
  const resolvedTickets = resolveTicket(tickets, ticket.id, {
    materialsUsed: [],
    billingType: 'free',
    referenceDate: RESOLVE_1330_PKT
  });
  const resolvedComplaints = setComplaintStatus(complaints, 'CMP-101', 'Resolved', {
    resolvedAt: '2026-10-29T11:15',
    resolutionNote: 'Office confirmed with the customer'
  });
  const synced = syncComplaintTicketLinks(resolvedComplaints, resolvedTickets);
  assert.deepEqual(synced.actions, []);
  assert.equal(synced.changedComplaints, false);
  assert.equal(synced.changedTickets, false);
  const c = synced.complaints[0];
  assert.equal(c.resolvedAt, '2026-10-29T11:15');
  assert.equal(c.resolutionNote, 'Office confirmed with the customer');
  assert.equal(c.resolvedViaTicketId, '');

  // Reopening that manual complaint resolution does not drag the
  // independently resolved field ticket back open; the complaint-side
  // pass records a reopen guard instead, so no later pass (startup
  // included) slams the complaint shut against the same resolution.
  const reopened = setComplaintStatus(synced.complaints, 'CMP-101', 'Open');
  const guarded = syncComplaintTicketLinks(reopened, synced.tickets, { trigger: 'complaint' });
  assert.equal(guarded.tickets[0].status, 'Resolved');
  assert.equal(guarded.complaints[0].status, 'Open');
  assert.equal(guarded.complaints[0].syncReopenGuard, 'TKT-101@2026-10-29T13:30');
  assert.deepEqual(guarded.actions, []);
  const afterRestart = syncComplaintTicketLinks(guarded.complaints, guarded.tickets);
  assert.equal(afterRestart.complaints[0].status, 'Open');
  assert.deepEqual(afterRestart.actions, []);

  // But when the lineman reopens the ticket and resolves it afresh at
  // a new time, the guard no longer names that resolution: the fresh
  // resolution syncs to the complaint as usual.
  const reopenedTickets = setTicketStatus(guarded.tickets, ticket.id, 'Open');
  const cleared = syncComplaintTicketLinks(guarded.complaints, reopenedTickets, { trigger: 'ticket' });
  assert.equal(cleared.complaints[0].syncReopenGuard, '');
  const freshTickets = resolveTicket(cleared.tickets, ticket.id, {
    materialsUsed: [],
    billingType: 'free',
    referenceDate: new Date('2026-10-29T09:45:00Z') // 14:45 PKT
  });
  const resynced = syncComplaintTicketLinks(cleared.complaints, freshTickets, { trigger: 'ticket' });
  assert.equal(resynced.complaints[0].status, 'Resolved');
  assert.equal(resynced.complaints[0].resolvedAt, '2026-10-29T14:45');
  assert.equal(resynced.complaints[0].downtimeHours, 4.75);
  assert.equal(resynced.complaints[0].syncReopenGuard, '');
});

test('unlinked records and dangling links pass through untouched', () => {
  const lone = createComplaint({
    customerId: 'cust-9',
    customerName: 'Synthetic Nine',
    issueCategory: 'Other',
    reportedAt: '2026-10-29T08:00'
  }, []);
  const unlinked = createTicket({
    customerId: 'cust-9',
    customerName: 'Synthetic Nine',
    faultPreset: 'Router / IP Conflict',
    technician: 'Lineman A'
  }, []);
  const dangling = createTicket({
    customerId: 'cust-9',
    customerName: 'Synthetic Nine',
    faultPreset: 'Router / IP Conflict',
    technician: 'Lineman A',
    complaintId: 'CMP-999'
  }, [unlinked]);
  const synced = syncComplaintTicketLinks([lone], [unlinked, dangling]);
  assert.deepEqual(synced.complaints, sanitizeComplaints([lone]));
  assert.deepEqual(synced.tickets, sanitizeTickets([unlinked, dangling]));
  assert.deepEqual(synced.actions, []);
  assert.equal(synced.changedComplaints, false);
  assert.equal(synced.changedTickets, false);
});

test('loop guard: the reconcile converges — a second pass is a strict no-op', () => {
  const { complaints, tickets, ticket } = linkedPair({ note: 'Fixed at the pole' });
  const resolvedTickets = resolveTicket(tickets, ticket.id, {
    materialsUsed: [],
    billingType: 'free',
    referenceDate: RESOLVE_1330_PKT
  });
  const once = syncComplaintTicketLinks(complaints, resolvedTickets);
  assert.equal(once.actions.length, 1);
  const twice = syncComplaintTicketLinks(once.complaints, once.tickets);
  assert.deepEqual(twice.actions, []);
  assert.equal(twice.changedComplaints, false);
  assert.equal(twice.changedTickets, false);
  assert.deepEqual(twice.complaints, once.complaints);
  assert.deepEqual(twice.tickets, once.tickets);
});

test('in-progress mirrors across an open partner in both directions', () => {
  const { complaints, tickets, ticket } = linkedPair();
  const startedTickets = setTicketStatus(tickets, ticket.id, 'In Progress');
  const syncedA = syncComplaintTicketLinks(complaints, startedTickets);
  assert.equal(syncedA.complaints[0].status, 'In Progress');
  assert.deepEqual(syncedA.actions, [`CMP-101 in progress with ${ticket.id}`]);

  const startedComplaints = setComplaintStatus(complaints, 'CMP-101', 'In Progress');
  const syncedB = syncComplaintTicketLinks(startedComplaints, tickets);
  assert.equal(syncedB.tickets[0].status, 'In Progress');
  assert.deepEqual(syncedB.actions, [`${ticket.id} in progress with CMP-101`]);
});

test('manual downtime override on the complaint is honoured by a ticket-driven resolution', () => {
  const { complaints, tickets, ticket } = linkedPair();
  const manual = updateComplaint(complaints, 'CMP-101', { downtimeHours: '9' });
  assert.equal(manual[0].downtimeManual, true);
  const resolvedTickets = resolveTicket(tickets, ticket.id, {
    materialsUsed: [],
    billingType: 'free',
    referenceDate: RESOLVE_1330_PKT
  });
  const synced = syncComplaintTicketLinks(manual, resolvedTickets);
  assert.equal(synced.complaints[0].status, 'Resolved');
  assert.equal(synced.complaints[0].downtimeHours, 9);
});

test('an empty ticket note never wipes the complaint resolution note', () => {
  const complaint = createComplaint({
    customerId: 'cust-4',
    customerName: 'Synthetic Four',
    issueCategory: 'Fiber Cut',
    reportedAt: '2026-10-29T10:00',
    resolutionNote: 'Office note kept'
  }, []);
  const assigned = assignTicketForComplaint([complaint], [], complaint.id, { technician: 'Lineman A' });
  const resolvedTickets = resolveTicket(assigned.tickets, assigned.ticket.id, {
    materialsUsed: [],
    billingType: 'free',
    referenceDate: RESOLVE_1330_PKT
  });
  const synced = syncComplaintTicketLinks([complaint], resolvedTickets);
  assert.equal(synced.complaints[0].resolutionNote, 'Office note kept');
});

test('provenance stamps survive sanitize; malformed stamps are dropped', () => {
  const complaint = createComplaint({
    customerId: 'cust-5',
    customerName: 'Synthetic Five',
    issueCategory: 'Other'
  }, []);
  const cleanComplaints = sanitizeComplaints([{ ...complaint, resolvedViaTicketId: 'TKT-101' }]);
  assert.equal(cleanComplaints[0].resolvedViaTicketId, 'TKT-101');
  const dirtyComplaints = sanitizeComplaints([{ ...complaint, resolvedViaTicketId: 'hello' }]);
  assert.equal(dirtyComplaints[0].resolvedViaTicketId, '');

  const ticket = createTicket({
    customerId: 'cust-5',
    customerName: 'Synthetic Five',
    faultPreset: 'Router / IP Conflict',
    technician: 'Lineman A'
  }, []);
  const cleanTickets = sanitizeTickets([{ ...ticket, resolvedViaComplaintId: 'CMP-101' }]);
  assert.equal(cleanTickets[0].resolvedViaComplaintId, 'CMP-101');
  const dirtyTickets = sanitizeTickets([{ ...ticket, resolvedViaComplaintId: 'TKT-101' }]);
  assert.equal(dirtyTickets[0].resolvedViaComplaintId, '');
});

test('linkedTicketSummary prefers the live ticket and is null when unlinked', () => {
  const { complaints, tickets, ticket } = linkedPair();
  assert.equal(linkedTicketSummary(tickets, 'CMP-101').id, ticket.id);
  assert.equal(linkedTicketSummary(tickets, 'CMP-404'), null);
  const resolved = resolveTicket(tickets, ticket.id, { materialsUsed: [], billingType: 'free' });
  const summary = linkedTicketSummary(resolved, 'CMP-101');
  assert.equal(summary.id, ticket.id);
  assert.equal(summary.status, 'Resolved');
  assert.equal(complaints.length, 1);
});

test('SISP-39 counting still holds: a synced pair counts once for the lineman', () => {
  const { complaints, tickets, ticket } = linkedPair();
  const resolvedTickets = resolveTicket(tickets, ticket.id, {
    materialsUsed: [],
    billingType: 'free',
    referenceDate: RESOLVE_1330_PKT
  });
  const before = buildLinemanScorecards(
    { tickets: resolvedTickets, complaints, roznamchaDays: [] },
    '2026-10'
  ).find((person) => person.name === 'Lineman A');
  assert.equal(before.ticketsResolved, 1);
  assert.equal(before.complaintsResolved, 1);

  const synced = syncComplaintTicketLinks(complaints, resolvedTickets);
  assert.equal(synced.complaints[0].status, 'Resolved');
  const after = buildLinemanScorecards(
    { tickets: synced.tickets, complaints: synced.complaints, roznamchaDays: [] },
    '2026-10'
  ).find((person) => person.name === 'Lineman A');
  assert.equal(after.ticketsResolved, 1);
  assert.equal(after.complaintsResolved, 1);
});
