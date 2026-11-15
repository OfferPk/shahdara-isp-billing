// Sharafat 67 — ticket and complaint ids are never re-issued once used.
// A monotonic counter in its own localStorage keys (sisp_tickets_next_id_v1 /
// sisp_complaints_next_id_v1) is the floor: creates read max(counter,
// max-over-list) and bump the counter, so a deleted max id — dropped by a
// sanitize, or lost to an older backup — can never come back. The pure
// generators (nextTicketId / nextComplaintId) are untouched; without
// storage the creators behave exactly like them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTicketSeed,
  createTicket,
  markTicketChargePaid,
  nextTicketId,
  pendingTicketChargeLines,
  readTicketCounter,
  resolveTicket,
  seedTicketCounter,
  settleTicketCharges,
  unsettleTicketChargesForPayment,
  writeTicketCounter
} from '../complaint-tickets.js';
import {
  computeComplaintSeed,
  createComplaint,
  nextComplaintId,
  readComplaintCounter,
  seedComplaintCounter,
  writeComplaintCounter
} from '../complaint-register.js';
import { followupsForComplaint } from '../complaint-followup.js';
import { linkedTicketsForComplaint } from '../complaint-ticket-sync.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); }
  };
}

// 10:00 / 11:00 / 12:00 in Pakistan time, expressed as UTC instants.
const DATE_1000_PKT = new Date('2026-11-10T05:00:00Z');
const SETTLE_1100_PKT = new Date('2026-11-10T06:00:00Z');
const RESOLVE_1200_PKT = new Date('2026-11-12T07:00:00Z');
const patchCord500 = [{ key: 'patch-cord', qty: 1, amount: 500 }];

const ticketBase = (overrides = {}) => ({
  id: 'TKT-101',
  customerId: 'c1',
  customerName: 'Test Customer 1',
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
  resolvedViaTicketId: '',
  syncReopenGuard: '',
  createdAt: '',
  ...overrides
});

const ticketInput = () => ({
  customerId: 'c1', customerName: 'Test Customer 1',
  faultPreset: 'Fiber Cut / Splice Loss', technician: 'Saad'
});

const complaintInput = () => ({
  customerId: 'c1', customerName: 'Test Customer 11',
  zone: 'Shahdara Town', issueCategory: 'Fiber Cut', reportedAt: '2026-11-10T07:00'
});

function rangeTickets(from, to) {
  const out = [];
  for (let n = from; n <= to; n++) out.push(ticketBase({ id: `TKT-${n}` }));
  return out;
}

function rangeComplaints(from, to) {
  const out = [];
  for (let n = from; n <= to; n++) out.push(complaintBase({ id: `CMP-${n}` }));
  return out;
}

// --- Tickets: the counter -------------------------------------------------

test('counter: a deleted max ticket id is never re-issued', () => {
  const storage = memoryStorage();
  writeTicketCounter(storage, 121); // TKT-120 was issued before its record dropped
  const created = createTicket(ticketInput(), rangeTickets(101, 119), DATE_1000_PKT, storage);
  assert.equal(created.id, 'TKT-121');
  assert.equal(readTicketCounter(storage), 122);
});

test('counter: successive creates keep climbing as records drop', () => {
  const storage = memoryStorage();
  let list = [];
  const a = createTicket(ticketInput(), list, DATE_1000_PKT, storage);
  assert.equal(a.id, 'TKT-101');
  list = [...list, a];
  const b = createTicket(ticketInput(), list, DATE_1000_PKT, storage);
  assert.equal(b.id, 'TKT-102');
  list = list.filter((t) => t.id !== 'TKT-102'); // the max drops out
  const c = createTicket(ticketInput(), list, DATE_1000_PKT, storage);
  assert.equal(c.id, 'TKT-103');
  assert.equal(readTicketCounter(storage), 104);
});

test('seed: a dropped max still counts when a payment references it', () => {
  const storage = memoryStorage();
  const tickets = rangeTickets(101, 119);
  const complaints = [complaintBase({
    id: 'CMP-101',
    resolvedViaTicketId: 'TKT-120',
    syncReopenGuard: 'TKT-120@2026-11-10T10:00'
  })];
  const payments = [{ id: 'PAY-1', ticketCharges: [{ ticketId: 'TKT-120', amount: 500 }] }];
  assert.equal(seedTicketCounter(storage, tickets, complaints, payments), 121);
  assert.equal(readTicketCounter(storage), 121);
  assert.equal(createTicket(ticketInput(), tickets, DATE_1000_PKT, storage).id, 'TKT-121');
  // Payment reference alone is enough; and with no references at all the
  // seed is just max-over-list + 1.
  const paymentOnly = memoryStorage();
  assert.equal(seedTicketCounter(paymentOnly, tickets, [], payments), 121);
  const listsOnly = memoryStorage();
  assert.equal(seedTicketCounter(listsOnly, tickets, [], []), 120);
});

test('seed: a present counter is left alone; an absent one seeds from the lists', () => {
  const storage = memoryStorage();
  writeTicketCounter(storage, 150);
  assert.equal(seedTicketCounter(storage, rangeTickets(101, 119), [], []), 150);
  assert.equal(readTicketCounter(storage), 150);
  const fresh = memoryStorage();
  assert.equal(seedTicketCounter(fresh, rangeTickets(101, 110), [], []), 111);
  assert.equal(readTicketCounter(fresh), 111);
});

test('counter: writes never rewind, so a restore to an older snapshot keeps the high-water mark', () => {
  const storage = memoryStorage();
  writeTicketCounter(storage, 121);
  // A snapshot counter below the stored one is ignored; above it is taken.
  assert.equal(writeTicketCounter(storage, 111), 121);
  assert.equal(writeTicketCounter(storage, 130), 130);
  // Restore composition (what app.js restoreIdCounters does): stored,
  // snapshot and re-seeded-from-restored-lists, max wins.
  const seed = computeTicketSeed(rangeTickets(101, 110), [], []);
  assert.equal(seed, 111);
  assert.equal(writeTicketCounter(storage, Math.max(readTicketCounter(storage), seed)), 130);
  // And a snapshot counter above the stored one wins the same way.
  assert.equal(writeTicketCounter(storage, Math.max(readTicketCounter(storage), 140)), 140);
});

test('counter: a lost counter save self-heals from the list floor', () => {
  const storage = memoryStorage();
  let list = [];
  const a = createTicket(ticketInput(), list, DATE_1000_PKT, storage);
  assert.equal(a.id, 'TKT-101');
  assert.equal(readTicketCounter(storage), 102);
  list = [a];
  // The counter save is lost (fresh storage) but the record survived:
  // the list floor still hands out TKT-102, never TKT-101 again.
  const lost = memoryStorage();
  const b = createTicket(ticketInput(), list, DATE_1000_PKT, lost);
  assert.equal(b.id, 'TKT-102');
  assert.equal(readTicketCounter(lost), 103);
});

test('void edge (R6): voiding the old payment cannot unsettle the new ticket', () => {
  // Old ticket TKT-120, resolved billed Rs 500, settled by PAY-1001.
  const oldList = rangeTickets(101, 120);
  const resolved = resolveTicket(oldList, 'TKT-120', {
    materialsUsed: patchCord500, billingType: 'billed', referenceDate: DATE_1000_PKT
  });
  const lines = pendingTicketChargeLines(resolved, 'c1');
  assert.deepEqual(lines, [{ ticketId: 'TKT-120', amount: 500 }]);
  const settled = settleTicketCharges(resolved, lines, 'PAY-1001', SETTLE_1100_PKT);
  assert.equal(settled.find((t) => t.id === 'TKT-120').chargePaid, true);
  const oldPayment = { id: 'PAY-1001', ticketCharges: [{ ticketId: 'TKT-120', amount: 500 }] };
  // The old record drops out of the lists. With the counter the new
  // ticket is TKT-121, so the old payment's void cannot reach it.
  const storage = memoryStorage();
  writeTicketCounter(storage, 121);
  const dropped = rangeTickets(101, 119);
  const created = createTicket(ticketInput(), dropped, DATE_1000_PKT, storage);
  assert.equal(created.id, 'TKT-121');
  let list = resolveTicket([created], 'TKT-121', {
    materialsUsed: patchCord500, billingType: 'billed', referenceDate: RESOLVE_1200_PKT
  });
  list = markTicketChargePaid(list, 'TKT-121', true, SETTLE_1100_PKT);
  assert.equal(list[0].chargePaymentId, ''); // manual toggle, no receipt link
  const { tickets: afterVoid, reopened } = unsettleTicketChargesForPayment(list, oldPayment);
  assert.deepEqual(reopened, []);
  assert.equal(afterVoid.find((t) => t.id === 'TKT-121').chargePaid, true);
  // CONTROL: without the counter the pure path re-issues TKT-120 and the
  // same void DOES unsettle it — the edge the counter closes.
  const pure = createTicket(ticketInput(), dropped, DATE_1000_PKT);
  assert.equal(pure.id, 'TKT-120');
  let pureList = resolveTicket([pure], 'TKT-120', {
    materialsUsed: patchCord500, billingType: 'billed', referenceDate: RESOLVE_1200_PKT
  });
  pureList = markTicketChargePaid(pureList, 'TKT-120', true, SETTLE_1100_PKT);
  const pureVoid = unsettleTicketChargesForPayment(pureList, oldPayment);
  assert.deepEqual(pureVoid.reopened, ['TKT-120']);
  assert.equal(pureVoid.tickets.find((t) => t.id === 'TKT-120').chargePaid, false);
});

test('references: a follow-up and a ticket link keep pointing at the deleted id, never at the new record', () => {
  const followups = [{
    id: 'FU-1', complaintRef: 'CMP-120', dueDate: '2026-11-12',
    stillSatisfied: true, note: 'Called, promised tomorrow', followups: []
  }];
  assert.deepEqual(followupsForComplaint(followups, 'CMP-120').map((f) => f.id), ['FU-1']);
  // CMP-120 is deleted; the new complaint is CMP-121, not a re-issue.
  const storage = memoryStorage();
  writeComplaintCounter(storage, 121);
  const created = createComplaint(complaintInput(), [], DATE_1000_PKT, storage);
  assert.equal(created.id, 'CMP-121');
  assert.deepEqual(followupsForComplaint(followups, 'CMP-121'), []);
  // The old follow-up still resolves to CMP-120: dangling, unambiguous.
  assert.deepEqual(followupsForComplaint(followups, 'CMP-120').map((f) => f.id), ['FU-1']);
  // Same for a ticket linked to the deleted complaint.
  const tickets = [ticketBase({ id: 'TKT-101', complaintId: 'CMP-120' })];
  assert.deepEqual(linkedTicketsForComplaint(tickets, 'CMP-120').map((t) => t.id), ['TKT-101']);
  assert.deepEqual(linkedTicketsForComplaint(tickets, 'CMP-121'), []);
});

// --- Complaints: the counter ----------------------------------------------

test('counter: a deleted max complaint id is never re-issued', () => {
  const storage = memoryStorage();
  writeComplaintCounter(storage, 121); // CMP-120 was issued before its record dropped
  const created = createComplaint(complaintInput(), rangeComplaints(101, 119), DATE_1000_PKT, storage);
  assert.equal(created.id, 'CMP-121');
  assert.equal(readComplaintCounter(storage), 122);
});

test('seed: a dropped max still counts when notes and tickets reference it (R7 legacy CMP-999)', () => {
  const storage = memoryStorage();
  const complaints = rangeComplaints(101, 119);
  const tickets = [ticketBase({ id: 'TKT-101', complaintId: 'CMP-120' })];
  const followups = [{ id: 'FU-1', complaintRef: 'CMP-120' }];
  const reopens = [{ id: 'RO-1', complaintRef: 'CMP-120' }];
  const escalations = [{ id: 'ES-1', complaintRef: 'CMP-120' }];
  assert.equal(seedComplaintCounter(storage, complaints, tickets, followups, reopens, escalations), 121);
  assert.equal(readComplaintCounter(storage), 121);
  assert.equal(createComplaint(complaintInput(), complaints, DATE_1000_PKT, storage).id, 'CMP-121');
  // A legacy id shaped like CMP-999 counts toward max too.
  const legacy = memoryStorage();
  assert.equal(seedComplaintCounter(legacy, [complaintBase({ id: 'CMP-999' })], [], [], [], []), 1000);
  assert.equal(createComplaint(complaintInput(), [complaintBase({ id: 'CMP-999' })], DATE_1000_PKT, legacy).id, 'CMP-1000');
});

test('counter: complaint writes never rewind', () => {
  const storage = memoryStorage();
  writeComplaintCounter(storage, 121);
  assert.equal(writeComplaintCounter(storage, 111), 121);
  assert.equal(writeComplaintCounter(storage, 130), 130);
  const seed = computeComplaintSeed(rangeComplaints(101, 110), [], [], [], []);
  assert.equal(seed, 111);
  assert.equal(writeComplaintCounter(storage, Math.max(readComplaintCounter(storage), seed)), 130);
});

// --- Controls ---------------------------------------------------------------

test('controls: empty stores start at 101 and a gap below the max is never filled', () => {
  assert.equal(createTicket(ticketInput(), [], DATE_1000_PKT, memoryStorage()).id, 'TKT-101');
  assert.equal(createComplaint(complaintInput(), [], DATE_1000_PKT, memoryStorage()).id, 'CMP-101');
  const tickets = [ticketBase({ id: 'TKT-101' }), ticketBase({ id: 'TKT-103' })];
  assert.equal(createTicket(ticketInput(), tickets, DATE_1000_PKT, memoryStorage()).id, 'TKT-104');
  const complaints = [complaintBase({ id: 'CMP-101' }), complaintBase({ id: 'CMP-103' })];
  assert.equal(createComplaint(complaintInput(), complaints, DATE_1000_PKT, memoryStorage()).id, 'CMP-104');
  // Without storage the creators are exactly the pure generators (R10).
  assert.equal(createTicket(ticketInput(), tickets, DATE_1000_PKT).id, nextTicketId(tickets));
  assert.equal(createComplaint(complaintInput(), complaints, DATE_1000_PKT).id, nextComplaintId(complaints));
  assert.equal(nextTicketId([ticketBase()]), 'TKT-102');
  assert.equal(nextComplaintId([]), 'CMP-101');
});

test('counter: unreadable stored values are treated as absent', () => {
  const storage = memoryStorage();
  storage.setItem('sisp_tickets_next_id_v1', 'not-a-number');
  assert.equal(readTicketCounter(storage), null);
  storage.setItem('sisp_tickets_next_id_v1', '0');
  assert.equal(readTicketCounter(storage), null);
  storage.setItem('sisp_tickets_next_id_v1', '121');
  assert.equal(readTicketCounter(storage), 121);
  assert.equal(readTicketCounter(memoryStorage()), null);
  assert.equal(readTicketCounter(null), null);
  assert.equal(writeTicketCounter(null, 130), null);
  assert.equal(readComplaintCounter(memoryStorage()), null);
});
