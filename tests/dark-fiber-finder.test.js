// SISP-147: Spare Dark-Fiber Core Finder & 1-Click Faulty Core Swap.
// Pins: the registry starts empty and is never seeded; cores are listed
// per feeder cable (6/12/24) by status with TIA-598 colours; spare-core
// filtering; the 1-click swap is atomic (source stays damaged, box moves
// to the first spare of the SAME cable, exactly one audit entry) and a
// refused swap leaves the stored cables byte-identical; the one-core
// rule (a box hangs on one core registry-wide); a vanished box resolves
// as "missing", never a crash; and the backup safe-merge (entries travel
// in settings.feederCables, restore only onto an empty device, differing
// local register = conflict). Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  FEEDER_CABLES_KEY,
  FIBER_CORE_COLORS,
  addFeederCable,
  assignBoxToCore,
  buildCableCoreView,
  createFeederCable,
  fiberCoreColor,
  findSpareCore,
  loadFeederCables,
  nextFeederCableId,
  renderCableCard,
  sanitizeFeederCables,
  saveFeederCables,
  setCoreStatus,
  spareCoresOf,
  swapBoxToSpareCore
} from '../dark-fiber-finder.js';
import { buildSplitterBoxes } from '../splitter-map.js';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); }
  };
}

/** A 12-core cable: cores 1–5 lit with boxes, 6–7 damaged (6 has a box), 8–12 spare. */
function fixtureCable() {
  const cores = [];
  for (let n = 1; n <= 12; n++) {
    if (n <= 5) cores.push({ n, status: 'lit', boxId: `SPL-Test-0${n}` });
    else if (n === 6) cores.push({ n, status: 'damaged', boxId: 'SPL-Test-06' });
    else if (n === 7) cores.push({ n, status: 'damaged', boxId: '' });
    else cores.push({ n, status: 'spare', boxId: '' });
  }
  return { cableId: 'FC-101', label: 'Main Feeder — Test', coreCount: 12, cores, history: [] };
}

function fixtureCustomers() {
  return [1, 2, 3, 4, 5, 6].map((n) => ({
    name: `Test Customer ${n}`,
    splitterBoxId: `SPL-Test-0${n}`,
    splitterPort: 1,
    lastRxDbm: -19.5
  }));
}

test('registry starts empty: nothing stored, nothing seeded', () => {
  const storage = fakeStorage();
  assert.deepEqual(loadFeederCables(storage), []);
  assert.deepEqual(sanitizeFeederCables(undefined), []);
  assert.deepEqual(sanitizeFeederCables('junk'), []);
  assert.equal(FEEDER_CABLES_KEY, 'sisp_feeder_cables_v1');
});

test('cable creation: 6/12/24-core cables generate exactly that many spare cores, ids FC-101+', () => {
  let cables = [];
  cables = addFeederCable(cables, { label: 'Feeder A', coreCount: 6 });
  cables = addFeederCable(cables, { label: 'Feeder B', coreCount: 12 });
  cables = addFeederCable(cables, { label: 'Feeder C', coreCount: 24 });
  assert.deepEqual(cables.map((c) => c.cableId), ['FC-101', 'FC-102', 'FC-103']);
  assert.deepEqual(cables.map((c) => c.cores.length), [6, 12, 24]);
  for (const cable of cables) {
    assert.ok(cable.cores.every((core, i) => core.n === i + 1 && core.status === 'spare' && core.boxId === ''));
    assert.deepEqual(cable.history, []);
  }
  assert.equal(nextFeederCableId(cables), 'FC-104');
  assert.equal(createFeederCable(cables, { label: 'Bad', coreCount: 8 }), null, 'only 6/12/24 accepted');
  assert.equal(addFeederCable(cables, { label: 'Bad', coreCount: 48 }), null);
});

test('TIA-598 colours: cores follow the standard order, 13–24 repeat on cycle 2', () => {
  assert.equal(FIBER_CORE_COLORS.length, 12);
  assert.deepEqual(fiberCoreColor(1), { name: 'Blue', cycle: 1 });
  assert.deepEqual(fiberCoreColor(2), { name: 'Orange', cycle: 1 });
  assert.deepEqual(fiberCoreColor(12), { name: 'Aqua', cycle: 1 });
  assert.deepEqual(fiberCoreColor(13), { name: 'Blue', cycle: 2 });
  assert.deepEqual(fiberCoreColor(24), { name: 'Aqua', cycle: 2 });
});

test('spare filtering: a 12-core cable with 5 lit + 2 damaged lists exactly its 5 spares', () => {
  const cable = fixtureCable();
  assert.deepEqual(spareCoresOf(cable).map((core) => core.n), [8, 9, 10, 11, 12]);
  assert.equal(findSpareCore(cable).n, 8);
  const boxes = buildSplitterBoxes(fixtureCustomers());
  const view = buildCableCoreView(cable, boxes);
  assert.equal(view.litCount, 5);
  assert.equal(view.damagedCount, 2);
  assert.equal(view.spareCount, 5);
  assert.deepEqual(view.spares, [8, 9, 10, 11, 12]);
  const sparesHtml = renderCableCard(view, { sparesOnly: true });
  assert.equal((sparesHtml.match(/dfib-core-number/g) || []).length, 5, 'spares-only view shows exactly 5 cores');
  assert.ok(!sparesHtml.includes('SPL-Test-01'), 'spares-only view hides lit boxes');
  const fullHtml = renderCableCard(view, { sparesOnly: false });
  assert.equal((fullHtml.match(/dfib-core-number/g) || []).length, 12, 'full view lists all 12 cores');
  assert.ok(fullHtml.includes('SPL-Test-06'), 'damaged core names its box');
  assert.ok(fullHtml.includes('data-dfib-swap="FC-101"'), 'damaged core with a box offers the 1-click swap');
});

test('atomic swap: box moves damaged -> first spare, source stays damaged, exactly one audit entry', () => {
  const cables = [fixtureCable()];
  const before = JSON.stringify(cables);
  const now = new Date('2026-10-30T10:15:00.000Z');
  const result = swapBoxToSpareCore(cables, 'FC-101', 'SPL-Test-06', now);
  assert.equal(result.ok, true);
  assert.deepEqual(result.entry, { at: '2026-10-30T10:15:00.000Z', boxId: 'SPL-Test-06', fromCore: 6, toCore: 8 });
  const cable = result.cables[0];
  const source = cable.cores.find((core) => core.n === 6);
  assert.equal(source.status, 'damaged', 'source core stays damaged');
  assert.equal(source.boxId, '', 'source core loses the box');
  const target = cable.cores.find((core) => core.n === 8);
  assert.equal(target.status, 'lit', 'spare core goes lit');
  assert.equal(target.boxId, 'SPL-Test-06');
  assert.equal(cable.history.length, 1, 'exactly one audit entry');
  assert.deepEqual(cable.history[0], result.entry);
  assert.equal(JSON.stringify(cables), before, 'the input array is never mutated');
});

test('swap picks the FIRST spare core of the same cable only', () => {
  const cableA = fixtureCable();
  const cableB = createFeederCable([cableA], { label: 'Other Cable', coreCount: 6 });
  const result = swapBoxToSpareCore([cableA, cableB], 'FC-101', 'SPL-Test-06', new Date('2026-10-30T10:15:00.000Z'));
  assert.equal(result.ok, true);
  assert.equal(result.entry.toCore, 8, 'first spare on FC-101, never a core of the other cable');
  assert.ok(result.cables[1].cores.every((core) => core.status === 'spare'), 'the other cable is untouched');
});

test('no-spare refusal: state stays byte-identical (same reference, same JSON)', () => {
  const cable = fixtureCable();
  cable.cores = cable.cores.map((core) => core.status === 'spare' ? { ...core, status: 'lit', boxId: `SPL-Full-${core.n}` } : core);
  const cables = [cable];
  const before = JSON.stringify(cables);
  const result = swapBoxToSpareCore(cables, 'FC-101', 'SPL-Test-06', new Date());
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no-spare');
  assert.strictEqual(result.cables, cables, 'refusal returns the original array reference');
  assert.equal(JSON.stringify(cables), before);
});

test('swap refusals: box not on a damaged core, unknown box, unknown cable — all byte-identical', () => {
  const cables = [fixtureCable()];
  const before = JSON.stringify(cables);
  const lit = swapBoxToSpareCore(cables, 'FC-101', 'SPL-Test-01', new Date());
  assert.equal(lit.ok, false);
  assert.equal(lit.reason, 'not-damaged');
  const missing = swapBoxToSpareCore(cables, 'FC-101', 'SPL-Nope-99', new Date());
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'box-not-found');
  const noCable = swapBoxToSpareCore(cables, 'FC-999', 'SPL-Test-06', new Date());
  assert.equal(noCable.ok, false);
  assert.equal(noCable.reason, 'cable-not-found');
  assert.equal(JSON.stringify(cables), before, 'no refusal mutated anything');
});

test('one-core rule: assigning a box elsewhere moves it; the sanitizer strips a duplicated box', () => {
  let cables = addFeederCable([], { label: 'Feeder A', coreCount: 6 });
  cables = addFeederCable(cables, { label: 'Feeder B', coreCount: 6 });
  let result = assignBoxToCore(cables, 'FC-101', 2, 'SPL-Move-01');
  assert.equal(result.ok, true);
  cables = result.cables;
  assert.equal(cables[0].cores[1].boxId, 'SPL-Move-01');
  assert.equal(cables[0].cores[1].status, 'lit');
  result = assignBoxToCore(cables, 'FC-102', 4, 'SPL-Move-01');
  assert.equal(result.ok, true);
  cables = result.cables;
  assert.equal(cables[0].cores[1].boxId, '', 'box left the old core');
  assert.equal(cables[0].cores[1].status, 'spare', 'a lit core that loses its box drops to spare');
  assert.equal(cables[1].cores[3].boxId, 'SPL-Move-01');
  const dirty = sanitizeFeederCables([
    { cableId: 'FC-101', label: 'A', coreCount: 6, cores: [{ n: 1, status: 'lit', boxId: 'SPL-Dup-1' }], history: [] },
    { cableId: 'FC-102', label: 'B', coreCount: 6, cores: [{ n: 1, status: 'lit', boxId: 'SPL-Dup-1' }], history: [] }
  ]);
  assert.equal(dirty[0].cores[0].boxId, 'SPL-Dup-1', 'first occurrence wins');
  assert.equal(dirty[1].cores[0].boxId, '', 'the duplicate is stripped');
});

test('status changes: marking a core spare clears its box; marking damaged keeps it', () => {
  const cables = [fixtureCable()];
  let result = setCoreStatus(cables, 'FC-101', 6, 'spare');
  assert.equal(result.ok, true);
  assert.equal(result.cables[0].cores[5].boxId, '');
  assert.equal(result.cables[0].cores[5].status, 'spare');
  result = setCoreStatus(cables, 'FC-101', 1, 'damaged');
  assert.equal(result.cables[0].cores[0].status, 'damaged');
  assert.equal(result.cables[0].cores[0].boxId, 'SPL-Test-01', 'a damaged core keeps its box so it can be swapped');
  assert.equal(setCoreStatus(cables, 'FC-101', 1, 'bogus').ok, false);
  assert.equal(setCoreStatus(cables, 'FC-999', 1, 'lit').ok, false);
});

test('vanished box: a core whose box left the customer map resolves as missing, never a crash', () => {
  const cable = fixtureCable();
  cable.cores[5] = { n: 6, status: 'damaged', boxId: 'SPL-Gone-99' };
  const view = buildCableCoreView(cable, buildSplitterBoxes(fixtureCustomers()));
  const core6 = view.cores.find((core) => core.n === 6);
  assert.equal(core6.boxExists, false);
  assert.equal(core6.canSwap, true, 'a missing box on a damaged core can still be swapped off it');
  const html = renderCableCard(view, {});
  assert.ok(html.includes('SPL-Gone-99'));
  assert.ok(html.includes('not on the map anymore'), 'missing label renders from the en dictionary');
});

test('storage round-trip: save then load returns the sanitized register', () => {
  const storage = fakeStorage();
  const cables = [fixtureCable()];
  assert.equal(saveFeederCables(cables, storage), true);
  assert.deepEqual(loadFeederCables(storage), sanitizeFeederCables(cables));
  storage.setItem(FEEDER_CABLES_KEY, '{not json');
  assert.deepEqual(loadFeederCables(storage), [], 'corrupt storage reads as an empty register, never a crash');
});

test('backup safe-merge: cables travel in settings.feederCables and restore only onto an empty device', () => {
  const cables = [fixtureCable()];
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-30T12:00:00+05:00'), { feederCables: cables });
  const parsed = JSON.parse(backupText);
  assert.deepEqual(parsed.settings.feederCables, sanitizeFeederCables(cables), 'backup carries the sanitized register');
  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.deepEqual(preview.feederCables, sanitizeFeederCables(cables), 'empty device adopts the backup register');
  const other = [{ ...fixtureCable(), cableId: 'FC-777', label: 'Different Register' }];
  const clash = previewJsonBackupMerge(createInitialState(), backupText, { currentFeederCables: other, currentFeederCablesStored: true });
  assert.equal(clash.feederCables, null, 'a differing local register is never overwritten');
  assert.ok(clash.conflicts.some((c) => c.field === 'Feeder cable records differ from this device'), 'the clash is reported as a conflict');
  const identical = previewJsonBackupMerge(createInitialState(), backupText, { currentFeederCables: cables, currentFeederCablesStored: true });
  assert.equal(identical.feederCables, null, 'identical on both sides: nothing to restore');
  assert.ok(!identical.conflicts.some((c) => c.field === 'Feeder cable records differ from this device'), 'identical is not a conflict');
});

test('i18n: every dfib_ key the module and dialog use exists in en AND ur with matching placeholders', () => {
  const moduleSource = readFileSync(new URL('../dark-fiber-finder.js', import.meta.url), 'utf8');
  const keys = new Set([...moduleSource.matchAll(/t\('([a-z0-9_]+)'/g)].map((m) => m[1]));
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dialogBlock = html.slice(html.indexOf('id="darkFiberModal"'), html.indexOf('</dialog>', html.indexOf('id="darkFiberModal"')));
  for (const m of dialogBlock.matchAll(/data-i18n(?:-placeholder)?="([a-z0-9_]+)"/g)) keys.add(m[1]);
  keys.add('dash_btn_dark_fiber');
  assert.ok(keys.size >= 25, `expected the full dfib_ key set, got ${keys.size}`);
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    const enParams = [...TRANSLATIONS.en[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const urParams = [...TRANSLATIONS.ur[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(urParams, enParams, `placeholder mismatch for ${key}`);
  }
});

test('wiring: app.js imports the module, the dialog + open button exist, CSS block is hex-free', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dark-fiber-finder.js'"), 'app.js imports dark-fiber-finder.js');
  assert.ok(app.includes('setupDarkFiberModal'), 'app.js sets up the modal controller');
  assert.ok(app.includes('feederCables: loadFeederCables()'), 'backup extras carry the register');
  assert.ok(app.includes('currentFeederCables: loadFeederCables()'), 'restore options carry the register');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="darkFiberModal"'), 'dialog exists');
  assert.ok(html.includes('id="openDarkFiberModalBtn"'), 'dashboard open button exists');
  assert.ok(html.includes('id="darkFiberCloseBtn" class="modal-close"'), 'shared close button design');
  const build = readFileSync(new URL('../build.mjs', import.meta.url), 'utf8');
  assert.ok(!build.includes("'dark-fiber-finder.js'"), 'module is NOT a build entry — it folds into the app.js chunk (dist stays 25)');
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('/* SISP-147:'), css.indexOf('/* SISP-5:'));
  assert.ok(block.includes('.dfib-core-grid'), 'dfib styles present');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'dfib CSS uses theme tokens only, no hex');
});
