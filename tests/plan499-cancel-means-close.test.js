import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PROFILE_FIELD_SAVE_MAP, dirtyProfileFieldKeys, hasUnsavedProfileEdits } from '../profile-field-save.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');

// Plan 499 — Cancel means Close when nothing is unsaved.
//
// Per-field Save persists its field immediately, so "unsaved" means
// "differs from the stored record", not "differs from the values the
// form opened with" (the Plan 498 save-button baseline). A field is
// dirty only when its current value differs from BOTH the stored
// record and the value the form opened with — the open-time value
// covers the derived pre-fills renderDetail writes, which differ from
// the stored record on an untouched form.

const ctrl = (id, type, value, checked = false) => ({ id, type, value, checked });
const openFrom = (controls) => Object.fromEntries(
  controls.map((c) => [c.id, { type: c.type, value: c.value, checked: c.checked }]),
);

test('Plan 499: an untouched form is clean — values matching the stored record', () => {
  const customer = { name: 'Test Customer', phone: '03012345678', monthlySellingAmount: 1500, prefersSms: false, mohalla: 'Shahdara' };
  const controls = [
    ctrl('profileNameInput', 'text', 'Test Customer'),
    ctrl('phoneInput', 'tel', '03012345678'),
    ctrl('monthlySellingAmountInput', 'number', '1500'),
    ctrl('prefersSmsCheckbox', 'checkbox', 'on', false),
    ctrl('mohallaInput', 'text', 'Shahdara'),
  ];
  assert.deepEqual(dirtyProfileFieldKeys(customer, controls, openFrom(controls)), []);
  assert.equal(hasUnsavedProfileEdits(customer, controls, openFrom(controls)), false);
});

test('Plan 499: empty controls read clean against unset stored fields', () => {
  const customer = {};
  const controls = [
    ctrl('phoneInput', 'tel', ''),
    ctrl('addressInput', 'text', ''),
    ctrl('prefersSmsCheckbox', 'checkbox', 'on', false),
    ctrl('pauseBillingCheckbox', 'checkbox', 'on', false),
  ];
  assert.deepEqual(dirtyProfileFieldKeys(customer, controls, openFrom(controls)), []);
});

test('Plan 499: searchAliases stored as an array matches its joined rendering', () => {
  const customer = { searchAliases: ['Ali', 'Ahmed'] };
  const controls = [ctrl('searchAliasesInput', 'text', 'Ali, Ahmed')];
  assert.deepEqual(dirtyProfileFieldKeys(customer, controls, openFrom(controls)), []);
  const changed = [ctrl('searchAliasesInput', 'text', 'Ali, Bilal')];
  assert.deepEqual(dirtyProfileFieldKeys(customer, changed, openFrom(controls)), ['searchAliases']);
});

test('Plan 499: derived pre-fills read clean on an untouched form', () => {
  // Stored record has none of these; renderDetail pre-fills them.
  const customer = {};
  const controls = [
    ctrl('serviceStatusInput', 'select-one', 'not-set'),
    ctrl('preferredVisitWindowInput', 'select-one', 'anytime'),
    ctrl('connectionTypeInput', 'select-one', 'residential'),
    ctrl('seasonalRestoreRateInput', 'number', '1500'),
  ];
  assert.deepEqual(dirtyProfileFieldKeys(customer, controls, openFrom(controls)), []);
  // Editing one of them is a real unsaved edit.
  const edited = [
    ctrl('serviceStatusInput', 'select-one', 'active'),
    ctrl('preferredVisitWindowInput', 'select-one', 'anytime'),
    ctrl('connectionTypeInput', 'select-one', 'residential'),
    ctrl('seasonalRestoreRateInput', 'number', '1500'),
  ];
  assert.deepEqual(dirtyProfileFieldKeys(customer, edited, openFrom(controls)), ['serviceStatus']);
});

test('Plan 499: a typed edit is dirty, and a per-field save makes it clean again', () => {
  const stored = { phone: '03012345678', address: 'Old street' };
  const opened = [
    ctrl('phoneInput', 'tel', '03012345678'),
    ctrl('addressInput', 'text', 'Old street'),
  ];
  const open = openFrom(opened);
  // Operator per-field-saved the phone, then typed a wrong address.
  const afterPhoneSave = { phone: '03012345679', address: 'Old street' };
  const typed = [
    ctrl('phoneInput', 'tel', '03012345679'),
    ctrl('addressInput', 'text', 'Wrong street'),
  ];
  assert.deepEqual(dirtyProfileFieldKeys(afterPhoneSave, typed, open), ['address']);
  // The per-field-saved phone is never in the dirty list, so Cancel
  // can never silently revert it.
  assert.ok(!dirtyProfileFieldKeys(afterPhoneSave, typed, open).includes('phone'));
  // Editing the saved phone again is dirty once more.
  const retyped = [
    ctrl('phoneInput', 'tel', '03012345670'),
    ctrl('addressInput', 'text', 'Old street'),
  ];
  assert.deepEqual(dirtyProfileFieldKeys(afterPhoneSave, retyped, open), ['phone']);
});

test('Plan 499: a checkbox edit is dirty; unchecking back to the stored value is clean', () => {
  const customer = { prefersSms: false };
  const opened = [ctrl('prefersSmsCheckbox', 'checkbox', 'on', false)];
  const open = openFrom(opened);
  assert.deepEqual(dirtyProfileFieldKeys(customer, [ctrl('prefersSmsCheckbox', 'checkbox', 'on', true)], open), ['prefersSms']);
  assert.deepEqual(dirtyProfileFieldKeys(customer, opened, open), []);
  const storedTrue = { prefersSms: true };
  const openedTrue = [ctrl('prefersSmsCheckbox', 'checkbox', 'on', true)];
  assert.deepEqual(dirtyProfileFieldKeys(storedTrue, openedTrue, openFrom(openedTrue)), []);
  assert.deepEqual(dirtyProfileFieldKeys(storedTrue, [ctrl('prefersSmsCheckbox', 'checkbox', 'on', false)], openFrom(openedTrue)), ['prefersSms']);
});

test('Plan 499: unmapped controls never count as unsaved edits', () => {
  const customer = { phone: '03012345678' };
  const controls = [
    ctrl('phoneInput', 'tel', '03012345678'),
    ctrl('saveProrataVoucherCheckbox', 'checkbox', 'on', true),
    ctrl('roundProrataCreditCheckbox', 'checkbox', 'on', true),
    ctrl('incidentNoteInput', 'text', 'typed note'),
    ctrl('noSuchInput', 'text', 'x'),
  ];
  assert.deepEqual(dirtyProfileFieldKeys(customer, controls, openFrom(controls)), []);
  assert.equal(hasUnsavedProfileEdits(customer, controls, openFrom(controls)), false);
});

test('Plan 499: without an open-time snapshot, dirty means differs from the stored record', () => {
  const customer = { phone: '03012345678' };
  assert.deepEqual(
    dirtyProfileFieldKeys(customer, [ctrl('phoneInput', 'tel', '03012345679')], null),
    ['phone'],
  );
  assert.deepEqual(
    dirtyProfileFieldKeys(customer, [ctrl('phoneInput', 'tel', '03012345678')], null),
    [],
  );
  // An untouched derived pre-fill has no snapshot to excuse it, so it
  // reads dirty — the safe direction (towards confirming).
  assert.deepEqual(
    dirtyProfileFieldKeys({}, [ctrl('serviceStatusInput', 'select-one', 'not-set')], null),
    ['serviceStatus'],
  );
});

test('Plan 499: clearing a stored zero still counts as a change', () => {
  const customer = { connectionFee: 0 };
  const opened = [ctrl('connectionFeeInput', 'number', '0')];
  assert.deepEqual(dirtyProfileFieldKeys(customer, opened, openFrom(opened)), []);
  assert.deepEqual(dirtyProfileFieldKeys(customer, [ctrl('connectionFeeInput', 'number', '')], openFrom(opened)), ['connectionFee']);
});

test('Plan 499: Cancel is gated on the dirty check and confirms before discarding', () => {
  const app = read('app.js');
  // Plan 500 — the import gained dirtyProfileFieldKeys after
  // hasUnsavedProfileEdits; the assertion still pins that the Cancel
  // dirty helper itself is imported, not the exact import list.
  assert.match(app, /import \{[^}]*hasUnsavedProfileEdits[^}]*\} from '\.\/profile-field-save\.js/, 'app.js must import the dirty helper');
  assert.match(app, /\$\('#cancelProfileEditButton'\)\.addEventListener\('click', async \(\) => \{/, 'Cancel must use an async handler for the confirm');
  assert.ok(app.includes('if (profileCancelHasUnsavedEdits()) {'), 'Cancel must check for unsaved edits first');
  assert.ok(app.includes("const confirmed = await appConfirm({ tone: 'warning', title: t('prof_discard_title'), message: t('prof_discard_message'), confirmLabel: t('prof_discard_changes'), cancelLabel: t('prof_cancel') });"), 'dirty Cancel must confirm with the discard strings');
  assert.ok(app.includes('if (!confirmed) return;'), 'declining the confirm must keep the form open');
  assert.match(app, /profileEditMode = false; renderDetail\(\);/, 'the close itself is unchanged: exit edit mode and re-render');
});

test('Plan 499: the Cancel label swaps between Close and Discard changes', () => {
  const app = read('app.js');
  assert.ok(app.includes("const key = profileCancelHasUnsavedEdits() ? 'prof_discard_changes' : 'prof_close';"), 'label must follow the dirty state');
  assert.ok(app.includes('button.dataset.i18n = key;'), 'the i18n key must swap with the label so a language switch still translates it');
  assert.ok(app.includes('button.textContent = t(key);'), 'the label must render via t()');
});

test('Plan 499: the label is re-synced on open, on every keystroke, and after a per-field save', () => {
  const app = read('app.js');
  assert.ok(app.includes('snapshotProfileCancelBaseline();'), 'the open-time values must be snapshotted when the form opens');
  assert.ok(app.includes('profileCancelOpenValues = null;'), 'the snapshot must clear when the form closes');
  // Profile Number Field at Top (item C) — six call sites now, not
  // four: the top-row phone field mirrors the form's input and change
  // listeners, and each of those re-syncs the Cancel label too.
  assert.equal(app.split('syncProfileCancelButton();').length - 1, 6, 'sync must run on open, on input, on change, after a per-field save, and on the top-row input and change');
  assert.ok(app.includes('function syncProfileCancelButton()'), 'the sync helper must exist');
  assert.ok(app.includes('function snapshotProfileCancelBaseline()'), 'the snapshot helper must exist');
});

test('Plan 499: one explanatory line sits under the form actions', () => {
  const html = read('index.html');
  const actionsAt = html.indexOf('class="profile-form-actions"');
  const noteAt = html.indexOf('id="profileFieldSaveNote"');
  const stickyAt = html.indexOf('id="profileStickySaveBar"');
  assert.ok(actionsAt !== -1 && noteAt !== -1 && stickyAt !== -1, 'actions, note and sticky bar must all exist');
  assert.ok(noteAt > actionsAt, 'the note must sit under the form actions');
  assert.ok(noteAt < stickyAt, 'the note must sit before the sticky save bar');
  assert.ok(html.includes('data-i18n="prof_field_save_note"'), 'the note must render via i18n');
  assert.ok(html.includes('Each field\'s Save button saves that field right away'), 'the note must explain per-field saves are immediate');
  // The Cancel button itself is untouched static markup (Plan 497).
  assert.ok(html.includes('id="cancelProfileEditButton" class="secondary-button"'), 'Cancel must stay secondary-button');
  assert.ok(html.includes('data-i18n="prof_cancel"'), 'Cancel must still start on the prof_cancel key');
});

test('Plan 499: the note is styled with tokens only, no new hex', () => {
  const css = read('profile-ui.css');
  assert.ok(css.includes('.profile-form-save-note{'), 'the note needs its own rule');
  const rule = css.slice(css.indexOf('.profile-form-save-note{'), css.indexOf('}', css.indexOf('.profile-form-save-note{')) + 1);
  assert.ok(rule.includes('var(--muted)'), 'the note must use the muted token colour');
  assert.ok(!rule.includes('#'), 'the note rule must introduce no hex colour');
});

test('Plan 499: the five new i18n keys exist in en and ur, with Urdu script in ur', () => {
  const lang = read('nav-language.js');
  const keys = {
    prof_close: ['Close', 'بند کریں'],
    prof_discard_changes: ['Discard changes', 'تبدیلیاں ضائع کریں'],
    prof_discard_title: ['Discard unsaved changes?', 'غیر محفوظ شدہ تبدیلیاں ضائع کر دیں؟'],
    prof_discard_message: ['Fields you already saved with their own Save button stay saved.', 'جو فیلڈز آپ نے اپنی Save بٹن سے محفوظ کر لی ہیں وہ محفوظ رہیں گی۔'],
    prof_field_save_note: ["Each field\\'s Save button saves that field right away", 'ہر فیلڈ کی Save بٹن اس فیلڈ کو فوراً محفوظ کر دیتی ہے'],
  };
  for (const [key, [en, ur]] of Object.entries(keys)) {
    assert.ok(lang.includes(`${key}: '${en}`), `${key} must exist in en`);
    assert.ok(lang.includes(`${key}: '${ur}`), `${key} must exist in ur`);
    assert.match(ur, /[\u0600-\u06FF]/, `${key} ur value must carry Urdu script`);
  }
  // The map holds 70 fields since Polish #28 Phase D added
  // otherInstallCost — the exclusion logic this test guards is
  // unchanged, only the field count moved.
  assert.equal(Object.keys(PROFILE_FIELD_SAVE_MAP).length, 70, 'the field map must hold 70 fields');
});
