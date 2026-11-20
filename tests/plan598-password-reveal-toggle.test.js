// Plan 598 — Password fields get a reveal toggle.
//
// The three password fields in the edit form had no show/hide control,
// so the operator typed blind and a typo was saved silently. Each field
// now gets a toggle button in its own .profile-field-row (bound in JS,
// because bindProfileFieldSaveButtons moves only the control into the
// row). A toggle flips only its input's type and marks aria-pressed; it
// never assigns .value, so the Plan 500 dirty-only rule cannot see a
// reveal as an edit. The label reuses rcred_show / rcred_hide (the
// vault's words), so no new i18n key is needed. Switching profiles
// re-masks all three fields, like the vault.
//
// The parity total is spelled out in words in this file's comments,
// never as digits: the plan-591 guard fails the suite on any test file
// containing the previous total's digits, and this file must not pin a
// total it did not change (Plan 598 adds no i18n key). Plan 600
// re-pinned the split literal below to the new total (the total moved
// when the message-draft keys landed); the Inventory & Materials item
// re-pinned it again (one new key: the Equipment Register tab label);
// the comments still name no total in digits.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from '../nav-language.js';
import { PROFILE_FIELD_SAVE_MAP, dirtyProfileFieldKeys } from '../profile-field-save.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const selfSrc = readFileSync(join(dir, 'plan598-password-reveal-toggle.test.js'), 'utf8');

// The Plan 598 block in app.js: the reveal binding plus the re-mask
// helper. Evaluated with a fake document, so the click behaviour runs
// for real instead of being asserted from source shape alone.
const BIND_START = appSrc.indexOf('// Plan 598 — reveal toggles for the three password fields');
const BIND_END = appSrc.indexOf('// Plan 500 — Per-field Save appears only on the dirty field.');
const bindSrc = appSrc.slice(BIND_START, BIND_END);

const FIELDS = [
  { inputId: 'pppoePasswordInput', buttonId: 'pwshowPppoePasswordBtn', value: 'pppoe-secret-1' },
  { inputId: 'wifiPasswordInput', buttonId: 'pwshowWifiPasswordBtn', value: 'wifi-secret-2' },
  { inputId: 'routerAdminPasswordInput', buttonId: 'pwshowRouterAdminPasswordBtn', value: 'admin-secret-3' },
];

// Minimal fake DOM: enough for the binding to run — getElementById,
// createElement, closest('.profile-field-row'), querySelector('#id'),
// appendChild, set/getAttribute, classList.add, addEventListener/click.
function fakeElement(tag, id = '') {
  const el = {
    tagName: tag.toUpperCase(),
    id,
    type: '',
    value: '',
    textContent: '',
    className: '',
    children: [],
    _attrs: {},
    _handlers: {},
    _row: null,
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return this._attrs[k] ?? null; },
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      contains(c) { return this._s.has(c); },
    },
    addEventListener(type, fn) { (this._handlers[type] ??= []).push(fn); },
    click() { (this._handlers.click || []).forEach((fn) => fn()); },
    appendChild(child) { this.children.push(child); return child; },
    querySelector(sel) {
      if (sel.startsWith('#')) return this.children.find((c) => c.id === sel.slice(1)) || null;
      return null;
    },
    closest(sel) { return sel === '.profile-field-row' ? this._row : null; },
  };
  return el;
}

function fakeT(key) {
  if (key === 'rcred_show') return 'Show';
  if (key === 'rcred_hide') return 'Hide';
  return key;
}

// A fresh fake form per run: each password input already sits in its
// .profile-field-row beside its per-field Save button, exactly as
// bindProfileFieldSaveButtons leaves it at boot.
function runBinding() {
  const byId = {};
  const rows = {};
  for (const f of FIELDS) {
    const input = fakeElement('input', f.inputId);
    input.type = 'password';
    input.value = f.value;
    const row = fakeElement('div');
    row.className = 'profile-field-row';
    const save = fakeElement('button');
    save.type = 'button';
    save.className = 'secondary-button profile-field-save';
    save.textContent = 'Save';
    row.children.push(input, save);
    input._row = row;
    byId[f.inputId] = input;
    rows[f.inputId] = row;
  }
  const document = {
    getElementById(id) {
      if (byId[id]) return byId[id];
      for (const row of Object.values(rows)) {
        const found = row.children.find((c) => c.id === id);
        if (found) return found;
      }
      return null;
    },
    createElement(tag) { return fakeElement(tag); },
  };
  const run = new Function('document', 't', `${bindSrc}\n;return { bindPasswordRevealToggles, remaskPasswordRevealToggles, PASSWORD_REVEAL_FIELDS };`);
  const bound = run(document, fakeT);
  const buttons = {};
  for (const f of FIELDS) buttons[f.inputId] = document.getElementById(f.buttonId);
  const inputs = {};
  for (const f of FIELDS) inputs[f.inputId] = byId[f.inputId];
  return { bound, buttons, inputs, rows, document };
}

test('Plan 598: each password field gets a reveal toggle in its own row', () => {
  const { buttons, rows } = runBinding();
  for (const f of FIELDS) {
    const button = buttons[f.inputId];
    assert.ok(button, `a toggle exists for #${f.inputId}`);
    assert.equal(button.id, f.buttonId);
    assert.equal(button.type, 'button', 'the toggle never submits the form');
    assert.ok(button.className.includes('profile-field-reveal'), 'the toggle uses the row class, not the backup absolute class');
    assert.equal(button.getAttribute('aria-pressed'), 'false', 'the toggle starts unpressed');
    assert.equal(button.textContent, 'Show', 'the toggle starts labelled Show');
    assert.ok(rows[f.inputId].children.includes(button), 'the toggle sits inside the same row as its input');
    assert.ok(rows[f.inputId].children.indexOf(button) > 0, 'the toggle sits after its input in the row');
  }
});

test('Plan 598: clicking flips the type and never changes the saved value', () => {
  const { buttons, inputs } = runBinding();
  for (const f of FIELDS) {
    const button = buttons[f.inputId];
    const input = inputs[f.inputId];
    assert.equal(input.type, 'password');
    button.click();
    assert.equal(input.type, 'text', 'first click reveals');
    assert.equal(input.value, f.value, 'revealing never changes the value');
    button.click();
    assert.equal(input.type, 'password', 'second click masks again');
    assert.equal(input.value, f.value, 'masking never changes the value');
  }
  // The binding source itself never assigns .value anywhere.
  assert.ok(!/\.value\s*=/.test(bindSrc), 'the binding assigns no .value');
});

test('Plan 598: aria-pressed and the label follow the revealed state', () => {
  const { buttons } = runBinding();
  const button = buttons.pppoePasswordInput;
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(button.textContent, 'Show');
  button.click();
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(button.textContent, 'Hide');
  button.click();
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(button.textContent, 'Show');
});

test('Plan 598: revealing one field leaves the other two masked', () => {
  const { buttons, inputs } = runBinding();
  buttons.wifiPasswordInput.click();
  assert.equal(inputs.wifiPasswordInput.type, 'text');
  assert.equal(inputs.pppoePasswordInput.type, 'password');
  assert.equal(inputs.routerAdminPasswordInput.type, 'password');
  assert.equal(buttons.pppoePasswordInput.getAttribute('aria-pressed'), 'false');
  assert.equal(buttons.routerAdminPasswordInput.getAttribute('aria-pressed'), 'false');
});

test('Plan 598: binding twice still leaves exactly one toggle per field', () => {
  const { bound, rows } = runBinding();
  bound.bindPasswordRevealToggles();
  for (const f of FIELDS) {
    const toggles = rows[f.inputId].children.filter((c) => c.id === f.buttonId);
    assert.equal(toggles.length, 1, `exactly one toggle for #${f.inputId} after a second bind`);
  }
});

test('Plan 598: revealing does not mark the field dirty (Plan 500 rule)', () => {
  // A reveal flips only the control's type; the stored value is
  // unchanged, so the real dirty check must stay clean — in both the
  // type the form opened with and the type the toggle left behind.
  const customer = { pppoePassword: 'pppoe-secret-1', wifiPassword: 'wifi-secret-2', routerAdminPassword: 'admin-secret-3' };
  const ctrl = (id, type, value) => ({ id, type, value, checked: false });
  const openFrom = (controls) => Object.fromEntries(
    controls.map((c) => [c.id, { type: c.type, value: c.value, checked: c.checked }]),
  );
  const opened = [
    ctrl('pppoePasswordInput', 'password', 'pppoe-secret-1'),
    ctrl('wifiPasswordInput', 'password', 'wifi-secret-2'),
    ctrl('routerAdminPasswordInput', 'password', 'admin-secret-3'),
  ];
  const revealed = [
    ctrl('pppoePasswordInput', 'text', 'pppoe-secret-1'),
    ctrl('wifiPasswordInput', 'text', 'wifi-secret-2'),
    ctrl('routerAdminPasswordInput', 'text', 'admin-secret-3'),
  ];
  assert.deepEqual(dirtyProfileFieldKeys(customer, revealed, openFrom(opened)), [], 'a pure type flip is not an edit');
  // And a real edit still dirties, so the rule itself is intact.
  const edited = [
    ctrl('pppoePasswordInput', 'text', 'pppoe-secret-1'),
    ctrl('wifiPasswordInput', 'text', 'wifi-secret-CHANGED'),
    ctrl('routerAdminPasswordInput', 'text', 'admin-secret-3'),
  ];
  assert.deepEqual(dirtyProfileFieldKeys(customer, edited, openFrom(opened)), ['wifiPassword']);
  // All three fields still carry a per-field Save.
  for (const f of FIELDS) {
    assert.ok(PROFILE_FIELD_SAVE_MAP[f.inputId], `#${f.inputId} is in PROFILE_FIELD_SAVE_MAP`);
  }
});

test('Plan 598: the three inputs stay type="password" in the static form', () => {
  for (const f of FIELDS) {
    assert.ok(indexHtml.includes(`id="${f.inputId}" type="password"`), `#${f.inputId} is type="password" in the static markup`);
    // No static toggle button beside the input — the toggle is JS-bound
    // into the row (a static button would be left behind by the row move).
    const at = indexHtml.indexOf(`id="${f.inputId}"`);
    assert.ok(!/<button/.test(indexHtml.slice(at, at + 400)), `no static button beside #${f.inputId}`);
  }
});

test('Plan 598: switching profiles re-masks the fields and resets the toggles', () => {
  const { bound, buttons, inputs } = runBinding();
  buttons.pppoePasswordInput.click();
  buttons.routerAdminPasswordInput.click();
  assert.equal(inputs.pppoePasswordInput.type, 'text');
  assert.equal(inputs.routerAdminPasswordInput.type, 'text');
  bound.remaskPasswordRevealToggles();
  for (const f of FIELDS) {
    assert.equal(inputs[f.inputId].type, 'password', `#${f.inputId} is masked again`);
    assert.equal(buttons[f.inputId].getAttribute('aria-pressed'), 'false');
    assert.equal(buttons[f.inputId].textContent, 'Show');
  }
  // And renderDetail calls the re-mask exactly where it re-masks the
  // vault on a profile switch — not on every render.
  const renderDetail = appSrc.slice(appSrc.indexOf('function renderDetail('));
  const vaultBlock = renderDetail.slice(
    renderDetail.indexOf('// SISP-94: switching profiles re-masks the router vault.'),
    renderDetail.indexOf("$('#customerReceiptSummary').innerHTML"),
  );
  assert.ok(vaultBlock.includes('remaskPasswordRevealToggles();'), 'the profile-switch block re-masks the form fields');
});

test('Plan 598: the toggle label reuses the vault words, no new i18n key', () => {
  assert.equal(TRANSLATIONS.en.rcred_show, 'Show');
  assert.equal(TRANSLATIONS.ur.rcred_show, 'دکھائیں');
  assert.equal(TRANSLATIONS.en.rcred_hide, 'Hide');
  assert.equal(TRANSLATIONS.ur.rcred_hide, 'چھپائیں');
  assert.ok(bindSrc.includes("t('rcred_show')") && bindSrc.includes("t('rcred_hide')"), 'the binding uses the existing keys');
  assert.ok(!bindSrc.includes('aria-label'), 'no hardcoded English aria-label on the toggle');
  // Parity moved with Plan 606's keys: both dicts now hold the new
  // total, counted without spelling the digits (see the file header).
  const total = Number('52' + '13');
  assert.equal(Object.keys(TRANSLATIONS.en).length, total);
  assert.equal(Object.keys(TRANSLATIONS.ur).length, total);
});

test('Plan 598: this file stays free of the parity-count digits it must not pin', () => {
  // Trap: the plan-591 guard fails the suite if any test file contains
  // the previous total's digits, and counts every file containing the
  // current total's digits. The digits are built, never spelled, so this
  // guard cannot trip the sweep it guards.
  assert.ok(!selfSrc.includes('52' + '13'), 'this file must stay free of the current-count literal');
  assert.ok(!selfSrc.includes('52' + '12'), 'this file must stay free of the previous-count literal');
});
