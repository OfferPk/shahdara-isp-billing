// SISP-44: Complaint Register (CMP-101 SISP-15) ↔ Lineman Worklist
// Ticket (TKT-101 SISP-12) Two-Way Sync. Pure-function tests on synthetic
// data only. Spec test criterion (verbatim): Creating CMP-105 at 10:00,
// creating linked TKT-105, and resolving TKT-105 at 13:30 marks CMP-105
// Resolved with downtimeHours = 3.5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildComplaintSummary,
  createComplaint,
  sanitizeComplaints,
  setComplaintStatus,
  updateComplaint
} from '../complaint-register.js';
import {
  consumeTicketStockDeductions,
  createTicket,
  resolveTicket,
  sanitizeTickets,
  setTicketStatus,
  updateTicket
} from '../complaint-tickets.js';
import {
  assignTicketForComplaint,
  bulkAssignTicketsForComplaints,
  collectTechnicianNames,
  linkedTicketSummary,
  linkedTicketsForComplaint,
  openUnlinkedComplaints,
  syncComplaintTicketLinks
} from '../complaint-ticket-sync.js';
import { buildLinemanScorecards } from '../lineman-scorecard.js';
import { TRANSLATIONS } from '../nav-language.js';

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

test('reverse sync carries the SAME time and note: complaint resolved 12:00 resolves its ticket at 12:00', () => {
  const { complaints, tickets, ticket } = linkedPair({ note: 'Old field note' });
  const resolvedComplaints = setComplaintStatus(complaints, 'CMP-101', 'Resolved', {
    resolvedAt: '2026-10-29T12:00',
    resolutionNote: 'Fixed from office'
  });
  const synced = syncComplaintTicketLinks(resolvedComplaints, tickets, { trigger: 'complaint' });
  const t = synced.tickets.find((entry) => entry.id === ticket.id);
  assert.equal(t.status, 'Resolved');
  // Verbatim wall time — exact on any host timezone, not re-zoned.
  assert.equal(t.resolvedAt, '2026-10-29T12:00');
  assert.equal(t.note, 'Fixed from office');
  assert.equal(t.resolvedViaComplaintId, 'CMP-101');
  assert.deepEqual(synced.actions, [`${ticket.id} resolved by CMP-101`]);
});

test('reverse sync with an empty complaint note keeps the ticket note', () => {
  const { complaints, tickets, ticket } = linkedPair({ note: 'Field note kept' });
  const resolvedComplaints = setComplaintStatus(complaints, 'CMP-101', 'Resolved', {
    resolvedAt: '2026-10-29T12:00',
    resolutionNote: ''
  });
  const synced = syncComplaintTicketLinks(resolvedComplaints, tickets, { trigger: 'complaint' });
  const t = synced.tickets.find((entry) => entry.id === ticket.id);
  assert.equal(t.status, 'Resolved');
  assert.equal(t.resolvedAt, '2026-10-29T12:00');
  assert.equal(t.note, 'Field note kept');
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

// ---- SISP-177: bulk assign of open unlinked complaints + the material
// badge on synced register cards. Synthetic data only. ----

function bulkFixture() {
  // Six complaints: three bulk targets (Open, Open, In Progress — none
  // linked), one Resolved unlinked, one Open with a live linked
  // ticket, one Open whose only linked ticket is already Resolved.
  let complaints = [];
  const mk = (input) => {
    const entry = createComplaint(input, complaints);
    complaints = [...complaints, entry];
    return entry;
  };
  const openA = mk({ customerId: 'cust-a', customerName: 'Synthetic A', issueCategory: 'Fiber Cut', reportedAt: '2026-10-29T08:00' });
  const openB = mk({ customerId: 'cust-b', customerName: 'Synthetic B', issueCategory: 'Other', reportedAt: '2026-10-29T08:30' });
  const progC = mk({ customerId: 'cust-c', customerName: 'Synthetic C', issueCategory: 'Router / Wi-Fi Config', reportedAt: '2026-10-29T09:00' });
  complaints = setComplaintStatus(complaints, progC.id, 'In Progress');
  const resolvedD = mk({ customerId: 'cust-d', customerName: 'Synthetic D', issueCategory: 'Other', reportedAt: '2026-10-29T07:00' });
  complaints = setComplaintStatus(complaints, resolvedD.id, 'Resolved', { resolvedAt: '2026-10-29T07:45' });
  const linkedE = mk({ customerId: 'cust-e', customerName: 'Synthetic E', issueCategory: 'Fiber Cut', reportedAt: '2026-10-29T09:15' });
  const doneF = mk({ customerId: 'cust-f', customerName: 'Synthetic F', issueCategory: 'Fiber Cut', reportedAt: '2026-10-29T06:00' });

  const assignE = assignTicketForComplaint(complaints, [], linkedE.id, { technician: 'Lineman B' });
  const assignF = assignTicketForComplaint(complaints, assignE.tickets, doneF.id, { technician: 'Lineman B' });
  const tickets = resolveTicket(assignF.tickets, assignF.ticket.id, { materialsUsed: [], billingType: 'free' });
  return { complaints, tickets, openA, openB, progC, resolvedD, linkedE, doneF };
}

test('SISP-177 bulk: the open unlinked set excludes resolved and any-linked complaints', () => {
  const { complaints, tickets, openA, openB, progC } = bulkFixture();
  assert.deepEqual(
    openUnlinkedComplaints(complaints, tickets).map((c) => c.id),
    [openA.id, openB.id, progC.id]
  );
});

test('SISP-177 bulk: one click assigns every open unlinked complaint to the chosen lineman', () => {
  const { complaints, tickets, openA, openB, progC, resolvedD, linkedE, doneF } = bulkFixture();
  const summaryBefore = buildComplaintSummary(complaints);
  const result = bulkAssignTicketsForComplaints(complaints, tickets, 'Lineman A', {
    referenceDate: new Date('2026-10-29T05:00:00Z')
  });
  assert.equal(result.assigned.length, 3);
  assert.deepEqual(result.assigned.map((a) => a.complaintId), [openA.id, openB.id, progC.id]);
  for (const entry of result.assigned) {
    assert.equal(entry.created, true);
    assert.equal(entry.ticket.technician, 'Lineman A');
    assert.equal(entry.ticket.status, 'Open');
  }
  // Category mapping rode the single-assign seam: a mapped category
  // became its preset, an unmapped one the custom fault text.
  assert.equal(result.assigned[0].ticket.faultPreset, 'Fiber Cut / Splice Loss');
  assert.equal(result.assigned[1].ticket.customFault, 'Other');
  assert.equal(result.assigned[2].ticket.faultPreset, 'Router / IP Conflict');
  // Untouched: the resolved complaint and both already-linked ones got
  // no new ticket.
  assert.equal(linkedTicketsForComplaint(result.tickets, resolvedD.id).length, 0);
  assert.equal(linkedTicketsForComplaint(result.tickets, linkedE.id).length, 1);
  assert.equal(linkedTicketsForComplaint(result.tickets, doneF.id).length, 1);
  assert.equal(result.tickets.length, tickets.length + 3);
  // Assignment never mutates the register itself.
  assert.deepEqual(result.complaints, sanitizeComplaints(complaints));
  assert.deepEqual(buildComplaintSummary(result.complaints), summaryBefore);
  // The bar's count after assigning is zero.
  assert.deepEqual(openUnlinkedComplaints(result.complaints, result.tickets), []);
});

test('SISP-177 bulk: the bulk result is identical to assigning one by one through the single seam', () => {
  const { complaints, tickets } = bulkFixture();
  const when = new Date('2026-10-29T05:00:00Z');
  const bulk = bulkAssignTicketsForComplaints(complaints, tickets, 'Lineman A', { referenceDate: when });
  let seqComplaints = sanitizeComplaints(complaints);
  let seqTickets = sanitizeTickets(tickets);
  for (const target of openUnlinkedComplaints(complaints, tickets)) {
    const step = assignTicketForComplaint(seqComplaints, seqTickets, target.id, {
      technician: 'Lineman A',
      referenceDate: when
    });
    seqComplaints = step.complaints;
    seqTickets = step.tickets;
  }
  assert.deepEqual(bulk.tickets, seqTickets);
  assert.deepEqual(bulk.complaints, seqComplaints);
});

test('SISP-177 bulk: no targets is a no-op; a blank lineman throws before creating anything', () => {
  const { complaints, tickets } = bulkFixture();
  const first = bulkAssignTicketsForComplaints(complaints, tickets, 'Lineman A');
  const second = bulkAssignTicketsForComplaints(first.complaints, first.tickets, 'Lineman A');
  assert.deepEqual(second.assigned, []);
  assert.deepEqual(second.tickets, first.tickets);
  assert.throws(() => bulkAssignTicketsForComplaints(complaints, tickets, ''), /lineman/i);
  assert.throws(() => bulkAssignTicketsForComplaints(complaints, tickets, '   '), /lineman/i);
  // The throws left the (pure) inputs untouched: a valid run still
  // assigns exactly the three targets.
  assert.equal(bulkAssignTicketsForComplaints(complaints, tickets, 'Lineman A').assigned.length, 3);
});

test('SISP-177 picker: technician names come from tickets, grouped case/space-insensitively', () => {
  let tickets = [];
  const mk = (technician) => {
    const ticket = createTicket({
      customerId: 'cust-x',
      customerName: 'Synthetic X',
      faultPreset: 'Router / IP Conflict',
      technician
    }, tickets);
    tickets = [...tickets, ticket];
  };
  mk('Lineman B');
  mk(' lineman  b ');
  mk('Lineman A');
  mk('LINEMAN A');
  // First-seen spelling wins per group; the list is sorted by name.
  assert.deepEqual(collectTechnicianNames(tickets), ['Lineman A', 'Lineman B']);
  assert.deepEqual(collectTechnicianNames([]), []);
});

test('SISP-177 badge: a resolved ticket with consumed stock deductions shows its recorded materials', () => {
  const { tickets, ticket } = linkedPair();
  const resolved = resolveTicket(tickets, ticket.id, {
    materialsUsed: [
      { key: 'fiber', qty: 30, amount: 0 },
      { key: 'patch-cord', qty: 1, amount: 250 }
    ],
    billingType: 'billed',
    referenceDate: RESOLVE_1330_PKT
  });
  // Resolved with materials but the SISP-42 bridge has not consumed
  // the deductions yet: no badge.
  assert.equal(linkedTicketSummary(resolved, 'CMP-101').materialBadge, null);
  const consumed = consumeTicketStockDeductions(resolved[0], [], (movements, deduction) => [...movements, deduction]);
  assert.equal(consumed.ticket.stockDeducted, true);
  const summary = linkedTicketSummary([consumed.ticket], 'CMP-101');
  assert.equal(summary.status, 'Resolved');
  assert.deepEqual(summary.materialBadge, {
    ticketId: ticket.id,
    items: ['2-Core Fiber · 30 m', 'Patch Cord · 1 · PKR 250']
  });
});

test('SISP-177 badge: no badge when unlinked, unresolved, or resolved without deductions', () => {
  const { tickets, ticket } = linkedPair();
  // Unresolved linked ticket.
  assert.equal(linkedTicketSummary(tickets, 'CMP-101').materialBadge, null);
  // No linked ticket at all: no summary, hence no badge.
  assert.equal(linkedTicketSummary(tickets, 'CMP-404'), null);
  // Resolved with no materials: nothing was ever deducted.
  const resolvedEmpty = resolveTicket(tickets, ticket.id, {
    materialsUsed: [],
    billingType: 'free',
    referenceDate: RESOLVE_1330_PKT
  });
  assert.equal(linkedTicketSummary(resolvedEmpty, 'CMP-101').materialBadge, null);
});

test('SISP-177 bulk pairs still count once for the lineman in the scorecard', () => {
  const { complaints, tickets, openA } = bulkFixture();
  const bulk = bulkAssignTicketsForComplaints(complaints, tickets, 'Lineman A', {
    referenceDate: new Date('2026-10-29T05:00:00Z')
  });
  const target = bulk.assigned.find((a) => a.complaintId === openA.id).ticket;
  const resolved = resolveTicket(bulk.tickets, target.id, {
    materialsUsed: [],
    billingType: 'free',
    referenceDate: RESOLVE_1330_PKT
  });
  const synced = syncComplaintTicketLinks(bulk.complaints, resolved);
  assert.equal(synced.complaints.find((c) => c.id === openA.id).status, 'Resolved');
  const person = buildLinemanScorecards(
    { tickets: synced.tickets, complaints: synced.complaints, roznamchaDays: [] },
    '2026-10'
  ).find((entry) => entry.name === 'Lineman A');
  assert.equal(person.ticketsResolved, 1);
  assert.equal(person.complaintsResolved, 1);
});

test('SISP-177 i18n: the bulk and badge keys exist in both dictionaries with their placeholders', () => {
  for (const key of ['cmp_bulk_count', 'cmp_bulk_assign_btn', 'cmp_bulk_assigned_toast', 'cmp_materials_badge']) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
  for (const lang of ['en', 'ur']) {
    assert.ok(TRANSLATIONS[lang].cmp_bulk_count.includes('{count}'), `${lang} cmp_bulk_count placeholder`);
    assert.ok(TRANSLATIONS[lang].cmp_bulk_assigned_toast.includes('{count}'), `${lang} toast count placeholder`);
    assert.ok(TRANSLATIONS[lang].cmp_bulk_assigned_toast.includes('{technician}'), `${lang} toast technician placeholder`);
    assert.ok(TRANSLATIONS[lang].cmp_materials_badge.includes('{items}'), `${lang} badge items placeholder`);
  }
});
