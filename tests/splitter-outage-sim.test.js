// SISP-66: Splitter Port Map (SISP-24) ↔ Daisy-Chain Outage Simulator
// (SISP-7) & Complaint Register Link. Pure-function tests on synthetic
// data only.
// Spec test criterion (verbatim): simulating a cut on DB-01 (4 assigned
// ports, where Port 2 feeds 1 downstream house via upstreamCustomerId)
// returns all 5 affected subscribers in the alert queue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTENUATION_TICKET_DBM_THRESHOLD,
  buildSplitterCutQueueText,
  buildSplitterCutSimulation,
  createAttenuationTicket,
  isAttenuationTicketRx,
  renderSplitterPortCell
} from '../splitter-map.js';
import { buildSplitterPortMap } from '../splitter-map.js';
import { OUTAGE_MESSAGE_ROMAN, OUTAGE_MESSAGE_URDU } from '../outage-impact.js';

const BOX = 'DB-01';

// DB-01 port customers: ports 1-4 occupied; port 2 (id 'p2') feeds one
// downstream house (id 'd1') via upstreamCustomerId.
const pinCustomers = () => ([
  { id: 'p1', name: 'Port One', phone: '03001111111', splitterBoxId: BOX, splitterPort: 1, lastRxDbm: -19.0 },
  { id: 'p2', name: 'Port Two', phone: '03002222222', splitterBoxId: BOX, splitterPort: 2, lastRxDbm: -21.5 },
  { id: 'p3', name: 'Port Three', phone: '03003333333', splitterBoxId: BOX, splitterPort: 3, lastRxDbm: -24.0 },
  { id: 'p4', name: 'Port Four', phone: '03004444444', splitterBoxId: BOX, splitterPort: 4, lastRxDbm: -18.2 },
  { id: 'd1', name: 'Downstream One', phone: '03005555555', upstreamCustomerId: 'p2' },
  { id: 'x1', name: 'Other Box', phone: '03006666666', splitterBoxId: 'DB-02', splitterPort: 1, lastRxDbm: -20.0 }
]);

test('spec criterion verbatim: DB-01 cut with 4 assigned ports + 1 downstream returns all 5 in the alert queue', () => {
  const sim = buildSplitterCutSimulation(pinCustomers(), BOX);
  assert.ok(sim);
  assert.equal(sim.boxId, BOX);
  assert.equal(sim.portCount, 8);
  assert.equal(sim.count, 5);
  assert.equal(sim.directCount, 4);
  assert.equal(sim.downstreamCount, 1);
  assert.deepEqual(sim.affected.map((e) => e.customer.id), ['p1', 'p2', 'p3', 'p4', 'd1']);
  const downstream = sim.affected.find((e) => e.customer.id === 'd1');
  assert.equal(downstream.kind, 'downstream');
  assert.equal(downstream.viaCustomerId, 'p2');
  assert.equal(downstream.viaCustomerName, 'Port Two');
  for (const entry of sim.affected) {
    assert.equal(entry.message, OUTAGE_MESSAGE_ROMAN);
    assert.match(entry.whatsappUrl, /^https:\/\/wa\.me\/92\d{10}\?text=/);
  }
  // The other box's customer is never swept in.
  assert.equal(sim.affected.some((e) => e.customer.id === 'x1'), false);
  // Copy-all queue text carries one line per affected subscriber.
  const text = buildSplitterCutQueueText(sim);
  assert.match(text, /Splitter cut alert — box DB-01/);
  for (const name of ['Port One', 'Port Two', 'Port Three', 'Port Four', 'Downstream One']) {
    assert.match(text, new RegExp(`${name}: `));
  }
});

test('simulation is read-only: the customer list is never mutated', () => {
  const customers = pinCustomers();
  const snapshot = JSON.stringify(customers);
  buildSplitterCutSimulation(customers, BOX);
  buildSplitterCutQueueText(buildSplitterCutSimulation(customers, BOX, { urdu: true }));
  assert.equal(JSON.stringify(customers), snapshot);
});

test('transitive downstream: chains of chains are followed, each home listed once', () => {
  const customers = [
    ...pinCustomers(),
    { id: 'd2', name: 'Deep One', phone: '03007777777', upstreamCustomerId: 'd1' },
    { id: 'd3', name: 'Deep Two', phone: '03008888888', upstreamCustomerId: 'd2' }
  ];
  const sim = buildSplitterCutSimulation(customers, BOX);
  assert.equal(sim.count, 7);
  assert.equal(sim.downstreamCount, 3);
  assert.deepEqual(sim.affected.map((e) => e.customer.id), ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3']);
});

test('a downstream home that also holds a port on the same box is listed once, as direct', () => {
  const customers = pinCustomers();
  customers[4] = { ...customers[4], splitterBoxId: BOX, splitterPort: 5 };
  const sim = buildSplitterCutSimulation(customers, BOX);
  assert.equal(sim.count, 5);
  const entry = sim.affected.find((e) => e.customer.id === 'd1');
  assert.equal(entry.kind, 'direct');
  assert.equal(entry.port, 5);
});

test('feeder cycles downstream of a port cannot loop or duplicate', () => {
  const customers = [
    ...pinCustomers(),
    { id: 'cyc1', name: 'Cycle One', upstreamCustomerId: 'cyc2' },
    { id: 'cyc2', name: 'Cycle Two', upstreamCustomerId: 'cyc1' },
    { id: 'p1b', name: 'Cycle Feeder', splitterBoxId: BOX, splitterPort: 6, upstreamCustomerId: 'p1' }
  ];
  // Wire the cycle under p1: cyc1 hangs off p1b's chain via upstream edit.
  customers.find((c) => c.id === 'cyc1').upstreamCustomerId = 'p1b';
  const sim = buildSplitterCutSimulation(customers, BOX);
  const ids = sim.affected.map((e) => e.customer.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('cyc1'));
  assert.ok(ids.includes('cyc2'));
});

test('archived customers are never listed, but the chain passes through them', () => {
  const customers = pinCustomers();
  customers.find((c) => c.id === 'p2').archived = true; // feeder house cancelled
  customers.push({ id: 'd9', name: 'Archived Downstream', upstreamCustomerId: 'p3', archived: true });
  const sim = buildSplitterCutSimulation(customers, BOX);
  const ids = sim.affected.map((e) => e.customer.id);
  assert.equal(ids.includes('p2'), false);
  assert.equal(ids.includes('d1'), true); // reached THROUGH the archived feeder
  assert.equal(ids.includes('d9'), false);
  assert.equal(sim.count, 4); // p1, p3, p4, d1
});

test('unknown or blank box id returns null; a box with only spare ports yields an empty queue', () => {
  assert.equal(buildSplitterCutSimulation(pinCustomers(), 'DB-99'), null);
  assert.equal(buildSplitterCutSimulation(pinCustomers(), ''), null);
  assert.equal(buildSplitterCutSimulation([], BOX), null);
  assert.equal(buildSplitterCutQueueText(null), '');
});

test('invalid phone yields no WhatsApp URL but the subscriber stays in the queue', () => {
  const customers = pinCustomers();
  customers.find((c) => c.id === 'p3').phone = '123';
  const sim = buildSplitterCutSimulation(customers, BOX);
  const entry = sim.affected.find((e) => e.customer.id === 'p3');
  assert.equal(entry.whatsappUrl, '');
  assert.equal(sim.count, 5);
});

test('urdu option swaps the queue message to the Urdu script text', () => {
  const sim = buildSplitterCutSimulation(pinCustomers(), BOX, { urdu: true });
  assert.equal(sim.affected[0].message, OUTAGE_MESSAGE_URDU);
  assert.match(buildSplitterCutQueueText(sim, { urdu: true }), /السلام علیکم/);
});

test('attenuation line: strictly below -27.0 dBm qualifies, -27.0 itself does not', () => {
  assert.equal(ATTENUATION_TICKET_DBM_THRESHOLD, -27.0);
  assert.equal(isAttenuationTicketRx(-27.1), true);
  assert.equal(isAttenuationTicketRx(-30.4), true);
  assert.equal(isAttenuationTicketRx(-27.0), false);
  assert.equal(isAttenuationTicketRx(-26.5), false); // weak (SISP-24) but not ticket-grade
  assert.equal(isAttenuationTicketRx(null), false);
  assert.equal(isAttenuationTicketRx(''), false);
  assert.equal(isAttenuationTicketRx('garbage'), false);
  // Port cells advertise the ticket only below the line.
  const box = buildSplitterPortMap([
    { id: 'w1', name: 'Very Weak', splitterBoxId: BOX, splitterPort: 1, lastRxDbm: -28.0 },
    { id: 'w2', name: 'Just Weak', splitterBoxId: BOX, splitterPort: 2, lastRxDbm: -26.5 }
  ], BOX, 8);
  assert.match(renderSplitterPortCell(box.ports[0]), /Attenuation ticket advised/);
  assert.doesNotMatch(renderSplitterPortCell(box.ports[1]), /Attenuation ticket advised/);
});

const weakCustomer = { id: 'p9', name: 'Weak Port Nine', phone: '03009999999', splitterBoxId: BOX, splitterPort: 7, lastRxDbm: -28.4 };

test('createAttenuationTicket: one click creates a normal SISP-12 ticket with box/port/RX in the note', () => {
  const result = createAttenuationTicket([], {
    customer: weakCustomer, boxId: BOX, port: 7, lastRxDbm: -28.4, technician: 'Saad'
  }, new Date('2026-10-29T10:00:00+05:00'));
  assert.equal(result.created, true);
  assert.equal(result.tickets.length, 1);
  const ticket = result.ticket;
  assert.match(ticket.id, /^TKT-\d+$/);
  assert.equal(ticket.customerId, 'p9');
  assert.equal(ticket.customerName, 'Weak Port Nine');
  assert.equal(ticket.faultPreset, 'Slow Speed / High Attenuation');
  assert.equal(ticket.technician, 'Saad');
  assert.equal(ticket.status, 'Open');
  assert.match(ticket.note, /Splitter attenuation · DB-01 port 7/);
  assert.match(ticket.note, /-28\.4 dBm/);
  // The caller's list is never mutated.
  const untouched = [];
  createAttenuationTicket(untouched, { customer: weakCustomer, boxId: BOX, port: 7, lastRxDbm: -28.4, technician: 'Saad' });
  assert.equal(untouched.length, 0);
});

test('createAttenuationTicket: a second click returns the open ticket instead of duplicating it', () => {
  const first = createAttenuationTicket([], {
    customer: weakCustomer, boxId: BOX, port: 7, lastRxDbm: -28.4, technician: 'Saad'
  });
  const second = createAttenuationTicket(first.tickets, {
    customer: weakCustomer, boxId: BOX, port: 7, lastRxDbm: -29.1, technician: 'Saad'
  });
  assert.equal(second.created, false);
  assert.equal(second.ticket.id, first.ticket.id);
  assert.equal(second.tickets.length, 1);
  // A different port on the same box is a different fault — new ticket.
  const otherPort = createAttenuationTicket(first.tickets, {
    customer: weakCustomer, boxId: BOX, port: 8, lastRxDbm: -29.1, technician: 'Saad'
  });
  assert.equal(otherPort.created, true);
  assert.equal(otherPort.tickets.length, 2);
});

test('createAttenuationTicket: a resolved ticket does not block a fresh one', () => {
  const first = createAttenuationTicket([], {
    customer: weakCustomer, boxId: BOX, port: 7, lastRxDbm: -28.4, technician: 'Saad'
  });
  const resolved = first.tickets.map((tk) => ({ ...tk, status: 'Resolved' }));
  const again = createAttenuationTicket(resolved, {
    customer: weakCustomer, boxId: BOX, port: 7, lastRxDbm: -28.9, technician: 'Saad'
  });
  assert.equal(again.created, true);
  assert.notEqual(again.ticket.id, first.ticket.id);
  assert.equal(again.tickets.length, 2);
});

test('createAttenuationTicket: missing customer, lineman or qualifying RX all refuse', () => {
  assert.throws(() => createAttenuationTicket([], { boxId: BOX, port: 7, lastRxDbm: -28.4, technician: 'Saad' }), /Select a customer first/);
  assert.throws(() => createAttenuationTicket([], { customer: weakCustomer, boxId: BOX, port: 7, lastRxDbm: -28.4, technician: ' ' }), /Assign a lineman/);
  assert.throws(() => createAttenuationTicket([], { customer: weakCustomer, boxId: BOX, port: 7, lastRxDbm: -26.5, technician: 'Saad' }), /below -27 dBm/);
  assert.throws(() => createAttenuationTicket([], { customer: weakCustomer, boxId: BOX, port: 7, lastRxDbm: null, technician: 'Saad' }), /below -27 dBm/);
});
