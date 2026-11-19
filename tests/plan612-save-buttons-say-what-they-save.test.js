// Plan 612 — every profile Save button says what it saves.
// The five note-section Save buttons (Plan 596's sections) read their
// own scoped labels; the three remaining sections read theirs too; the
// per-field buttons keep the shared 'Save' text by design (they sit on
// their own field's line) but name the field in the aria-label, the
// Saved feedback and the toast in the operator's language; the form
// Save and the sticky-bar Save still read 'Save profile'; the Waada
// submit still reads 'Add Wada'. No behaviour change: same buttons,
// same handlers, same save paths — only the visible strings moved
// into keys.
//
// Parity discipline: this file asserts NO parity total and carries
// NEITHER the bare digits of the current total NOR the previous one
// (nor any split literal of them) — it is not a pinning file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from '../nav-language.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const t = (key, dict = 'en') => TRANSLATIONS[dict][key];

const SAVE_KEYS = {
  handling: 'prof_save_handling',
  sin: 'prof_save_sin',
  spoken: 'prof_save_spoken',
  gate: 'prof_save_gate',
  emc: 'prof_save_emc',
  pcd: 'prof_save_pcd',
  pvt: 'prof_save_pvt',
  taw: 'prof_save_taw',
};
const TOAST_KEYS = {
  handling: 'prof_saved_handling',
  sin: 'prof_saved_sin',
  spoken: 'prof_saved_spoken',
  gate: 'prof_saved_gate',
  emc: 'prof_saved_emc',
  pcd: 'prof_saved_pcd',
  pvt: 'prof_saved_pvt',
  taw: 'prof_saved_taw',
};
const EXPECTED_EN = {
  handling: 'Save handling note',
  sin: 'Save standing instruction',
  spoken: 'Save spoken language',
  gate: 'Save gate note',
  emc: 'Save emergency contact',
  pcd: 'Save collection day',
  pvt: 'Save verification',
  taw: 'Save away dates',
};

function labelsBlock(appJs, callName) {
  const at = appJs.indexOf(callName);
  assert.ok(at >= 0, `${callName} must exist in app.js`);
  return appJs.slice(at, appJs.indexOf('});', at) + 3);
}

test('Plan 612 C1: the eight section labels objects pass their own save key, never t(save)', () => {
  const appJs = read('app.js');
  const calls = {
    handling: 'handlingNoteSectionHtml(',
    sin: 'standingInstructionSectionHtml(',
    spoken: 'spokenLanguageNoteSectionHtml(',
    gate: 'gateAccessInstructionSectionHtml(',
    emc: 'customerEmergencyContactSectionHtml(',
    pcd: 'preferredCollectionDaySectionHtml(',
    pvt: 'profileVerificationTickSectionHtml(',
    taw: 'temporarilyAwayFlagSectionHtml(',
  };
  for (const [section, call] of Object.entries(calls)) {
    const block = labelsBlock(appJs, call);
    assert.ok(block.includes(`save: t('${SAVE_KEYS[section]}')`), `${section} must pass t('${SAVE_KEYS[section]}')`);
    assert.ok(!block.includes("save: t('save')"), `${section} must NOT pass the shared save key`);
  }
});

test('Plan 612 C2: the eight scoped save keys exist in EN and UR with distinct values', () => {
  for (const [section, key] of Object.entries(SAVE_KEYS)) {
    assert.equal(t(key), EXPECTED_EN[section], `${key} EN value`);
    assert.ok(t(key, 'ur') && t(key, 'ur') !== t(key), `${key} needs a distinct Urdu value`);
  }
  const seen = new Set(Object.values(SAVE_KEYS));
  assert.equal(seen.size, 8, 'eight distinct save keys');
});

test('Plan 612 C3: no two distinct section save actions share a label, in either language', () => {
  const enLabels = Object.values(SAVE_KEYS).map((k) => t(k));
  const urLabels = Object.values(SAVE_KEYS).map((k) => t(k, 'ur'));
  assert.equal(new Set(enLabels).size, 8, 'eight distinct EN save labels');
  assert.equal(new Set(urLabels).size, 8, 'eight distinct UR save labels');
  // The shared 'Save' is gone from these eight actions in both languages.
  for (const label of [...enLabels, ...urLabels]) {
    assert.notEqual(label, t('save'), 'no section save may read the shared label');
    assert.notEqual(label, t('save', 'ur'), 'no section save may read the shared label in Urdu');
  }
});

test('Plan 612 C4: each section save confirmation toast is keyed', () => {
  const appJs = read('app.js');
  const hardcoded = {
    handling: "toast('Handling note saved.');",
    sin: "toast('Standing instruction saved.');",
    spoken: "toast('Spoken language saved.');",
    gate: "toast('Gate access instruction saved.');",
    emc: "toast('Emergency contact saved.');",
    pcd: "toast('Preferred collection day saved.');",
    pvt: "toast('Profile verification saved.');",
    taw: "toast('Temporarily-away flag saved.');",
  };
  for (const [section, key] of Object.entries(TOAST_KEYS)) {
    assert.ok(appJs.includes(`toast(t('${key}'));`), `${section} save toast must call t('${key}')`);
    assert.ok(!appJs.includes(hardcoded[section]), `${section} save toast must NOT be hardcoded English`);
    assert.ok(t(key, 'ur') && t(key, 'ur') !== t(key), `${key} needs a distinct Urdu value`);
  }
});

test('Plan 612 C5: the per-field buttons keep the shared Save text but key the aria, feedback and toast', () => {
  const appJs = read('app.js');
  const bind = appJs.slice(appJs.indexOf('function bindProfileFieldSaveButtons()'), appJs.indexOf('bindProfileFieldSaveButtons();'));
  assert.ok(bind.includes("button.textContent = t('save');"), 'the per-field button text is the keyed shared Save');
  assert.ok(bind.includes("t('prof_field_save_aria', null, { field: fieldLabel || 'field' })"), 'the aria-label names the field through its key');
  assert.ok(!bind.includes('`Save ${fieldLabel'), 'the aria-label must NOT be hardcoded English');
  const saveFn = appJs.slice(appJs.indexOf('async function saveProfileField'), appJs.indexOf('function bindProfileFieldSaveButtons'));
  assert.ok(saveFn.includes("toast(t('prof_field_saved_toast', null, { field: fieldLabel }));"), 'the per-field saved toast is keyed');
  assert.ok(saveFn.includes("button.textContent = t('prof_field_saved');"), 'the Saved feedback is keyed');
  assert.ok(saveFn.includes("button.textContent = t('save');"), 'the timer/error restores are the keyed shared label');
  assert.ok(!saveFn.includes("`${fieldLabel} saved.`"), 'the toast must NOT be a hardcoded English template');
  assert.ok(!saveFn.includes("'Saved ✓'"), 'the feedback must NOT be hardcoded English');
  const sync = appJs.slice(appJs.indexOf('function syncProfileFieldSaveButtons()'), appJs.indexOf('// Plan 499 — Cancel means Close'));
  assert.ok(sync.includes("button.textContent === t('prof_field_saved')"), 'the sync compares against the keyed feedback');
});

test('Plan 612 C6: the per-field keys exist with distinct EN and UR values', () => {
  assert.equal(t('prof_field_save_aria'), 'Save {field}');
  assert.equal(t('prof_field_saved'), 'Saved ✓');
  assert.equal(t('prof_field_saved_toast'), '{field} saved.');
  assert.equal(t('prof_field_save_aria', 'ur'), '{field} محفوظ کریں');
  assert.equal(t('prof_field_saved', 'ur'), 'محفوظ ہو گیا ✓');
  assert.equal(t('prof_field_saved_toast', 'ur'), '{field} محفوظ ہو گیا۔');
});

test('Plan 612 C7: the form Save, the sticky-bar Save and the Waada submit are untouched', () => {
  const html = read('index.html');
  assert.ok(html.includes('data-i18n="prof_form_save"'), 'the form Save still carries prof_form_save');
  const formSave = html.slice(html.indexOf('id="saveMohallaButton"'), html.indexOf('>', html.indexOf('id="saveMohallaButton"')) + 1);
  assert.ok(formSave.includes('prof_form_save'), 'the form Save button keeps its key');
  const stickySave = html.slice(html.indexOf('id="profileStickySaveButton"'), html.indexOf('>', html.indexOf('id="profileStickySaveButton"')) + 1);
  assert.ok(stickySave.includes('prof_form_save'), 'the sticky-bar Save button keeps its key');
  const appJs = read('app.js');
  assert.ok(appJs.includes("prv_wd_add"), 'the Waada submit still reads Add Wada');
  assert.ok(!appJs.includes("t('prof_save_waada')"), 'no Waada save key was invented');
});

test('Plan 612 C8: the generic save key still exists and is still used outside the profile', () => {
  assert.equal(t('save'), 'Save', 'the generic save key keeps its EN value');
  assert.ok(t('save', 'ur'), 'the generic save key keeps a UR value');
  const ownerUi = read('owner-ui.js');
  assert.ok(ownerUi.includes("t('save')"), 'the owner-UI recovery-phone editor still uses the generic key');
});

test('Plan 612 G: this file carries no parity total and no bare parity digits', () => {
  const selfSrc = read('tests/plan612-save-buttons-say-what-they-save.test.js');
  // Each forbidden string is built by concatenation, so the contiguous
  // result never appears in this file's own source — the same trick
  // the split-guard files use (a bare literal here would make this
  // file a pinning file).
  assert.ok(!selfSrc.includes('TRANSLATIONS' + '.en).length'), 'this file asserts no parity total');
  assert.ok(!/'51'\s*\+\s*'/.test(selfSrc), 'this file carries no split parity literal');
  assert.ok(!/5,1\d2/.test(selfSrc), 'no formatted parity total in this file');
});
