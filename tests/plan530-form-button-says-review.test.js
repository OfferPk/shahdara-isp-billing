// Plan 530 — Form button says Review, not Confirm: the form step's
// only action button read "✓ Confirm & Issue Receipt", but tapping it
// does not save — it opens the Plan 382 confirm step, whose button
// reads "✓ Confirm & Save Payment". Two near-identical "Confirm"
// buttons in a row, the first of which only reviews, trains the
// operator to double-tap through the review without reading it. The
// form-step button now reads "Review payment →" (hardcoded page text
// and the qc_confirm_btn i18n key, EN + UR); the confirm-step button
// is unchanged and saving still requires the confirm tap. Wording
// only — no flow change.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from '../nav-language.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const pageSrc = fs.readFileSync(path.join(ROOT, '../index.html'), 'utf8');
const langSrc = fs.readFileSync(path.join(ROOT, '../nav-language.js'), 'utf8');
const wiringSrc = fs.readFileSync(path.join(ROOT, '../nav-quick-collect.js'), 'utf8');

const REVIEW_EN = 'Review payment →';
const REVIEW_UR = 'ادائیگی کا جائزہ لیں';

// The form-step button's opening tag and its inner text. The id itself
// contains "Confirm" (quickCollectConfirmBtn), so wording assertions
// must run against the inner text only, never the whole tag.
function formButtonOpenTag() {
  const openAt = pageSrc.indexOf('id="quickCollectConfirmBtn"');
  assert.ok(openAt > -1, 'the form-step button must exist in the page');
  const tagEnd = pageSrc.indexOf('>', openAt);
  assert.ok(tagEnd > openAt, 'the form-step button tag must close');
  return pageSrc.slice(openAt, tagEnd + 1);
}

function formButtonText() {
  const openAt = pageSrc.indexOf('id="quickCollectConfirmBtn"');
  assert.ok(openAt > -1, 'the form-step button must exist in the page');
  const tagEnd = pageSrc.indexOf('>', openAt);
  const closeAt = pageSrc.indexOf('</button>', tagEnd);
  assert.ok(closeAt > tagEnd, 'the form-step button must close');
  return pageSrc.slice(tagEnd + 1, closeAt);
}

// ---- The renamed button in the page ----

test('acceptance: form-step button reads "Review payment →", never "Confirm" or "Issue Receipt"', () => {
  const text = formButtonText();
  assert.ok(text.includes(REVIEW_EN), 'the form-step button must read "Review payment →"');
  assert.ok(!text.includes('Confirm'), 'the form-step button must not say "Confirm"');
  assert.ok(!text.includes('Issue Receipt'), 'the form-step button must not say "Issue Receipt"');
  assert.ok(!text.includes('Save Receipt'), 'the form-step button must not say "Save Receipt"');
  assert.ok(!text.includes('✓'), 'a review button must not carry a done checkmark');
});

test('the form-step button is the same element, only reworded', () => {
  const tag = formButtonOpenTag();
  assert.ok(tag.includes('type="submit"'), 'the form-step button stays the form submit');
  assert.ok(tag.includes('primary-button'), 'the form-step button stays primary');
  assert.ok(tag.includes('qc-confirm-btn'), 'the form-step button keeps its class');
  // No new element id: the button keeps its Plan 382-era id.
  assert.equal((pageSrc.match(/id="quickCollectConfirmBtn"/g) ?? []).length, 1, 'exactly one form-step button id');
});

// ---- The i18n key behind the live text ----

test('EN dictionary: qc_confirm_btn reads "Review payment →"', () => {
  assert.equal(TRANSLATIONS.en.qc_confirm_btn, REVIEW_EN, 'EN key must be the review wording');
  assert.ok(!TRANSLATIONS.en.qc_confirm_btn.includes('Confirm'), 'EN key must not say "Confirm"');
  assert.ok(!TRANSLATIONS.en.qc_confirm_btn.includes('Issue Receipt'), 'EN key must not say "Issue Receipt"');
});

test('UR dictionary: qc_confirm_btn reads the Urdu review wording', () => {
  assert.equal(TRANSLATIONS.ur.qc_confirm_btn, REVIEW_UR, 'UR key must be the review wording');
  assert.ok(/[\u0600-\u06FF]/.test(TRANSLATIONS.ur.qc_confirm_btn), 'UR key must carry Urdu script');
  assert.ok(!/[A-Za-z]/.test(TRANSLATIONS.ur.qc_confirm_btn), 'UR key must not carry Latin wording');
});

test('the live text follows the renamed key (EN + UR together)', () => {
  assert.ok(
    langSrc.includes("if (qcConfirm) qcConfirm.textContent = t('qc_confirm_btn', activeLang);"),
    'the language update must still drive the form-step button from qc_confirm_btn',
  );
  assert.ok(langSrc.includes(`qc_confirm_btn: '${REVIEW_EN}',`), 'EN value must sit in the dictionary');
  assert.ok(langSrc.includes(`qc_confirm_btn: '${REVIEW_UR}',`), 'UR value must sit in the dictionary');
});

// ---- The confirm-step button is untouched ----

test('acceptance: confirm-step button still reads "✓ Confirm & Save Payment"', () => {
  const openAt = pageSrc.indexOf('id="quickCollectConfirmSaveBtn"');
  assert.ok(openAt > -1, 'the confirm-step button must exist in the page');
  const closeAt = pageSrc.indexOf('</button>', openAt);
  const markup = pageSrc.slice(openAt, closeAt);
  assert.ok(markup.includes('✓ Confirm &amp; Save Payment'), 'the confirm-step button wording is unchanged');
  assert.ok(markup.includes('type="button"'), 'the confirm-step button stays a plain button');
});

// ---- Saving still requires the confirm tap ----

test('acceptance: the form submit still opens the confirm step instead of saving', () => {
  assert.ok(wiringSrc.includes("showStep('confirm');"), 'the submit path must still show the confirm step');
  assert.ok(
    wiringSrc.includes('confirm-before-posting'),
    'the Plan 382 confirm-before-posting guard must still gate the save',
  );
  assert.ok(
    wiringSrc.includes('The payment posts only after the operator confirms'),
    'the save must still wait for the confirm tap',
  );
});

// ---- Scope: wording only ----

test('no other Quick Collect button was reworded by this plan', () => {
  // The back button and the success-screen actions keep their wording.
  assert.ok(pageSrc.includes('← Back to edit'), 'the confirm-step back button is unchanged');
  assert.ok(pageSrc.includes('id="quickCollectConfirmBackBtn"'), 'the back button id is unchanged');
  // Wording only: the wiring file never names the button text, so no
  // behaviour could have changed with the rename.
  assert.ok(!wiringSrc.includes(REVIEW_EN), 'the wiring must not name the new button text');
  assert.ok(!wiringSrc.includes('Confirm & Issue Receipt'), 'the wiring must not name the old button text');
});
