import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PROFILE_FIELD_SAVE_MAP } from '../profile-field-save.js';
import { isProfileFieldFilled, countProfileCompletion, countProfileCompletionFromControls } from '../profile-completion.js';
import { resolveProfileErrorTarget } from '../profile-error-jump.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');

// --- Completion counter: filled rule -------------------------------------

test('completion: blank, whitespace and "Not set" are unfilled', () => {
  for (const value of ['', '   ', 'Not set', 'not set', 'NOT SET', null, undefined, Number.NaN]) {
    assert.equal(isProfileFieldFilled(value), false, JSON.stringify(value));
  }
});

test('completion: real values count, including zero and true', () => {
  for (const value of ['03001234567', 'Orient school', 0, 2000, true, ['Haji Sahab']]) {
    assert.equal(isProfileFieldFilled(value), true, JSON.stringify(value));
  }
  assert.equal(isProfileFieldFilled(false), false);
  assert.equal(isProfileFieldFilled([]), false);
  assert.equal(isProfileFieldFilled(['', '  ']), false);
});

test('completion: counts the per-field-save controls except pure opt-in flags', () => {
  const empty = {};
  for (const key of Object.values(PROFILE_FIELD_SAVE_MAP)) empty[key] = '';
  const counted = countProfileCompletion(empty);
  // Plan 513 — the counted total is 68, not 70: the pure opt-in flags
  // (prefersSms, paused) are legitimately false for most customers, so
  // they are excluded from what "complete" means and full marks are
  // reachable. The per-field-save map holds 70 fields since Polish
  // #28 Phase D added otherInstallCost (pinned in the Plan 499/500
  // tests and the Phase D tests).
  assert.equal(counted.total, 68);
  assert.equal(counted.filled, 0);
  assert.equal(counted.text, '0/68 fields filled');
});

test('completion: filled/total label is filled first, then total', () => {
  const record = { name: 'Orient school', phone: '03001234567', cnic: '', mohalla: 'Not set' };
  const counted = countProfileCompletion(record);
  assert.equal(counted.filled, 2);
  // Plan 513 — total is 68 (opt-in flags excluded); see the test above.
  assert.equal(counted.total, 68);
  assert.equal(counted.text, '2/68 fields filled');
});

test('completion: form controls map through the same map, others ignored', () => {
  const controls = [
    { id: 'phoneInput', type: 'tel', value: '03001234567' },
    { id: 'cnicInput', type: 'text', value: '' },
    { id: 'prefersSmsCheckbox', type: 'checkbox', checked: true },
    { id: 'pauseBillingCheckbox', type: 'checkbox', checked: false },
    { id: 'saveMohallaButton', type: 'button', value: 'Save profile' },
    { id: 'unmappedInput', type: 'text', value: 'x' },
  ];
  const counted = countProfileCompletionFromControls(controls);
  // Plan 513 — only the phone counts here: both checkboxes are pure
  // opt-in flags, excluded from the counted total, so even a checked
  // prefersSms adds nothing to filled (and an unchecked pauseBilling
  // never reads as missing). Total is 68 since Polish #28 Phase D
  // added otherInstallCost to the counted list.
  assert.equal(counted.filled, 1);
  assert.equal(counted.total, 68);
});

// --- Error jump targets ---------------------------------------------------

test('error jump: known profile control jumps to that field', () => {
  assert.deepEqual(resolveProfileErrorTarget('phoneInput'), { kind: 'field', id: 'phoneInput' });
  assert.deepEqual(resolveProfileErrorTarget('cnicInput'), { kind: 'field', id: 'cnicInput' });
  assert.deepEqual(resolveProfileErrorTarget('splitterPortInput'), { kind: 'field', id: 'splitterPortInput' });
});

test('error jump: contributors jump to the share editor, never a fake field', () => {
  assert.deepEqual(resolveProfileErrorTarget('contributors'), { kind: 'contributors' });
});

test('error jump: empty or unknown errors are form-level, never a fake link', () => {
  for (const value of ['', null, undefined, 'noSuchField', 'saveMohallaButton']) {
    assert.deepEqual(resolveProfileErrorTarget(value), { kind: 'form' }, JSON.stringify(value));
  }
});

// --- Wiring: markup, styles and handlers exist ------------------------------

test('profile form carries the error banner, sticky bar and counter', () => {
  const html = read('index.html');
  assert.match(html, /id="profileFormError" class="profile-form-error"/);
  assert.match(html, /id="profileStickySaveBar" class="profile-sticky-save"/);
  assert.match(html, /id="profileStickySaveButton"[^>]*>Save profile</);
  assert.match(html, /id="profileCompletionCounter" class="profile-completion-counter"/);
});

test('error boxes are fully red, not pale warnings', () => {
  const css = read('profile-ui.css');
  const banner = css.match(/\.profile-form-error:not\(\[hidden\]\) \{([^}]*)\}/);
  assert.ok(banner, 'profile-form-error rule must exist');
  // Token red, not a raw hex: the design-token ratchet caps profile-ui.css
  // at its single legacy hex, and --color-danger-strong stays fully red
  // in both light and dark themes.
  assert.match(banner[1], /background: var\(--color-danger-strong\)/);
  assert.match(banner[1], /color: white/);
  const warn = css.match(/\.contrib-warn\.contrib-warn-error \{([^}]*)\}/);
  assert.ok(warn, 'contrib-warn-error rule must exist');
  assert.match(warn[1], /background: var\(--color-danger-strong\)/);
  assert.match(warn[1], /color: white/);
});

test('sticky bar sits above the bottom nav and never hides behind [hidden]', () => {
  const css = read('profile-ui.css');
  const bar = css.match(/\.profile-sticky-save \{([^}]*)\}/);
  assert.ok(bar, 'profile-sticky-save rule must exist');
  assert.match(bar[1], /position: fixed/);
  assert.match(bar[1], /bottom: calc\(var\(--bottom-nav-height, 60px\) \+ 8px\)/);
  assert.match(css, /#profileStickySaveBar\[hidden\] \{ display: none; \}/);
  assert.match(css, /#profileStickySaveButton \{ min-height: 48px/);
  assert.match(css, /\.customer-profile-form\.has-sticky-save \{ padding-bottom: 96px; \}/);
});

test('contributor warning is tappable and jumps to the share editor', () => {
  const ui = read('profile-ui.js');
  assert.match(ui, /class="contrib-warn contrib-warn-error" id="contribEditorWarning" role="button" tabindex="0" data-error-jump="contributors"/);
  const app = read('app.js');
  assert.match(app, /event\.target\.closest\('#contribEditorWarning'\)/);
  assert.match(app, /jumpToProfileErrorTarget\(\{ kind: 'contributors' \}\)/);
});

test('app wires the banner, the sticky save and the live counter', () => {
  const app = read('app.js');
  assert.match(app, /function showProfileFormError\(message, fieldId\)/);
  assert.match(app, /Tap to go to the top of the form\./);
  assert.match(app, /showProfileFormError\(t\('contrib_invalid_row'\), 'contributors'\)/);
  assert.match(app, /showProfileFormError\(checkPhone\.message[^,]*, 'phoneInput'\)/);
  assert.match(app, /showProfileFormError\(checkCnic\.message[^,]*, 'cnicInput'\)/);
  assert.match(app, /showProfileFormError\(t\('pswap_err_dead'.*?, 'splitterPortInput'\)/);
  assert.match(app, /\$\('#profileStickySaveButton'\)\?\.addEventListener\('click', \(\) => \{ \$\('#saveMohallaButton'\)\?\.click\(\); \}\)/);
  assert.match(app, /function syncProfileStickySaveBar\(\)/);
  assert.match(app, /function updateProfileCompletionCounter\(\)/);
  // Profile Polish B (12): the counter is computed once into
  // `completion` and rendered as a pill + progress bar, so the old
  // inline `countProfileCompletion(customer).text` call is gone.
  // Profile View Polish: the counter and the checklist merged into
  // ONE details bar — the live counted text now renders through the
  // i18n title (filled/total params), not escapeHtml(completion.text).
  assert.match(app, /const completion = countProfileCompletion\(customer\);/);
  assert.match(app, /t\('prof_completion_details_title', null, \{ filled: completion\.filled, total: completion\.total \}\)/);
  // Profile Number Field at Top (item C) — the live counter reads its
  // controls through the shared profileFieldControls() helper now (form
  // + top row), not through an inline form-only array, so the moved
  // phone field still counts.
  assert.match(app, /countProfileCompletionFromControls\(profileFieldControls\(\)\)/);
});
