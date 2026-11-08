import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PROFILE_FIELD_SAVE_MAP, dirtyProfileFieldKeys } from '../profile-field-save.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');

// Plan 500 — Per-field Save appears only on the dirty field.
//
// The 69 per-field Save buttons are visually noisy when all visible,
// and none of them says which field is unsaved. A button shows only
// while its own field is dirty, reusing the exact dirty check Plan 499
// built for Cancel (dirtyProfileFieldKeys: differs from the stored
// record AND from the value the form opened with). The sync itself is
// app.js wiring over that pure check, so these tests pin the pure
// semantics the sync depends on plus the wiring in source.

const ctrl = (id, type, value, checked = false) => ({ id, type, value, checked });
const openFrom = (controls) => Object.fromEntries(
  controls.map((c) => [c.id, { type: c.type, value: c.value, checked: c.checked }]),
);

test('Plan 500: a freshly opened form has no dirty fields, so no per-field Save shows', () => {
  const customer = { name: 'Test Customer', phone: '03012345678', mohalla: 'Shahdara', prefersSms: false };
  const controls = [
    ctrl('profileNameInput', 'text', 'Test Customer'),
    ctrl('phoneInput', 'tel', '03012345678'),
    ctrl('mohallaInput', 'text', 'Shahdara'),
    ctrl('prefersSmsCheckbox', 'checkbox', 'on', false),
    // Derived pre-fill: renderDetail writes 'not-set' for an unset
    // serviceStatus, which differs from the stored record but matches
    // the value the form opened with — clean, not dirty.
    ctrl('serviceStatusInput', 'select-one', 'not-set'),
  ];
  assert.deepEqual(dirtyProfileFieldKeys(customer, controls, openFrom(controls)), []);
});

test('Plan 500: editing exactly one field dirties exactly that field', () => {
  const customer = { phone: '03012345678', address: 'Old street', mohalla: 'Shahdara' };
  const controls = [
    ctrl('phoneInput', 'tel', '03012345678'),
    ctrl('addressInput', 'text', 'Old street'),
    ctrl('mohallaInput', 'text', 'Shahdara'),
  ];
  const edited = [
    ctrl('phoneInput', 'tel', '03012345679'),
    ctrl('addressInput', 'text', 'Old street'),
    ctrl('mohallaInput', 'text', 'Shahdara'),
  ];
  assert.deepEqual(dirtyProfileFieldKeys(customer, edited, openFrom(controls)), ['phone']);
});

test('Plan 500: password fields follow the same rule as every other field', () => {
  const customer = { pppoePassword: 'old-pass-1', wifiPassword: 'old-pass-2', routerAdminPassword: 'old-pass-3' };
  const controls = [
    ctrl('pppoePasswordInput', 'password', 'old-pass-1'),
    ctrl('wifiPasswordInput', 'password', 'old-pass-2'),
    ctrl('routerAdminPasswordInput', 'password', 'old-pass-3'),
  ];
  assert.deepEqual(dirtyProfileFieldKeys(customer, controls, openFrom(controls)), []);
  const edited = [
    ctrl('pppoePasswordInput', 'password', 'old-pass-1'),
    ctrl('wifiPasswordInput', 'password', 'new-pass-2'),
    ctrl('routerAdminPasswordInput', 'password', 'old-pass-3'),
  ];
  assert.deepEqual(dirtyProfileFieldKeys(customer, edited, openFrom(controls)), ['wifiPassword']);
});

test('Plan 500: reverting an edit re-cleans the field, so its Save hides again', () => {
  const customer = { phone: '03012345678' };
  const controls = [ctrl('phoneInput', 'tel', '03012345678')];
  const edited = [ctrl('phoneInput', 'tel', '03012345679')];
  assert.deepEqual(dirtyProfileFieldKeys(customer, edited, openFrom(controls)), ['phone']);
  const reverted = [ctrl('phoneInput', 'tel', '03012345678')];
  assert.deepEqual(dirtyProfileFieldKeys(customer, reverted, openFrom(controls)), []);
});

test('Plan 500: a toggled checkbox dirties exactly its field', () => {
  const customer = { prefersSms: false, paused: false };
  const controls = [
    ctrl('prefersSmsCheckbox', 'checkbox', 'on', false),
    ctrl('pauseBillingCheckbox', 'checkbox', 'on', false),
  ];
  const edited = [
    ctrl('prefersSmsCheckbox', 'checkbox', 'on', true),
    ctrl('pauseBillingCheckbox', 'checkbox', 'on', false),
  ];
  assert.deepEqual(dirtyProfileFieldKeys(customer, edited, openFrom(controls)), ['prefersSms']);
});

test('Plan 500: the sync reuses the Plan 499 dirty check and toggles is-clean', () => {
  const app = read('app.js');
  assert.ok(app.includes('dirtyProfileFieldKeys'), 'the sync must use the shared dirty check');
  assert.ok(app.includes('function syncProfileFieldSaveButtons()'), 'the sync helper must exist');
  const fn = app.slice(app.indexOf('function syncProfileFieldSaveButtons()'), app.indexOf('// Plan 499 — Cancel means Close'));
  assert.ok(fn.includes('dirtyProfileFieldKeys(customer, controls, profileCancelOpenValues)'), 'the sync must compare against the stored record and the open-time values');
  assert.ok(fn.includes("button.closest('.profile-field-row')"), 'the sync must find each button’s own control in its row');
  assert.ok(fn.includes('PROFILE_FIELD_SAVE_MAP[control.id]'), 'the sync must map the control to its field key');
  assert.ok(fn.includes("button.classList.toggle('is-clean'"), 'the sync must toggle the hidden class');
  assert.ok(fn.includes('!key || !dirty.has(key)'), 'a button shows only while its own field key is dirty');
});

test('Plan 500: buttons start hidden, so a freshly opened form shows none', () => {
  const app = read('app.js');
  const bind = app.slice(app.indexOf('function bindProfileFieldSaveButtons()'), app.indexOf('bindProfileFieldSaveButtons();'));
  assert.ok(bind.includes("button.classList.add('is-clean')"), 'a per-field Save must start hidden at creation');
});

test('Plan 500: the sync runs on open, on input, on change, and after the save feedback', () => {
  const app = read('app.js');
  assert.equal(app.match(/syncProfileFieldSaveButtons\(\);/g).length, 4, 'the sync must run exactly four places: open, input, change, and the save-feedback timer');
  const visibility = app.slice(app.indexOf('function onProfileFormVisibilityChange()'), app.indexOf('function syncProfileStickySaveBar()'));
  assert.ok(visibility.includes('syncProfileFieldSaveButtons();'), 'opening the form must re-sync (after the open-time snapshot)');
  const input = app.slice(app.indexOf("profileFormEl?.addEventListener('input'"), app.indexOf("profileFormEl?.addEventListener('change'"));
  assert.ok(input.includes('syncProfileFieldSaveButtons();'), 'typing must re-sync');
  const change = app.slice(app.indexOf("profileFormEl?.addEventListener('change'"), app.indexOf('syncProfileStickySaveBar();\nupdateProfileCompletionCounter();'));
  assert.ok(change.includes('syncProfileFieldSaveButtons();'), 'a select/checkbox change must re-sync');
  const saveFn = app.slice(app.indexOf('async function saveProfileField'), app.indexOf('function bindProfileFieldSaveButtons'));
  assert.ok(saveFn.includes("setTimeout(() => { if (!document.body.contains(button)) return; button.textContent = 'Save'; syncProfileFieldSaveButtons(); }, 1500);"), 'the feedback timer must restore the label and then hide the saved button');
});

test('Plan 500: the 1.5s Saved feedback is never cut short by the sync', () => {
  const app = read('app.js');
  const fn = app.slice(app.indexOf('function syncProfileFieldSaveButtons()'), app.indexOf('// Plan 499 — Cancel means Close'));
  assert.ok(fn.includes("if (button.textContent === 'Saved ✓') return;"), 'a button showing the Saved feedback must stay visible until its timer runs');
  const saveFn = app.slice(app.indexOf('async function saveProfileField'), app.indexOf('function bindProfileFieldSaveButtons'));
  const finallyPart = saveFn.slice(saveFn.indexOf('finally {'));
  assert.ok(!finallyPart.includes('syncProfileFieldSaveButtons'), 'the save finally must not hide the button mid-feedback');
  assert.ok(saveFn.includes("button.textContent = 'Saved ✓';"), 'the Saved feedback text itself is unchanged');
});

test('Plan 500: the hidden state reserves space — no display:none, fade via opacity', () => {
  const css = read('profile-ui.css');
  assert.ok(css.includes('.profile-field-save.is-clean {'), 'the hidden state needs its own rule');
  const rule = css.slice(css.indexOf('.profile-field-save.is-clean {'), css.indexOf('}', css.indexOf('.profile-field-save.is-clean {')) + 1);
  assert.ok(rule.includes('visibility: hidden'), 'the button must hide with visibility so the row keeps its space');
  assert.ok(rule.includes('opacity: 0'), 'the button must fade out');
  assert.ok(rule.includes('pointer-events: none'), 'a faded button must not be clickable');
  assert.ok(!rule.includes('display: none'), 'display:none would collapse the space and jump the layout');
  assert.ok(!rule.includes('#'), 'the hidden rule must introduce no hex colour');
  const base = css.slice(css.indexOf('.profile-field-save {'), css.indexOf('}', css.indexOf('.profile-field-save {')) + 1);
  assert.ok(base.includes('min-height: 44px'), 'the 44px touch height is unchanged');
  assert.ok(base.includes('transition: opacity 150ms ease, visibility 150ms ease'), 'the button must fade between states');
});

test('Plan 500: the field map is untouched — still exactly the 69 profile fields', () => {
  assert.equal(Object.keys(PROFILE_FIELD_SAVE_MAP).length, 69, 'the field map must still hold 69 fields');
});
