/**
 * sisp80-owner-pin.test.js — SISP-80 [P2]: 4-Digit Owner PIN Lock for
 * Partner Profit, Expense Delete & Void Actions.
 *
 * Spec criteria (read-latest.txt, SISP-80): "With Owner PIN enabled
 * and Restricted Mode active, opening Partner Settlement prompts for
 * the PIN while Quick Collect and Field Mode work without any PIN
 * prompt." Plus the brief's default: DISABLED by default so existing
 * flows never block.
 *
 * Pins:
 *  - disabled by default: no record on the device -> guardDecision
 *    never blocks any action, and the controller resolves requireUnlock
 *    immediately without opening the prompt;
 *  - the stored record holds ONLY a salted SHA-256 hash (per-record
 *    random salt): no field equals the PIN, no 'pin' key exists, and
 *    hashOwnerPin matches an independent node:crypto SHA-256 of
 *    `salt:pin`; the PIN literal/key string lives only in the module
 *    (backups never carry it — the key is device-local);
 *  - with PIN set + Restricted Mode ON + session locked, ALL FOUR
 *    restricted actions block ('pin-required'); non-restricted actions
 *    (quick collect, field mode, search, receipts, complaints) never
 *    block in any state;
 *  - controller prompt flow against a fake DOM: a wrong PIN unlocks
 *    nothing and keeps the dialog open; the correct PIN resolves the
 *    pending action true and unlocks the rest of the session; Cancel
 *    resolves false; lock() re-locks; settings are gated behind the
 *    current PIN and a settings save rotates the PIN (old PIN dies,
 *    new PIN verifies);
 *  - i18n: every pin_* key used by the module or the dialog markup
 *    exists in BOTH dictionaries; wiring: dialog markup + ids, app.js
 *    import/controller/gates, token-only CSS, runtime graph.
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  OWNER_PIN_KEY, RESTRICTED_ACTIONS,
  isValidOwnerPinFormat, sanitizeOwnerPinRecord,
  loadOwnerPinRecord, saveOwnerPinRecord, clearOwnerPinRecord,
  generateOwnerPinSalt, hashOwnerPin, createOwnerPinRecord, verifyOwnerPin,
  ownerPinStatus, guardDecision, setupOwnerPinGuard
} from '../owner-pin-guard.js';
import { collectRuntimeFiles } from '../build.mjs';
import { TRANSLATIONS } from '../nav-language.js';

function makeStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); },
    _map: map
  };
}

/** Poll until an async controller chain (WebCrypto digests) settles. */
const waitFor = async (condition, label) => {
  for (let i = 0; i < 200; i++) {
    if (condition()) return;
    await new Promise(r => setTimeout(r, 5));
  }
  assert.fail(`timed out waiting for: ${label}`);
};

test('PIN format: exactly 4 digits, nothing else', () => {
  assert.equal(isValidOwnerPinFormat('1234'), true);
  assert.equal(isValidOwnerPinFormat('0000'), true);
  for (const bad of ['123', '12345', '12a4', ' 1234', '1234 ', '', null, undefined, 1234, '１２３４']) {
    assert.equal(isValidOwnerPinFormat(bad), false, `rejected: ${String(bad)}`);
  }
});

test('hash is a genuine salted SHA-256 and the record never holds the PIN', async () => {
  const salt = '0123456789abcdef0123456789abcdef';
  const expected = createHash('sha256').update(`${salt}:1357`).digest('hex');
  assert.equal(await hashOwnerPin('1357', salt), expected);
  assert.equal(await hashOwnerPin('135', salt), null, 'malformed PIN hashes to null');
  assert.equal(await hashOwnerPin('1357', 'not-hex'), null, 'malformed salt hashes to null');

  const record = await createOwnerPinRecord('1357', { restrictedMode: true });
  assert.deepEqual(Object.keys(record).sort(), ['hash', 'restrictedMode', 'salt', 'updatedAt', 'version']);
  assert.match(record.salt, /^[0-9a-f]{32}$/);
  assert.match(record.hash, /^[0-9a-f]{64}$/);
  assert.ok(!Object.values(record).includes('1357'), 'no field stores the plaintext PIN');
  assert.equal(record.restrictedMode, true);

  // Random salt: the same PIN set twice yields different salt AND hash.
  const again = await createOwnerPinRecord('1357', { restrictedMode: true });
  assert.notEqual(again.salt, record.salt);
  assert.notEqual(again.hash, record.hash);
  assert.match(generateOwnerPinSalt(), /^[0-9a-f]{32}$/);
});

test('verify: correct PIN passes, wrong/tampered/malformed fail closed', async () => {
  const record = await createOwnerPinRecord('2468', { restrictedMode: true });
  assert.equal(await verifyOwnerPin(record, '2468'), true);
  assert.equal(await verifyOwnerPin(record, '2469'), false);
  assert.equal(await verifyOwnerPin(record, '246'), false);
  assert.equal(await verifyOwnerPin({ ...record, hash: '0'.repeat(64) }, '2468'), false);
  assert.equal(await verifyOwnerPin(null, '2468'), false);
  assert.equal(await verifyOwnerPin({ salt: record.salt }, '2468'), false);
});

test('sanitize + storage round-trip; malformed data degrades to disabled', async () => {
  const storage = makeStorage();
  assert.equal(loadOwnerPinRecord(storage), null, 'absent record = disabled');

  const record = await createOwnerPinRecord('1357', { restrictedMode: false });
  assert.equal(saveOwnerPinRecord(record, storage), true);
  assert.deepEqual(loadOwnerPinRecord(storage), record);
  assert.ok(storage._map.has(OWNER_PIN_KEY));

  // restrictedMode only ever survives as a strict boolean true.
  assert.equal(sanitizeOwnerPinRecord({ ...record, restrictedMode: 'yes' }).restrictedMode, false);
  assert.equal(sanitizeOwnerPinRecord({ ...record, extra: 'drop me' }).extra, undefined);
  assert.equal(sanitizeOwnerPinRecord({ ...record, salt: 'zz' }), null);
  assert.equal(sanitizeOwnerPinRecord(null), null);
  assert.equal(sanitizeOwnerPinRecord('junk'), null);
  assert.equal(saveOwnerPinRecord({ salt: 'x' }, storage), false, 'garbage is never persisted');

  storage._map.set(OWNER_PIN_KEY, '{broken json');
  assert.equal(loadOwnerPinRecord(storage), null, 'corrupt JSON = disabled, never a crash');

  assert.equal(clearOwnerPinRecord(storage), true);
  assert.equal(loadOwnerPinRecord(storage), null);
});

test('status + guardDecision matrix (the spec pin, pure layer)', async () => {
  assert.deepEqual(ownerPinStatus(null), { hasPin: false, restrictedMode: false, active: false });

  const modeOff = await createOwnerPinRecord('1357', { restrictedMode: false });
  const active = await createOwnerPinRecord('1357', { restrictedMode: true });
  assert.deepEqual(ownerPinStatus(modeOff), { hasPin: true, restrictedMode: false, active: false });
  assert.deepEqual(ownerPinStatus(active), { hasPin: true, restrictedMode: true, active: true });

  assert.deepEqual(RESTRICTED_ACTIONS, ['partner-settlement', 'partner-shares', 'expense-delete', 'payment-void']);
  for (const action of RESTRICTED_ACTIONS) {
    assert.deepEqual(guardDecision(null, action, {}), { blocked: false, reason: 'no-pin' }, `${action}: disabled by default`);
    assert.deepEqual(guardDecision(modeOff, action, {}), { blocked: false, reason: 'mode-off' }, `${action}: mode off`);
    assert.deepEqual(guardDecision(active, action, {}), { blocked: true, reason: 'pin-required' }, `${action}: prompts when active + locked`);
    assert.deepEqual(guardDecision(active, action, { sessionUnlocked: true }), { blocked: false, reason: 'session-unlocked' }, `${action}: session stays unlocked`);
  }
  // The never-locked surface: even with the lock fully active.
  for (const action of ['quick-collect', 'field-mode', 'customer-search', 'receipts', 'complaints']) {
    assert.deepEqual(guardDecision(active, action, {}), { blocked: false, reason: 'not-restricted' }, `${action} never prompts`);
  }
});

// ---- controller against a minimal fake DOM ----
class FakeEl {
  constructor(id) {
    this.id = id; this.hidden = false; this.value = ''; this.checked = false;
    this.textContent = ''; this.open = false; this.listeners = {};
  }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  dispatch(type, event = {}) { for (const fn of this.listeners[type] ?? []) fn({ target: this, preventDefault() {}, ...event }); }
  click() { this.dispatch('click'); }
  focus() { this.focused = true; }
  showModal() { this.open = true; }
  close() { this.open = false; }
}

const ELEMENT_IDS = [
  'ownerPinDialog', 'ownerPinPromptSection', 'ownerPinSettingsSection', 'ownerPinPromptInput',
  'ownerPinPromptError', 'ownerPinDialogTitle', 'ownerPinStatusLine', 'ownerPinCurrentInput',
  'ownerPinCurrentField', 'ownerPinNewInput', 'ownerPinConfirmInput', 'ownerPinRestrictedToggle',
  'ownerPinSettingsError', 'ownerPinRemoveBtn', 'ownerPinUnlockBtn', 'ownerPinPromptCancelBtn',
  'ownerPinCloseBtn', 'ownerPinSettingsCloseBtn', 'ownerPinSaveBtn', 'mobileMoreOwnerPinBtn', 'mobileMoreMenu'
];

function makeController(storage) {
  const els = new Map(ELEMENT_IDS.map(id => [id, new FakeEl(id)]));
  globalThis.document = { getElementById: id => els.get(id) ?? null };
  const controller = setupOwnerPinGuard({ storage, onToast: () => {} });
  assert.ok(controller, 'controller sets up against the dialog markup ids');
  return { controller, els };
}

test('controller: disabled by default — requireUnlock resolves instantly, dialog never opens', async () => {
  const storage = makeStorage();
  const { controller, els } = makeController(storage);
  try {
    assert.equal(await controller.requireUnlock('partner-settlement'), true);
    assert.equal(await controller.requireUnlock('payment-void'), true);
    assert.equal(els.get('ownerPinDialog').open, false, 'no prompt anywhere while disabled');
    assert.deepEqual(controller.status(), { hasPin: false, restrictedMode: false, active: false });
  } finally { delete globalThis.document; }
});

test('controller: active lock prompts; wrong PIN stays locked; correct PIN unlocks the session; Cancel refuses', async () => {
  const storage = makeStorage();
  saveOwnerPinRecord(await createOwnerPinRecord('1357', { restrictedMode: true }), storage);
  const { controller, els } = makeController(storage);
  const dialog = els.get('ownerPinDialog');
  const input = els.get('ownerPinPromptInput');
  try {
    // Opening Partner Settlement prompts (spec pin).
    const attempt = controller.requireUnlock('partner-settlement');
    await waitFor(() => dialog.open, 'prompt to open for a restricted action');
    assert.equal(els.get('ownerPinPromptSection').hidden, false);
    assert.equal(els.get('ownerPinSettingsSection').hidden, true);

    // Wrong PIN: nothing unlocks, dialog stays open, error is shown.
    input.value = '0000';
    els.get('ownerPinUnlockBtn').click();
    await waitFor(() => els.get('ownerPinPromptError').hidden === false, 'wrong-PIN error to show');
    assert.equal(controller.isSessionUnlocked(), false);
    assert.equal(dialog.open, true, 'wrong PIN keeps the prompt open');
    assert.equal(els.get('ownerPinPromptError').hidden, false);
    assert.equal(input.value, '', 'entered PIN is cleared after a failed try');

    // Correct PIN: pending action resolves true, session unlocks.
    input.value = '1357';
    els.get('ownerPinUnlockBtn').click();
    assert.equal(await attempt, true);
    assert.equal(controller.isSessionUnlocked(), true);
    assert.equal(dialog.open, false);

    // The rest of the session needs no prompt (Field Mode/QC never gated in the first place).
    assert.equal(await controller.requireUnlock('payment-void'), true);
    assert.equal(dialog.open, false);

    // lock() re-locks; cancelling the next prompt refuses the action.
    controller.lock();
    const refused = controller.requireUnlock('expense-delete');
    await waitFor(() => dialog.open, 'prompt to reopen after lock()');
    els.get('ownerPinPromptCancelBtn').click();
    assert.equal(await refused, false);
    assert.equal(controller.isSessionUnlocked(), false);
  } finally { delete globalThis.document; }
});

test('controller: settings are PIN-gated and a save rotates the PIN', async () => {
  const storage = makeStorage();
  saveOwnerPinRecord(await createOwnerPinRecord('1357', { restrictedMode: true }), storage);
  const { controller, els } = makeController(storage);
  const dialog = els.get('ownerPinDialog');
  try {
    // Opening settings while locked prompts first.
    controller.openSettings();
    await waitFor(() => dialog.open, 'settings prompt to open');
    assert.equal(els.get('ownerPinSettingsSection').hidden, true, 'settings stay hidden until the PIN is proven');
    els.get('ownerPinPromptInput').value = '1357';
    els.get('ownerPinUnlockBtn').click();
    await waitFor(() => els.get('ownerPinSettingsSection').hidden === false, 'settings to open after unlock');

    // Rotate 1357 -> 2468 with the toggle ON.
    els.get('ownerPinCurrentInput').value = '1357';
    els.get('ownerPinNewInput').value = '2468';
    els.get('ownerPinConfirmInput').value = '2468';
    els.get('ownerPinRestrictedToggle').checked = true;
    els.get('ownerPinSaveBtn').click();
    await waitFor(() => dialog.open === false, 'dialog to close after a successful save');
    const rotated = loadOwnerPinRecord(storage);
    assert.equal(await verifyOwnerPin(rotated, '2468'), true, 'new PIN verifies');
    assert.equal(await verifyOwnerPin(rotated, '1357'), false, 'old PIN is dead');
    assert.equal(rotated.restrictedMode, true);

    // A save with the WRONG current PIN changes nothing.
    controller.openSettings(); // session still unlocked from the save
    await waitFor(() => dialog.open, 'settings to reopen');
    const before = loadOwnerPinRecord(storage);
    els.get('ownerPinCurrentInput').value = '9999';
    els.get('ownerPinNewInput').value = '5555';
    els.get('ownerPinConfirmInput').value = '5555';
    els.get('ownerPinSaveBtn').click();
    await waitFor(() => els.get('ownerPinSettingsError').hidden === false, 'wrong-current-PIN error to show');
    assert.deepEqual(loadOwnerPinRecord(storage), before, 'wrong current PIN = no change');
  } finally { delete globalThis.document; }
});

test('i18n: every pin_* key used by the module or markup exists in both dictionaries', () => {
  const moduleSource = readFileSync(new URL('../owner-pin-guard.js', import.meta.url), 'utf8');
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const used = new Set();
  for (const m of moduleSource.matchAll(/t\('(pin_[a-z_]+)'/g)) used.add(m[1]);
  for (const m of indexHtml.matchAll(/data-i18n="(pin_[a-z_]+)"/g)) used.add(m[1]);
  assert.ok(used.size >= 20, `expected at least 20 pin keys, found ${used.size}`);
  for (const key of used) {
    assert.ok(Object.hasOwn(TRANSLATIONS.en, key), `en missing ${key}`);
    assert.ok(Object.hasOwn(TRANSLATIONS.ur, key), `ur missing ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key, `en value for ${key} is not the raw key`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `ur value for ${key} is not the raw key`);
  }
});

test('wiring: dialog markup, app.js gates, token CSS, runtime graph, PIN stays out of backups', async () => {
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const core = readFileSync(new URL('../core.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');

  assert.ok(indexHtml.includes('id="ownerPinDialog"'), 'dialog present');
  assert.ok(indexHtml.includes('owner-pin-dialog'), 'dialog uses the billing-modal shell');
  for (const id of ELEMENT_IDS) assert.ok(indexHtml.includes(`id="${id}"`), `markup carries #${id}`);
  assert.ok(indexHtml.includes('id="mobileMoreOwnerPinBtn"'), 'More-menu entry present');

  assert.ok(app.includes("from './owner-pin-guard.js'"), 'app.js imports the module');
  assert.ok(app.includes('setupOwnerPinGuard'), 'app.js wires the controller');
  assert.ok(app.includes("requireOwnerPin('payment-void')"), 'void dialog is gated');
  assert.ok(app.includes('openVoidPaymentDialogUnlocked'), 'void dialog opens only after the gate');
  assert.ok(app.includes("requireOwnerPin('expense-delete')"), 'expense deletion is gated');
  assert.ok(app.includes("'partner-settlement'") && app.includes("'partner-shares'"), 'partner tabs are gated');

  assert.ok(css.includes('.owner-pin-input'), 'dialog CSS present');
  const pinCss = css.slice(css.indexOf('SISP-80: Owner PIN dialog'));
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(pinCss), 'owner-pin CSS is token-only (no hex colours)');

  // The PIN record is device-local: its storage key literal exists ONLY
  // in the module, so backups (core.js createJsonBackup + app.js
  // backup extras) can never carry the hash.
  assert.ok(!core.includes(OWNER_PIN_KEY), 'core backup never mentions the PIN key');
  assert.ok(!app.includes(OWNER_PIN_KEY), 'app backup extras never mention the PIN key');

  const { files, missing } = await collectRuntimeFiles(new URL('..', import.meta.url).pathname);
  assert.deepEqual(missing, []);
  assert.ok(files.includes('owner-pin-guard.js'), 'module is reachable in the build runtime graph');
});
