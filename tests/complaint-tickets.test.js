// SISP-12: Lineman Complaint Worklist and Material Consumed Tracker.
// Pure-function tests on synthetic data only. Spec test criterion (verbatim):
// resolving a ticket with Billed to Customer Rs. 500 (Patch Cord)
// automatically adds Rs. 500 to the customer's pending dues and marks the
// ticket resolved with a timestamp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TICKETS_KEY,
  TICKET_PRESETS,
  billedTicketChargesPending,
  buildTicketSummary,
  consumeTicketStockDeductions,
  createTicket,
  filterTickets,
  hasRecurringFaultWarning,
  loadTickets,
  markTicketChargePaid,
  nextTicketId,
  recurringTicketCount,
  resolveTicket,
  sanitizeTicketMaterials,
  sanitizeTickets,
  saveTickets,
  setTicketStatus,
  ticketStockDeductions,
  ticketsForCustomer,
  updateTicket
} from '../complaint-tickets.js';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); }
  };
}

const base = (overrides = {}) => ({
  id: 'TKT-101',
  customerId: 'c1',
  customerName: 'CH BILAL',
  complaintId: '',
  faultPreset: 'Fiber Cut / Splice Loss',
  customFault: '',
  technician: 'Saad',
  priority: 'Normal',
  status: 'Open',
  createdAt: '2026-10-28T10:00',
  resolvedAt: '',
  note: '',
  materialsUsed: [],
  billingType: 'free',
  billedAmount: 0,
  chargePaid: false,
  chargePaidAt: '',
  stockDeductions: [],
  stockDeducted: false,
  ...overrides
});

test('createTicket: presets, technician required, custom fault fallback, complaint link validation', () => {
  const ticket = createTicket({
    customerId: 'c1',
    customerName: 'CH BILAL',
    faultPreset: 'CAT6 / RJ45 Fault',
    technician: 'Saad',
    priority: 'Urgent'
  }, []);
  assert.equal(ticket.id, 'TKT-101');
  assert.equal(ticket.status, 'Open');
  assert.equal(ticket.priority, 'Urgent');
  assert.match(ticket.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  assert.throws(() => createTicket({ customerId: 'c1', faultPreset: TICKET_PRESETS[0], technician: '' }, []), /lineman/);
  assert.throws(() => createTicket({ customerId: 'c1', faultPreset: '', customFault: '', technician: 'Saad' }, []), /fault/);
  assert.throws(() => createTicket({ customerId: 'c1', faultPreset: TICKET_PRESETS[0], technician: 'Saad', complaintId: 'nope' }, []), /CMP-101/);
  const custom = createTicket({ customerId: 'c1', customFault: 'ONT keeps rebooting', technician: 'Saad' }, []);
  assert.equal(custom.faultPreset, '');
  assert.equal(custom.customFault, 'ONT keeps rebooting');
  assert.equal(nextTicketId([base()]), 'TKT-102');
});

test('spec criterion verbatim: billed Rs. 500 Patch Cord adds Rs. 500 to pending dues + resolved timestamp', () => {
  const created = createTicket({
    customerId: 'c1',
    customerName: 'CH BILAL',
    faultPreset: 'Fiber Cut / Splice Loss',
    technician: 'Saad'
  }, []);
  const ref = new Date('2026-10-28T14:30:00');
  const resolved = resolveTicket([created], created.id, {
    materialsUsed: [{ key: 'patch-cord', qty: 1, amount: 500 }],
    billingType: 'billed',
    referenceDate: ref
  });
  const ticket = resolved[0];
  assert.equal(ticket.status, 'Resolved');
  assert.ok(ticket.resolvedAt, 'resolved timestamp stamped');
  assert.equal(ticket.billedAmount, 500);
  assert.equal(billedTicketChargesPending(resolved, 'c1'), 500);
  assert.equal(billedTicketChargesPending(resolved, 'other-customer'), 0);
});

test('resolve free: billedAmount 0, no pending dues, materials kept', () => {
  const created = createTicket({
    customerId: 'c1', faultPreset: 'Media Converter Power/Charger', technician: 'Saad'
  }, []);
  const resolved = resolveTicket([created], created.id, {
    materialsUsed: [{ key: 'fiber', qty: 25.5, amount: 0 }],
    billingType: 'free'
  });
  assert.equal(resolved[0].billedAmount, 0);
  assert.equal(billedTicketChargesPending(resolved, 'c1'), 0);
  assert.equal(resolved[0].materialsUsed[0].qty, 25.5);
  assert.throws(() => resolveTicket(resolved, created.id, { materialsUsed: [] }), /already resolved/);
  assert.throws(() => setTicketStatus(resolved, created.id, 'Resolved'), /resolveTicket/);
});

test('materials sanitize: fiber decimals ok, unit integers enforced, unknown keys dropped', () => {
  const lines = sanitizeTicketMaterials([
    { key: 'fiber', qty: 12.345, amount: 100 },
    { key: 'rj45', qty: 2.5, amount: 50 },
    { key: 'rj45', qty: 4, amount: 200 },
    { key: 'nope', qty: 1, amount: 1 },
    { key: 'router', qty: 0, amount: 900 },
    { key: 'router', qty: -1, amount: 900 }
  ]);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].qty, 12.35);
  assert.equal(lines[1].key, 'rj45');
  assert.equal(lines[1].qty, 4);
});

test('status flow: start, reopen, note/technician edits only', () => {
  const created = createTicket({
    customerId: 'c1', faultPreset: 'Router / IP Conflict', technician: 'Saad'
  }, []);
  const started = setTicketStatus([created], created.id, 'In Progress');
  assert.equal(started[0].status, 'In Progress');
  const edited = updateTicket(started, created.id, { technician: 'Umair', priority: 'Urgent', note: 'Replaced adapter' });
  assert.equal(edited[0].technician, 'Umair');
  assert.equal(edited[0].priority, 'Urgent');
  assert.equal(edited[0].note, 'Replaced adapter');
  assert.throws(() => updateTicket(edited, created.id, { technician: '' }), /lineman/);
  const reopened = setTicketStatus(edited, created.id, 'Open');
  assert.equal(reopened[0].status, 'Open');
  assert.throws(() => setTicketStatus([created], 'TKT-999', 'Open'), /not found/);
});

test('charge paid: pending drops to zero; only resolved billed tickets settle', () => {
  const created = createTicket({
    customerId: 'c1', faultPreset: 'Fiber Cut / Splice Loss', technician: 'Saad'
  }, []);
  const resolved = resolveTicket([created], created.id, {
    materialsUsed: [{ key: 'patch-cord', qty: 1, amount: 500 }],
    billingType: 'billed'
  });
  const paid = markTicketChargePaid(resolved, created.id, true);
  assert.equal(paid[0].chargePaid, true);
  assert.ok(paid[0].chargePaidAt);
  assert.equal(billedTicketChargesPending(paid, 'c1'), 0);
  const unpaid = markTicketChargePaid(paid, created.id, false);
  assert.equal(billedTicketChargesPending(unpaid, 'c1'), 500);
  assert.throws(() => markTicketChargePaid([created], created.id, true), /resolved billed/);
});

test('recurring fault warning: 3+ tickets in 60 days, old ones excluded', () => {
  const ref = new Date('2026-10-28T12:00:00');
  const tickets = [
    base({ id: 'TKT-101', createdAt: '2026-10-28T10:00' }),
    base({ id: 'TKT-102', createdAt: '2026-10-20T10:00' }),
    base({ id: 'TKT-103', createdAt: '2026-09-15T10:00' }),
    base({ id: 'TKT-104', createdAt: '2026-08-01T10:00' }),
    base({ id: 'TKT-105', customerId: 'c2', createdAt: '2026-10-28T10:00' })
  ];
  assert.equal(recurringTicketCount(tickets, 'c1', ref), 3);
  assert.equal(hasRecurringFaultWarning(tickets, 'c1', ref), true);
  assert.equal(hasRecurringFaultWarning(tickets, 'c2', ref), false);
  assert.equal(hasRecurringFaultWarning(tickets.slice(0, 2), 'c1', ref), false);
});

test('stock deductions: SISP-18 movement shape for resolved tickets only', () => {
  const created = createTicket({
    customerId: 'c1', customerName: 'CH BILAL', faultPreset: 'Fiber Cut / Splice Loss', technician: 'Saad'
  }, []);
  assert.deepEqual(ticketStockDeductions(created), []);
  const resolved = resolveTicket([created], created.id, {
    materialsUsed: [
      { key: 'fiber', qty: 150, amount: 0 },
      { key: 'patch-cord', qty: 2, amount: 1000 }
    ],
    billingType: 'billed',
    referenceDate: new Date('2026-10-28T14:30:00')
  });
  const deductions = ticketStockDeductions(resolved[0]);
  assert.equal(deductions.length, 2);
  assert.equal(deductions[0].itemId, 'fiber-2core');
  assert.equal(deductions[0].kind, 'out');
  assert.equal(deductions[0].qty, 150);
  assert.equal(deductions[0].date, resolved[0].resolvedAt.slice(0, 10));
  assert.match(deductions[0].note, /TKT-101/);
  assert.equal(deductions[1].itemId, 'patch-cord');
  assert.equal(resolved[0].stockDeducted, false);
  assert.equal(resolved[0].stockDeductions.length, 2);
});

test('consume deductions: stub addMovement applies + marks deducted; refusal leaves pending', () => {
  const created = createTicket({
    customerId: 'c1', customerName: 'CH BILAL', faultPreset: 'Fiber Cut / Splice Loss', technician: 'Saad'
  }, []);
  const resolved = resolveTicket([created], created.id, {
    materialsUsed: [{ key: 'patch-cord', qty: 1, amount: 500 }],
    billingType: 'billed'
  });
  const ticket = resolved[0];
  const stubAdd = (movements, movement) => [...movements, { ...movement, id: `STK-${movements.length + 1}` }];
  const applied = consumeTicketStockDeductions(ticket, [], stubAdd);
  assert.equal(applied.movements.length, 1);
  assert.equal(applied.movements[0].itemId, 'patch-cord');
  assert.equal(applied.ticket.stockDeducted, true);
  const refusingAdd = () => { throw new Error('Stock out exceeds available stock.'); };
  assert.throws(() => consumeTicketStockDeductions(ticket, [], refusingAdd), /exceeds available/);
  assert.throws(() => consumeTicketStockDeductions(ticket, [], null), /not available/);
  assert.throws(() => consumeTicketStockDeductions(created, [], stubAdd), /resolved ticket/);
});

test('filters + summary + per-customer list', () => {
  const tickets = [
    base({ id: 'TKT-101', technician: 'Saad', status: 'Open' }),
    base({ id: 'TKT-102', technician: 'Umair', status: 'Resolved', billingType: 'billed', materialsUsed: [{ key: 'patch-cord', qty: 1, amount: 500 }], resolvedAt: '2026-10-28T14:30' }),
    base({ id: 'TKT-103', customerId: 'c2', technician: 'Saad', status: 'In Progress' })
  ];
  assert.equal(filterTickets(tickets, { status: 'Open' }).length, 1);
  assert.equal(filterTickets(tickets, { technician: 'Saad' }).length, 2);
  assert.equal(filterTickets(tickets, { customer: 'c2' }).length, 1);
  assert.equal(filterTickets(tickets, { priority: 'Urgent' }).length, 0);
  const summary = buildTicketSummary(tickets);
  assert.equal(summary.total, 3);
  assert.equal(summary.pendingCharges, 500);
  assert.equal(ticketsForCustomer(tickets, 'c1').length, 2);
});

test('storage round-trip + sanitize drops malformed entries', () => {
  const storage = memoryStorage();
  const created = createTicket({
    customerId: 'c1', faultPreset: 'CAT6 / RJ45 Fault', technician: 'Saad'
  }, []);
  saveTickets([created, { id: 'junk' }, null], storage);
  const loaded = loadTickets(storage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, created.id);
  assert.equal(JSON.parse(storage.getItem(TICKETS_KEY)).length, 1);
  assert.deepEqual(sanitizeTickets('not-an-array'), []);
  assert.deepEqual(loadTickets(memoryStorage()), []);
});

test('backup round-trip: tickets travel in settings.tickets under safe-merge rules', () => {
  const state = createInitialState();
  const ticket = createTicket({
    customerId: 'c1', faultPreset: 'Fiber Cut / Splice Loss', technician: 'Saad'
  }, []);
  const when = new Date('2026-10-28T12:00:00');
  const backup = createJsonBackup(state, when, { tickets: [ticket] });
  const document = JSON.parse(backup);
  assert.equal(document.settings.tickets.length, 1);
  assert.equal(document.settings.tickets[0].id, ticket.id);
  const preview = previewJsonBackupMerge(state, backup, { currentTickets: [], currentTicketsStored: false });
  assert.equal(preview.counts.ticketsRestored, 1);
  assert.deepEqual(preview.tickets[0].id, ticket.id);
  const different = [createTicket({
    customerId: 'c9', faultPreset: 'Router / IP Conflict', technician: 'Umair'
  }, [])];
  const conflict = previewJsonBackupMerge(state, backup, { currentTickets: different, currentTicketsStored: true });
  assert.ok(conflict.conflicts.some((c) => /ticket/i.test(c.field)));
  const empty = JSON.parse(createJsonBackup(state, when, { tickets: [] }));
  assert.equal(empty.settings?.tickets, undefined);
});
