// SISP-42: Live Stock Deduction Bridge (SISP-12 Tickets & SISP-19 Custody
// → SISP-18 Inventory Book). End-to-end seam tests on synthetic data only:
// the pure bridge pass in complaint-tickets.js is driven with the REAL
// inventory-book addMovement (the inventory module's own stock path), and
// persistence is exercised through the modules' own load/save against an
// in-memory storage stub (sisp_inventory_v1 / sisp_tickets_v1).
// Spec test criteria (verbatim): "Resolving TKT-101 with 50m fiber
// deducts 50m from sisp_inventory_v1, and recovering a router from an
// archived customer adds +1 router to sisp_inventory_v1."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTicketStockBridge,
  createTicket,
  loadTickets,
  pakistanTicketDateTimeNow,
  resolveTicket,
  saveTickets,
  setTicketStatus
} from '../complaint-tickets.js';
import {
  INVENTORY_KEY,
  addMovement,
  availableFor,
  loadInventory,
  saveInventory
} from '../inventory-book.js';
import {
  markHardwareRecovered,
  recoveryStockMovements
} from '../hardware-custody.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); }
  };
}

const RESOLVE_REF = new Date('2026-10-29T10:00:00');

/** Stock-in seed movements through the inventory module's own path. */
function seedStock(entries) {
  let movements = [];
  for (const entry of entries) {
    movements = addMovement(movements, {
      itemId: entry.itemId, kind: 'in', qty: entry.qty, date: '2026-10-01', customerName: '', note: 'Purchase'
    });
  }
  return movements;
}

/** A resolved TKT-101 (first ticket in an empty list) with materials. */
function resolvedTicket(materialsUsed, referenceDate = RESOLVE_REF) {
  const created = createTicket({
    customerId: 'c1', customerName: 'CH BILAL', faultPreset: 'Fiber Cut / Splice Loss', technician: 'Saad'
  }, [], referenceDate);
  return resolveTicket([created], created.id, { materialsUsed, billingType: 'free', referenceDate })[0];
}

test('spec: resolving TKT-101 with 50m fiber deducts 50m from sisp_inventory_v1', () => {
  const storage = memoryStorage();
  saveInventory(seedStock([{ itemId: 'fiber-2core', qty: 1000 }]), storage);
  saveTickets([resolvedTicket([{ key: 'fiber', qty: 50, amount: 0 }])], storage);

  // The app seam (app.js recordTicketStockBridge): load both ledgers,
  // run the bridge with the inventory module's addMovement, persist back.
  const result = applyTicketStockBridge(loadTickets(storage), loadInventory(storage), addMovement);
  saveTickets(result.tickets, storage);
  saveInventory(result.movements, storage);

  assert.deepEqual(result.deducted, ['TKT-101']);
  assert.deepEqual(result.failures, []);
  const stored = loadInventory(storage);
  assert.equal(availableFor(stored, 'fiber-2core'), 950);
  const out = stored.find((m) => m.kind === 'out');
  assert.equal(out.itemId, 'fiber-2core');
  assert.equal(out.qty, 50);
  assert.match(out.note, /TKT-101/);
  assert.equal(JSON.parse(storage.getItem(INVENTORY_KEY)).length, 2);
  assert.equal(loadTickets(storage)[0].stockDeducted, true);
});

test('bridge: 1 router + 50m fiber deduct exactly those quantities', () => {
  const movements = seedStock([{ itemId: 'router', qty: 5 }, { itemId: 'fiber-2core', qty: 1000 }]);
  const ticket = resolvedTicket([
    { key: 'router', qty: 1, amount: 0 },
    { key: 'fiber', qty: 50, amount: 0 }
  ]);
  const result = applyTicketStockBridge([ticket], movements, addMovement);
  assert.deepEqual(result.deducted, ['TKT-101']);
  assert.equal(availableFor(result.movements, 'router'), 4);
  assert.equal(availableFor(result.movements, 'fiber-2core'), 950);
  const outs = result.movements.filter((m) => m.kind === 'out');
  assert.equal(outs.length, 2);
  assert.deepEqual(outs.map((m) => [m.itemId, m.qty]).sort(), [['fiber-2core', 50], ['router', 1]]);
});

test('bridge: running the pass twice deducts ONCE', () => {
  const movements = seedStock([{ itemId: 'fiber-2core', qty: 1000 }]);
  const ticket = resolvedTicket([{ key: 'fiber', qty: 50, amount: 0 }]);
  const first = applyTicketStockBridge([ticket], movements, addMovement);
  const second = applyTicketStockBridge(first.tickets, first.movements, addMovement);
  assert.deepEqual(second.deducted, []);
  assert.deepEqual(second.reversed, []);
  assert.equal(second.movements.length, first.movements.length);
  assert.equal(availableFor(second.movements, 'fiber-2core'), 950);
});

test('bridge: a ticket with no materials deducts nothing; open tickets untouched', () => {
  const movements = seedStock([{ itemId: 'fiber-2core', qty: 1000 }]);
  const noMaterials = resolvedTicket([]);
  const created = createTicket({
    customerId: 'c2', customerName: 'RAJA ARIF', faultPreset: 'Router / IP Conflict', technician: 'Saad'
  }, [noMaterials], RESOLVE_REF);
  const result = applyTicketStockBridge([noMaterials, created], movements, addMovement);
  assert.deepEqual(result.deducted, []);
  assert.deepEqual(result.failures, []);
  assert.equal(result.movements.length, movements.length);
  assert.equal(result.tickets[1].status, 'Open');
  assert.equal(result.tickets[1].stockDeducted, false);
});

test('bridge: insufficient stock warns and deducts NOTHING; restock retries succeed', () => {
  const movements = seedStock([{ itemId: 'fiber-2core', qty: 30 }, { itemId: 'router', qty: 5 }]);
  const ticket = resolvedTicket([
    { key: 'fiber', qty: 50, amount: 0 },
    { key: 'router', qty: 1, amount: 0 }
  ]);
  const refused = applyTicketStockBridge([ticket], movements, addMovement);
  // Resolution stands; the deduction (all-or-nothing) stays pending.
  assert.deepEqual(refused.deducted, []);
  assert.equal(refused.failures.length, 1);
  assert.equal(refused.failures[0].id, 'TKT-101');
  assert.match(refused.failures[0].message, /exceeds available/);
  assert.equal(refused.movements.length, movements.length);
  assert.equal(availableFor(refused.movements, 'router'), 5);
  const pending = refused.tickets[0];
  assert.equal(pending.status, 'Resolved');
  assert.equal(pending.stockDeducted, false);
  assert.equal(pending.stockDeductions.length, 2);

  // Restock, then the next pass lands the whole deduction.
  const restocked = addMovement(refused.movements, {
    itemId: 'fiber-2core', kind: 'in', qty: 100, date: '2026-10-30', customerName: '', note: 'Purchase'
  });
  const retried = applyTicketStockBridge(refused.tickets, restocked, addMovement);
  assert.deepEqual(retried.deducted, ['TKT-101']);
  assert.deepEqual(retried.failures, []);
  assert.equal(availableFor(retried.movements, 'fiber-2core'), 80);
  assert.equal(availableFor(retried.movements, 'router'), 4);
});

test('bridge: reopening a deducted ticket returns its stock exactly once; re-resolve deducts only the new materials', () => {
  const movements = seedStock([{ itemId: 'fiber-2core', qty: 1000 }, { itemId: 'patch-cord', qty: 10 }]);
  const ticket = resolvedTicket([{ key: 'fiber', qty: 50, amount: 0 }]);
  const deductedPass = applyTicketStockBridge([ticket], movements, addMovement);
  assert.equal(availableFor(deductedPass.movements, 'fiber-2core'), 950);

  const reopened = setTicketStatus(deductedPass.tickets, 'TKT-101', 'Open');
  const reopenRef = new Date('2026-10-30T09:00:00');
  const reversedPass = applyTicketStockBridge(reopened, deductedPass.movements, addMovement, { referenceDate: reopenRef });
  assert.deepEqual(reversedPass.reversed, ['TKT-101']);
  assert.equal(availableFor(reversedPass.movements, 'fiber-2core'), 1000);
  const back = reversedPass.movements.find((m) => m.kind === 'in' && /reopened/.test(m.note));
  assert.equal(back.itemId, 'fiber-2core');
  assert.equal(back.qty, 50);
  assert.equal(back.date, pakistanTicketDateTimeNow(reopenRef).slice(0, 10));
  assert.equal(reversedPass.tickets[0].stockDeducted, false);
  assert.deepEqual(reversedPass.tickets[0].stockDeductions, []);

  // The reversal itself runs once.
  const again = applyTicketStockBridge(reversedPass.tickets, reversedPass.movements, addMovement, { referenceDate: reopenRef });
  assert.deepEqual(again.reversed, []);
  assert.equal(again.movements.length, reversedPass.movements.length);

  // Re-resolving with fresh materials deducts only those — the returned
  // fiber is never taken twice.
  const reResolved = resolveTicket(reversedPass.tickets, 'TKT-101', {
    materialsUsed: [{ key: 'patch-cord', qty: 2, amount: 0 }],
    billingType: 'free',
    referenceDate: new Date('2026-10-30T11:00:00')
  });
  const finalPass = applyTicketStockBridge(reResolved, reversedPass.movements, addMovement);
  assert.deepEqual(finalPass.deducted, ['TKT-101']);
  assert.equal(availableFor(finalPass.movements, 'patch-cord'), 8);
  assert.equal(availableFor(finalPass.movements, 'fiber-2core'), 1000);
});

test('spec: recovering a router from an archived customer adds +1 router to sisp_inventory_v1', () => {
  const before = {
    id: 'c9',
    customerNumber: 9,
    name: 'AKHTAR WAPDA HOUSE',
    archived: true,
    routerOwnership: 'isp-owned',
    mediaConverterOwnership: '',
    hardwareRecovered: { router: null, mediaConverter: null }
  };
  const after = markHardwareRecovered(before, 'router', '2026-10-29');
  const movements = recoveryStockMovements(before, after);
  assert.equal(movements.length, 1);
  assert.equal(movements[0].itemId, 'router');
  assert.equal(movements[0].kind, 'in');

  // Applied through the inventory module's own addMovement — the same
  // path app.js recordRecoveryStock uses.
  let stored = seedStock([{ itemId: 'router', qty: 3 }]);
  for (const movement of movements) stored = addMovement(stored, movement);
  assert.equal(availableFor(stored, 'router'), 4);

  // Recovery is idempotent: re-running the transition yields nothing.
  assert.deepEqual(recoveryStockMovements(after, after), []);
});

test('bridge: refuses to run without the inventory addMovement function', () => {
  assert.throws(() => applyTicketStockBridge([], [], null), /not available/);
});
