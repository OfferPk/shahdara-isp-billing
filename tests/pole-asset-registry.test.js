// SISP-122: Street Pole Asset & Drop Attachment Registry.
// Pure-function tests on synthetic data only. Spec pin (verbatim):
// registering Pole-Barrian-14 (ISP Iron Pole) with 4 customer drops and
// 1 splitter box (DB-02) displays all 5 attached assets on the pole card.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  POLES_REGISTRY_KEY,
  addPole,
  attachDrop,
  attachSplitterBox,
  buildPoleCards,
  detachDrop,
  detachSplitterBox,
  groupPoleCardsByZone,
  loadPolesRegistry,
  nextPoleId,
  poleInventoryItem,
  poleRegistrySummary,
  removePole,
  resolvePoleAttachments,
  sanitizePolesRegistry,
  savePolesRegistry
} from '../pole-asset-tracker.js';
import { addMovement, availableFor } from '../inventory-book.js';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';

// The four drop customers also feed splitter box DB-02 (ports 1-4), the
// way real drops do — the box exists because customers reference it.
const dropCustomer = (n) => ({
  id: `cust-${n}`,
  name: `Synthetic Drop ${n}`,
  customerNumber: 200 + n,
  archived: false,
  splitterBoxId: 'DB-02',
  splitterPort: n,
  poleNumber: 'Pole #14 near Synthetic Masjid'
});
const CUSTOMERS = [dropCustomer(1), dropCustomer(2), dropCustomer(3), dropCustomer(4)];

function registryWithPinPole() {
  let poles = addPole([], { label: 'Pole-Barrian-14', zone: 'BARRIAN', type: 'isp_iron', inventoryItemId: 'pole' }, '2026-10-29');
  const poleId = poles[0].poleId;
  for (const customer of CUSTOMERS) poles = attachDrop(poles, poleId, customer.id);
  poles = attachSplitterBox(poles, poleId, 'DB-02');
  return { poles, poleId };
}

test('registry starts empty and never seeds a pole', () => {
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  assert.deepEqual(loadPolesRegistry(storage), []);
  assert.deepEqual(sanitizePolesRegistry(undefined), []);
  assert.deepEqual(sanitizePolesRegistry('junk'), []);
  assert.equal(nextPoleId([]), 'POLE-101');
});

test('SPEC PIN: Pole-Barrian-14 with 4 drops + DB-02 shows all 5 attached assets', () => {
  const { poles, poleId } = registryWithPinPole();
  assert.equal(poleId, 'POLE-101');
  const cards = buildPoleCards(poles, CUSTOMERS);
  assert.equal(cards.length, 1);
  const card = cards[0];
  assert.equal(card.label, 'Pole-Barrian-14');
  assert.equal(card.type, 'isp_iron');
  assert.equal(card.zone, 'BARRIAN');
  assert.equal(card.attachedCount, 5);
  assert.equal(card.drops.length, 4);
  assert.ok(card.drops.every((d) => d.status === 'active'));
  assert.equal(card.drops[0].name, 'Synthetic Drop 1');
  assert.equal(card.drops[0].poleText, 'Pole #14 near Synthetic Masjid');
  assert.equal(card.boxes.length, 1);
  assert.equal(card.boxes[0].boxId, 'DB-02');
  assert.equal(card.boxes[0].status, 'present');
  assert.equal(card.boxes[0].occupiedCount, 4);
  const summary = poleRegistrySummary(poles, CUSTOMERS);
  assert.deepEqual(summary, { poleCount: 1, dropCount: 4, boxCount: 1, byType: { wapda: 0, isp_iron: 1, wall_bracket: 0 } });
});

test('zone variants merge onto the canonical mohalla', () => {
  let poles = addPole([], { label: 'P1', zone: 'Bani' });
  poles = addPole(poles, { label: 'P2', zone: 'MOHALLA BANI' });
  assert.equal(poles[0].zone, poles[1].zone);
  const groups = groupPoleCardsByZone(buildPoleCards(poles, []));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].cards.length, 2);
});

test('one-pole rule: attaching a drop or box elsewhere MOVES it', () => {
  let poles = addPole([], { label: 'Pole A', zone: 'BARRIAN' });
  poles = addPole(poles, { label: 'Pole B', zone: 'BARRIAN' });
  const [a, b] = poles.map((p) => p.poleId);
  poles = attachDrop(poles, a, 'cust-1');
  poles = attachSplitterBox(poles, a, 'DB-02');
  poles = attachDrop(poles, b, 'cust-1');
  poles = attachSplitterBox(poles, b, 'DB-02');
  const byId = Object.fromEntries(poles.map((p) => [p.poleId, p]));
  assert.deepEqual(byId[a].dropCustomerIds, []);
  assert.deepEqual(byId[a].splitterBoxIds, []);
  assert.deepEqual(byId[b].dropCustomerIds, ['cust-1']);
  assert.deepEqual(byId[b].splitterBoxIds, ['DB-02']);
  // Detach + delete release references without touching anything else.
  poles = detachDrop(poles, b, 'cust-1');
  poles = detachSplitterBox(poles, b, 'DB-02');
  assert.deepEqual(poles.find((p) => p.poleId === b).dropCustomerIds, []);
  poles = removePole(poles, b);
  assert.equal(poles.length, 1);
});

test('archived drops are labelled and not counted active; unknown ids resolve missing', () => {
  let poles = addPole([], { label: 'Pole X', zone: 'THALII' });
  const poleId = poles[0].poleId;
  poles = attachDrop(poles, poleId, 'cust-archived');
  poles = attachDrop(poles, poleId, 'cust-gone');
  poles = attachSplitterBox(poles, poleId, 'DB-99');
  const customers = [{ id: 'cust-archived', name: 'Old Connection', customerNumber: 55, archived: true }];
  const { drops, boxes } = resolvePoleAttachments(poles[0], customers);
  assert.equal(drops[0].status, 'archived');
  assert.equal(drops[1].status, 'missing');
  assert.equal(boxes[0].status, 'missing');
  const card = buildPoleCards(poles, customers)[0];
  assert.equal(card.activeDropCount, 0);
  assert.equal(card.attachedCount, 3);
});

test('ISP iron pole stock link is a reference only — inventory figures never move', () => {
  let movements = addMovement([], { itemId: 'pole', kind: 'in', qty: 6, date: '2026-10-01', note: 'Synthetic stock' });
  const before = availableFor(movements, 'pole');
  const { poles } = registryWithPinPole();
  assert.equal(poleInventoryItem(poles[0]).id, 'pole');
  assert.equal(poleInventoryItem(poles[0]).name, 'Pole');
  // Registering / attaching / removing poles writes no movement.
  assert.equal(availableFor(movements, 'pole'), before);
  assert.equal(movements.length, 1);
  // Unknown catalogue ids are refused by the sanitizer, never guessed.
  const cleaned = sanitizePolesRegistry([{ poleId: 'POLE-101', label: 'L', inventoryItemId: 'not-a-real-item' }]);
  assert.equal(cleaned[0].inventoryItemId, '');
});

test('registry operations never mutate customer or inventory data (byte-for-byte)', () => {
  const customersJson = JSON.stringify(CUSTOMERS);
  let movements = addMovement([], { itemId: 'pole', kind: 'in', qty: 3, date: '2026-10-01' });
  const movementsJson = JSON.stringify(movements);
  const { poles } = registryWithPinPole();
  buildPoleCards(poles, CUSTOMERS);
  poleRegistrySummary(poles, CUSTOMERS);
  assert.equal(JSON.stringify(CUSTOMERS), customersJson);
  assert.equal(JSON.stringify(movements), movementsJson);
});

test('sanitizer: bad types fall back, duplicate ids and unusable records drop', () => {
  const cleaned = sanitizePolesRegistry([
    { poleId: 'POLE-101', label: 'Good', type: 'weird' },
    { poleId: 'POLE-101', label: 'Duplicate id' },
    { poleId: 'XX-1', label: 'Bad id' },
    { poleId: 'POLE-102', label: '' },
    null,
    { poleId: 'POLE-103', label: 'Wall', type: 'wall_bracket', dropCustomerIds: ['a', 'a', 'b'], splitterBoxIds: ['DB-01'] }
  ]);
  assert.equal(cleaned.length, 2);
  assert.equal(cleaned[0].type, 'wapda');
  assert.deepEqual(cleaned[1].dropCustomerIds, ['a', 'b']);
  assert.throws(() => addPole([], { label: '   ' }), /label is required/i);
});

test('storage round-trip through the registry key', () => {
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  const { poles } = registryWithPinPole();
  assert.equal(savePolesRegistry(poles, storage), true);
  assert.ok(store.has(POLES_REGISTRY_KEY));
  assert.deepEqual(loadPolesRegistry(storage), sanitizePolesRegistry(poles));
});

test('backup safe-merge: poles travel in settings.polesRegistry and restore only onto an empty device', () => {
  const { poles } = registryWithPinPole();
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-31T12:00:00+05:00'), { polesRegistry: poles });
  const parsed = JSON.parse(backupText);
  assert.equal(parsed.settings.polesRegistry.length, 1);
  assert.equal(parsed.settings.polesRegistry[0].label, 'Pole-Barrian-14');
  assert.deepEqual(parsed.settings.polesRegistry[0].splitterBoxIds, ['DB-02']);

  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.equal(preview.polesRegistry.length, 1);
  assert.equal(preview.polesRegistry[0].dropCustomerIds.length, 4);

  const other = addPole([], { label: 'Other Pole', zone: 'SODAA' });
  const clash = previewJsonBackupMerge(createInitialState(), backupText, { currentPolesRegistry: other, currentPolesRegistryStored: true });
  assert.equal(clash.polesRegistry, null);
  assert.ok(clash.conflicts.some((c) => c.field === 'Pole registry records differ from this device'));

  const identical = previewJsonBackupMerge(createInitialState(), backupText, { currentPolesRegistry: poles, currentPolesRegistryStored: true });
  assert.equal(identical.polesRegistry, null);
  assert.equal(identical.conflicts.filter((c) => c.field.startsWith('Pole registry')).length, 0);
});

test('i18n audit: every polereg key used by the module and dialog exists in en AND ur', () => {
  const moduleSource = readFileSync(new URL('../pole-asset-tracker.js', import.meta.url), 'utf8');
  const used = new Set([...moduleSource.matchAll(/t\('([a-z0-9_]+)'/g)].map((m) => m[1]));
  // Template-built type keys:
  for (const type of ['wapda', 'isp_iron', 'wall_bracket']) used.add(`polereg_type_${type}`);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dialogStart = html.indexOf('id="poleRegistryModal"');
  const dialog = html.slice(dialogStart, html.indexOf('</dialog>', dialogStart));
  for (const m of dialog.matchAll(/data-i18n="([a-z0-9_]+)"/g)) used.add(m[1]);
  used.add('dash_card_polereg');
  used.add('dash_polereg_empty');
  used.add('dash_polereg_period');
  assert.ok(used.size >= 25, `expected a real key set, got ${used.size}`);
  for (const key of used) {
    assert.ok(TRANSLATIONS.en[key], `missing en key ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur key ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key);
  }
});

test('wiring: app.js imports the module, dialog + card ids exist, CSS block has no hex', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './pole-asset-tracker.js'"));
  assert.ok(app.includes('setupPoleRegistryModal'));
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['poleRegistryModal', 'openPoleRegistryModalBtn', 'dashboardPoleRegistryValue', 'poleRegistryList', 'poleRegistryForm']) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('SISP-122'));
  assert.ok(block.length > 200);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'pole-registry CSS must be token-only');
});
