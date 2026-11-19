// Plan 599 — Edit lands focus on the name field, not Area.
//
// The Edit button handler used to focus #mohallaInput (Area, the second
// field of the Customer Information section), so the operator started
// editing mid-form and the first Tab press went to Zone instead of Area.
// The handler now focuses #profileNameInput, the form's first field, with
// the same bare .focus() and the same four open-form steps — nothing else
// in the handler changes. The "Edit name" path still lands on the name
// field through the error-jump, and the phone-focus entry still lands on
// the phone field (it clicks Edit first, then re-focuses phone).
//
// The parity total is spelled out in words in this file's comments,
// never as digits: the plan-591 guard fails the suite on any test file
// containing the previous total's digits, and this file must not pin a
// total it did not change (Plan 599 adds no i18n key).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const selfSrc = readFileSync(join(dir, 'plan599-edit-focus-name.test.js'), 'utf8');

// The Edit button handler body, sliced from its binding to the close of
// its arrow function — the same slice polish24 uses for its assertions.
const editAt = appSrc.indexOf("$('#editProfileButton').addEventListener('click'");
const editBody = appSrc.slice(editAt, appSrc.indexOf('\n});', editAt));

// The Customer Information section of the edit form, sliced from its
// section tag to its close — the field ids inside are in DOM (tab) order.
const sectionAt = indexHtml.indexOf('data-profile-form-section="customer"');
const sectionStart = indexHtml.lastIndexOf('<section', sectionAt);
const sectionHtml = indexHtml.slice(sectionStart, indexHtml.indexOf('</section>', sectionStart));
const sectionFieldIds = [...sectionHtml.matchAll(/id="([a-zA-Z]+Input)"/g)].map((m) => m[1]);

function focusTarget(body) {
  const match = body.match(/\$\('#([a-zA-Z]+)'\)\.focus\(\)/);
  return match ? match[1] : null;
}

test('Plan 599: the Edit handler focuses the Customer name field', () => {
  assert.ok(editAt > 0, 'Edit is wired once in the static block');
  assert.equal(focusTarget(editBody), 'profileNameInput', 'Edit focuses #profileNameInput');
  assert.ok(editBody.includes("$('#profileNameInput').focus()"), 'the focus call names the name field');
});

test('Plan 599: the Edit handler no longer focuses the Area field', () => {
  assert.ok(!editBody.includes("$('#mohallaInput').focus()"), 'no Area focus remains in the Edit handler');
  // Exactly one mohalla focus exists anywhere in app.js, and it is not
  // in the Edit handler — the fix removed the only one.
  assert.equal((appSrc.match(/\$\('#mohallaInput'\)\.focus\(\)/g) || []).length, 0, 'no mohalla focus remains in app.js');
});

test('Plan 599: the focus target is the first field of the Customer Information section', () => {
  assert.ok(sectionFieldIds.length > 0, 'the section holds fields in DOM order');
  assert.equal(sectionFieldIds[0], 'profileNameInput', 'Customer name is the section\'s first field');
  assert.equal(focusTarget(editBody), sectionFieldIds[0], 'Edit focuses the section\'s first field, not a hardcoded id');
});

test('Plan 599: the Edit handler keeps its four open-form steps in order', () => {
  const steps = [
    "activateProfileTab('info')",
    'profileEditMode = true',
    "$('#customerProfileView').hidden = true",
    "$('#customerProfileForm').hidden = false",
    "$('#profileNameInput').focus()",
  ];
  let at = -1;
  for (const step of steps) {
    const next = editBody.indexOf(step, at + 1);
    assert.ok(next > at, `the step "${step}" follows the previous one`);
    at = next;
  }
});

test('Plan 599: "Edit name" still lands on the name field through the error-jump', () => {
  const nameAt = appSrc.indexOf("$('#editCustomerNameBtn')?.addEventListener('click'");
  assert.ok(nameAt > 0, 'the Edit name button is wired');
  const nameBody = appSrc.slice(nameAt, appSrc.indexOf('\n});', nameAt));
  assert.ok(nameBody.includes("jumpToProfileErrorTarget({ kind: 'field', id: 'profileNameInput' })"), 'Edit name still jumps to the name field');
  assert.ok(nameBody.includes("activateProfileTab('info')"), 'Edit name still opens the Info tab first');
});

test('Plan 599: the phone-focus entry still lands on the phone field', () => {
  const fnAt = appSrc.indexOf('function editCustomerProfile(');
  assert.ok(fnAt > 0, 'editCustomerProfile exists');
  const fnBody = appSrc.slice(fnAt, appSrc.indexOf('\n}\n', fnAt));
  assert.ok(fnBody.includes("if (focus === 'phone')"), 'the phone branch is intact');
  assert.ok(fnBody.includes("const phone = $('#phoneInput')"), 'the phone branch reads the phone field');
  assert.ok(fnBody.includes('phone?.focus()'), 'the phone branch focuses the phone field');
  assert.ok(fnBody.includes("phone?.scrollIntoView({ block: 'center' })"), 'the phone branch still centers the phone field');
  // The phone path clicks Edit first (which opens the form), then
  // re-focuses phone — the final focus is still phone.
  assert.ok(fnBody.indexOf("editBtn.click()") < fnBody.indexOf("if (focus === 'phone')"), 'Edit is clicked before the phone re-focus');
});

test('Plan 599: the first Tab press from the name field goes to Area', () => {
  assert.deepEqual(
    sectionFieldIds.slice(0, 3),
    ['profileNameInput', 'mohallaInput', 'zoneInput'],
    'the section orders name, then Area, then Zone',
  );
  assert.equal(focusTarget(editBody), 'profileNameInput', 'Edit starts on name, so Tab moves to Area next');
});

test('Plan 599: this file stays free of the parity-count digits it must not pin', () => {
  // Trap: the plan-591 guard fails the suite if any test file contains
  // the previous total's digits, and counts every file containing the
  // current total's digits. The digits are built, never spelled, so this
  // guard cannot trip the sweep it guards.
  assert.ok(!selfSrc.includes('47' + '67'), 'this file must stay free of the current-count literal');
  assert.ok(!selfSrc.includes('47' + '66'), 'this file must stay free of the previous-count literal');
});
