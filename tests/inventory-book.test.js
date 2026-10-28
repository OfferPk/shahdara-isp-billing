// SISP-18: Offline Hardware and Fiber Stock Inventory Book.
// Pure-function tests on synthetic data only. Spec test criterion (verbatim):
// adding a 1000m fiber roll and logging 150m used for a customer
// installation shows 850m remaining in stock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INVENTORY_ITEMS,
  addMovement,
  availableFor,
  computeStock,
  loadInventory,
  sanitizeInventory,
  saveInventory,
  sortedMovementLog
} from '../inventory-book.js';

const move = (overrides = {}) => ({
  id: 'STK-1',
  itemId: 'fiber-2core',
  kind: 'in',
  qty: 1000,
  date: '2026-10-01',
  customerName: '',
  note: 'Opening roll',
  createdAt: '2026-10-01T10:00:00.000Z',
  ...overrides
});

function fakeStore(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
    _read: () => value
  };
}

test('spec criterion verbatim: 1000m fiber in, 150m out for a customer installation => 850m remaining', () => {
  let movements = addMovement([], { itemId: 'fiber-2core', kind: 'in', qty: 1000, date: '2026-10-01', note: 'New roll' });
  movements = addMovement(movements, { itemId: 'fiber-2core', kind: 'out', qty: 150, date: '2026-10-05', customerName: 'Faisal', note: 'Installation' });
  assert.equal(availableFor(movements, 'fiber-2core'), 850);
  const row = computeStock(movements).find((r) => r.id === 'fiber-2core');
  assert.equal(row.totalIn, 1000);
  assert.equal(row.totalOut, 150);
  assert.equal(row.available, 850);
});

test('per-item independence: router and patch-cord flows do not touch fiber stock', () => {
  let movements = addMovement([], { itemId: 'router', kind: 'in', qty: 5, date: '2026-10-01' });
  movements = addMovement(movements, { itemId: 'router', kind: 'out', qty: 2, date: '2026-10-02', customerName: 'Ali' });
  movements = addMovement(movements, { itemId: 'patch-cord', kind: 'in', qty: 10, date: '2026-10-02' });
  assert.equal(availableFor(movements, 'router'), 3);
  assert.equal(availableFor(movements, 'patch-cord'), 10);
  assert.equal(availableFor(movements, 'fiber-2core'), 0);
});

test('low-stock flag: at or below threshold is low, above is not', () => {
  let movements = addMovement([], { itemId: 'router', kind: 'in', qty: 3, date: '2026-10-01' });
  movements = addMovement(movements, { itemId: 'router', kind: 'out', qty: 1, date: '2026-10-02' });
  const atThreshold = computeStock(movements).find((r) => r.id === 'router');
  assert.equal(atThreshold.available, 2);
  assert.equal(atThreshold.isLow, true);
  movements = addMovement(movements, { itemId: 'router', kind: 'in', qty: 1, date: '2026-10-03' });
  const above = computeStock(movements).find((r) => r.id === 'router');
  assert.equal(above.available, 3);
  assert.equal(above.isLow, false);
});

test('stock out beyond available is refused and leaves the ledger unchanged', () => {
  const movements = addMovement([], { itemId: 'router', kind: 'in', qty: 2, date: '2026-10-01' });
  assert.throws(
    () => addMovement(movements, { itemId: 'router', kind: 'out', qty: 3, date: '2026-10-02' }),
    /exceeds available stock/
  );
  assert.equal(movements.length, 1);
  assert.equal(availableFor(movements, 'router'), 2);
});

test('quantity rules: unit items need whole numbers, meter items may be fractional', () => {
  assert.throws(
    () => addMovement([], { itemId: 'router', kind: 'in', qty: 1.5, date: '2026-10-01' }),
    /Quantity must be positive/
  );
  assert.throws(
    () => addMovement([], { itemId: 'router', kind: 'in', qty: 0, date: '2026-10-01' }),
    /Quantity must be positive/
  );
  const movements = addMovement([], { itemId: 'fiber-2core', kind: 'in', qty: 12.5, date: '2026-10-01' });
  assert.equal(availableFor(movements, 'fiber-2core'), 12.5);
});

test('validation: unknown item, bad kind, and bad date are rejected', () => {
  assert.throws(() => addMovement([], { itemId: 'nope', kind: 'in', qty: 1, date: '2026-10-01' }), /Unknown stock item/);
  assert.throws(() => addMovement([], { itemId: 'router', kind: 'sideways', qty: 1, date: '2026-10-01' }), /stock in or stock out/);
  assert.throws(() => addMovement([], { itemId: 'router', kind: 'in', qty: 1, date: 'not-a-date' }), /valid date/);
});

test('movement ids are sequential STK-1, STK-2 even after a sanitized reload', () => {
  let movements = addMovement([], { itemId: 'router', kind: 'in', qty: 2, date: '2026-10-01' });
  movements = addMovement(movements, { itemId: 'router', kind: 'out', qty: 1, date: '2026-10-02' });
  assert.deepEqual(movements.map((m) => m.id), ['STK-1', 'STK-2']);
  const reloaded = sanitizeInventory(movements);
  const next = addMovement(reloaded, { itemId: 'router', kind: 'in', qty: 1, date: '2026-10-03' });
  assert.equal(next[2].id, 'STK-3');
});

test('sanitize drops malformed rows and keeps clean ones', () => {
  const cleaned = sanitizeInventory([
    move(),
    move({ itemId: 'unknown-item' }),
    move({ kind: 'bogus' }),
    move({ qty: -5 }),
    move({ qty: 1.5, itemId: 'router' }),
    move({ date: 'garbage' }),
    null,
    'not-an-object'
  ]);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].id, 'STK-1');
});

test('movement log is latest first by date, then by creation order', () => {
  const movements = [
    move({ id: 'STK-1', date: '2026-10-01', createdAt: '2026-10-01T10:00:00.000Z' }),
    move({ id: 'STK-2', date: '2026-10-05', createdAt: '2026-10-05T10:00:00.000Z' }),
    move({ id: 'STK-3', date: '2026-10-05', createdAt: '2026-10-05T11:00:00.000Z' })
  ];
  assert.deepEqual(sortedMovementLog(movements).map((m) => m.id), ['STK-3', 'STK-2', 'STK-1']);
});

test('load/save round-trip through a fake store; corrupt storage reads as empty', () => {
  const store = fakeStore();
  assert.deepEqual(loadInventory(store), []);
  const movements = addMovement([], { itemId: 'pole', kind: 'in', qty: 4, date: '2026-10-01', note: 'New poles' });
  assert.equal(saveInventory(movements, store), true);
  const reloaded = loadInventory(store);
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].itemId, 'pole');
  assert.equal(availableFor(reloaded, 'pole'), 4);
  const corrupt = fakeStore('{not json');
  assert.deepEqual(loadInventory(corrupt), []);
});

test('catalog covers exactly the 7 spec items', () => {
  assert.deepEqual(
    INVENTORY_ITEMS.map((i) => i.id),
    ['fiber-2core', 'router', 'media-converter', 'patch-cord', 'cat6', 'rj45', 'pole']
  );
});

test('empty ledger: every item available is 0', () => {
  const stock = computeStock([]);
  assert.equal(stock.length, 7);
  assert.ok(stock.every((row) => row.available === 0 && row.totalIn === 0 && row.totalOut === 0));
});
