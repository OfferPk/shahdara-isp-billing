// SISP-162: Single-Fiber WDM Media Converter A-Side (1310nm) vs
// B-Side (1550nm) Stock Matcher. Pure-function tests on synthetic data
// only. Pins the spec criteria:
//  - pair/imbalance math: A 7 / B 3 -> pairs 3, excess 4 on A;
//    A 0 / B 0 -> 0/0; balanced 5/5 -> excess 0, side null; legacy
//    unsided 4 -> pairs unchanged, unknown 4 (never counted as pairs).
//  - replacement suggestions on converter-fault tickets: side A +
//    A stock 2 -> names A + available; side B + B stock 0 ->
//    out-of-stock warning; no side recorded -> honest no-guess text.
//  - customerConverterSide profile field round-trips (addCustomer /
//    updateCustomerProfile / readState / JSON backup + safe-merge).
//  - the SISP-18 catalogue stays exactly the pinned 7 items (the side
//    ledger is a sibling store, NOT a catalogue extension).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addCustomer, createInitialState, createJsonBackup, persistState,
  previewJsonBackupMerge, readState, updateCustomerProfile
} from '../core.js';
import { INVENTORY_ITEMS, addMovement } from '../inventory-book.js';
import { STORAGE_KEY } from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';
import {
  CONVERTER_SIDE_LABELS, CONVERTER_SIDES_KEY,
  addConverterSideMovement, buildConverterPairing,
  buildConverterReplacementSuggestion, computeConverterSideStock,
  converterSideAvailable, converterSideLabel, converterSuggestionText,
  isConverterFaultTicket, loadConverterSides, normalizeConverterSide,
  sanitizeConverterSideMovements, saveConverterSides
} from '../wdm-converter-matcher.js';

function fakeStore(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
    _read: () => value
  };
}

const sideLog = (rows) => rows.reduce(
  (acc, [side, kind, qty]) => addConverterSideMovement(acc, { side, kind, qty, date: '2026-10-05' }),
  []
);

const mainWithLegacyConverters = (qty) => addMovement([], { itemId: 'media-converter', kind: 'in', qty, date: '2026-10-01' });

test('pairs math: A 7 / B 3 -> 3 deployable pairs, excess 4 on side A', () => {
  const pairing = buildConverterPairing(sideLog([['A', 'in', 7], ['B', 'in', 3]]), []);
  assert.equal(pairing.sideA, 7);
  assert.equal(pairing.sideB, 3);
  assert.equal(pairing.pairs, 3);
  assert.equal(pairing.excess, 4);
  assert.equal(pairing.excessSide, 'A');
  assert.equal(pairing.unknownSide, 0);
});

test('pairs math: A 0 / B 0 -> no pairs, no excess, no excess side', () => {
  const pairing = buildConverterPairing([], []);
  assert.deepEqual(
    { pairs: pairing.pairs, excess: pairing.excess, excessSide: pairing.excessSide },
    { pairs: 0, excess: 0, excessSide: null }
  );
});

test('pairs math: balanced 5/5 -> 5 pairs, excess 0, side null', () => {
  const pairing = buildConverterPairing(sideLog([['A', 'in', 5], ['B', 'in', 5]]), []);
  assert.equal(pairing.pairs, 5);
  assert.equal(pairing.excess, 0);
  assert.equal(pairing.excessSide, null);
});

test('pairs math: excess names side B when B is the surplus side', () => {
  const pairing = buildConverterPairing(sideLog([['A', 'in', 2], ['B', 'in', 6]]), []);
  assert.equal(pairing.pairs, 2);
  assert.equal(pairing.excess, 4);
  assert.equal(pairing.excessSide, 'B');
});

test('legacy unsided stock: 4 in the main book -> unknown 4, pairs never count it', () => {
  const main = mainWithLegacyConverters(4);
  const empty = buildConverterPairing([], main);
  assert.equal(empty.unknownSide, 4);
  assert.equal(empty.pairs, 0);
  const sided = buildConverterPairing(sideLog([['A', 'in', 7], ['B', 'in', 3]]), main);
  assert.equal(sided.unknownSide, 4);
  assert.equal(sided.pairs, 3);
  assert.equal(sided.excess, 4);
});

test('side stock derives per side: outs reduce only their own side', () => {
  const movements = sideLog([['A', 'in', 7], ['A', 'out', 2], ['B', 'in', 3], ['B', 'out', 3]]);
  const stock = computeConverterSideStock(movements);
  assert.deepEqual(stock.A, { totalIn: 7, totalOut: 2, available: 5 });
  assert.deepEqual(stock.B, { totalIn: 3, totalOut: 3, available: 0 });
  assert.equal(converterSideAvailable(movements, 'A'), 5);
  assert.equal(converterSideAvailable(movements, 'B'), 0);
  assert.equal(converterSideAvailable(movements, 'C'), 0);
});

test('side stock-out beyond that side is refused even when the other side has surplus', () => {
  const movements = sideLog([['A', 'in', 5], ['B', 'in', 1]]);
  assert.throws(
    () => addConverterSideMovement(movements, { side: 'B', kind: 'out', qty: 2, date: '2026-10-06' }),
    /exceeds available stock for this side/
  );
  assert.throws(
    () => addConverterSideMovement(movements, { side: 'C', kind: 'in', qty: 1, date: '2026-10-06' }),
    /must be A or B/
  );
  assert.throws(
    () => addConverterSideMovement(movements, { side: 'A', kind: 'in', qty: 1.5, date: '2026-10-06' }),
    /positive whole number/
  );
});

test('sanitizer drops junk rows and keeps clean movements; load/save round-trip', () => {
  const cleaned = sanitizeConverterSideMovements([
    { id: 'WDM-101', side: 'A', kind: 'in', qty: 4, date: '2026-10-01', note: 'Purchase' },
    { id: 'x', side: 'C', kind: 'in', qty: 4, date: '2026-10-01' },
    { id: 'x', side: 'B', kind: 'sideways', qty: 4, date: '2026-10-01' },
    { id: 'x', side: 'B', kind: 'in', qty: 0, date: '2026-10-01' },
    { id: 'x', side: 'B', kind: 'in', qty: 2, date: '10/01/2026' },
    null, 'junk'
  ]);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].side, 'A');

  const store = fakeStore();
  const movements = sideLog([['A', 'in', 3], ['B', 'in', 3]]);
  assert.equal(saveConverterSides(movements, store), true);
  assert.equal(loadConverterSides(store).length, 2);
  assert.deepEqual(loadConverterSides(fakeStore('{broken')), []);
  assert.equal(JSON.parse(store._read())[0].id, 'WDM-101');
});

test('normalize + labels: only the two physical sides exist', () => {
  assert.equal(normalizeConverterSide('A'), 'A');
  assert.equal(normalizeConverterSide('B'), 'B');
  assert.equal(normalizeConverterSide('a'), '');
  assert.equal(normalizeConverterSide(''), '');
  assert.equal(normalizeConverterSide(undefined), '');
  assert.equal(converterSideLabel('A'), 'A-Side (1310nm)');
  assert.equal(converterSideLabel('B'), 'B-Side (1550nm)');
  assert.equal(CONVERTER_SIDE_LABELS.B, 'B-Side (1550nm)');
  assert.equal(converterSideLabel(''), '');
});

test('suggestion: side A customer + A stock 2 -> names side A and the count', () => {
  const ticket = { id: 'TKT-101', customerId: 'c1', faultPreset: 'Media Converter Power/Charger', customFault: '' };
  const customer = { id: 'c1', name: 'TEST USER ONE', customerConverterSide: 'A' };
  const suggestion = buildConverterReplacementSuggestion(ticket, customer, sideLog([['A', 'in', 2]]));
  assert.deepEqual(suggestion, { kind: 'available', side: 'A', available: 2 });
  const text = converterSuggestionText(suggestion);
  assert.ok(text.includes('A-Side (1310nm)'));
  assert.ok(text.includes('2'));
  assert.ok(!text.includes('wdmc_'));
});

test('suggestion: side B customer + B stock 0 -> out-of-stock warning, other side never offered', () => {
  const ticket = { id: 'TKT-102', customerId: 'c2', faultPreset: 'Media Converter Power/Charger', customFault: '' };
  const customer = { id: 'c2', name: 'TEST USER TWO', customerConverterSide: 'B' };
  const suggestion = buildConverterReplacementSuggestion(ticket, customer, sideLog([['A', 'in', 9]]));
  assert.deepEqual(suggestion, { kind: 'out-of-stock', side: 'B', available: 0 });
  const text = converterSuggestionText(suggestion);
  assert.ok(text.includes('B-Side (1550nm)'));
  assert.ok(/out of stock/.test(text));
});

test('suggestion: no recorded side -> honest no-guess text, never a side named as fact', () => {
  const ticket = { id: 'TKT-103', customerId: 'c3', faultPreset: 'Media Converter Power/Charger', customFault: '' };
  const customer = { id: 'c3', name: 'TEST USER THREE', customerConverterSide: '' };
  const suggestion = buildConverterReplacementSuggestion(ticket, customer, sideLog([['A', 'in', 4], ['B', 'in', 4]]));
  assert.deepEqual(suggestion, { kind: 'no-side', side: '', available: 0 });
  assert.ok(/no recorded converter side/.test(converterSuggestionText(suggestion)));
});

test('suggestion: non-converter tickets get no suggestion at all', () => {
  const customer = { id: 'c1', name: 'TEST USER ONE', customerConverterSide: 'A' };
  const fiberTicket = { id: 'TKT-104', customerId: 'c1', faultPreset: 'Fiber Cut / Splice Loss', customFault: '' };
  assert.equal(isConverterFaultTicket(fiberTicket), false);
  assert.equal(buildConverterReplacementSuggestion(fiberTicket, customer, sideLog([['A', 'in', 2]])), null);
  assert.equal(converterSuggestionText(null), '');
  // A custom fault naming a converter is in the family too.
  const customTicket = { id: 'TKT-105', customerId: 'c1', faultPreset: '', customFault: 'Media converter dead, no light' };
  assert.equal(isConverterFaultTicket(customTicket), true);
  assert.equal(buildConverterReplacementSuggestion(customTicket, customer, sideLog([['A', 'in', 1]])).kind, 'available');
});

test('suggestion is read-only: building it never mutates stock, ticket or customer', () => {
  const ticket = { id: 'TKT-106', customerId: 'c1', faultPreset: 'Media Converter Power/Charger', customFault: '' };
  const customer = { id: 'c1', name: 'TEST USER ONE', customerConverterSide: 'A' };
  const movements = sideLog([['A', 'in', 2]]);
  const before = JSON.stringify({ ticket, customer, movements });
  buildConverterReplacementSuggestion(ticket, customer, movements);
  buildConverterPairing(movements, mainWithLegacyConverters(4));
  assert.equal(JSON.stringify({ ticket, customer, movements }), before);
});

test('profile field: addCustomer + updateCustomerProfile carry the side; junk coerces to not-recorded', () => {
  let state = createInitialState();
  state = addCustomer(state, 'WDM TEST ONE', new Date('2026-10-01'), { customerConverterSide: 'B' });
  const added = state.customers[0];
  assert.equal(added.customerConverterSide, 'B');
  state = updateCustomerProfile(state, added.id, { customerConverterSide: 'A' });
  assert.equal(state.customers[0].customerConverterSide, 'A');
  // An unrelated profile save leaves the recorded side untouched.
  state = updateCustomerProfile(state, added.id, { phone: '0300-0000000' });
  assert.equal(state.customers[0].customerConverterSide, 'A');
  // Junk coerces to '' instead of blocking the save; '' clears the side.
  state = updateCustomerProfile(state, added.id, { customerConverterSide: 'Z' });
  assert.equal(state.customers[0].customerConverterSide, '');
  state = addCustomer(state, 'WDM TEST TWO', new Date('2026-10-01'), { customerConverterSide: 'Q' });
  assert.equal(state.customers[1].customerConverterSide, '');
  state = addCustomer(state, 'WDM TEST THREE', new Date('2026-10-01'), {});
  assert.equal(state.customers[2].customerConverterSide, '');
});

test('profile field: readState round-trip keeps A/B and sanitizes junk to not-recorded', () => {
  let state = createInitialState();
  state = addCustomer(state, 'WDM TEST ONE', new Date('2026-10-01'), { customerConverterSide: 'A' });
  const storage = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  persistState(state, storage);
  assert.equal(readState(storage).customers[0].customerConverterSide, 'A');
  const parsed = JSON.parse(storage.data[STORAGE_KEY]);
  parsed.customers[0].customerConverterSide = 'X';
  storage.data[STORAGE_KEY] = JSON.stringify(parsed);
  assert.equal(readState(storage).customers[0].customerConverterSide, '');
});

test('backup round-trip: side field + side movements travel and safe-merge restores only onto an empty device', () => {
  let state = createInitialState();
  state = addCustomer(state, 'WDM TEST ONE', new Date('2026-10-01'), { customerConverterSide: 'B' });
  const movements = sideLog([['A', 'in', 7], ['B', 'in', 3]]);
  const backupText = createJsonBackup(state, new Date('2026-10-31T12:00:00+05:00'), { converterSides: movements });
  const parsed = JSON.parse(backupText);
  assert.equal(parsed.settings.converterSides.length, 2);

  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.equal(preview.state.customers[0].customerConverterSide, 'B');
  assert.equal(preview.converterSides.length, 2);
  assert.equal(preview.counts.converterSidesRestored, 1);

  const other = sideLog([['A', 'in', 1]]);
  const clash = previewJsonBackupMerge(createInitialState(), backupText, { currentConverterSides: other, currentConverterSidesStored: true });
  assert.equal(clash.converterSides, null);
  assert.ok(clash.conflicts.some((c) => c.field === 'WDM converter side records differ from this device'));

  const identical = previewJsonBackupMerge(createInitialState(), backupText, { currentConverterSides: movements, currentConverterSidesStored: true });
  assert.equal(identical.converterSides, null);
  assert.equal(identical.conflicts.filter((c) => c.field.startsWith('WDM')).length, 0);
});

test('backup merge: an existing customer gains the side from a backup that recorded it', () => {
  let state = createInitialState();
  state = addCustomer(state, 'WDM TEST ONE', new Date('2026-10-01'), {});
  const withSide = updateCustomerProfile(state, state.customers[0].id, { customerConverterSide: 'A' });
  const backupText = createJsonBackup(withSide, new Date('2026-10-31T12:00:00+05:00'), {});
  const preview = previewJsonBackupMerge(state, backupText);
  const merged = preview.state.customers.find((c) => c.name === 'WDM TEST ONE');
  assert.equal(merged.customerConverterSide, 'A');
});

test('catalogue untouched: the SISP-18 spec catalogue is still exactly the 7 pinned items', () => {
  assert.deepEqual(
    INVENTORY_ITEMS.map((i) => i.id),
    ['fiber-2core', 'router', 'media-converter', 'patch-cord', 'cat6', 'rj45', 'pole']
  );
});

test('i18n audit: every wdmc_ key used in code exists in en + ur with matching placeholders', () => {
  const used = new Set();
  for (const file of ['../wdm-converter-matcher.js', '../app.js', '../index.html']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const match of source.matchAll(/wdmc_[a-z_]+/g)) used.add(match[0]);
  }
  assert.ok(used.size >= 10);
  const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of used) {
    assert.ok(TRANSLATIONS.en[key], `missing en key ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur key ${key}`);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `placeholder mismatch ${key}`);
  }
  // And every dictionary wdmc_ key is actually used somewhere (no orphans).
  for (const key of Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('wdmc_'))) {
    assert.ok(used.has(key), `orphan dictionary key ${key}`);
  }
});

test('wiring pins: panel + profile field exist in index.html; module is not a build entry', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['wdmMatcherPanel', 'wdmMatcherForm', 'wdmMatcherSide', 'wdmMatcherKind', 'wdmMatcherQty', 'wdmMatcherDate', 'wdmMatcherNote', 'wdmMatcherLogList', 'converterSideInput']) {
    assert.ok(html.includes(`id="${id}"`), `index.html missing #${id}`);
  }
  const build = readFileSync(new URL('../build.mjs', import.meta.url), 'utf8');
  assert.ok(!build.includes('wdm-converter-matcher'), 'matcher module must stay out of ENTRY_FILES (dist budget 25)');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './wdm-converter-matcher.js'"), 'app.js must import the matcher module');
  assert.ok(app.includes('converterSuggestionForTicket'), 'app.js must inject the ticket suggestion');
  assert.equal(CONVERTER_SIDES_KEY, 'sisp_converter_sides_v1');
});
