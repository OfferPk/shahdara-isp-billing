// Sharafat 86: hardcoded English strings outside the draft/preview sections —
// Area view, toasts, and the profile completion counter.
//
// Six new i18n keys (plus one reuse) move the last hardcoded English in the
// Area-view dialog, the kist early-payoff toasts, the statement-share toast
// and the live profile-completion counter behind t(). The profile-view
// counter already translated (prof_completion_details_title); only the live
// form counter (#profileCompletionCounter) printed the literal text field.
//
// Pins (Plan 549 pattern — dictionary + source + behaviour):
//  - dictionary: every new key exists in BOTH en and ur, defined exactly
//    once per dict block, the en value is byte-identical to the pre-change
//    literal, every ur value carries Urdu script, and the en/ur param sets
//    agree;
//  - source: no hardcoded literal remains at any listed site (button,
//    title, kist message + shared title, statement message + reused
//    title), the static dialog <h2> carries NO data-i18n (the urdu-auto
//    phase-2 pin forbids dash_ data-i18n inside <dialog>; the open handler
//    sets the title through t() before showModal()), the
//    shahdara:language-change listener calls updateProfileCompletionCounter(),
//    and the live counter renders t('prof_completion_counter');
//  - behaviour: through the real t() with explicit 'ur'/'en' — Urdu renders
//    Urdu script with the area name / operator-typed method / 11/68 figure
//    preserved verbatim, English is byte-identical to before;
//  - boundaries (deliberately untouched): profile-completion.js is not
//    edited (the pure counter keeps its English canonical text); the
//    Plan 549 qc_toast_no_phone* values are unchanged (only the title key
//    is reused); the §2.7/§2.8 follow-ups (dialog help paragraph, sibling
//    kist messages, payoff appConfirm, clipboard-failure toast) stay
//    hardcoded — asserted nothing about either way.
//
// Synthetic data only — no real customer names, no realistic phone numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS, t, URDU_SCRIPT_PATTERN } from '../nav-language.js';
import { countProfileCompletion } from '../profile-completion.js';
import { PROFILE_FIELD_SAVE_MAP } from '../profile-field-save.js';

const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const htmlSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const langSrc = readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');
const completionSrc = readFileSync(new URL('../profile-completion.js', import.meta.url), 'utf8');

const paramsOf = (s) => [...(s.match(/\{\w+\}/g) || [])].sort();

// --- Dictionary: the six new keys -----------------------------------------
const NEW_KEYS = {
  dash_area_view: { en: 'Area view', ur: /[\u0600-\u06FF]/ },
  dash_area_view_named: { en: 'Area view — {area}', ur: /[\u0600-\u06FF]/ },
  prof_kist_unknown_method: {
    en: 'Unknown payment method: {method}. The plan was not settled.',
    ur: /[\u0600-\u06FF]/,
  },
  prof_kist_not_settled_title: { en: 'Not settled', ur: /[\u0600-\u06FF]/ },
  stmt_no_phone_clipboard: {
    en: 'No phone number saved for this customer. The statement summary was copied to the clipboard instead.',
    ur: /[\u0600-\u06FF]/,
  },
  prof_completion_counter: { en: '{filled}/{total} fields filled', ur: /[\u0600-\u06FF]/ },
};
for (const [key, spec] of Object.entries(NEW_KEYS)) {
  test(`dictionary: ${key} exists in en + ur`, () => {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  });
  test(`dictionary: ${key} en is the pre-change literal`, () => {
    assert.equal(TRANSLATIONS.en[key], spec.en);
  });
  test(`dictionary: ${key} ur carries Urdu script`, () => {
    assert.match(TRANSLATIONS.ur[key], spec.ur, 'ur value has no Urdu script');
    assert.notEqual(TRANSLATIONS.ur[key], key, 'ur value is the raw key');
  });
  test(`dictionary: ${key} en/ur param sets agree`, () => {
    assert.deepEqual(paramsOf(TRANSLATIONS.en[key]), paramsOf(TRANSLATIONS.ur[key]));
  });
  test(`dictionary: ${key} defined once per dict block`, () => {
    const re = new RegExp(`^    ${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`, 'gm');
    assert.equal((langSrc.match(re) || []).length, 2, 'expected 2 definitions (en + ur)');
  });
}

// --- Reused keys: Plan 549 values are unchanged ---------------------------
test('reused keys: qc_toast_no_phone* values are unchanged', () => {
  assert.equal(TRANSLATIONS.en.qc_toast_no_phone, 'No phone number saved for this customer.');
  assert.equal(
    TRANSLATIONS.en.qc_toast_no_phone_clipboard,
    'No phone saved for this customer. The receipt text was copied to the clipboard instead.'
  );
  assert.equal(TRANSLATIONS.en.qc_toast_no_phone_title, 'No phone number');
  assert.equal(TRANSLATIONS.ur.qc_toast_no_phone_title, 'فون نمبر نہیں ہے');
});

// --- Source: no hardcoded literal at the named sites ----------------------
test('source: mohalla card has no hardcoded Area view button literal', () => {
  assert.ok(!appSrc.includes('>Area view</button>'), 'hardcoded button label still present');
  assert.ok(appSrc.includes("t('dash_area_view')"), 'button does not call t(dash_area_view)');
});
test('source: Area-view title has no hardcoded title literal', () => {
  assert.ok(!appSrc.includes('`Area view — ${view.area.stored}`'), 'hardcoded named title still present');
  assert.ok(!appSrc.includes(": 'Area view'"), 'hardcoded plain title still present');
  assert.ok(appSrc.includes("t('dash_area_view_named'"), 'title does not call t(dash_area_view_named)');
});
test('source: kist toast has no hardcoded Unknown payment method literal', () => {
  assert.ok(!appSrc.includes('Unknown payment method:'), 'hardcoded toast message still present');
  assert.ok(appSrc.includes("t('prof_kist_unknown_method'"), 'toast does not call t(prof_kist_unknown_method)');
});
test("source: no hardcoded 'Not settled' title anywhere in app.js", () => {
  assert.ok(!appSrc.includes("title:'Not settled'"), 'hardcoded toast title still present');
  assert.equal(
    (appSrc.match(/t\('prof_kist_not_settled_title'\)/g) || []).length,
    4,
    'the shared title key must be used at all four kist-payoff toasts'
  );
});
test('source: statement toast has no hardcoded No-phone message literal', () => {
  assert.ok(
    !appSrc.includes('No phone number saved for this customer. The statement summary'),
    'hardcoded statement toast still present'
  );
  assert.ok(appSrc.includes("t('stmt_no_phone_clipboard')"), 'toast does not call t(stmt_no_phone_clipboard)');
});
test('source: statement toast title reuses qc_toast_no_phone_title', () => {
  assert.ok(!appSrc.includes("title: 'No phone number'"), 'hardcoded statement title still present');
  assert.ok(appSrc.includes("t('qc_toast_no_phone_title')"), 'title does not reuse t(qc_toast_no_phone_title)');
});
test('source: static <h2> carries NO data-i18n (phase-2 dialog rule)', () => {
  // Sharafat 86 finding: the urdu-auto phase-2 pin forbids dash_ data-i18n
  // inside <dialog> (modals are a later phase), so the static <h2> keeps
  // its shipped English default with NO data-i18n. No visible flash: the
  // open handler sets the title through t() synchronously before
  // showModal(), and <dialog> content is never painted before it is shown.
  assert.ok(htmlSrc.includes('<h2 id="areaOperationsTitle">Area view</h2>'), 'h2 keeps the shipped English default text');
  assert.ok(!htmlSrc.includes('data-i18n="dash_area_view"'), 'no dash_ data-i18n may live inside a dialog (phase 2)');
});
test('source: language-change listener refreshes the form counter', () => {
  const at = appSrc.indexOf("window.addEventListener('shahdara:language-change'");
  assert.ok(at >= 0, 'language-change listener missing');
  const block = appSrc.slice(at, at + 400);
  assert.ok(block.includes('updateProfileCompletionCounter();'), 'listener does not call updateProfileCompletionCounter()');
});
test('source: live form counter renders through t(prof_completion_counter)', () => {
  assert.ok(
    appSrc.includes("t('prof_completion_counter', null, { filled: completion.filled, total: completion.total })"),
    'live counter does not call t(prof_completion_counter) with filled/total'
  );
  assert.ok(!appSrc.includes('el.textContent = completion.text;'), 'live counter still prints the literal text field');
});

// --- Behaviour through the real t() ---------------------------------------
test('behaviour ur: Area view button reads Urdu', () => {
  assert.match(t('dash_area_view', 'ur'), URDU_SCRIPT_PATTERN);
});
test('behaviour ur: Area view named title reads Urdu with the area kept', () => {
  const out = t('dash_area_view_named', 'ur', { area: 'CHARYAA' });
  assert.match(out, URDU_SCRIPT_PATTERN);
  assert.ok(out.includes('CHARYAA'), 'area name must survive verbatim');
});
test('behaviour en: Area view title is byte-identical to before', () => {
  assert.equal(t('dash_area_view', 'en'), 'Area view');
  assert.equal(t('dash_area_view_named', 'en', { area: 'CHARYAA' }), 'Area view — CHARYAA');
});
test('behaviour ur: Unknown-method toast reads Urdu with the method kept', () => {
  const out = t('prof_kist_unknown_method', 'ur', { method: 'Cash' });
  assert.match(out, URDU_SCRIPT_PATTERN);
  assert.ok(out.includes('Cash'), 'operator-typed method must survive verbatim');
});
test('behaviour en: Unknown-method toast is byte-identical to before', () => {
  assert.equal(
    t('prof_kist_unknown_method', 'en', { method: 'Cash' }),
    'Unknown payment method: Cash. The plan was not settled.'
  );
  assert.equal(t('prof_kist_not_settled_title', 'en'), 'Not settled');
});
test('behaviour ur: statement no-phone toast reads Urdu', () => {
  assert.match(t('stmt_no_phone_clipboard', 'ur'), URDU_SCRIPT_PATTERN);
});
test('behaviour en: statement no-phone toast is byte-identical to before', () => {
  assert.equal(
    t('stmt_no_phone_clipboard', 'en'),
    'No phone number saved for this customer. The statement summary was copied to the clipboard instead.'
  );
  assert.equal(t('qc_toast_no_phone_title', 'en'), 'No phone number');
});
test('behaviour ur: completion counter reads Urdu, 11/68 figure kept', () => {
  const out = t('prof_completion_counter', 'ur', { filled: 11, total: 68 });
  assert.match(out, URDU_SCRIPT_PATTERN);
  assert.ok(out.includes('11/68'), 'figure format must stay 11/68');
});
test('behaviour en: completion counter is byte-identical to before', () => {
  assert.equal(t('prof_completion_counter', 'en', { filled: 11, total: 68 }), '11/68 fields filled');
});

// --- Controls (pass on base AND after the fix) ----------------------------
test('control: an existing key already translates (dash_mohalla_collect)', () => {
  assert.equal(t('dash_mohalla_collect', 'ur'), 'فیلڈ کلیکشن');
  assert.equal(t('dash_mohalla_collect', 'en'), 'Field Collect');
});
test('control: countProfileCompletion total is still 68, text English', () => {
  const countedFields = Object.values(PROFILE_FIELD_SAVE_MAP).length;
  assert.equal(countedFields, 70, 'map holds 70 fields');
  const record = {};
  for (const key of Object.values(PROFILE_FIELD_SAVE_MAP)) record[key] = 'x';
  const counted = countProfileCompletion(record);
  assert.equal(counted.total, 68);
  assert.equal(counted.filled, 68);
  assert.equal(counted.text, '68/68 fields filled');
});
test('control: profile-view counter title already translates', () => {
  assert.equal(typeof TRANSLATIONS.en.prof_completion_details_title, 'string');
  assert.equal(typeof TRANSLATIONS.ur.prof_completion_details_title, 'string');
  assert.match(TRANSLATIONS.ur.prof_completion_details_title, URDU_SCRIPT_PATTERN);
});
test('control: EN/UR dictionary key-count parity holds', () => {
  assert.equal(
    Object.keys(TRANSLATIONS.en).length,
    Object.keys(TRANSLATIONS.ur).length,
    'en/ur dictionary parity'
  );
});
test('control: profile-completion.js is not touched', () => {
  assert.ok(!completionSrc.includes('nav-language'), 'pure counter must not import the language module');
  assert.ok(
    completionSrc.includes('text: `${filled}/${keys.length} fields filled`'),
    'canonical text template must stay'
  );
});
