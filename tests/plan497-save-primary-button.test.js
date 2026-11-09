import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');

// Plan 497: Save profile is the primary button; Cancel stays secondary.
// Both Save controls (the in-form row and the sticky bar) are promoted to
// primary-button (existing token class); Cancel stays secondary-button.
// No behaviour change: same ids, labels, i18n keys and save path.

const formActionsLine = () => {
  const html = read('index.html');
  const lines = html.split('\n').filter((l) => l.includes('id="saveMohallaButton"'));
  assert.equal(lines.length, 1, 'exactly one in-form Save profile button must exist');
  return lines[0];
};

const stickyBarLine = () => {
  const html = read('index.html');
  const lines = html.split('\n').filter((l) => l.includes('id="profileStickySaveButton"'));
  assert.equal(lines.length, 1, 'exactly one sticky Save profile button must exist');
  return lines[0];
};

test('Plan 497: the in-form Save profile is a primary-button', () => {
  const line = formActionsLine();
  assert.ok(line.includes('id="saveMohallaButton" class="primary-button profile-save"'), 'Save profile must carry the primary-button token class');
  assert.ok(!line.includes('id="saveMohallaButton" class="secondary-button'), 'Save profile must no longer be a secondary-button');
});

test('Plan 497: Cancel stays secondary beside the promoted Save', () => {
  const line = formActionsLine();
  assert.ok(line.includes('id="cancelProfileEditButton" class="secondary-button"'), 'Cancel must stay secondary-button');
  assert.ok(line.includes('data-i18n="prof_cancel"'), 'Cancel label must still render via i18n');
  assert.ok(line.indexOf('id="saveMohallaButton"') < line.indexOf('id="cancelProfileEditButton"'), 'Save must still come before Cancel in the actions row');
});

test('Plan 497: the sticky-bar Save is a primary-button too', () => {
  const line = stickyBarLine();
  assert.ok(line.includes('id="profileStickySaveButton" class="primary-button profile-save"'), 'sticky Save must carry the primary-button token class');
  assert.ok(!line.includes('id="profileStickySaveButton" class="secondary-button'), 'sticky Save must no longer be a secondary-button');
  assert.ok(line.includes('id="profileStickySaveHint"'), 'the sticky unsaved-changes hint span must still sit beside the sticky Save');
});

test('Plan 497: both Saves keep their identity — same id, label, i18n key, type', () => {
  const html = read('index.html');
  assert.equal(html.split('id="saveMohallaButton"').length - 1, 1, 'exactly one #saveMohallaButton may exist');
  assert.equal(html.split('id="profileStickySaveButton"').length - 1, 1, 'exactly one #profileStickySaveButton may exist');
  assert.equal(html.split('id="cancelProfileEditButton"').length - 1, 1, 'exactly one #cancelProfileEditButton may exist');
  // Polish #28 Phase C — the in-form Save now also carries
  // aria-describedby="profileSaveHint" in static markup. That attribute
  // used to be set at runtime by the retired setupProfileSaveState
  // (ui-feedback.js); moving it into the tag keeps the link after the
  // retirement. Label and i18n key are unchanged.
  assert.ok(formActionsLine().includes('type="button" data-i18n="prof_form_save" aria-describedby="profileSaveHint">Save profile</button>'), 'in-form Save keeps its label and i18n key');
  assert.ok(stickyBarLine().includes('type="button" data-i18n="prof_form_save">Save profile</button>'), 'sticky Save keeps its label and i18n key');
});

test('Plan 497: save wiring is untouched — sticky Save still forwards to the in-form Save', () => {
  const app = read('app.js');
  assert.match(app, /\$\('#saveMohallaButton'\)\.addEventListener\('click'/, 'the in-form Save click handler must still exist');
  assert.match(app, /\$\('#profileStickySaveButton'\)\?\.addEventListener\('click', \(\) => \{ \$\('#saveMohallaButton'\)\?\.click\(\); \}\)/, 'the sticky Save must still forward its click to the in-form Save');
  // Plan 499 — Cancel now confirms first when unsaved edits exist, but
  // the close itself is unchanged: exit edit mode and re-render.
  assert.match(app, /\$\('#cancelProfileEditButton'\)\.addEventListener\('click', async \(\) => \{[\s\S]*?profileEditMode = false; renderDetail\(\);/, 'Cancel must still exit edit mode and re-render');
});

test('Plan 497: the primary token still gives both Saves their tap target', () => {
  const css = read('styles.css');
  assert.match(css, /\.primary-button\{border:1px solid var\(--green\);background:var\(--green\);color:white\}/, 'the primary-button token rule must still exist');
  assert.match(css, /\.primary-button\{border-radius:9px;min-height:40px/, 'the primary-button token keeps the 40px min-height the in-form Save had via .profile-form-actions .secondary-button');
  assert.match(css, /\.profile-form-actions \.secondary-button\{min-height:40px\}/, 'Cancel keeps its 40px min-height via the .profile-form-actions .secondary-button rule');
  const profileCss = read('profile-ui.css');
  assert.match(profileCss, /#profileStickySaveButton \{ min-height: 48px/, 'the sticky Save keeps its 48px id rule');
});
