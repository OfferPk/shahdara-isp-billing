// SISP-24: Optical Splitter Box (1:8 / 1:16 PLC) Port Map & Customer RX
// Signal (dBm) Tracker. Pure-function tests on synthetic data only.
// Spec test criterion (verbatim): assigning Port 4 on a 1:8 splitter marks
// Port 4 occupied by that customer, leaves 7 ports free, and flags
// -28.5 dBm with a high-loss warning badge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEAK_RX_DBM_THRESHOLD,
  buildSplitterBoxes,
  buildSplitterOverview,
  buildSplitterPortMap,
  formatRxDbm,
  isWeakRx,
  normalizeOpticalFields,
  renderSplitterPortGrid,
  rxSignalStatus
} from '../splitter-map.js';
import { addCustomer, createInitialState, updateCustomerProfile } from '../core.js';

const customer = (overrides = {}) => ({
  id: 'c1',
  name: 'Test Customer 34',
  splitterBoxId: 'SPL-Barrian-02',
  splitterPort: 4,
  oltPonPort: 'PON 1/2/3',
  lastRxDbm: -28.5,
  ...overrides
});

test('spec criterion verbatim: port 4 on a 1:8 splitter occupied, 7 free, -28.5 dBm flagged weak', () => {
  const box = buildSplitterPortMap([customer()], 'SPL-Barrian-02', 8);
  assert.equal(box.portCount, 8);
  assert.equal(box.ports[3].status, 'occupied');
  assert.equal(box.ports[3].customerName, 'Test Customer 34');
  assert.equal(box.occupiedCount, 1);
  assert.equal(box.freeCount, 7);
  assert.deepEqual(box.freePorts, [1, 2, 3, 5, 6, 7, 8]);
  assert.equal(box.weakCount, 1);
  assert.equal(isWeakRx(-28.5), true);
  const grid = renderSplitterPortGrid(box);
  assert.match(grid, /High-loss/);
  assert.match(grid, /Test Customer 34/);
  assert.match(grid, /-28\.5 dBm/);
});

test('weak-signal line: -26.0 dBm is healthy, just below is weak, missing is unknown', () => {
  assert.equal(WEAK_RX_DBM_THRESHOLD, -26.0);
  assert.equal(rxSignalStatus(-26.0), 'healthy');
  assert.equal(rxSignalStatus(-26.1), 'weak');
  assert.equal(rxSignalStatus(-19.4), 'healthy');
  assert.equal(rxSignalStatus(null), 'unknown');
  assert.equal(rxSignalStatus(''), 'unknown');
  assert.equal(rxSignalStatus('garbage'), 'unknown');
  assert.equal(formatRxDbm(null), 'Not recorded');
  assert.equal(formatRxDbm(-19.4), '-19.4 dBm');
});

test('normalizeOpticalFields: old records without optical fields read back empty, never crash', () => {
  assert.deepEqual(normalizeOpticalFields({}), {
    splitterBoxId: '',
    splitterPort: null,
    oltPonPort: '',
    lastRxDbm: null
  });
  assert.deepEqual(normalizeOpticalFields(null), {
    splitterBoxId: '',
    splitterPort: null,
    oltPonPort: '',
    lastRxDbm: null
  });
  const normalized = normalizeOpticalFields(customer({ splitterPort: '4', lastRxDbm: '-28.54' }));
  assert.equal(normalized.splitterPort, 4);
  assert.equal(normalized.lastRxDbm, -28.5);
  assert.equal(normalizeOpticalFields(customer({ splitterPort: 17 })).splitterPort, null);
  assert.equal(normalizeOpticalFields(customer({ splitterPort: 0 })).splitterPort, null);
});

test('box size derives from data: a port above 8 makes a 1:16 box', () => {
  const boxes = buildSplitterBoxes([
    customer({ id: 'c1' }),
    customer({ id: 'c2', name: 'BILAL', splitterPort: 12, lastRxDbm: -20.1 })
  ]);
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].portCount, 16);
  assert.equal(boxes[0].occupiedCount, 2);
  assert.equal(boxes[0].freeCount, 14);
  const other = buildSplitterBoxes([customer({ splitterBoxId: 'SPL-A', splitterPort: 2 })]);
  assert.equal(other[0].portCount, 8);
});

test('out-of-range and double-booked ports surface instead of vanishing', () => {
  const box = buildSplitterPortMap([
    customer({ id: 'c1' }),
    customer({ id: 'c2', name: 'DUPLICATE', splitterPort: 4 }),
    customer({ id: 'c3', name: 'TOO HIGH', splitterPort: 12 })
  ], 'SPL-Barrian-02', 8);
  assert.equal(box.occupiedCount, 1);
  assert.equal(box.outOfRange.length, 2);
  assert.equal(box.outOfRange.some((entry) => entry.duplicatePort === true), true);
  assert.equal(box.outOfRange.some((entry) => entry.splitterPort === 12), true);
});

test('overview: weak customers across boxes, empty network is zeroed', () => {
  const empty = buildSplitterOverview([]);
  assert.equal(empty.boxCount, 0);
  assert.equal(empty.weakCount, 0);
  const overview = buildSplitterOverview([
    customer(),
    customer({ id: 'c2', name: 'HEALTHY', splitterBoxId: 'SPL-Other-01', splitterPort: 1, lastRxDbm: -19.4 })
  ]);
  assert.equal(overview.boxCount, 2);
  assert.equal(overview.weakCount, 1);
  assert.equal(overview.weakCustomers[0].customerName, 'Test Customer 34');
});

test('core: addCustomer + updateCustomerProfile carry optical fields, invalid values throw', () => {
  let state = createInitialState();
  state = addCustomer(state, 'OPTICAL TEST', new Date('2026-10-01'), {
    splitterBoxId: 'SPL-Barrian-02',
    splitterPort: '4',
    oltPonPort: 'PON 1/2/3',
    lastRxDbm: '-28.5'
  });
  const added = state.customers.at(-1);
  assert.equal(added.splitterBoxId, 'SPL-Barrian-02');
  assert.equal(added.splitterPort, 4);
  assert.equal(added.oltPonPort, 'PON 1/2/3');
  assert.equal(added.lastRxDbm, -28.5);
  state = updateCustomerProfile(state, added.id, { lastRxDbm: '-19.4', splitterPort: '7' });
  const updated = state.customers.find((c) => c.id === added.id);
  assert.equal(updated.lastRxDbm, -19.4);
  assert.equal(updated.splitterPort, 7);
  assert.equal(updated.splitterBoxId, 'SPL-Barrian-02');
  assert.throws(() => updateCustomerProfile(state, added.id, { splitterPort: '17' }), /between 1 and 16/);
  assert.throws(() => updateCustomerProfile(state, added.id, { lastRxDbm: '-99' }), /between -60 and 10/);
  assert.throws(() => addCustomer(state, 'BAD PORT', new Date(), { splitterPort: '0' }), /between 1 and 16/);
});

test('core: pre-SISP-24 customers keep working — optical fields default empty on edit', () => {
  let state = createInitialState();
  state = addCustomer(state, 'LEGACY TEST', new Date('2026-10-01'));
  const legacy = state.customers.at(-1);
  assert.equal(legacy.splitterBoxId, '');
  assert.equal(legacy.splitterPort, null);
  assert.equal(legacy.lastRxDbm, null);
  state = updateCustomerProfile(state, legacy.id, { phone: '03001234567' });
  const kept = state.customers.find((c) => c.id === legacy.id);
  assert.equal(kept.splitterBoxId, '');
  assert.equal(kept.splitterPort, null);
});
