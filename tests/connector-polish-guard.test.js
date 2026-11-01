// SISP-167: SC/UPC (Blue) vs. SC/APC (Green) Connector Polish Mismatch
// Guard. Pure-function + core-wiring tests on synthetic data only.
// Spec pins: matching vs mismatched detection (both directions), either
// side unknown → 'unknown' with NO warning, box-less customers excluded
// from the fleet report, the fleet report counts only true mismatches,
// the polish store round-trips + safe-merges, and the customer field
// sanitizes through every core choke point + backups.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SPLITTER_POLISH_KEY,
  boxPolishFor,
  buildPolishMismatchReport,
  evaluateConnectorMismatch,
  loadSplitterPolish,
  polishLabel,
  sanitizeOnuConnectorType,
  sanitizeSplitterPolishMap,
  saveSplitterPolish,
  setSplitterPolish
} from '../connector-polish-guard.js';
import {
  addCustomer,
  createInitialState,
  createJsonBackup,
  persistState,
  previewJsonBackupMerge,
  readState,
  updateCustomerProfile
} from '../core.js';
import { buildSplitterBoxes, buildSplitterPortMap, renderSplitterPortGrid } from '../splitter-map.js';
import { TRANSLATIONS } from '../nav-language.js';

const store = () => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k)
  };
};

const cust = (overrides = {}) => ({
  id: 'c1',
  name: 'Test Customer 51',
  customerNumber: 51,
  splitterBoxId: 'SPL-Test-01',
  splitterPort: 4,
  onuConnectorType: 'UPC',
  archived: false,
  ...overrides
});

test('evaluator: UPC box + UPC ONU → match; APC box + APC ONU → match', () => {
  assert.deepEqual(evaluateConnectorMismatch(cust(), { 'SPL-Test-01': 'UPC' }), { status: 'match', boxPolish: 'UPC', onuType: 'UPC' });
  assert.deepEqual(evaluateConnectorMismatch(cust({ onuConnectorType: 'APC' }), { 'SPL-Test-01': 'APC' }), { status: 'match', boxPolish: 'APC', onuType: 'APC' });
});

test('evaluator: APC box + UPC ONU → mismatch; UPC box + APC ONU → mismatch', () => {
  assert.deepEqual(evaluateConnectorMismatch(cust(), { 'SPL-Test-01': 'APC' }), { status: 'mismatch', boxPolish: 'APC', onuType: 'UPC' });
  assert.deepEqual(evaluateConnectorMismatch(cust({ onuConnectorType: 'APC' }), { 'SPL-Test-01': 'UPC' }), { status: 'mismatch', boxPolish: 'UPC', onuType: 'APC' });
});

test('evaluator: either side unknown → unknown, never a guessed mismatch', () => {
  // Box polish not recorded.
  assert.equal(evaluateConnectorMismatch(cust(), {}).status, 'unknown');
  assert.equal(evaluateConnectorMismatch(cust(), { 'SPL-Other-99': 'APC' }).status, 'unknown');
  // ONU type not recorded.
  assert.equal(evaluateConnectorMismatch(cust({ onuConnectorType: '' }), { 'SPL-Test-01': 'APC' }).status, 'unknown');
  assert.equal(evaluateConnectorMismatch(cust({ onuConnectorType: undefined }), { 'SPL-Test-01': 'APC' }).status, 'unknown');
  // Junk values are unknown, not a match or mismatch.
  assert.equal(evaluateConnectorMismatch(cust({ onuConnectorType: 'upc' }), { 'SPL-Test-01': 'UPC' }).status, 'unknown');
  assert.equal(evaluateConnectorMismatch(cust(), { 'SPL-Test-01': 'green' }).status, 'unknown');
  // No box at all → unknown (nothing to compare).
  assert.deepEqual(evaluateConnectorMismatch(cust({ splitterBoxId: '' }), { 'SPL-Test-01': 'APC' }), { status: 'unknown', boxPolish: '', onuType: 'UPC' });
  assert.equal(evaluateConnectorMismatch(null, null).status, 'unknown');
});

test('labels: technical names stay as-is', () => {
  assert.equal(polishLabel('UPC'), 'SC/UPC (Blue)');
  assert.equal(polishLabel('APC'), 'SC/APC (Green)');
  assert.equal(polishLabel(''), '');
  assert.equal(polishLabel('junk'), '');
});

test('sanitizers drop non-UPC/APC values and unknown shapes', () => {
  assert.equal(sanitizeOnuConnectorType('UPC'), 'UPC');
  assert.equal(sanitizeOnuConnectorType('APC'), 'APC');
  assert.equal(sanitizeOnuConnectorType('upc'), '');
  assert.equal(sanitizeOnuConnectorType(' SC/APC '), '');
  assert.equal(sanitizeOnuConnectorType(42), '');
  assert.equal(sanitizeOnuConnectorType(null), '');
  assert.deepEqual(sanitizeSplitterPolishMap({ ' SPL-A ': 'UPC', 'SPL-B': 'green', '': 'APC', 'SPL-C': 'APC', 'SPL-D': 7 }), { 'SPL-A': 'UPC', 'SPL-C': 'APC' });
  assert.deepEqual(sanitizeSplitterPolishMap(null), {});
  assert.deepEqual(sanitizeSplitterPolishMap(['UPC']), {});
  assert.deepEqual(sanitizeSplitterPolishMap('UPC'), {});
});

test('setSplitterPolish is pure; empty type removes the entry (back to unknown)', () => {
  const before = { 'SPL-A': 'UPC' };
  const after = setSplitterPolish(before, 'SPL-B', 'APC');
  assert.deepEqual(before, { 'SPL-A': 'UPC' }, 'input never mutated');
  assert.deepEqual(after, { 'SPL-A': 'UPC', 'SPL-B': 'APC' });
  assert.deepEqual(setSplitterPolish(after, 'SPL-A', ''), { 'SPL-B': 'APC' });
  assert.deepEqual(setSplitterPolish(after, 'SPL-A', 'junk'), { 'SPL-B': 'APC' });
  assert.equal(boxPolishFor(after, 'SPL-B'), 'APC');
  assert.equal(boxPolishFor(after, 'SPL-Z'), '');
});

test('store round-trip: save → load returns the sanitized map; corrupt storage reads {}', () => {
  const storage = store();
  assert.deepEqual(loadSplitterPolish(storage), {});
  assert.equal(saveSplitterPolish({ 'SPL-A': 'APC', '': 'UPC', 'SPL-B': 'bad' }, storage), true);
  assert.equal(storage.getItem(SPLITTER_POLISH_KEY), JSON.stringify({ 'SPL-A': 'APC' }));
  assert.deepEqual(loadSplitterPolish(storage), { 'SPL-A': 'APC' });
  storage.setItem(SPLITTER_POLISH_KEY, '{not json');
  assert.deepEqual(loadSplitterPolish(storage), {});
});

test('fleet report counts only true mismatches among active, boxed, ported customers', () => {
  const polish = { 'SPL-Test-01': 'APC', 'SPL-Test-02': 'UPC' };
  const customers = [
    cust({ id: 'm1', customerNumber: 61, splitterPort: 1 }), // APC box vs UPC ONU → mismatch
    cust({ id: 'm2', customerNumber: 62, splitterPort: 2, onuConnectorType: 'APC' }), // match
    cust({ id: 'm3', customerNumber: 63, splitterPort: 3, onuConnectorType: '' }), // ONU unknown
    cust({ id: 'm4', customerNumber: 64, splitterBoxId: 'SPL-Test-02', splitterPort: 1, onuConnectorType: 'APC' }), // UPC box vs APC ONU → mismatch
    cust({ id: 'm5', customerNumber: 65, splitterBoxId: '', splitterPort: null, onuConnectorType: 'APC' }), // box-less → excluded
    cust({ id: 'm6', customerNumber: 66, splitterPort: 5, archived: true }), // archived → excluded
    cust({ id: 'm7', customerNumber: 67, splitterPort: null }), // no port → excluded
    cust({ id: 'm8', customerNumber: 68, splitterBoxId: 'SPL-Unrecorded', splitterPort: 1 }) // box polish unknown → excluded
  ];
  const report = buildPolishMismatchReport({ customers }, polish);
  assert.equal(report.count, 2);
  assert.deepEqual(report.mismatches.map((m) => m.customerId), ['m1', 'm4']);
  assert.deepEqual(report.mismatches[0], { customerId: 'm1', customerName: 'Test Customer 51', customerNumber: 61, boxId: 'SPL-Test-01', splitterPort: 1, boxPolish: 'APC', onuType: 'UPC' });
  // Bare-array input works too, and the state is never mutated.
  assert.equal(buildPolishMismatchReport(customers, polish).count, 2);
  assert.equal(buildPolishMismatchReport(null, polish).count, 0);
  assert.equal(customers.length, 8);
});

test('core: addCustomer + updateCustomerProfile carry onuConnectorType, junk sanitizes to unknown', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Test Customer 71', new Date('2026-10-01'), { splitterBoxId: 'SPL-Test-01', splitterPort: 4, onuConnectorType: 'APC' });
  const added = state.customers.at(-1);
  assert.equal(added.onuConnectorType, 'APC');
  state = addCustomer(state, 'Test Customer 72', new Date('2026-10-01'), { onuConnectorType: 'blue' });
  assert.equal(state.customers.at(-1).onuConnectorType, '');
  state = updateCustomerProfile(state, added.id, { onuConnectorType: 'UPC' });
  assert.equal(state.customers.find((c) => c.id === added.id).onuConnectorType, 'UPC');
  state = updateCustomerProfile(state, added.id, { onuConnectorType: 'nonsense' });
  assert.equal(state.customers.find((c) => c.id === added.id).onuConnectorType, '');
  // A profile save that never mentions the field keeps the recorded type.
  state = updateCustomerProfile(state, added.id, { onuConnectorType: 'APC' });
  state = updateCustomerProfile(state, added.id, { address: 'Fixture address' });
  assert.equal(state.customers.find((c) => c.id === added.id).onuConnectorType, 'APC');
});

test('core: onuConnectorType survives persist/readState; legacy records load as unknown', () => {
  const storage = store();
  let state = createInitialState();
  state = addCustomer(state, 'Test Customer 73', new Date('2026-10-01'), { onuConnectorType: 'APC' });
  state = addCustomer(state, 'Test Customer 74', new Date('2026-10-01'), {});
  persistState(state, storage);
  const restored = readState(storage);
  assert.equal(restored.customers.find((c) => c.name === 'Test Customer 73').onuConnectorType, 'APC');
  assert.equal(restored.customers.find((c) => c.name === 'Test Customer 74').onuConnectorType, '');
});

test('backup: splitterPolish section written only when a polish is recorded, sanitized', () => {
  const ref = new Date('2026-10-30T00:00:00Z');
  const withPolish = JSON.parse(createJsonBackup(createInitialState(), ref, { splitterPolish: { 'SPL-A': 'APC', 'SPL-B': 'junk' } }));
  assert.deepEqual(withPolish.settings.splitterPolish, { 'SPL-A': 'APC' });
  const without = JSON.parse(createJsonBackup(createInitialState(), ref, { splitterPolish: {} }));
  assert.equal(without.settings?.splitterPolish, undefined);
  const noOption = JSON.parse(createJsonBackup(createInitialState(), ref));
  assert.equal(noOption.settings?.splitterPolish, undefined);
});

test('backup safe-merge: adopt on empty device, identical is a no-op, differing is a conflict', () => {
  const ref = new Date('2026-10-30T00:00:00Z');
  const backup = createJsonBackup(createInitialState(), ref, { splitterPolish: { 'SPL-A': 'APC' } });
  const adopted = previewJsonBackupMerge(createInitialState(), backup, { currentSplitterPolish: {}, currentSplitterPolishStored: false });
  assert.deepEqual(adopted.splitterPolish, { 'SPL-A': 'APC' });
  assert.equal(adopted.counts.splitterPolishRestored, 1);
  assert.equal(adopted.canApply, true);
  const identical = previewJsonBackupMerge(createInitialState(), backup, { currentSplitterPolish: { 'SPL-A': 'APC' }, currentSplitterPolishStored: true });
  assert.equal(identical.splitterPolish, null);
  assert.equal(identical.counts.splitterPolishRestored, 0);
  assert.equal(identical.conflicts.length, 0);
  const differing = previewJsonBackupMerge(createInitialState(), backup, { currentSplitterPolish: { 'SPL-A': 'UPC' }, currentSplitterPolishStored: true });
  assert.equal(differing.splitterPolish, null);
  assert.equal(differing.counts.splitterPolishRestored, 0);
  assert.ok(differing.conflicts.some((c) => /Splitter box polish/.test(c.field)));
});

test('backup: customer onuConnectorType travels — new customer imports it, merge fills a local blank', () => {
  const ref = new Date('2026-10-30T00:00:00Z');
  let source = createInitialState();
  source = addCustomer(source, 'Test Customer 75', new Date('2026-10-01'), { onuConnectorType: 'APC' });
  const backup = createJsonBackup(source, ref);
  const fresh = previewJsonBackupMerge(createInitialState(), backup, {});
  assert.equal(fresh.state.customers.find((c) => c.name === 'Test Customer 75').onuConnectorType, 'APC');
  // Same customer already local without the field → merge fills it.
  let local = createInitialState();
  local = addCustomer(local, 'Test Customer 75', new Date('2026-10-01'), {});
  const localId = local.customers.at(-1).id;
  const sourceId = source.customers.at(-1).id;
  local = { ...local, customers: local.customers.map((c) => ({ ...c, id: sourceId })) };
  assert.equal(local.customers[0].id, sourceId);
  assert.notEqual(localId, sourceId);
  const filled = previewJsonBackupMerge(local, backup, {});
  const merged = filled.state.customers.find((c) => c.name === 'Test Customer 75');
  assert.equal(merged.onuConnectorType, 'APC');
});

test('splitter map: port slots carry polishStatus and mismatched cells render the badge', () => {
  const customers = [
    cust({ id: 'p1', splitterPort: 1 }), // UPC ONU on APC box → mismatch
    cust({ id: 'p2', splitterPort: 2, onuConnectorType: 'APC' }), // match
    cust({ id: 'p3', splitterPort: 3, onuConnectorType: '' }) // unknown
  ];
  const box = buildSplitterPortMap(customers, 'SPL-Test-01', 8, { 'SPL-Test-01': 'APC' });
  assert.equal(box.ports[0].polishStatus, 'mismatch');
  assert.equal(box.ports[1].polishStatus, 'match');
  assert.equal(box.ports[2].polishStatus, 'unknown');
  assert.equal(box.polishMismatchCount, 1);
  const grid = renderSplitterPortGrid(box);
  assert.match(grid, /Polish mismatch/);
  assert.match(grid, /splitter-port-polish-mismatch/);
  // Without a polish map nothing is flagged (unknown everywhere).
  const blind = buildSplitterPortMap(customers, 'SPL-Test-01', 8);
  assert.equal(blind.polishMismatchCount, 0);
  assert.ok(blind.ports.every((slot) => slot.polishStatus === 'unknown'));
  assert.doesNotMatch(renderSplitterPortGrid(blind), /Polish mismatch/);
  // buildSplitterBoxes passes the map through.
  const boxes = buildSplitterBoxes(customers, { 'SPL-Test-01': 'APC' });
  assert.equal(boxes[0].polishMismatchCount, 1);
});

test('i18n audit: every polish_* key exists in en + ur with matching params, and every t() call resolves', () => {
  const keys = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('polish_'));
  assert.ok(keys.length >= 10, `expected the polish_* key family, got ${keys.length}`);
  const paramsOf = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `missing Urdu key: ${key}`);
    assert.deepEqual(paramsOf(TRANSLATIONS.ur[key]), paramsOf(TRANSLATIONS.en[key]), `param mismatch: ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key, `en renders the raw key: ${key}`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `ur renders the raw key: ${key}`);
  }
  for (const file of ['app.js', 'splitter-map.js']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const used = [...source.matchAll(/t\('(polish_[a-z0-9_]+)'/g)].map((m) => m[1]);
    assert.ok(used.length > 0, `${file} should reference polish_* keys`);
    for (const key of new Set(used)) {
      assert.ok(keys.includes(key), `${file} references undefined key ${key}`);
    }
  }
  // data-i18n references in the markup resolve too.
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const htmlKeys = [...html.matchAll(/data-i18n(?:-placeholder)?="(polish_[a-z0-9_]+)"/g)].map((m) => m[1]);
  assert.ok(htmlKeys.length > 0);
  for (const key of new Set(htmlKeys)) assert.ok(keys.includes(key), `index.html references undefined key ${key}`);
});
