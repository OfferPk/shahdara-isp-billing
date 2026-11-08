import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');

// Plan 494: one name-edit path, not two. The header "Edit name" button
// opens the full edit form at the name field; the separate inline editor
// (its own input + Save name + Cancel + error line) is gone, so the form's
// Save profile is the only save path for the name.

test('Plan 494: the inline name editor is gone from index.html', () => {
  const html = read('index.html');
  assert.ok(!html.includes('id="customerNameEditor"'), 'no #customerNameEditor may remain');
  assert.ok(!html.includes('id="customerNameInput"'), 'no #customerNameInput (inline editor input) may remain');
  assert.ok(!html.includes('id="saveCustomerNameBtn"'), 'no #saveCustomerNameBtn (duplicate Save-name control) may remain');
  assert.ok(!html.includes('id="cancelCustomerNameBtn"'), 'no #cancelCustomerNameBtn may remain');
  assert.ok(!html.includes('id="customerNameEditError"'), 'no #customerNameEditError may remain');
  assert.ok(!html.includes('profile-name-editor'), 'no profile-name-editor class may remain');
});

test('Plan 494: the Edit name button itself stays, beside the heading', () => {
  const html = read('index.html');
  assert.ok(html.includes('id="editCustomerNameBtn" class="text-button profile-name-edit-btn"'), 'Edit name button must still sit beside the customer name');
  assert.ok(html.includes('data-i18n="prof_edit_name"'), 'Edit name label must still render via i18n');
  assert.ok(html.includes('id="profileNameInput"'), 'the form still has exactly one name field, #profileNameInput');
  assert.equal(html.split('id="profileNameInput"').length - 1, 1, 'exactly one #profileNameInput may exist');
});

// Plan 497 (2026-11-08): the form Save was PROMOTED to primary-button by
// Plan 497 ("Save profile is the primary button; Cancel stays secondary").
// The Plan 494 intent survives: the form Save still exists with the same id,
// label and save path — only its prominence changed, on purpose.
test('Plan 494: the form Save stays the single profile save (now primary, per Plan 497)', () => {
  const html = read('index.html');
  assert.ok(html.includes('id="saveMohallaButton" class="primary-button profile-save"'), 'the form Save profile button is still the one profile save — Plan 497 promoted it to primary-button, it was not demoted or removed');
});

test('Plan 494: Edit name opens the form at the name field via the error-jump', () => {
  const app = read('app.js');
  assert.ok(!app.includes('closeCustomerNameEditor'), 'closeCustomerNameEditor must be gone with the inline editor');
  assert.ok(!app.includes('customerNameEditor'), 'no customerNameEditor reference may remain in app.js');
  assert.ok(!app.includes('saveCustomerNameBtn'), 'no saveCustomerNameBtn reference may remain in app.js');
  assert.ok(!app.includes('customerNameInput'), 'no customerNameInput (inline editor input) reference may remain in app.js');
  const handlerAt = app.indexOf("$('#editCustomerNameBtn')?.addEventListener('click'");
  assert.ok(handlerAt > -1, 'the Edit name click handler must still exist');
  const handler = app.slice(handlerAt, app.indexOf('});', handlerAt) + 3);
  assert.ok(handler.includes("activateProfileTab('info')"), 'the handler must land on the Info tab first — the button is visible from any tab but the form lives in the Info panel');
  assert.ok(handler.includes('profileEditMode = true'), 'the handler must enter edit mode');
  assert.ok(handler.includes("$('#customerProfileView').hidden = true"), 'the handler must hide the profile view');
  assert.ok(handler.includes("$('#customerProfileForm').hidden = false"), 'the handler must show the full edit form');
  assert.ok(handler.includes("jumpToProfileErrorTarget({ kind: 'field', id: 'profileNameInput' })"), 'the handler must reuse the error-jump scroll/focus to land on the name field');
});

test('Plan 494: no second name-save path survives in app.js', () => {
  const app = read('app.js');
  assert.ok(!app.includes("t('prof_name_empty')"), 'the inline empty-name error is gone with the editor');
  assert.ok(!app.includes("t('prof_name_save_fail')"), 'the inline save-fail error is gone with the editor');
  // The one remaining name write is the form save's spread into
  // updateCustomerProfile (line ~11691); it must still be there.
  assert.ok(app.includes("...($('#profileNameInput') ? { name: $('#profileNameInput').value } : {})"), 'the form save must still pass the name through updateCustomerProfile');
});

test('Plan 494: the dead .profile-name-editor rules are gone from profile-ui.css', () => {
  const css = read('profile-ui.css');
  assert.ok(!css.includes('.profile-name-editor'), 'no .profile-name-editor rule may remain — the element is gone');
  assert.ok(css.includes('.profile-name-edit-btn'), 'the Edit name button styling must stay — the button still exists');
});

test('Plan 494: the inline editor i18n keys are gone from both locales', () => {
  const lang = read('nav-language.js');
  for (const key of ['prof_name_label_sr', 'prof_save_name', 'prof_name_empty', 'prof_name_save_fail']) {
    assert.ok(!lang.includes(key), `${key} must be gone from nav-language.js — nothing references it any more`);
  }
  // The button's own keys and the shared Cancel key stay.
  for (const key of ['prof_edit_name', 'prof_edit_name_title', 'prof_cancel']) {
    assert.ok(lang.includes(key), `${key} must stay — the Edit name button / other Cancel buttons still use it`);
  }
});

test('Plan 494: the rename comment in core.js no longer names the removed editor', () => {
  const core = read('core.js');
  assert.ok(!core.includes("profile header's Edit name editor"), 'core.js must not describe a removed editor as a rename caller');
  assert.ok(core.includes("if (!name) throw new Error('Customer name cannot be empty.');"), 'the empty-name guard stays — the form is now the one path that reaches it');
});
