/**
 * plan51-stock-register.test.js — Plan 51: spare equipment and
 * consumables stock register with low-stock signals.
 * Pins:
 * - the seven plan item types and two locations, with typed
 *   spellings folded to keys and anything outside refused;
 * - one row per (item, location) with on-hand, issued, and
 *   in-repair counts that sum exactly on the same fixture;
 * - receiving adds to good stock; issuing to a named job reduces
 *   on hand, raises issued, and keeps the movement in history;
 * - a faulty return moves issued to in repair, never back to good
 *   stock; over-issue and over-return leave both lists unchanged;
 * - falling strictly below the operator-set minimum shows a
 *   low-stock signal with the shortfall; at the minimum, or with
 *   no minimum set, there is no signal;
 * - impossible dates (2026-02-30) are refused, never repaired;
 * - the register holds no bill, payment, ticket, or connection
 *   field, and inputs are never mutated.
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STOCK_ITEM_TYPES,
  STOCK_ITEM_LABELS,
  STOCK_LOCATIONS,
  validStockDate,
  normalizeStockItemType,
  normalizeStockLocation,
  normalizeStockRow,
  normalizeStockRowList,
  findStockRow,
  upsertStockRow,
  removeStockRow,
  setStockMinimum,
  receiveStock,
  issueStock,
  returnFaultyStock,
  stockRowTotal,
  lowStockSignals,
  stockItemTotals,
  stockSummaryText,
  stockRowsHtml,
  stockMovementsHtml,
  stockCsv,
  stockFilename,
} from '../stock-register.js';

const ROWS = [
  { item: 'onu', location: 'shop', onHand: 5, issued: 2, inRepair: 1, minimum: 3 },
  { item: 'onu', location: 'field_kit', onHand: 1, issued: 0, inRepair: 0, minimum: 2 },
  { item: 'drop_cable', location: 'shop', onHand: 10, issued: 0, inRepair: 0, minimum: null },
  { item: 'router', location: 'shop', onHand: 2, issued: 0, inRepair: 0, minimum: 2 },
];

test('item types and locations: the plan catalogue, nothing else', () => {
  assert.deepEqual(STOCK_ITEM_TYPES, ['onu', 'router', 'splitter', 'patch_cord', 'drop_cable', 'connector', 'power_adapter']);
  assert.deepEqual(STOCK_LOCATIONS, ['shop', 'field_kit']);
  assert.equal(STOCK_ITEM_LABELS.drop_cable, 'Drop cable');
});

test('type and location normalisation: typed spellings fold, unknowns refused', () => {
  assert.equal(normalizeStockItemType('patch cord'), 'patch_cord');
  assert.equal(normalizeStockItemType('Power Adapter'), 'power_adapter');
  assert.equal(normalizeStockItemType('ONU'), 'onu');
  assert.equal(normalizeStockItemType('media converter'), null);
  assert.equal(normalizeStockItemType(''), null);
  assert.equal(normalizeStockLocation('field kit'), 'field_kit');
  assert.equal(normalizeStockLocation('Field'), 'field_kit');
  assert.equal(normalizeStockLocation('warehouse'), null);
});

test('date validation: real dates pass, impossible dates fail', () => {
  assert.equal(validStockDate('2026-11-04'), '2026-11-04');
  assert.equal(validStockDate('2026-02-30'), null);
  assert.equal(validStockDate('2026-13-01'), null);
  assert.equal(validStockDate(''), null);
});

test('row validation: bad counts and unknown keys refused, blanks become null', () => {
  assert.equal(normalizeStockRow({ item: 'onu', location: 'shop', onHand: -1 }), null);
  assert.equal(normalizeStockRow({ item: 'onu', location: 'shop', onHand: 1.5 }), null);
  assert.equal(normalizeStockRow({ item: 'onu', location: 'shop', minimum: -2 }), null);
  assert.equal(normalizeStockRow({ item: 'olt', location: 'shop' }), null);
  assert.equal(normalizeStockRow({ item: 'onu', location: 'warehouse' }), null);
  assert.deepEqual(normalizeStockRow({ item: 'ONU', location: 'Shop' }), {
    item: 'onu', location: 'shop', onHand: 0, issued: 0, inRepair: 0, minimum: null, note: null,
  });
});

test('row list: one row per item and location, last wins', () => {
  const list = normalizeStockRowList([
    { item: 'onu', location: 'shop', onHand: 1 },
    { item: 'onu', location: 'shop', onHand: 4, minimum: 2 },
    { item: 'onu', location: 'shop', onHand: -1 },
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].onHand, 4);
  assert.equal(list[0].minimum, 2);
});

test('find, upsert, and remove by item and location', () => {
  assert.equal(findStockRow(ROWS, 'onu', 'shop').onHand, 5);
  assert.equal(findStockRow(ROWS, 'onu', 'warehouse'), null);
  const upserted = upsertStockRow(ROWS, { item: 'onu', location: 'shop', onHand: 9, issued: 0, inRepair: 0, minimum: 3 });
  assert.equal(upserted.length, 4);
  assert.equal(findStockRow(upserted, 'onu', 'shop').onHand, 9);
  assert.equal(removeStockRow(ROWS, 'onu', 'shop').length, 3);
  assert.equal(removeStockRow(ROWS, 'onu', 'shop').length, 3);
});

test('row totals sum exactly on the same fixture', () => {
  assert.equal(stockRowTotal({ item: 'onu', location: 'shop', onHand: 5, issued: 2, inRepair: 1 }), 8);
  assert.equal(stockRowTotal({ item: 'onu', location: 'shop', onHand: -1 }), null);
  const totals = stockItemTotals(ROWS);
  assert.deepEqual(totals.onu, { onHand: 6, issued: 2, inRepair: 1, total: 9 });
  assert.deepEqual(totals.drop_cable, { onHand: 10, issued: 0, inRepair: 0, total: 10 });
});

test('receiving adds to good stock and records the movement', () => {
  const result = receiveStock(ROWS, [], { item: 'router', location: 'shop', qty: 3, date: '2026-11-04', note: 'market trip' });
  assert.equal(result.applied, true);
  assert.equal(findStockRow(result.rows, 'router', 'shop').onHand, 5);
  assert.equal(result.movements.length, 1);
  assert.equal(result.movements[0].kind, 'receive');
  assert.equal(result.movements[0].qty, 3);
});

test('receiving creates a missing row and refuses bad input unchanged', () => {
  const created = receiveStock([], [], { item: 'splitter', location: 'field_kit', qty: 2, date: '2026-11-04' });
  assert.equal(created.applied, true);
  assert.equal(created.rows.length, 1);
  const refused = receiveStock(ROWS, [], { item: 'splitter', location: 'shop', qty: 0, date: '2026-11-04' });
  assert.equal(refused.applied, false);
  assert.deepEqual(refused.rows, normalizeStockRowList(ROWS));
  const badDate = receiveStock(ROWS, [], { item: 'splitter', location: 'shop', qty: 1, date: '2026-02-30' });
  assert.equal(badDate.applied, false);
  assert.equal(badDate.movements.length, 0);
});

test('issuing to a named job reduces on hand, raises issued, keeps history', () => {
  const result = issueStock(ROWS, [], { item: 'onu', location: 'shop', qty: 2, date: '2026-11-04', target: 'Ahmed house, Bani', note: 'swap faulty unit' });
  assert.equal(result.applied, true);
  const row = findStockRow(result.rows, 'onu', 'shop');
  assert.equal(row.onHand, 3);
  assert.equal(row.issued, 4);
  assert.equal(stockRowTotal(row), 8);
  assert.equal(result.movements[0].kind, 'issue');
  assert.equal(result.movements[0].target, 'Ahmed house, Bani');
});

test('issuing refuses over-issue and unnamed issues unchanged', () => {
  const over = issueStock(ROWS, [], { item: 'onu', location: 'field_kit', qty: 2, date: '2026-11-04', target: 'job 7' });
  assert.equal(over.applied, false);
  assert.deepEqual(over.rows, normalizeStockRowList(ROWS));
  assert.equal(over.movements.length, 0);
  const unnamed = issueStock(ROWS, [], { item: 'onu', location: 'shop', qty: 1, date: '2026-11-04', target: '  ' });
  assert.equal(unnamed.applied, false);
});

test('a faulty return moves issued to in repair, never back to good stock', () => {
  const result = returnFaultyStock(ROWS, [], { item: 'onu', location: 'shop', qty: 1, date: '2026-11-05', target: 'Ahmed house, Bani', note: 'dead port' });
  assert.equal(result.applied, true);
  const row = findStockRow(result.rows, 'onu', 'shop');
  assert.equal(row.onHand, 5);
  assert.equal(row.issued, 1);
  assert.equal(row.inRepair, 2);
  assert.equal(stockRowTotal(row), 8);
  assert.equal(result.movements[0].kind, 'return_faulty');
});

test('returning more than is out is refused unchanged', () => {
  const over = returnFaultyStock(ROWS, [], { item: 'onu', location: 'shop', qty: 3, date: '2026-11-05', target: 'job 7' });
  assert.equal(over.applied, false);
  assert.deepEqual(over.rows, normalizeStockRowList(ROWS));
});

test('low-stock signals: strictly below minimum, with the shortfall', () => {
  const signals = lowStockSignals(ROWS);
  assert.equal(signals.length, 1);
  assert.deepEqual(signals[0], { item: 'onu', location: 'field_kit', onHand: 1, minimum: 2, shortfall: 1 });
  // At the minimum is fine, and no minimum set never signals.
  assert.equal(lowStockSignals([{ item: 'router', location: 'shop', onHand: 2, minimum: 2 }]).length, 0);
  assert.equal(lowStockSignals([{ item: 'router', location: 'shop', onHand: 0, minimum: null }]).length, 0);
});

test('setting a minimum: valid applies, invalid refused, missing row created', () => {
  const set = setStockMinimum(ROWS, 'drop_cable', 'shop', 12);
  assert.equal(set.applied, true);
  assert.equal(findStockRow(set.rows, 'drop_cable', 'shop').minimum, 12);
  assert.equal(lowStockSignals(set.rows).some((s) => s.item === 'drop_cable'), true);
  const bad = setStockMinimum(ROWS, 'drop_cable', 'shop', -1);
  assert.equal(bad.applied, false);
  const created = setStockMinimum([], 'connector', 'shop', 5);
  assert.equal(created.applied, true);
  assert.equal(created.rows.length, 1);
  assert.equal(created.rows[0].onHand, 0);
});

test('inputs are never mutated', () => {
  const before = JSON.parse(JSON.stringify(ROWS));
  issueStock(ROWS, [], { item: 'onu', location: 'shop', qty: 1, date: '2026-11-04', target: 'job 1' });
  returnFaultyStock(ROWS, [], { item: 'onu', location: 'shop', qty: 1, date: '2026-11-05', target: 'job 1' });
  setStockMinimum(ROWS, 'onu', 'shop', 9);
  assert.deepEqual(ROWS, before);
});

test('the register holds no bill, payment, ticket, or connection field', () => {
  const row = normalizeStockRow({ item: 'onu', location: 'shop', onHand: 1 });
  assert.deepEqual(Object.keys(row).sort(), ['inRepair', 'issued', 'item', 'location', 'minimum', 'note', 'onHand']);
  const movement = receiveStock([], [], { item: 'onu', location: 'shop', qty: 1, date: '2026-11-04' }).movements[0];
  assert.deepEqual(Object.keys(movement).sort(), ['date', 'id', 'item', 'kind', 'location', 'note', 'qty', 'target']);
});

test('summary text, HTML escaping, CSV quoting, filename', () => {
  assert.equal(
    stockSummaryText(ROWS, [{ id: 'm1', kind: 'receive', item: 'onu', location: 'shop', qty: 1, date: '2026-11-04' }]),
    '4 stock rows, 18 on hand, 2 issued, 1 in repair, 1 low-stock signal, 1 movement recorded.',
  );
  assert.match(stockRowsHtml([{ item: 'onu', location: 'shop', onHand: 0, minimum: 2, note: '<b>' }]), /Low stock — short 2/);
  assert.match(stockMovementsHtml([{ id: 'm1', kind: 'issue', item: 'onu', location: 'shop', qty: 1, date: '2026-11-04', target: '<Ahmed>' }]), /&lt;Ahmed&gt;/);
  const csv = stockCsv([{ item: 'onu', location: 'shop', onHand: 1, issued: 0, inRepair: 0, minimum: 2 }]);
  assert.match(csv, /ONU,Shop,1,0,0,1,2,Low stock — short 1/);
  assert.equal(stockFilename('2026-11-04'), 'stock-register-2026-11-04.csv');
  assert.equal(stockFilename('2026-02-30'), 'stock-register-stock.csv');
});
