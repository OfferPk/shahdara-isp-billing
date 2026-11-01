// SISP-152: Splitter Box Port Swap & "🔴 Faulty / Dead Port" Lockout.
// Pure-function + wiring tests on synthetic data only.
//
// Spec test criteria (verbatim intent):
//  - "Unit tests for atomic port reassignment" — a swap changes ONLY the
//    customer record's splitterPort, through core's updateCustomerProfile;
//    every refusal leaves the record byte-identical.
//  - "dead-port lockout validation" — a locked port refuses swap-in AND
//    profile/install assignment via the shared isPortDead check; unlock
//    restores assignability; the lock list round-trips through backups;
//    a lock on box A never affects box B.
//
// Occupancy note: the validator reads occupancy from buildSplitterPortMap
// itself (the single derivation the map renders). That map counts an
// ARCHIVED customer's recorded assignment as occupying the port, so an
// archived occupant blocks a swap too — pinned below so the rule is
// explicit, never accidental.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEAD_PORTS_KEY,
  executePortSwap,
  findDeadPort,
  isPortDead,
  loadDeadPorts,
  lockDeadPort,
  portSwapErrorKey,
  sanitizeDeadPorts,
  saveDeadPorts,
  swapTargetPorts,
  unlockDeadPort,
  validatePortSwap
} from '../splitter-port-swap.js';
import {
  buildSplitterBoxes,
  buildSplitterPortMap,
  renderSplitterPortGrid
} from '../splitter-map.js';
import {
  addCustomer,
  createInitialState,
  createJsonBackup,
  previewJsonBackupMerge,
  updateCustomerProfile
} from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';
import { collectRuntimeFiles } from '../build.mjs';

const BOX = 'SPL-Test-01';
const BOX_B = 'SPL-Test-02';

const customer = (overrides = {}) => ({
  id: 'c1',
  name: 'Swap Test Customer',
  splitterBoxId: BOX,
  splitterPort: 4,
  oltPonPort: 'PON 1/2/3',
  lastRxDbm: -19.4,
  archived: false,
  ...overrides
});

const lock = (boxId, port, extra = {}) => ({
  boxId, port, lockedAt: '2026-10-30T06:00:00.000Z', note: '', ...extra
});

/** A core state holding one customer on BOX port 4 (plus any extras). */
function stateWithCustomers(builders) {
  let state = createInitialState();
  const when = new Date('2026-10-01T12:00:00+05:00');
  for (const build of builders) state = addCustomer(state, build.name, when, build.options ?? {});
  return state;
}

const baseState = () => stateWithCustomers([
  { name: 'SWAP SUBJECT', options: { splitterBoxId: BOX, splitterPort: 4, lastRxDbm: -19.4 } },
  { name: 'PORT NEIGHBOUR', options: { splitterBoxId: BOX, splitterPort: 5 } }
]);

// ---------------------------------------------------------------- store

test('registry starts empty: loadDeadPorts on a fresh store returns []', () => {
  const store = { getItem: () => null, setItem: () => {} };
  assert.deepEqual(loadDeadPorts(store), []);
  assert.equal(DEAD_PORTS_KEY, 'sisp_dead_ports_v1');
  assert.deepEqual(loadDeadPorts({ getItem: () => '{broken json', setItem: () => {} }), []);
});

test('sanitizeDeadPorts drops malformed rows, dedupes and sorts', () => {
  const cleaned = sanitizeDeadPorts([
    lock(BOX, 7, { note: '  crushed pigtail  ' }),
    lock(BOX, 7, { note: 'duplicate lock' }),
    lock(BOX_B, 2),
    { boxId: '', port: 3 },
    { boxId: BOX, port: 0 },
    { boxId: BOX, port: 17 },
    { boxId: BOX, port: 2.5 },
    { boxId: BOX, port: 'x' },
    null,
    'garbage',
    { boxId: BOX, port: '6', lockedAt: 42, note: 'x'.repeat(250) }
  ]);
  assert.equal(cleaned.length, 3);
  assert.deepEqual(cleaned.map((e) => `${e.boxId}:${e.port}`), [`${BOX}:6`, `${BOX}:7`, `${BOX_B}:2`]);
  assert.equal(cleaned[0].lockedAt, '', 'non-string lockedAt is dropped to empty');
  assert.equal(cleaned[0].note.length, 200, 'note capped at 200 chars');
  assert.equal(cleaned[1].note, 'crushed pigtail', 'first lock wins on duplicates; note trimmed');
  assert.deepEqual(sanitizeDeadPorts('not an array'), []);
  assert.deepEqual(sanitizeDeadPorts(undefined), []);
});

test('saveDeadPorts / loadDeadPorts round-trip through storage', () => {
  let raw = null;
  const store = { getItem: () => raw, setItem: (key, value) => { raw = value; } };
  const entries = [lock(BOX, 7, { note: 'dirty connector' })];
  assert.equal(saveDeadPorts(entries, store), true);
  assert.deepEqual(loadDeadPorts(store), entries);
  assert.equal(saveDeadPorts([], store), true);
  assert.deepEqual(loadDeadPorts(store), []);
});

// ------------------------------------------------------------- lock ops

test('isPortDead / findDeadPort: a lock on box A never affects box B', () => {
  const entries = [lock(BOX, 7)];
  assert.equal(isPortDead(BOX, 7, entries), true);
  assert.equal(isPortDead(BOX_B, 7, entries), false, 'same port number, different box — not dead');
  assert.equal(isPortDead(BOX, 8, entries), false);
  assert.equal(isPortDead('', 7, entries), false);
  assert.equal(isPortDead(BOX, 0, entries), false);
  assert.equal(findDeadPort(BOX, 7, entries)?.port, 7);
  assert.equal(findDeadPort(BOX, 8, entries), null);
});

test('lockDeadPort adds an ISO-stamped lock; re-locking is a no-op; input never mutated', () => {
  const before = [lock(BOX, 3, { lockedAt: '2026-10-01T00:00:00.000Z' })];
  const snapshot = JSON.stringify(before);
  const after = lockDeadPort(before, { boxId: BOX, port: 7, note: 'bent ferrule' }, new Date('2026-10-30T10:00:00.000Z'));
  assert.equal(JSON.stringify(before), snapshot, 'input list untouched');
  assert.equal(after.length, 2);
  const added = after.find((e) => e.port === 7);
  assert.equal(added.lockedAt, '2026-10-30T10:00:00.000Z');
  assert.equal(added.note, 'bent ferrule');
  const relocked = lockDeadPort(after, { boxId: BOX, port: 7, note: 'second attempt' }, new Date('2026-11-01T00:00:00.000Z'));
  assert.deepEqual(relocked, after, 're-lock keeps the original entry and timestamp');
  assert.throws(() => lockDeadPort([], { boxId: '', port: 3 }), /box is required/);
  assert.throws(() => lockDeadPort([], { boxId: BOX, port: 99 }), /between 1 and 16/);
});

test('unlockDeadPort removes exactly the one lock and restores assignability', () => {
  const entries = [lock(BOX, 7), lock(BOX, 8), lock(BOX_B, 7)];
  const after = unlockDeadPort(entries, BOX, 7);
  assert.deepEqual(after.map((e) => `${e.boxId}:${e.port}`), [`${BOX}:8`, `${BOX_B}:7`]);
  assert.equal(isPortDead(BOX, 7, after), false, 'unlocked port is assignable again');
  assert.deepEqual(unlockDeadPort(entries, BOX, 12), sanitizeDeadPorts(entries), 'unlocking a live port changes nothing');
});

// ------------------------------------------------------- swap validation

test('validatePortSwap: happy path returns the swap plan', () => {
  const customers = [customer(), customer({ id: 'c2', name: 'Neighbour', splitterPort: 5 })];
  const result = validatePortSwap(customers, 'c1', 6, []);
  assert.deepEqual(result, {
    ok: true, customerId: 'c1', customerName: 'Swap Test Customer',
    boxId: BOX, oldPort: 4, newPort: 6, portCount: 8
  });
});

test('validatePortSwap: every refusal carries its code', () => {
  const customers = [customer(), customer({ id: 'c2', name: 'Neighbour', splitterPort: 5 })];
  assert.equal(validatePortSwap(customers, 'missing-id', 6, []).code, 'customer-not-found');
  assert.equal(validatePortSwap([customer({ splitterBoxId: '' })], 'c1', 6, []).code, 'no-assignment');
  assert.equal(validatePortSwap([customer({ splitterPort: null })], 'c1', 6, []).code, 'no-assignment');
  for (const bad of [0, 17, 2.5, 'x', '', null]) {
    assert.equal(validatePortSwap(customers, 'c1', bad, []).code, 'invalid-port', `port ${String(bad)} refused as invalid`);
  }
  assert.equal(validatePortSwap(customers, 'c1', 4, []).code, 'same-port');
  const occupied = validatePortSwap(customers, 'c1', 5, []);
  assert.equal(occupied.code, 'occupied');
  assert.equal(occupied.occupantName, 'Neighbour');
});

test('validatePortSwap: capacity follows the box derivation — port 12 refused on a 1:8 box, allowed on a 1:16 box', () => {
  const small = [customer(), customer({ id: 'c2', name: 'Neighbour', splitterPort: 5 })];
  const refused = validatePortSwap(small, 'c1', 12, []);
  assert.equal(refused.code, 'out-of-range');
  assert.equal(refused.portCount, 8);
  const big = [customer(), customer({ id: 'c9', name: 'Far Port', splitterPort: 15 })];
  const allowed = validatePortSwap(big, 'c1', 12, []);
  assert.equal(allowed.ok, true);
  assert.equal(allowed.portCount, 16);
});

test('validatePortSwap: a dead-locked target port is refused as dead-port', () => {
  const customers = [customer()];
  const result = validatePortSwap(customers, 'c1', 6, [lock(BOX, 6)]);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'dead-port');
  // …and the same lock on a different box does not refuse anything here.
  assert.equal(validatePortSwap(customers, 'c1', 6, [lock(BOX_B, 6)]).ok, true);
});

test('validatePortSwap: an archived occupant still blocks — its record claims the port on the map', () => {
  const customers = [customer(), customer({ id: 'c2', name: 'Gone Customer', splitterPort: 6, archived: true, archivedAt: '2026-10-20' })];
  // The port map itself renders port 6 occupied by the archived record…
  const map = buildSplitterPortMap(customers, BOX, 8);
  assert.equal(map.ports[5].status, 'occupied');
  // …so the validator, reading the same derivation, refuses the swap-in.
  assert.equal(validatePortSwap(customers, 'c1', 6, []).code, 'occupied');
});

test('swapTargetPorts offers only free, live, in-range ports other than the current one', () => {
  const customers = [
    customer(),
    customer({ id: 'c2', name: 'Neighbour', splitterPort: 5 }),
    customer({ id: 'c3', name: 'Weak One', splitterPort: 8 })
  ];
  assert.deepEqual(swapTargetPorts(customers, customers[0], [lock(BOX, 6)]), [1, 2, 3, 7]);
  assert.deepEqual(swapTargetPorts(customers, customer({ splitterBoxId: '' }), []), []);
});

// ------------------------------------------------------ atomic execution

test('executePortSwap: happy path changes ONLY splitterPort on the record; input state untouched', () => {
  // Baseline = a no-op profile save first, so the comparison isolates
  // exactly what the swap itself changes (updateCustomerProfile also
  // normalizes legacy-missing fields on ANY save — pre-existing seam
  // behaviour, identical for a manual profile edit).
  const raw = baseState();
  const subjectId = raw.customers[0].id;
  const state = updateCustomerProfile(raw, subjectId, {});
  const beforeJson = JSON.stringify(state);
  const result = executePortSwap(state, subjectId, 6, [], updateCustomerProfile);
  assert.equal(JSON.stringify(state), beforeJson, 'input state not mutated');
  assert.equal(result.oldPort, 4);
  assert.equal(result.newPort, 6);
  const moved = result.state.customers.find((c) => c.id === subjectId);
  // Re-pin (reconciliation onto SISP-133's main): the baseline is the LIVE
  // pre-swap record, not a JSON round-trip — SISP-133's profile plumbing
  // leaves an own-key `preferredVisitWindow: undefined` on the record,
  // which JSON.stringify drops, so a parsed baseline can never deep-equal
  // a live record even when the swap changed nothing but the port.
  const original = state.customers.find((c) => c.id === subjectId);
  assert.equal(moved.splitterPort, 6);
  const strip = (record) => { const copy = { ...record }; delete copy.splitterPort; return copy; };
  assert.deepEqual(strip(moved), strip(original), 'every other field on the record is identical');
  const neighbour = result.state.customers.find((c) => c.id !== subjectId);
  assert.equal(neighbour.splitterPort, 5, 'the neighbour record is untouched');
});

test('executePortSwap: every refusal throws BEFORE the writer runs — record stays byte-identical', () => {
  const state = baseState();
  const subject = state.customers[0];
  const neighbour = state.customers[1];
  const cases = [
    { target: neighbour.splitterPort, dead: [], pattern: /already used by/ },
    { target: 7, dead: [lock(BOX, 7)], pattern: /locked as faulty \/ dead/ },
    { target: 12, dead: [], pattern: /outside this box's 8 ports/ },
    { target: 4, dead: [], pattern: /already this customer's port/ },
    { target: 0, dead: [], pattern: /between 1 and 16/ },
    { target: 2.5, dead: [], pattern: /between 1 and 16/ }
  ];
  for (const { target, dead, pattern } of cases) {
    let writerCalls = 0;
    const spyWriter = (...args) => { writerCalls += 1; return updateCustomerProfile(...args); };
    const snapshot = JSON.stringify(state);
    assert.throws(() => executePortSwap(state, subject.id, target, dead, spyWriter), pattern);
    assert.equal(writerCalls, 0, `writer never invoked for refused target ${target}`);
    assert.equal(JSON.stringify(state), snapshot, `state byte-identical after refusal of ${target}`);
  }
  assert.throws(() => executePortSwap(state, 'no-such-id', 6, [], updateCustomerProfile), /Customer not found/);
});

// ------------------------------------------------------------ port map

test('port map: a locked spare port renders dead — not free — and an occupied port wins over a lock', () => {
  const customers = [customer(), customer({ id: 'c2', name: 'Neighbour', splitterPort: 5 })];
  const locks = [lock(BOX, 7, { note: 'crushed pigtail' }), lock(BOX, 5)];
  const box = buildSplitterPortMap(customers, BOX, 8, locks);
  assert.equal(box.ports[6].status, 'dead');
  assert.equal(box.ports[6].deadNote, 'crushed pigtail');
  assert.equal(box.ports[4].status, 'occupied', 'the neighbour keeps port 5 even though a lock names it');
  assert.equal(box.deadCount, 1);
  assert.equal(box.freeCount, 5, 'dead ports are not counted as free');
  assert.deepEqual(box.freePorts, [1, 2, 3, 6, 8]);
  const legacy = buildSplitterPortMap(customers, BOX, 8);
  assert.equal(legacy.deadCount, 0);
  assert.equal(legacy.freeCount, 6, 'without the lockout list the map is unchanged');
  const boxes = buildSplitterBoxes(customers, locks);
  assert.equal(boxes[0].ports[6].status, 'dead', 'buildSplitterBoxes passes the lockout list through');
});

test('port grid: dead cell shows the 🔴 lockout label; action buttons appear only when actions are enabled', () => {
  const customers = [customer(), customer({ id: 'c2', name: 'Neighbour', splitterPort: 5 })];
  const box = buildSplitterPortMap(customers, BOX, 8, [lock(BOX, 7)]);
  const plain = renderSplitterPortGrid(box);
  assert.match(plain, /splitter-port-dead/);
  assert.match(plain, /Faulty \/ Dead Port/);
  assert.ok(!plain.includes('data-pswap-'), 'no action buttons without host actions');
  const withActions = renderSplitterPortGrid(box, { actions: true });
  assert.ok(withActions.includes(`data-pswap-swap="${customers[0].id}"`), 'occupied cell offers Swap for its customer');
  assert.ok(withActions.includes('data-pswap-lock="6"'), 'spare cell offers Lock');
  assert.ok(withActions.includes('data-pswap-unlock="7"'), 'dead cell offers Unlock');
});

// ---------------------------------------------------------------- backup

test('backup safe-merge: dead ports travel in settings.deadPorts and restore only onto an empty device', () => {
  const entries = [lock(BOX, 7, { note: 'dirty connector' }), lock(BOX_B, 2)];
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-30T12:00:00+05:00'), { deadPorts: entries });
  const parsed = JSON.parse(backupText);
  assert.deepEqual(parsed.settings.deadPorts, sanitizeDeadPorts(entries));

  const emptyBackup = JSON.parse(createJsonBackup(createInitialState(), new Date('2026-10-30T12:00:00+05:00'), { deadPorts: [] }));
  assert.equal(emptyBackup.settings?.deadPorts, undefined, 'no locks — no section written');

  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.deepEqual(preview.deadPorts, sanitizeDeadPorts(entries));
  assert.equal(preview.counts.deadPortsRestored, 1);

  const clash = previewJsonBackupMerge(createInitialState(), backupText, {
    currentDeadPorts: [lock(BOX, 3)], currentDeadPortsStored: true
  });
  assert.equal(clash.deadPorts, null, 'a differing local lockout is never overwritten');
  assert.ok(clash.conflicts.some((c) => c.field === 'Dead port lockout records differ from this device'));

  const identical = previewJsonBackupMerge(createInitialState(), backupText, {
    currentDeadPorts: entries, currentDeadPortsStored: true
  });
  assert.equal(identical.deadPorts, null);
  assert.equal(identical.conflicts.filter((c) => c.field.startsWith('Dead port')).length, 0);
});

// ------------------------------------------------------------------ i18n

test('i18n: every pswap_* key exists in both dictionaries with matching placeholders', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('pswap_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((k) => k.startsWith('pswap_')).sort();
  assert.ok(enKeys.length >= 20, 'the feature ships a real key set');
  assert.deepEqual(urKeys, enKeys, 'ur has exactly the same pswap_* keys');
  const placeholders = (value) => [...String(value).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of enKeys) {
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `${key} placeholders differ`);
  }
});

test('i18n audit: every t() call and data-i18n hook of this feature resolves to a real key', () => {
  const sources = [
    readFileSync(new URL('../splitter-port-swap.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../splitter-map.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../app.js', import.meta.url), 'utf8')
  ].join('\n');
  const used = new Set([...sources.matchAll(/t\('(pswap_[a-z_]+)'/g)].map((m) => m[1]));
  // portSwapErrorKey maps codes to keys dynamically — audit its targets too.
  for (const code of ['customer-not-found', 'no-assignment', 'invalid-port', 'same-port', 'out-of-range', 'dead-port', 'occupied']) {
    used.add(portSwapErrorKey(code));
  }
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const m of html.matchAll(/data-i18n="(pswap_[a-z_]+)"/g)) used.add(m[1]);
  assert.ok(used.size >= 15, 'the audit actually found the feature keys');
  for (const key of used) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
});

// ---------------------------------------------------------------- wiring

test('wiring: dialog, core backup sections, app guards and callbacks are in place', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="splitterPortSwapModal"'), 'swap dialog present');
  assert.ok(html.includes('class="billing-modal splitter-port-swap-modal"'), 'dialog uses the billing-modal shell (var(--modal-surface))');
  for (const id of ['portSwapCloseBtn', 'portSwapCustomerLine', 'portSwapCurrentLine', 'portSwapTargetSelect', 'portSwapLockOld', 'portSwapLockNote', 'portSwapError', 'portSwapConfirmBtn']) {
    assert.ok(html.includes(`id="${id}"`), `${id} hook present`);
  }
  assert.ok(html.includes('class="modal-close"'), 'shared ↩ close button design');

  const core = readFileSync(new URL('../core.js', import.meta.url), 'utf8');
  assert.ok(core.includes("from './splitter-port-swap.js'"), 'core imports the sanitizer');
  assert.ok(core.includes('settings.deadPorts') || core.includes('deadPorts: cleaned'), 'backup writes settings.deadPorts');
  assert.ok(core.includes('counts.deadPortsRestored = 1'), 'preview counts the restore');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './splitter-port-swap.js'"), 'app imports the feature module');
  assert.ok(app.includes('deadPorts: loadDeadPorts()'), 'backup extras carry the lockout list');
  assert.ok(app.includes('currentDeadPorts: loadDeadPorts()'), 'preview currents carry the lockout list');
  assert.ok(app.includes('saveDeadPorts(pendingBackupPreview.deadPorts)'), 'restore applies the lockout list');
  assert.ok(app.includes('getDeadPorts: () => loadDeadPorts()'), 'port map receives the lockout list');
  assert.ok(app.includes('setupPortSwapModal('), 'swap dialog controller is set up');
  assert.ok(app.includes('executePortSwap(state, customerId, newPort, loadDeadPorts(), updateCustomerProfile)'), 'swap commits through updateCustomerProfile');
  const profileGuard = app.indexOf("isPortDead(submittedBoxId, submittedPort, loadDeadPorts())");
  assert.ok(profileGuard > -1, 'profile save consults isPortDead');
  assert.ok(app.indexOf('isPortDead(details.splitterBoxId') > -1, 'new-customer save consults isPortDead');
});

test('CSS: the dead-port styling is token-only (no new hex in the SISP-152 block)', () => {
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('.splitter-port-dead'), css.indexOf('.splitter-map-weak-list'));
  assert.ok(block.includes('var(--color-overdue)'), 'dead styling rides the overdue token');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'no hex values in the SISP-152 CSS block');
});

test('build graph: splitter-port-swap.js is reachable from the entry files (dist budget intact)', async () => {
  const { files, missing } = await collectRuntimeFiles(new URL('..', import.meta.url).pathname);
  assert.deepEqual(missing, []);
  assert.ok(files.includes('splitter-port-swap.js'), 'module is inside the runtime graph');
});
