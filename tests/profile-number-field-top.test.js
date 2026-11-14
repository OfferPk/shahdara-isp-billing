import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { countProfileCompletionFromControls } from '../profile-completion.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');

// Profile Number Field at Top (item C, D-C1/D-C2) — the EXISTING phone
// field (#phoneInput) + its Save button MOVED out of
// #customerProfileForm to a full-width row directly under the title row.
// Placement only: the field, its id, its save path, its validation and
// its help text are unchanged — only its position moved. The deliberate
// Plan 496 reversal (form 70 → 69 fields, Customer section 18 → 17)
// is recorded in the plan495/plan496/polish28 why-comments, and the
// counter total stays 68 because it counts the per-field-save map, not
// the form. The identity line is KEPT (D-C3) — the top row duplicates
// the number by design, so the Call/WhatsApp buttons keep working.

function formHtml() {
  const html = read('index.html');
  const start = html.indexOf('id="customerProfileForm"');
  assert.notEqual(start, -1, 'profile form must exist');
  const end = html.indexOf('id="profileContributorsEditor"', start);
  assert.notEqual(end, -1, 'form must end before the contributors editor');
  return html.slice(start, end);
}

// Slice one top-level function body out of app.js, from its declaration
// to the next top-level `function` declaration.
function functionBody(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in app.js`);
  const next = src.indexOf('\nfunction ', start + 1);
  return next === -1 ? src.slice(start) : src.slice(start, next);
}

test('item C: exactly one phone field, in the top row under the title row', () => {
  const html = read('index.html');
  assert.equal((html.match(/id="phoneInput"/g) || []).length, 1, 'exactly one phone input — MOVE, not duplicate (D-C1)');
  const rowStart = html.indexOf('id="profileTopPhoneRow"');
  assert.notEqual(rowStart, -1, 'the top phone row must exist');
  const rowEnd = html.indexOf('</div>', html.indexOf('</label>', rowStart));
  const row = html.slice(rowStart, rowEnd);
  assert.ok(row.includes('id="phoneInput"'), 'the phone field sits inside #profileTopPhoneRow');
  assert.ok(row.includes('id="phoneValidationHint"'), 'the validation hint moved with the field');
  assert.ok(row.includes('prof_form_phone_help'), 'the help text moved with the field');
  assert.ok(html.indexOf('detail-title-row') < rowStart, 'the top row sits after the title row (D-C2)');
  assert.ok(rowStart < html.indexOf('id="customerCurrentBillSummary"'), 'the top row sits before the bill summary');
  assert.ok(!formHtml().includes('phoneInput'), 'the phone field is no longer inside the edit form');
});

test('item C: the moved field keeps its markup, id and save path', () => {
  const html = read('index.html');
  assert.ok(html.includes('<input id="phoneInput" type="tel" maxlength="40" inputmode="tel" autocomplete="tel" placeholder="+923001234567">'), 'input markup byte-identical to the form version');
  const app = read('app.js');
  assert.ok(app.includes("$('#phoneInput')"), 'save/fill paths still read the field by id');
  assert.ok(read('profile-field-save.js').includes("phoneInput: 'phone'"), 'the per-field-save map still maps phoneInput to phone');
  assert.ok(app.includes("wirePhoneValidationHelper('#phoneInput'"), 'phone validation still wires by id');
});

test('item C: the per-field Save button binds to the top-row field', () => {
  const app = read('app.js');
  const bind = functionBody(app, 'bindProfileFieldSaveButtons');
  assert.ok(bind.includes('profileFieldLabels()'), 'bind gathers labels through the shared helper, not the form alone');
  assert.ok(!bind.includes("$('#customerProfileForm')"), 'bind no longer scopes itself to the form');
  assert.ok(app.includes("document.querySelectorAll('#customerProfileForm .profile-field, #profileTopPhoneRow .profile-field')"), 'the label helper covers both scopes');
});

test('item C: all six form-scoped functions see the top-row field', () => {
  const app = read('app.js');
  // The five prep-named functions plus profileCancelHasUnsavedEdits,
  // which the prep missed: it drives the Cancel label, the Save hint
  // and the full-save disabled state, so without the re-scope a top-row
  // phone edit would never mark the form dirty.
  for (const name of ['syncProfileFieldSaveButtons', 'snapshotProfileCancelBaseline', 'profileCancelHasUnsavedEdits', 'updateProfileCompletionCounter']) {
    const body = functionBody(app, name);
    assert.ok(body.includes('profileFieldControls()'), `${name} must gather controls through the shared helper`);
    assert.ok(!body.includes("form.querySelectorAll('input, select, textarea')"), `${name} must not gather controls from the form alone`);
  }
  assert.ok(app.includes("profileTopPhoneRowEl?.addEventListener('input'"), 'the top row mirrors the form input listener (Save button appears while typing)');
  assert.ok(app.includes("profileTopPhoneRowEl?.addEventListener('change'"), 'the top row mirrors the form change listener');
});

test('item C: the live counter still counts the phone, total stays 68', () => {
  // The counter total is map-derived (70 keys minus 2 opt-in flags),
  // so the move cannot change it — but the filled count only sees
  // controls the helper hands it, so the top-row phone must be in the
  // list the counter reads.
  const filled = countProfileCompletionFromControls([
    { id: 'profileNameInput', type: 'text', value: 'Test' },
    { id: 'phoneInput', type: 'tel', value: '+923001234567' },
  ]);
  assert.equal(filled.total, 68, 'counter total stays 68');
  assert.equal(filled.filled, 2, 'a filled top-row phone counts as filled');
  const unfilled = countProfileCompletionFromControls([
    { id: 'profileNameInput', type: 'text', value: 'Test' },
    { id: 'phoneInput', type: 'tel', value: '' },
  ]);
  assert.equal(unfilled.filled, 1, 'an empty top-row phone counts as unfilled');
});

test('item C: a top-field phone save refreshes the identity line and the Call/WhatsApp actions', () => {
  const app = read('app.js');
  const save = functionBody(app, 'saveProfileField');
  assert.ok(save.includes("if (saved && entry.key === 'phone')"), 'saveProfileField refreshes on the phone key');
  assert.ok(save.includes('profileIdentityLine(saved)'), 'the identity line is recomputed from the saved record');
  assert.ok(save.includes("document.querySelector('.detail-identity-actions')"), 'the Call/WhatsApp actions are refreshed too');
  assert.ok(save.includes("headerWaPhone = whatsappPhoneFor(saved)"), 'the WhatsApp target prefers a separate whatsappPhone, as renderDetail does');
  assert.ok(!save.includes('renderDetail()'), 'no renderDetail() call — the per-field save deliberately does not re-render (Plan 516)');
});
