// SISP-119: Fiber Drum Jacket Meter-Mark Cut Calculator.
// Pure-function tests on synthetic data only. Pins the spec criterion:
// a cut on Drum-01 from jacket mark 1500m to 1365m uses exactly 135m,
// updates the drum's remaining length, and — when the drum is linked to
// a Stock Book cable item — deducts exactly 135m from sisp_inventory_v1
// through the shipped SISP-18 addMovement path, exactly once. Also
// pins: atomic refusal (over-remaining cut, insufficient stock, zero
// cut), the unlinked-drum skip, derived remaining (never stored), the
// sanitizer recomputing metersUsed from the marks, the empty-start
// registry, the backup safe-merge round-trip, and the en+ur i18n audit
// of every drum_* / dash_drum_* key used by the module, app.js and
// index.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import { addMovement, availableFor, computeStock } from '../inventory-book.js';
import {
  FIBER_DRUMS_KEY,
  addDrum,
  drumRemainingMeters,
  drumUsedMeters,
  fiberDrumSummary,
  isMeterInventoryItem,
  loadFiberDrums,
  nextDrumId,
  recordCut,
  sanitizeFiberDrums,
  saveFiberDrums
} from '../fiber-drum-tracker.js';
import { TRANSLATIONS } from '../nav-language.js';

const DATE = '2026-10-15';

function stockInFiber(meters) {
  return addMovement([], { itemId: 'fiber-2core', kind: 'in', qty: meters, date: '2026-10-01', customerName: '', note: 'Synthetic drum stock' });
}

function linkedDrum(meters = 2000) {
  return addDrum([], { label: 'Drum-01', inventoryItemId: 'fiber-2core', initialLength: meters, startJacketMark: 2000 });
}

test('registry starts empty and drum ids start at DRUM-101', () => {
  assert.deepEqual(sanitizeFiberDrums(undefined), []);
  assert.deepEqual(sanitizeFiberDrums('junk'), []);
  assert.equal(nextDrumId([]), 'DRUM-101');
  const drums = linkedDrum();
  assert.equal(drums.length, 1);
  assert.equal(drums[0].drumId, 'DRUM-101');
  assert.equal(drums[0].label, 'Drum-01');
  assert.deepEqual(drums[0].cuts, []);
  assert.equal(drumRemainingMeters(drums[0]), 2000);
  assert.equal(nextDrumId(drums), 'DRUM-102');
});

test('SPEC PIN: cut 1500m → 1365m uses exactly 135m, drum remaining and stock both drop by 135, once', () => {
  const drums = linkedDrum(2000);
  const movements = stockInFiber(2000);
  const result = recordCut(drums, movements, {
    drumId: 'DRUM-101', date: DATE, startMark: 1500, endMark: 1365, note: 'Synthetic feeder run'
  });
  assert.equal(result.cut.metersUsed, 135);
  assert.equal(result.inventoryDeducted, true);
  assert.ok(result.cut.inventoryMovementId.startsWith('STK-'));
  const drum = result.drums[0];
  assert.equal(drumUsedMeters(drum), 135);
  assert.equal(drumRemainingMeters(drum), 1865);
  // Stock deducted exactly 135 through the shipped movement log: one out
  // movement of 135 for the fiber item, available 2000 − 135.
  const outs = result.movements.filter((m) => m.kind === 'out');
  assert.equal(outs.length, 1);
  assert.equal(outs[0].qty, 135);
  assert.equal(outs[0].itemId, 'fiber-2core');
  assert.equal(outs[0].id, result.cut.inventoryMovementId);
  assert.equal(availableFor(result.movements, 'fiber-2core'), 1865);
  // Inputs untouched (pure) — a caller that never persists deducts nothing.
  assert.equal(drums[0].cuts.length, 0);
  assert.equal(movements.filter((m) => m.kind === 'out').length, 0);
  // Persist + reload: figures survive a storage round-trip with no
  // second deduction (remaining is derived from history, not re-applied).
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  assert.equal(saveFiberDrums(result.drums, storage), true);
  assert.ok(store.has(FIBER_DRUMS_KEY));
  const loaded = loadFiberDrums(storage);
  assert.equal(drumRemainingMeters(loaded[0]), 1865);
  assert.equal(loaded[0].cuts.length, 1);
  assert.equal(loaded[0].cuts[0].metersUsed, 135);
});

test('metersUsed is the absolute jacket-mark difference in both directions', () => {
  const drums = linkedDrum(2000);
  const movements = stockInFiber(2000);
  const forward = recordCut(drums, movements, { drumId: 'DRUM-101', date: DATE, startMark: 1365, endMark: 1500 });
  assert.equal(forward.cut.metersUsed, 135);
  assert.equal(drumRemainingMeters(forward.drums[0]), 1865);
});

test('multiple cuts accumulate; summary derives totals from history', () => {
  let drums = linkedDrum(2000);
  let movements = stockInFiber(2000);
  let r = recordCut(drums, movements, { drumId: 'DRUM-101', date: DATE, startMark: 2000, endMark: 1800 });
  drums = r.drums; movements = r.movements;
  r = recordCut(drums, movements, { drumId: 'DRUM-101', date: DATE, startMark: 1800, endMark: 1650 });
  drums = r.drums; movements = r.movements;
  assert.equal(drumUsedMeters(drums[0]), 350);
  assert.equal(drumRemainingMeters(drums[0]), 1650);
  const summary = fiberDrumSummary(drums);
  assert.deepEqual(summary, { drumCount: 1, totalInitial: 2000, totalUsed: 350, totalRemaining: 1650 });
  assert.equal(drums[0].cuts[0].cutId, 'DRUM-101-C1');
  assert.equal(drums[0].cuts[1].cutId, 'DRUM-101-C2');
  assert.equal(availableFor(movements, 'fiber-2core'), 1650);
});

test('refusals are atomic: zero cut, over-remaining cut, bad marks, unknown drum change nothing', () => {
  const drums = linkedDrum(200);
  const movements = stockInFiber(200);
  assert.throws(() => recordCut(drums, movements, { drumId: 'DRUM-101', date: DATE, startMark: 500, endMark: 500 }), /nothing was cut/);
  assert.throws(() => recordCut(drums, movements, { drumId: 'DRUM-101', date: DATE, startMark: 2000, endMark: 1700 }), /exceeds the 200 m remaining/);
  assert.throws(() => recordCut(drums, movements, { drumId: 'DRUM-101', date: DATE, startMark: -5, endMark: 100 }), /zero or more/);
  assert.throws(() => recordCut(drums, movements, { drumId: 'DRUM-101', date: '15-10-2026', startMark: 100, endMark: 50 }), /valid date/);
  assert.throws(() => recordCut(drums, movements, { drumId: 'DRUM-999', date: DATE, startMark: 100, endMark: 50 }), /not found/);
  assert.equal(drums[0].cuts.length, 0);
  assert.equal(movements.length, 1);
});

test('insufficient linked stock refuses the whole cut — no drum entry, no movement', () => {
  const drums = linkedDrum(2000);
  const movements = stockInFiber(100); // only 100m in the book, drum holds 2000m
  assert.throws(
    () => recordCut(drums, movements, { drumId: 'DRUM-101', date: DATE, startMark: 1500, endMark: 1365 }),
    /Stock out exceeds available stock/
  );
  assert.equal(drums[0].cuts.length, 0);
  assert.equal(movements.filter((m) => m.kind === 'out').length, 0);
  assert.equal(availableFor(movements, 'fiber-2core'), 100);
});

test('unlinked drum records the cut and reports the inventory step as skipped', () => {
  const drums = addDrum([], { label: 'Loose Roll', initialLength: 500, startJacketMark: 500 });
  const movements = stockInFiber(2000);
  const result = recordCut(drums, movements, { drumId: 'DRUM-101', date: DATE, startMark: 500, endMark: 430 });
  assert.equal(result.cut.metersUsed, 70);
  assert.equal(result.inventoryDeducted, false);
  assert.equal(result.cut.inventoryMovementId, '');
  assert.equal(drumRemainingMeters(result.drums[0]), 430);
  assert.equal(result.movements, movements);
  assert.equal(availableFor(result.movements, 'fiber-2core'), 2000);
});

test('drum validation: label, positive length, and meter-item-only links', () => {
  assert.throws(() => addDrum([], { label: ' ', initialLength: 100 }), /label is required/);
  assert.throws(() => addDrum([], { label: 'X', initialLength: 0 }), /positive number of meters/);
  assert.throws(() => addDrum([], { label: 'X', initialLength: 100, inventoryItemId: 'router' }), /meter-unit cable item/);
  assert.equal(isMeterInventoryItem('fiber-2core'), true);
  assert.equal(isMeterInventoryItem('cat6'), true);
  assert.equal(isMeterInventoryItem('router'), false);
  assert.equal(isMeterInventoryItem('nope'), false);
  // CAT6 is also a meter item and may be linked.
  const drums = addDrum([], { label: 'CAT6 Drum', inventoryItemId: 'cat6', initialLength: 305 });
  assert.equal(drums[0].inventoryItemId, 'cat6');
});

test('sanitizer recomputes metersUsed from marks and drops impossible history', () => {
  const dirty = [{
    drumId: 'DRUM-101', label: 'Drum-01', inventoryItemId: 'fiber-2core', initialLength: 300, startJacketMark: 300,
    cuts: [
      { cutId: 'DRUM-101-C1', date: DATE, startMark: 300, endMark: 200, metersUsed: 9999, note: '', inventoryMovementId: 'STK-9' },
      { cutId: 'DRUM-101-C2', date: DATE, startMark: 200, endMark: 200, metersUsed: 0 },
      { cutId: 'DRUM-101-C3', date: DATE, startMark: 200, endMark: 0, metersUsed: 200 },
      { cutId: 'DRUM-101-C4', date: DATE, startMark: 100, endMark: 0, metersUsed: 100 }
    ]
  }];
  const clean = sanitizeFiberDrums(dirty);
  assert.equal(clean.length, 1);
  // C1 recomputed to 100 (not the stored 9999); C2 zero-length dropped;
  // C3 kept (cumulative 300 = full drum); C4 would exceed the drum — dropped.
  assert.deepEqual(clean[0].cuts.map((c) => c.metersUsed), [100, 200]);
  assert.equal(drumRemainingMeters(clean[0]), 0);
  // Malformed drums dropped entirely.
  assert.deepEqual(sanitizeFiberDrums([{ label: '', initialLength: 100 }, { label: 'Y', initialLength: -1 }, null]), []);
  const row = computeStock(stockInFiber(10)).find((r) => r.id === 'fiber-2core');
  assert.equal(row.available, 10);
});

test('backup safe-merge: drums travel in settings.fiberDrums and restore only onto an empty device', () => {
  const drums = linkedDrum(2000);
  const cutResult = recordCut(drums, stockInFiber(2000), { drumId: 'DRUM-101', date: DATE, startMark: 1500, endMark: 1365 });
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-31T12:00:00+05:00'), { fiberDrums: cutResult.drums });
  const parsed = JSON.parse(backupText);
  assert.equal(parsed.settings.fiberDrums.length, 1);
  assert.equal(parsed.settings.fiberDrums[0].drumId, 'DRUM-101');
  assert.equal(parsed.settings.fiberDrums[0].cuts[0].metersUsed, 135);

  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.equal(preview.fiberDrums.length, 1);
  assert.equal(drumRemainingMeters(preview.fiberDrums[0]), 1865);
  assert.equal(preview.counts.fiberDrumsRestored, 1);

  const other = addDrum([], { label: 'Other Drum', initialLength: 100 });
  const clash = previewJsonBackupMerge(createInitialState(), backupText, { currentFiberDrums: other, currentFiberDrumsStored: true });
  assert.equal(clash.fiberDrums, null);
  assert.ok(clash.conflicts.some((c) => c.field === 'Fiber drum records differ from this device'));

  const identical = previewJsonBackupMerge(createInitialState(), backupText, { currentFiberDrums: cutResult.drums, currentFiberDrumsStored: true });
  assert.equal(identical.fiberDrums, null);
  assert.equal(identical.conflicts.filter((c) => c.field.startsWith('Fiber drum')).length, 0);
});

test('i18n audit: every drum key used by the module, app.js and index.html exists in en and ur', () => {
  const moduleSource = readFileSync(new URL('../fiber-drum-tracker.js', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const keys = new Set();
  for (const source of [moduleSource, appSource]) {
    for (const match of source.matchAll(/t\('((?:drum|dash_drum)_[a-z_]+)'/g)) keys.add(match[1]);
  }
  for (const match of indexSource.matchAll(/data-i18n="((?:drum|dash_drum)_[a-z_]+)"/g)) keys.add(match[1]);
  assert.ok(keys.size >= 25, `expected at least 25 drum keys, found ${keys.size}`);
  for (const key of keys) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key] !== key, `missing en key ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key] !== key, `missing ur key ${key}`);
  }
});

test('wiring: app.js imports the module and index.html carries the card, button and dialog ids', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(appSource.includes("from './fiber-drum-tracker.js'"));
  assert.ok(appSource.includes('setupFiberDrumModal'));
  assert.ok(appSource.includes('fiberDrums: loadFiberDrums()'));
  for (const id of ['fiberDrumModal', 'fiberDrumCloseBtn', 'fiberDrumList', 'fiberDrumAddForm', 'fiberDrumCutForm', 'fiberDrumPick', 'openFiberDrumModalBtn', 'dashboardFiberDrumValue', 'fiberDrumSummary']) {
    assert.ok(indexSource.includes(`id="${id}"`), `index.html missing #${id}`);
  }
  // Token-only CSS: the fiber-drum block in components.css uses no hex colors.
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('SISP-119: Fiber Drum Tracker'), css.indexOf('SISP-7: feeder outage impact'));
  assert.ok(block.length > 0);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'fiber-drum CSS must not contain hex colors');
});
