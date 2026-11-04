import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PROFILE_FIELD_SAVE_MAP, profileFieldSaveEntry } from '../profile-field-save.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');

// Every editable control in the profile edit form must have exactly one
// per-field Save button: the set of controls inside `.profile-field`
// labels in index.html must equal the map keys, no more and no less.
// (The pro-rata toggles, contributor editor and incident/uptime forms
// are not `.profile-field` labels, so they are correctly absent here.)
test('profile field save map covers every .profile-field control exactly once', () => {
  const html = read('index.html');
  const formStart = html.indexOf('id="customerProfileForm"');
  assert.notEqual(formStart, -1, 'profile form must exist');
  const formHtml = html.slice(formStart, formStart + 60000);
  const labels = [...formHtml.matchAll(/<label class="profile-field"[^>]*>(.*?)<\/label>/gs)];
  assert.ok(labels.length > 0, 'profile-field labels must exist');
  const controlIds = [];
  for (const [, body] of labels) {
    const controls = [...body.matchAll(/<(?:input|select|textarea)[^>]*id="([^"]+)"/g)];
    assert.equal(controls.length, 1, `each profile-field label must hold exactly one control: ${body.slice(0, 80)}`);
    controlIds.push(controls[0][1]);
  }
  assert.equal(new Set(controlIds).size, controlIds.length, 'no control id may repeat');
  assert.deepEqual([...controlIds].sort(), Object.keys(PROFILE_FIELD_SAVE_MAP).sort());
});

test('profile field save entry maps the headline fields', () => {
  assert.deepEqual(profileFieldSaveEntry('phoneInput', { type: 'tel', value: '03001234567' }), { key: 'phone', value: '03001234567' });
  assert.deepEqual(profileFieldSaveEntry('profileNameInput', { type: 'text', value: 'Orient school' }), { key: 'name', value: 'Orient school' });
  assert.deepEqual(profileFieldSaveEntry('mohallaInput', { type: 'text', value: 'CHARYAA' }), { key: 'mohalla', value: 'CHARYAA' });
  assert.deepEqual(profileFieldSaveEntry('packageSpeedInput', { type: 'text', value: '20 Mbps' }), { key: 'packageSpeed', value: '20 Mbps' });
});

test('profile field save entry turns checkboxes into booleans', () => {
  assert.deepEqual(profileFieldSaveEntry('prefersSmsCheckbox', { type: 'checkbox', checked: true }), { key: 'prefersSms', value: true });
  assert.deepEqual(profileFieldSaveEntry('pauseBillingCheckbox', { type: 'checkbox', checked: false }), { key: 'paused', value: false });
});

test('profile field save entry returns null for unmapped controls', () => {
  assert.equal(profileFieldSaveEntry('saveProrataVoucherCheckbox', { type: 'checkbox', checked: true }), null);
  assert.equal(profileFieldSaveEntry('roundProrataCreditCheckbox', { type: 'checkbox', checked: true }), null);
  assert.equal(profileFieldSaveEntry('roundProrataModeSelect', { type: 'select-one', value: 'nearest' }), null);
  assert.equal(profileFieldSaveEntry('incidentNoteInput', { type: 'text', value: 'x' }), null);
  assert.equal(profileFieldSaveEntry('phoneInput', null), null);
  assert.equal(profileFieldSaveEntry('noSuchInput', { type: 'text', value: 'x' }), null);
});

test('profile field save wiring uses the map and the tokenised row class', () => {
  const appJs = read('app.js');
  assert.ok(appJs.includes('profile-field-save.js'), 'app.js must import the per-field save module');
  assert.ok(appJs.includes('profileFieldSaveEntry'), 'app.js must use profileFieldSaveEntry');
  assert.ok(appJs.includes('profile-field-row'), 'app.js must wrap control + button in a profile-field-row');
  assert.ok(appJs.includes('profile-field-save'), 'app.js must create profile-field-save buttons');
  const css = read('profile-ui.css');
  assert.ok(css.includes('.profile-field-row'), 'profile-ui.css must style the control + button row');
  assert.ok(css.includes('.profile-field-save'), 'profile-ui.css must style the per-field Save button');
});

test('profile-field controls share one size rule, selects included', () => {
  const styles = read('styles.css');
  assert.ok(styles.includes('.profile-field input, .profile-field select, .profile-field textarea'), 'profile-field rule must cover selects, not just inputs/textareas');
  assert.ok(!/\.profile-field input, \.profile-field textarea\{/.test(styles), 'no select-less profile-field control rule may remain');
});
