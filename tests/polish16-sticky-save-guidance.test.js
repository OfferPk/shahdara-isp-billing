import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paymentFieldGuidance } from '../form-validation.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const app = read('app.js');
const formValidation = read('form-validation.js');
const profileUiCss = read('profile-ui.css');

const URDU_SCRIPT = /[\u0600-\u06FF]/;

// Polish #16, Req 3 — smart field guidance. Hints, never blocks: the
// helper returns the translated hint for a value that looks wrong for
// its field, or null when the value is fine. Empty is fine — every
// guided field is optional.
test('Polish #16: a phone-like mohalla gets the mohalla hint', () => {
  assert.equal(paymentFieldGuidance('collectionMohalla', '03012345678'), 'Yahan mohalla ka naam likhein — mobile number nahi.');
  assert.equal(paymentFieldGuidance('collectionMohalla', '0341 5277081'), 'Yahan mohalla ka naam likhein — mobile number nahi.');
  assert.equal(paymentFieldGuidance('collectionMohalla', '+92 341 5277081'), 'Yahan mohalla ka naam likhein — mobile number nahi.');
  assert.equal(paymentFieldGuidance('collectionMohalla', '923415277081'), 'Yahan mohalla ka naam likhein — mobile number nahi.');
});

test('Polish #16: a normal mohalla name, a short number and empty get no hint', () => {
  assert.equal(paymentFieldGuidance('collectionMohalla', 'Shahdara'), null);
  assert.equal(paymentFieldGuidance('collectionMohalla', 'Street 5'), null);
  assert.equal(paymentFieldGuidance('collectionMohalla', '123456789'), null);
  assert.equal(paymentFieldGuidance('collectionMohalla', ''), null);
  assert.equal(paymentFieldGuidance('collectionMohalla', null), null);
  assert.equal(paymentFieldGuidance('collectionMohalla', undefined), null);
});

test('Polish #16: digits-only names get the name hint', () => {
  assert.equal(paymentFieldGuidance('paidBy', '123456'), 'Yahan naam likhein — number nahi.');
  assert.equal(paymentFieldGuidance('collectedBy', '987654321'), 'Yahan naam likhein — number nahi.');
  assert.equal(paymentFieldGuidance('paidBy', 'Ali Raza'), null);
  assert.equal(paymentFieldGuidance('paidBy', '12345'), null);
  assert.equal(paymentFieldGuidance('paidBy', ''), null);
});

test('Polish #16: digits-only sender name gets its own hint', () => {
  assert.equal(paymentFieldGuidance('senderTitle', '112233'), 'Yahan sender ka naam likhein.');
  assert.equal(paymentFieldGuidance('senderTitle', 'Hamza'), null);
  assert.equal(paymentFieldGuidance('senderTitle', ''), null);
});

test('Polish #16: letters in the last-4-digits get the digits hint', () => {
  assert.equal(paymentFieldGuidance('senderDigits', '33A0'), 'Sirf aakhri 4 digits likhein (sirf number).');
  assert.equal(paymentFieldGuidance('senderDigits', '3310'), null);
  assert.equal(paymentFieldGuidance('senderDigits', '33 10'), null);
  assert.equal(paymentFieldGuidance('senderDigits', ''), null);
});

test('Polish #16: a digits-only discount reason gets the reason hint', () => {
  assert.equal(paymentFieldGuidance('discountReason', '123456'), 'Yahan wajah likhein — number nahi.');
  assert.equal(paymentFieldGuidance('discountReason', 'Loyalty concession'), null);
  assert.equal(paymentFieldGuidance('discountReason', '500'), null);
  assert.equal(paymentFieldGuidance('discountReason', ''), null);
});

test('Polish #16: unknown fields never get a hint', () => {
  assert.equal(paymentFieldGuidance('transactionId', '1234567890'), null);
  assert.equal(paymentFieldGuidance('amount', '2000'), null);
  assert.equal(paymentFieldGuidance('date', '2026-11-08'), null);
});

// The five hint keys exist in both languages, and the Urdu values carry
// Urdu script (the i18n rule: Urdu values in Urdu script).
test('Polish #16: every hint key exists in English and Urdu, Urdu in Urdu script', () => {
  const keys = [
    'prof_hist_hint_mohalla_phone',
    'prof_hist_hint_name_digits',
    'prof_hist_hint_sender_name_digits',
    'prof_hist_hint_sender_digits_letters',
    'prof_hist_hint_reason_digits',
    'prof_hist_save_error_generic',
  ];
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `${key} missing in en`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `${key} missing in ur`);
    assert.match(TRANSLATIONS.ur[key], URDU_SCRIPT, `${key} Urdu value has no Urdu script`);
    assert.notEqual(TRANSLATIONS.ur[key], TRANSLATIONS.en[key], `${key} Urdu value is the English text`);
  }
  assert.equal(t('prof_hist_hint_mohalla_phone', 'ur'), 'یہاں محلے کا نام لکھیں — موبائل نمبر نہیں۔');
});

// Wiring: the profile payment form binds the guidance, and only the
// five guided fields are ever wired — transactionId, amount, discount,
// date, method, promiseLink, categoryTag and collectionPlace are
// deliberately not flagged.
test('Polish #16: payment forms wire the guidance, and only the five guided fields', () => {
  assert.match(app, /wirePaymentFieldGuidance\(form\);/);
  assert.match(formValidation, /const PAYMENT_GUIDANCE_FIELDS = \['collectionMohalla', 'paidBy', 'collectedBy', 'senderTitle', 'senderDigits', 'discountReason'\];/);
  assert.match(formValidation, /hint\.className = 'field-help';/);
  assert.match(formValidation, /hint\.dataset\.paymentGuidance = field;/);
  assert.match(formValidation, /input\.addEventListener\('input', update\);/);
  assert.match(formValidation, /input\.addEventListener\('blur', update\);/);
  assert.doesNotMatch(formValidation, /PAYMENT_GUIDANCE_FIELDS = \[[^\]]*'(transactionId|amount|discount|date|method|promiseLink|categoryTag|collectionPlace)'/);
});

// Polish #16, Req 2 — sticky Save. The submit is a direct child of the
// payment form (a sticky grid item cannot move: it is constrained to
// its own grid area), it sticks above the fixed mobile bottom nav, and
// the two overflow:hidden ancestors that silently disabled sticky are
// clipped instead — same visual clipping, no scroll container.
test('Polish #16: the payment submit is a direct child of the form and sticks', () => {
  assert.match(app, /<\/div><button class="primary-button" type="submit">\$\{t\('prof_hist_pay_submit'\)\}<\/button><\/form>/);
  assert.equal((app.match(/prof_hist_pay_submit/g) || []).length, 1, 'exactly one payment submit');
  assert.match(profileUiCss, /\.payment-form > \.primary-button\[type="submit"\] \{/);
  assert.match(profileUiCss, /position: sticky;/);
  assert.match(profileUiCss, /bottom: calc\(var\(--bottom-nav-height, 60px\) \+ 8px\);/);
  assert.match(profileUiCss, /\.detail-pane \{ overflow: clip; \}/);
  assert.match(profileUiCss, /\.month-card \{ overflow: clip; \}/);
});

test('Polish #16: the correction form keeps its own in-grid submit', () => {
  assert.match(app, /<button class="primary-button" type="submit">Save correction<\/button>/);
});
