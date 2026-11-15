// Sharafat 66 — re-resolving a ticket wipes a settled charge — and
// reopening keeps a stale resolution stamp.
//
// A billed ticket resolved, settled and reopened used to lose its paid
// stamp on the next resolve (the charge became billable again, twice),
// and a re-resolve re-staged stock the bridge had already deducted.
// A complaint moved Resolved → In Progress kept its resolvedAt,
// downtime and resolver, so the next re-resolve kept the stale stamp.
// Now: a settled charge survives a re-resolve at the same billed
// amount (cents compared); stock is re-staged only when the new
// materials are not covered by the old staged lines; and any move out
// of Resolved clears the resolution record on both registers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTicketStockBridge,
  consumeTicketStockDeductions,
  loadTickets,
  markTicketChargePaid,
  pendingTicketChargeLines,
  resolveTicket,
  saveTickets,
  setTicketStatus,
  settleTicketCharges
} from '../complaint-tickets.js';
import {
  createComplaint,
  setComplaintStatus,
  updateComplaint
} from '../complaint-register.js';
import {
  assignTicketForComplaint,
  syncComplaintTicketLinks
} from '../complaint-ticket-sync.js';
import { addMovement, availableFor } from '../inventory-book.js';

// 10:00 / 11:00 / 12:00 in Pakistan time, expressed as UTC instants so
// the pins are exact on any host (ticket resolvedAt is Asia/Karachi).
const RESOLVE_1000_PKT = new Date('2026-11-10T05:00:00Z');
const SETTLE_1100_PKT = new Date('2026-11-10T06:00:00Z');
const RESOLVE_1200_PKT = new Date('2026-11-12T07:00:00Z');

const patchCord500 = [{ key: 'patch-cord', qty: 1, amount: 500 }];
const patchCord1000 = [{ key: 'patch-cord', qty: 2, amount: 1000 }];
const fiber10m = [{ key: 'fiber', qty: 10, amount: 100 }];

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); }
  };
}

const ticketBase = (overrides = {}) => ({
  id: 'TKT-101',
  customerId: 'c1',
  customerName: 'Test Customer 11',
  complaintId: '',
  faultPreset: 'Fiber Cut / Splice Loss',
  customFault: '',
  technician: 'Saad',
  priority: 'Normal',
  status: 'Open',
  createdAt: '2026-11-10T09:00',
  resolvedAt: '',
  note: '',
  materialsUsed: [],
  billingType: 'free',
  billedAmount: 0,
  chargePaid: false,
  chargePaidAt: '',
  chargePaymentId: '',
  stockDeductions: [],
  stockDeducted: false,
  ...overrides
});

const complaintBase = (overrides = {}) => ({
  id: 'CMP-101',
  customerId: 'c1',
  customerName: 'Test Customer 11',
  zone: 'Shahdara Town',
  issueCategory: 'Fiber Cut',
  reportedAt: '2026-11-10T07:00',
  resolvedAt: '',
  downtimeHours: null,
  downtimeManual: false,
  status: 'Open',
  resolutionNote: '',
  resolvedByLineman: '',
  createdAt: '',
  ...overrides
});

/** Resolve TKT-101 billed for one patch cord (Rs 500) at 10:00 PKT. */
function resolvedBilled(referenceDate = RESOLVE_1000_PKT) {
  return resolveTicket([ticketBase()], 'TKT-101', {
    materialsUsed: patchCord500,
    billingType: 'billed',
    referenceDate
  });
}

/** The same ticket settled by payment PAY-1001 at 11:00 PKT. */
function settledBilled() {
  const resolved = resolvedBilled();
  const lines = pendingTicketChargeLines(resolved, 'c1');
  assert.deepEqual(lines, [{ ticketId: 'TKT-101', amount: 500 }]);
  return settleTicketCharges(resolved, lines, 'PAY-1001', SETTLE_1100_PKT);
}

function outQty(movements, itemId) {
  return movements
    .filter((m) => m && m.itemId === itemId && m.kind === 'out')
    .reduce((sum, m) => sum + Number(m.qty || 0), 0);
}

function appendMovement(movements, deduction) {
  return [...(Array.isArray(movements) ? movements : []), deduction];
}

// --- Charge preservation (D1) ------------------------------------------

test('receipt-settled charge survives a re-resolve at the same amount', () => {
  const settled = settledBilled();
  assert.equal(settled[0].chargePaid, true);
  assert.equal(settled[0].chargePaidAt, '2026-11-10T11:00');
  assert.equal(settled[0].chargePaymentId, 'PAY-1001');
  const reopened = setTicketStatus(settled, 'TKT-101', 'Open');
  assert.equal(reopened[0].status, 'Open');
  const reresolved = resolveTicket(reopened, 'TKT-101', {
    materialsUsed: patchCord500,
    billingType: 'billed',
    referenceDate: RESOLVE_1200_PKT
  });
  assert.equal(reresolved[0].billedAmount, 500);
  assert.equal(reresolved[0].chargePaid, true);
  assert.equal(reresolved[0].chargePaidAt, '2026-11-10T11:00');
  assert.equal(reresolved[0].chargePaymentId, 'PAY-1001');
  assert.deepEqual(pendingTicketChargeLines(reresolved, 'c1'), []);
});

test('manual mark-paid survives a re-resolve at the same amount (no payment id)', () => {
  const resolved = resolvedBilled();
  const marked = markTicketChargePaid(resolved, 'TKT-101', true, SETTLE_1100_PKT);
  assert.equal(marked[0].chargePaid, true);
  assert.equal(marked[0].chargePaymentId, '');
  const reopened = setTicketStatus(marked, 'TKT-101', 'Open');
  const reresolved = resolveTicket(reopened, 'TKT-101', {
    materialsUsed: patchCord500,
    billingType: 'billed',
    referenceDate: RESOLVE_1200_PKT
  });
  assert.equal(reresolved[0].chargePaid, true);
  assert.equal(reresolved[0].chargePaidAt, '2026-11-10T11:00');
  assert.equal(reresolved[0].chargePaymentId, '');
  assert.deepEqual(pendingTicketChargeLines(reresolved, 'c1'), []);
});

test('a changed amount resets the charge and re-bills at the new amount', () => {
  const settled = settledBilled();
  const reopened = setTicketStatus(settled, 'TKT-101', 'Open');
  const reresolved = resolveTicket(reopened, 'TKT-101', {
    materialsUsed: patchCord1000,
    billingType: 'billed',
    referenceDate: RESOLVE_1200_PKT
  });
  assert.equal(reresolved[0].billedAmount, 1000);
  assert.equal(reresolved[0].chargePaid, false);
  assert.equal(reresolved[0].chargePaidAt, '');
  assert.equal(reresolved[0].chargePaymentId, '');
  assert.deepEqual(pendingTicketChargeLines(reresolved, 'c1'), [{ ticketId: 'TKT-101', amount: 1000 }]);
});

test('a billed→free flip resets the charge', () => {
  const settled = settledBilled();
  const reopened = setTicketStatus(settled, 'TKT-101', 'Open');
  const reresolved = resolveTicket(reopened, 'TKT-101', {
    materialsUsed: [],
    billingType: 'free',
    referenceDate: RESOLVE_1200_PKT
  });
  assert.equal(reresolved[0].billedAmount, 0);
  assert.equal(reresolved[0].chargePaid, false);
  assert.equal(reresolved[0].chargePaidAt, '');
  assert.equal(reresolved[0].chargePaymentId, '');
  assert.deepEqual(pendingTicketChargeLines(reresolved, 'c1'), []);
});

test('a 1-paisa change resets the charge, float dust does not (R3)', () => {
  const settled = settledBilled();
  const reopened = setTicketStatus(settled, 'TKT-101', 'Open');
  const changed = resolveTicket(reopened, 'TKT-101', {
    materialsUsed: [{ key: 'patch-cord', qty: 1, amount: 500.01 }],
    billingType: 'billed',
    referenceDate: RESOLVE_1200_PKT
  });
  assert.equal(changed[0].chargePaid, false);
  const dust = resolveTicket(reopened, 'TKT-101', {
    materialsUsed: [{ key: 'patch-cord', qty: 1, amount: 500.004 }],
    billingType: 'billed',
    referenceDate: RESOLVE_1200_PKT
  });
  assert.equal(dust[0].billedAmount, 500);
  assert.equal(dust[0].chargePaid, true);
  assert.equal(dust[0].chargePaymentId, 'PAY-1001');
});

test('resolving an already-resolved ticket still throws', () => {
  const resolved = resolvedBilled();
  assert.throws(
    () => resolveTicket(resolved, 'TKT-101', { materialsUsed: patchCord500, billingType: 'billed' }),
    /already resolved/
  );
});

// --- Stock staging (D2) ------------------------------------------------

test('same materials re-resolve deducts stock once, without a bridge pass', () => {
  const resolved = resolvedBilled();
  assert.equal(resolved[0].stockDeductions.length, 1);
  assert.equal(resolved[0].stockDeductions[0].itemId, 'patch-cord');
  assert.equal(resolved[0].stockDeducted, false);
  const first = consumeTicketStockDeductions(resolved[0], [], appendMovement);
  assert.equal(outQty(first.movements, 'patch-cord'), 1);
  assert.equal(first.ticket.stockDeducted, true);
  // No bridge pass: the reopen does NOT reverse the deduction.
  const reopened = setTicketStatus([first.ticket], 'TKT-101', 'Open');
  assert.equal(reopened[0].stockDeducted, true);
  assert.equal(reopened[0].stockDeductions.length, 1);
  const reresolved = resolveTicket(reopened, 'TKT-101', {
    materialsUsed: patchCord500,
    billingType: 'billed',
    referenceDate: RESOLVE_1200_PKT
  });
  // Covered-only preserve: the old staged lines (old resolution date)
  // and the deducted flag survive; nothing fresh is staged.
  assert.equal(reresolved[0].stockDeductions.length, 1);
  assert.equal(reresolved[0].stockDeductions[0].itemId, 'patch-cord');
  assert.equal(reresolved[0].stockDeductions[0].qty, 1);
  assert.equal(reresolved[0].stockDeductions[0].date, '2026-11-10');
  assert.equal(reresolved[0].stockDeducted, true);
  const second = consumeTicketStockDeductions(reresolved[0], first.movements, appendMovement);
  assert.equal(outQty(second.movements, 'patch-cord'), 1);
  assert.equal(second.movements.length, first.movements.length);
});

test('changed materials re-stage fresh (more qty, and a different material)', () => {
  const resolved = resolvedBilled();
  const first = consumeTicketStockDeductions(resolved[0], [], appendMovement);
  const reopened = setTicketStatus([first.ticket], 'TKT-101', 'Open');
  const more = resolveTicket(reopened, 'TKT-101', {
    materialsUsed: patchCord1000,
    billingType: 'billed',
    referenceDate: RESOLVE_1200_PKT
  });
  assert.equal(more[0].stockDeducted, false);
  assert.equal(more[0].stockDeductions.length, 1);
  assert.equal(more[0].stockDeductions[0].itemId, 'patch-cord');
  assert.equal(more[0].stockDeductions[0].qty, 2);
  assert.equal(more[0].stockDeductions[0].date, '2026-11-12');
  const reopenedAgain = setTicketStatus(more, 'TKT-101', 'Open');
  const different = resolveTicket(reopenedAgain, 'TKT-101', {
    materialsUsed: fiber10m,
    billingType: 'billed',
    referenceDate: RESOLVE_1200_PKT
  });
  assert.equal(different[0].stockDeducted, false);
  assert.equal(different[0].stockDeductions.length, 1);
  assert.equal(different[0].stockDeductions[0].itemId, 'fiber-2core');
  assert.equal(different[0].stockDeductions[0].qty, 10);
});

test('re-resolving with no materials keeps the old deduction record', () => {
  const resolved = resolvedBilled();
  const first = consumeTicketStockDeductions(resolved[0], [], appendMovement);
  const reopened = setTicketStatus([first.ticket], 'TKT-101', 'Open');
  const reresolved = resolveTicket(reopened, 'TKT-101', {
    materialsUsed: [],
    billingType: 'free',
    referenceDate: RESOLVE_1200_PKT
  });
  // No new lines to cover: the old deduction record stands, so the
  // bridge still has its reversal record (D2(b) vacuous cover).
  assert.equal(reresolved[0].stockDeductions.length, 1);
  assert.equal(reresolved[0].stockDeductions[0].itemId, 'patch-cord');
  assert.equal(reresolved[0].stockDeducted, true);
});

test('live flow: bridge reversal on reopen, re-resolve deducts fresh, net one deduction', () => {
  let movements = addMovement([], {
    itemId: 'patch-cord', kind: 'in', qty: 10, date: '2026-11-01', customerName: '', note: 'Purchase'
  });
  assert.equal(availableFor(movements, 'patch-cord'), 10);
  const resolved = resolvedBilled();
  const first = applyTicketStockBridge(resolved, movements, addMovement);
  assert.equal(availableFor(first.movements, 'patch-cord'), 9);
  assert.equal(first.tickets[0].stockDeducted, true);
  const reopened = setTicketStatus(first.tickets, 'TKT-101', 'Open');
  const reversed = applyTicketStockBridge(reopened, first.movements, addMovement, { referenceDate: RESOLVE_1200_PKT });
  assert.deepEqual(reversed.reversed, ['TKT-101']);
  assert.equal(availableFor(reversed.movements, 'patch-cord'), 10);
  assert.equal(reversed.tickets[0].stockDeducted, false);
  assert.deepEqual(reversed.tickets[0].stockDeductions, []);
  const reresolved = resolveTicket(reversed.tickets, 'TKT-101', {
    materialsUsed: patchCord500,
    billingType: 'billed',
    referenceDate: RESOLVE_1200_PKT
  });
  assert.equal(reresolved[0].stockDeducted, false);
  assert.equal(reresolved[0].stockDeductions.length, 1);
  const second = applyTicketStockBridge(reresolved, reversed.movements, addMovement);
  assert.equal(availableFor(second.movements, 'patch-cord'), 9);
  assert.equal(second.tickets[0].stockDeducted, true);
});

// --- Complaint resolution stamp (D3 + D4) ------------------------------

test('complaint Resolved → In Progress clears stamp, downtime, manual flag and resolver', () => {
  const created = createComplaint({
    customerId: 'c1', customerName: 'Test Customer 11', zone: 'Shahdara Town',
    issueCategory: 'Fiber Cut', reportedAt: '2026-11-10T07:00'
  }, []);
  const resolved = setComplaintStatus([created], 'CMP-101', 'Resolved', {
    resolvedAt: '2026-11-10T10:00', resolvedByLineman: 'Saad'
  });
  assert.equal(resolved[0].resolvedAt, '2026-11-10T10:00');
  assert.equal(resolved[0].downtimeHours, 3);
  assert.equal(resolved[0].resolvedByLineman, 'Saad');
  const inProgress = setComplaintStatus(resolved, 'CMP-101', 'In Progress');
  assert.equal(inProgress[0].status, 'In Progress');
  assert.equal(inProgress[0].resolvedAt, '');
  assert.equal(inProgress[0].downtimeHours, null);
  assert.equal(inProgress[0].downtimeManual, false);
  assert.equal(inProgress[0].resolvedByLineman, '');
});

test('complaint re-resolve with no explicit time stamps fresh and recomputes downtime (R7)', () => {
  const created = createComplaint({
    customerId: 'c1', customerName: 'Test Customer 11', zone: 'Shahdara Town',
    issueCategory: 'Fiber Cut', reportedAt: '2026-11-10T07:00'
  }, []);
  const resolved = setComplaintStatus([created], 'CMP-101', 'Resolved', {
    resolvedAt: '2026-11-10T10:00', resolvedByLineman: 'Saad'
  });
  assert.equal(resolved[0].downtimeHours, 3);
  const inProgress = setComplaintStatus(resolved, 'CMP-101', 'In Progress');
  // The UI resolve path passes NO explicit time — only a referenceDate.
  const reresolved = setComplaintStatus(inProgress, 'CMP-101', 'Resolved', {
    referenceDate: RESOLVE_1200_PKT
  });
  assert.equal(reresolved[0].resolvedAt, '2026-11-12T12:00');
  assert.equal(reresolved[0].downtimeHours, 53);
});

test('complaint reopen to Open still clears the stamp', () => {
  const created = createComplaint({
    customerId: 'c1', customerName: 'Test Customer 11', zone: 'Shahdara Town',
    issueCategory: 'Fiber Cut', reportedAt: '2026-11-10T07:00'
  }, []);
  const resolved = setComplaintStatus([created], 'CMP-101', 'Resolved', {
    resolvedAt: '2026-11-10T10:00', resolvedByLineman: 'Saad'
  });
  const reopened = setComplaintStatus(resolved, 'CMP-101', 'Open');
  assert.equal(reopened[0].resolvedAt, '');
  assert.equal(reopened[0].downtimeHours, null);
  assert.equal(reopened[0].downtimeManual, false);
  assert.equal(reopened[0].resolvedByLineman, '');
});

test('manual downtime override is cleared on reopen and recomputed on re-resolve (D4)', () => {
  const created = createComplaint({
    customerId: 'c1', customerName: 'Test Customer 11', zone: 'Shahdara Town',
    issueCategory: 'Fiber Cut', reportedAt: '2026-11-10T07:00'
  }, []);
  const manual = updateComplaint([created], 'CMP-101', { downtimeHours: '9' });
  assert.equal(manual[0].downtimeManual, true);
  assert.equal(manual[0].downtimeHours, 9);
  const resolved = setComplaintStatus(manual, 'CMP-101', 'Resolved', {
    resolvedAt: '2026-11-10T10:00'
  });
  assert.equal(resolved[0].downtimeHours, 9);
  const inProgress = setComplaintStatus(resolved, 'CMP-101', 'In Progress');
  assert.equal(inProgress[0].downtimeManual, false);
  assert.equal(inProgress[0].downtimeHours, null);
  const reresolved = setComplaintStatus(inProgress, 'CMP-101', 'Resolved', {
    referenceDate: RESOLVE_1200_PKT
  });
  assert.equal(reresolved[0].resolvedAt, '2026-11-12T12:00');
  assert.equal(reresolved[0].downtimeHours, 53);
});

// --- Ticket resolution stamp (D3) ---------------------------------------

test('ticket Resolved → In Progress clears the stamp in the returned list (R6)', () => {
  const resolved = resolveTicket([ticketBase()], 'TKT-101', {
    materialsUsed: patchCord500,
    billingType: 'billed',
    referenceDate: RESOLVE_1000_PKT
  });
  assert.equal(resolved[0].resolvedAt, '2026-11-10T10:00');
  const inProgress = setTicketStatus(resolved, 'TKT-101', 'In Progress');
  assert.equal(inProgress[0].status, 'In Progress');
  assert.equal(inProgress[0].resolvedAt, '');
  // The sanitizer strips the stamp on save+reload anyway (S5b) — the
  // fix is for the in-memory record and unsaved reads.
  const storage = memoryStorage();
  saveTickets(inProgress, storage);
  const reloaded = loadTickets(storage);
  assert.equal(reloaded[0].resolvedAt, '');
});

test('ticket re-resolve stamps fresh', () => {
  const resolved = resolveTicket([ticketBase()], 'TKT-101', {
    materialsUsed: patchCord500,
    billingType: 'billed',
    referenceDate: RESOLVE_1000_PKT
  });
  const inProgress = setTicketStatus(resolved, 'TKT-101', 'In Progress');
  const reresolved = resolveTicket(inProgress, 'TKT-101', {
    materialsUsed: patchCord500,
    billingType: 'billed',
    referenceDate: RESOLVE_1200_PKT
  });
  assert.equal(reresolved[0].resolvedAt, '2026-11-12T12:00');
});

// --- Sync interplay (D5 + R9) ------------------------------------------

test('sync: reopen + fresh re-resolve does not resurrect the old complaint resolution', () => {
  const complaint = createComplaint({
    customerId: 'c1', customerName: 'Test Customer 11',
    issueCategory: 'Fiber Cut', reportedAt: '2026-11-10T07:00'
  }, []);
  const assigned = assignTicketForComplaint([complaint], [], complaint.id, { technician: 'Saad' });
  const resolvedTickets = resolveTicket(assigned.tickets, 'TKT-101', {
    materialsUsed: [], billingType: 'free', referenceDate: RESOLVE_1000_PKT
  });
  const synced = syncComplaintTicketLinks([complaint], resolvedTickets);
  assert.equal(synced.complaints[0].status, 'Resolved');
  assert.equal(synced.complaints[0].resolvedAt, '2026-11-10T10:00');
  assert.equal(synced.complaints[0].downtimeHours, 3);
  assert.equal(synced.complaints[0].resolvedViaTicketId, 'TKT-101');
  // Reopen the pair — the ticket to Open, the complaint to In Progress
  // (the move whose stale stamp is the bug: the Open branch cleared it
  // on base too, the In Progress branch did not). Then run the sync so
  // Rule 0 retires the provenance stamps of the undone resolution and
  // Rule 4 mirrors the ticket to In Progress.
  const reopenedTickets = setTicketStatus(synced.tickets, 'TKT-101', 'Open');
  const reopenedComplaints = setComplaintStatus(synced.complaints, 'CMP-101', 'In Progress');
  assert.equal(reopenedComplaints[0].resolvedAt, '');
  assert.equal(reopenedComplaints[0].downtimeHours, null);
  const cleared = syncComplaintTicketLinks(reopenedComplaints, reopenedTickets);
  assert.equal(cleared.complaints[0].resolvedViaTicketId, '');
  assert.equal(cleared.tickets[0].status, 'In Progress');
  // Fresh re-resolve (UI path: no explicit time) + sync. Rule 1 must
  // resolve the complaint against the FRESH ticket stamp — on base the
  // stale complaint stamp survived the reopen and the sync kept it.
  const reresolved = resolveTicket(cleared.tickets, 'TKT-101', {
    materialsUsed: [], billingType: 'free', referenceDate: RESOLVE_1200_PKT
  });
  assert.equal(reresolved[0].resolvedAt, '2026-11-12T12:00');
  const resynced = syncComplaintTicketLinks(cleared.complaints, reresolved);
  assert.equal(resynced.complaints[0].status, 'Resolved');
  assert.equal(resynced.complaints[0].resolvedAt, '2026-11-12T12:00');
  assert.equal(resynced.complaints[0].downtimeHours, 53);
  assert.equal(resynced.complaints[0].resolvedViaTicketId, 'TKT-101');
});
