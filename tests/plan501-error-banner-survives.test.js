import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveProfileErrorTarget, profileErrorBannerClearsOnInput } from '../profile-error-jump.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');
const app = read('app.js');

// --- Pure rule: editing the errored field clears the banner --------------

test('plan501: editing the errored field itself clears the banner', () => {
  for (const fieldId of ['phoneInput', 'cnicInput', 'splitterPortInput', 'profileNameInput']) {
    assert.equal(
      profileErrorBannerClearsOnInput(fieldId, { id: fieldId, inContributors: false }),
      true,
      fieldId,
    );
    // The jump target for the same field agrees it is a field error.
    assert.deepEqual(resolveProfileErrorTarget(fieldId), { kind: 'field', id: fieldId });
  }
});

test('plan501: typing in any other field leaves the banner alone', () => {
  const cases = [
    ['phoneInput', { id: 'cnicInput', inContributors: false }],
    ['phoneInput', { id: 'profileNameInput', inContributors: false }],
    ['cnicInput', { id: 'phoneInput', inContributors: false }],
    ['splitterPortInput', { id: 'phoneInput', inContributors: false }],
    // Contributor inputs carry no id: an id-less keystroke is never the
    // errored field, even when the error itself is a contributor error.
    ['phoneInput', { id: '', inContributors: true }],
    ['phoneInput', { id: '', inContributors: false }],
  ];
  for (const [errorField, input] of cases) {
    assert.equal(profileErrorBannerClearsOnInput(errorField, input), false, `${errorField} + ${JSON.stringify(input)}`);
  }
});

test('plan501: a contributors error clears only on an edit inside the contributor editor', () => {
  assert.deepEqual(resolveProfileErrorTarget('contributors'), { kind: 'contributors' });
  assert.equal(profileErrorBannerClearsOnInput('contributors', { id: '', inContributors: true }), true);
  assert.equal(profileErrorBannerClearsOnInput('contributors', { id: 'phoneInput', inContributors: true }), true);
  assert.equal(profileErrorBannerClearsOnInput('contributors', { id: '', inContributors: false }), false);
  assert.equal(profileErrorBannerClearsOnInput('contributors', { id: 'phoneInput', inContributors: false }), false);
});

test('plan501: a form-level error never clears on typing — only a tap does', () => {
  for (const errorField of ['', null, undefined, 'noSuchField', 'saveMohallaButton']) {
    assert.deepEqual(resolveProfileErrorTarget(errorField), { kind: 'form' }, JSON.stringify(errorField));
    for (const input of [
      { id: 'phoneInput', inContributors: false },
      { id: '', inContributors: true },
      { id: '', inContributors: false },
    ]) {
      assert.equal(profileErrorBannerClearsOnInput(errorField, input), false, `${JSON.stringify(errorField)} + ${JSON.stringify(input)}`);
    }
  }
  // A missing descriptor is never a clear either.
  assert.equal(profileErrorBannerClearsOnInput('phoneInput', undefined), false);
  assert.equal(profileErrorBannerClearsOnInput('phoneInput', null), false);
});

// --- Wiring in app.js ------------------------------------------------------

test('plan501: the form input listener gates the hide on the errored field', () => {
  assert.match(app, /import \{ resolveProfileErrorTarget, profileErrorBannerClearsOnInput \} from '\.\/profile-error-jump\.js\?v=1\.11\.0';/);
  assert.match(app, /profileFormEl\?\.addEventListener\('input', \(event\) => \{/);
  assert.match(app, /profileErrorBannerClearsOnInput\(banner\.dataset\.errorField \|\| '', \{/);
  assert.match(app, /id: event\.target\?\.id \?\? '',/);
  assert.match(app, /inContributors: Boolean\(event\.target\?\.closest\?\.\('#profileContributorsEditor'\)\),/);
  // The old unconditional hide is gone: no input event may dismiss an
  // error the operator has not touched yet.
  assert.doesNotMatch(
    app,
    /profileFormEl\?\.addEventListener\('input', \(\) => \{\n  const banner = \$\('#profileFormError'\);\n  if \(banner\) banner\.hidden = true;/,
  );
  // The rest of the listener still runs on every input: counter, sticky
  // bar, Cancel label and per-field Save sync are untouched.
  const listenerStart = app.indexOf("profileFormEl?.addEventListener('input', (event) => {");
  assert.ok(listenerStart >= 0);
  const listenerBody = app.slice(listenerStart, app.indexOf("profileFormEl?.addEventListener('change'", listenerStart));
  assert.match(listenerBody, /updateProfileCompletionCounter\(\);/);
  assert.match(listenerBody, /syncProfileStickySaveBar\(\);/);
  assert.match(listenerBody, /syncProfileCancelButton\(\);/);
  assert.match(listenerBody, /syncProfileFieldSaveButtons\(\);/);
});

test('plan501: tapping the banner still jumps to the field — and clears it', () => {
  const clickStart = app.indexOf("$('#profileFormError')?.addEventListener('click', () => {");
  assert.ok(clickStart >= 0);
  const clickBody = app.slice(clickStart, app.indexOf('function updateProfileCompletionCounter', clickStart));
  assert.match(clickBody, /jumpToProfileErrorTarget\(resolveProfileErrorTarget\(banner\?\.dataset\.errorField \|\| ''\)\);/);
  assert.match(clickBody, /if \(banner\) banner\.hidden = true;/);
});
